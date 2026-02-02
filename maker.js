

import { Projectron } from './projectron'
var $ = s => document.getElementById(s)




/*
 * 
 * 
 *      init projectron
 * 
 * 
*/

// allow internal comparison texture size to be specified in query
var size = 256
var s = parseInt(new URLSearchParams(location.search).get('size'))
if (s > 8) size = s

var canvas = $('view')
var proj = new Projectron(canvas, size)

var imgSide = null
var dualViewEnabled = false
var frontImageLoaded = false
var sideImageLoaded = false
var pendingData = null

// Load default front image
var img = new Image()
img.onload = () => { setImage(img) }
img.src = './img/mona512.jpg'

// img.src = './img/lena.png'
// img.src = './img/teapot512.png'

// Load default side image
var imgSideDefault = new Image()
imgSideDefault.onload = () => { setImageSide(imgSideDefault) }
imgSideDefault.src = './img/monaside.png'

function setImage(img) {
    generations = 0
    proj.setTargetImage(img)
    frontImageLoaded = true
    checkAndLoadPendingData()
}

function setImageSide(img) {
    imgSide = img
    generations = 0
    proj.setTargetImageSide(img)
    dualViewEnabled = true
    sideImageLoaded = true
    updateHTML()
    checkAndLoadPendingData()
}

function checkAndLoadPendingData() {
    // Only import data after both images are loaded
    if (pendingData && frontImageLoaded && sideImageLoaded) {
        console.log('Both images loaded, importing data')
        proj.importData(pendingData)
        pendingData = null
        drawNeeded = true
    }
}

// Load default data from data.txt on startup
fetch('./data.txt')
    .then(response => response.text())
    .then(data => {
        if (data && data.trim().length > 0) {
            console.log('Data loaded, waiting for images...')
            pendingData = data
            checkAndLoadPendingData()
        }
    })
    .catch(err => {
        console.log('No default data file found or error loading:', err.message)
    })

console.log('GLSL-Projectron  ver ' + proj.version)








/*
 * 
 * 
 *      rendering loop
 * 
 * 
*/

var paused = true
var showReference = false
var showScratch = false
var showSideView = false

var cameraRot = [0, 0]
var generations = 0
var gensPerFrame = 20
var gensPerSec = 0

// flags etc
var drawNeeded = true
var lastDraw = 0
var lastGenCt = 0
var lastHtmlUpdate = 0


// core RAF loop
function render() {
    if (!paused && frontImageLoaded && (!dualViewEnabled || sideImageLoaded)) {
        for (var i = 0; i < gensPerFrame; i++) proj.runGeneration()
        generations += gensPerFrame
    }
    var now = performance.now()
    if (now - lastHtmlUpdate > 500) {
        gensPerSec = (generations - lastGenCt) / (now - lastHtmlUpdate) * 1000
        updateHTML()
        lastGenCt = generations
        lastHtmlUpdate = now
    }
    if (now - lastDraw > 500 || (paused && drawNeeded)) {
        var mode = (showReference) ? 1 : (showScratch) ? 2 : 0
        if (showSideView && dualViewEnabled) {
            // render side view
            if (showReference) {
                proj.drawSideReference()
            } else if (showScratch) {
                proj._drawSideScratchImage()
            } else {
                proj.drawSideView(-cameraRot[0], -cameraRot[1])
            }
        } else {
            // render front view
            switch (mode) {
                case 0: proj.draw(-cameraRot[0], -cameraRot[1]); break
                case 1: proj.drawTargetImage(); break
                case 2: proj._drawScratchImage(); break
            }
        }
        drawNeeded = false
        lastDraw = now
    }
    requestAnimationFrame(render)
}
render()











/*
 * 
 * 
 *      settings / ui
 * 
 * 
*/

var setupInput = (el, handler) => {
    $(el).addEventListener('change', ev => {
        var t = ev.target.type
        if (t === 'checkbox') return handler(ev.target.checked)
        return handler(ev.target.value)
    })
}

setupInput('paused', val => { paused = val })
setupInput('showRef', val => { showReference = val; drawNeeded = true })
setupInput('showScr', val => { showScratch = val; drawNeeded = true })
setupInput('showSide', val => { showSideView = val; drawNeeded = true })
setupInput('gensPerFrame', val => { gensPerFrame = parseInt(val) })

var minAlpha = 0.1
var maxAlpha = 0.5
var setAlpha = () => proj.setAlphaRange(minAlpha, maxAlpha)
setupInput('minAlpha', val => { minAlpha = parseFloat(val); setAlpha() })
setupInput('maxAlpha', val => { maxAlpha = parseFloat(val); setAlpha() })
setupInput('adjust', val => { proj.setAdjustAmount(parseFloat(val) || 0.5) })
setupInput('preferFewer', val => { proj.setFewerPolyTolerance(parseFloat(val) || 0) })

// Performance optimization controls
setupInput('mutationsPerGen', val => { 
    proj.setMutationsPerGeneration(parseInt(val) || 1)
})
setupInput('fastMode', val => { 
    proj.setFastMode(val)
})

// Dual-view weight controls
var frontWeight = 0.5
var sideWeight = 0.5
setupInput('frontWeight', val => {
    frontWeight = parseFloat(val)
    sideWeight = 1 - frontWeight
    proj.setViewWeights(frontWeight, sideWeight)
    if ($('sideWeight')) $('sideWeight').value = sideWeight.toFixed(2)
    drawNeeded = true
    updateHTML()
})
setupInput('sideWeight', val => {
    sideWeight = parseFloat(val)
    frontWeight = 1 - sideWeight
    proj.setViewWeights(frontWeight, sideWeight)
    if ($('frontWeight')) $('frontWeight').value = frontWeight.toFixed(2)
    drawNeeded = true
    updateHTML()
})

$('export').addEventListener('click', ev => {
    var dat = proj.exportData()
    $('data').value = dat
})

$('import').addEventListener('click', ev => {
    var dat = $('data').value
    if (!dat) return
    
    // Check if images are loaded before importing
    if (frontImageLoaded && (!dualViewEnabled || sideImageLoaded)) {
        var res = proj.importData(dat)
        if (res) $('data').value = ''
        drawNeeded = true
    } else {
        // Defer import until images load
        pendingData = dat
        console.log('Import deferred until images load')
    }
})

function updateHTML() {
    $('polys').value = proj.getNumPolys()
    if (dualViewEnabled) {
        $('score').value = proj.getScoreFront().toFixed(5)
        if ($('scoreSide')) $('scoreSide').value = proj.getScoreSide().toFixed(5)
        if ($('scoreCombined')) $('scoreCombined').value = proj.getScoreCombined().toFixed(5)
    } else {
        $('score').value = proj.getScore().toFixed(5)
    }
    $('gens').value = generations
    $('gps').value = gensPerSec.toFixed(0)
    $('paused').checked = paused
}

document.onkeydown = ev => {
    if (ev.keyCode === 32) {
        ev.preventDefault()
        paused = !paused
        $('paused').checked = paused
    }
}








/*
 * 
 *      mouse drag / cameraAngle
 * 
*/

var rotScale = 1 / 150
var cameraReturn = 0.9
var dragging = false
var lastLoc = [0, 0]

// Snapping settings
var snapThreshold = 0.2  // How close to snap point before snapping (in radians, ~11.5 degrees)
var snapStrength = 0.5    // How strongly to pull toward snap point (0-1)
var snapPoints = {
    horizontal: [0, Math.PI / 2, Math.PI, -Math.PI / 2],  // Front, Right, Back, Left
    vertical: [0]  // Level (could add Math.PI/2, -Math.PI/2 for top/bottom)
}
var getEventLoc = ev => {
    if (typeof ev.clientX === 'number') return [ev.clientX, ev.clientY]
    if (ev.targetTouches && ev.targetTouches.length) {
        var touch = ev.targetTouches[0]
        return [touch.clientX, touch.clientY]
    }
    return null
}
var startDrag = ev => {
    ev.preventDefault()
    dragging = true
    lastLoc = getEventLoc(ev) || lastLoc
}
var drag = ev => {
    if (!dragging) return
    var loc = getEventLoc(ev)
    if (!loc) return
    ev.preventDefault()
    cameraRot[0] += (loc[0] - lastLoc[0]) * rotScale
    cameraRot[1] += (loc[1] - lastLoc[1]) * rotScale
    lastLoc = loc
    drawNeeded = true
}
var stopDrag = ev => {
    dragging = false
    returnCamera()
}
canvas.addEventListener('mousedown', startDrag)
canvas.addEventListener('touchstart', startDrag)
document.body.addEventListener('mouseup', stopDrag)
document.body.addEventListener('touchend', stopDrag)
document.body.addEventListener('mousemove', drag)
document.body.addEventListener('touchmove', drag)


// Find nearest snap point for an angle
function findNearestSnap(angle, snapArray) {
    var nearest = null
    var minDist = Infinity
    
    snapArray.forEach(snapPoint => {
        var dist = Math.abs(normalizeAngle(angle - snapPoint))
        if (dist < minDist) {
            minDist = dist
            nearest = snapPoint
        }
    })
    
    return { point: nearest, distance: minDist }
}

// Normalize angle to [-PI, PI]
function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= 2 * Math.PI
    while (angle < -Math.PI) angle += 2 * Math.PI
    return angle
}

// Apply snapping to camera rotation
function applySnapping() {
    var snappedH = false
    var snappedV = false
    
    // Check horizontal rotation (around Y axis)
    var hSnap = findNearestSnap(cameraRot[0], snapPoints.horizontal)
    if (hSnap.distance < snapThreshold) {
        var diff = normalizeAngle(hSnap.point - cameraRot[0])
        cameraRot[0] += diff * snapStrength
        snappedH = true
        // If very close, snap exactly
        if (Math.abs(diff) < 0.01) {
            cameraRot[0] = hSnap.point
        }
    }
    
    // Check vertical rotation (around X axis)
    var vSnap = findNearestSnap(cameraRot[1], snapPoints.vertical)
    if (vSnap.distance < snapThreshold) {
        var diff = normalizeAngle(vSnap.point - cameraRot[1])
        cameraRot[1] += diff * snapStrength
        snappedV = true
        // If very close, snap exactly
        if (Math.abs(diff) < 0.01) {
            cameraRot[1] = vSnap.point
        }
    }
    
    return { h: snappedH, v: snappedV }
}


// update/debounce
function returnCamera() {
    if (dragging) return
    
    // Apply snapping effect first
    var snapping = applySnapping()
    
    // Apply damping to move toward rest, but not to snapped axes
    if (!snapping.h) {
        cameraRot[0] *= cameraReturn
        if (Math.abs(cameraRot[0]) < 1e-4) cameraRot[0] = 0
    }
    if (!snapping.v) {
        cameraRot[1] *= cameraReturn
        if (Math.abs(cameraRot[1]) < 1e-4) cameraRot[1] = 0
    }
    
    drawNeeded = true
    
    if (cameraRot[0] || cameraRot[1]) {
        requestAnimationFrame(returnCamera)
    }
}









/*
 * 
 * 
 *      drag-drop new images
 * 
 * 
*/

var dropTarget = document.body
var dropTargetSide = null  // will be set if side drop zone exists

window.addEventListener('load', function () {
    var stopPrevent = ev => {
        ev.stopPropagation()
        ev.preventDefault()
    }
    
    // File input handler for front image (if exists)
    var frontImageInput = $('frontImageInput')
    if (frontImageInput) {
        frontImageInput.addEventListener('change', ev => {
            var file = ev.target.files[0]
            if (file && file.type.match(/image.*/)) {
                var img = new Image()
                img.onload = () => { setImage(img) }
                var reader = new FileReader()
                reader.onloadend = e => { img.src = e.target.result }
                reader.readAsDataURL(file)
            }
        })
    }
    
    // File input handler for side image
    var sideImageInput = $('sideImageInput')
    if (sideImageInput) {
        sideImageInput.addEventListener('change', ev => {
            var file = ev.target.files[0]
            if (file && file.type.match(/image.*/)) {
                var img = new Image()
                img.onload = () => { setImageSide(img) }
                var reader = new FileReader()
                reader.onloadend = e => { img.src = e.target.result }
                reader.readAsDataURL(file)
            }
        })
    }
    
    dropTarget.addEventListener('dragenter', stopPrevent)
    dropTarget.addEventListener('dragover', stopPrevent)
    dropTarget.addEventListener('drop', ev => {
        stopPrevent(ev)
        var url = ev.dataTransfer.getData('text/plain')
        var img = new Image()
        if (url) {
            // dragged by url from another site etc
            img.onload = ev => { setImage(img) }
            img.src = url
        } else {
            // dragged from local FS
            var file = ev.dataTransfer.files[0]
            if (!file.type.match(/image.*/)) return
            img.file = file
            img.onload = e => { setImage(img) }
            var reader = new FileReader()
            reader.onloadend = e => { img.src = e.target.result }
            reader.readAsDataURL(file)
        }
    })
})



