///////////////////////////////////////////////
////// Geoguessr Clone for Hollow Knight //////
///////////////////////////////////////////////
//BEWARE THIS SOURCE CODE IS AN ABOSLUTE MESS//
///////////////////////////////////////////////

window.onload = loaded

// Locations
const locationData = [
    [2581, 1878, 'images/screenshots/1.png'],
    [3451, 842, 'images/screenshots/2.png'],
    [3360, 928, 'images/screenshots/3.png'],
    [3112, 937, 'images/screenshots/4.png'],
    [981, 1322, 'images/screenshots/5.png'],
    [3278, 1363, 'images/screenshots/6.png'],
    [583, 767, 'images/screenshots/7.png'],
    [4367, 1953, 'images/screenshots/8.png'],
    [3965, 1644, 'images/screenshots/9.png'],
    [3350, 1946, 'images/screenshots/10.png'],
    [3906, 1945, 'images/screenshots/11.png'],
    [3670, 1922, 'images/screenshots/12.png'],
    [1193, 967, 'images/screenshots/13.png'],
    [1690, 639, 'images/screenshots/14.png'],
    [301, 1907, 'images/screenshots/15.png'],
    [1914, 871, 'images/screenshots/16.png'],
    [1854, 865, 'images/screenshots/17.png'],
    [2103, 2239, 'images/screenshots/18.png'],
    [2057, 1760, 'images/screenshots/19.png'],
    [2022, 616, 'images/screenshots/20.png'],
    [2052, 624, 'images/screenshots/21.png'],
    [3493, 2002, 'images/screenshots/22.png'],
    [3683, 1712, 'images/screenshots/23.png'],
    [2963, 482, 'images/screenshots/24.png'],
    [2894, 986, 'images/screenshots/25.png'],
    [2669, 1850, 'images/screenshots/26.png'],
    [2738, 1779, 'images/screenshots/27.png'],
    [3552, 1275, 'images/screenshots/28.png'],
    [2716, 1548, 'images/screenshots/29.png'],
    [3832, 1449, 'images/screenshots/30.png'],
    [3849, 1527, 'images/screenshots/31.png'],
    [3839, 1370, 'images/screenshots/32.png'],
    [2053, 844, 'images/screenshots/33.png'],
    [2244, 799, 'images/screenshots/34.png'],
    [2557, 878, 'images/screenshots/35.png'],
    [3590, 1535, 'images/screenshots/36.png'],
    [2074, 936, 'images/screenshots/37.png'],
    [2404, 2077, 'images/screenshots/38.png'],
    [2558, 922, 'images/screenshots/39.png'],
    [2630, 2258, 'images/screenshots/40.png'],
    [2773, 2065, 'images/screenshots/41.png'],
    [3221, 2228, 'images/screenshots/42.png'],
    [3035, 2227, 'images/screenshots/43.png'],
    [2726, 2346, 'images/screenshots/44.png'],
    [1858, 2269, 'images/screenshots/45.png'],
    [2138, 2374, 'images/screenshots/46.png'],
    [2448, 2261, 'images/screenshots/47.png'],
    [2734, 2192, 'images/screenshots/48.png'],
    [2353, 2119, 'images/screenshots/49.png'],
    [2522, 2071, 'images/screenshots/50.png'],
    [1970, 1835, 'images/screenshots/51.png'],
    [2910, 1745, 'images/screenshots/52.png'],
    [2893, 1634, 'images/screenshots/53.png'],
];

// Frame rate and timing
var fps = 0
var deltaTime

// DOM elements
var locationImgElement
var mapContainer
var mapCanvas
var finalScoreDisplay
var accuracyElement
var roundElement
var guessButton
var gameOverWindow
var restartButton
var totalRoundsElement
var loadingText
var fullscreenButton
var timerDisplay
var gameOptionsWindow
var startButton
var optionsButton

var timerLengthInput
var timerEnabledInput
var roundCountInput

var imageIsLoaded = false

// Canvas context
var mapCtx

// Game state
var gameStates = {
    guessing: 0,
    guessed: 1,
    gameOver: 2,
    optionsWindow: 3
}
var gameState = gameStates.optionsWindow
var locations = []
var usedLocations = [] // Store previously used locations this round
var currentLocation = null
var currentRound = 0
var totalRounds = 5
var totalScore = 0
var roundScore = 0
var maxScore = 5000
var timerLengthSeconds = 60
var timerEnabled = false
var startTime
var endTime

// Images
var mapImg = new Image()
mapImg.src = 'images/map.png'
var knightPinImg = new Image()
knightPinImg.src = 'images/knightPin.png'
var shadePinImg = new Image()
shadePinImg.src = 'images/shadePin.png'

// Camera properties
var mapCamera = {
    x: -2249,
    y: -1450,
    targetX: 0,
    targetY: 0,
    zoom: 0.125,
    targetZoom: 0.125
}

// Mouse position
var mousePos = {
    x: 0,
    y: 0,
}

// Mouse position relative to camera
var mouseXRelative = 0
var mouseYRelative = 0

// Guess position
var guessPos = null

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
    locationData.forEach(([mapX, mapY, imageFilename]) => {
        addLocation(mapX, mapY, imageFilename);
    });

    gameOptionsWindow.style.display = 'flex'
    loadingText.style.display = 'none'
    setLocation(randIRange(0, locations.length - 1))
    locationImgElement.src = currentLocation.imageSrc

    requestAnimationFrame(update)
}

function restartGame() {
    // Check if roundCountInput value is a valid number
    if (!isNaN(roundCountInput.value) && roundCountInput.value !== '') {
        totalRounds = Number(roundCountInput.value);  // Convert to number
    } else {
        alert('Please use a valid number for round count');
        return;
    }

    // Check if timerLengthInput value is a valid number
    if (!isNaN(timerLengthInput.value) && timerLengthInput.value !== '') {
        timerLengthSeconds = Number(timerLengthInput.value);  // Convert to number
    } else {
        alert('Please use a valid number for timer length');
        return;
    }

    timerEnabled = timerEnabledInput.checked
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
    //timer
    if (timerEnabled) {
        if (gameState == gameStates.guessing) {
            if (performance.now() > endTime) {
                gameState = gameStates.guessed
                timerDisplay.innerText = 0
                guessButtonClicked()
            } else {
                timerDisplay.innerText = ((endTime - performance.now()) / 1000).toFixed(2)
            }
        }
    }


    //DrAWING
    mapCanvas.width = mapCanvas.clientWidth
    mapCanvas.height = mapCanvas.clientHeight
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height)
    mapCtx.save()
    mapCamera.x = lerp(mapCamera.x, mapCamera.targetX, 0.5)
    mapCamera.y = lerp(mapCamera.y, mapCamera.targetY, 0.5)
    mapCamera.zoom = lerp(mapCamera.zoom, mapCamera.targetZoom, 0.25)
    mapCtx.translate(mapCanvas.width / 2, mapCanvas.height / 2)
    mapCtx.scale(mapCamera.zoom, mapCamera.zoom)
    mapCtx.translate(mapCamera.x, mapCamera.y)

    mapCtx.drawImage(mapImg, 0, 0, mapImg.width, mapImg.height)

    if ((gameState == gameStates.guessed || gameState == gameStates.gameOver)) {
        // Draw line between guess and correct spot
        if (guessPos) {
            mapCtx.beginPath()
            mapCtx.moveTo(guessPos.x, guessPos.y)
            mapCtx.lineTo(currentLocation.mapX, currentLocation.mapY)
            mapCtx.strokeStyle = 'red'
            mapCtx.lineWidth = 10
            mapCtx.stroke()
        }

        //draw shade at correct spot
        mapCtx.drawImage(
            shadePinImg,
            currentLocation.mapX - (shadePinImg.width / 2),
            currentLocation.mapY - (shadePinImg.height / 2),
        )


    }

    //draw knight at guessed spot
    if (guessPos) {
        mapCtx.drawImage(
            knightPinImg,
            guessPos.x - (knightPinImg.width / 2),
            guessPos.y - (knightPinImg.height / 2),
        )
    }

    mapCtx.restore()

    mapCtx.font = '20px Trajan Pro Bold'
    if (gameState != gameStates.guessing && gameState != gameStates.optionsWindow) {
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

        mapCtx.fillStyle = '#FFF'
        mapCtx.textAlign = 'center'
        mapCtx.fillText(`You earned ${roundScore} points`, mapCanvas.width / 2, mapCanvas.height - 25)
    }

    mapCtx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    mapCtx.fillRect(0, 0, 250, 25)

    mapCtx.fillStyle = 'white'
    mapCtx.textAlign = 'left'
    if (guessPos) {
        mapCtx.fillText(
            `Guess: ${Math.round(guessPos.x)}, ${Math.round(guessPos.y)}`,
            10,
            20
        )
    }
    requestAnimationFrame(update)
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



    var isDragging = false
    var dragStart = { x: 0, y: 0 }
    var hasMoved = false

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
            var dx = event.clientX - dragStart.x
            var dy = event.clientY - dragStart.y

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
        var zoomFactor = Math.exp(-event.deltaY * 0.001)
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

            var dx = event.touches[0].clientX - dragStart.x
            var dy = event.touches[0].clientY - dragStart.y

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
    if (gameState == gameStates.guessing) {
        guessPos = {
            x: mouseXRelative,
            y: mouseYRelative
        }
        if (imageIsLoaded) {
            guessButton.disabled = false
        }
    }
}

function guessButtonClicked() {
    if (guessPos == null) {
        return -1
    }

    if (gameState === gameStates.guessing) {
        gameState = gameStates.guessed;
        calculateScore();
        if (currentRound >= totalRounds) {
            guessButton.innerText = 'End Game';
            gameState = gameStates.gameOver
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
            gameState = gameStates.guessing;
            nextRound();
            guessButton.disabled = true;
            guessButton.innerText = 'Guess!';
        }
    } else if (gameState === gameStates.gameOver) {
        guessButton.disabled = true;
        gameOverWindow.style.display = 'flex';
        gameState = gameStates.gameOver;
        finalScoreDisplay.innerText = `Final Score: ${totalScore}/${totalRounds * maxScore}`
        var accuracyPercent = ((totalScore / (totalRounds * maxScore)) * 100).toFixed(2)
        accuracyElement.innerText = `Accuracy: ${accuracyPercent}%`
        totalRoundsElement.innerText = `Total Rounds: ${totalRounds}`
        getElement('timerLengthDisplay').innerText = `Timer Length: ${timerLengthSeconds}s`
        usedLocations = []
    }
}



function setLocation(i) {
    imageIsLoaded = false
    currentLocation = locations[i]
    locationImgElement.src = ''
    loadingText.style.display = 'flex'
    const img = new Image()
    img.onload = function () {
        imageIsLoaded = true
        loadingText.style.display = 'none'
        locationImgElement.src = currentLocation.imageSrc
        if (guessPos) {
            guessButton.disabled = false
        }
        if (timerEnabled) {
            startTime = performance.now()
            endTime = startTime + (timerLengthSeconds * 1000)
        }
    }
    img.src = currentLocation.imageSrc
}

function addLocation(mapX, mapY, imageSrc) {
    locations.push(new Location(mapX, mapY, imageSrc))
}

class Location {
    constructor(mapX, mapY, imageSrc) {
        this.mapX = mapX
        this.mapY = mapY
        this.imageSrc = imageSrc
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

    mapCamera.targetX = -2249;
    mapCamera.targetY = -1450;
    mapCamera.targetZoom = 0.125;
    currentRound++;
    roundElement.textContent = `${currentRound}/${totalRounds}`;

    if (usedLocations.length >= locations.length) {
        console.log("All locations used! Restarting selection.");
        usedLocations = []; // Reset if all locations are used
    }

    let newLocation;
    do {
        newLocation = randIRange(0, locations.length - 1);
    } while (usedLocations.includes(newLocation)); // Ensure uniqueness

    usedLocations.push(newLocation);
    setLocation(newLocation);

    guessButton.disabled = true;
    guessPos = null;
}


function calculateScore() {
    const dx = guessPos.x - currentLocation.mapX
    const dy = guessPos.y - currentLocation.mapY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const leniency = 50 // Distance in which you get the max score
    const dropOffRate = 0.001 // How quickly the score drops off when guessing farther aue aue
    roundScore = maxScore * Math.exp(-dropOffRate * (distance - leniency))
    roundScore = Math.round(Math.min(roundScore, maxScore))
    totalScore += roundScore
}