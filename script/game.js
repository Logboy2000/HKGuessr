import { GameMap } from './GameMap.js'
import { randIRange, isNumber, makeSeededRandom } from './Utils.js'
import { loadInitialData } from './loadLocationData.js'
import { MultipleChoice } from './multipleChoice.js'
import { egg } from './egg.js'
///////////////////////////////////////////////
////// Geoguessr Clone for Hollow Knight //////
///////////////////////////////////////////////

//BEWARE THIS SOURCE CODE IS NOW LESS OF AN ABSOLUTE MESS THAN IT USED TO BE//

export const DEFAULT_MAP_URL = 'images/game/defaultMaps/hallownest.png'
export const mc = new MultipleChoice(document.getElementById('packChoices'))
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
			} catch (e) {
				/* ignore */
			}
		}, duration)
	} catch (e) {
		console.log('Toast failed', e)
	}
}

export const DIFFICULTRANGE = {
	easy: { min: 1, max: 4 },
	normal: { min: 4, max: 7 },
	hard: { min: 7, max: 10 },
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
		this.setLocation(
			randIRange(0, this.gameModeData.normal.locations.length),
			'normal'
		)

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
		document
			.getElementById('packSelectBackButton')
			.addEventListener('click', () => {
				this.openWindow('options')
			})
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
			this.toggleMinimise()
		})

		DOM.timerEnabled.addEventListener('change', (event) => {
			this.timerInputDisplay(event.target)
			this.validaiteForm()
		}),
			DOM.minDifficultyInput.addEventListener(
				'input',
				this.validaiteForm.bind(this)
			),
			DOM.maxDifficultyInput.addEventListener(
				'input',
				this.validaiteForm.bind(this)
			),
			DOM.enableSeed.addEventListener('change', this.validaiteForm.bind(this))

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
		document
			.getElementById('changePacksButton')
			.addEventListener('click', () => this.openWindow('packChoices'))

		// Focus trap: keep focus inside the visible modal while open
		this._focusInHandler = (e) => {
			if (!document.body.classList.contains('modal-open')) return
			// If focus is inside one of the visible modals, ok
			const target = e.target
			if (
				DOM.gameOptionsWindow.classList.contains('visible') &&
				DOM.gameOptionsWindow.contains(target)
			)
				return
			if (
				DOM.gameOverWindow.classList.contains('visible') &&
				DOM.gameOverWindow.contains(target)
			)
				return
			// Otherwise move focus to first focusable element inside the visible modal
			let container = DOM.gameOptionsWindow.classList.contains('visible')
				? DOM.gameOptionsWindow
				: DOM.gameOverWindow.classList.contains('visible')
				? DOM.gameOverWindow
				: null
			if (!container) return
			const focusable = container.querySelectorAll(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			)
			if (focusable && focusable.length) {
				focusable[0].focus()
			}
		}
		document.addEventListener('focusin', this._focusInHandler)

		// EnableSeed toggle: when unchecked, disable seed input and copy button
		if (DOM.enableSeed) {
			// set initial UI state: show/hide seed option container
			if (DOM.seedOption)
				DOM.seedOption.style.display = DOM.enableSeed.checked ? 'flex' : 'none'
			if (DOM.copySeedButton)
				DOM.copySeedButton.disabled = !DOM.enableSeed.checked
			DOM.enableSeed.addEventListener('change', (e) => {
				const enabled = e.target.checked
				if (DOM.seedOption)
					DOM.seedOption.style.display = enabled ? 'flex' : 'none'
				if (DOM.copySeedButton) DOM.copySeedButton.disabled = !enabled
			})
		}

		document
			.getElementById('copySeedButton')
			.addEventListener('click', async () => {
				try {
					const val = (DOM.seedInput?.value || '').toString().trim()
					if (!val) {
						console.warn('Seed input is empty, nothing to copy')
						return
					}
					// Use Clipboard API if available
					let copied = false
					if (
						navigator.clipboard &&
						typeof navigator.clipboard.writeText === 'function'
					) {
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

		DOM.changePacksButton.addEventListener('click', () => {
			this.openWindow('packChoices')
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
	},

	/**
	 * Starts or restarts the game.
	 */
	async restartGame() {
		this.updateRoundCounter()

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

		const mapLoadingEl = document.getElementById('mapLoadingText')
		if (mapLoadingEl) mapLoadingEl.style.display = 'block'
		DOM.modalOverlay?.classList.add('visible')
		document.body.classList.add('modal-open')

		// --- MULTI-MODE SELECTION ---
		const selectedGameModeIds = mc.getSelected()
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

		// Close any open windows
		this.openWindow(null)

		// Load the map image for the *first* valid mode
		try {
			const firstMode = validGameModes[0]
			const mapUrl =
				firstMode.map?.useCustomMap && firstMode.map?.mapUrl
					? firstMode.map.mapUrl
					: firstMode.map?.defaultMap || DEFAULT_MAP_URL

			await GameMap.changeMapImage(mapUrl)
		} finally {
			if (mapLoadingEl) mapLoadingEl.style.display = 'none'
			const anyWindowVisible =
				DOM.gameOptionsWindow?.classList.contains('visible') ||
				DOM.gameOverWindow?.classList.contains('visible')
			const imageLoadingVisible =
				document.getElementById('loadingText')?.style.display !== 'none'
			const mapLoadingVisibleNow = mapLoadingEl?.style.display !== 'none'
			if (!anyWindowVisible && !imageLoadingVisible && !mapLoadingVisibleNow) {
				DOM.modalOverlay?.classList.remove('visible')
				document.body.classList.remove('modal-open')
			}
		}

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
			DOM.copySeedButton && (DOM.copySeedButton.disabled = false)
		} else {
			generatedSeed =
				((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0) >>> 0
			this.seed = String(generatedSeed)
			if (DOM.seedInput) DOM.seedInput.value = ''
			DOM.copySeedButton && (DOM.copySeedButton.disabled = true)
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

		console.log(`Using seed: ${this.seed}`)
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

		this.gameState = GAMESTATES.guessing
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
		DOM.packSelectWindow.classList.remove('visible')
		// Only remove modal state/overlay if no loading messages are visible
		const imageLoadingVisible =
			document.getElementById('loadingText') &&
			document.getElementById('loadingText').style.display !== 'none'
		const mapLoadingVisible =
			document.getElementById('mapLoadingText') &&
			document.getElementById('mapLoadingText').style.display !== 'none'
		if (!imageLoadingVisible && !mapLoadingVisible) {
			document.body.classList.remove('modal-open')
			// hide overlay initially
			if (DOM.modalOverlay) DOM.modalOverlay.classList.remove('visible')
		}
		switch (windowName) {
			case 'options':
				DOM.gameOptionsWindow.style.display = 'flex'
				this.updateSelectedPacksDisplay()
				setTimeout(() => DOM.gameOptionsWindow.classList.add('visible'), 10)
				this.gameState = GAMESTATES.optionsWindow
				document.getElementById('startButton').innerText = 'Start Game'
				document.body.classList.add('modal-open')
				if (DOM.modalOverlay) DOM.modalOverlay.classList.add('visible')
				// focus first input for quick keyboard flow
				if (DOM.gameMode) DOM.gameMode.focus()
				this.validaiteForm()
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
			case 'packChoices':
				DOM.packSelectWindow.style.display = 'flex'
				setTimeout(() => DOM.packSelectWindow.classList.add('visible'), 10)
				this.gameState = GAMESTATES.optionsWindow
				document.body.classList.add('modal-open')
				if (DOM.modalOverlay) DOM.modalOverlay.classList.add('visible')
				// focus first input for quick keyboard flow
				if (DOM.changePacksButton) DOM.changePacksButton.focus()
				break
			default:
				// closing all - only remove modal state if no loading messages are visible
				const imageLoadingVisibleDefault =
					document.getElementById('loadingText') &&
					document.getElementById('loadingText').style.display !== 'none'
				const mapLoadingVisibleDefault =
					document.getElementById('mapLoadingText') &&
					document.getElementById('mapLoadingText').style.display !== 'none'
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

	toggleMinimise() {
		if (DOM.minimiseIcon.classList.contains('rotate180')) {
			DOM.minimiseIcon.classList.remove('rotate180')
			DOM.mapCanvas.classList.remove('minimise')
			DOM.mapContainer.classList.remove('minimise')
		} else {
			DOM.minimiseIcon.classList.add('rotate180')
			DOM.mapCanvas.classList.add('minimise')
			DOM.mapContainer.classList.add('minimise')
		}
	},

	/**
	 * Handles the guess button click logic based on current game state.
	 */
	guessButtonClicked() {
		if (DOM.guessButton.disabled) return

		if (this.gameState === GAMESTATES.guessing) {
			this.calculateScore()
			this.gameState = GAMESTATES.guessed
			DOM.guessButton.disabled = false

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

			if (this.timerEnabled) {
				DOM.timerLengthDisplay.style.display = 'block'
				DOM.timerLengthDisplay.innerText = `Timer Length: ${this.timerLengthSeconds}s`
			} else {
				DOM.timerLengthDisplay.style.display = 'none'
			}

			this.openWindow('gameover')
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
		// Hide image and apply blur while loading
		DOM.locationImgElement.classList.add('hideLocationImg')
		document.getElementById('blurBg').classList.add('hideLocationImg')
		DOM.locationImgElement.style.opacity = '0'
		DOM.locationImgElement.style.transition = 'opacity 0.4s ease'

		// Show image loading text and keep overlay visible while the image loads
		document.getElementById('loadingText').style.display = 'flex'
		if (DOM.modalOverlay) DOM.modalOverlay.classList.add('visible')
		document.body.classList.add('modal-open')

		// Attach onload/onerror directly to the DOM image element to avoid double-downloads
		const domImg = DOM.locationImgElement
		// Clear previous handlers to avoid leaks or duplicate calls
		domImg.onload = null
		domImg.onerror = null

		domImg.onload = () => {
			this.imageIsLoaded = true
			document.getElementById('loadingText').style.display = 'none'
			domImg.style.display = 'block'
			// Fade in the image and remove blur
			setTimeout(() => {
				domImg.style.opacity = '1'
				domImg.classList.remove('hideLocationImg')
				document.getElementById('blurBg').classList.remove('hideLocationImg')
			}, 10)

			// Only hide overlay if no windows or other loading messages are visible
			const mapLoadingEl = document.getElementById('mapLoadingText')
			const anyWindowVisible =
				(DOM.gameOptionsWindow &&
					DOM.gameOptionsWindow.classList.contains('visible')) ||
				(DOM.gameOverWindow && DOM.gameOverWindow.classList.contains('visible'))
			const mapLoadingVisibleNow =
				mapLoadingEl && mapLoadingEl.style.display !== 'none'
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
				(DOM.gameOptionsWindow &&
					DOM.gameOptionsWindow.classList.contains('visible')) ||
				(DOM.gameOverWindow && DOM.gameOverWindow.classList.contains('visible'))
			const mapLoadingVisibleNow =
				mapLoadingEl && mapLoadingEl.style.display !== 'none'
			if (!anyWindowVisible && !mapLoadingVisibleNow) {
				if (DOM.modalOverlay) DOM.modalOverlay.classList.remove('visible')
				document.body.classList.remove('modal-open')
			}
		}

		// Start loading into the visible DOM image (single network request)
		document.getElementById('locationImg').src = imgSrc
		document.getElementById('blurBg').style.backgroundImage = `url(${imgSrc})`
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

		this.gameState = GAMESTATES.guessing
		GameMap.resetCamera()
		this.currentRound++
		this.updateRoundCounter()

		const selectedGameModes = mc.getSelected()
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
			console.warn('No available locations left. Resetting and repeating locations.')
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
			await GameMap.changeMapImage(newMapUrl)
		}

		// Set and start the round
		this.startRoundWithLocation(originalIndex, modeId)
	},

	/**
	 * Helper: Starts a round from a chosen location index.
	 */
	startRoundWithLocation(originalIndex, gameMode) {
		this.setLocation(originalIndex, gameMode)
		DOM.guessButton.disabled = true
		GameMap.guessPosition = null

		if (this.timerEnabled) {
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
		this.roundScore = Math.round(
			this.maxScore * Math.exp(-dropOffRate * (distance - leniency))
		)
		this.totalScore += this.roundScore
	},

	validaiteForm() {
		this.hideFormWarning()
		let formValid = true
		if (mc.getSelected().length === 0) {
			this.displayFormMessage('Please select at least one image pack.')
			formValid = false
		}

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
			]

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
				disallowedBrainrot.some((word) =>
					seedVal.toLowerCase().includes(word.toLowerCase())
				) ||
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
				this.displayFormMessage(
					'<img src="images/soap.jpeg" style="width:100%; border-radius:8px;" alt="dawn dish soap" />'
				)
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

	/**
	 * Updates the list of selected packs displayed on the options screen.
	 */
	updateSelectedPacksDisplay() {
		const listContainer = document.getElementById('selected-packs-list')
		if (!listContainer) return

		const selectedOptions = mc.getSelectedOptions()
		listContainer.innerHTML = selectedOptions
			.map((option) => `<span class="pack-tag">${option.label}</span>`)
			.join(' ') // Join with a space for proper wrapping
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
	DOM.packSelectWindow = document.getElementById('packSelectWindow')
	DOM.packChoices = document.getElementById('packChoices')
	DOM.changePacksButton = document.getElementById('changePacksButton')
}

// Main entry point for the game
async function main() {
	initializeDOM()
	const gameData = await loadInitialData()
	GameManager.init(gameData)
}

document.addEventListener('DOMContentLoaded', main)
