///////////////////////////////////////////////
////// Geoguessr Clone for Hollow Knight //////
///////////////////////////////////////////////
//BEWARE THIS SOURCE CODE IS AN ABSOLUTE MESS//
///////////////////////////////////////////////

window.onload = loaded

// DOM elements
let locationImgElement;
let mapContainer
let mapCanvas
let finalScoreDisplay
let accuracyElement
let roundElement
let guessButton
let gameOverWindow
let restartButton
let totalRoundsElement
let loadingText
let fullscreenButton
let timerDisplay
let gameOptionsWindow
let startButton
let optionsButton

let timerLengthInput
let timerEnabledInput
let roundCountInput

let imageIsLoaded = false

// Canvas context
let mapCtx

// Game state
let gameStates = {
    guessing: 0,
    guessed: 1,
    gameOver: 2,
    optionsWindow: 3
}
let gameState = gameStates.optionsWindow
let locations = []
let charms = []
let usedLocations = [] // Store previously used locations this round
let currentLocation = null
let currentRound = 0
let totalRounds = 5
let totalScore = 0
let roundScore = 0
let maxScore = 5000
let timerLengthSeconds = 60
let timerEnabled = false
let startTime
let endTime

// Images
let mapImg = new Image()
mapImg.src = 'images/map.png'
let knightPinImg = new Image()
knightPinImg.src = 'images/knightPin.png'
let shadePinImg = new Image()
shadePinImg.src = 'images/shadePin.png'

// Camera properties
let mapCamera = {
    x: -2249,
    y: -1450,
    targetX: 0,
    targetY: 0,
    zoom: 0.125,
    targetZoom: 0.125
}

// Mouse position
let mousePos = {
    x: 0,
    y: 0,
}

// Mouse position relative to camera
let mouseXRelative = 0
let mouseYRelative = 0

// Guess position
let guessPos = null

function loaded() {
    // Camera reset
    mapCamera.targetX = mapCamera.x
    mapCamera.targetY = mapCamera.y

    // HTML Elements
    timerLengthInput = getElement('timerLength')
    timerEnabledInput = getElement('timerEnabled')
    roundCountInput = getElement('roundCount')
    optionsButton = getElement('optionsButton')
    startButton = getElement('startButton')
    gameOptionsWindow = getElement('gameOptionsWindow')
    fullscreenButton = getElement('fullscreenButton')
    loadingText = getElement('loadingText')
    totalRoundsElement = getElement('totalRounds')
    accuracyElement = getElement('accuracy')
    mapContainer = getElement('mapContainer')
    locationImgElement = getElement('locationImg')
    mapCanvas = getElement('mapCanvas')
    finalScoreDisplay = getElement('finalScore')
    roundElement = getElement('round')
    guessButton = getElement('guessButton')
    gameOverWindow = getElement('gameOverWindow')
    restartButton = getElement('restartButton')
    timerDisplay = getElement('timerDisplay')

    // canvas ctx thingy
    mapCtx = mapCanvas.getContext('2d')

    // this function scares me
    addEventListeners()

    // Adds location info to the list
    locationData.forEach(([mapX, mapY, imageSrc, difficulty]) => {
        addLocation(mapX, mapY, imageSrc, difficulty);
    });

    charmData.forEach(([mapX, mapY, imageSrc, difficulty]) => {
        addCharm(mapX, mapY, imageSrc, difficulty);
    });

    gameOptionsWindow.style.display = 'flex'
    loadingText.style.display = 'none'
    setLocation(randIRange(0, locations.length - 1))
    locationImgElement.src = currentLocation.imageSrc

    requestAnimationFrame(update)
}

function restartGame() {
    gameMode = document.getElementById('gameMode').value;
    // Check if roundCountInput value is a valid number
    if (!isNaN(roundCountInput.value) && roundCountInput.value !== '') {
        totalRounds = Number(roundCountInput.value);  // Convert to number
    } else {
        alert('Please use a valid number for round count');
        return;
    }


    timerEnabled = timerEnabledInput.checked

    // Check if timerLengthInput value is a valid number
    if (timerEnabled) {
        if (!isNaN(timerLengthInput.value) && timerLengthInput.value !== '') {
            timerLengthSeconds = Number(timerLengthInput.value);  // Convert to number
        } else if (timerLengthInput.value === '') {
            timerLengthSeconds = 60
        } else {
            alert('Please use a valid number for timer length');
            return;
        }
    }


    gameState = gameStates.guessing
    totalScore = 0;
    currentRound = 0;

    gameOptionsWindow.style.display = 'none'
    gameOverWindow.style.display = 'none';
    guessButton.disabled = true;
    guessButton.innerText = 'Guess!';

    nextRound()
}

function update() {
    // Timer
    if (timerEnabled && gameState === gameStates.guessing) {
        const currentTime = performance.now();
        const remainingTime = endTime - currentTime;

        if (remainingTime <= 0) {
            timerDisplay.innerText = '0.00';
            guessButtonClicked();
        } else {
            timerDisplay.innerText = (remainingTime / 1000).toFixed(2);
        }
    }

    // Drawing
    mapCanvas.width = mapCanvas.clientWidth;
    mapCanvas.height = mapCanvas.clientHeight;
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    mapCtx.save();
    mapCamera.x = lerp(mapCamera.x, mapCamera.targetX, 0.5);
    mapCamera.y = lerp(mapCamera.y, mapCamera.targetY, 0.5);
    mapCamera.zoom = lerp(mapCamera.zoom, mapCamera.targetZoom, 0.25);
    mapCtx.translate(mapCanvas.width / 2, mapCanvas.height / 2);
    mapCtx.scale(mapCamera.zoom, mapCamera.zoom);
    mapCtx.translate(mapCamera.x, mapCamera.y);

    mapCtx.drawImage(mapImg, 0, 0, mapImg.width, mapImg.height);

    if ((gameState === gameStates.guessed || gameState === gameStates.gameOver)) {
        // Draw line between guess and correct spot
        if (guessPos) {
            mapCtx.beginPath();
            mapCtx.moveTo(guessPos.x, guessPos.y);
            mapCtx.lineTo(currentLocation.mapX, currentLocation.mapY);
            mapCtx.strokeStyle = 'red';
            mapCtx.lineWidth = 10;
            mapCtx.stroke();
        }

        // Draw shade at correct spot
        mapCtx.drawImage(
            shadePinImg,
            currentLocation.mapX - (shadePinImg.width / 2),
            currentLocation.mapY - (shadePinImg.height / 2),
        );
    }

    // Draw knight at guessed spot
    if (guessPos) {
        mapCtx.drawImage(
            knightPinImg,
            guessPos.x - (knightPinImg.width / 2),
            guessPos.y - (knightPinImg.height / 2),
        );
    }

    mapCtx.restore();

    mapCtx.font = '20px Trajan Pro Bold';
    if (gameState !== gameStates.guessing && gameState !== gameStates.optionsWindow) {
        const boxWidth = 300;
        const boxHeight = 25;
        const boxX = (mapCanvas.width - boxWidth) / 2;
        const boxY = mapCanvas.height - boxHeight - 20;
        const cornerRadius = 10;

        mapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        mapCtx.beginPath();
        mapCtx.moveTo(boxX + cornerRadius, boxY);
        mapCtx.lineTo(boxX + boxWidth - cornerRadius, boxY);
        mapCtx.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + cornerRadius);
        mapCtx.lineTo(boxX + boxWidth, boxY + boxHeight - cornerRadius);
        mapCtx.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - cornerRadius, boxY + boxHeight);
        mapCtx.lineTo(boxX + cornerRadius, boxY + boxHeight);
        mapCtx.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - cornerRadius);
        mapCtx.lineTo(boxX, boxY + cornerRadius);
        mapCtx.quadraticCurveTo(boxX, boxY, boxX + cornerRadius, boxY);
        mapCtx.closePath();
        mapCtx.fill();

        // Add white border
        mapCtx.strokeStyle = 'white';
        mapCtx.lineWidth = 2;
        mapCtx.stroke();

        mapCtx.fillStyle = '#FFF';
        mapCtx.textAlign = 'center';
        mapCtx.fillText(`You earned ${roundScore} points`, mapCanvas.width / 2, mapCanvas.height - 25);
    }

    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    mapCtx.fillRect(0, 0, 250, 25);

    mapCtx.fillStyle = 'white';
    mapCtx.textAlign = 'left';
    if (guessPos) {
        mapCtx.fillText(
            `Guess: ${Math.round(guessPos.x)}, ${Math.round(guessPos.y)}`,
            10,
            20
        );
    }
    requestAnimationFrame(update);
}

function addEventListeners() {
    optionsButton.addEventListener('click', function () {
        gameOptionsWindow.style.display = 'flex'
        gameOverWindow.style.display = 'none'
    })

    timerEnabledInput.addEventListener('change', function (event) {
        if (event.target.checked) {
            timerLengthInput.disabled = false
            timerDisplay.style.display = 'block'
        } else {
            timerLengthInput.disabled = true
            timerDisplay.style.display = 'none'
        }
    })





    startButton.addEventListener('click', function () {
        restartGame()
    })



    let isDragging = false
    let dragStart = { x: 0, y: 0 }
    let hasMoved = false
    let initialZoom
    let pinchStartDistance

    locationImgElement.addEventListener("dragstart", (event) => {
        event.preventDefault();
    });

    fullscreenButton.addEventListener('click', function () {
        toggleFullscreen()
    })

    document.addEventListener('keypress', function (event) {
        if (event.code === 'Space') {
            guessButtonClicked()
        }
        if (event.key === 'f') {
            toggleFullscreen()
        }
        if (event.key === 'Escape') {
            toggleFullscreen()
        }
    })

    mapCanvas.addEventListener('mousedown', function (event) {
        isDragging = true
        hasMoved = false
        dragStart.x = event.clientX
        dragStart.y = event.clientY
    })

    mapCanvas.addEventListener('mousemove', function (event) {
        const rect = mapCanvas.getBoundingClientRect()
        mousePos.x = (event.clientX - rect.left)
        mousePos.y = (event.clientY - rect.top)
        mouseXRelative = (mousePos.x - mapCanvas.width / 2) / mapCamera.zoom - mapCamera.x
        mouseYRelative = (mousePos.y - mapCanvas.height / 2) / mapCamera.zoom - mapCamera.y

        if (isDragging) {
            let dx = event.clientX - dragStart.x
            let dy = event.clientY - dragStart.y

            if (dx !== 0 || dy !== 0) {
                hasMoved = true
            }

            mapCamera.targetX += dx / mapCamera.zoom
            mapCamera.targetY += dy / mapCamera.zoom

            dragStart.x = event.clientX
            dragStart.y = event.clientY
        }
    })

    mapCanvas.addEventListener('mouseup', function () {
        if (!hasMoved) {
            updateGuessPos()
        }
        isDragging = false
    })

    mapCanvas.addEventListener('mouseleave', function () {
        isDragging = false
    })

    mapCanvas.addEventListener('wheel', function (event) {
        event.preventDefault()
        let zoomFactor = Math.exp(-event.deltaY * 0.001)
        mapCamera.targetZoom *= zoomFactor
        mapCamera.targetZoom = Math.min(Math.max(mapCamera.targetZoom, 0.1), 5)
    })

    // Touch events for mobile support
    mapCanvas.addEventListener('touchstart', function (event) {
        if (event.touches.length === 1) {
            isDragging = true
            hasMoved = false
            dragStart.x = event.touches[0].clientX
            dragStart.y = event.touches[0].clientY
        } else if (event.touches.length === 2) {
            isDragging = false
            pinchStartDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            )
            initialZoom = mapCamera.targetZoom
        }
    })

    mapCanvas.addEventListener('touchmove', function (event) {
        if (event.touches.length === 1 && isDragging) {
            const rect = mapCanvas.getBoundingClientRect()
            mousePos.x = (event.touches[0].clientX - rect.left)
            mousePos.y = (event.touches[0].clientY - rect.top)
            mouseXRelative = (mousePos.x - mapCanvas.width / 2) / mapCamera.zoom - mapCamera.x
            mouseYRelative = (mousePos.y - mapCanvas.height / 2) / mapCamera.zoom - mapCamera.y

            let dx = event.touches[0].clientX - dragStart.x
            let dy = event.touches[0].clientY - dragStart.y

            if (dx !== 0 || dy !== 0) {
                hasMoved = true
            }

            mapCamera.targetX += dx / mapCamera.zoom
            mapCamera.targetY += dy / mapCamera.zoom

            dragStart.x = event.touches[0].clientX
            dragStart.y = event.touches[0].clientY
        } else if (event.touches.length === 2) {
            const currentDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            )
            const zoomFactor = currentDistance / pinchStartDistance
            mapCamera.targetZoom = initialZoom * zoomFactor
            mapCamera.targetZoom = Math.min(Math.max(mapCamera.targetZoom, 0.1), 5)
        }
    })

    mapCanvas.addEventListener('touchend', function () {
        if (!hasMoved) {
            updateGuessPos()
        }
        isDragging = false
    })

    guessButton.addEventListener('click', function () {
        guessButtonClicked()
    });

    restartButton.addEventListener('click', function () {

        restartGame();

    })
}

function toggleFullscreen() {
    if (mapContainer.classList.contains('fullscreen')) {
        mapContainer.classList.remove('fullscreen');
    } else {
        mapContainer.classList.add('fullscreen');
    }
}

function updateGuessPos() {
    if (gameState === gameStates.guessing) {
        guessPos = {
            x: mouseXRelative,
            y: mouseYRelative
        }



        guessButton.disabled = false

    }
}

function guessButtonClicked() {
    if (guessPos == null && gameState === gameStates.guessing) {
        roundScore = 0;
        gameState = gameStates.guessed;
        guessButton.disabled = false;
        if (currentRound >= totalRounds) {
            guessButton.innerText = 'End Game';
            gameState = gameStates.gameOver;
        } else {
            guessButton.innerText = 'Next Round';
        }
        mapCamera.targetX = -currentLocation.mapX;
        mapCamera.targetY = -currentLocation.mapY;
        mapCamera.targetZoom = 1;

    } else if (gameState === gameStates.guessing) {
        gameState = gameStates.guessed;
        calculateScore();
        if (currentRound >= totalRounds) {
            guessButton.innerText = 'End Game';
            gameState = gameStates.gameOver;
        } else {
            guessButton.innerText = 'Next Round';
        }

        // Set the mapCamera's position and zoom to the middle of guessPos and the location's position
        const midX = (guessPos.x + currentLocation.mapX) / 2;
        const midY = (guessPos.y + currentLocation.mapY) / 2;
        mapCamera.targetX = -midX;
        mapCamera.targetY = -midY;
        const dx = Math.abs(guessPos.x - currentLocation.mapX);
        const dy = Math.abs(guessPos.y - currentLocation.mapY);
        const distance = Math.sqrt(dx * dx + dy * dy);
        const padding = 30;

        // Calculate the required zoom level to fit both points
        const requiredZoomX = mapCanvas.width / (distance + padding);
        const requiredZoomY = mapCanvas.height / (distance + padding);
        mapCamera.targetZoom = Math.min(Math.max(requiredZoomX, 0.1), Math.max(requiredZoomY, 0.1), 2);
    } else if (gameState === gameStates.guessed) {
        if (currentRound < totalRounds) {
            if (mapContainer.classList.contains('fullscreen')) {
                mapContainer.classList.remove('fullscreen');
            }

            nextRound();
            guessButton.disabled = true;
            guessButton.innerText = 'Guess!';
        }
    } else if (gameState === gameStates.gameOver) {
        guessButton.disabled = true;
        gameOverWindow.style.display = 'flex';
        gameState = gameStates.gameOver;
        finalScoreDisplay.innerText = `Final Score: ${totalScore}/${totalRounds * maxScore}`;
        let accuracyPercent = ((totalScore / (totalRounds * maxScore)) * 100).toFixed(2);
        accuracyElement.innerText = `Accuracy: ${accuracyPercent}%`;
        totalRoundsElement.innerText = `Total Rounds: ${totalRounds}`;
        getElement('timerLengthDisplay').innerText = `Timer Length: ${timerLengthSeconds}s`;
    }
}


function setLocation(i) {
    imageIsLoaded = false;

    // Если режим "charms", используйте массив charms
    if (gameMode === 'charms') {
        currentLocation = charms[i]; // Используйте charms для режима "charms"
    } else {
        currentLocation = locations[i]; // Используйте locations для режима "normal"
    }

    if (!currentLocation) {
        console.error("Current location is undefined.");
        return; // Выходите, если currentLocation не определен
    }

    locationImgElement.src = '';
    loadingText.style.display = 'flex';
    const img = new Image();
    img.onload = function () {
        imageIsLoaded = true;
        loadingText.style.display = 'none';
        locationImgElement.src = currentLocation.imageSrc;
        if (guessPos) {
            guessButton.disabled = false;
        }
        if (timerEnabled) {
            startTime = performance.now();
            endTime = startTime + (timerLengthSeconds * 1000);
        }
    };
    img.src = currentLocation.imageSrc;
}

function addLocation(mapX, mapY, imageSrc, difficulty = 0) {
    locations.push(new Location(mapX, mapY, imageSrc, difficulty))
}

function addCharm(mapX, mapY, imageSrc, difficulty = 0) {
    charms.push(new Location(mapX, mapY, imageSrc, difficulty))
}

class Location {
    constructor(mapX, mapY, imageSrc, difficulty = 0) {
        this.mapX = mapX
        this.mapY = mapY
        this.imageSrc = imageSrc
        this.difficulty = difficulty
    }
}

function getElement(id) {
    return document.getElementById(id)
}

function randIRange(min, max) {
    if (min === max) {
        console.warn('randomRange min has same min and max!!')
        return min
    }
    return Math.floor(Math.random() * (max - min + 1) + min)
}

function lerp(start, end, t) {
    return start * (1 - t) + end * t
}



function nextRound() {
    gameState = gameStates.guessing;
    mapCamera.targetX = -2249;
    mapCamera.targetY = -1450;
    mapCamera.targetZoom = 0.125;
    currentRound++;
    roundElement.textContent = `${currentRound}/${totalRounds}`;

    // Check if all locations have been used
    if (usedLocations.length >= locations.length && gameMode === 'normal') {
        alert("You've played every location in this game! You WILL start seeing repeats!");
        usedLocations = []; // Reset if all locations are used
    } else if (usedLocations.length >= charms.length && gameMode === 'charms') {
        alert("You've played every charm location in this game! You WILL start seeing repeats!");
        usedLocations = []; // Reset if all charm locations are used
    }

    let newLocationIndex;

    if (gameMode === 'charms') {
        const availableCharmLocations = charms.filter((_, index) => !usedLocations.includes(index));
        if (availableCharmLocations.length > 0) {
            newLocationIndex = randIRange(0, availableCharmLocations.length - 1);
            const selectedLocation = availableCharmLocations[newLocationIndex];
            const originalIndex = charms.indexOf(selectedLocation);
            usedLocations.push(originalIndex);
            setLocation(originalIndex);
        } else {
            console.error("No available charm locations found.");
            return;
        }
    } else {
        const availableLocations = locations.filter((_, index) => !usedLocations.includes(index));
        if (availableLocations.length > 0) {
            newLocationIndex = randIRange(0, availableLocations.length - 1);
            const selectedLocation = availableLocations[newLocationIndex];
            const originalIndex = locations.indexOf(selectedLocation);
            usedLocations.push(originalIndex);
            setLocation(originalIndex); // Set the location for the round
        } else {
            console.error("No available locations found.");
            return; // Выходите, если нет доступных мест
        }
    }

    guessButton.disabled = true;
    guessPos = null;

    // Reset and start the timer
    if (timerEnabled) {
        startTime = performance.now();
        endTime = startTime + (timerLengthSeconds * 1000);
    }
}

function calculateScore() {
    const dx = guessPos.x - currentLocation.mapX
    const dy = guessPos.y - currentLocation.mapY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const leniency = 50 // Distance in which you get the max score
    const dropOffRate = 0.001 // How quickly the score drops off when guessing farther away! away!
    roundScore = maxScore * Math.exp(-dropOffRate * (distance - leniency))
    roundScore = Math.round(Math.min(roundScore, maxScore))
    totalScore += roundScore
}
