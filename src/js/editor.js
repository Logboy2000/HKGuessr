// --- 1. State Management ---

/*
 * Schema for pack properties. This is the single source of truth for generating
 * UI elements and handling data mapping between the editor state and pack.json.
 * To add a new property (e.g., a description), just add a new object to this array.
 */
const PACK_SCHEMA = [
	{
		stateKey: 'packName', // Key in the `state` object
		packKey: 'name', // Key in the `pack.json` file
		label: 'Pack Name', // UI Label
		type: 'text', // Input type ('text', 'textarea', etc.)
		id: 'pack-name', // DOM element ID
		defaultValue: 'My New Pack',
		placeholder: 'e.g., My Awesome Pack',
	},
	{
		stateKey: 'gameModeId',
		packKey: 'gameModeId',
		label: 'Game Mode ID',
		type: 'text',
		id: 'game-mode-id',
		defaultValue: 'my_new_pack',
		placeholder: 'e.g., my_awesome_pack (no spaces)',
	},
	{
		stateKey: 'author',
		packKey: 'author',
		label: 'Author',
		type: 'text',
		id: 'author-name',
		defaultValue: '',
		placeholder: 'Your name',
	},
	{
		stateKey: 'thumbnail', // Will store the path, e.g., 'images/thumbnail.png'
		packKey: 'thumbnail', // Key in pack.json
		label: 'Pack Thumbnail',
		type: 'image',
		id: 'pack-thumbnail-upload',
		defaultValue: null, // No thumbnail by default
		previewId: 'pack-thumbnail-preview',
		previewDefault: 'images/editor/imagePreview.svg',
		fileName: 'thumbnail.png', // The name of the file inside the zip
	},
]

/**
 * A single JavaScript object to hold all the data for the editor.
 * This is the "source of truth" for the editor's current session.
 * When a pack is imported, this state is updated.
 * When a pack is exported, this state is used to generate the pack.json file.
 */
const state = {
	// This will be populated dynamically from the schema
	locations: [], // Array of location objects
	uploadedFiles: {}, // Maps filename (e.g., '1.png') to File object
	selectedLocationId: null, // ID of the currently selected location
	nextLocationId: 1, // Counter for unique location IDs
	isPlacingNewPin: false, // Flag for the "Add New Location" mode
	defaultMapName: 'hallownest',
	defaultMapsUrl: 'images/game/defaultMaps/',
	customMapFile: null, // Holds the File object for the custom map.
	currentMapUrl: 'images/game/defaultMaps/hallownest.png', // URL for the currently displayed map image.
	mapImageWidth: 4498,
	mapImageHeight: 2901,
	contributors: [], // Array of contributor objects {images, name, notes}
}

// --- 2. Leaflet Map Setup ---
// Default map dimensions are in the state object.
const map = L.map('map', {
	crs: L.CRS.Simple,
	minZoom: -2,
	maxZoom: 2,
	zoomSnap: 0.25,
	zoomDelta: 0,
	scrollWheelZoom: true,
	center: [state.mapImageHeight / 2, state.mapImageWidth / 2],
	zoom: 0,
	zoomAnimation: true,
	attributionControl: false,
	zoomControl: false,
	maxBoundsViscosity: 0.5,
	preferCanvas: true,
	renderer: L.canvas(),
})

const bounds = [
	[0, 0],
	[state.mapImageHeight, state.mapImageWidth],
]
// Use the state's customMapUrl for the initial image overlay
const imageOverlay = L.imageOverlay(state.currentMapUrl, bounds).addTo(map)

imageOverlay.on('load', function () {
	// `this` is the imageOverlay
	const img = this._image
	state.mapImageWidth = img.naturalWidth
	state.mapImageHeight = img.naturalHeight

	const newBounds = [
		[0, 0],
		[state.mapImageHeight, state.mapImageWidth],
	]

	// Update the overlay's bounds and fit the map to them
	this.setBounds(newBounds)
	// Change minZoom based on new img dimensions (banger math)
	map.options.minZoom = Math.floor(
		Math.log(
			Math.max(map.getSize().x, map.getSize().y) /
				Math.max(state.mapImageWidth, state.mapImageHeight)
		) / Math.log(2)
	)

	map.fitBounds(newBounds)
	map.setMaxBounds(newBounds) // Constrain map panning
	map.invalidateSize() // Force map to re-render with correct dimensions
})

// --- 3. UI Element and Event Handlers ---
const sidebar = document.getElementById('sidebar')
const packSettingsContainer = document.getElementById('pack-settings-container')
const locationsList = document.getElementById('locations-list')
const addLocationBtn = document.getElementById('add-location-btn')
const downloadPackBtn = document.getElementById('download-pack-btn')
const importPackBtn = document.getElementById('import-pack-btn')
const importFileInput = document.getElementById('import-file-input')
const newPackBtn = document.getElementById('new-pack-btn')

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
const defaultMapSelector = document.getElementById('default-map-selector')

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

// Map Image Upload handler
mapImageUploadInput.addEventListener('change', (e) => {
	const file = e.target.files[0]
	if (!file) return

	// Revoke the previous URL to free up memory
	if (state.customMapFile && state.currentMapUrl.startsWith('blob:')) {
		URL.revokeObjectURL(state.currentMapUrl)
	}

	state.customMapFile = file
	state.currentMapUrl = URL.createObjectURL(file)

	// Update the image overlay on the map. The 'load' event will handle resizing.
	imageOverlay.setUrl(state.currentMapUrl)
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

newPackBtn.addEventListener('click', () => {
	createNewPack()
})

// --- 4. Core Logic Functions ---

/**
 * Generates UI form fields from PACK_SCHEMA and initializes state.
 */
function initializeSchemaDrivenUI() {
	packSettingsContainer.innerHTML = '' // Clear any static HTML
	packSettingsContainer.innerHTML = `<h2 class="section-heading">Pack Details</h2>`

	PACK_SCHEMA.forEach((prop) => {
		// 1. Initialize the state object with default values
		state[prop.stateKey] = prop.defaultValue

		// 2. Create and append the UI element
		const formGroup = document.createElement('div')
		formGroup.className = 'input-group' // Use existing CSS class

		const label = document.createElement('label')
		label.htmlFor = prop.id
		label.textContent = prop.label
		label.className = 'input-label' // Use existing CSS class

		if (prop.type === 'text' || prop.type === 'textarea') {
			const input = document.createElement(
				prop.type === 'textarea' ? 'textarea' : 'input'
			)
			if (prop.type !== 'textarea') {
				input.type = prop.type
			}
			input.id = prop.id
			input.className = 'text-input' // Use existing CSS class
			input.placeholder = prop.placeholder || ''
			input.value = prop.defaultValue

			// 3. Add event listener to update state on input
			input.addEventListener('input', (e) => {
				state[prop.stateKey] = e.target.value
			})

			formGroup.append(label, input)
		} else if (prop.type === 'image') {
			const fileInput = document.createElement('input')
			fileInput.type = 'file'
			fileInput.id = prop.id
			fileInput.style.display = 'none'
			fileInput.accept =
				'.png, .jpg, .jpeg, .webp, .gif, .svg, .bmp, .tiff, .ico, .heic, .heif'

			const fileLabel = document.createElement('label')
			fileLabel.htmlFor = prop.id
			fileLabel.className = 'file-label'
			fileLabel.innerHTML = `<span>Upload ${prop.label}</span>`

			const previewImg = document.createElement('img')
			previewImg.id = prop.previewId
			previewImg.src = prop.previewDefault
			previewImg.alt = `${prop.label} Preview`
			previewImg.className = 'preview-img'

			fileInput.addEventListener('change', (e) => {
				const file = e.target.files[0]
				if (!file) return

				// Store the file object to be zipped later
				state.uploadedFiles[prop.fileName] = file
				// Store the path for pack.json
				state[prop.stateKey] = prop.fileName

				// Update UI
				previewImg.src = URL.createObjectURL(file)
				fileLabel.querySelector(
					'span'
				).textContent = `Change Thumbnail (${file.name})`
			})

			formGroup.append(label, fileLabel, fileInput, previewImg)
		}
		packSettingsContainer.appendChild(formGroup)
	})
}

async function createNewPack() {
	const confirmed = await showConfirmationDialog(
		'Are you sure you want to create a new pack? All unsaved changes will be lost.'
	)
	if (confirmed) {
		clearAllData()
	}
}

function generateUniqueId() {
	return `loc-${state.nextLocationId++}`
}

function clearAllData() {
	// Clear existing pins from the map
	state.locations.forEach((loc) => {
		if (loc.marker) map.removeLayer(loc.marker)
	})

	// Revoke any blob URLs to prevent memory leaks
	if (state.customMapFile && state.currentMapUrl.startsWith('blob:')) {
		URL.revokeObjectURL(state.currentMapUrl)
	}

	// Reset state properties based on the schema
	PACK_SCHEMA.forEach((prop) => {
		state[prop.stateKey] = prop.defaultValue
	})

	state.locations = []
	state.uploadedFiles = {}
	state.selectedLocationId = null
	state.nextLocationId = 1
	state.isPlacingNewPin = false
	state.defaultMapName = 'hallownest'
	state.customMapFile = null
	state.currentMapUrl = state.defaultMapsUrl + state.defaultMapName + '.png'
	state.contributors = []

	// Update UI inputs to reflect cleared state
	PACK_SCHEMA.forEach((prop) => {
		const inputElement = document.getElementById(prop.id)
		if (inputElement) {
			if (prop.type === 'image') {
				const previewEl = document.getElementById(prop.previewId)
				const labelEl = document.querySelector(`label[for="${prop.id}"] span`)
				if (previewEl) previewEl.src = prop.previewDefault
				if (labelEl) labelEl.textContent = prop.label
				// Clear the file input value
				inputElement.value = ''
			} else {
				inputElement.value = prop.defaultValue
			}
		}
	})

	defaultMapSelector.value = 'hallownest'
	mapImageUploadLabel.textContent = 'Upload Custom Map Image'
	imageOverlay.setUrl(state.currentMapUrl)

	// Reset UI components
	closeLocationDetails()
	renderLocationsList()
	addLocationBtn.disabled = false
	addLocationBtn.innerHTML = `
        <img src="images/editor/add.svg" alt="" class="svg-icon">
        Add New Location
    `
	map.getContainer().style.cursor = 'grab'
}

function renderLocationsList() {
	locationsList.innerHTML = ''
	if (state.locations.length === 0) {
		locationsList.innerHTML = `
            <div class="empty-list-message">
                <p>No locations yet.</p>
                <p>Click "Add New Location" to start placing pins on the map.</p>
            </div>`
		return
	}
	state.locations.forEach((location, index) => {
		const listItem = document.createElement('div')
		listItem.className = 'location-item'
		if (location.id === state.selectedLocationId) {
			listItem.classList.add('selected')
		}

		// Use the array index for a user-friendly, sequential number.
		const locationNumber = index + 1
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
		if (marker) {
			if (marker._icon) {
				marker._icon.classList.add('active')
			}
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
	// Display the y-axis directly.
	coordYSpan.textContent = location.y
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
		location.difficulty = e.target.value
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
		// Generate a unique filename using the location's own ID to avoid conflicts
		// and prevent incrementing the global location ID counter.
		const newFilename = `${location.id}-${file.name.replace(
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

defaultMapSelector.addEventListener('change', (e) => {
	const newValue = e.target.value
	state.customMapFile = null // Clear any custom map file
	state.defaultMapName = `${newValue}`
	if (newValue === 'pharloom') {
		imageOverlay.setUrl('images/game/defaultMaps/pharloom.png')
	} else {
		imageOverlay.setUrl('images/game/defaultMaps/hallownest.png')
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

/**
 * Sets the map's image URL and returns a promise that resolves when the image has loaded.
 * This ensures that map dimensions are updated before proceeding.
 * @param {string} url The URL of the image to load.
 * @returns {Promise<void>}
 */
function setMapUrlAndWaitForLoad(url) {
	return new Promise((resolve) => {
		// Use .once() to ensure this listener only fires for the current load operation.
		imageOverlay.once('load', () => resolve())
		imageOverlay.setUrl(url)
	})
}

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
		console.log('Imported pack data:', packData)

		// Reset state and UI
		clearAllData()

		// Update state with imported data
		PACK_SCHEMA.forEach((prop) => {
			const value = packData[prop.packKey] || prop.defaultValue
			state[prop.stateKey] = value
			// Also update the dynamically generated UI element
			const inputElement = document.getElementById(prop.id)
			if (inputElement) {
				if (inputElement.type !== 'file') {
					inputElement.value = value
				}
			}
		})

		// Import contributors if present
		if (packData.contributors && Array.isArray(packData.contributors)) {
			state.contributors = packData.contributors
		} else {
			state.contributors = []
		}

		// Handle thumbnail import
		const thumbProp = PACK_SCHEMA.find((p) => p.stateKey === 'thumbnail')
		if (thumbProp && packData[thumbProp.packKey]) {
			const thumbFileInZip = zip.file(packData[thumbProp.packKey])
			if (thumbFileInZip) {
				const thumbBlob = await thumbFileInZip.async('blob')
				const thumbFile = new File([thumbBlob], thumbProp.fileName)
				state.uploadedFiles[thumbProp.fileName] = thumbFile
				state[thumbProp.stateKey] = thumbProp.fileName

				const previewEl = document.getElementById(thumbProp.previewId)
				if (previewEl) previewEl.src = URL.createObjectURL(thumbFile)
			}
		}

		if (packData.map?.useCustomMap) {
			const mapFileInZip = zip.file(packData.map.mapImage)
			if (mapFileInZip) {
				const mapBlob = await mapFileInZip.async('blob')
				state.customMapFile = new File([mapBlob], packData.map.mapImage, {
					type: 'image/png',
				})
				state.currentMapUrl = URL.createObjectURL(state.customMapFile)
				mapImageUploadLabel.textContent = packData.map.mapImage
				defaultMapSelector.value = 'hallownest.png' // Reset dropdown
			} else {
				console.warn(
					`Map image '${packData.map.mapImage}' not found in zip. Using default map.`
				)
				state.customMapFile = null
				state.currentMapUrl = state.defaultMapName
				mapImageUploadLabel.textContent = 'Upload Custom Map Image'
			}
		} else if (packData.map?.defaultMap) {
			state.customMapFile = null

			// Migrate old pack format to the new one
			if (
				packData.map.defaultMap === 'images/game/defaultMaps/hallownest.png'
			) {
				packData.map.defaultMap = 'hallownest'
			}
			if (packData.map.defaultMap === 'images/game/defaultMaps/pharloom.png') {
				packData.map.defaultMap = 'pharloom'
			}
			state.currentMapUrl =
				state.defaultMapsUrl + packData.map.defaultMap + '.png'
			state.defaultMapName = packData.map.defaultMap
			defaultMapSelector.value = packData.map.defaultMap
			mapImageUploadLabel.textContent = 'Upload Custom Map Image'
		} else {
			// If no custom map is specified or found, revert to the default
			state.customMapFile = null
			state.currentMapUrl = state.defaultMapsUrl + state.defaultMapName + '.png'
			mapImageUploadLabel.textContent = 'Upload Map Image (map.png)'
		}

		// Set the map URL and explicitly wait for it to load before processing locations.
		await setMapUrlAndWaitForLoad(state.currentMapUrl)

		// Now that the map is loaded and dimensions are correct, process locations.
		const imagesFolder = zip.folder('images')
		if (imagesFolder && packData.locations) {
			await Promise.all(
				packData.locations.map(async (locData) => {
					// The path in pack.json is "images/filename.png", but the file in the zip is just "filename.png" inside the "images" folder.
					const filename = locData.image.split('/').pop()
					const imageFile = imagesFolder.file(filename)

					if (imageFile) {
						const blob = await imageFile.async('blob')
						const fileObject = new File([blob], filename, { type: blob.type })
						// Use the original filename from the pack as the key
						state.uploadedFiles[filename] = fileObject
					}

					// Correct the inverted y-axis from the pack data for the map
					const correctedY = state.mapImageHeight - locData.y

					// Create a new location object for our state
					const newId = generateUniqueId()
					const newLocation = {
						id: newId,
						x: locData.x,
						y: correctedY, // Use the corrected Y for the editor's coordinate system
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
		const packData = {}
		PACK_SCHEMA.forEach((prop) => {
			packData[prop.packKey] = state[prop.stateKey]
		})
		packData.locations = state.locations.map((loc) => {
			return {
				x: loc.x,
				// Invert the y-coordinate for game compatibility (game's y=0 is at the bottom)
				y: state.mapImageHeight - loc.y,
				difficulty: loc.difficulty,
				image: loc.image, // Use the original image path from the state
			}
		})

		// Include contributors if present
		if (state.contributors && state.contributors.length > 0) {
			packData.contributors = state.contributors
		}

		const zip = new JSZip()

		if (state.customMapFile) {
			zip.file('map.png', state.customMapFile)
			packData.map = {
				useCustomMap: true,
				mapImage: 'map.png',
			}
		} else {
			packData.map = {
				useCustomMap: false,
				defaultMap: state.defaultMapName,
			}
		}

		zip.file('pack.json', JSON.stringify(packData, null, 2))
		const imagesFolder = zip.folder('images')

		// Handle thumbnail export
		const thumbProp = PACK_SCHEMA.find((p) => p.stateKey === 'thumbnail')
		if (
			thumbProp &&
			state[thumbProp.stateKey] &&
			state.uploadedFiles[thumbProp.fileName]
		) {
			const thumbFile = state.uploadedFiles[thumbProp.fileName]
			// The path is already in packData from the schema loop
			// Ensure pack.json points to the file in root
			packData[thumbProp.packKey] = thumbProp.fileName
			// Add the thumbnail file to the root of the zip
			zip.file(thumbProp.fileName, thumbFile)
		}

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

// --- Initialization ---
initializeSchemaDrivenUI() // Generate the settings form from the schema
renderLocationsList()

// Keyboard navigation: Left/Right arrows change the selected location.
// - Right: move to the next location (index + 1)
// - Left: move to the previous location (index - 1)
// Behavior notes:
// - If no location is selected, Right selects the first, Left selects the last.
// - Selection is clamped (no wrapping).
// - Ignore arrow keys when focus is inside an input/textarea or a contentEditable element.
window.addEventListener('keydown', (e) => {
	if (
		e.key !== 'ArrowRight' &&
		e.key !== 'ArrowLeft' &&
		e.key !== 'ArrowUp' &&
		e.key !== 'ArrowDown'
	)
		return

	const active = document.activeElement
	if (!active) return

	const tag = active.tagName

	if (!state.locations || state.locations.length === 0) return

	const currentIndex = state.locations.findIndex(
		(loc) => loc.id === state.selectedLocationId
	)

	if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
		// If nothing selected, pick the first. Otherwise pick next (clamped).
		const nextIndex = Math.min(
			currentIndex === -1 ? 0 : currentIndex + 1,
			state.locations.length - 1
		)
		const nextId = state.locations[nextIndex].id
		if (nextId !== state.selectedLocationId) {
			selectLocation(nextId)
		}
		e.preventDefault()
	} else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
		// If nothing selected, pick the last. Otherwise pick previous (clamped).
		const prevIndex = Math.max(
			currentIndex === -1 ? state.locations.length - 1 : currentIndex - 1,
			0
		)
		const prevId = state.locations[prevIndex].id
		if (prevId !== state.selectedLocationId) {
			selectLocation(prevId)
		}
		e.preventDefault()
	}
})

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

function showConfirmationDialog(message) {
	return new Promise((resolve) => {
		const dialogBox = document.createElement('div')
		dialogBox.style.position = 'fixed'
		dialogBox.style.inset = '0'
		dialogBox.style.display = 'flex'
		dialogBox.style.alignItems = 'center'
		dialogBox.style.justifyContent = 'center'
		dialogBox.style.zIndex = '2000'
		dialogBox.style.backgroundColor = 'rgba(0,0,0,0.7)'
		dialogBox.innerHTML = `
            <div style="background-color: #1f2937; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1); text-align: center; max-width: 28rem;">
                <p style="color: #fff; font-size: 1.125rem; margin-bottom: 1.5rem;">${message}</p>
                <div class="flex-row" style="justify-content: center;">
                    <button id="confirm-dialog-btn" class="btn btn-primary">Confirm</button>
                    <button id="cancel-dialog-btn" class="btn btn-secondary">Cancel</button>
                </div>
            </div>
        `
		document.body.appendChild(dialogBox)

		const confirmBtn = dialogBox.querySelector('#confirm-dialog-btn')
		const cancelBtn = dialogBox.querySelector('#cancel-dialog-btn')

		const closeDialog = (result) => {
			document.body.removeChild(dialogBox)
			resolve(result)
		}

		confirmBtn.addEventListener('click', () => closeDialog(true))
		cancelBtn.addEventListener('click', () => closeDialog(false))
	})
}
