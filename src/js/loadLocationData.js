import { GameManager, DEFAULT_MAP_URL, imagePackMC } from './game.js'

// Single object to store all game mode data

let defaultImagePacks = []
const defaultImagePacksFolder = 'data/defaultImagePacks/'

/**
 * Registers a processed pack by adding it to the game's data,
 * updating the UI, and preparing the game manager.
 * @param {object} data - The parsed pack.json data.
 * @param {Array} locations - The processed array of location data.
 * @param {object} mapInfo - The processed map information.
 * @param {boolean} [isCustom=false] - Flag for custom packs that require special handling.
 */
async function registerPack(data, locations, mapInfo, isCustom = false) {
	const packData = {
		name: data.name,
		locations: locations,
		map: mapInfo,
	}

	// For custom packs loaded after initial setup, we need to initialize usedLocations.
	// For default packs, GameManager.init() will handle this after all packs are loaded.
	if (isCustom) {
		if (typeof GameManager.usedLocations !== 'undefined') {
			GameManager.usedLocations[data.gameModeId] = []
		} else {
			// This logic is a fallback for potential race conditions on very fast user interaction.
			console.warn(
				'GameManager.usedLocations not initialized yet, attempting to wait...'
			)
			await new Promise((resolve) => setTimeout(resolve, 100))
			if (typeof GameManager.usedLocations !== 'undefined') {
				GameManager.usedLocations[data.gameModeId] = []
			} else {
				throw new Error(
					'GameManager.usedLocations is not available. Ensure the game has fully loaded.'
				)
			}
		}
	}

	let gameMapName = 'custom'

	if(data.map.defaultMap === "images/game/defaultMaps/pharloom.png") {
		gameMapName = 'pharloom'
	}
		if(data.map.defaultMap === "images/game/defaultMaps/hallownest.png") {
		gameMapName = 'hallownest'
	}

	

	// Update game mode select options
	const choiceData = {
		id: data.gameModeId,
		value: data.gameModeId,
		label: isCustom ? `${data.name} (Custom)` : data.name,
		img: data.thumbnail,
		description: data.description || '',
		author: data.author || 'Unknown',
		imageCount: locations.length,
		gameMapName: gameMapName,
	};

	
	imagePackMC.addChoice(choiceData);


	console.log("Pack Registered:", choiceData.id)

	return packData
}

// Handle loading custom image packs from ZIP files
async function loadCustomImagePack(file) {
	try {
		// Load and parse the zip and pack.json
		const zip = await JSZip.loadAsync(await file.arrayBuffer())
		const jsonFile = zip.file('pack.json')
		if (!jsonFile) throw new Error('pack.json not found in zip')
		const data = JSON.parse(await jsonFile.async('text'))

		// Handle thumbnail from zip
		if (data.thumbnail) {
			const thumbFileInZip = zip.file(data.thumbnail)
			if (thumbFileInZip) {
				const thumbBlob = await thumbFileInZip.async('blob')
				// Overwrite the relative path with a usable blob URL
				data.thumbnail = URL.createObjectURL(thumbBlob)
			} else {
				console.warn(`Thumbnail '${data.thumbnail}' not found in zip.`)
			}
		}
		// Create object URLs for all location images
		const locations = await Promise.all(
			data.locations.map(async (loc) => {
				// If it's a remote URL (http/https/blob), use as is
				if (
					/^(https?:)?\/\//.test(loc.image) ||
					loc.image.startsWith('blob:')
				) {
					return [loc.x, loc.y, loc.difficulty, loc.image]
				}
				const imageName = loc.image.split('/').pop()
				const imageFile = zip.file(`images/${imageName}`)
				if (!imageFile) throw new Error(`Image ${imageName} not found in zip`)
				const blob = new Blob([await imageFile.async('arraybuffer')])
				return [loc.x, loc.y, loc.difficulty, URL.createObjectURL(blob)]
			})
		)

		// Handle custom or default map from the pack
		let mapInfo = { useCustomMap: false, defaultMap: DEFAULT_MAP_URL }
		if (data.map) {
			if (data.map.useCustomMap) {
				const mapImageFile = zip.file(data.map.mapImage)
				if (!mapImageFile)
					throw new Error(`Map image ${data.map.mapImage} not found in zip`)
				const blob = new Blob([await mapImageFile.async('arraybuffer')])
				mapInfo = {
					useCustomMap: true,
					mapUrl: URL.createObjectURL(blob),
				}
			} else if (data.map.defaultMap) {
				mapInfo.defaultMap = data.map.defaultMap
			}
		}

		// Register the pack with the game
		const packData = await registerPack(data, locations, mapInfo, true)
		GameManager.addGameModeData(data.gameModeId, packData)
	} catch (error) {
		console.error('Error loading custom image pack:', error)
		alert(`Error loading image pack: ${error.message}`)
	}
}

export async function loadInitialData() {
	// Loads the list of packs from 'packList.json'
	try {
		const response = await fetch('data/defaultImagePacks/packList.json')
		if (!response.ok) {
			throw new Error(`HTTP error! Status: ${response.status}`)
		}
		const dataArray = await response.json()
		defaultImagePacks = dataArray
	} catch (error) {
		console.error('Failed to load or parse data:', error)
		defaultImagePacks = []
	}

	const loadedGameModes = {}

	// Loads packs from the defaultImagePacks list
	try {
		// Load each default image pack
		for (const packName of defaultImagePacks) {
			try {
				// Load the pack.json file
				const response = await fetch(
					`${defaultImagePacksFolder}${packName}/pack.json`
				)
				if (!response.ok) {
					console.error(`Failed to load ${packName} pack.json`)
					continue
				}
				const data = await response.json()

				// Prepend the pack folder path to the thumbnail URL if it exists
				if (data.thumbnail && !/^(https?:)?\/\//.test(data.thumbnail)) {
					data.thumbnail = `${defaultImagePacksFolder}${packName}/${data.thumbnail}`
				}

				// Process locations, creating full image paths
				const locations = data.locations.map((loc) => {
					if (
						/^(https?:)?\/\//.test(loc.image) ||
						loc.image.startsWith('blob:')
					) {
						return [loc.x, loc.y, loc.difficulty, loc.image]
					}
					const imageName = loc.image.split('/').pop()
					return [
						loc.x,
						loc.y,
						loc.difficulty,
						`${defaultImagePacksFolder}${packName}/images/${imageName}`,
					]
				})

				// Handle custom or default map from the pack
				let mapInfo = { useCustomMap: false, defaultMap: DEFAULT_MAP_URL }
				if (data.map) {
					if (data.map.useCustomMap) {
						mapInfo = {
							useCustomMap: true,
							mapUrl: `${defaultImagePacksFolder}${packName}/${data.map.mapImage}`,
						}
					} else if (data.map.defaultMap) {
						mapInfo.defaultMap = data.map.defaultMap
					}
				}

				// Register the pack with the game
				const packData = await registerPack(data, locations, mapInfo, false)
				loadedGameModes[data.gameModeId] = packData
			} catch (error) {
				console.error(`Error loading ${packName} pack:`, error)
			}
		}

		imagePackMC.selectChoiceByIndex(0)
		imagePackMC.selectChoiceByIndex(1)
		return loadedGameModes
	} catch (error) {
		console.error('Error loading location data:', error)

		return {} // Fallback to empty object
	}
}

// Add event listener for custom image pack upload
const customImagePackInput = document.getElementById('customImagePack')
if (customImagePackInput) {
	customImagePackInput.addEventListener('change', async (event) => {
		const file = event.target.files[0]
		if (!file) return

		if (!file.name.endsWith('.zip')) {
			alert('Please select a ZIP file')
			event.target.value = ''
			return
		}

		await loadCustomImagePack(file)

		// Clear the input so the same file can be loaded again
		event.target.value = ''
	})
}
