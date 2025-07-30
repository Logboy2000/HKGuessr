///////////////////////////////////////////////
////// Geoguessr Clone for Hollow Knight //////
///////////////////////////////////////////////

//BEWARE THIS SOURCE CODE IS NOW LESS OF AN ABSOLUTE MESS THAN IT USED TO BE//


/**
 * This file manages all game logic and state in game.html
 *
 * The code has been refactored into two main modules:
 * - GameManager: Handles all game state, flow, scoring, and UI interactions.
 * - MapRenderer: Manages the canvas, map drawing, camera, and user map interactions.
 */

// --- Constants ---
const GAMESTATES = {
  guessing: 0,
  guessed: 1,
  gameOver: 2,
  optionsWindow: 3,
};

const DIFFICULTRANGE = {
  easy: { min: 1, max: 3 },
  normal: { min: 4, max: 7 },
  hard: { min: 8, max: 10 },
};

// --- DOM Elements (Grouped for better organization) ---
// Initialize DOM as an empty object first. Its properties will be assigned in dataLoaded().
const DOM = {};

// --- Utility Functions ---
/**
 * Linearly interpolates between two values.
 * @param {number} start - The starting value.
 * @param {number} end - The ending value.
 * @param {number} t - The interpolation factor (0.0 to 1.0).
 * @returns {number} The interpolated value.
 */
function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}

/**
 * Generates a random integer within a specified range (inclusive).
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random integer.
 */
function randIRange(min, max) {
  if (min === max) {
    console.warn("randIRange: min and max are the same, returning min.");
    return min;
  }
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// --- MapRenderer Object ---
// Manages all canvas drawing, camera, and map interactions.
const MapRenderer = {
  canvas: null,
  ctx: null,
  mapImg: new Image(),
  knightPinImg: new Image(),
  shadePinImg: new Image(),
  camera: {
    x: -2249, // Initial map offset
    y: -1450, // Initial map offset
    targetX: -2249,
    targetY: -1450,
    zoom: 0.125, // Initial zoom level
    targetZoom: 0.125,
  },
  mousePos: { x: 0, y: 0 }, // Mouse position relative to canvas
  mouseXRelative: 0, // Mouse X position relative to camera and zoom
  mouseYRelative: 0, // Mouse Y position relative to camera and zoom
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  hasMoved: false,
  initialZoom: 0,
  pinchStartDistance: 0,
  guessPosition: null, // The user's guessed position on the map

  /**
   * Initializes the MapRenderer, setting up canvas and loading images.
   * @param {HTMLCanvasElement} canvasElement - The canvas DOM element.
   */
  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext("2d");

    this.mapImg.src = "images/map.png";
    this.knightPinImg.src = "images/knightPin.png";
    this.shadePinImg.src = "images/shadePin.png";

    // Ensure images are loaded before attempting to draw them
    Promise.all([
      this.loadImage(this.mapImg),
      this.loadImage(this.knightPinImg),
      this.loadImage(this.shadePinImg),
    ]).then(() => {
      console.log("All map images loaded.");
      // Initial draw call after images are loaded
      this.draw();
    }).catch(error => {
      console.error("Failed to load one or more map images:", error);
      // Fallback or error handling for image loading
    });


    this.addEventListeners();
  },

  /**
   * Helper to load an image and return a Promise.
   * @param {Image} img - The image object to load.
   * @returns {Promise<Image>} A promise that resolves when the image is loaded.
   */
  loadImage(img) {
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load image: ${img.src}, ${e}`));
    });
  },

  /**
   * Adds all necessary event listeners for map interaction.
   */
  addEventListeners() {
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener("mouseleave", this.handleMouseLeave.bind(this));
    this.canvas.addEventListener("wheel", this.handleWheel.bind(this));

    // Touch events for mobile support
    this.canvas.addEventListener("touchstart", this.handleTouchStart.bind(this));
    this.canvas.addEventListener("touchmove", this.handleTouchMove.bind(this));
    this.canvas.addEventListener("touchend", this.handleTouchEnd.bind(this));
  },

  /**
   * Handles mouse down events on the canvas.
   * @param {MouseEvent} event
   */
  handleMouseDown(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePos.x = event.clientX - rect.left;
    this.mousePos.y = event.clientY - rect.top;
    this.updateRelativeMousePos();

    this.isDragging = true;
    this.hasMoved = false;
    this.dragStart.x = event.clientX;
    this.dragStart.y = event.clientY;
  },

  /**
   * Handles mouse move events on the canvas.
   * @param {MouseEvent} event
   */
  handleMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mousePos.x = event.clientX - rect.left;
    this.mousePos.y = event.clientY - rect.top;
    this.updateRelativeMousePos();

    if (this.isDragging) {
      let dx = event.clientX - this.dragStart.x;
      let dy = event.clientY - this.dragStart.y;

      if (dx !== 0 || dy !== 0) {
        this.hasMoved = true;
      }

      this.camera.targetX += dx / this.camera.zoom;
      this.camera.targetY += dy / this.camera.zoom;

      this.dragStart.x = event.clientX;
      this.dragStart.y = event.clientY;
    }
  },

  /**
   * Handles mouse up events on the canvas.
   */
  handleMouseUp() {
    if (!this.hasMoved && GameManager.gameState === GAMESTATES.guessing) {
      this.updateGuessPos();
    }
    this.isDragging = false;
  },

  /**
   * Handles mouse leave events from the canvas.
   */
  handleMouseLeave() {
    this.isDragging = false;
  },

  /**
   * Handles mouse wheel (zoom) events on the canvas.
   * @param {WheelEvent} event
   */
  handleWheel(event) {
    event.preventDefault();
    let zoomFactor = Math.exp(-event.deltaY * 0.001);
    this.camera.targetZoom *= zoomFactor;
    this.camera.targetZoom = Math.min(Math.max(this.camera.targetZoom, 0.1), 5);
  },

  /**
   * Handles touch start events for mobile.
   * @param {TouchEvent} event
   */
  handleTouchStart(event) {
    if (event.touches.length === 1) {
      this.isDragging = true;
      this.hasMoved = false;
      this.dragStart.x = event.touches[0].clientX;
      this.dragStart.y = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      this.isDragging = false;
      this.pinchStartDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      this.initialZoom = this.camera.targetZoom;
    }
  },

  /**
   * Handles touch move events for mobile.
   * @param {TouchEvent} event
   */
  handleTouchMove(event) {
    if (event.touches.length === 1 && this.isDragging) {
      const rect = this.canvas.getBoundingClientRect();
      this.mousePos.x = event.touches[0].clientX - rect.left;
      this.mousePos.y = event.touches[0].clientY - rect.top;
      this.updateRelativeMousePos();

      let dx = event.touches[0].clientX - this.dragStart.x;
      let dy = event.touches[0].clientY - this.dragStart.y;

      if (dx !== 0 || dy !== 0) {
        this.hasMoved = true;
      }

      this.camera.targetX += dx / this.camera.zoom;
      this.camera.targetY += dy / this.camera.zoom;

      this.dragStart.x = event.touches[0].clientX;
      this.dragStart.y = event.touches[0].clientY;
    } else if (event.touches.length === 2) {
      const currentDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      const zoomFactor = currentDistance / this.pinchStartDistance;
      this.camera.targetZoom = this.initialZoom * zoomFactor;
      this.camera.targetZoom = Math.min(Math.max(this.camera.targetZoom, 0.1), 5);
    }
  },

  /**
   * Handles touch end events for mobile.
   */
  handleTouchEnd() {
    if (!this.hasMoved && GameManager.gameState === GAMESTATES.guessing) {
      this.updateGuessPos();
    }
    this.isDragging = false;
  },

  /**
   * Updates the mouse position relative to the camera and zoom.
   */
  updateRelativeMousePos() {
    this.mouseXRelative =
      (this.mousePos.x - this.canvas.width / 2) / this.camera.zoom - this.camera.x;
    this.mouseYRelative =
      (this.mousePos.y - this.canvas.height / 2) / this.camera.zoom - this.camera.y;
  },

  /**
   * Sets the user's guess position on the map.
   */
  updateGuessPos() {
    this.guessPosition = {
      x: this.mouseXRelative,
      y: this.mouseYRelative,
    };
    DOM.guessButton.disabled = false;
  },

  /**
   * Draws all elements on the map canvas.
   */
  draw() {
    this.canvas.width = this.canvas.clientWidth;
    this.canvas.height = this.canvas.clientHeight;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save(); // Save initial state (untransformed)

    // Smoothly interpolate camera position and zoom
    this.camera.x = lerp(this.camera.x, this.camera.targetX, 0.5);
    this.camera.y = lerp(this.camera.y, this.camera.targetY, 0.5);
    this.camera.zoom = lerp(this.camera.zoom, this.camera.targetZoom, 0.25);

    // Apply global camera transformations
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2); // Center of canvas
    this.ctx.scale(this.camera.zoom, this.camera.zoom); // Apply zoom
    this.ctx.translate(this.camera.x, this.camera.y); // Apply camera pan

    // Draw the main map image
    this.ctx.drawImage(this.mapImg, 0, 0, this.mapImg.width, this.mapImg.height);

    // Draw pins and line if a guess has been made
    if (this.guessPosition) {
      // Draw the guess pin (knightPinImg)
      this.ctx.save(); // Save context before drawing guess pin
      this.ctx.translate(this.guessPosition.x, this.guessPosition.y);
      // Apply inverse scale to keep pin size constant regardless of map zoom
      this.ctx.scale(0.5 / this.camera.zoom, 0.5 / this.camera.zoom);
      this.ctx.drawImage(
        this.knightPinImg,
        -this.knightPinImg.width / 2,
        -this.knightPinImg.height / 2
      );
      this.ctx.restore(); // Restore context after drawing guess pin

      if (GameManager.gameState === GAMESTATES.guessed || GameManager.gameState === GAMESTATES.gameOver) {
        // Draw the line between guess and correct location
        this.ctx.beginPath();
        this.ctx.moveTo(this.guessPosition.x, this.guessPosition.y);
        this.ctx.lineTo(GameManager.currentLocation[0], GameManager.currentLocation[1]);
        this.ctx.strokeStyle = "red";
        // Scale line width by inverse zoom to keep it constant on screen
        this.ctx.lineWidth = 10 / this.camera.zoom;
        this.ctx.stroke();

        // Draw the correct location pin (shadePinImg)
        this.ctx.save(); // Save context before drawing shade pin
        this.ctx.translate(GameManager.currentLocation[0], GameManager.currentLocation[1]);
        // Apply inverse scale to keep pin size constant regardless of map zoom
        this.ctx.scale(0.5 / this.camera.zoom, 0.5 / this.camera.zoom);
        this.ctx.drawImage(
          this.shadePinImg,
          -this.shadePinImg.width / 2,
          -this.shadePinImg.height / 2
        );
        this.ctx.restore(); // Restore context after drawing shade pin
      }
    }

    this.ctx.restore(); // Restore to initial state (before global transformations)

    // --- Draw UI elements that are NOT affected by camera zoom ---
    // These elements are drawn after restoring the context, so they are relative to the canvas itself.

    // Display guess coordinates
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    this.ctx.fillRect(0, 0, 250, 25);
    this.ctx.fillStyle = "white";
    this.ctx.textAlign = "left";
    this.ctx.font = "20px Trajan Pro Bold"; // Font for UI elements
    if (this.guessPosition) {
      this.ctx.fillText(
        `Guess: ${Math.round(this.guessPosition.x)}, ${Math.round(this.guessPosition.y)}`,
        10,
        20
      );
    }

    // Display round score box
    if (
      GameManager.gameState !== GAMESTATES.guessing &&
      GameManager.gameState !== GAMESTATES.optionsWindow
    ) {
      const boxWidth = 300;
      const boxHeight = 25;
      const boxX = (this.canvas.width - boxWidth) / 2;
      const boxY = this.canvas.height - boxHeight - 20;
      const cornerRadius = 10;

      this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      this.ctx.beginPath();
      this.ctx.moveTo(boxX + cornerRadius, boxY);
      this.ctx.lineTo(boxX + boxWidth - cornerRadius, boxY);
      this.ctx.quadraticCurveTo(
        boxX + boxWidth,
        boxY,
        boxX + boxWidth,
        boxY + cornerRadius
      );
      this.ctx.lineTo(boxX + boxWidth, boxY + boxHeight - cornerRadius);
      this.ctx.quadraticCurveTo(
        boxX + boxWidth,
        boxY + boxHeight,
        boxX + boxWidth - cornerRadius,
        boxY + boxHeight
      );
      this.ctx.lineTo(boxX + cornerRadius, boxY + boxHeight);
      this.ctx.quadraticCurveTo(
        boxX,
        boxY + boxHeight,
        boxX,
        boxY + boxHeight - cornerRadius
      );
      this.ctx.lineTo(boxX, boxY + cornerRadius);
      this.ctx.quadraticCurveTo(boxX, boxY, boxX + cornerRadius, boxY);
      this.ctx.closePath();
      this.ctx.fill();

      // Add white border
      this.ctx.strokeStyle = "white";
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.fillStyle = "#FFF";
      this.ctx.textAlign = "center";
      this.ctx.fillText(
        `You earned ${GameManager.roundScore} points`,
        this.canvas.width / 2,
        this.canvas.height - 25
      );
    }
  },

  /**
   * Resets the map camera to its default position and zoom.
   */
  resetCamera() {
    this.camera.targetX = -2249;
    this.camera.targetY = -1450;
    this.camera.targetZoom = 0.125;
  },

  /**
   * Adjusts the camera to center and zoom on a specific location.
   * @param {number} x - The X coordinate to center on.
   * @param {number} y - The Y coordinate to center on.
   * @param {number} zoom - The target zoom level.
   */
  setCameraTarget(x, y, zoom) {
    this.camera.targetX = -x;
    this.camera.targetY = -y;
    this.camera.targetZoom = zoom;
  },

  /**
   * Adjusts the camera to fit two points on the screen.
   * @param {object} point1 - {x, y} of the first point.
   * @param {object} point2 - {x, y} of the second point.
   */
  fitPointsInView(point1, point2) {
    const midX = (point1.x + point2.x) / 2;
    const midY = (point1.y + point2.y) / 2;
    this.camera.targetX = -midX;
    this.camera.targetY = -midY;

    const dx = Math.abs(point1.x - point2.x);
    const dy = Math.abs(point1.y - point2.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const padding = 30; // Extra padding around the points

    // Calculate the required zoom level to fit both points
    // Ensure we don't divide by zero if distance is 0
    const requiredZoomX = distance > 0 ? this.canvas.width / (distance + padding) : this.camera.targetZoom;
    const requiredZoomY = distance > 0 ? this.canvas.height / (distance + padding) : this.camera.targetZoom;

    // Take the minimum of the two required zooms to ensure both dimensions fit
    // Clamp the zoom to reasonable values
    this.camera.targetZoom = Math.min(
      Math.max(requiredZoomX, 0.1),
      Math.max(requiredZoomY, 0.1),
      2 // Max zoom to prevent over-zooming on close points
    );
  },
};

// --- GameManager Object ---
// Manages all game state, flow, scoring, and UI updates.
const GameManager = {
  gameState: GAMESTATES.optionsWindow,
  usedLocations: {}, // Stores indices of used locations per game mode
  currentLocation: null, // [x, y, difficulty, imageUrl]
  currentRound: 0,
  totalRounds: 5,
  totalScore: 0,
  roundScore: 0,
  maxScore: 5000,
  timerLengthSeconds: 60,
  timerEnabled: false,
  endTime: 0,
  imageIsLoaded: false, // Tracks if the current location image is loaded
  minDifficulty: 1,
  maxDifficulty: 10,
  gameModeData: {}, // Moved here to be managed by GameManager

  /**
   * Initializes the game manager.
   */
  init() {
    // IMPORTANT: Copy the global gameModeData into GameManager's internal state
    // This ensures GameManager has access to all loaded data and can initialize its usedLocations.
    // This line must execute AFTER loadLocationData has populated the global `gameModeData`.
    this.gameModeData = window.gameModeData; // Use window.gameModeData for clarity

    // Initialize usedLocations for all game modes that have been loaded
    Object.keys(this.gameModeData).forEach(modeId => {
      if (!this.usedLocations[modeId]) { // Only initialize if not already present (e.g., from a custom pack)
        this.usedLocations[modeId] = [];
      }
    });

    this.addEventListeners();
    this.openWindow("options");
    DOM.loadingText.style.display = "none";

    // Set initial location for display in options window
    // Use the currently selected game mode from the DOM, or fallback to the first loaded one.
    const firstGameModeId = "normal";
    if (firstGameModeId && this.gameModeData[firstGameModeId]?.locations?.length > 0) {
        this.setLocation(randIRange(0, this.gameModeData[firstGameModeId].locations.length - 1), firstGameModeId);
    } else {
        console.warn("No initial game mode data found. Ensure default packs are loaded.");
        // Potentially disable game start or show an error message to the user
    }

    this.gameLoop(); // Start the main game loop
  },

  /**
   * Adds new game mode data to the GameManager and initializes its usedLocations.
   * This method should be called by the data loading mechanism (e.g., loadLocationData, loadCustomImagePack).
   * @param {string} gameModeId - The ID of the game mode.
   * @param {object} data - The game mode data containing 'name' and 'locations'.
   */
  addGameModeData(gameModeId, data) {
    this.gameModeData[gameModeId] = data; // Changed to use this.gameModeData
    this.usedLocations[gameModeId] = []; // Initialize used locations for this new game mode
  },

  /**
   * The main game loop, called continuously using requestAnimationFrame.
   */
  gameLoop() {
    // Timer update
    if (GameManager.timerEnabled && GameManager.gameState === GAMESTATES.guessing && GameManager.imageIsLoaded) {
      const currentTime = performance.now();
      const remainingTime = GameManager.endTime - currentTime;

      if (remainingTime <= 0) {
        DOM.timerDisplay.innerText = "0.00";
        GameManager.guessButtonClicked();
      } else {
        DOM.timerDisplay.innerText = (remainingTime / 1000).toFixed(2);
      }
    }

    // Draw map and UI
    MapRenderer.draw();

    // Update UI elements that depend on game state
    DOM.newGameButton.disabled = (GameManager.gameState === GAMESTATES.optionsWindow);

    requestAnimationFrame(GameManager.gameLoop);
  },

  /**
   * Adds all necessary event listeners for game controls.
   */
  addEventListeners() {
    // Ensure DOM elements are available before adding listeners
    if (!DOM.difficultySelector) {
        console.error("DOM elements not initialized. Call initializeDOMElements() first.");
        return;
    }

    DOM.difficultySelector.addEventListener("change", this.toggleCustomDifficultyDisplay.bind(this));
    DOM.roundCountInput.addEventListener("input", this.updateRoundCounter.bind(this));
    DOM.timerLengthInput.addEventListener("input", () => this.checkNumberIntegrity(DOM.timerLengthInput, true, true));
    DOM.customDifficultyDiv.querySelector("#minDifficulty").addEventListener("input", () => this.checkNumberIntegrity(DOM.customDifficultyDiv.querySelector("#minDifficulty"), true, true));
    DOM.customDifficultyDiv.querySelector("#maxDifficulty").addEventListener("input", () => this.checkNumberIntegrity(DOM.customDifficultyDiv.querySelector("#maxDifficulty"), true, true));

    DOM.guessButton.addEventListener("click", this.guessButtonClicked.bind(this));
    DOM.showMapButton.addEventListener("click", () => this.setMinimapVisible(true));
    DOM.minimiseButton.addEventListener("click", () => this.setMinimapVisible(false));
    DOM.timerLengthInput.addEventListener("input", () => this.checkNumberIntegrity(DOM.timerLengthInput, true, true));
    document.getElementById("timerEnabled").addEventListener("change", (event) => this.timerInputDisplay(event.target));
    document.getElementById("playAgainButton").addEventListener("click", this.restartGame.bind(this));
    document.getElementById("startButton").addEventListener("click", this.restartGame.bind(this));
    document.getElementById("newGameButton").addEventListener("click", () => this.openWindow("options"));
    document.getElementById("optionsButton").addEventListener("click", () => this.openWindow("options"));

    
    document.getElementById("fullscreenButton").addEventListener("click", () => this.toggleFullscreen());


    document.addEventListener("keypress", this.handleKeyPress.bind(this));
  },

  /**
   * Handles global key press events.
   * @param {KeyboardEvent} event
   */
  handleKeyPress(event) {
    if (event.code === "Space") {
      this.guessButtonClicked();
    }
    if (event.key === "f" || event.key === "Escape") {
      this.toggleFullscreen();
    }
  },

  /**
   * Starts or restarts the game.
   */
  restartGame() {
    // Validate round count
    if (!this.checkNumberIntegrity(DOM.roundCountInput, true, false) || Number(DOM.roundCountInput.value) <= 0) {
      console.error("Please use a valid number for round count (greater than 0).");
      // Consider adding a simple UI message instead of just console.error
      return;
    }
    this.totalRounds = Number(DOM.roundCountInput.value);

    // Validate difficulty range
    this.minDifficulty = Number(DOM.customDifficultyDiv.querySelector("#minDifficulty").value);
    this.maxDifficulty = Number(DOM.customDifficultyDiv.querySelector("#maxDifficulty").value);
    if (this.minDifficulty > this.maxDifficulty) {
      console.error("Minimum difficulty cannot be greater than maximum difficulty.");
      // Consider adding a simple UI message instead of just console.error
      return;
    }

    this.timerEnabled = document.getElementById("timerEnabled").checked;
    if (this.timerEnabled) {
      if (!this.checkNumberIntegrity(DOM.timerLengthInput, true, false) || Number(DOM.timerLengthInput.value) <= 0) {
        console.error("Please use a valid number for timer length (greater than 0).");
        return;
      }
      this.timerLengthSeconds = Number(DOM.timerLengthInput.value);
    }

    this.gameState = GAMESTATES.guessing;
    this.totalScore = 0;
    this.currentRound = 0;

    this.openWindow(null); // Close all windows
    DOM.guessButton.disabled = true;
    DOM.guessButton.innerText = "Guess!";

    this.nextRound();
  },

  /**
   * Updates the round counter display.
   */
  updateRoundCounter() {
    // Ensure roundCountInput is valid first
    if (this.checkNumberIntegrity(DOM.roundCountInput, true, true)) {
      this.totalRounds = Number(DOM.roundCountInput.value);
    }
    DOM.roundElement.textContent = `${this.currentRound}/${this.totalRounds}`;
  },

  /**
   * Checks the integrity of a number input field.
   * @param {HTMLInputElement} element - The input element.
   * @param {boolean} integer - True if the value should be an integer.
   * @param {boolean} updateIfInvalid - True to revert to default value if invalid.
   * @returns {boolean} True if the value is valid, false otherwise.
   */
  checkNumberIntegrity(element, integer = true, updateIfInvalid = true) {
    let maxValue = Number(element.getAttribute("max")) || Infinity;
    let minValue = Number(element.getAttribute("min")) || 1;

    if (!isNaN(element.value) && element.value !== "" && Number(element.value) >= minValue) {
      if (Number(element.value) > maxValue) element.value = maxValue;
      if (integer) element.value = parseInt(element.value);
      return true;
    }

    if (updateIfInvalid) {
      element.value = Number(element.getAttribute("value"));
    }

    if (integer) element.value = parseInt(element.value);
    return false;
  },

  /**
   * Toggles the visibility of the custom difficulty selection div.
   */
  toggleCustomDifficultyDisplay() {
    if (DOM.difficultySelector.value === "custom") {
      DOM.customDifficultyDiv.style.display = "flex";
    } else {
      DOM.customDifficultyDiv.style.display = "none";
    }
  },

  /**
   * Opens or closes game-related windows.
   * @param {string|null} windowName - The name of the window to open ('options', 'gameover') or null to close all.
   */
  openWindow(windowName) {
    DOM.gameOptionsWindow.style.display = "none";
    DOM.gameOverWindow.style.display = "none";
    switch (windowName) {
      case "options":
        DOM.gameOptionsWindow.style.display = "flex";
        this.gameState = GAMESTATES.optionsWindow;
        break;
      case "gameover":
        DOM.gameOverWindow.style.display = "flex";
        this.gameState = GAMESTATES.gameOver; // Ensure state is set for game over window
        break;
    }
  },

  /**
   * Sets the visibility of the minimap container.
   * @param {boolean} visible - True to show, false to hide.
   */
  setMinimapVisible(visible) {
    if (visible) {
      DOM.mapContainer.style.display = "flex";
      DOM.showMapButton.style.display = "none";
    } else {
      DOM.mapContainer.style.display = "none";
      DOM.showMapButton.style.display = "flex";
    }
  },

  /**
   * Toggles the disabled state of the timer length input based on timer enabled checkbox.
   * @param {HTMLInputElement} element - The timer enabled checkbox.
   */
  timerInputDisplay(element) {
    if (element.checked) {
      DOM.timerLengthInput.disabled = false;
      DOM.timerDisplay.style.display = "block";
    } else {
      DOM.timerLengthInput.disabled = true;
      DOM.timerDisplay.style.display = "none";
    }
  },

  /**
   * Toggles fullscreen mode for the map container.
   */
  toggleFullscreen() {
    DOM.mapContainer.classList.toggle("fullscreen");
  },

  /**
   * Handles the guess button click logic based on current game state.
   */
  guessButtonClicked() {
    if (this.gameState === GAMESTATES.guessing) {
      // If no guess was made but timer ran out, set score to 0
      if (!MapRenderer.guessPosition) {
        this.roundScore = 0;
      } else {
        this.calculateScore();
      }

      this.gameState = GAMESTATES.guessed;
      DOM.guessButton.disabled = false;

      // Adjust camera to show both guess and correct location
      if (MapRenderer.guessPosition && this.currentLocation) {
        MapRenderer.fitPointsInView(MapRenderer.guessPosition, { x: this.currentLocation[0], y: this.currentLocation[1] });
      } else if (this.currentLocation) { // If no guess, just zoom to correct location
        MapRenderer.setCameraTarget(this.currentLocation[0], this.currentLocation[1], 1);
      }

      if (this.currentRound >= this.totalRounds) {
        DOM.guessButton.innerText = "End Game";
        this.gameState = GAMESTATES.gameOver;
      } else {
        DOM.guessButton.innerText = "Next Round";
      }

    } else if (this.gameState === GAMESTATES.guessed) {
      if (this.currentRound < this.totalRounds) {
        if (DOM.mapContainer.classList.contains("fullscreen")) {
          DOM.mapContainer.classList.remove("fullscreen");
        }
        this.nextRound();
        DOM.guessButton.disabled = true;
        DOM.guessButton.innerText = "Guess!";
      }
    } else if (this.gameState === GAMESTATES.gameOver) {
      DOM.guessButton.disabled = true;

      if (this.timerEnabled) {
        DOM.timerLengthDisplay.style.display = "block";
        DOM.timerLengthDisplay.innerText = `Timer Length: ${this.timerLengthSeconds}s`;
      } else {
        DOM.timerLengthDisplay.style.display = "none";
      }

      this.openWindow("gameover");
      DOM.finalScoreDisplay.innerText = `Final Score: ${this.totalScore}/${this.totalRounds * this.maxScore}`;
      let accuracyPercent = ((this.totalScore / (this.totalRounds * this.maxScore)) * 100).toFixed(2);
      DOM.accuracyElement.innerText = `Accuracy: ${accuracyPercent}%`;
      DOM.totalRoundsElement.innerText = `Total Rounds: ${this.totalRounds}`;
    }
  },

  /**
   * Sets the current game location.
   * @param {number} i - The index of the location in the dataList.
   * @param {string} gameMode - The current game mode.
   */
  setLocation(i, gameMode) {
    this.imageIsLoaded = false;
    MapRenderer.guessPosition = null; // Clear previous guess

    const modeData = this.gameModeData[gameMode]; // Use this.gameModeData
    if (!modeData || !modeData.locations || i < 0 || i >= modeData.locations.length) {
      console.error("Invalid game mode or location index:", { index: i, gameMode, modeData });
      return;
    }

    this.currentLocation = modeData.locations[i];
    if (!this.currentLocation || !this.currentLocation[3]) {
      console.error("Invalid current location or image path:", this.currentLocation);
      return;
    }

    const imgSrc = this.currentLocation[3];
    DOM.locationImgElement.src = ""; // Clear previous image
    DOM.loadingText.style.display = "flex";

    const img = new Image();
    img.onload = () => {
      this.imageIsLoaded = true;
      DOM.loadingText.style.display = "none";
      DOM.locationImgElement.src = imgSrc;
      if (MapRenderer.guessPosition) { // Only enable guess button if a guess was made
        DOM.guessButton.disabled = false;
      }
      if (this.timerEnabled) {
        this.endTime = performance.now() + this.timerLengthSeconds * 1000;
      }
    };
    img.onerror = (e) => {
      console.error("Failed to load location image:", { path: imgSrc, error: e });
      DOM.loadingText.style.display = "none";
    };
    img.src = imgSrc;
  },

  /**
   * Filters a list of locations/charms by difficulty.
   * @param {Array<Array>} dataList - The list of locations or charms.
   * @param {string} difficulty - The selected difficulty ('easy', 'normal', 'hard', 'custom', 'all').
   * @returns {Array<Array>} The filtered list.
   */
  filterByDifficulty(dataList, difficulty) {
    if (difficulty === "all") {
      return dataList;
    }

    if (difficulty === "custom") {
      return dataList.filter((item) => item[2] >= this.minDifficulty && item[2] <= this.maxDifficulty);
    }

    const range = DIFFICULTRANGE[difficulty];
    if (range) {
      return dataList.filter((item) => item[2] >= range.min && item[2] <= range.max);
    }
    console.warn("Unknown difficulty selected:", difficulty);
    return dataList; // Fallback
  },

  /**
   * Advances the game to the next round.
   */
  nextRound() {
    this.gameState = GAMESTATES.guessing;
    MapRenderer.resetCamera(); // Reset map camera for new round
    this.currentRound++;
    this.updateRoundCounter();

    const selectedGameMode = DOM.gameMode.value; // Assuming DOM.gameMode exists
    const dataList = this.gameModeData[selectedGameMode]?.locations; // Use this.gameModeData
    if (!dataList) {
      console.error("No locations found for selected game mode:", selectedGameMode);
      this.gameState = GAMESTATES.gameOver; // End game if no data
      this.guessButtonClicked();
      return;
    }

    const usedList = this.usedLocations[selectedGameMode];
    // Defensive check: Ensure usedList is initialized for this game mode
    if (!usedList) {
        console.error(`usedLocations for game mode '${selectedGameMode}' is not initialized. Ending game.`);
        this.gameState = GAMESTATES.gameOver;
        this.guessButtonClicked();
        return;
    }
    console.log(usedList)

    const selectedDifficulty = DOM.difficultySelector.value;
    const filteredDataList = this.filterByDifficulty(dataList, selectedDifficulty);

    if (filteredDataList.length === 0) {
      console.error("No locations available for the selected difficulty and game mode.");
      this.gameState = GAMESTATES.gameOver;
      this.guessButtonClicked();
      return;
    }

    // Reset used locations if all filtered locations have been used
    if (usedList.length >= filteredDataList.length) {
      usedList.length = 0;
      console.log("All filtered locations used, resetting used list for this game mode.");
    }

    // Get available indices from the filtered list (indices relative to filteredDataList)
    const availableIndices = filteredDataList
      .map((_, i) => i)
      .filter((i) => !usedList.includes(i));

    if (availableIndices.length === 0) {
      console.error("No new available locations found after filtering and checking used list.");
      this.gameState = GAMESTATES.gameOver;
      this.guessButtonClicked();
      return;
    }

    // Select a random index from the available filtered indices
    const newLocationFilteredIndex = availableIndices[randIRange(0, availableIndices.length - 1)];
    usedList.push(newLocationFilteredIndex); // Mark this index (relative to filtered list) as used

    // Get the actual location object from the filtered list
    const newLocation = filteredDataList[newLocationFilteredIndex];

    // Find its index in the ORIGINAL dataList to pass to setLocation
    const originalIndex = dataList.indexOf(newLocation);
    if (originalIndex === -1) {
        console.error("Could not find new location in original dataList. This should not happen.");
        this.gameState = GAMESTATES.gameOver;
        this.guessButtonClicked();
        return;
    }

    this.setLocation(originalIndex, selectedGameMode);

    DOM.guessButton.disabled = true;
    MapRenderer.guessPosition = null; // Clear guess for new round

    // Reset and start the timer
    if (this.timerEnabled) {
      this.endTime = performance.now() + this.timerLengthSeconds * 1000;
    }
  },

  /**
   * Calculates the round score based on guess distance.
   */
  calculateScore() {
    if (!MapRenderer.guessPosition || !this.currentLocation) {
      this.roundScore = 0;
      return;
    }
    const dx = MapRenderer.guessPosition.x - this.currentLocation[0];
    const dy = MapRenderer.guessPosition.y - this.currentLocation[1];
    const distance = Math.sqrt(dx * dx + dy * dy);
    const leniency = 50; // Distance in which you get the max score
    const dropOffRate = 0.001; // How quickly the score drops off when guessing farther aue aue! (away)
    this.roundScore = this.maxScore * Math.exp(-dropOffRate * (distance - leniency));
    this.roundScore = Math.round(Math.min(this.roundScore, this.maxScore));
    this.totalScore += this.roundScore;
  },
};

// Global `gameModeData` variable for `loadLocationData.js` to populate
// This is now an empty object that `loadLocationData.js` will populate
// by calling `GameManager.addGameModeData`.


// --- Initialization ---
// This function assumes 'gameModeData' is loaded globally before this script runs.
// It is now responsible for calling GameManager.addGameModeData
function dataLoaded() {
  // Initialize DOM elements here, after the HTML is parsed
  DOM.customDifficultyDiv = document.getElementById("customDifficultyDiv");
  DOM.difficultySelector = document.getElementById("difficultySelector");
  DOM.roundCountInput = document.getElementById("roundCount");
  DOM.timerLengthInput = document.getElementById("timerLength");

  DOM.accuracyElement = document.getElementById("accuracy");
  DOM.finalScoreDisplay = document.getElementById("finalScore");
  DOM.gameOverWindow = document.getElementById("gameOverWindow");
  DOM.gameOptionsWindow = document.getElementById("gameOptionsWindow");
  DOM.loadingText = document.getElementById("loadingText");
  DOM.roundElement = document.getElementById("round");
  DOM.timerDisplay = document.getElementById("timerDisplay");
  DOM.totalRoundsElement = document.getElementById("totalRounds");
  DOM.timerLengthDisplay = document.getElementById("timerLengthDisplay");
  DOM.newGameButton = document.getElementById("newGameButton");

  DOM.guessButton = document.getElementById("guessButton");
  DOM.locationImgElement = document.getElementById("locationImg");
  DOM.mapCanvas = document.getElementById("mapCanvas");
  DOM.mapContainer = document.getElementById("mapContainer");
  DOM.showMapButton = document.getElementById("showMapButton");
  DOM.minimiseButton = document.getElementById("minimiseButton");
  DOM.gameMode = document.getElementById("gameMode"); // Added this missing element reference

  MapRenderer.init(DOM.mapCanvas);
  GameManager.init();
}
