///////////////////////////////////////////////
////// Geoguessr Clone for Hollow Knight //////
///////////////////////////////////////////////
//BEWARE THIS SOURCE CODE IS AN ABSOLUTE MESS//
///////////////////////////////////////////////

/**
 * Manages all game logic and state
 * Used by game.html
 */

/// DOM elements ///
// Game options elements
var customDifficultyDiv = document.getElementById("customDifficultyDiv");
var difficultySelector = document.getElementById("difficultySelector");
var roundCountInput = document.getElementById("roundCount");
var timerLengthInput = document.getElementById("timerLength");

// Game window elements
var accuracyElement = document.getElementById("accuracy");
var finalScoreDisplay = document.getElementById("finalScore");
var gameOverWindow = document.getElementById("gameOverWindow");
var gameOptionsWindow = document.getElementById("gameOptionsWindow");
var loadingText = document.getElementById("loadingText");
var roundElement = document.getElementById("round");
var timerDisplay = document.getElementById("timerDisplay");
var totalRoundsElement = document.getElementById("totalRounds");
var timerLengthDisplay = document.getElementById("timerLengthDisplay");

// Map and location elements
var guessButton = document.getElementById("guessButton");
var locationImgElement = document.getElementById("locationImg");
var mapCanvas = document.getElementById("mapCanvas");
var mapContainer = document.getElementById("mapContainer");
var showMapButton = document.getElementById("showMapButton");

// Game states
const GAMESTATES = {
  guessing: 0,
  guessed: 1,
  gameOver: 2,
  optionsWindow: 3,
};

// Difficult Ranges
const DIFFICULTRANGE = {
  easy: { min: 1, max: 3 },
  normal: { min: 4, max: 7 },
  hard: { min: 8, max: 10 },
};

let imageIsLoaded = false;



let gameState = GAMESTATES.optionsWindow;
let usedLocations = {};
/*
Location Definition
[
  x,           // index 0
  y,           // index 1
  difficulty,  // index 2
  imageUrl     // index 3
]
*/
let currentLocation = null;
let currentRound = 0;
let totalRounds = 5;
let totalScore = 0;
let roundScore = 0;
let maxScore = 5000;
let timerLengthSeconds = 60;
let timerEnabled = false;
let endTime;

// Canvas context
let mapCtx;

// Images
let mapImg = new Image();
mapImg.src = "images/map.png";
let knightPinImg = new Image();
knightPinImg.src = "images/knightPin.png";
let shadePinImg = new Image();
shadePinImg.src = "images/shadePin.png";

// Camera properties
let mapCamera = {
  x: -2249,
  y: -1450,
  targetX: 0,
  targetY: 0,
  zoom: 0.125,
  targetZoom: 0.125,
};

// Mouse position
let mousePos = {
  x: 0,
  y: 0,
};

// Mouse position relative to camera
let mouseXRelative = 0;
let mouseYRelative = 0;

// Guess position
let guessPos = null;

let minDiff = 1;
let maxDiff = 10;

// Called when the location data is loaded
function dataLoaded() {
  // Camera reset
  mapCamera.targetX = mapCamera.x;
  mapCamera.targetY = mapCamera.y;

  // canvas ctx thingy
  mapCtx = mapCanvas.getContext("2d");

  // this function should not scare you
  addEventListeners();

  // Initialize used locations for each game mode
  usedLocations = {};
  Object.keys(gameModeData).forEach((mode) => {
    usedLocations[mode] = [];
  });

  openWindow("options");
  loadingText.style.display = "none";

  // Get the first available game mode
  const firstGameMode = Object.keys(gameModeData)[0];
  if (firstGameMode && gameModeData[firstGameMode].locations) {
    const locations = gameModeData[firstGameMode].locations;
    setLocation(randIRange(0, locations.length - 1), firstGameMode);
    if (currentLocation && currentLocation[3]) {
      locationImgElement.src = currentLocation[3];
    } else {
      console.error("Invalid current location or image path");
    }
  }

  requestAnimationFrame(update);
}

function restartGame() {
  // Check if roundCountInput value is a valid number
  if (
    !isNaN(roundCountInput.value) &&
    roundCountInput.value !== "" &&
    roundCountInput.value > 0
  ) {
    totalRounds = Number(roundCountInput.value); // Convert to number
  } else {
    alert("Please use a valid number for round count");
    return;
  }

  minDiff = Number(document.getElementById("minDifficulty").value);
  maxDiff = Number(document.getElementById("maxDifficulty").value);

  if (minDiff > maxDiff) {
    alert("Minimum difficulty cannot be greater than maximum difficulty");
    return;
  }

  timerEnabled = document.getElementById("timerEnabled").checked;

  // Check if timerLengthInput value is a valid number
  if (timerEnabled) {
    if (
      !isNaN(timerLengthInput.value) &&
      timerLengthInput.value !== "" &&
      timerLengthInput.value > 0
    ) {
      timerLengthSeconds = Number(timerLengthInput.value); // Convert to number
    } else if (timerLengthInput.value === "") {
      timerLengthSeconds = 60;
    } else {
      alert("Please use a valid number for timer length");
      return;
    }
  }

  gameState = GAMESTATES.guessing;
  totalScore = 0;
  currentRound = 0;

  openWindow(null);
  guessButton.disabled = true;
  guessButton.innerText = "Guess!";

  nextRound();
}

function update() {
  // Timer
  if (timerEnabled && gameState === GAMESTATES.guessing && imageIsLoaded) {
    const currentTime = performance.now();
    const remainingTime = endTime - currentTime;

    if (remainingTime <= 0) {
      timerDisplay.innerText = "0.00";
      guessButtonClicked();
    } else {
      timerDisplay.innerText = (remainingTime / 1000).toFixed(2);
    }
  }

  // Drawing
  mapCanvas.width = mapCanvas.clientWidth;
  mapCanvas.height = mapCanvas.clientHeight;
  mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
  mapCtx.save();
  mapCamera.x = lerp(mapCamera.x, mapCamera.targetX, 0.5);
  mapCamera.y = lerp(mapCamera.y, mapCamera.targetY, 0.5);
  mapCamera.zoom = lerp(mapCamera.zoom, mapCamera.targetZoom, 0.25);
  mapCtx.translate(mapCanvas.width / 2, mapCanvas.height / 2);
  mapCtx.scale(mapCamera.zoom, mapCamera.zoom);
  mapCtx.translate(mapCamera.x, mapCamera.y);

  mapCtx.drawImage(mapImg, 0, 0, mapImg.width, mapImg.height);

  if (gameState === GAMESTATES.guessed || gameState === GAMESTATES.gameOver) {
    // Draw line between guess and correct spot
    if (guessPos) {
      mapCtx.beginPath();
      mapCtx.moveTo(guessPos.x, guessPos.y);
      mapCtx.lineTo(currentLocation[0], currentLocation[1]);
      mapCtx.strokeStyle = "red";
      mapCtx.lineWidth = 10;
      mapCtx.stroke();
    }

    // Draw shade at correct spot
    mapCtx.drawImage(
      shadePinImg,
      currentLocation[0] - shadePinImg.width / 2,
      currentLocation[1] - shadePinImg.height / 2,
    );
  }

  // Draw knight at guessed spot
  if (guessPos) {
    mapCtx.drawImage(
      knightPinImg,
      guessPos.x - knightPinImg.width / 2,
      guessPos.y - knightPinImg.height / 2,
    );
  }

  mapCtx.restore();

  mapCtx.font = "20px Trajan Pro Bold";
  if (
    gameState !== GAMESTATES.guessing &&
    gameState !== GAMESTATES.optionsWindow
  ) {
    const boxWidth = 300;
    const boxHeight = 25;
    const boxX = (mapCanvas.width - boxWidth) / 2;
    const boxY = mapCanvas.height - boxHeight - 20;
    const cornerRadius = 10;

    mapCtx.fillStyle = "rgba(0, 0, 0, 0.7)";
    mapCtx.beginPath();
    mapCtx.moveTo(boxX + cornerRadius, boxY);
    mapCtx.lineTo(boxX + boxWidth - cornerRadius, boxY);
    mapCtx.quadraticCurveTo(
      boxX + boxWidth,
      boxY,
      boxX + boxWidth,
      boxY + cornerRadius,
    );
    mapCtx.lineTo(boxX + boxWidth, boxY + boxHeight - cornerRadius);
    mapCtx.quadraticCurveTo(
      boxX + boxWidth,
      boxY + boxHeight,
      boxX + boxWidth - cornerRadius,
      boxY + boxHeight,
    );
    mapCtx.lineTo(boxX + cornerRadius, boxY + boxHeight);
    mapCtx.quadraticCurveTo(
      boxX,
      boxY + boxHeight,
      boxX,
      boxY + boxHeight - cornerRadius,
    );
    mapCtx.lineTo(boxX, boxY + cornerRadius);
    mapCtx.quadraticCurveTo(boxX, boxY, boxX + cornerRadius, boxY);
    mapCtx.closePath();
    mapCtx.fill();

    // Add white border
    mapCtx.strokeStyle = "white";
    mapCtx.lineWidth = 2;
    mapCtx.stroke();

    mapCtx.fillStyle = "#FFF";
    mapCtx.textAlign = "center";
    mapCtx.fillText(
      `You earned ${roundScore} points`,
      mapCanvas.width / 2,
      mapCanvas.height - 25,
    );
  }

  mapCtx.fillStyle = "rgba(0, 0, 0, 0.5)";
  mapCtx.fillRect(0, 0, 250, 25);

  mapCtx.fillStyle = "white";
  mapCtx.textAlign = "left";
  if (guessPos) {
    mapCtx.fillText(
      `Guess: ${Math.round(guessPos.x)}, ${Math.round(guessPos.y)}`,
      10,
      20,
    );
  }
  requestAnimationFrame(update);
}

function updateRoundCounter() {
  if (checkNumberIntegrity(roundCountInput, true, false)) {
    totalRounds = Number(roundCountInput.value); // Convert to number
  } else return;

  roundElement.textContent = `${currentRound}/${totalRounds}`;
}

function checkNumberIntegrity(element, integer = true, updateIfInvalid = true) {
  let maxValue = Number(element.getAttribute("max")) || Infinity;
  let minValue = Number(element.getAttribute("min")) || 1;

  if (
    !isNaN(element.value) &&
    element.value !== "" &&
    element.value >= minValue
  ) {
    if (element.value > maxValue) element.value = maxValue;
    if (integer) element.value = parseInt(element.value);
    return true;
  }

  if (updateIfInvalid) {
    element.value = Number(element.getAttribute("value"));
  }

  if (integer) element.value = parseInt(element.value);
  return false;
}

function checkWhetherYouShouldShowTheDifficultySelectorDiv() {
  if (difficultySelector.value === "custom") {
    customDifficultyDiv.style.display = "flex";
  } else {
    customDifficultyDiv.style.display = "none";
  }
}

/*
Old function name:
checkWhetherYouShouldShowTheDifficultySelectorDivIWonderHowLongICanMakeThisFunctionNameOhTheEndlessExpanseOfCodeStretchingFarAndWideAFunctionNameSoLongItCannotHideThroughLoopsAndLogicItWeavesItsTaleASagaOfProgrammingDestinedToPrevailTheDifficultySelectorAHumbleDivToShowOrNotToShowThatIsTheQueryIGiveWhenTheUserSelectsCustomFromTheDropdownThisFunctionAwakensItsPurposeWellKnownLikeAPoetLostInTheLabyrinthOfThoughtThisFunctionRamblesItsNameOverwroughtYetInItsMadnessThereLiesAPlanToToggleTheVisibilityAsOnlyItCanSoHereWeStandAtTheEdgeOfReasonAFunctionNameDefyingEverySeasonForInTheChaosTheresBeautyToFindATestamentToTheProgrammersMindNowBackToTheTaskLetsNotDelayTheDivMustBeShownComeWhatMayAnywayHowsYourDayBeen
 */

function addEventListeners() {
  checkWhetherYouShouldShowTheDifficultySelectorDiv();
  difficultySelector.addEventListener("change", () => {
    const selectedDifficulty = difficultySelector.value;
    checkWhetherYouShouldShowTheDifficultySelectorDiv();
  });

  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let hasMoved = false;
  let initialZoom;
  let pinchStartDistance;

  document.addEventListener("keypress", function (event) {
    if (event.code === "Space") {
      guessButtonClicked();
    }
    if (event.key === "f" || event.key === "Escape") {
      toggleFullscreen();
    }
  });

  mapCanvas.addEventListener("mousedown", function (event) {
    const rect = mapCanvas.getBoundingClientRect();
    mousePos.x = event.clientX - rect.left;
    mousePos.y = event.clientY - rect.top;
    mouseXRelative =
      (mousePos.x - mapCanvas.width / 2) / mapCamera.zoom - mapCamera.x;
    mouseYRelative =
      (mousePos.y - mapCanvas.height / 2) / mapCamera.zoom - mapCamera.y;

    isDragging = true;
    hasMoved = false;
    dragStart.x = event.clientX;
    dragStart.y = event.clientY;
  });

  mapCanvas.addEventListener("mousemove", function (event) {
    const rect = mapCanvas.getBoundingClientRect();
    mousePos.x = event.clientX - rect.left;
    mousePos.y = event.clientY - rect.top;
    mouseXRelative =
      (mousePos.x - mapCanvas.width / 2) / mapCamera.zoom - mapCamera.x;
    mouseYRelative =
      (mousePos.y - mapCanvas.height / 2) / mapCamera.zoom - mapCamera.y;

    if (isDragging) {
      let dx = event.clientX - dragStart.x;
      let dy = event.clientY - dragStart.y;

      if (dx !== 0 || dy !== 0) {
        hasMoved = true;
      }

      mapCamera.targetX += dx / mapCamera.zoom;
      mapCamera.targetY += dy / mapCamera.zoom;

      dragStart.x = event.clientX;
      dragStart.y = event.clientY;
    }
  });

  mapCanvas.addEventListener("mouseup", function () {
    if (!hasMoved) {
      updateGuessPos();
    }
    isDragging = false;
  });

  mapCanvas.addEventListener("mouseleave", function () {
    isDragging = false;
  });

  mapCanvas.addEventListener("wheel", function (event) {
    event.preventDefault();
    let zoomFactor = Math.exp(-event.deltaY * 0.001);
    mapCamera.targetZoom *= zoomFactor;
    mapCamera.targetZoom = Math.min(Math.max(mapCamera.targetZoom, 0.1), 5);
  });

  // Touch events for mobile support
  mapCanvas.addEventListener("touchstart", function (event) {
    if (event.touches.length === 1) {
      isDragging = true;
      hasMoved = false;
      dragStart.x = event.touches[0].clientX;
      dragStart.y = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      isDragging = false;
      pinchStartDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );
      initialZoom = mapCamera.targetZoom;
    }
  });

  mapCanvas.addEventListener("touchmove", function (event) {
    if (event.touches.length === 1 && isDragging) {
      const rect = mapCanvas.getBoundingClientRect();
      mousePos.x = event.touches[0].clientX - rect.left;
      mousePos.y = event.touches[0].clientY - rect.top;
      mouseXRelative =
        (mousePos.x - mapCanvas.width / 2) / mapCamera.zoom - mapCamera.x;
      mouseYRelative =
        (mousePos.y - mapCanvas.height / 2) / mapCamera.zoom - mapCamera.y;

      let dx = event.touches[0].clientX - dragStart.x;
      let dy = event.touches[0].clientY - dragStart.y;

      if (dx !== 0 || dy !== 0) {
        hasMoved = true;
      }

      mapCamera.targetX += dx / mapCamera.zoom;
      mapCamera.targetY += dy / mapCamera.zoom;

      dragStart.x = event.touches[0].clientX;
      dragStart.y = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      const currentDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      );
      const zoomFactor = currentDistance / pinchStartDistance;
      mapCamera.targetZoom = initialZoom * zoomFactor;
      mapCamera.targetZoom = Math.min(Math.max(mapCamera.targetZoom, 0.1), 5);
    }
  });

  mapCanvas.addEventListener("touchend", function () {
    if (!hasMoved) {
      updateGuessPos();
    }
    isDragging = false;
  });
}

function openWindow(windowName) {
  gameOptionsWindow.style.display = "none";
  gameOverWindow.style.display = "none";
  switch (windowName) {
    case "options":
      gameOptionsWindow.style.display = "flex";
      break;
    case "gameover":
      gameOverWindow.style.display = "flex";
      break;
  }
}

function setMinimapVisible(visible) {
  if (visible) {
    mapContainer.style.display = "flex";
    showMapButton.style.display = "none";
  } else {
    mapContainer.style.display = "none";
    showMapButton.style.display = "flex";
  }
}

function timerInputDisplay(element) {
  if (element.checked) {
    timerLengthInput.disabled = false;
    timerDisplay.style.display = "block";
  } else {
    timerLengthInput.disabled = true;
    timerDisplay.style.display = "none";
  }
}

function toggleFullscreen() {
  if (mapContainer.classList.contains("fullscreen")) {
    mapContainer.classList.remove("fullscreen");
  } else {
    mapContainer.classList.add("fullscreen");
  }
}

function updateGuessPos() {
  if (gameState === GAMESTATES.guessing) {
    guessPos = {
      x: mouseXRelative,
      y: mouseYRelative,
    };

    guessButton.disabled = false;
  }
}

function guessButtonClicked() {
  if (guessPos == null && gameState === GAMESTATES.guessing) {
    roundScore = 0;
    gameState = GAMESTATES.guessed;
    guessButton.disabled = false;
    if (currentRound >= totalRounds) {
      guessButton.innerText = "End Game";
      gameState = GAMESTATES.gameOver;
    } else {
      guessButton.innerText = "Next Round";
    }
    mapCamera.targetX = -currentLocation[0];
    mapCamera.targetY = -currentLocation[1];
    mapCamera.targetZoom = 1;
  } else if (gameState === GAMESTATES.guessing) {
    gameState = GAMESTATES.guessed;
    calculateScore();
    if (currentRound >= totalRounds) {
      guessButton.innerText = "End Game";
      gameState = GAMESTATES.gameOver;
    } else {
      guessButton.innerText = "Next Round";
    }

    // Set the mapCamera's position and zoom to the middle of guessPos and the location's position
    const midX = (guessPos.x + currentLocation[0]) / 2;
    const midY = (guessPos.y + currentLocation[1]) / 2;
    mapCamera.targetX = -midX;
    mapCamera.targetY = -midY;
    const dx = Math.abs(guessPos.x - currentLocation[0]);
    const dy = Math.abs(guessPos.y - currentLocation[1]);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const padding = 30;

    // Calculate the required zoom level to fit both points
    const requiredZoomX = mapCanvas.width / (distance + padding);
    const requiredZoomY = mapCanvas.height / (distance + padding);
    mapCamera.targetZoom = Math.min(
      Math.max(requiredZoomX, 0.1),
      Math.max(requiredZoomY, 0.1),
      2,
    );
  } else if (gameState === GAMESTATES.guessed) {
    if (currentRound < totalRounds) {
      if (mapContainer.classList.contains("fullscreen")) {
        mapContainer.classList.remove("fullscreen");
      }

      nextRound();
      guessButton.disabled = true;
      guessButton.innerText = "Guess!";
    }
  } else if (gameState === GAMESTATES.gameOver) {
    guessButton.disabled = true;

    // Hide/show timer depending on timerEnabled
    if (timerEnabled) {
      timerLengthDisplay.style.display = "block";
      timerLengthDisplay.innerText = `Timer Length: ${timerLengthSeconds}s`;
    } else {
      timerLengthDisplay.style.display = "none";
    }

    openWindow("gameover");
    gameState = GAMESTATES.gameOver;

    finalScoreDisplay.innerText = `Final Score: ${totalScore}/${
      totalRounds * maxScore
    }`;
    let accuracyPercent = (
      (totalScore / (totalRounds * maxScore)) *
      100
    ).toFixed(2);
    accuracyElement.innerText = `Accuracy: ${accuracyPercent}%`;
    totalRoundsElement.innerText = `Total Rounds: ${totalRounds}`;
  }
}

function setLocation(i, gameMode) {
  imageIsLoaded = false;

  if (!gameModeData[gameMode]) {
    console.error("Game mode not found:", gameMode);
    return;
  }

  if (!gameModeData[gameMode].locations) {
    console.error("No locations found for game mode:", gameMode);
    return;
  }

  if (i < 0 || i >= gameModeData[gameMode].locations.length) {
    console.error("Invalid location index:", {
      index: i,
      max: gameModeData[gameMode].locations.length - 1,
    });
    return;
  }

  currentLocation = gameModeData[gameMode].locations[i];

  if (!currentLocation) {
    console.error("Current location is undefined.");
    return;
  }

  if (!currentLocation[3]) {
    console.error("Image path is undefined for location:", currentLocation);
    return;
  }

  const imgSrc = currentLocation[3];
  locationImgElement.src = "";
  loadingText.style.display = "flex";
  const img = new Image();
  img.onload = function () {
    imageIsLoaded = true;
    loadingText.style.display = "none";
    locationImgElement.src = imgSrc;
    if (guessPos) {
      guessButton.disabled = false;
    }
    if (timerEnabled) {
      endTime = performance.now() + timerLengthSeconds * 1000;
    }
  };
  img.onerror = function (e) {
    console.error("Failed to load image:", {
      path: imgSrc,
      error: e,
      stack: new Error().stack,
    });
    loadingText.style.display = "none";
  };
  img.src = currentLocation[3];
}

function randIRange(min, max) {
  if (min === max) {
    console.warn("randomRange has same min and max!!");
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}

// Filter locations/charms by difficulty
function filterByDifficulty(dataList, difficulty) {
  if (difficulty === "all") {
    return dataList; // Return all locations/charms
  }

  if (difficulty === "custom") {
    return dataList.filter((item) => item[2] >= minDiff && item[2] <= maxDiff);
  }

  const range = DIFFICULTRANGE[difficulty];
  return dataList.filter(
    (item) => item[2] >= range.min && item[2] <= range.max,
  );
}

function nextRound() {
  gameState = GAMESTATES.guessing;
  mapCamera.targetX = -2249;
  mapCamera.targetY = -1450;
  mapCamera.targetZoom = 0.125;
  currentRound++;
  updateRoundCounter(currentRound, totalRounds);

  const selectedGameMode = document.getElementById("gameMode").value;
  const dataList = gameModeData[selectedGameMode].locations;
  const usedList = usedLocations[selectedGameMode];

  // Filter dataList by selected difficulty
  const selectedDifficulty = difficultySelector.value;
  const filteredDataList = filterByDifficulty(dataList, selectedDifficulty);

  // Reset if all locations are used
  if (usedList.length >= filteredDataList.length) {
    alert(
      "You've played every location in this gamemode/difficulty! Please suggest more from the title screen!",
    );
    usedList.length = 0;
    gameState = GAMESTATES.gameOver;
    guessButtonClicked();
    return;
  }

  // Get available indices from the filtered list
  const availableIndices = filteredDataList
    .map((_, i) => i)
    .filter((i) => !usedList.includes(i));

  if (availableIndices.length === 0) {
    console.error("No available locations found.");
    return;
  }

  // Select a random index from the filtered list
  const newLocationIndex =
    availableIndices[randIRange(0, availableIndices.length - 1)];
  usedList.push(newLocationIndex);

  // Find the corresponding location in the original dataList
  const newLocation = filteredDataList[newLocationIndex];
  setLocation(dataList.indexOf(newLocation), selectedGameMode);

  guessButton.disabled = true;
  guessPos = null;

  // Reset and start the timer
  if (timerEnabled) {
    endTime = performance.now() + timerLengthSeconds * 1000;
  }
}

function calculateScore() {
  const dx = guessPos.x - currentLocation[0];
  const dy = guessPos.y - currentLocation[1];
  const distance = Math.sqrt(dx * dx + dy * dy);
  const leniency = 50; // Distance in which you get the max score
  const dropOffRate = 0.001; // How quickly the score drops off when guessing farther away! away!
  roundScore = maxScore * Math.exp(-dropOffRate * (distance - leniency));
  roundScore = Math.round(Math.min(roundScore, maxScore));
  totalScore += roundScore;
}
