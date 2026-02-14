///////////////////////////////////////////////
////// Geoguessr Clone for Hollow Knight //////
///////////////////////////////////////////////

//BEWARE THIS SOURCE CODE IS NOW LESS OF AN ABSOLUTE MESS THAN IT USED TO BE (but still a mess)//

// Variable that can be changed from console to get various debug info
window.debugMode = false

import { GameMap } from './GameMap.js'
import { randIRange, makeSeededRandom } from './Utils.js'
import { loadInitialData } from './loadLocationData.js'
import { MultipleChoice } from './MultipleChoice/MultipleChoice.js'
import WindowManager from './WindowManager.js'
import ToastManager from './ToastManager.js'
import AudioPlayer from './AudioPlayer.js'

export const DEFAULT_MAP_URL = 'images/game/defaultMaps/hallownest.png'
export const imagePackMC = new MultipleChoice(getElem('packChoices'))

// --- Constants ---
export const GAMESTATES = {
  guessing: 0,
  guessed: 1,
  gameOver: 2,
  gameMenu: 3,
}

export const DIFFICULTRANGE = {
  attuned: { min: 1, max: 4 },
  ascended: { min: 4, max: 7 },
  radiant: { min: 7, max: 10 },
}

const tm = new ToastManager()
const wm = new WindowManager()

// --- DOM Elements (Grouped for better organization) ---
// Properties are assigned in initializeDOM().
export const DOM = {}

// --- GameManager Object ---
// Manages all game state, flow, scoring, and UI updates.
export const GameManager = {
  gameState: GAMESTATES.gameMenu,
  usedLocations: {}, // Stores indices of used locations per game mode
  playOrders: {}, // deterministic play order per game mode (array of original indices)
  playOrderPointers: {}, // pointer per game mode into playOrders
  currentLocation: null, // [x, y, difficulty, imageUrl]
  currentRound: 0,
  totalRounds: 5,
  totalScore: 0,
  roundScore: 0,
  maxScore: 5000,
  lastFrameTime: 0,
  timerLengthSeconds: 60,
  timeLimitEnabled: false,
  endTime: 0,
  blurredModeEnabled: false, // Is the mode active?
  blurTimeRemaining: 0, // How much time is left for the blur effect.
  totalBlurTime: 20000,
  seed: null, // current seed string or null
  rng: null, // seeded RNG instance when seed provided
  minDifficulty: 1,
  maxDifficulty: 10,
  gameModeData: {}, // Moved here to be managed by GameManager

  speedrunTimer: {
    _currentLocationTime: 0,
    set currentLocationTime(newTime) {
      this._currentLocationTime = newTime
      getElem('locationTime').innerText = (newTime / 1000).toFixed(2)
    },
    get currentLocationTime() {
      return this._currentLocationTime
    },

    _totalTime: 0,
    set totalTime(newTime) {
      this._totalTime = newTime
      getElem('totalTime').innerText = (newTime / 1000).toFixed(2)
    },
    get totalTime() {
      return this._totalTime
    },
  },

  /**
   * Initializes the game manager.
   */
  async init(gameData) {
    document.addEventListener('gameWindowOpen', () => {
      showMenuBlur()
    })
    document.addEventListener('gameWindowsClosed', () => {
      console.log('window close')
      hideMenuBlur()
    })
    AudioPlayer.preloadSound('audio/pin_drop.ogg')
    AudioPlayer.preloadSound('audio/confirm.ogg')
    AudioPlayer.preloadSound('audio/basic_button.ogg')

    this.gameModeData = gameData
    GameMap.init(DOM.mapCanvas)

    // Initialize usedLocations for all game modes that have been loaded
    Object.keys(this.gameModeData).forEach((modeId) => {
      if (!this.usedLocations[modeId]) {
        // Only initialize if not already present (e.g., from a custom pack)
        this.usedLocations[modeId] = []
      }
    })

    this.loadOptionsFromLocalStorage()
    if (imagePackMC.hasSelection() == false) {
			imagePackMC.selectChoiceByIndex(0)
		}

    // --- Add all windows to the WindowManager ---
    wm.add({
      id: 'options',
      element: DOM.gameOptionsWindow,
      onOpen: () => {
        this.updateSelectedPacksDisplay()
        this.gameState = GAMESTATES.gameMenu
        DOM.startButton.innerText = 'Start Game'
        this.validaiteForm()
      },
    })
    wm.add({
      id: 'gameover',
      element: DOM.gameOverWindow,
      onOpen: () => {
        this.gameState = GAMESTATES.gameOver
      },
    })
    wm.add({
      id: 'packChoices',
      element: DOM.packSelectWindow,
      onOpen: () => {
        this.gameState = GAMESTATES.gameMenu
      },
    })
    wm.add({
      id: 'confirmation',
      element: DOM.confirmationWindow,
      closeOnEscape: true,
    })

    // Set an image on init to prevent a black background initially
    await this.setLocation(
      randIRange(0, this.gameModeData.hallownest.locations.length),
      'hallownest',
      false
    ).then(() => {
		//open window
      wm.open('options')
    })

    this.addEventListeners()
    this.gameLoop() // Start the main game loop
    this.initializeOptionToggles()
  },

  /**
   * Adds new game mode data to the GameManager and initializes its usedLocations.
   * This method should be called by the data loading mechanism (e.g., loadLocationData, loadCustomImagePack).
   * @param {string} gameModeId - The ID of the game mode.
   * @param {object} data - The game mode data containing 'name' and 'locations'.
   */
  addGameModeData(gameModeId, data) {
    this.gameModeData[gameModeId] = data
    this.usedLocations[gameModeId] = [] // Initialize used locations for this new game mode
  },

  /**
   * The main game loop, called continuously using requestAnimationFrame.
   */
  gameLoop() {
    const currentTime = performance.now()
    const dt = this.lastFrameTime > 0 ? currentTime - this.lastFrameTime : 0
    this.lastFrameTime = currentTime

    if (this.gameState === GAMESTATES.guessing) {
      /// Speedrun Timer Update
      this.speedrunTimer.currentLocationTime += dt
      this.speedrunTimer.totalTime += dt

      /// Time Limit update
      if (this.timeLimitEnabled) {
        // This still needs to be based on a fixed end time
        const remainingTime = this.endTime - currentTime

        if (remainingTime <= 0) {
          DOM.timeLimitDisplay.innerText = '0.00'
          if (!GameMap.guessPosition) {
            GameMap.updateGuessPos(
              GameMap.mouseXRelative,
              GameMap.mouseYRelative
            )
          }
          this.guessButtonClicked()
        } else {
          DOM.timeLimitDisplay.innerText = (remainingTime / 1000).toFixed(2)
        }
      }

      // Blur Timer Update
      if (this.blurredModeEnabled) {
        if (this.blurTimeRemaining > 0) {
          this.blurTimeRemaining -= dt
          const blurDuration = this.totalBlurTime // Total duration of the effect in ms
          // Calculate progress from 0 (start) to 1 (end)
          const progress =
            1 - Math.max(0, this.blurTimeRemaining) / blurDuration
          // Apply an ease-out function to the progress
          const easedProgress = 1 - Math.pow(1 - progress, 4)
          // Map the eased progress to a blur value (e.g., 100px down to 0)
          const blurPx = (1 - easedProgress) * 100
          DOM.locationImgElement.style.filter = `blur(${blurPx}px)`
        } else {
          DOM.locationImgElement.style.filter = 'blur(0px)'
        }
      }
    } else {
      DOM.locationImgElement.style.filter = ``
    }

    // --- Debug Window Update ---
    if (window.debugMode) {
      DOM.debugWindow.style.display = 'block'

      const {
        camera,
        mousePos,
        mouseXRelative,
        mouseYRelative,
        guessPosition,
        fps,
      } = GameMap
      const gameStateName = Object.keys(GAMESTATES).find(
        (key) => GAMESTATES[key] === this.gameState
      )

      const debugData = {
        'Game State': `${gameStateName} (${this.gameState})`,
        Round: `${this.currentRound}/${this.totalRounds}`,
        Score: `${this.totalScore} (Round: ${this.roundScore})`,
        Seed: this.seed,

        '---': 'Map',
        Cam: `X: ${camera.x.toFixed(2)}, Y: ${camera.y.toFixed(2)}`,
        Zoom: camera.zoom.toFixed(3),
        Mouse: `X: ${mousePos.x}, Y: ${mousePos.y}`,
        'Rel Mouse': `X: ${mouseXRelative.toFixed(
          2
        )}, Y: ${mouseYRelative.toFixed(2)}`,
        Guess: guessPosition
          ? `X: ${guessPosition.x.toFixed(2)}, Y: ${guessPosition.y.toFixed(2)}`
          : 'null',
        Correct: this.currentLocation
          ? `X: ${this.currentLocation[0]}, Y: ${this.currentLocation[1]}`
          : 'null',
        FPS: fps.toFixed(1),
        TotalLocations: Object.values(this.gameModeData).reduce(
          (acc, mode) => acc + mode.locations.length,
          0
        ),
      }

      DOM.debugText.textContent = Object.entries(debugData)
        .map(([key, value]) => {
          if (key === '---') return value // For separators
          // Pad the key to align the values
          const paddedKey = key.padEnd(10, ' ')
          return `${paddedKey}: ${value}`
        })
        .join('\n')
    } else {
      DOM.debugWindow.style.display = 'none'
    }

    // Draw map and UI
    GameMap.draw()

    if (GameManager.gameState === GAMESTATES.gameMenu) {
      DOM.newGameButton.style.display = 'none'
    } else {
      DOM.newGameButton.style.display = 'block'
    }

    requestAnimationFrame(() => GameManager.gameLoop())
  },

  /**
   * Adds all necessary event listeners for game controls.
   */
  addEventListeners() {
    // Ensure DOM elements are available before adding listeners
    if (!DOM.difficultySelector) {
      console.error(
        'DOM elements not initialized. Call initializeDOMElements() first.'
      )
      return
    }
    document
      .getElementById('packSelectBackButton')
      .addEventListener('click', () => {
        wm.open('options')
      })
    DOM.difficultySelector.addEventListener('change', () => {
      if (DOM.difficultySelector.value === 'custom') {
        DOM.customDifficultyDiv.style.display = 'flex'
      } else {
        DOM.customDifficultyDiv.style.display = 'none'
      }
      this.saveOptionsToLocalStorage()
    })

    DOM.roundCountInput.addEventListener('input', () => {
      this.saveOptionsToLocalStorage()
      this.updateRoundCounter()
    })
    DOM.roundCountInput.addEventListener('input', () => {
      this.saveOptionsToLocalStorage()
      this.validaiteForm()
    })

    DOM.timerLengthInput.addEventListener('input', () => {
      this.saveOptionsToLocalStorage()
      this.validaiteForm()
    })
    DOM.seedInput.addEventListener('input', () => {
      this.saveOptionsToLocalStorage()
      this.validaiteForm()
    })

    // Listeners for custom difficulty range sliders to update value displays
    DOM.minDifficultyInput.addEventListener('input', (e) => {
      DOM.minDifficultyValue.textContent = e.target.value
    })
    DOM.maxDifficultyInput.addEventListener('input', (e) => {
      DOM.maxDifficultyValue.textContent = e.target.value
    })

    DOM.guessButton.addEventListener(
      'click',
      this.guessButtonClicked.bind(this)
    )
    DOM.minimiseButton.addEventListener('click', () => {
      this.toggleMinimise()
    })

    DOM.timeLimitEnabled.addEventListener('change', () => {
      this.validaiteForm()
      this.saveOptionsToLocalStorage()
    })
    DOM.minDifficultyInput.addEventListener('input', () => {
      this.validaiteForm()
      this.saveOptionsToLocalStorage()
    })
    DOM.maxDifficultyInput.addEventListener('input', () => {
      this.validaiteForm()
      this.saveOptionsToLocalStorage()
    })
    DOM.enableSeed.addEventListener('change', () => {
      this.validaiteForm()
      this.saveOptionsToLocalStorage()
    })
    getElem('blurTimeInput').addEventListener('change', () => {
      this.validaiteForm()
      this.saveOptionsToLocalStorage()
    })
    getElem('blurredModeEnabled').addEventListener('change', () => {
      this.validaiteForm()
      this.saveOptionsToLocalStorage()
    })

    document
      .getElementById('playAgainButton')
      .addEventListener('click', this.restartGame.bind(this))
    document
      .getElementById('mainMenuButton')
      .addEventListener('click', () => wm.open('options'))
    document
      .getElementById('startButton')
      .addEventListener('click', this.restartGame.bind(this))
    document
      .getElementById('newGameButton')
      .addEventListener('click', async () => {
        if (
          this.gameState === GAMESTATES.guessing ||
          this.gameState === GAMESTATES.guessed
        ) {
          const confirmed = await this.showConfirmationDialog(
            'Return to menu? Your current game progress will be lost.'
          )
          if (confirmed) wm.open('options')
        } else {
          wm.open('options')
        }
      })
    document
      .getElementById('changePacksButton')
      .addEventListener('click', () => wm.open('packChoices'))

    // Focus trap: keep focus inside the visible modal while open
    document.addEventListener('focusin', this._focusInHandler)

    document
      .getElementById('fullscreenButton')
      .addEventListener('click', () => this.toggleFullscreen())

    document.addEventListener('keypress', this.handleKeyPress.bind(this))

    DOM.changePacksButton.addEventListener('click', () => {
      wm.open('packChoices')
    })
  },

  /**
   * Handles global key press events.
   * @param {KeyboardEvent} event
   */
  handleKeyPress(event) {
    if (event.code === 'Space') {
      this.guessButtonClicked()
    }
    if (event.key === 'f') {
      this.toggleFullscreen()
    }
    if (event.key === 'm') {
      this.toggleMinimise()
    }
    if (event.key === '~') {
      window.debugMode = !window.debugMode
    }
  },

  /**
   * Starts or restarts the game.
   */
  async restartGame() {
    // Reset timer state
    this.speedrunTimer.currentLocationTime = 0
    this.speedrunTimer.totalTime = 0
    this.lastFrameTime = 0

    this.saveOptionsToLocalStorage()
    this.updateRoundCounter()

    this.minDifficulty = Number(
      DOM.customDifficultyDiv.querySelector('#minDifficulty').value
    )
    this.maxDifficulty = Number(
      DOM.customDifficultyDiv.querySelector('#maxDifficulty').value
    )

    this.timeLimitEnabled = DOM.timeLimitEnabled.checked
    if (this.timeLimitEnabled) {
      this.timerLengthSeconds = Number(DOM.timerLengthInput.value)
    }
    this.blurredModeEnabled = DOM.blurredModeEnabled.checked

    // --- MULTI-MODE SELECTION ---
    const selectedGameModeIds = imagePackMC.getSelected()

    if (selectedGameModeIds.length === 0) {
      console.error('No game mode selected, cannot start game')
      return
    }

    const validGameModes = selectedGameModeIds
      .map((id) => this.gameModeData[id])
      .filter(Boolean)

    if (validGameModes.length === 0) {
      console.error('No valid game modes selected, cannot start game')
      return
    }

    // Reset used locations for the selected game modes
    selectedGameModeIds.forEach((id) => {
      if (this.gameModeData[id]) {
        this.usedLocations[id] = []
      }
    })

    // Close any open windows
    wm.close()

    // blurTimeInput.value is in ms
    this.totalBlurTime = DOM.blurTimeInput.value * 1000

    // Load the map image for the *first* valid mode
    const firstMode = validGameModes[0]
    const mapUrl =
      firstMode.map?.useCustomMap && firstMode.map?.mapUrl
        ? firstMode.map.mapUrl
        : firstMode.map?.defaultMap || DEFAULT_MAP_URL

    await GameMap.changeMapImage(mapUrl)

    // --- SEED SETUP ---
    let generatedSeed
    const seedInputVal = (DOM.seedInput?.value || '').toString().trim()
    if (DOM.enableSeed && DOM.enableSeed.checked) {
      if (seedInputVal) {
        this.seed = seedInputVal
      } else {
        generatedSeed =
          ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) >>> 0
        this.seed = String(generatedSeed)
        if (DOM.seedInput) DOM.seedInput.value = this.seed
      }
    } else {
      generatedSeed =
        ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) >>> 0
      this.seed = String(generatedSeed)
      if (DOM.seedInput) DOM.seedInput.value = ''
    }

    try {
      this.rng = makeSeededRandom(this.seed)
    } catch (e) {
      console.warn(
        'Failed to create seeded RNG, falling back to Math.random',
        e
      )
      this.rng = null
    }

    seededIndicator.style.display =
      DOM.enableSeed && DOM.enableSeed.checked ? 'block' : 'none'

    // --- BUILD MULTI-MODE PLAY ORDER ---
    try {
      const selectedDifficulty = DOM.difficultySelector.value
      this.playOrders = {}
      this.playOrderPointers = {}
      this.combinedPlayOrder = []

      for (const mode of validGameModes) {
        const filtered = this.filterByDifficulty(
          mode.locations,
          selectedDifficulty
        )
        if (!filtered || filtered.length === 0) {
          console.warn(
            `No valid locations for ${mode.name} in selected difficulty.`
          )
          continue
        }

        const indices = filtered.map((loc) => mode.locations.indexOf(loc))
        const shuffled = this.rng?.shuffle
          ? this.rng.shuffle(indices.slice())
          : indices.sort(() => Math.random() - 0.5)

        this.playOrders[mode.id] = shuffled
        this.playOrderPointers[mode.id] = 0

        // Merge into unified combined order (for alternating play)
        for (const idx of shuffled) {
          this.combinedPlayOrder.push({ modeId: mode.id, index: idx })
        }
      }

      if (this.combinedPlayOrder.length === 0) {
        console.error(
          'No locations available for the selected modes/difficulty.'
        )
        return
      }

      // Shuffle the combined pool so rounds are mixed between game modes
      this.combinedPlayOrder = this.rng?.shuffle
        ? this.rng.shuffle(this.combinedPlayOrder)
        : this.combinedPlayOrder.sort(() => Math.random() - 0.5)

      this.totalRounds = this.combinedPlayOrder.length
      this.currentRound = 0
    } catch (e) {
      console.warn('Failed to build deterministic play order:', e)
    }

    this.totalScore = 0

    DOM.guessButton.disabled = true
    DOM.guessButton.innerText = 'Guess!'

    this.nextRound()
  },

  /**
   * Updates the round counter display.
   */
  updateRoundCounter() {
    // Ensure roundCountInput is valid first
    var value = Number(DOM.roundCountInput.value)

    if (value <= 0 || isNaN(value)) {
      value = DOM.roundCountInput.placeholder
    }
    this.totalRounds = value

    DOM.roundElement.textContent = `${this.currentRound}/${this.totalRounds}`
  },

  /**
   * Initializes all checkbox-based option toggles in the game options window.
   * It finds all checkboxes with a `data-toggle-target` attribute and sets up
   * event listeners to show/hide the target element.
   */
  initializeOptionToggles() {
    const toggles = DOM.gameOptionsWindow.querySelectorAll(
      '[data-toggle-target]'
    )

    toggles.forEach((toggle) => {
      const targetId = toggle.dataset.toggleTarget
      const targetElement = getElem(targetId)

      if (!targetElement) {
        console.warn(`Toggle target element with ID "${targetId}" not found.`)
        return
      }

      const updateTargetVisibility = () => {
        const isChecked = toggle.checked
        targetElement.style.display = isChecked ? 'flex' : 'none'

        // Special handling for timer display outside the options window
        if (toggle.id === 'timeLimitEnabled') {
          DOM.timeLimitDisplay.style.display = isChecked ? 'block' : 'none'
        }
      }

      // Set initial state
      updateTargetVisibility()

      // Add event listener for changes
      toggle.addEventListener('change', updateTargetVisibility)
    })
  },

  /**
   * Toggles fullscreen mode for the map container.
   */
  toggleFullscreen() {
    if (GameManager.gameState === GAMESTATES.gameMenu) return
    DOM.mapContainer.classList.toggle('fullscreen')
  },

  toggleMinimise() {
    if (DOM.minimiseIcon.classList.contains('rotate180')) {
      // Un-minimise
      DOM.minimiseIcon.classList.remove('rotate180')
      DOM.mapCanvas.classList.remove('minimise')
      DOM.mapContainer.classList.remove('minimise')
    } else {
      // Minimise
      DOM.minimiseIcon.classList.add('rotate180') // This class indicates it's minimised
      DOM.mapCanvas.classList.add('minimise')
      DOM.mapContainer.classList.add('minimise')
    }
  },

  /**
   * Handles the guess button click logic based on current game state.
   */
  guessButtonClicked() {
    if (DOM.guessButton.disabled) return

    AudioPlayer.playSound('audio/basic_button.ogg')

    if (this.gameState === GAMESTATES.guessing) {
      this.calculateScore()
      this.gameState = GAMESTATES.guessed
      DOM.guessButton.disabled = false

      AudioPlayer.playSound('audio/confirm.ogg')

      DOM.roundScoreDisplay.innerText = `You earned ${this.roundScore} points`
      DOM.roundScoreDisplay.style.display = 'block'

      if (GameMap.guessPosition && this.currentLocation) {
        GameMap.fitPointsInView(GameMap.guessPosition, {
          x: this.currentLocation[0],
          y: this.currentLocation[1],
        })
      } else if (this.currentLocation) {
        GameMap.setCameraTarget(
          this.currentLocation[0],
          this.currentLocation[1],
          1
        )
      }

      if (this.currentRound >= this.totalRounds) {
        DOM.guessButton.innerText = 'End Game'
        this.gameState = GAMESTATES.gameOver
      } else {
        DOM.guessButton.innerText = 'Next Round'
      }
    } else if (this.gameState === GAMESTATES.guessed) {
      if (this.currentRound < this.totalRounds) {
        DOM.mapContainer.classList.remove('fullscreen')
        this.nextRound()
        DOM.guessButton.disabled = true
        DOM.guessButton.innerText = 'Guess!'
      } else {
        this.gameState = GAMESTATES.gameOver
        this.guessButtonClicked() // trigger gameOver logic
      }
    } else if (this.gameState === GAMESTATES.gameOver) {
      DOM.guessButton.disabled = true

      if (this.timeLimitEnabled) {
        DOM.timerLengthDisplay.style.display = 'block'
        DOM.timerLengthDisplay.innerText = `Timer Length: ${this.timerLengthSeconds}s`
      } else {
        DOM.timerLengthDisplay.style.display = 'none'
      }

      wm.open('gameover')
      DOM.finalScoreDisplay.innerText = `Final Score: ${this.totalScore}/${
        this.totalRounds * this.maxScore
      }`
      const accuracyPercent = (
        (this.totalScore / (this.totalRounds * this.maxScore)) *
        100
      ).toFixed(2)
      DOM.accuracyElement.innerText = `Accuracy: ${accuracyPercent}%`
      DOM.totalRoundsElement.innerText = `Total Rounds: ${this.totalRounds}`

      if (this.seed != null) DOM.seedDisplay.innerText = `Seed: ${this.seed}`
    }
  },

  /**
   * Sets the current game location.
   * @param {number} i - The index of the location in the dataList.
   * @param {string} gameMode - The current game mode.
   */
  async setLocation(i, gameMode, shouldStartGame = true) {
    GameMap.guessPosition = null // Clear previous guess

    const modeData = this.gameModeData[gameMode] // Use this.gameModeData
    if (
      !modeData ||
      !modeData.locations ||
      i < 0 ||
      i >= modeData.locations.length
    ) {
      console.error('Invalid game mode or location index:', {
        index: i,
        gameMode,
        modeData,
      })
      return
    }

    this.currentLocation = modeData.locations[i]
    if (!this.currentLocation || !this.currentLocation[3]) {
      console.error(
        'Invalid current location or image path:',
        this.currentLocation
      )
      return
    }

    const imgSrc = this.currentLocation[3]
    // Hide image and apply blur while loading
    DOM.locationImgElement.classList.add('hideLocationImg')
    getElem('blurBg').classList.add('hideLocationImg')
	
    DOM.locationImgElement.style.opacity = '0'
    DOM.locationImgElement.style.transition = 'opacity 0.4s ease'

    // Show image loading text and keep overlay visible while the image loads
    this.setLoadingIndicatorVisibility(true)
    DOM.loadingText.innerText = 'Loading Image'

    // Clear previous handlers to avoid leaks or duplicate calls
    DOM.locationImgElement.onload = null
    DOM.locationImgElement.onerror = null

    return new Promise((resolve) => {
      DOM.locationImgElement.onload = () => {
        if (shouldStartGame) {
          this.gameState = GAMESTATES.guessing
          this.speedrunTimer.currentLocationTime = 0
        }
        this.setLoadingIndicatorVisibility(false)
        DOM.locationImgElement.style.display = 'block'
        // Fade in the image and remove blur
        setTimeout(() => {
          DOM.locationImgElement.style.opacity = '1'
          DOM.locationImgElement.classList.remove('hideLocationImg')
          getElem('blurBg').classList.remove('hideLocationImg')
        }, 10)

        if (GameMap.guessPosition) {
          // Only enable guess button if a guess was made
          DOM.guessButton.disabled = false
        }
        if (this.timeLimitEnabled) {
          this.endTime = performance.now() + this.timerLengthSeconds * 1000
        }

        if (this.blurredModeEnabled) {
          this.blurTimeRemaining = this.totalBlurTime
        }
        resolve()
      }

      DOM.locationImgElement.onerror = (e) => {
        console.error('Failed to load location image:', {
          path: imgSrc,
          error: e,
        })
        getElem('loadingIndicator').style.display = 'none'
        resolve()
      }

      // Start loading into the visible DOM image (single network request)
      getElem('locationImg').src = imgSrc
      getElem('blurBg').style.backgroundImage = `url(${imgSrc})`
    })

    // Do not remove hideLocationImg here; wait for image to load
  },

  /**
   * Filters a list of locations/charms by difficulty.
   * @param {Array<Array>} dataList - The list of locations or charms.
   * @param {string} difficulty - The selected difficulty ('easy', 'normal', 'hard', 'custom', 'all').
   * @returns {Array<Array>} The filtered list.
   */
  filterByDifficulty(dataList, difficulty) {
    if (difficulty === 'all') {
      return dataList
    }

    if (difficulty === 'custom') {
      return dataList.filter(
        (item) => item[2] >= this.minDifficulty && item[2] <= this.maxDifficulty
      )
    }

    const range = DIFFICULTRANGE[difficulty]
    if (range) {
      return dataList.filter(
        (item) => item[2] >= range.min && item[2] <= range.max
      )
    }
    console.warn('Unknown difficulty selected:', difficulty)
    return dataList // Fallback
  },

  /**
   * Advances the game to the next round.
   * Supports multiple selected game modes.
   */
  async nextRound() {
    // Hide score display for the new round
    DOM.roundScoreDisplay.style.display = 'none'

    GameMap.resetCamera()
    this.currentRound++
    this.updateRoundCounter()

    const selectedGameModes = imagePackMC.getSelected()

    if (!selectedGameModes || selectedGameModes.length === 0) {
      console.error('No game modes selected.')
      this.endGame()
      return
    }

    const selectedDifficulty = DOM.difficultySelector.value

    // --- Build unified pool of all possible locations across modes ---
    let combinedPool = []
    for (const modeId of selectedGameModes) {
      const dataList = this.gameModeData[modeId]?.locations
      if (!dataList) continue

      // Initialize used list if missing
      if (!this.usedLocations[modeId]) this.usedLocations[modeId] = []

      const filtered = this.filterByDifficulty(dataList, selectedDifficulty)
      const usedList = this.usedLocations[modeId]

      // Determine available indices
      const availableIndices = filtered
        .map((_, i) => i)
        .filter((i) => !usedList.includes(i))

      for (const idx of availableIndices) {
        combinedPool.push({ modeId, dataList, filtered, index: idx })
      }
    }

    if (combinedPool.length === 0) {
      console.warn(
        'No available locations left. Resetting and repeating locations.'
      )
      tm.displayToast(
        'All unique locations have been used. Locations will now repeat.'
      )
      // Reset used locations for the selected modes
      for (const modeId of selectedGameModes) {
        if (this.usedLocations[modeId]) {
          this.usedLocations[modeId] = []
        }
      }

      // Rebuild the pool with all locations now available
      for (const modeId of selectedGameModes) {
        const dataList = this.gameModeData[modeId]?.locations
        if (!dataList) continue

        const filtered = this.filterByDifficulty(dataList, selectedDifficulty)
        // All indices are available now
        const availableIndices = filtered.map((_, i) => i)

        for (const idx of availableIndices) {
          combinedPool.push({ modeId, dataList, filtered, index: idx })
        }
      }

      // If it's still empty, then there were no locations to begin with.
      if (combinedPool.length === 0) {
        console.error(
          'No locations found for the selected difficulty, even after reset.'
        )
        this.endGame()
        return
      }
    }

    // --- Choose a location deterministically or randomly ---
    let chosen
    if (this.rng) {
      const pickIndex = this.rng.randIRange(0, combinedPool.length - 1)
      chosen = combinedPool[pickIndex]
    } else {
      const pickIndex = randIRange(0, combinedPool.length - 1)
      chosen = combinedPool[pickIndex]
    }

    const { modeId, dataList, filtered, index } = chosen
    const usedList = this.usedLocations[modeId]
    const newLocation = filtered[index]
    const originalIndex = dataList.indexOf(newLocation)

    if (originalIndex === -1) {
      console.error(`Location not found in game mode ${modeId}`)
      this.endGame()
      return
    }

    // Mark this location as used
    usedList.push(index)

    // --- Change map if necessary ---
    const modeData = this.gameModeData[modeId]
    const newMapUrl =
      modeData.map?.useCustomMap && modeData.map?.mapUrl
        ? modeData.map.mapUrl
        : modeData.map?.defaultMap || DEFAULT_MAP_URL

    if (GameMap.currentMapUrl !== newMapUrl) {
		this.setLoadingIndicatorVisibility(true)
      DOM.loadingText.innerText = 'Loading Map'
      await GameMap.changeMapImage(newMapUrl)
    }

    // Set and start the round
    this.startRoundWithLocation(originalIndex, modeId)
  },
  setLoadingIndicatorVisibility(visible) {
    if (visible) {
      DOM.loadingIndicator.style.display = 'block'
    } else {
      DOM.loadingIndicator.style.display = 'none'
    }
  },

  /**
   * Helper: Starts a round from a chosen location index.
   */
  startRoundWithLocation(originalIndex, gameMode) {
    this.setLocation(originalIndex, gameMode)
    DOM.guessButton.disabled = true
    GameMap.guessPosition = null

    if (this.timeLimitEnabled) {
      this.endTime = performance.now() + this.timerLengthSeconds * 1000
    }
  },

  /**
   * Helper: Ends the game safely.
   */
  endGame() {
    this.gameState = GAMESTATES.gameOver
    this.guessButtonClicked()
  },

  /**
   * Calculates the round score based on guess distance.
   */
  calculateScore() {
    if (!GameMap.guessPosition || !this.currentLocation) {
      this.roundScore = 0
      return
    }
    const dx = GameMap.guessPosition.x - this.currentLocation[0]
    const dy = GameMap.guessPosition.y - this.currentLocation[1]
    const distance = Math.sqrt(dx * dx + dy * dy)
    const leniency = 50 // Distance in which you get the max score
    const dropOffRate = 0.001 // How quickly the score drops off when guessing farther aue aue! (away)
    const calculatedScore = Math.round(
      this.maxScore * Math.exp(-dropOffRate * (distance - leniency))
    )
    // Clamp the score to the max value, preventing it from exceeding 5000 on very close guesses.
    this.roundScore = Math.min(calculatedScore, this.maxScore)
    this.totalScore += this.roundScore
  },

  // Keep track of active validation toasts to prevent duplicates
  validationToasts: {},

  /**
   * Displays a persistent validation toast if it's not already shown.
   * @param {string} key - A unique key for the validation message.
   * @param {string} message - The message to display.
   */
  showValidationToast(key, message) {
    if (!this.validationToasts[key]) {
      this.validationToasts[key] = tm.displayToast(message, 0) // 0 duration = persistent
    }
  },

  /**
   * Dismisses a validation toast if it exists.
   * @param {string} key - The unique key for the validation message to dismiss.
   */
  dismissValidationToast(key) {
    if (this.validationToasts[key]) {
      tm.dismissToast(this.validationToasts[key])
      delete this.validationToasts[key]
    }
  },

  async validaiteForm() {
    let formValid = true

    // Rule 1: At least one image pack must be selected.
    if (imagePackMC.getSelected().length === 0) {
      this.showValidationToast('pack', 'Please select at least one image pack.')
      formValid = false
    } else {
      this.dismissValidationToast('pack')
    }

    // Rule 2: Timer length must be a positive number if enabled.
    if (DOM.timeLimitEnabled.checked) {
      const timerVal = Number(DOM.timerLengthInput.value)
      if (timerVal <= 0 || isNaN(timerVal)) {
        this.showValidationToast(
          'timer',
          'Timer length must be a number greater than 0.'
        )
        formValid = false
      } else {
        this.dismissValidationToast('timer')
      }
    } else {
      this.dismissValidationToast('timer') // Dismiss if timer is disabled
    }

    // Rule 3: Round count must be a positive number.
    const roundsVal = Number(DOM.roundCountInput.value)
    if (roundsVal <= 0 || isNaN(roundsVal)) {
      this.showValidationToast(
        'rounds',
        'Rounds must be a number greater than 0.'
      )
      formValid = false
    } else {
      this.dismissValidationToast('rounds')
    }

    // Rule 4: Custom difficulty validation.
    if (DOM.difficultySelector.value === 'custom') {
      const minDiff = Number(DOM.minDifficultyInput.value)
      const maxDiff = Number(DOM.maxDifficultyInput.value)

      if (minDiff < 1 || minDiff > 10 || isNaN(minDiff)) {
        this.showValidationToast(
          'minDiff',
          'Min difficulty must be between 1-10.'
        )
        formValid = false
      } else {
        this.dismissValidationToast('minDiff')
      }

      if (maxDiff < 1 || maxDiff > 10 || isNaN(maxDiff)) {
        this.showValidationToast(
          'maxDiff',
          'Max difficulty must be between 1-10.'
        )
        formValid = false
      } else {
        this.dismissValidationToast('maxDiff')
      }

      if (minDiff > maxDiff) {
        this.showValidationToast(
          'diffRange',
          'Min difficulty cannot be greater than max.'
        )
        formValid = false
      } else {
        this.dismissValidationToast('diffRange')
      }
    } else {
      this.dismissValidationToast('minDiff')
      this.dismissValidationToast('maxDiff')
      this.dismissValidationToast('diffRange')
    }

    // Rule 5: Seed validation.
    if (DOM.enableSeed && DOM.enableSeed.checked) {
      const seedVal = (DOM.seedInput?.value || '').toString().trim()
      let seedValid = true
      if (seedVal.length === 0) {
        this.showValidationToast('seed', 'Seed cannot be empty.')
        seedValid = false
        formValid = false
      } else if (seedVal.includes(' ')) {
        this.showValidationToast('seed', 'Seed cannot contain spaces.')
        seedValid = false
        formValid = false
      } else if (seedVal.length > 100) {
        this.showValidationToast(
          'seed',
          'Seed cannot be longer than 100 characters.'
        )
        seedValid = false
        formValid = false
      }

      if (seedValid) {
        this.dismissValidationToast('seed')
        // You can keep your fun easter egg toasts here, they will auto-dismiss
        this.handleSeedEasterEggs(seedVal)
      }
    } else {
      this.dismissValidationToast('seed')
    }

    if (DOM.blurredModeEnabled.checked) {
      const blurTimeVal = Number(DOM.blurTimeInput.value)
      if (blurTimeVal <= 0 || isNaN(blurTimeVal)) {
        this.showValidationToast(
          'blurTime',
          'Blur time must be a number greater than 0.'
        )
        formValid = false
      } else {
        this.dismissValidationToast('blurTime')
      }
    } else {
      this.dismissValidationToast('blurTime')
    }

    if (formValid) {
      DOM.startButton.style.pointerEvents = 'auto'
      DOM.startButton.style.opacity = '1'
    } else {
      DOM.startButton.style.pointerEvents = 'none'
      DOM.startButton.style.opacity = '0.25'
    }
  },

  /**
   * Handles the fun easter eggs for the seed input.
   * These toasts are temporary and don't block form submission.
   * @param {string} seedVal - The value from the seed input.
   */
  async handleSeedEasterEggs(seedVal) {
    const lowerSeed = seedVal.toLowerCase()
    if (seedVal === '69') {
      tm.displayToast('Nice.')
    } else if (lowerSeed.includes('yalikejazz')) {
      const { egg } = await import('./egg.js')
      tm.displayToast(egg, 10000, { allowHTML: true })
    } else if (lowerSeed.includes('biticalifi')) {
      this.showValidationToast('seed', 'Seed cannot contain cool people.')
    } else if (seedVal === 'rickroll') {
      tm.displayToast('gottem')
      window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank')
    } else if (lowerSeed.includes('squirrel')) {
      tm.displayToast('🐿️')
    } else if (lowerSeed.includes('dawndishsoap')) {
      tm.displayToast(
        '<img src="images/soap.jpeg" style="width:100%; border-radius:8px;" alt="dawn dish soap" />',
        1200,
        { allowHTML: true }
      )
    }
    return true
  },

  /**
   * Updates the list of selected packs displayed on the options screen.
   */
  updateSelectedPacksDisplay() {
    const listContainer = getElem('selected-packs-list')
    if (!listContainer) return

    listContainer.innerHTML = imagePackMC
      .getSelectedOptions()
      .map((option) => {
        let iconHtml = ''
        if (option.gameMapName) {
          let iconSrc = 'images/customPin.png' // Default to custom
          if (option.gameMapName === 'hallownest') {
            iconSrc = 'images/knightPin.png'
          } else if (option.gameMapName === 'pharloom') {
            iconSrc = 'images/hornetPin.png'
          }
          iconHtml = `<img src="${iconSrc}" class="choice-map-icon" alt="${option.gameMapName} map icon">`
        }

        return `<span class="pack-tag">${iconHtml}${option.label}</span>`
      })
      .join('')
  },

  /**
   * Shows a confirmation dialog.
   * @param {string} message The message to display.
   * @returns {Promise<boolean>} A promise that resolves to true if confirmed, false otherwise.
   */
  showConfirmationDialog(message) {
    return new Promise((resolve) => {
      DOM.confirmationMessage.textContent = message
      const buttonContainer = DOM.confirmationButtons
      buttonContainer.innerHTML = '' // Clear old buttons

      const confirmBtn = document.createElement('button')
      confirmBtn.className = 'hk-button'
      confirmBtn.textContent = 'Confirm'

      const cancelBtn = document.createElement('button')
      cancelBtn.className = 'hk-button'
      cancelBtn.textContent = 'Cancel'

      buttonContainer.append(confirmBtn, cancelBtn)

      const closeDialog = (result) => {
        wm.close() // Close the confirmation window
        resolve(result)
      }

      confirmBtn.addEventListener('click', () => closeDialog(true), {
        once: true,
      })
      cancelBtn.addEventListener('click', () => closeDialog(false), {
        once: true,
      })

      wm.open('confirmation')
    })
  },
  saveOptionsToLocalStorage() {
    localStorage.roundCount = DOM.roundCountInput.value
    localStorage.timerLength = DOM.timerLengthInput.value
    localStorage.timeLimitEnabled = DOM.timeLimitEnabled.checked
    localStorage.minDifficulty = DOM.minDifficultyInput.value
    localStorage.maxDifficulty = DOM.maxDifficultyInput.value
    localStorage.blurredModeEnabled = DOM.blurredModeEnabled.checked
    localStorage.blurTime = DOM.blurTimeInput.value
    localStorage.selectedDifficulty = DOM.difficultySelector.value
    localStorage.selectedPacks = imagePackMC.getSelected()
    localStorage.seedEnabled = DOM.enableSeed.checked
    localStorage.seedInput = DOM.seedInput.value
  },
  loadOptionsFromLocalStorage() {
    if (localStorage.roundCount) {
      DOM.roundCountInput.value = localStorage.roundCount
    }
    this.updateRoundCounter()
    if (localStorage.timerLength) {
      DOM.timerLengthInput.value = localStorage.timerLength
    }
    if (localStorage.timeLimitEnabled) {
      DOM.timeLimitEnabled.checked =
        localStorage.timeLimitEnabled === 'true' ? true : false
    }
    if (localStorage.minDifficulty) {
      DOM.minDifficultyInput.value = localStorage.minDifficulty
    }
    if (localStorage.maxDifficulty) {
      DOM.maxDifficultyInput.value = localStorage.maxDifficulty
    }
    if (localStorage.blurredModeEnabled) {
      DOM.blurredModeEnabled.checked =
        localStorage.blurredModeEnabled === 'true' ? true : false
    }
    if (localStorage.blurTime) {
      DOM.blurTimeInput.value = localStorage.blurTime
    }
    if (localStorage.selectedDifficulty) {
      DOM.difficultySelector.value = localStorage.selectedDifficulty
    }
    if (localStorage.selectedPacks) {
      const packsArr = localStorage.selectedPacks.split(',')
      for (let i = 0; i < packsArr.length; i++) {
        imagePackMC.selected.add(packsArr[i])
      }
    }
    imagePackMC.render()
    if (localStorage.seedEnabled == 'true') {
      DOM.enableSeed.checked = true
    } else if (localStorage.seedEnabled == 'false') {
      DOM.enableSeed.checked = false
    }
    if (localStorage.seedInput) {
      DOM.seedInput.value = localStorage.seedInput
    }
  },

}


function initializeDOM() {
  DOM.customDifficultyDiv = getElem('customDifficultyDiv')
  DOM.difficultySelector = getElem('difficultySelector')
  DOM.roundCountInput = getElem('roundCount')
  DOM.timerLengthInput = getElem('timerLength')

  DOM.accuracyElement = getElem('accuracy')
  DOM.finalScoreDisplay = getElem('finalScore')
  DOM.gameOverWindow = getElem('gameOverWindow')
  DOM.gameOptionsWindow = getElem('gameOptionsWindow')
  DOM.loadingText = getElem('loadingText')
  DOM.roundElement = getElem('round')
  DOM.timeLimitDisplay = getElem('timeLimitDisplay')
  DOM.totalRoundsElement = getElem('totalRounds')
  DOM.timerLengthDisplay = getElem('timerLengthDisplay')
  DOM.newGameButton = getElem('newGameButton')
  DOM.startButton = getElem('startButton')
  DOM.mainMenuButton = getElem('mainMenuButton')
  DOM.timeLimitEnabled = getElem('timeLimitEnabled')
  DOM.minDifficultyInput = getElem('minDifficulty')
  DOM.maxDifficultyInput = getElem('maxDifficulty')
  DOM.minDifficultyValue = getElem('minDifficultyValue')
  DOM.maxDifficultyValue = getElem('maxDifficultyValue')
  DOM.formWarning = getElem('formWarning')

  DOM.guessButton = getElem('guessButton')
  DOM.locationImgElement = getElem('locationImg')
  DOM.mapCanvas = getElem('mapCanvas')
  DOM.mapContainer = getElem('mapContainer')
  DOM.roundScoreDisplay = getElem('roundScoreDisplay')
  DOM.minimiseButton = getElem('minimiseButton')
  DOM.gameMode = getElem('gameMode')
  DOM.minimiseIcon = getElem('minimiseIcon')
  DOM.fullscreenButton = getElem('fullscreenButton')
  DOM.seedInput = getElem('seedInput')
  DOM.seedDisplay = getElem('seedDisplay')
  DOM.enableSeed = getElem('enableSeed')
  DOM.seedOption = getElem('seedOption')
  DOM.timerLengthOption = getElem('timerLengthOption')
  DOM.modalOverlay = getElem('modalOverlay')
  DOM.seededIndicator = getElem('seededIndicator')
  DOM.packSelectWindow = getElem('packSelectWindow')
  DOM.packChoices = getElem('packChoices')
  DOM.confirmationWindow = getElem('confirmationWindow')
  DOM.confirmationMessage = getElem('confirmationMessage')
  DOM.confirmationButtons = getElem('confirmationButtons')
  DOM.changePacksButton = getElem('changePacksButton')
  DOM.blurredModeEnabled = getElem('blurredModeEnabled')
  DOM.debugWindow = getElem('debugWindow')
  DOM.debugText = getElem('debugText')
  DOM.blurTimeInput = getElem('blurTimeInput')
  DOM.loadingIndicator = getElem('loadingIndicator')
  DOM.menuBlur = getElem('menuBlur')
}

function hideMenuBlur() {
  DOM.menuBlur.style.filter = "blur(0px) brightness(1)"
  DOM.menuBlur.style.pointerEvents = "all"
}

function showMenuBlur() {
  DOM.menuBlur.style.filter = "blur(10px) brightness(0.45)"
  DOM.menuBlur.style.pointerEvents = "none"
}

function getElem(id) {
  return document.getElementById(id)
}

// Main entry point for the game
async function main() {
  console.log('DOM Loaded!')
  initializeDOM()
  const gameData = await loadInitialData()
  GameManager.init(gameData)
}

document.addEventListener('DOMContentLoaded', main)
