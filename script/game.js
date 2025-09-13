import { GameMap } from './GameMap.js'
import { randIRange, isNumber } from './Utils.js'
import { loadInitialData } from './loadLocationData.js'
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
	init(gameData) {
		this.gameModeData = gameData;

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

		// Set initial location for display in options window
		// Use the currently selected game mode from the DOM, or fallback to the first loaded one.
		const firstGameModeId = 'normal'
		if (
			firstGameModeId &&
			this.gameModeData[firstGameModeId]?.locations?.length > 0
		) {
			this.setLocation(
				randIRange(0, this.gameModeData[firstGameModeId].locations.length - 1),
				firstGameModeId
			)
		} else {
			console.warn(
				'No initial game mode data found. Ensure default packs are loaded.'
			)
			// Potentially disable game start or show an error message to the user
		}

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

		DOM.guessButton.addEventListener(
			'click',
			this.guessButtonClicked.bind(this)
		)
		DOM.showMapButton.addEventListener('click', () =>
			this.setMinimapVisible(true)
		)
		DOM.minimiseButton.addEventListener('click', () =>
			this.setMinimapVisible(false)
		)

		DOM.timerEnabled.addEventListener(
			'change',
			(event) => {
				this.timerInputDisplay(event.target)
				this.validaiteForm()
			},
			DOM.minDifficultyInput.addEventListener(
				'input',
				this.validaiteForm.bind(this)
			)
		),
			DOM.maxDifficultyInput.addEventListener(
				'input',
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

		document
			.getElementById('gameMode')
			.addEventListener('change', this.onGameModeChange.bind(this))

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
	 * Handles when the game mode is changed in the options.
	 * It updates the map image if the new pack has a custom map.
	 */
	async onGameModeChange() {
		const selectedGameModeId = DOM.gameMode.value
		const gameMode = this.gameModeData[selectedGameModeId]

		if (
			gameMode &&
			gameMode.map &&
			gameMode.map.useCustomMap &&
			gameMode.map.mapUrl
		) {
			await GameMap.changeMapImage(gameMode.map.mapUrl)
		} else {
			await GameMap.changeMapImage(DEFAULT_MAP_URL) // default
		}

		// Update the background location image for the options screen
		if (gameMode?.locations?.length > 0) {
			this.setLocation(
				randIRange(0, gameMode.locations.length - 1),
				selectedGameModeId
			)
		}
	},

	/**
	 * Starts or restarts the game.
	 */
	async restartGame() {
		document.getElementById('startButton').innerText = 'Loading Map...'
		// Validate round count
		this.updateRoundCounter()

		// Validate difficulty range
		this.minDifficulty = Number(
			DOM.customDifficultyDiv.querySelector('#minDifficulty').value
		)
		this.maxDifficulty = Number(
			DOM.customDifficultyDiv.querySelector('#maxDifficulty').value
		)
		if (this.minDifficulty > this.maxDifficulty) {
			console.error(
				'Minimum difficulty cannot be greater than maximum difficulty.'
			)
			// Consider adding a simple UI message instead of just console.error
			return
		}

		this.timerEnabled = document.getElementById('timerEnabled').checked
		if (this.timerEnabled) {
			this.timerLengthSeconds = Number(DOM.timerLengthInput.value)
		}

		// Set the map for the selected game mode
		const selectedGameModeId = DOM.gameMode.value
		const gameMode = this.gameModeData[selectedGameModeId]
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

		this.gameState = GAMESTATES.guessing
		this.totalScore = 0
		this.currentRound = 0

		this.openWindow(null) // Close all windows
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
		DOM.gameOptionsWindow.style.display = 'none'
		DOM.gameOverWindow.style.display = 'none'
		switch (windowName) {
			case 'options':
				DOM.gameOptionsWindow.style.display = 'flex'
				this.gameState = GAMESTATES.optionsWindow
				document.getElementById('startButton').innerText = 'Start Game'
				break
			case 'gameover':
				DOM.gameOverWindow.style.display = 'flex'
				this.gameState = GAMESTATES.gameOver // Ensure state is set for game over window
				break
		}
	},

	/**
	 * Sets the visibility of the minimap container.
	 * @param {boolean} visible - True to show, false to hide.
	 */
	setMinimapVisible(visible) {
		if (visible) {
			DOM.mapContainer.style.display = 'flex'
			DOM.showMapButton.style.display = 'none'
		} else {
			DOM.mapContainer.style.display = 'none'
			DOM.showMapButton.style.display = 'flex'
		}
	},

	/**
	 * Toggles the disabled state of the timer length input based on timer enabled checkbox.
	 * @param {HTMLInputElement} element - The timer enabled checkbox.
	 */
	timerInputDisplay(element) {
		if (element.checked) {
			DOM.timerLengthInput.disabled = false
			DOM.timerDisplay.style.display = 'block'
		} else {
			DOM.timerLengthInput.disabled = true
			DOM.timerDisplay.style.display = 'none'
		}
	},

	/**
	 * Toggles fullscreen mode for the map container.
	 */
	toggleFullscreen() {
		DOM.mapContainer.classList.toggle('fullscreen')
	},
	enableFullscreen() {
		DOM.mapContainer.classList.add('fullscreen')
	},
	disableFullscreen() {
		DOM.mapContainer.classList.remove('fullscreen')
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
		DOM.loadingText.style.display = 'flex'

		const img = new Image()
		img.onload = () => {
			this.imageIsLoaded = true
			DOM.loadingText.style.display = 'none'
			DOM.locationImgElement.style.display = 'block'
			DOM.locationImgElement.src = imgSrc
			if (GameMap.guessPosition) {
				// Only enable guess button if a guess was made
				DOM.guessButton.disabled = false
			}
			if (this.timerEnabled) {
				this.endTime = performance.now() + this.timerLengthSeconds * 1000
			}
		}
		img.onerror = (e) => {
			console.error('Failed to load location image:', {
				path: imgSrc,
				error: e,
			})
			DOM.loadingText.style.display = 'none'
		}
		img.src = imgSrc
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
		const filteredDataList = this.filterByDifficulty(
			dataList,
			selectedDifficulty
		)

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

		// Select a random index from the available filtered indices
		const newLocationFilteredIndex =
			availableIndices[randIRange(0, availableIndices.length - 1)]
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
		console.log('Form Valdating')
		this.hideFormWarning()
		let formValid = true
		if (DOM.timerEnabled.checked) {
			if (
				Number(DOM.timerLengthInput.value) <= 0 ||
				isNaN(DOM.timerLengthInput.value)
			) {
				this.displayFormWarning(
					'Please use a valid number for timer length (greater than 0).'
				)
				formValid = false
			}
		}

		if (
			Number(DOM.roundCountInput.value) <= 0 ||
			isNaN(DOM.roundCountInput.value)
		) {
			this.displayFormWarning(
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
				this.displayFormWarning(
					'Please use a valid number for minimum difficulty (1-10).'
				)
				formValid = false
			}

			if (
				Number(DOM.maxDifficultyInput.value) <= 0 ||
				Number(DOM.maxDifficultyInput.value) > 10 ||
				isNaN(Number(DOM.maxDifficultyInput.value))
			) {
				this.displayFormWarning(
					'Please use a valid number for maximum difficulty (1-10).'
				)
				formValid = false
			}

			if (
				Number(DOM.minDifficultyInput.value) >
				Number(DOM.maxDifficultyInput.value)
			) {
				this.displayFormWarning(
					'Minimum difficulty cannot be greater than maximum difficulty.'
				)
				formValid = false
			}
		}
		console.log('Form Valid: ', formValid)
		if (formValid) {
			DOM.startButton.disabled = false
		} else {
			DOM.startButton.disabled = true
		}
	},
	displayFormWarning(string) {
		DOM.formWarning.innerText = string
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
	DOM.formWarning = document.getElementById('formWarning')

	DOM.guessButton = document.getElementById('guessButton')
	DOM.locationImgElement = document.getElementById('locationImg')
	DOM.mapCanvas = document.getElementById('mapCanvas')
	DOM.mapContainer = document.getElementById('mapContainer')
	DOM.roundScoreDisplay = document.getElementById('roundScoreDisplay')
	DOM.showMapButton = document.getElementById('showMapButton')
	DOM.minimiseButton = document.getElementById('minimiseButton')
	DOM.gameMode = document.getElementById('gameMode')
}

// Main entry point for the game
async function main() {
	initializeDOM();
	const gameData = await loadInitialData();
	GameManager.init(gameData);
}

document.addEventListener('DOMContentLoaded', main);
