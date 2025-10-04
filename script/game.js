import { GameMap } from './GameMap.js'
import { randIRange, isNumber, makeSeededRandom } from './Utils.js'
import { loadInitialData } from './loadLocationData.js'
import { egg } from './egg.js'
///////////////////////////////////////////////
////// Geoguessr Clone for Hollow Knight //////
///////////////////////////////////////////////

//BEWARE THIS SOURCE CODE IS NOW LESS OF AN ABSOLUTE MESS THAN IT USED TO BE//

export const DEFAULT_MAP_URL = 'images/game/defaultMaps/hallownest.png'

// --- Constants ---
export const GAMESTATES = {
	guessing: 0,
	guessed: 1,
	gameOver: 2,
	optionsWindow: 3,
}
// General-purpose toast helper. Call as showToast(message, durationMs)
function showToast(message, duration = 1200) {
	try {
		let toast = document.getElementById('hk_toast')
		if (!toast) {
			toast = document.createElement('div')
			toast.id = 'hk_toast'
			toast.style.position = 'fixed'
			toast.style.bottom = '1rem'
			toast.style.right = '1rem'
			toast.style.background = 'rgba(0,0,0,0.8)'
			toast.style.color = 'white'
			toast.style.padding = '8px 12px'
			toast.style.borderRadius = '6px'
			toast.style.zIndex = 9999
			toast.style.fontSize = '14px'
			toast.style.pointerEvents = 'none'
			document.body.appendChild(toast)
		}
		// Use textContent to avoid accidental HTML injection
		toast.textContent = message
		// Reset opacity and ensure any prior hide timeout is cleared
		toast.style.transition = ''
		toast.style.opacity = '1'
		if (toast._hideTimeout) clearTimeout(toast._hideTimeout)
		toast._hideTimeout = setTimeout(() => {
			try {
				toast.style.transition = 'opacity 350ms'
				toast.style.opacity = '0'
			} catch (e) { /* ignore */ }
		}, duration)
	} catch (e) {
		console.log('Toast failed', e)
	}
}

export const DIFFICULTRANGE = {
	easy: { min: 1, max: 3 },
	normal: { min: 4, max: 7 },
	hard: { min: 8, max: 10 },
}

// --- DOM Elements (Grouped for better organization) ---
// Properties are assigned in initializeDOM().
export const DOM = {}

// --- GameManager Object ---
// Manages all game state, flow, scoring, and UI updates.
export const GameManager = {
	gameState: GAMESTATES.optionsWindow,
	usedLocations: {}, // Stores indices of used locations per game mode
	playOrders: {}, // deterministic play order per game mode (array of original indices)
	playOrderPointers: {}, // pointer per game mode into playOrders
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
	seed: null, // current seed string or null
	rng: null, // seeded RNG instance when seed provided
	minDifficulty: 1,
	maxDifficulty: 10,
	gameModeData: {}, // Moved here to be managed by GameManager

	/**
	 * Initializes the game manager.
	 */
	init(gameData) {
		this.gameModeData = gameData

		GameMap.init(DOM.mapCanvas)

		// Initialize usedLocations for all game modes that have been loaded
		Object.keys(this.gameModeData).forEach((modeId) => {
			if (!this.usedLocations[modeId]) {
				// Only initialize if not already present (e.g., from a custom pack)
				this.usedLocations[modeId] = []
			}
		})

		this.addEventListeners()
		this.openWindow('options')
		DOM.loadingText.style.display = 'none'

		this.gameLoop() // Start the main game loop
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
		// Timer update
		if (
			GameManager.timerEnabled &&
			GameManager.gameState === GAMESTATES.guessing &&
			GameManager.imageIsLoaded
		) {
			const currentTime = performance.now()
			const remainingTime = GameManager.endTime - currentTime

			if (remainingTime <= 0) {
				DOM.timerDisplay.innerText = '0.00'
				if (!GameMap.guessPosition) {
					GameMap.updateGuessPos(GameMap.mouseXRelative, GameMap.mouseYRelative)
				}
				GameManager.guessButtonClicked()
			} else {
				DOM.timerDisplay.innerText = (remainingTime / 1000).toFixed(2)
			}
		}
		// Draw map and UI
		GameMap.draw()

		// Update UI elements that depend on game state
		DOM.newGameButton.disabled =
			GameManager.gameState === GAMESTATES.optionsWindow

		requestAnimationFrame(GameManager.gameLoop)
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

		DOM.difficultySelector.addEventListener(
			'change',
			this.toggleCustomDifficultyDisplay.bind(this)
		)
		DOM.roundCountInput.addEventListener(
			'input',
			this.updateRoundCounter.bind(this)
		)
		DOM.roundCountInput.addEventListener('input', this.validaiteForm.bind(this))
		DOM.timerLengthInput.addEventListener(
			'input',
			this.validaiteForm.bind(this)
		)
		DOM.seedInput.addEventListener('input', this.validaiteForm.bind(this))


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
			if (DOM.minimiseIcon.classList.contains('rotate180')) {
				DOM.minimiseIcon.classList.remove('rotate180')
				DOM.mapCanvas.classList.remove('minimise')
				DOM.mapContainer.classList.remove('minimise')
			} else {
				DOM.minimiseIcon.classList.add('rotate180')
				DOM.mapCanvas.classList.add('minimise')
				DOM.mapContainer.classList.add('minimise')
			}
		})

		DOM.timerEnabled.addEventListener(
			'change',
			(event) => {
				this.timerInputDisplay(event.target)
				this.validaiteForm()
			},

		),


			DOM.minDifficultyInput.addEventListener(
				'input',
				this.validaiteForm.bind(this)
			),
			DOM.maxDifficultyInput.addEventListener(
				'input',
				this.validaiteForm.bind(this)
			),
			DOM.enableSeed.addEventListener(
				'change',
				this.validaiteForm.bind(this)
			)



		document
			.getElementById('playAgainButton')
			.addEventListener('click', this.restartGame.bind(this))
		document
			.getElementById('startButton')
			.addEventListener('click', this.restartGame.bind(this))
		document
			.getElementById('newGameButton')
			.addEventListener('click', () => this.openWindow('options'))
		document
			.getElementById('optionsButton')
			.addEventListener('click', () => this.openWindow('options'))

		// Focus trap: keep focus inside the visible modal while open
		this._focusInHandler = (e) => {
			if (!document.body.classList.contains('modal-open')) return
			// If focus is inside one of the visible modals, ok
			const target = e.target
			if (DOM.gameOptionsWindow.classList.contains('visible') && DOM.gameOptionsWindow.contains(target)) return
			if (DOM.gameOverWindow.classList.contains('visible') && DOM.gameOverWindow.contains(target)) return
			// Otherwise move focus to first focusable element inside the visible modal
			let container = DOM.gameOptionsWindow.classList.contains('visible') ? DOM.gameOptionsWindow : (DOM.gameOverWindow.classList.contains('visible') ? DOM.gameOverWindow : null)
			if (!container) return
			const focusable = container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
			if (focusable && focusable.length) {
				focusable[0].focus()
			}
		}
		document.addEventListener('focusin', this._focusInHandler)

		// EnableSeed toggle: when unchecked, disable seed input and copy button
		if (DOM.enableSeed) {
			// set initial UI state: show/hide seed option container
			if (DOM.seedOption) DOM.seedOption.style.display = DOM.enableSeed.checked ? 'flex' : 'none'
			if (DOM.copySeedButton) DOM.copySeedButton.disabled = !DOM.enableSeed.checked
			DOM.enableSeed.addEventListener('change', (e) => {
				const enabled = e.target.checked
				if (DOM.seedOption) DOM.seedOption.style.display = enabled ? 'flex' : 'none'
				if (DOM.copySeedButton) DOM.copySeedButton.disabled = !enabled
			})
		}

		document.getElementById('copySeedButton')
			.addEventListener('click', async () => {
				try {
					const val = (DOM.seedInput?.value || '').toString().trim()
					if (!val) {
						console.warn('Seed input is empty, nothing to copy')
						return
					}
					// Use Clipboard API if available
					let copied = false
					if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
						try {
							await navigator.clipboard.writeText(val)
							copied = true
						} catch (e) {
							// fall through to fallback
							copied = false
						}
					}

					if (copied) {
						showToast('Seed copied')
						console.log('Seed copied to clipboard')
					}

				} catch (e) {
					console.warn('Failed to copy seed to clipboard', e)
				}
			})

		document
			.getElementById('fullscreenButton')
			.addEventListener('click', () => this.toggleFullscreen())

		document.addEventListener('keypress', this.handleKeyPress.bind(this))
	},

	/**
	 * Handles global key press events.
	 * @param {KeyboardEvent} event
	 */
	handleKeyPress(event) {
		if (event.code === 'Space') {
			this.guessButtonClicked()
		}
		if (event.key === 'f' || event.key === 'Escape') {
			this.toggleFullscreen()
		}
	},

	/**
	 * Starts or restarts the game.
	 */
	async restartGame() {
		// Validate round count
		this.updateRoundCounter()



		// Validate difficulty range
		this.minDifficulty = Number(
			DOM.customDifficultyDiv.querySelector('#minDifficulty').value
		)
		this.maxDifficulty = Number(
			DOM.customDifficultyDiv.querySelector('#maxDifficulty').value
		)

		this.timerEnabled = document.getElementById('timerEnabled').checked
		if (this.timerEnabled) {
			this.timerLengthSeconds = Number(DOM.timerLengthInput.value)
		}

		// Close any open windows
		this.openWindow(null)

		const mapLoadingEl = document.getElementById('mapLoadingText')
		if (mapLoadingEl) mapLoadingEl.style.display = 'block'
		if (DOM.modalOverlay) DOM.modalOverlay.classList.add('visible')
		document.body.classList.add('modal-open')

		// Set the map for the selected game mode
		const selectedGameModeId = DOM.gameMode.value
		const gameMode = this.gameModeData[selectedGameModeId]
		try {
			if (
				gameMode &&
				gameMode.map &&
				gameMode.map.useCustomMap &&
				gameMode.map.mapUrl
			) {
				await GameMap.changeMapImage(gameMode.map.mapUrl)
			} else if (gameMode.map.defaultMap) {
				// Default map if not specified or custom map is turned off
				await GameMap.changeMapImage(gameMode.map.defaultMap)
			} else {
				await GameMap.changeMapImage(DEFAULT_MAP_URL)
			}
		} finally {
			if (mapLoadingEl) mapLoadingEl.style.display = 'none'
			// Only hide overlay if no modal window is visible and no loading texts are shown
			const anyWindowVisible =
				(DOM.gameOptionsWindow && DOM.gameOptionsWindow.classList.contains('visible')) ||
				(DOM.gameOverWindow && DOM.gameOverWindow.classList.contains('visible'))
			const imageLoadingVisible = document.getElementById('loadingText') && document.getElementById('loadingText').style.display !== 'none'
			const mapLoadingVisibleNow = mapLoadingEl && mapLoadingEl.style.display !== 'none'
			if (!anyWindowVisible && !imageLoadingVisible && !mapLoadingVisibleNow) {
				if (DOM.modalOverlay) DOM.modalOverlay.classList.remove('visible')
				document.body.classList.remove('modal-open')
			}
		}

		// Seed handling: accept any user-provided seed string when enabled.
		// If the user left the seed blank, generate a numeric seed (auto-generated seeds are numeric).
		let generatedSeed
		const seedInputVal = (DOM.seedInput?.value || '').toString().trim()
		if (DOM.enableSeed && DOM.enableSeed.checked) {
			if (seedInputVal) {
				// Use the exact user-provided string (allow any characters)
				this.seed = seedInputVal
			} else {
				// Generate a numeric seed and populate the input
				generatedSeed = ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) >>> 0
				this.seed = String(generatedSeed)
				if (DOM.seedInput) DOM.seedInput.value = this.seed
			}
			if (DOM.copySeedButton) DOM.copySeedButton.disabled = false
		} else {
			// Ephemeral numeric seed (not shown to user)
			generatedSeed = ((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) >>> 0
			this.seed = String(generatedSeed)
			if (DOM.seedInput) DOM.seedInput.value = ''
			if (DOM.copySeedButton) DOM.copySeedButton.disabled = true
		}
		// Create seeded RNG using the seed (string or numeric string are supported)
		try {
			this.rng = makeSeededRandom(this.seed)
		} catch (e) {
			console.warn('Failed to create seeded RNG, falling back to Math.random', e)
			this.rng = null
		}

		console.log(`Using seed: ${this.seed} (${DOM.enableSeed && DOM.enableSeed.checked ? 'user-provided or generated' : 'ephemeral'})`)
		seededIndicator.style.display = (DOM.enableSeed && DOM.enableSeed.checked) ? 'block' : 'none'
		// Build a deterministic play order (array of original indices) for the selected game mode and difficulty
		try {
			const selectedDifficulty = DOM.difficultySelector.value
			const filtered = this.filterByDifficulty(gameMode.locations, selectedDifficulty)
			if (!filtered || filtered.length === 0) {
				console.error('No locations available for the selected difficulty; cannot start game.')
				return
			}
			// Map to original indices in gameMode.locations
			const originalIndices = filtered.map((loc) => gameMode.locations.indexOf(loc))
			// Shuffle deterministically using the seeded RNG
			if (this.rng && typeof this.rng.shuffle === 'function') {
				this.playOrders[selectedGameModeId] = this.rng.shuffle(originalIndices.slice())
			} else {
				// Fallback to Math.random shuffle (non-deterministic)
				for (let i = originalIndices.length - 1; i > 0; i--) {
					const j = Math.floor(Math.random() * (i + 1))
					const tmp = originalIndices[i]
					originalIndices[i] = originalIndices[j]
					originalIndices[j] = tmp
				}
				this.playOrders[selectedGameModeId] = originalIndices
			}
			this.playOrderPointers[selectedGameModeId] = 0
		} catch (e) {
			console.warn('Failed to build deterministic play order:', e)
		}

		this.gameState = GAMESTATES.guessing
		this.totalScore = 0
		this.currentRound = 0


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
	 * Toggles the visibility of the custom difficulty selection div.
	 */
	toggleCustomDifficultyDisplay() {
		if (DOM.difficultySelector.value === 'custom') {
			DOM.customDifficultyDiv.style.display = 'flex'
		} else {
			DOM.customDifficultyDiv.style.display = 'none'
		}
	},

	/**
	 * Opens or closes game-related windows.
	 * @param {string|null} windowName - The name of the window to open ('options', 'gameover') or null to close all.
	 */
	openWindow(windowName) {
		// Close both and then animate the requested one open
		DOM.gameOptionsWindow.classList.remove('visible')
		DOM.gameOverWindow.classList.remove('visible')
		// Only remove modal state/overlay if no loading messages are visible
		const imageLoadingVisible = document.getElementById('loadingText') && document.getElementById('loadingText').style.display !== 'none'
		const mapLoadingVisible = document.getElementById('mapLoadingText') && document.getElementById('mapLoadingText').style.display !== 'none'
		if (!imageLoadingVisible && !mapLoadingVisible) {
			document.body.classList.remove('modal-open')
			// hide overlay initially
			if (DOM.modalOverlay) DOM.modalOverlay.classList.remove('visible')
		}
		switch (windowName) {
			case 'options':
				DOM.gameOptionsWindow.style.display = 'flex'
				setTimeout(() => DOM.gameOptionsWindow.classList.add('visible'), 10)
				this.gameState = GAMESTATES.optionsWindow
				document.getElementById('startButton').innerText = 'Start Game'
				document.body.classList.add('modal-open')
				if (DOM.modalOverlay) DOM.modalOverlay.classList.add('visible')
				// focus first input for quick keyboard flow
				if (DOM.gameMode) DOM.gameMode.focus()
				break
			case 'gameover':
				DOM.gameOverWindow.style.display = 'flex'
				setTimeout(() => DOM.gameOverWindow.classList.add('visible'), 10)
				this.gameState = GAMESTATES.gameOver // Ensure state is set for game over window
				document.body.classList.add('modal-open')
				if (DOM.modalOverlay) DOM.modalOverlay.classList.add('visible')
				// focus Play Again for immediate keyboard action
				const btn = document.getElementById('playAgainButton')
				if (btn) btn.focus()
				break
			default:
				// closing all - only remove modal state if no loading messages are visible
				const imageLoadingVisibleDefault = document.getElementById('loadingText') && document.getElementById('loadingText').style.display !== 'none'
				const mapLoadingVisibleDefault = document.getElementById('mapLoadingText') && document.getElementById('mapLoadingText').style.display !== 'none'
				if (!imageLoadingVisibleDefault && !mapLoadingVisibleDefault) {
					document.body.classList.remove('modal-open')
				}
		}
	},

	closeAllWindows() {
		DOM.gameOptionsWindow.classList.remove('visible')
		DOM.gameOverWindow.classList.remove('visible')
		// hide after animation completes
		setTimeout(() => {
			DOM.gameOptionsWindow.style.display = 'none'
			DOM.gameOverWindow.style.display = 'none'
			if (DOM.modalOverlay) DOM.modalOverlay.classList.remove('visible')
		}, 300)
		document.body.classList.remove('modal-open')
		this.gameState = GAMESTATES.guessing
	},

	/**
	 * Toggles the disabled state of the timer length input based on timer enabled checkbox.
	 * @param {HTMLInputElement} element - The timer enabled checkbox.
	 */
	timerInputDisplay(element) {
		if (element.checked) {
			if (DOM.timerLengthOption) DOM.timerLengthOption.style.display = 'flex'
			DOM.timerDisplay.style.display = 'block'
		} else {
			if (DOM.timerLengthOption) DOM.timerLengthOption.style.display = 'none'
			DOM.timerDisplay.style.display = 'none'
		}
	},

	/**
	 * Toggles fullscreen mode for the map container.
	 */
	toggleFullscreen() {
		if (GameManager.gameState === GAMESTATES.optionsWindow) return
		DOM.mapContainer.classList.toggle('fullscreen')
	},

	/**
	 * Handles the guess button click logic based on current game state.
	 */
	guessButtonClicked() {
		if (DOM.guessButton.disabled) return
		if (this.gameState === GAMESTATES.guessing) {
			// If no guess was made but timer ran out, set score to 0
			if (!GameMap.guessPosition) {
				this.roundScore = 0
			} else {
				this.calculateScore()
			}

			this.gameState = GAMESTATES.guessed
			DOM.guessButton.disabled = false

			// Show score display
			DOM.roundScoreDisplay.innerText = `You earned ${this.roundScore} points`
			DOM.roundScoreDisplay.style.display = 'block'

			// Adjust camera to show both guess and correct location
			if (GameMap.guessPosition && this.currentLocation) {
				GameMap.fitPointsInView(GameMap.guessPosition, {
					x: this.currentLocation[0],
					y: this.currentLocation[1],
				})
			} else if (this.currentLocation) {
				// If no guess, just zoom to correct location
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
				if (DOM.mapContainer.classList.contains('fullscreen')) {
					DOM.mapContainer.classList.remove('fullscreen')
				}
				this.nextRound()
				DOM.guessButton.disabled = true
				DOM.guessButton.innerText = 'Guess!'
			} else {
				// This handles the case where the user clicks "End Game"
				// after the last round is guessed.
				this.gameState = GAMESTATES.gameOver
				this.guessButtonClicked() // Recurse to trigger the gameOver logic
			}
		} else if (this.gameState === GAMESTATES.gameOver) {
			DOM.guessButton.disabled = true

			if (this.timerEnabled) {
				DOM.timerLengthDisplay.style.display = 'block'
				DOM.timerLengthDisplay.innerText = `Timer Length: ${this.timerLengthSeconds}s`
			} else {
				DOM.timerLengthDisplay.style.display = 'none'
			}
			this.openWindow('gameover')
			DOM.finalScoreDisplay.innerText = `Final Score: ${this.totalScore}/${this.totalRounds * this.maxScore
				}`
			let accuracyPercent = (
				(this.totalScore / (this.totalRounds * this.maxScore)) *
				100
			).toFixed(2)
			DOM.accuracyElement.innerText = `Accuracy: ${accuracyPercent}%`
			DOM.totalRoundsElement.innerText = `Total Rounds: ${this.totalRounds}`

			if (this.seed !== null) {
				DOM.seedDisplay.innerText = `Seed: ${this.seed}`
			}
		}
	},

	/**
	 * Sets the current game location.
	 * @param {number} i - The index of the location in the dataList.
	 * @param {string} gameMode - The current game mode.
	 */
	setLocation(i, gameMode) {
		this.imageIsLoaded = false
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
		DOM.locationImgElement.src = '' // Clear previous image
		DOM.locationImgElement.style.display = 'none'
		// Show image loading text and keep overlay visible while the image loads
		document.getElementById('loadingText').style.display = 'flex'
		if (DOM.modalOverlay) DOM.modalOverlay.classList.add('visible')
		document.body.classList.add('modal-open')
		DOM.loadingText.innerText = 'Loading image...'


		// Attach onload/onerror directly to the DOM image element to avoid double-downloads
		const domImg = DOM.locationImgElement
		// Clear previous handlers to avoid leaks or duplicate calls
		domImg.onload = null
		domImg.onerror = null

		domImg.onload = () => {
			this.imageIsLoaded = true
			document.getElementById('loadingText').style.display = 'none'
			domImg.style.display = 'block'
			// src is already set below; ensure we don't reassign unnecessarily

			// Only hide overlay if no windows or other loading messages are visible
			const mapLoadingEl = document.getElementById('mapLoadingText')
			const anyWindowVisible =
				(DOM.gameOptionsWindow && DOM.gameOptionsWindow.classList.contains('visible')) ||
				(DOM.gameOverWindow && DOM.gameOverWindow.classList.contains('visible'))
			const mapLoadingVisibleNow = mapLoadingEl && mapLoadingEl.style.display !== 'none'
			if (!anyWindowVisible && !mapLoadingVisibleNow) {
				if (DOM.modalOverlay) DOM.modalOverlay.classList.remove('visible')
				document.body.classList.remove('modal-open')
			}
			if (GameMap.guessPosition) {
				// Only enable guess button if a guess was made
				DOM.guessButton.disabled = false
			}
			if (this.timerEnabled) {
				this.endTime = performance.now() + this.timerLengthSeconds * 1000
			}
		}

		domImg.onerror = (e) => {
			console.error('Failed to load location image:', {
				path: imgSrc,
				error: e,
			})
			document.getElementById('loadingText').style.display = 'none'
			// hide overlay if map isn't loading and no windows are visible
			const mapLoadingEl = document.getElementById('mapLoadingText')
			const anyWindowVisible =
				(DOM.gameOptionsWindow && DOM.gameOptionsWindow.classList.contains('visible')) ||
				(DOM.gameOverWindow && DOM.gameOverWindow.classList.contains('visible'))
			const mapLoadingVisibleNow = mapLoadingEl && mapLoadingEl.style.display !== 'none'
			if (!anyWindowVisible && !mapLoadingVisibleNow) {
				if (DOM.modalOverlay) DOM.modalOverlay.classList.remove('visible')
				document.body.classList.remove('modal-open')
			}
		}

		// Start loading into the visible DOM image (single network request)
		domImg.src = imgSrc
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
	 */
	nextRound() {

		// Hide score display for the new round
		DOM.roundScoreDisplay.style.display = 'none'

		this.gameState = GAMESTATES.guessing
		GameMap.resetCamera() // Reset map camera for new round
		this.currentRound++
		this.updateRoundCounter()

		const selectedGameMode = DOM.gameMode.value // Assuming DOM.gameMode exists
		const dataList = this.gameModeData[selectedGameMode]?.locations // Use this.gameModeData
		if (!dataList) {
			console.error(
				'No locations found for selected game mode:',
				selectedGameMode
			)
			this.gameState = GAMESTATES.gameOver // End game if no data
			this.guessButtonClicked()
			return
		}

		const usedList = this.usedLocations[selectedGameMode]
		// Defensive check: Ensure usedList is initialized for this game mode
		if (!usedList) {
			console.error(
				`usedLocations for game mode '${selectedGameMode}' is not initialized. Ending game.`
			)
			this.gameState = GAMESTATES.gameOver
			this.guessButtonClicked()
			return
		}

		const selectedDifficulty = DOM.difficultySelector.value
		const filteredDataList = this.filterByDifficulty(dataList, selectedDifficulty)

		if (filteredDataList.length === 0) {
			console.error(
				'No locations available for the selected difficulty and game mode.'
			)
			this.gameState = GAMESTATES.gameOver
			this.guessButtonClicked()
			return
		}

		// Reset used locations if all filtered locations have been used
		if (usedList.length >= filteredDataList.length) {
			usedList.length = 0
			console.log(
				'All filtered locations used, resetting used list for this game mode.'
			)
		}

		// Get available indices from the filtered list (indices relative to filteredDataList)
		const availableIndices = filteredDataList
			.map((_, i) => i)
			.filter((i) => !usedList.includes(i))

		if (availableIndices.length === 0) {
			console.error(
				'No new available locations found after filtering and checking used list.'
			)
			this.gameState = GAMESTATES.gameOver
			this.guessButtonClicked()
			return
		}

		// If a deterministic playOrder exists for this mode, use it (ensures same seed -> same order)
		const playOrder = this.playOrders[selectedGameMode]
		if (playOrder && playOrder.length > 0) {
			let ptr = this.playOrderPointers[selectedGameMode] || 0
			const originalIndex = playOrder[ptr % playOrder.length]
			this.playOrderPointers[selectedGameMode] = ptr + 1
			// Mark used for backward compatibility (index relative to filteredDataList)
			const relativeIndex = filteredDataList.indexOf(dataList[originalIndex])
			if (relativeIndex !== -1) usedList.push(relativeIndex)
			this.setLocation(originalIndex, selectedGameMode)
			DOM.guessButton.disabled = true
			GameMap.guessPosition = null
			if (this.timerEnabled) {
				this.endTime = performance.now() + this.timerLengthSeconds * 1000
			}
			return
		}

		// Select a random index from the available filtered indices (fallback)
		let chooserIndex
		if (this.rng) {
			chooserIndex = this.rng.randIRange(0, availableIndices.length - 1)
		} else {
			chooserIndex = randIRange(0, availableIndices.length - 1)
		}
		const newLocationFilteredIndex = availableIndices[chooserIndex]
		usedList.push(newLocationFilteredIndex) // Mark this index (relative to filtered list) as used

		// Get the actual location object from the filtered list
		const newLocation = filteredDataList[newLocationFilteredIndex]

		// Find its index in the ORIGINAL dataList to pass to setLocation
		const originalIndex = dataList.indexOf(newLocation)
		if (originalIndex === -1) {
			console.error(
				'Could not find new location in original dataList. This should not happen.'
			)
			this.gameState = GAMESTATES.gameOver
			this.guessButtonClicked()
			return
		}

		this.setLocation(originalIndex, selectedGameMode)

		DOM.guessButton.disabled = true
		GameMap.guessPosition = null // Clear guess for new round

		// Reset and start the timer
		if (this.timerEnabled) {
			this.endTime = performance.now() + this.timerLengthSeconds * 1000
		}
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
		this.roundScore =
			this.maxScore * Math.exp(-dropOffRate * (distance - leniency))
		this.roundScore = Math.round(Math.min(this.roundScore, this.maxScore))
		this.totalScore += this.roundScore
	},

	validaiteForm() {
		this.hideFormWarning()
		let formValid = true
		if (DOM.timerEnabled.checked) {
			if (
				Number(DOM.timerLengthInput.value) <= 0 ||
				isNaN(DOM.timerLengthInput.value)
			) {
				this.displayFormMessage(
					'Please use a valid number for timer length (greater than 0).'
				)
				formValid = false
			}
		}

		if (
			Number(DOM.roundCountInput.value) <= 0 ||
			isNaN(DOM.roundCountInput.value)
		) {
			this.displayFormMessage(
				'Please use a valid number for rounds (greater than 0).'
			)
			formValid = false
		}
		if (DOM.difficultySelector.value === 'custom') {
			if (
				Number(DOM.minDifficultyInput.value) <= 0 ||
				Number(DOM.minDifficultyInput.value) > 10 ||
				isNaN(Number(DOM.minDifficultyInput.value))
			) {
				this.displayFormMessage(
					'Please use a valid number for minimum difficulty (1-10).'
				)
				formValid = false
			}

			if (
				Number(DOM.maxDifficultyInput.value) <= 0 ||
				Number(DOM.maxDifficultyInput.value) > 10 ||
				isNaN(Number(DOM.maxDifficultyInput.value))
			) {
				this.displayFormMessage(
					'Please use a valid number for maximum difficulty (1-10).'
				)
				formValid = false
			}

			if (
				Number(DOM.minDifficultyInput.value) >
				Number(DOM.maxDifficultyInput.value)
			) {
				this.displayFormMessage(
					'Minimum difficulty cannot be greater than maximum difficulty.'
				)
				formValid = false
			}
		}

		// Seed validation + easter eggs
		if (DOM.enableSeed && DOM.enableSeed.checked) {
			const seedVal = (DOM.seedInput?.value || '').toString().trim()

			const disallowedBrainrot = [
				'brainrot',
				'skibidi',
				'rizz',
				'gyatt',
				'fanum',
				'sigma',
				'delulu',
				'Ohio',
				'6-7',
				'6_7',
				'6.7',
				'sixseven',
				'six-seven',
				'aura',
				'sybau',
				'cringe',
				'NPC',
				'glazing',
				'mewing',
				'zesty',
				'nocap',
				'ong',
				'bussin',

			];

			if (seedVal.length <= 0) {
				this.displayFormMessage('Seed cannot be empty.')
				formValid = false
			}

			// Disallow seeds with spaces
			if (seedVal.includes(' ')) {
				this.displayFormMessage('Seed cannot contain spaces.')
				formValid = false
			}
			// Disallow seeds longer than 100 characters 
			if (seedVal.length > 100) {
				this.displayFormMessage('Seed cannot be longer than 100 characters.')
				formValid = false

			}
			// Disallow brainrot
			//
			if (
				disallowedBrainrot.some(word => seedVal.toLowerCase().includes(word.toLowerCase())) ||
				seedVal === '67'
			) {
				this.displayFormMessage('Seed cannot contain brainrot.')
				formValid = false
			}

			if (seedVal === '69') {
				this.displayFormMessage('Nice.')
			}


			if (seedVal.toLowerCase().includes('yalikejazz')) {
				this.displayFormMessage(egg) 
			}

			if (seedVal.toLowerCase().includes('biticalifi')) {
				this.displayFormMessage('Seed cannot contain cool people.')
				formValid = false
			}

			if (seedVal === 'rickroll') {
				this.displayFormMessage('gottem')
				window.open('https://www.youtube.com/watch?v=dQw4w9WgXcQ', '_blank')
			}

			if (seedVal.toLowerCase().includes('squirrel')) {
				this.displayFormMessage('🐿️')
			}

			if (seedVal.toLowerCase().includes('dawndishsoap')) {
				this.displayFormMessage('<img src="images/soap.jpeg" style="width:100%; border-radius:8px;" alt="dawn dish soap" />')
			}


		}

		if (formValid) {
			DOM.startButton.style.pointerEvents = 'auto'
			DOM.startButton.style.opacity = '1'
		} else {
			DOM.startButton.style.pointerEvents = 'none'
			DOM.startButton.style.opacity = '0.5'
		}
	},
	displayFormMessage(string) {
		DOM.formWarning.innerHTML = string
		DOM.formWarning.style.display = 'block'
	},
	hideFormWarning() {
		DOM.formWarning.style.display = 'none'
	},
}

function initializeDOM() {
	DOM.customDifficultyDiv = document.getElementById('customDifficultyDiv')
	DOM.difficultySelector = document.getElementById('difficultySelector')
	DOM.roundCountInput = document.getElementById('roundCount')
	DOM.timerLengthInput = document.getElementById('timerLength')

	DOM.accuracyElement = document.getElementById('accuracy')
	DOM.finalScoreDisplay = document.getElementById('finalScore')
	DOM.gameOverWindow = document.getElementById('gameOverWindow')
	DOM.gameOptionsWindow = document.getElementById('gameOptionsWindow')
	DOM.loadingText = document.getElementById('loadingText')
	DOM.roundElement = document.getElementById('round')
	DOM.timerDisplay = document.getElementById('timerDisplay')
	DOM.totalRoundsElement = document.getElementById('totalRounds')
	DOM.timerLengthDisplay = document.getElementById('timerLengthDisplay')
	DOM.newGameButton = document.getElementById('newGameButton')
	DOM.startButton = document.getElementById('startButton')
	DOM.timerEnabled = document.getElementById('timerEnabled')
	DOM.minDifficultyInput = document.getElementById('minDifficulty')
	DOM.maxDifficultyInput = document.getElementById('maxDifficulty')
	DOM.minDifficultyValue = document.getElementById('minDifficultyValue')
	DOM.maxDifficultyValue = document.getElementById('maxDifficultyValue')
	DOM.formWarning = document.getElementById('formWarning')

	DOM.guessButton = document.getElementById('guessButton')
	DOM.locationImgElement = document.getElementById('locationImg')
	DOM.mapCanvas = document.getElementById('mapCanvas')
	DOM.mapContainer = document.getElementById('mapContainer')
	DOM.roundScoreDisplay = document.getElementById('roundScoreDisplay')
	DOM.minimiseButton = document.getElementById('minimiseButton')
	DOM.gameMode = document.getElementById('gameMode')
	DOM.minimiseIcon = document.getElementById('minimiseIcon')
	DOM.fullscreenButton = document.getElementById('fullscreenButton')
	DOM.seedInput = document.getElementById('seedInput')
	DOM.copySeedButton = document.getElementById('copySeedButton')
	DOM.seedDisplay = document.getElementById('seedDisplay')
	DOM.enableSeed = document.getElementById('enableSeed')
	DOM.seedOption = document.getElementById('seedOption')
	DOM.timerLengthOption = document.getElementById('timerLengthOption')
	DOM.modalOverlay = document.getElementById('modalOverlay')
	DOM.seededIndicator = document.getElementById('seededIndicator')
}

// Main entry point for the game
async function main() {
	initializeDOM()
	const gameData = await loadInitialData()
	GameManager.init(gameData)
}

document.addEventListener('DOMContentLoaded', main)
