/**
 * Image Pack Editor Code
 * Used by editor.html
 */

// State Management
const STATE = {
  gameModes: [], // All available image packs
  currentGameMode: null, // Currently selected image pack
  selectedLocationIndex: -1, // Currently selected location index
  currentUploadedImage: null, // Current image being uploaded/edited
  uploadedImages: new Map(), // Map of all uploaded images by filename

  // Reset a location selection
  resetLocationSelection() {
    this.selectedLocationIndex = -1;
    this.currentUploadedImage = null;
  },

  // Mark current game mode as modified
  markCurrentGameModeModified() {
    if (this.currentGameMode) {
      this.currentGameMode.saved = false;
    }
  },
};

// Initialize game modes list
async function loadGameModes() {
  STATE.gameModes = [];
  updateGameModeList();
}

/**
 * Updates the game mode list in the UI
 * Synchronizes the UI with the current state
 */
function updateGameModeList() {
  const list = document.getElementById("modeList");
  const editorMain = document.getElementById("editorMain");
  list.innerHTML = "";

  if (STATE.gameModes.length === 0) {
    const span = document.createElement("span");
    span.textContent =
      "No image packs loaded. Create a new one or load from file.";
    list.appendChild(span);
    editorMain.classList.add("hidden");
    return;
  }

  editorMain.classList.remove("hidden");
  STATE.gameModes.forEach((mode) => {
    const div = document.createElement("div");
    div.className =
      "list-item" + (mode === STATE.currentGameMode ? " selected" : "");
    div.textContent = `${mode.name} [${mode.gameModeId}]${mode.saved ? "" : " (unsaved)"}`;
    div.onclick = () => selectGameMode(mode);
    list.appendChild(div);
  });
}

/**
 * Selects a game mode and updates the UI accordingly
 * @param {Object} mode - The game mode to select
 */
function selectGameMode(mode) {
  STATE.currentGameMode = mode;
  STATE.resetLocationSelection();

  // Update form fields
  document.getElementById("gameModeName").value = mode.name || "";
  document.getElementById("gameModeId").value = mode.gameModeId || "";
  document.getElementById("gameModeAuthor").value = mode.author || "";

  // Clear location inputs
  resetLocationInputs();

  // Update UI elements
  updateLocationList();
  updateJsonPreview();
  updateGameModeList();
}

/**
 * Resets all location input fields
 */
function resetLocationInputs() {
  document.getElementById("locationX").value = "";
  document.getElementById("locationY").value = "";
  document.getElementById("locationDifficulty").value = "5"; // Default to medium difficulty
  document.getElementById("imageFileName").textContent = "No image selected";
  document.getElementById("imagePreview").style.display = "none";
  document.getElementById("imageUrl").value = "";
  document.getElementById("locationImage").value = "";
}

/**
 * Updates the JSON preview with the current game mode data
 * This keeps the UI synchronized with the state
 */
function updateJsonPreview() {
  if (!STATE.currentGameMode) {
    document.getElementById("jsonPreview").textContent = "";
    return;
  }

  // Transform locations for JSON format
  const locationsForJson = transformLocationsForExport(
    STATE.currentGameMode.locations,
  );

  // Create export object
  const exportObject = {
    name: STATE.currentGameMode.name,
    gameModeId: STATE.currentGameMode.gameModeId,
    author: STATE.currentGameMode.author || "",
    locations: locationsForJson,
  };

  // Format JSON with indentation
  document.getElementById("jsonPreview").textContent = JSON.stringify(
    exportObject,
    null,
    2,
  );
}

/**
 * Transforms locations for export format
 * @param {Array} locations - Array of location objects
 * @returns {Array} - Transformed locations
 */
function transformLocationsForExport(locations) {
  return locations.map((loc) => {
    // For remote URLs or blob URLs, keep as-is
    if (/^(https?:)?\/\//.test(loc.image) || loc.image.startsWith("blob:")) {
      return {
        x: loc.x,
        y: loc.y,
        difficulty: loc.difficulty,
        image: loc.image,
      };
    }
    // For local images, use new name if available
    return {
      x: loc.x,
      y: loc.y,
      difficulty: loc.difficulty,
      image: loc._newImageName
        ? `images/${loc._newImageName}`
        : `images/${loc.image.split("/").pop()}`,
    };
  });
}

/**
 * Updates the location list in the UI
 * Synchronizes the list with the current game mode's locations
 */
function updateLocationList() {
  const list = document.getElementById("locationList");
  list.innerHTML = "";

  if (!STATE.currentGameMode) return;

  // If no locations, show a message
  if (STATE.currentGameMode.locations.length === 0) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent =
      "No locations added yet. Add your first location using the form.";
    list.appendChild(emptyMessage);
    return;
  }

  // Create a document fragment for better performance
  const fragment = document.createDocumentFragment();

  STATE.currentGameMode.locations.forEach((loc, index) => {
    const div = document.createElement("div");
    div.className =
      "list-item" + (index === STATE.selectedLocationIndex ? " selected" : "");

    const locationInfo = document.createElement("span");
    locationInfo.textContent = `(${loc.x}, ${loc.y}) - Difficulty: ${loc.difficulty}`;
    div.appendChild(locationInfo);

    const deleteBtn = document.createElement("span");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "Delete location");
    deleteBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent location selection
      deleteLocation(index);
    };
    div.appendChild(deleteBtn);

    div.onclick = () => selectLocation(index);
    fragment.appendChild(div);
  });

  list.appendChild(fragment);
}

/**
 * Selects a location and updates the UI
 * @param {number} index - Index of the location to select
 */
function selectLocation(index) {
  if (!STATE.currentGameMode) return;

  STATE.selectedLocationIndex = index;
  const location = STATE.currentGameMode.locations[index];

  // Update form fields with location data
  document.getElementById("locationX").value = location.x;
  document.getElementById("locationY").value = location.y;
  document.getElementById("locationDifficulty").value = location.difficulty;

  // Reset current upload image state
  STATE.currentUploadedImage = null;

  // Show image preview if available
  updateImagePreview(location.image);

  // Update UI to reflect selection
  updateLocationList();
}

/**
 * Updates the image preview for a location
 * @param {string} imagePath - Path to the image
 */
function updateImagePreview(imagePath) {
  const preview = document.getElementById("imagePreview");
  const fileNameElement = document.getElementById("imageFileName");

  // Clean up any existing object URL to prevent memory leaks
  if (preview.src && preview.src.startsWith("blob:")) {
    URL.revokeObjectURL(preview.src);
  }

  if (!imagePath) {
    preview.style.display = "none";
    fileNameElement.textContent = "No image selected";
    return;
  }

  // Get just the filename without path
  const filename = imagePath.split("/").pop();

  // Check if this is a loaded image from zip or new upload
  const uploadedImage = STATE.uploadedImages.get(filename);
  if (uploadedImage) {
    // For uploaded/imported images, create a new object URL
    preview.src = URL.createObjectURL(uploadedImage.file);
    // Clean up when loaded
    preview.onload = () => URL.revokeObjectURL(preview.src);
  } else {
    // For existing images, use the full path
    preview.src = imagePath;
  }

  preview.style.display = "block";
  fileNameElement.textContent = filename;
}

/**
 * Handles image URL preview and state update
 */
async function previewImageUrl() {
  const urlInput = document.getElementById("imageUrl");
  const url = urlInput.value.trim();
  if (!url) {
    alert("Please enter an image URL or path");
    return;
  }

  try {
    // Store as current uploaded image in state
    STATE.currentUploadedImage = {
      url: url,
      isUrl: true,
    };

    // Update UI
    updateImagePreview(url);

    // Clear file input to avoid confusion
    document.getElementById("locationImage").value = "";
  } catch (error) {
    console.error("Error previewing image URL:", error);
    alert("Error loading image from URL. Please check if the URL is correct.");
  }
}

/**
 * Handles image file uploads
 * Processes the file and updates both state and UI
 */
document
  .getElementById("locationImage")
  .addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select a valid image file");
        event.target.value = ""; // Clear input
        return;
      }

      // Generate unique filename based on content hash
      const buffer = await file.arrayBuffer();
      const hashArray = new Uint8Array(
        await crypto.subtle.digest("SHA-256", buffer),
      );
      const hash = Array.from(hashArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
        .slice(0, 8); // Use first 8 characters of hash

      // Get file extension and create new filename
      const ext = file.name.split(".").pop().toLowerCase();
      const newFileName = `${hash}.${ext}`;

      // Update state
      STATE.currentUploadedImage = {
        file,
        newFileName,
        isUrl: false,
      };

      // Store in uploadedImages map using original filename as key
      STATE.uploadedImages.set(file.name, STATE.currentUploadedImage);

      // Create new object URL and update UI
      const preview = document.getElementById("imagePreview");

      // Clean up any existing object URL to prevent memory leaks
      if (preview.src && preview.src.startsWith("blob:")) {
        URL.revokeObjectURL(preview.src);
      }

      // Update preview and filename
      preview.src = URL.createObjectURL(file);
      preview.style.display = "block";
      document.getElementById("imageFileName").textContent = file.name;

      // Clean up object URL when image loads
      preview.onload = () => {
        // Do not revoke here as we need it for display
        // It will be revoked when replaced or on page unload
      };

      // Clear URL input to avoid confusion
      document.getElementById("imageUrl").value = "";
    } catch (error) {
      console.error("Error processing image:", error);
      alert("Error processing image. Please try another file.");
      event.target.value = ""; // Clear input
    }
  });

/**
 * Adds a new location to the current game mode
 * Validates inputs, updates state, and refreshes UI
 */
function addLocation() {
  if (!STATE.currentGameMode) {
    alert("Please select or create a game mode first");
    return;
  }

  // Validate inputs
  if (!validateLocationInputs()) {
    return;
  }

  // Get input values
  const x = parseFloat(document.getElementById("locationX").value);
  const y = parseFloat(document.getElementById("locationY").value);
  const difficulty = parseInt(
    document.getElementById("locationDifficulty").value,
  );

  // Create the new location object
  const location = { x, y, difficulty };

  // Add image information based on source
  if (!STATE.currentUploadedImage) {
    alert("Please select an image");
    return;
  }

  if (STATE.currentUploadedImage.isUrl) {
    // For URLs, use the URL directly
    location.image = STATE.currentUploadedImage.url;
  } else {
    // For uploaded files, use original name and store new name
    location.image = STATE.currentUploadedImage.file.name;
    location._newImageName = STATE.currentUploadedImage.newFileName;
  }

  // Add location to current game mode
  STATE.currentGameMode.locations.push(location);
  STATE.selectedLocationIndex = STATE.currentGameMode.locations.length - 1;

  // Mark as unsaved
  STATE.markCurrentGameModeModified();

  // Reset form for next location
  resetLocationInputs();
  STATE.currentUploadedImage = null;

  // Update UI
  updateLocationList();
  updateJsonPreview();
  updateGameModeList();
}

/**
 * Validates location input fields
 * @returns {boolean} - Whether inputs are valid
 */
function validateLocationInputs() {
  const x = parseFloat(document.getElementById("locationX").value);
  const y = parseFloat(document.getElementById("locationY").value);
  const difficulty = parseInt(
    document.getElementById("locationDifficulty").value,
  );

  if (isNaN(x) || isNaN(y)) {
    alert("Please enter valid numbers for X and Y coordinates");
    return false;
  }

  if (isNaN(difficulty) || difficulty < 1 || difficulty > 10) {
    alert("Please select a difficulty between 1 and 10");
    return false;
  }

  return true;
}

/**
 * Updates an existing location with current form values
 * Validates inputs, updates state, and refreshes UI
 */
function updateLocation() {
  if (!STATE.currentGameMode) {
    alert("Please select or create a game mode first");
    return;
  }

  if (STATE.selectedLocationIndex === -1) {
    alert("Please select a location to update");
    return;
  }

  // Validate inputs
  if (!validateLocationInputs()) {
    return;
  }

  // Get input values
  const x = parseFloat(document.getElementById("locationX").value);
  const y = parseFloat(document.getElementById("locationY").value);
  const difficulty = parseInt(
    document.getElementById("locationDifficulty").value,
  );

  // Get the location being updated
  const oldLocation =
    STATE.currentGameMode.locations[STATE.selectedLocationIndex];

  // Create updated location object
  const newLocation = {
    x,
    y,
    difficulty,
  };

  // Handle image update
  if (STATE.currentUploadedImage) {
    if (STATE.currentUploadedImage.isUrl) {
      // For URLs, use the URL directly
      newLocation.image = STATE.currentUploadedImage.url;
      // Remove any old _newImageName if it existed
      delete newLocation._newImageName;
    } else {
      // For uploaded files, use original name and store new name
      newLocation.image = STATE.currentUploadedImage.file.name;
      newLocation._newImageName = STATE.currentUploadedImage.newFileName;
    }
  } else {
    // Keep existing image info
    newLocation.image = oldLocation.image;
    if (oldLocation._newImageName) {
      newLocation._newImageName = oldLocation._newImageName;
    }
  }

  // Update the location in the state
  STATE.currentGameMode.locations[STATE.selectedLocationIndex] = newLocation;

  // Mark as unsaved
  STATE.markCurrentGameModeModified();

  // Reset upload state
  STATE.currentUploadedImage = null;
  document.getElementById("locationImage").value = "";
  document.getElementById("imageUrl").value = "";

  // Update UI
  updateLocationList();
  updateJsonPreview();
  updateGameModeList();
}

/**
 * Deletes a location from the current game mode
 * @param {number} index - Index of the location to delete
 */
function deleteLocation(index) {
  if (!STATE.currentGameMode) return;

  const confirmDelete = confirm(
    "Are you sure you want to delete this location?",
  );
  if (!confirmDelete) return;

  // Remove location from array
  STATE.currentGameMode.locations.splice(index, 1);

  // Reset selection
  STATE.resetLocationSelection();
  resetLocationInputs();

  // Mark as unsaved
  STATE.markCurrentGameModeModified();

  // Update UI
  updateLocationList();
  updateJsonPreview();
  updateGameModeList();
}

/**
 * Creates a new image pack/game mode
 */
function createNew() {
  // Generate a unique ID based on timestamp
  const timestamp = Date.now().toString(36);
  const uniqueId = `pack_${timestamp}`;

  // Create a new game mode with default values
  const newMode = {
    name: "New Image Pack",
    gameModeId: uniqueId,
    author: "",
    locations: [],
    path: null,
    saved: false,
  };

  // Add to game modes and select it
  STATE.gameModes.push(newMode);
  selectGameMode(newMode);

  // Focus the name input for immediate editing
  document.getElementById("gameModeName").focus();
  document.getElementById("gameModeName").select();
}

/**
 * Loads an image pack from the given path
 * @param {string} path - Path to the JSON file
 */
async function loadFile(path) {
  try {
    // Show loading indicator
    document.getElementById("modeList").innerHTML =
      "<span>Loading image pack...</span>";

    // Load from JSON file
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Failed to load ${path}`);
    const data = await response.json();

    // Validate required fields
    if (!data.name || !data.gameModeId || !Array.isArray(data.locations)) {
      throw new Error("Invalid image pack format");
    }

    const mode = {
      name: data.name,
      gameModeId: data.gameModeId,
      author: data.author || "",
      locations: data.locations,
      path: `imagePacks/${data.gameModeId}/pack.json`,
      saved: true,
    };

    // Add to game modes
    STATE.gameModes.push(mode);
    selectGameMode(mode);
  } catch (error) {
    console.error("Error loading file:", error);
    alert(`Error loading file: ${error.message}`);
    // Reset the loading message
    updateGameModeList();
  }
}

/**
 * Loads an image pack from a local file (JSON or ZIP)
 * @param {Event} event - The file input change event
 */
async function loadLocalFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    // Show loading indicator
    document.getElementById("modeList").innerHTML =
      "<span>Loading image pack...</span>";

    let data;

    // Check if it's a zip file
    if (file.name.endsWith(".zip")) {
      // Load the zip
      const zipData = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(zipData);

      // Get the pack.json file
      const jsonFile = zip.file("pack.json");
      if (!jsonFile) throw new Error("pack.json not found in zip");
      data = JSON.parse(await jsonFile.async("text"));

      // Load all images into our uploadedImages map
      const imagesFolder = zip.folder("images");
      if (imagesFolder) {
        // Clear any previous images with the same names to prevent conflicts
        const files = await imagesFolder.files;

        for (const location of data.locations) {
          const imagePath = location.image;
          if (!imagePath) continue;

          const imageName = imagePath.split("/").pop();
          const imageFile =
            imagesFolder.file(`images/${imageName}`) ||
            imagesFolder.file(imageName);

          if (imageFile) {
            const blob = new Blob([await imageFile.async("arraybuffer")], {
              type: guessImageMimeType(imageName),
            });
            STATE.uploadedImages.set(imageName, {
              file: new File([blob], imageName, { type: blob.type }),
              newFileName: imageName, // Keep same name for existing files
            });
          }
        }
      }
    } else {
      // Regular JSON file
      data = JSON.parse(await file.text());
    }

    // Validate the JSON structure
    if (!data.name || !data.gameModeId || !Array.isArray(data.locations)) {
      throw new Error(
        "Invalid JSON format: must have name, gameModeId, and locations array",
      );
    }

    // Check for duplicate game mode ID
    const existingModeIndex = STATE.gameModes.findIndex(
      (mode) => mode.gameModeId === data.gameModeId,
    );
    if (existingModeIndex !== -1) {
      const existingMode = STATE.gameModes[existingModeIndex];
      if (
        !confirm(
          `An image pack with ID "${data.gameModeId}" already exists.\n\nReplace "${existingMode.name}" with "${data.name}"?`,
        )
      ) {
        // User cancelled, reset file input
        event.target.value = "";
        updateGameModeList();
        return;
      }
      // Remove the existing mode
      STATE.gameModes.splice(existingModeIndex, 1);
    }

    const mode = {
      name: data.name,
      gameModeId: data.gameModeId,
      author: data.author || "",
      locations: data.locations,
      path: `locationData/${data.gameModeId}.zip`, // Use .zip extension
      saved: false,
    };

    // Add to game modes
    STATE.gameModes.push(mode);
    selectGameMode(mode);
  } catch (error) {
    console.error("Error reading local file:", error);
    alert(`Error reading file: ${error.message}`);
  } finally {
    // Clear the file input so the same file can be loaded again
    event.target.value = "";
  }
}

/**
 * Guesses the MIME type of an image from its filename
 * @param {string} filename - The image filename
 * @returns {string} - The guessed MIME type
 */
function guessImageMimeType(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg"; // Default fallback
  }
}

/**
 * Saves the current image pack to a ZIP file
 * Updates state and performs all necessary transformations
 */
async function saveFile() {
  if (!STATE.currentGameMode) {
    alert("No image pack selected");
    return;
  }

  try {
    // Update from form values
    updateCurrentGameModeFromForm();

    // Create a zip file containing the JSON and all images
    const zip = new JSZip();

    // Prepare locations with correct image paths for the JSON
    const locationsForJson = transformLocationsForExport(
      STATE.currentGameMode.locations,
    );

    // Create the export object with author information
    const exportObject = {
      name: STATE.currentGameMode.name,
      gameModeId: STATE.currentGameMode.gameModeId,
      author: STATE.currentGameMode.author || "",
      locations: locationsForJson,
    };

    // Add the JSON file with new image paths
    const jsonString = JSON.stringify(exportObject, null, 2);
    zip.file("pack.json", jsonString);

    // Add the images folder
    const imagesFolder = zip.folder("images");

    // Show progress indication
    const statusMessage = document.createElement("div");
    statusMessage.className = "status-message";
    statusMessage.textContent = "Packaging images...";
    document.body.appendChild(statusMessage);

    // Process all images
    let processedCount = 0;
    const totalImages = STATE.currentGameMode.locations.length;

    // Add only local images (skip remote URLs and blobs)
    for (const location of STATE.currentGameMode.locations) {
      processedCount++;
      statusMessage.textContent = `Packaging images... (${processedCount}/${totalImages})`;

      if (
        /^(https?:)?\/\//.test(location.image) ||
        location.image.startsWith("blob:")
      ) {
        continue; // skip remote/blobs
      }

      const imagePath = location.image;
      const imageFileName = imagePath.split("/").pop(); // Get just the filename

      // Check if this is a newly uploaded image
      const uploadedImage = STATE.uploadedImages.get(imageFileName);
      if (uploadedImage) {
        // Use the new image file and name
        const imageData = await uploadedImage.file.arrayBuffer();
        const targetName = location._newImageName || imageFileName;
        imagesFolder.file(targetName, imageData);
      } else {
        // This is an existing image, copy it as-is
        try {
          const response = await fetch(imagePath);
          if (response.ok) {
            const imageData = await response.arrayBuffer();
            imagesFolder.file(imageFileName, imageData);
          } else {
            console.warn(
              `Could not fetch image: ${imagePath} - HTTP ${response.status}`,
            );
          }
        } catch (error) {
          console.error(`Failed to fetch image: ${imagePath}`, error);
        }
      }
    }

    // Generate the zip file
    statusMessage.textContent = "Generating ZIP file...";
    const content = await zip.generateAsync({ type: "blob" });

    // Create a download link for the zip
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${STATE.currentGameMode.gameModeId}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Mark as saved
    STATE.currentGameMode.saved = true;

    // Clean up status message
    document.body.removeChild(statusMessage);

    // Update UI
    updateGameModeList();
  } catch (error) {
    console.error("Error saving file:", error);
    alert(`Error saving file: ${error.message}`);
  }
}

/**
 * Updates the current game mode with values from the form
 */
function updateCurrentGameModeFromForm() {
  if (!STATE.currentGameMode) return;

  STATE.currentGameMode.name = document.getElementById("gameModeName").value;
  STATE.currentGameMode.gameModeId =
    document.getElementById("gameModeId").value;
  STATE.currentGameMode.author =
    document.getElementById("gameModeAuthor").value;
  STATE.currentGameMode.path = `imagePacks/${STATE.currentGameMode.gameModeId}/pack.json`;
}

// Add input change handlers
document.getElementById("gameModeName").addEventListener("input", () => {
  if (!STATE.currentGameMode) return;
  STATE.currentGameMode.name = document.getElementById("gameModeName").value;
  STATE.markCurrentGameModeModified();
  updateGameModeList();
});

document.getElementById("gameModeId").addEventListener("input", () => {
  if (!STATE.currentGameMode) return;
  STATE.currentGameMode.gameModeId =
    document.getElementById("gameModeId").value;
  STATE.currentGameMode.path = `locationData/${STATE.currentGameMode.gameModeId}.json`;
  STATE.markCurrentGameModeModified();
  updateGameModeList();
});

document.getElementById("gameModeAuthor").addEventListener("input", () => {
  if (!STATE.currentGameMode) return;
  STATE.currentGameMode.author =
    document.getElementById("gameModeAuthor").value;
  STATE.markCurrentGameModeModified();
  updateJsonPreview();
});

// Handle page unload to prevent accidental data loss
window.addEventListener("beforeunload", (event) => {
  // Check if any game mode is unsaved
  const hasUnsavedChanges = STATE.gameModes.some(
    (mode) => mode.saved === false,
  );
  if (hasUnsavedChanges) {
    // Standard way to show a confirmation dialog
    event.preventDefault();
    event.returnValue =
      "You have unsaved changes. Are you sure you want to leave?";
    return event.returnValue;
  }
});

// Cleanup function to prevent memory leaks
window.addEventListener("unload", () => {
  // Revoke any blob URLs to prevent memory leaks
  const preview = document.getElementById("imagePreview");
  if (preview.src && preview.src.startsWith("blob:")) {
    URL.revokeObjectURL(preview.src);
  }
});

// Initialize the UI
loadGameModes();

// Add keyboard shortcuts
document.addEventListener("keydown", (event) => {
  // Ctrl+S to save
  if (event.ctrlKey && event.key === "s") {
    event.preventDefault();
    saveFile();
  }
});
