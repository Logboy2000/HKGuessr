import { GameMap } from './GameMap.js'
import { randIRange } from './Utils.js'
///////////////////////////////////////////////
////// Geoguessr Clone for Hollow Knight //////
///////////////////////////////////////////////

//BEWARE THIS SOURCE CODE IS NOW LESS OF AN ABSOLUTE MESS THAN IT USED TO BE//

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
// Properties are assigned in dataLoaded().
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
	init() {
		// IMPORTANT: Copy the global gameModeData into GameManager's internal state
		// This ensures GameManager has access to all loaded data and can initialize its usedLocations.
		// This line must execute AFTER loadLocationData has populated the global `gameModeData`.
		this.gameModeData = window.gameModeData // Use window.gameModeData for clarity
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
		this.gameModeData[gameModeId] = data // Changed to use this.gameModeData
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
					GameMap.updateGuessPos(
						GameMap.mouseXRelative,
						GameMap.mouseYRelative
					)
				}
				GameManager.guessButtonClicked()
			} else {
				DOM.timerDisplay.innerText = (remainingTime / 1000).toFixed(2)
			}
		}
		console.log(GameMap)
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
		DOM.customDifficultyDiv
			.querySelector('#minDifficulty')
			.addEventListener('input', () =>
				this.checkNumberIntegrity(
					DOM.customDifficultyDiv.querySelector('#minDifficulty'),
					true,
					true
				)
			)
		DOM.customDifficultyDiv
			.querySelector('#maxDifficulty')
			.addEventListener('input', () =>
				this.checkNumberIntegrity(
					DOM.customDifficultyDiv.querySelector('#maxDifficulty'),
					true,
					true
				)
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
		document
			.getElementById('timerEnabled')
			.addEventListener('change', (event) =>
				this.timerInputDisplay(event.target)
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
	restartGame() {
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
			if (Number(DOM.timerLengthInput.value) <= 0) {
				console.error(
					'Please use a valid number for timer length (greater than 0).'
				)
				return
			}
			this.timerLengthSeconds = Number(DOM.timerLengthInput.value)
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

		if (value <= 0 || isNaN(value)){
			value = DOM.roundCountInput.placeholder
		}
		this.totalRounds = value

		DOM.roundElement.textContent = `${this.currentRound}/${this.totalRounds}`
	},

	/**
	 * Checks the integrity of a number input field.
	 * @param {HTMLInputElement} element - The input element.
	 * @param {boolean} integer - True if the value should be an integer.
	 * @param {boolean} updateIfInvalid - True to revert to default value if invalid.
	 * @returns {boolean} True if the value is valid, false otherwise.
	 */
	checkNumberIntegrity(element, integer = true, updateIfInvalid = true) {
		let maxValue = Number(element.getAttribute('max')) || Infinity
		let minValue = Number(element.getAttribute('min')) || 1

		if (
			!isNaN(element.value) &&
			element.value !== '' &&
			Number(element.value) >= minValue
		) {
			if (Number(element.value) > maxValue) element.value = maxValue
			if (integer) element.value = parseInt(element.value)
			return true
		}

		if (updateIfInvalid) {
			element.value = Number(element.getAttribute('value'))
		}

		if (integer) element.value = parseInt(element.value)
		return false
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
		if (DOM.mapContainer.classList.contains('fullscreen')) {
			document.getElementById('fullscreenButton')
		}
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
		DOM.loadingText.style.display = 'flex'

		const img = new Image()
		img.onload = () => {
			this.imageIsLoaded = true
			DOM.loadingText.style.display = 'none'
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
}

// First function to run, called from 'loadLocationData.js'
export let dataLoaded = function () {
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

	DOM.guessButton = document.getElementById('guessButton')
	DOM.locationImgElement = document.getElementById('locationImg')
	DOM.mapCanvas = document.getElementById('mapCanvas')
	DOM.mapContainer = document.getElementById('mapContainer')
	DOM.showMapButton = document.getElementById('showMapButton')
	DOM.minimiseButton = document.getElementById('minimiseButton')
	DOM.gameMode = document.getElementById('gameMode')

	
	GameManager.init()
}
