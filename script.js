// Geoguessr Clone for Hollow Knight
window.onload = loaded

// Locations
const locationData = [
    [0, 0, 'images/screenshots/1.png'],
    [100, 200, 'images/screenshots/2.png'],
    [300, 400, 'images/screenshots/3.png'],
    [500, 600, 'images/screenshots/4.png'],
    [700, 800, 'images/screenshots/5.png'],
    [900, 1000, 'images/screenshots/6.png'],
    [1100, 1200, 'images/screenshots/7.png'],
    [1300, 1400, 'images/screenshots/8.png'],
    [1500, 1600, 'images/screenshots/9.png'],
    [1700, 1800, 'images/screenshots/10.png'],
    [1900, 2000, 'images/screenshots/11.png'],
    [2100, 2200, 'images/screenshots/12.png'],
    [2300, 2400, 'images/screenshots/13.png'],
    [2500, 2600, 'images/screenshots/14.png'],
    [2700, 2800, 'images/screenshots/15.png'],
    [2900, 3000, 'images/screenshots/16.png'],
    [3100, 3200, 'images/screenshots/17.png'],
    [3300, 3400, 'images/screenshots/18.png'],
    [3500, 3600, 'images/screenshots/19.png'],
    [3700, 3800, 'images/screenshots/20.png'],
    [3900, 4000, 'images/screenshots/21.png'],
    [4100, 4200, 'images/screenshots/22.png'],
    [4300, 4400, 'images/screenshots/23.png'],
    [4500, 4600, 'images/screenshots/24.png'],
    [4700, 4800, 'images/screenshots/25.png'],
    [4900, 5000, 'images/screenshots/26.png'],
    [5100, 5200, 'images/screenshots/27.png'],
    [5300, 5400, 'images/screenshots/28.png'],
    [5500, 5600, 'images/screenshots/29.png'],
    [5700, 5800, 'images/screenshots/30.png'],
    [5900, 6000, 'images/screenshots/31.png'],
    [6100, 6200, 'images/screenshots/32.png'],
    [6300, 6400, 'images/screenshots/33.png'],
    [6500, 6600, 'images/screenshots/34.png'],
    [6700, 6800, 'images/screenshots/35.png'],
    [6900, 7000, 'images/screenshots/36.png'],
    [7100, 7200, 'images/screenshots/37.png'],
    [7300, 7400, 'images/screenshots/38.png'],
    [7500, 7600, 'images/screenshots/39.png'],
    [7700, 7800, 'images/screenshots/40.png'],
    [7900, 8000, 'images/screenshots/41.png'],
    [8100, 8200, 'images/screenshots/42.png'],
    [8300, 8400, 'images/screenshots/43.png'],
    [8500, 8600, 'images/screenshots/44.png'],
    [8700, 8800, 'images/screenshots/45.png'],
    [8900, 9000, 'images/screenshots/46.png'],
    [9100, 9200, 'images/screenshots/47.png'],
    [9300, 9400, 'images/screenshots/48.png'],
    [9500, 9600, 'images/screenshots/49.png'],
    [9700, 9800, 'images/screenshots/50.png'],
    [9900, 10000, 'images/screenshots/51.png'],
    [10100, 10200, 'images/screenshots/52.png'],
    [10300, 10400, 'images/screenshots/53.png'],
    [10500, 10600, 'images/screenshots/54.png'],
    [10700, 10800, 'images/screenshots/55.png'],
    [10900, 11000, 'images/screenshots/56.png'],
    [11100, 11200, 'images/screenshots/57.png'],
    [11300, 11400, 'images/screenshots/58.png'],
    [11500, 11600, 'images/screenshots/59.png'],
    [11700, 11800, 'images/screenshots/60.png'],
    [11900, 12000, 'images/screenshots/61.png'],
    [12100, 12200, 'images/screenshots/62.png'],
    [12300, 12400, 'images/screenshots/63.png'],
    [12500, 12600, 'images/screenshots/64.png'],
    [12700, 12800, 'images/screenshots/65.png'],
    [12900, 13000, 'images/screenshots/66.png'],
    [13100, 13200, 'images/screenshots/67.png'],
    [13300, 13400, 'images/screenshots/68.png'],
    [13500, 13600, 'images/screenshots/69.png'],
    [13700, 13800, 'images/screenshots/70.png'],
    [13900, 14000, 'images/screenshots/71.png'],
    [14100, 14200, 'images/screenshots/72.png'],
    [14300, 14400, 'images/screenshots/73.png'],
    [14500, 14600, 'images/screenshots/74.png'],
    [14700, 14800, 'images/screenshots/75.png'],
    [14900, 15000, 'images/screenshots/76.png'],
    [15100, 15200, 'images/screenshots/77.png'],
    [15300, 15400, 'images/screenshots/78.png']
];

// Frame rate and timing
var fps = 0
var deltaTime

// DOM elements
var locationImgElement
var mapCanvas
var scoreElement
var roundElement
var guessButton

// Canvas context
var mapCtx

// Game state
var gameStates = {
    guessing: 0,
    guessed: 1,
    gameOver: 2
}
var gameState = gameStates.guessing
var locations = []
var currentLocation = null
var currentRound = 0
var totalRounds = 5
var score = 0

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
    //camera
    mapCamera.targetX = mapCamera.x
    mapCamera.targetY = mapCamera.y

    //Elements
    locationImgElement = getElement('locationImg')
    mapCanvas = getElement('mapCanvas')
    scoreElement = getElement('score')
    roundElement = getElement('round')
    guessButton = getElement('guessButton')
    //CTX
    mapCtx = mapCanvas.getContext('2d')

    addEventListeners()

    locationData.forEach(([mapX, mapY, imageFilename]) => {
        addLocation(mapX, mapY, imageFilename);
    });

    startNewRound()

    requestAnimationFrame(update)
}

function updateGuessPos() {
    if (gameState == gameStates.guessing) {
        guessPos = {
            x: mouseXRelative,
            y: mouseYRelative
        }
        guessButton.disabled = false
    }

}

function addEventListeners() {
    var isDragging = false
    var dragStart = { x: 0, y: 0 }
    var hasMoved = false

    document.addEventListener('keypress', function (event) {
        if (event.code === 'Space') {
            updateGuessPos()
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
        var zoomAmount = -event.deltaY * 0.001
        mapCamera.targetZoom += zoomAmount
        mapCamera.targetZoom = Math.min(Math.max(mapCamera.targetZoom, 0.1), 5)
    })

    guessButton.addEventListener('click', function () {


        switch (gameState) {
            case gameStates.guessed:
                if (currentRound < totalRounds) {
                    guessButton.innerText = 'Guess!'
                    startNewRound()
                } else {
                    alert(`Game over! Your final score is ${score}`)
                }
                break
            case gameStates.guessing:
                calculateScore()
                guessButton.innerText = 'Next Round'
                gameState = gameStates.guessed
                break
        }

    })
}

function update() {
    mapCanvas.width = mapCanvas.clientWidth
    mapCanvas.height = mapCanvas.clientHeight
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height)
    mapCtx.save()
    mapCamera.x = lerp(mapCamera.x, mapCamera.targetX, 0.25)
    mapCamera.y = lerp(mapCamera.y, mapCamera.targetY, 0.25)
    mapCamera.zoom = lerp(mapCamera.zoom, mapCamera.targetZoom, 0.25)
    mapCtx.translate(mapCanvas.width / 2, mapCanvas.height / 2)
    mapCtx.scale(mapCamera.zoom, mapCamera.zoom)
    mapCtx.translate(mapCamera.x, mapCamera.y)

    mapCtx.drawImage(mapImg, 0, 0, mapImg.width, mapImg.height)

    if (gameState == gameStates.guessed && guessPos) {
        // Draw line between guess and correct spot
        mapCtx.beginPath()
        mapCtx.moveTo(guessPos.x, guessPos.y)
        mapCtx.lineTo(currentLocation.mapX, currentLocation.mapY)
        mapCtx.strokeStyle = 'red'
        mapCtx.lineWidth = 10
        mapCtx.stroke()

        //draw shade at correct spot
        mapCtx.drawImage(shadePinImg,
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
    mapCtx.fillStyle = 'white'
    mapCtx.font = '20px Trajan Pro Bold'
    mapCtx.fillText(
        `Mouse: ${Math.round(mouseXRelative)}, ${Math.round(mouseYRelative)}`,
        10,
        20
    )
    if (guessPos) {
        mapCtx.fillText(
            `Guess: ${Math.round(guessPos.x)}, ${Math.round(guessPos.y)}`,
            10,
            40
        )
    }
    requestAnimationFrame(update)
}

function setLocation(i) {
    currentLocation = locations[i]
    locationImgElement.src = currentLocation.imageSrc
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

function startNewRound() {
    gameState = gameStates.guessing
    currentRound++
    roundElement.textContent = `Round: ${currentRound}/${totalRounds}`
    setLocation(randIRange(0, locations.length - 1))
    guessButton.disabled = true
    guessPos = null
}

function calculateScore() {
    const dx = guessPos.x - currentLocation.mapX
    const dy = guessPos.y - currentLocation.mapY
    const distance = Math.sqrt(dx * dx + dy * dy)
    const leniency = 100
    var roundScore = 1000
    if (distance > leniency) {
        roundScore = Math.max(0, 1000 - (distance - leniency))
    }
    score += Math.round(roundScore)
    scoreElement.textContent = `Score: ${score}`
}
