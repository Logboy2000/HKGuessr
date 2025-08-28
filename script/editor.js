// --- 1. State Management ---
// A single JavaScript object to hold all the data for the editor.
const state = {
	packName: 'MyNewPack',
	gameModeId: 'my_new_pack',
	author: '',
	locations: [], // Array of location objects
	uploadedFiles: {}, // Maps filename (e.g., '1.png') to File object
	selectedLocationId: null, // ID of the currently selected location
	nextLocationId: 1, // Counter for unique location IDs
	isPlacingNewPin: false, // Flag for the "Add New Location" mode
	customMapFile: null, // Holds the File object for the custom map.
	customMapUrl: 'images/map.png', // URL for the currently displayed map image.
}

// --- 2. Leaflet Map Setup ---
// The Hollow Knight map is 4498x2901 pixels.
const mapImageWidth = 4498
const mapImageHeight = 2901
const hollowKnightMapUrl = 'images/map.png'

const map = L.map('map', {
	crs: L.CRS.Simple,
	minZoom: -2,
	maxZoom: 2,
	zoomSnap: 0.25,
	zoomDelta: 0,
	scrollWheelZoom: true,
	center: [mapImageHeight / 2, mapImageWidth / 2],
	zoom: 0,
	zoomAnimation: true,
	attributionControl: false,
	zoomControl: false,
})

const bounds = [
	[0, 0],
	[mapImageHeight, mapImageWidth],
]
// Use the state's customMapUrl for the initial image overlay
const imageOverlay = L.imageOverlay(state.customMapUrl, bounds).addTo(map)

imageOverlay.on('load', function () {
	map.fitBounds(bounds)
})

// --- 3. UI Element and Event Handlers ---
const sidebar = document.getElementById('sidebar')
const packNameInput = document.getElementById('pack-name')
const gameModeIdInput = document.getElementById('game-mode-id')
const authorNameInput = document.getElementById('author-name')
const locationsList = document.getElementById('locations-list')
const addLocationBtn = document.getElementById('add-location-btn')
const downloadPackBtn = document.getElementById('download-pack-btn')
const importPackBtn = document.getElementById('import-pack-btn')
const importFileInput = document.getElementById('import-file-input')

const locationDetailsPanel = document.getElementById('location-details')
const coordXSpan = document.getElementById('coord-x')
const coordYSpan = document.getElementById('coord-y')
const difficultySlider = document.getElementById('difficulty-slider')
const difficultyValueSpan = document.getElementById('difficulty-value')
const imageUploadInput = document.getElementById('image-upload')
const imagePreview = document.getElementById('image-preview')
const imageUploadLabel = document.getElementById('image-upload-label')
const deleteLocationBtn = document.getElementById('delete-location-btn')
const closeDetailsBtn = document.getElementById('close-details-btn')

// Map Image UI Elements
const mapImageUploadInput = document.getElementById('map-image-upload')
const mapImageUploadLabel = document.getElementById('map-image-upload-label')

// --- 3.5. Sidebar Resizing Logic ---
const resizer = document.getElementById('resizer')
const minimum_size = 316 // Corresponds to min-width in CSS

let original_width = 0
let original_mouse_x = 0

resizer.addEventListener('mousedown', (e) => {
	e.preventDefault()
	original_width = parseFloat(
		getComputedStyle(sidebar, null).getPropertyValue('width').replace('px', '')
	)
	original_mouse_x = e.pageX
	window.addEventListener('mousemove', resize)
	window.addEventListener('mouseup', stopResize)
})

function resize(e) {
	const width = original_width - (e.pageX - original_mouse_x)
	if (width > minimum_size) {
		sidebar.style.width = width + 'px'
	}
}

function stopResize() {
	window.removeEventListener('mousemove', resize)
	window.removeEventListener('mouseup', stopResize)
	map.invalidateSize() // Important for Leaflet to re-render correctly
}

// Initial UI state
packNameInput.value = state.packName
gameModeIdInput.value = state.gameModeId
authorNameInput.value = state.author

packNameInput.addEventListener('input', (e) => {
	state.packName = e.target.value
})

gameModeIdInput.addEventListener('input', (e) => {
	state.gameModeId = e.target.value
})

authorNameInput.addEventListener('input', (e) => {
	state.author = e.target.value
})

// Map Image Upload handler
mapImageUploadInput.addEventListener('change', (e) => {
	const file = e.target.files[0]
	if (!file) return

	// Revoke the previous URL to free up memory
	if (state.customMapFile && state.customMapUrl) {
		URL.revokeObjectURL(state.customMapUrl)
	}

	state.customMapFile = file
	state.customMapUrl = URL.createObjectURL(file)

	// Update the image overlay on the map
	imageOverlay.setUrl(state.customMapUrl)
	map.fitBounds(bounds) // Re-fit bounds to the new image
	mapImageUploadLabel.textContent = file.name
})

addLocationBtn.addEventListener('click', () => {
	state.isPlacingNewPin = true
	map.getContainer().style.cursor = 'crosshair'
	addLocationBtn.innerText = 'Click on map to place...'
	addLocationBtn.disabled = true
})

closeDetailsBtn.addEventListener('click', () => {
	closeLocationDetails()
})

importPackBtn.addEventListener('click', () => {
	importFileInput.click()
})

// --- 4. Core Logic Functions ---
function generateUniqueId() {
	return `loc-${state.nextLocationId++}`
}

function clearAllData() {
	// Clear existing pins from the map
	state.locations.forEach((loc) => {
		if (loc.marker) map.removeLayer(loc.marker)
	})
	// Clear state
	state.locations = []
	state.uploadedFiles = {}
	state.selectedLocationId = null
	state.nextLocationId = 1
	state.customMapFile = null
	state.customMapUrl = 'images/map.png'

	// Update UI to reflect cleared state
	mapImageUploadLabel.textContent = 'Upload Map Image (map.png)'
	imageOverlay.setUrl(state.customMapUrl)
	map.fitBounds(bounds)
}

function renderLocationsList() {
	locationsList.innerHTML = ''
	state.locations.forEach((location) => {
		const listItem = document.createElement('div')
		listItem.className = 'location-item'
		if (location.id === state.selectedLocationId) {
			listItem.classList.add('selected')
		}

		const locationNumber = location.id.split('-')[1]
		listItem.innerHTML = `
                    <span class="location-item-text">Location #${locationNumber}</span>
                    <span class="location-subtext">Diff: ${location.difficulty}</span>
                `
		listItem.dataset.id = location.id
		listItem.addEventListener('click', () => {
			selectLocation(location.id)
		})
		locationsList.appendChild(listItem)
	})
}

function createPin(id, latlng) {
	const pinIcon = L.divIcon({
		className: 'pin-icon',
		iconSize: [32, 32],
	})

	const marker = L.marker(latlng, {
		icon: pinIcon,
		draggable: true,
	}).addTo(map)

	marker.id = id
	marker.on('click', () => {
		selectLocation(id)
	})
	marker.on('dragend', (e) => {
		const newCoords = e.target.getLatLng()
		const location = state.locations.find((loc) => loc.id === id)
		if (location) {
			location.y = Math.round(newCoords.lat)
			location.x = Math.round(newCoords.lng)
			updateLocationDetailsUI()
			renderLocationsList()
		}
	})

	return marker
}

function selectLocation(id) {
	state.selectedLocationId = id
	// Clear all active classes from markers and list items
	map.eachLayer((layer) => {
		if (layer instanceof L.Marker) {
			if (layer._icon) {
				layer._icon.classList.remove('active')
			}
		}
	})
	document.querySelectorAll('.location-item').forEach((item) => {
		item.classList.remove('selected')
	})

	// Find and activate the selected marker and list item
	const selectedLocation = state.locations.find((loc) => loc.id === id)
	if (selectedLocation) {
		const marker = selectedLocation.marker
		if (marker && marker._icon) {
			marker._icon.classList.add('active')
		}
		const listItem = document.querySelector(`.location-item[data-id="${id}"]`)
		if (listItem) {
			listItem.classList.add('selected')
		}
		updateLocationDetailsUI()
		locationDetailsPanel.style.display = 'block'
		renderLocationsList()
	}
}

function closeLocationDetails() {
	state.selectedLocationId = null
	locationDetailsPanel.style.display = 'none'
	map.eachLayer((layer) => {
		if (layer instanceof L.Marker) {
			if (layer._icon) {
				layer._icon.classList.remove('active')
			}
		}
	})
	renderLocationsList()
}

function updateLocationDetailsUI() {
	const location = state.locations.find(
		(loc) => loc.id === state.selectedLocationId
	)
	if (!location) return

	coordXSpan.textContent = location.x
	// Invert y-axis for display
	coordYSpan.textContent = mapImageHeight - location.y
	difficultySlider.value = location.difficulty
	difficultyValueSpan.textContent = location.difficulty

	// Handle image preview
	if (location.image) {
		const filename = location.image.split('/').pop()
		const file = state.uploadedFiles[filename]
		if (file) {
			imagePreview.src = URL.createObjectURL(file)
			imageUploadLabel.textContent = `Change Image (${file.name})`
		}
	} else {
		imagePreview.src =
			'https://placehold.co/400x200/1f2937/d1d5db?text=Image+Preview'
		imageUploadLabel.textContent = 'Upload Location Image'
	}
}

difficultySlider.addEventListener('input', (e) => {
	const location = state.locations.find(
		(loc) => loc.id === state.selectedLocationId
	)
	if (location) {
		location.difficulty = parseInt(e.target.value)
		difficultyValueSpan.textContent = location.difficulty
		renderLocationsList()
	}
})

imageUploadInput.addEventListener('change', (e) => {
	const file = e.target.files[0]
	if (!file) return

	const location = state.locations.find(
		(loc) => loc.id === state.selectedLocationId
	)
	if (location) {
		// Generate a unique filename for the new upload to avoid conflicts
		const newFilename = `loc-${state.nextLocationId++}-${file.name.replace(
			/[^a-zA-Z0-9.]/g,
			'_'
		)}`
		location.image = `images/${newFilename}`
		state.uploadedFiles[newFilename] = file
		updateLocationDetailsUI()
	}
})

deleteLocationBtn.addEventListener('click', () => {
	const locationIndex = state.locations.findIndex(
		(loc) => loc.id === state.selectedLocationId
	)
	if (locationIndex > -1) {
		// Remove from map
		const locationToRemove = state.locations[locationIndex]
		if (locationToRemove.marker) {
			map.removeLayer(locationToRemove.marker)
		}

		// Remove the image file from the uploadedFiles map, if it exists
		if (locationToRemove.image) {
			const filename = locationToRemove.image.split('/').pop()
			delete state.uploadedFiles[filename]
		}

		// Remove from state
		state.locations.splice(locationIndex, 1)
		closeLocationDetails()
	}
})

// --- 5. Map Interaction ---
map.on('click', (e) => {
	if (state.isPlacingNewPin) {
		const y = Math.round(e.latlng.lat)
		const x = Math.round(e.latlng.lng)
		const newId = generateUniqueId()
		const newLocation = {
			id: newId,
			x: x,
			y: y,
			difficulty: 5,
			image: null,
		}
		const marker = createPin(newId, e.latlng)
		newLocation.marker = marker
		state.locations.push(newLocation)

		// Reset placement mode
		state.isPlacingNewPin = false
		map.getContainer().style.cursor = 'grab'
		addLocationBtn.innerHTML = `
                <img src="images/editor/add.svg" alt="" class="svg-icon">
                Add New Location
                `
		addLocationBtn.disabled = false

		selectLocation(newId)
	}
})

// --- 6. Import Pack Logic ---
importFileInput.addEventListener('change', async (e) => {
	const file = e.target.files[0]
	if (!file) return

	const loadingAlert = showTemporaryAlert('Importing pack...')

	try {
		const zip = await JSZip.loadAsync(file)
		const packJsonFile = zip.file('pack.json')

		if (!packJsonFile) {
			throw new Error('Invalid pack file: pack.json not found.')
		}

		const packJsonString = await packJsonFile.async('string')
		const packData = JSON.parse(packJsonString)

		// Reset state and UI
		clearAllData()
		closeLocationDetails()

		// Update state with imported data
		state.packName = packData.name || ''
		state.gameModeId = packData.gameModeId || ''
		state.author = packData.author || ''

		packNameInput.value = state.packName
		gameModeIdInput.value = packData.gameModeId
		authorNameInput.value = packData.author

		// Load custom map image if it exists in the zip
		const mapFileInZip = zip.file(packData.map.mapImage)
		if (packData.map && packData.map.useCustomMap && mapFileInZip) {
			const mapBlob = await mapFileInZip.async('blob')
			state.customMapFile = new File([mapBlob], packData.map.mapImage, { type: 'image/png' })
			state.customMapUrl = URL.createObjectURL(state.customMapFile)
			imageOverlay.setUrl(state.customMapUrl)
			mapImageUploadLabel.textContent = packData.map.mapImage
		} else {
			// If no custom map is specified or found, revert to the default
			state.customMapFile = null
			state.customMapUrl = 'images/map.png'
			imageOverlay.setUrl(state.customMapUrl)
			mapImageUploadLabel.textContent = 'Upload Map Image (map.png)'
		}

		// Load locations and images
		const imagesFolder = zip.folder('images')
		if (imagesFolder) {
			await Promise.all(
				packData.locations.map(async (locData) => {
					const filename = locData.image.split('/').pop()
					const imageFile = imagesFolder.file(filename)

					if (imageFile) {
						const blob = await imageFile.async('blob')
						const fileObject = new File([blob], filename, { type: blob.type })
						state.uploadedFiles[filename] = fileObject
					}

					// Correct the inverted y-axis from the pack data for the map
					const correctedY = mapImageHeight - locData.y

					// Create a new location object for our state
					const newId = generateUniqueId()
					const newLocation = {
						id: newId,
						x: locData.x,
						y: correctedY,
						difficulty: locData.difficulty,
						image: locData.image, // Store the original image path from the imported pack
					}
					const marker = createPin(newId, [correctedY, locData.x])
					newLocation.marker = marker
					state.locations.push(newLocation)
				})
			)
		}

		renderLocationsList()
		// Hide the loading alert on success
		hideAlert(loadingAlert)
		showTemporaryAlert('Pack imported successfully!', 3000)
	} catch (error) {
		console.error('Error importing pack:', error)
		// Hide the loading alert on error
		hideAlert(loadingAlert)
		showTemporaryAlert('Error importing pack: ' + error.message, 5000)
	} finally {
		// Clear the file input so the same file can be imported again
		importFileInput.value = ''
	}
})

// --- 7. Download Pack Logic with JSZip ---
downloadPackBtn.addEventListener('click', async () => {
	if (state.locations.length === 0) {
		showTemporaryAlert(
			'Please add at least one location to download a pack.',
			5000
		)
		return
	}

	// Check for missing images
	const missingImages = []
	for (const loc of state.locations) {
		// Use the stored image path to get the filename, which is consistent with how we loaded it
		const filename = loc.image ? loc.image.split('/').pop() : null
		const file = filename ? state.uploadedFiles[filename] : null
		if (!file) {
			missingImages.push(loc.id)
		}
	}

	if (missingImages.length > 0) {
		const message = `Please upload an image for the following locations before downloading: <br><br><b>${missingImages.join(
			', '
		)}</b>`
		showTemporaryAlert(message, 7000)
		return
	}

	const loadingAlert = showTemporaryAlert(
		'Generating and zipping your pack...',
		0
	)

	try {
		// 1. Prepare JSON data
		const packData = {
			name: state.packName,
			gameModeId: state.gameModeId,
			author: state.author, // Include the new author field
			locations: state.locations.map((loc) => {
				return {
					x: loc.x,
					// Invert the y-coordinate back to the game's coordinate system
					y: mapImageHeight - loc.y,
					difficulty: loc.difficulty,
					image: loc.image, // Use the original image path from the state
				}
			}),
		}

		const zip = new JSZip()
		
		if (state.customMapFile) {
			zip.file('map.png', state.customMapFile)
			packData.map = {
				useCustomMap: true,
				mapImage: 'map.png'
			}
		} else {
			packData.map = {
				useCustomMap: false
			}
		}

		zip.file('pack.json', JSON.stringify(packData, null, 2))
		const imagesFolder = zip.folder('images')

		for (const loc of state.locations) {
			const filename = loc.image.split('/').pop()
			const file = state.uploadedFiles[filename]
			imagesFolder.file(filename, file)
		}

		// 3. Generate the download
		const blob = await zip.generateAsync({ type: 'blob' })
		const downloadLink = document.createElement('a')
		const url = URL.createObjectURL(blob)
		downloadLink.href = url
		downloadLink.download = `${state.packName.replace(/\s/g, '')}.zip`
		document.body.appendChild(downloadLink)
		downloadLink.click()
		document.body.removeChild(downloadLink)
		URL.revokeObjectURL(url)

		hideAlert(loadingAlert)
		showTemporaryAlert('Pack downloaded successfully!', 3000)
	} catch (error) {
		console.error('Error during pack generation:', error)
		hideAlert(loadingAlert)
		showTemporaryAlert(
			'An unexpected error occurred during pack generation.',
			5000
		)
	}
})

// Initial render of the locations list (it will be empty)
renderLocationsList()

// --- Custom Alert Box functions ---
// A simple function to create a modal-like alert message.
function alert(message) {
	const modal = document.createElement('div')
	modal.style.position = 'fixed'
	modal.style.inset = '0'
	modal.style.backgroundColor = 'rgba(0, 0, 0, 0.75)'
	modal.style.display = 'flex'
	modal.style.alignItems = 'center'
	modal.style.justifyContent = 'center'
	modal.style.padding = '1rem'
	modal.style.zIndex = '9999'
	modal.innerHTML = `
                <div style="background-color: #1f2937; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 24rem; width: 100%;">
                    <p style="color: #fff;">${message}</p>
                    <button class="btn btn-primary btn-full-width" style="margin-top: 1rem;" onclick="this.parentElement.parentElement.remove()">OK</button>
                </div>
            `
	document.body.appendChild(modal)
}

// A function to show a temporary alert box that can be dismissed
function showTemporaryAlert(message, duration = 0) {
	const alertBox = document.createElement('div')
	alertBox.style.position = 'fixed'
	alertBox.style.inset = '0'
	alertBox.style.display = 'flex'
	alertBox.style.alignItems = 'center'
	alertBox.style.justifyContent = 'center'
	alertBox.style.zIndex = '2000'
	alertBox.style.backgroundColor = 'rgba(0,0,0,0.7)'
	alertBox.innerHTML = `
                <div style="background-color: #1f2937; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); text-align: center; max-width: 28rem;">
                    <p style="color: #fff; font-size: 1.125rem;">${message}</p>
                    ${
											duration > 0
												? `<button class="btn btn-primary" style="margin-top: 1rem;" onclick="document.body.removeChild(this.parentElement.parentElement)">Close</button>`
												: ''
										}
                </div>
            `
	document.body.appendChild(alertBox)

	if (duration > 0) {
		setTimeout(() => {
			if (document.body.contains(alertBox)) {
				document.body.removeChild(alertBox)
			}
		}, duration)
	}
	return alertBox
}

function hideAlert(alertBox) {
	if (alertBox && document.body.contains(alertBox)) {
		document.body.removeChild(alertBox)
	}
}