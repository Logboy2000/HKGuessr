window.onload = loadLocationData

let locationDataSources = [
    'locationData/normal.json',
    'locationData/charms.json',
    // This is for testing. Contains just 2 charms
    // 'locationData/charms2.json'
]

// Single object to store all game mode data
let gameModeData = {};

async function loadLocationData() {
    try {
        // Create an array of fetch promises for all sources
        const fetchPromises = locationDataSources.map(source => fetch(source));
        const responses = await Promise.all(fetchPromises);

        // Check if any response failed
        if (responses.some(response => !response.ok)) {
            throw new Error('Failed to load one or more location data sources');
        }

        // Parse all JSON responses
        const dataArray = await Promise.all(responses.map(response => response.json()));

        // Clear existing data
        gameModeData = {};

        // Update game mode select options
        const gameModeSelect = document.getElementById('gameMode');
        gameModeSelect.innerHTML = '';

        // Process each data source
        dataArray.forEach(data => {
            // Convert JSON format to array format for compatibility
            const locations = data.locations.map(loc => {
                // Use the image path as is, since it's already properly formatted in the JSON
                return [
                    loc.x,
                    loc.y,
                    loc.image,
                    loc.difficulty
                ];
            });

            // Store data using gameModeId as the key
            gameModeData[data.gameModeId] = locations;

            // Add option to game mode select
            const option = document.createElement('option');
            option.value = data.gameModeId;
            option.textContent = data.name;
            gameModeSelect.appendChild(option);
        });

        console.log('Location data loaded successfully!');
    } catch (error) {
        console.error('Error loading location data:', error);
        // Fallback to empty object if loading fails
        gameModeData = {};
    }

    dataLoaded()
}