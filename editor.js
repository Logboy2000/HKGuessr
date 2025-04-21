// Game mode management
let gameModes = []
let currentGameMode = null
let selectedLocationIndex = -1
let currentUploadedImage = null
let uploadedImages = new Map() // Store all uploaded images by original filename

// Initialize game modes list
async function loadGameModes() {
	gameModes = []
	updateGameModeList()
}

function updateGameModeList() {
	
	const list = document.getElementById('modeList')
	const editorMain = document.getElementById('editorMain')
	list.innerHTML = ''

	if (gameModes.length === 0) {
		const span = document.createElement('span')
		span.textContent = 'No image packs loaded. Create a new one or load from file.'
		list.appendChild(span)
		editorMain.classList.add('hidden')
		return
	}

	editorMain.classList.remove('hidden')
	gameModes.forEach((mode) => {
		const div = document.createElement('div')
		div.className = 'list-item' + (mode === currentGameMode ? ' selected' : '')
		div.textContent = mode.name + ' [' + mode.gameModeId + ']' + (mode.saved ? '' : ' (unsaved)')
		div.onclick = () => selectGameMode(mode)
		list.appendChild(div)
	})
}

function selectGameMode(mode) {
	currentGameMode = mode

	// Update form
	document.getElementById('gameModeName').value = mode.name
	document.getElementById('gameModeId').value = mode.gameModeId

	// Clear input boxes
	document.getElementById('locationX').value = ''
	document.getElementById('locationY').value = ''
	document.getElementById('locationDifficulty').value = ''
	document.getElementById('imageFileName').textContent = 'No image selected'
	document.getElementById('imagePreview').style.display = 'none'
	document.getElementById('imageUrl').value = ''

	// Reset location selection
	selectedLocationIndex = -1

	// Update UI
	updateLocationList()
	updateJsonPreview()
	updateGameModeList()
}

function updateJsonPreview() {
	if (!currentGameMode) {
		document.getElementById('jsonPreview').textContent = ''
		return
	}

	// Use the same transformation as in saveFile
	const locationsForJson = currentGameMode.locations.map((loc) => {
		if (/^(https?:)?\/\//.test(loc.image) || loc.image.startsWith('blob:')) {
			return {
				x: loc.x,
				y: loc.y,
				difficulty: loc.difficulty,
				image: loc.image
			}
		}
		return {
			x: loc.x,
			y: loc.y,
			difficulty: loc.difficulty,
			image: loc._newImageName ? `images/${loc._newImageName}` : `images/${loc.image.split('/').pop()}`
		}
	})

	document.getElementById('jsonPreview').textContent = JSON.stringify(
		{
			name: currentGameMode.name,
			gameModeId: currentGameMode.gameModeId,
			locations: locationsForJson,
		},
		null,
		2
	)
}

function updateLocationList() {
	const list = document.getElementById('locationList')
	list.innerHTML = ''

	if (!currentGameMode) return

	currentGameMode.locations.forEach((loc, index) => {
		const div = document.createElement('div')
		div.className =
			'list-item' + (index === selectedLocationIndex ? ' selected' : '')

		const locationInfo = document.createElement('span')
		locationInfo.textContent = `(${loc.x}, ${loc.y}) - Difficulty: ${loc.difficulty}`
		div.appendChild(locationInfo)

		const deleteBtn = document.createElement('span')
		deleteBtn.className = 'delete-btn'
		deleteBtn.textContent = '×'
		deleteBtn.onclick = (e) => {
			e.stopPropagation() // Prevent location selection
			deleteLocation(index)
		}
		div.appendChild(deleteBtn)

		div.onclick = () => selectLocation(index)
		list.appendChild(div)
	})
}

function selectLocation(index) {
	if (!currentGameMode) return

	selectedLocationIndex = index
	const location = currentGameMode.locations[index]

	document.getElementById('locationX').value = location.x
	document.getElementById('locationY').value = location.y
	document.getElementById('locationDifficulty').value = location.difficulty

	// Show image preview if available
	const preview = document.getElementById('imagePreview')
	if (location.image) {
		// Clean up any existing object URL
		if (preview.src.startsWith('blob:')) {
			URL.revokeObjectURL(preview.src)
		}

		// Get the filename without path
		const filename = location.image.split('/').pop()
		
		// Check if this is a loaded image from zip or new upload
		const uploadedImage = uploadedImages.get(filename)
		if (uploadedImage) {
			// For uploaded/imported images, create a new object URL
			preview.src = URL.createObjectURL(uploadedImage.file)
			// Clean up when loaded
			preview.onload = () => URL.revokeObjectURL(preview.src)
		} else {
			// For existing images, use the full path
			preview.src = location.image
		}

		preview.style.display = 'block'
		document.getElementById('imageFileName').textContent = location.image
			.split('/')
			.pop()
	} else {
		preview.style.display = 'none'
		document.getElementById('imageFileName').textContent = 'No image selected'
	}

	updateLocationList()
}

// Handle image URL preview
async function previewImageUrl() {
	const urlInput = document.getElementById('imageUrl')
	const url = urlInput.value.trim()
	if (!url) {
		alert('Please enter an image URL or path')
		return
	}

	// Update UI
	document.getElementById('imageFileName').textContent = url.split('/').pop()
	const preview = document.getElementById('imagePreview')

	// Clean up any existing object URL
	if (preview.src.startsWith('blob:')) {
		URL.revokeObjectURL(preview.src)
	}

	// Set the preview source directly to the URL
	preview.src = url
	preview.style.display = 'block'

	// Store as current uploaded image
	currentUploadedImage = {
		url: url,
		isUrl: true
	}

	// Clear file input
	document.getElementById('locationImage').value = ''
}

// Handle image upload
document
	.getElementById('locationImage')
	.addEventListener('change', async (event) => {
		const file = event.target.files[0]
		if (!file) return

		try {
			// Calculate hash
			const buffer = await file.arrayBuffer()
			const hashArray = new Uint8Array(
				await crypto.subtle.digest('SHA-256', buffer)
			)
			const hash = Array.from(hashArray)
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('')
				.slice(0, 8) // Use first 8 characters of hash

			// Store with new filename
			const ext = file.name.split('.').pop()
			const newFileName = `${hash}.${ext}`
			currentUploadedImage = {
				file,
				newFileName,
				isUrl: false
			}

			// Store in uploadedImages map using original filename as key
			uploadedImages.set(file.name, currentUploadedImage)

			// Update UI
			document.getElementById('imageFileName').textContent = file.name
			const preview = document.getElementById('imagePreview')

			// Clean up any existing object URL
			if (preview.src.startsWith('blob:')) {
				URL.revokeObjectURL(preview.src)
			}

			// Create new object URL and display preview
			preview.src = URL.createObjectURL(file)
			preview.style.display = 'block'

			// Clean up object URL when image loads
			preview.onload = () => URL.revokeObjectURL(preview.src)

			// Clear URL input
			document.getElementById('imageUrl').value = ''
		} catch (error) {
			console.error('Error processing image:', error)
			alert('Error processing image')
		}
		// Add to our map of uploaded images
		uploadedImages.set(file.name, currentUploadedImage)
	})

function addLocation() {
	if (!currentGameMode) {
		alert('Please select or create a game mode first')
		return
	}

	const x = parseFloat(document.getElementById('locationX').value)
	const y = parseFloat(document.getElementById('locationY').value)
	const difficulty = parseInt(
		document.getElementById('locationDifficulty').value
	)

	if (isNaN(x) || isNaN(y) || isNaN(difficulty)) {
		alert('Please enter valid numbers for coordinates and difficulty')
		return
	}

	if (!currentUploadedImage) {
		alert('Please select an image')
		return
	}

	// Add location with image info
	const location = {
		x,
		y,
		difficulty
	}

	if (currentUploadedImage.isUrl) {
		// For URLs, use the URL directly
		location.image = currentUploadedImage.url
	} else {
		// For uploaded files, use original name and store new name
		location.image = currentUploadedImage.file.name
		location._newImageName = currentUploadedImage.newFileName
	}

	currentGameMode.locations.push(location)
	selectedLocationIndex = currentGameMode.locations.length - 1

	// Mark as unsaved when modified
	currentGameMode.saved = false

	// Reset image upload
	currentUploadedImage = null
	document.getElementById('imageFileName').textContent = 'No image selected'
	document.getElementById('imagePreview').style.display = 'none'
	document.getElementById('locationImage').value = ''
	document.getElementById('imageUrl').value = ''

	updateLocationList()
	updateJsonPreview()
	updateGameModeList()
}

function updateLocation() {
	if (!currentGameMode) {
		alert('Please select or create a game mode first')
		return
	}

	if (selectedLocationIndex === -1) {
		alert('Please select a location to update')
		return
	}

	const x = parseFloat(document.getElementById('locationX').value)
	const y = parseFloat(document.getElementById('locationY').value)
	const difficulty = parseInt(
		document.getElementById('locationDifficulty').value
	)

	if (isNaN(x) || isNaN(y) || isNaN(difficulty)) {
		alert('Please enter valid numbers for coordinates and difficulty')
		return
	}

	const oldLocation = currentGameMode.locations[selectedLocationIndex]
	const newLocation = {
		x,
		y,
		difficulty
	}

	if (currentUploadedImage) {
		if (currentUploadedImage.isUrl) {
			// For URLs, use the URL directly
			newLocation.image = currentUploadedImage.url
			// Remove any old _newImageName if it existed
			delete newLocation._newImageName
		} else {
			// For uploaded files, use original name and store new name
			newLocation.image = currentUploadedImage.file.name
			newLocation._newImageName = currentUploadedImage.newFileName
		}
	} else {
		// Keep existing image info
		newLocation.image = oldLocation.image
		if (oldLocation._newImageName) {
			newLocation._newImageName = oldLocation._newImageName
		}
	}

	currentGameMode.locations[selectedLocationIndex] = newLocation

	// Reset image upload if used
	if (currentUploadedImage) {
		currentUploadedImage = null
		document.getElementById('locationImage').value = ''
		document.getElementById('imageUrl').value = ''
	}

	// Mark as unsaved when modified
	currentGameMode.saved = false

	updateLocationList()
	updateJsonPreview()
	updateGameModeList()
}

function deleteLocation(index) {
	if (!currentGameMode) return

	currentGameMode.locations.splice(index, 1)
	selectedLocationIndex = -1

	// Mark as unsaved when modified
	currentGameMode.saved = false

	updateLocationList()
	updateJsonPreview()
	updateGameModeList()
}

function createNew() {
	// Create a new game mode
	const newMode = {
		name: 'New Image Pack',
		gameModeId: 'new_image_pack',
		locations: [],
		path: null,
		saved: false,
	}

	// Add to game modes and select it
	gameModes.push(newMode)
	selectGameMode(newMode)

	// Focus the name input for immediate editing
	document.getElementById('gameModeName').focus()
	document.getElementById('gameModeName').select()
}

async function loadFile(path) {
	try {
		// Load from JSON file
		const response = await fetch(path)
		if (!response.ok) throw new Error(`Failed to load ${path}`)
		const data = await response.json()

		const mode = {
			name: data.name,
			gameModeId: data.gameModeId,
			locations: data.locations,
			path: `imagePacks/${data.gameModeId}/pack.json`,
			saved: true,
		}

		// Add to game modes
		gameModes.push(mode)
		selectGameMode(mode)
	} catch (error) {
		console.error('Error loading file:', error)
		alert('Error loading file. Check console for details.')
	}
}

async function loadLocalFile(event) {
	const file = event.target.files[0]
	if (!file) return

	try {
		let data

		// Check if it's a zip file
		if (file.name.endsWith('.zip')) {
			// Load the zip
			const zipData = await file.arrayBuffer()
			const zip = await JSZip.loadAsync(zipData)

			// Get the pack.json file
			const jsonFile = zip.file('pack.json')
			if (!jsonFile) throw new Error('pack.json not found in zip')
			data = JSON.parse(await jsonFile.async('text'))

			// Load all images into our uploadedImages map
			const imagesFolder = zip.folder('images')
			if (imagesFolder) {
				for (const location of data.locations) {
					const imageName = location.image.split('/').pop()
					const imageFile = imagesFolder.file(imageName)
					if (imageFile) {
						const blob = new Blob([await imageFile.async('arraybuffer')])
						uploadedImages.set(imageName, {
							file: new File([blob], imageName),
							newFileName: imageName, // Keep same name for existing files
						})
					}
				}
			}
		} else {
			// Regular JSON file
			data = JSON.parse(await file.text())
		}

		// Validate the JSON structure
		if (!data.name || !data.gameModeId || !Array.isArray(data.locations)) {
			throw new Error(
				'Invalid JSON format: must have name, gameModeId, and locations array'
			)
		}

		// Check for duplicate game mode ID
		const existingModeIndex = gameModes.findIndex(mode => mode.gameModeId === data.gameModeId)
		if (existingModeIndex !== -1) {
			const existingMode = gameModes[existingModeIndex]
			if (!confirm(`An image pack with ID "${data.gameModeId}" already exists.\n\nReplace "${existingMode.name}" with "${data.name}"?`)) {
				// User cancelled, reset file input
				event.target.value = ''
				return
			}
			// Remove the existing mode
			gameModes.splice(existingModeIndex, 1)
		}

		const mode = {
			name: data.name,
			gameModeId: data.gameModeId,
			locations: data.locations,
			path: `locationData/${data.gameModeId}.zip`, // Use .zip extension
			saved: false,
		}

		// Add to game modes
		gameModes.push(mode)
		selectGameMode(mode)
	} catch (error) {
		console.error('Error reading local file:', error)
		alert(`Error reading file: ${error.message}`)
	} finally {
		// Clear the file input so the same file can be loaded again
		event.target.value = ''
	}
}

async function saveFile() {
	if (!currentGameMode) {
		alert('No game mode selected')
		return
	}

	// Update current game mode with form values
	currentGameMode.name = document.getElementById('gameModeName').value
	currentGameMode.gameModeId = document.getElementById('gameModeId').value
	currentGameMode.path = `imagePacks/${currentGameMode.gameModeId}/pack.json`
	currentGameMode.saved = true

	// Create a zip file containing the JSON and all images
	const zip = new JSZip()

	// Prepare locations with correct image paths for the JSON
	const locationsForJson = currentGameMode.locations.map((loc) => {
		// If it's a remote URL or blob, keep as-is
		if (/^(https?:)?\/\//.test(loc.image) || loc.image.startsWith('blob:')) {
			return {
				x: loc.x,
				y: loc.y,
				difficulty: loc.difficulty,
				image: loc.image
			}
		}
		// Otherwise, use new name for uploaded images if present, or existing file name
		return {
			x: loc.x,
			y: loc.y,
			difficulty: loc.difficulty,
			image: loc._newImageName ? `images/${loc._newImageName}` : `images/${loc.image.split('/').pop()}`
		}
	})

	// Add the JSON file with new image paths
	const jsonString = JSON.stringify(
		{
			name: currentGameMode.name,
			gameModeId: currentGameMode.gameModeId,
			locations: locationsForJson,
		},
		null,
		2
	)
	zip.file('pack.json', jsonString)

	// Add the images folder
	const imagesFolder = zip.folder('images')

	// Add only local images (skip remote URLs and blobs)
	for (const location of currentGameMode.locations) {
		if (/^(https?:)?\/\//.test(location.image) || location.image.startsWith('blob:')) {
			continue // skip remote/blobs
		}
		let imagePath = location.image
		let imageFileName = imagePath.split('/').pop() // Get just the filename

		// Check if this is a newly uploaded image
		const uploadedImage = uploadedImages.get(imageFileName)
		if (uploadedImage) {
			// Use the new image file and name
			const imageData = await uploadedImage.file.arrayBuffer()
			imagesFolder.file(location._newImageName, imageData)
		} else {
			// This is an existing image, copy it as-is
			try {
				const response = await fetch(imagePath)
				if (response.ok) {
					const imageData = await response.arrayBuffer()
					imagesFolder.file(imageFileName, imageData)
				}
			} catch (error) {
				console.error(`Failed to fetch image: ${imagePath}`, error)
			}
		}
	}

	// Generate the zip file
	const content = await zip.generateAsync({ type: 'blob' })

	// Create a download link for the zip
	const url = URL.createObjectURL(content)
	const a = document.createElement('a')
	a.href = url
	a.download = `${currentGameMode.gameModeId}.zip`
	document.body.appendChild(a)
	a.click()
	document.body.removeChild(a)
	URL.revokeObjectURL(url)

	// Update UI
	updateGameModeList()
}

// Add input change handlers
document.getElementById('gameModeName').addEventListener('input', () => {
	if (!currentGameMode) return
	currentGameMode.name = document.getElementById('gameModeName').value
	currentGameMode.saved = false
	updateGameModeList()
})

document.getElementById('gameModeId').addEventListener('input', () => {
	if (!currentGameMode) return
	currentGameMode.gameModeId = document.getElementById('gameModeId').value
	currentGameMode.path = `locationData/${currentGameMode.gameModeId}.json`
	currentGameMode.saved = false
	updateGameModeList()
})

// Initialize the UI
loadGameModes()
