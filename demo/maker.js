

import { Projectron } from '../src'
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

var img = new Image()
img.onload = () => { setImage(img) }
img.src = './img/mona512.jpg'

// img.src = './img/lena.png'
// img.src = './img/teapot512.png'

var imgSide = null
var dualViewEnabled = false

// Load default side image
var imgSideDefault = new Image()
imgSideDefault.onload = () => { setImageSide(imgSideDefault) }
imgSideDefault.src = './img/monaside.png'

function setImage(img) {
    generations = 0
    proj.setTargetImage(img)
}

function setImageSide(img) {
    imgSide = img
    generations = 0
    proj.setTargetImageSide(img)
    dualViewEnabled = true
    updateHTML()
}

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
    if (!paused) {
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

// Dual-view weight controls
var frontWeight = 0.5
var sideWeight = 0.5
setupInput('frontWeight', val => {
    frontWeight = parseFloat(val)
    sideWeight = 1 - frontWeight
    proj.setViewWeights(frontWeight, sideWeight)
    if ($('sideWeight')) $('sideWeight').value = sideWeight.toFixed(2)
    updateHTML()
})
setupInput('sideWeight', val => {
    sideWeight = parseFloat(val)
    frontWeight = 1 - sideWeight
    proj.setViewWeights(frontWeight, sideWeight)
    if ($('frontWeight')) $('frontWeight').value = frontWeight.toFixed(2)
    updateHTML()
})

$('export').addEventListener('click', ev => {
    var dat = proj.exportData()
    $('data').value = dat
})

$('import').addEventListener('click', ev => {
    var dat = $('data').value
    var res = proj.importData(dat)
    if (res) $('data').value = ''
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


// update/debounce
function returnCamera() {
    if (dragging) return
    cameraRot.forEach((rot, i) => {
        rot *= cameraReturn
        cameraRot[i] = (Math.abs(rot) < 1e-4) ? 0 : rot
        drawNeeded = true
    })
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



