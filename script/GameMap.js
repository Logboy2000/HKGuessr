import { lerp } from "./Utils.js";
import { GameManager, GAMESTATES, DOM, DEFAULT_MAP_URL} from "./game.js"

// --- Constants for the default map ---
const DEFAULT_MAP_WIDTH = 4498;
const DEFAULT_MAP_HEIGHT = 2901;

// --- MapRenderer Object ---
// Manages all canvas drawing, camera, and map interactions.
export const GameMap = {

  canvas: null,
  ctx: null,

  mapWidth: DEFAULT_MAP_WIDTH,
  mapHeight: DEFAULT_MAP_HEIGHT,


  mapImg: new Image(),
  knightPinImg: new Image(),
  shadePinImg: new Image(),

  camera: {
    x: 0, // Initial map offset
    y: 0, // Initial map offset
    targetX: 0,
    targetY: 0,
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

  get mapCenter() {
    return { x: this.mapWidth / 2, y: this.mapHeight / 2 };
  },
  /**
   * Initializes the MapRenderer, setting up canvas and loading images.
   * @param {HTMLCanvasElement} canvasElement - The canvas DOM element.
   */
  init(canvasElement) {

    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext("2d");

    // Load static pin images
    this.knightPinImg.src = "images/knightPin.png";
    this.shadePinImg.src = "images/shadePin.png";

    // Set and load the initial map image
    this.changeMapImage(DEFAULT_MAP_URL);

    // Ensure pin images are loaded before attempting to draw them
    Promise.all([
      this.loadImage(this.knightPinImg),
      this.loadImage(this.shadePinImg),
    ])
      .then(() => {
        console.log("All pin images loaded.");
      })
      .catch((error) => {
        console.error("Failed to load one or more pin images:", error);
        // Fallback or error handling for image loading
      });

    this.addEventListeners();
    this.resetCamera();
  },

  /**
   * Changes the map image, loads it, and resets the camera to the center.
   * @param {string} imageUrl - The URL of the new map image.
   */
  async changeMapImage(imageUrl) {
    try {
      this.mapImg.src = imageUrl;
      await this.loadImage(this.mapImg);

      // Update map dimensions and center based on the new image
      this.mapWidth = this.mapImg.width;
      this.mapHeight = this.mapImg.height;

      console.log(
        `Image loaded: ${imageUrl} (${this.mapWidth}x${this.mapHeight})`
      );

      // Reset camera to center on the new map
      this.resetCamera();

      // Initial draw call after the new map is loaded
      this.draw();
    } catch (error) {
      console.error("Failed to load map image:", error);
      // Fallback or error handling for image loading
    }
  },

  /**
   * Helper to load an image and return a Promise.
   * @param {Image} img - The image object to load.
   * @returns {Promise<Image>} A promise that resolves when the image is loaded.
   */
  loadImage(img) {
    return new Promise((resolve, reject) => {
      // If image is already loaded and has dimensions, resolve immediately
      if (img.complete && img.naturalWidth !== 0) {
        resolve(img);
        return;
      }
      img.onload = () => resolve(img);
      img.onerror = (e) =>
        reject(new Error(`Failed to load image: ${img.src}, ${e}`));
    });
  },

  /**
   * Adds all necessary event listeners for map interaction.
   */
  addEventListeners() {
    this.canvas.addEventListener("mousedown", this.handleMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.handleMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.handleMouseUp.bind(this));
    this.canvas.addEventListener(
      "mouseleave",
      this.handleMouseLeave.bind(this)
    );
    this.canvas.addEventListener("wheel", this.handleWheel.bind(this));

    // Touch events for mobile support
    this.canvas.addEventListener(
      "touchstart",
      this.handleTouchStart.bind(this)
    );
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
      this.updateGuessPos(this.mouseXRelative, this.mouseYRelative);
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
      this.camera.targetZoom = Math.min(
        Math.max(this.camera.targetZoom, 0.1),
        5
      );
    }
  },

  /**
   * Handles touch end events for mobile.
   */
  handleTouchEnd() {
    if (!this.hasMoved && GameManager.gameState === GAMESTATES.guessing) {
      this.updateGuessPos(this.mouseXRelative, this.mouseYRelative);
    }
    this.isDragging = false;
  },

  /**
   * Updates the mouse position relative to the camera and zoom.
   */
  updateRelativeMousePos() {
    this.mouseXRelative =
      (this.mousePos.x - this.canvas.width / 2) / this.camera.zoom -
      this.camera.x;
    this.mouseYRelative =
      (this.mousePos.y - this.canvas.height / 2) / this.camera.zoom -
      this.camera.y;
  },

  /**
   * Sets the user's guess position on the map.
   */
  updateGuessPos(x, y) {
    this.guessPosition = {
      x: x,
      y: y,
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
    this.ctx.drawImage(
      this.mapImg,
      0,
      0,
      this.mapWidth,
      this.mapHeight
    );

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

      if (
        GameManager.gameState === GAMESTATES.guessed ||
        GameManager.gameState === GAMESTATES.gameOver
      ) {
        // Draw the line between guess and correct location
        this.ctx.beginPath();
        this.ctx.moveTo(this.guessPosition.x, this.guessPosition.y);
        this.ctx.lineTo(
          GameManager.currentLocation[0],
          GameManager.currentLocation[1]
        );
        this.ctx.strokeStyle = "red";
        // Scale line width by inverse zoom to keep it constant on screen
        this.ctx.lineWidth = 10 / this.camera.zoom;
        this.ctx.stroke();

        // Draw the correct location pin (shadePinImg)
        this.ctx.save(); // Save context before drawing shade pin
        this.ctx.translate(
          GameManager.currentLocation[0],
          GameManager.currentLocation[1]
        );
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
    this.ctx.font = "20px Trajan Pro Bold"; // Font for UI elements

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
   * Resets the map camera to its default position and zoom (centered).
   */
  resetCamera() {
    this.camera.targetX = -this.mapCenter.x;
    
    this.camera.targetY = -this.mapCenter.y;
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
   * @param {number} [padding=30] - The padding around the edges of the screen.
   */
  fitPointsInView(point1, point2, padding = 30) {
    const midX = (point1.x + point2.x) / 2;
    const midY = (point1.y + point2.y) / 2;
    this.camera.targetX = -midX;
    this.camera.targetY = -midY;

    const dx = Math.abs(point1.x - point2.x);
    const dy = Math.abs(point1.y - point2.y);
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Calculate the required zoom level to fit both points
    // Ensure we don't divide by zero if distance is 0
    const requiredZoomX =
      distance > 0
        ? this.canvas.width / (distance + padding)
        : this.camera.targetZoom;
    const requiredZoomY =
      distance > 0
        ? this.canvas.height / (distance + padding)
        : this.camera.targetZoom;

    // Take the minimum of the two required zooms to ensure both dimensions fit
    // Clamp the zoom to reasonable values
    this.camera.targetZoom = Math.min(
      Math.max(requiredZoomX, 0.1),
      Math.max(requiredZoomY, 0.1),
      2 // Max zoom to prevent over-zooming on close points
    );
  }
}
