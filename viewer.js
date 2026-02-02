
import { Projectron } from './projectron'





/*
 * 
 *      init
 * 
*/


var canvas = document.getElementById('view')
var proj = new Projectron(canvas)

// set the canvas size to its displayed size
canvas.width = canvas.clientWidth
canvas.height = canvas.clientHeight

document.body.onload = () => {
    var data = document.getElementById('viewData').textContent
    proj.importData(data)
    requestAnimationFrame(render)
}







/*
 * 
 *      render loop
 * 
*/

var cameraRot = [0, 0]
var drawNeeded = true

function render() {
    if (drawNeeded) {
        proj.draw(-cameraRot[0], -cameraRot[1])
        drawNeeded = false
    }
    requestAnimationFrame(render)
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
    if (ev.originalEvent) ev = ev.originalEvent
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
    
    // Continue animation if still moving or snapping
    if (cameraRot[0] || cameraRot[1] || snapping.h || snapping.v) {
        requestAnimationFrame(returnCamera)
    }
}

