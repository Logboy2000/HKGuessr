import { dataLoaded, GameManager } from "./game.js";



document.body.onload = loadLocationData;

// Single object to store all game mode data
window.gameModeData = {};

const defaultImagePacks = ["normal", "charms"];
const defaultImagePacksFolder = "data/defaultImagePacks/";

// Handle loading custom image packs from ZIP files
async function loadCustomImagePack(file) {
  try {
    // Load the zip
    const zipData = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(zipData);

    // Get the pack.json file
    const jsonFile = zip.file("pack.json");
    if (!jsonFile) throw new Error("pack.json not found in zip");
    const data = JSON.parse(await jsonFile.async("text"));

    // Create object URLs for all images
    const locations = await Promise.all(
      data.locations.map(async (loc) => {
        // If it's a remote URL (http/https/blob), use as is
        if (
          /^(https?:)?\/\//.test(loc.image) ||
          loc.image.startsWith("blob:")
        ) {
          return [loc.x, loc.y, loc.difficulty, loc.image];
        }
        // Otherwise, treat as local image in zip
        const imageName = loc.image.split("/").pop();
        const imageFile = zip.file(`images/${imageName}`);
        if (!imageFile) throw new Error(`Image ${imageName} not found in zip`);
        const blob = new Blob([await imageFile.async("arraybuffer")]);
        const imageUrl = URL.createObjectURL(blob);
        return [loc.x, loc.y, loc.difficulty, imageUrl];
      })
    );

    // Add to game modes
    gameModeData[data.gameModeId] = {
      name: data.name,
      locations: locations,
    };

    // Initialize GameManager.usedLocations for this game mode
    if (typeof GameManager.usedLocations !== "undefined") {
      GameManager.usedLocations[data.gameModeId] = [];
    } else {
      console.warn(
        "GameManager.usedLocations not initialized yet, waiting for script.js to load"
      );
      // Create a small delay to allow script.js to initialize
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (typeof GameManager.usedLocations !== "undefined") {
        GameManager.usedLocations[data.gameModeId] = [];
      } else {
        throw new Error(
          "GameManager.usedLocations is not available. Make sure script.js is loaded first."
        );
      }
    }

    // Update game mode select options
    const gameModeSelect = document.getElementById("gameMode");
    const option = document.createElement("option");
    option.value = data.gameModeId;
    option.textContent = `${data.name} (Custom)`;
    gameModeSelect.appendChild(option);
    gameModeSelect.value = data.gameModeId;

    // Trigger change event to update the game
    gameModeSelect.dispatchEvent(new Event("change"));
  } catch (error) {
    console.error("Error loading custom image pack:", error);
    alert(`Error loading image pack: ${error.message}`);
  }
}

async function loadLocationData() {
  try {
    // Clear existing data
    gameModeData = {};

    // Update game mode select options
    const gameModeSelect = document.getElementById("gameMode");
    gameModeSelect.innerHTML = "";

    // Load each image pack
    for (const packName of defaultImagePacks) {
      try {
        // Load the pack.json file from the image pack folder
        const response = await fetch(
          `${defaultImagePacksFolder}${packName}/pack.json`
        );
        if (!response.ok) {
          console.error(`Failed to load ${packName} pack.json`);
          continue;
        }

        // Parse the JSON data
        const data = await response.json();

        // Process the locations, updating image paths to use the image pack folder
        const locations = data.locations.map((loc) => {
          // If it's a remote URL (http/https/blob), use as is
          if (
            /^(https?:)?\/\//.test(loc.image) ||
            loc.image.startsWith("blob:")
          ) {
            return [loc.x, loc.y, loc.difficulty, loc.image];
          }
          // Otherwise, use local image path
          const imageName = loc.image.split("/").pop();
          return [
            loc.x,
            loc.y,
            loc.difficulty,
            `${defaultImagePacksFolder}${packName}/images/${imageName}`,
          ];
        });

        // Store data using gameModeId as the key
        gameModeData[data.gameModeId] = {
          name: data.name,
          locations: locations,
        };

        // Initialize GameManager.usedLocations for this game mode
        if (typeof GameManager.usedLocations !== "undefined") {
          GameManager.usedLocations[data.gameModeId] = [];
        }

        // Add option to game mode select
        const option = document.createElement("option");
        option.value = data.gameModeId;
        option.textContent = data.name;
        gameModeSelect.appendChild(option);
      } catch (error) {
        console.error(`Error loading ${packName} pack:`, error);
      }
    }

    console.log("Location data loaded successfully!");
  } catch (error) {
    console.error("Error loading location data:", error);
    // Fallback to empty object if loading fails
    gameModeData = {};
  }

  // Call the global dataLoaded function from script.js
  if (typeof dataLoaded === "function") {
    dataLoaded();
  } else {
    console.error("dataLoaded function not found");
  }
}

// Add event listener for custom image pack upload
const customImagePackInput = document.getElementById("customImagePack");
if (customImagePackInput) {
  customImagePackInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".zip")) {
      alert("Please select a ZIP file");
      event.target.value = "";
      return;
    }

    await loadCustomImagePack(file);

    // Clear the input so the same file can be loaded again
    event.target.value = "";
  });
}
