# Dual-View Projectron Implementation Guide

## Overview
Extend GLSL-Projectron to evolve 3D polygons that match **two different target images** from two different viewing angles:
- **Front view** (0° rotation) - matches Image A
- **Side view** (90° Y-axis rotation) - matches Image B

## Architecture Changes

### 1. Data Structure Additions

#### In `src/index.js` - Global Variables

Add new variables for the second view:

```javascript
// Existing:
var tgtTexture = null
var currentScore = -100

// Add:
var tgtTextureSide = null           // Second target image texture
var currentScoreSide = -100         // Fitness score for side view
var currentScoreCombined = -100     // Combined fitness score
var sideViewRotation = Math.PI / 2  // 90 degrees in radians
var scoreWeightFront = 0.5          // Weight for front view (0-1)
var scoreWeightSide = 0.5           // Weight for side view (0-1)

// Add second set of framebuffers for side view
var referenceFBSide = null          // Target image from side
var scratchFBSide = null            // Candidate render from side
```

#### Framebuffer Initialization

Modify the FBO creation section (around line 106):

```javascript
// Existing front view FBOs
var referenceFB = createFBO(gl, [fboSize, fboSize], { color: 1 })
var scratchFB = createFBO(gl, [fboSize, fboSize], { color: 1 })

// Add side view FBOs
var referenceFBSide = createFBO(gl, [fboSize, fboSize], { color: 1 })
referenceFBSide.drawn = false
var scratchFBSide = createFBO(gl, [fboSize, fboSize], { color: 1 })
```

---

### 2. API Extensions

#### Add new public methods:

```javascript
// In the API section (around line 57)

// Existing:
this.setTargetImage = setTargetImage

// Add:
this.setTargetImageSide = setTargetImageSide
this.setViewWeights = (frontWeight, sideWeight) => {
    scoreWeightFront = frontWeight
    scoreWeightSide = sideWeight
}
this.getScoreFront = () => currentScore
this.getScoreSide = () => currentScoreSide
this.getScoreCombined = () => currentScoreCombined
this.drawSideView = (x, y) => { paintSideView(x, y) }
this.drawSideReference = () => { paintSideReference() }
this.drawSideScratchBuffer = () => { paintSideScratchBuffer() }
```

---

### 3. Core Algorithm Changes

#### Modified `runGeneration()` function

Replace the existing `runGeneration()` with dual-view logic:

```javascript
this.runGeneration = function () {
    if (!tgtTexture || !tgtTextureSide) return

    polys.cacheDataNow()
    var vertCount = polys.getNumVerts()
    mutateSomething()
    
    // Resort data and update buffers
    polys.sortPolygonsByZ()
    vertBuffer.update(polys.getVertArray())
    colBuffer.update(polys.getColorArray())
    polyBuffersOutdated = false

    // FRONT VIEW RENDERING (existing angle)
    drawData(scratchFB, perspective, null)
    var scoreFront = compareFBOs(referenceFB, scratchFB)

    // SIDE VIEW RENDERING (90 degree rotation)
    var sideMatrix = mat4.create()
    mat4.rotateY(sideMatrix, sideMatrix, sideViewRotation)
    drawData(scratchFBSide, perspective, sideMatrix)
    var scoreSide = compareFBOs(referenceFBSide, scratchFBSide)

    // COMBINED SCORE CALCULATION
    var scoreCombined = (scoreFront * scoreWeightFront) + 
                        (scoreSide * scoreWeightSide)
    
    var keep = (scoreCombined > currentScoreCombined)

    // Prefer to remove polys even if score drop is within tolerance
    if (!keep && polys.getNumVerts() < vertCount) {
        if (scoreCombined > currentScoreCombined - fewerPolysTolerance) {
            keep = true
        }
    }

    if (keep) {
        currentScore = scoreFront
        currentScoreSide = scoreSide
        currentScoreCombined = scoreCombined
    } else {
        polys.restoreCachedData()
        polyBuffersOutdated = true
    }
}
```

---

### 4. Image Loading Functions

#### Add side view target setter

```javascript
function setTargetImageSide(image) {
    prerender()
    tgtTextureSide = createTexture(gl, image)
    drawFlat(tgtTextureSide, referenceFBSide, true)
    
    // Recalculate initial combined score
    if (tgtTexture) {
        drawData(scratchFB, perspective, null)
        currentScore = compareFBOs(referenceFB, scratchFB)
        
        var sideMatrix = mat4.create()
        mat4.rotateY(sideMatrix, sideMatrix, sideViewRotation)
        drawData(scratchFBSide, perspective, sideMatrix)
        currentScoreSide = compareFBOs(referenceFBSide, scratchFBSide)
        
        currentScoreCombined = (currentScore * scoreWeightFront) + 
                               (currentScoreSide * scoreWeightSide)
    }
}

// Modify existing setTargetImage to handle dual-view initialization
function setTargetImage(image) {
    prerender()
    tgtTexture = createTexture(gl, image)
    drawFlat(tgtTexture, referenceFB, true)
    
    // If side texture exists, calculate combined score
    if (tgtTextureSide) {
        drawData(scratchFB, perspective, null)
        currentScore = compareFBOs(referenceFB, scratchFB)
        
        var sideMatrix = mat4.create()
        mat4.rotateY(sideMatrix, sideMatrix, sideViewRotation)
        drawData(scratchFBSide, perspective, sideMatrix)
        currentScoreSide = compareFBOs(referenceFBSide, scratchFBSide)
        
        currentScoreCombined = (currentScore * scoreWeightFront) + 
                               (currentScoreSide * scoreWeightSide)
    } else {
        // Legacy single-view behavior
        drawData(scratchFB, perspective, null)
        currentScore = compareFBOs(referenceFB, scratchFB)
    }
}
```

---

### 5. Rendering Functions

Add side view painting functions:

```javascript
function paintSideView(xRot, yRot) {
    if (polyBuffersOutdated) {
        vertBuffer.update(polys.getVertArray())
        colBuffer.update(polys.getColorArray())
    }
    
    // Create side view matrix (90° + optional user rotation)
    camMatrix = mat4.create()
    mat4.rotateY(camMatrix, camMatrix, sideViewRotation + (xRot || 0))
    mat4.rotateX(camMatrix, camMatrix, yRot || 0)
    
    drawData(null, perspective, camMatrix)
}

function paintSideReference() {
    if (!tgtTextureSide) return
    drawFlat(referenceFBSide.color[0], null, false)
}

function paintSideScratchBuffer() {
    if (!tgtTextureSide) return
    drawFlat(scratchFBSide.color[0], null, false)
}
```

---

### 6. Export/Import Extensions

Update data serialization to include dual-view settings:

```javascript
this.exportData = function () {
    var s = 'vert-xyz,'
    s += polys.getVertArray().map(n => n.toFixed(8)).join()
    s += ',\ncol-rgba,'
    s += polys.getColorArray().map(n => n.toFixed(5)).join()
    s += ',\nweights,'
    s += scoreWeightFront.toFixed(3) + ',' + scoreWeightSide.toFixed(3)
    return s
}

this.importData = function (s) {
    var curr, v = [], c = []
    var weights = null
    var arr = s.split(',')
    if (s.length < 5) return
    
    arr.forEach(function (str) {
        var n = parseFloat(str)
        if (str.indexOf('vert-xyz') > -1) { curr = v }
        else if (str.indexOf('col-rgba') > -1) { curr = c }
        else if (str.indexOf('weights') > -1) { 
            curr = null
            weights = []
        }
        else if (weights !== null && !isNaN(n)) { weights.push(n) }
        else if (curr && !isNaN(n)) { curr.push(n) }
        else { console.warn('Import: ignoring value ' + str) }
    })
    
    if (weights && weights.length === 2) {
        scoreWeightFront = weights[0]
        scoreWeightSide = weights[1]
    }
    
    if (v.length / 3 === c.length / 4) {
        polys.setArrays(v, c)
        vertBuffer.update(polys.getVertArray())
        colBuffer.update(polys.getColorArray())
        
        if (tgtTexture && tgtTextureSide) {
            // Recalculate scores for both views
            drawData(scratchFB, perspective, null)
            currentScore = compareFBOs(referenceFB, scratchFB)
            
            var sideMatrix = mat4.create()
            mat4.rotateY(sideMatrix, sideMatrix, sideViewRotation)
            drawData(scratchFBSide, perspective, sideMatrix)
            currentScoreSide = compareFBOs(referenceFBSide, scratchFBSide)
            
            currentScoreCombined = (currentScore * scoreWeightFront) + 
                                   (currentScoreSide * scoreWeightSide)
        }
        return true
    } else {
        console.warn('Import failed: unbalanced counts')
    }
}
```

---

## UI Integration (demo/maker.js)

### HTML Changes

Add UI elements for the second image:

```html
<!-- Existing canvas -->
<canvas id="view"></canvas>

<!-- Add side view canvas -->
<canvas id="viewSide"></canvas>

<!-- Add controls -->
<div>
    <label>Front Image: <input type="file" id="frontImageInput"></label>
    <label>Side Image: <input type="file" id="sideImageInput"></label>
</div>

<div>
    <label>Front Weight: <input type="range" id="frontWeight" min="0" max="1" step="0.1" value="0.5"></label>
    <label>Side Weight: <input type="range" id="sideWeight" min="0" max="1" step="0.1" value="0.5"></label>
</div>

<div id="stats">
    <p>Front Score: <span id="scoreFront">0</span></p>
    <p>Side Score: <span id="scoreSide">0</span></p>
    <p>Combined: <span id="scoreCombined">0</span></p>
</div>
```

### JavaScript Changes in maker.js

```javascript
import { Projectron } from '../src'

var canvas = document.getElementById('view')
var canvasSide = document.getElementById('viewSide')
var proj = new Projectron(canvas, 256)

// Load front image
var imgFront = new Image()
imgFront.onload = () => { proj.setTargetImage(imgFront) }
imgFront.src = './img/mona512.jpg'

// Load side image
var imgSide = new Image()
imgSide.onload = () => { proj.setTargetImageSide(imgSide) }
imgSide.src = './img/profile512.jpg'  // Different image for side view

// File input handlers
document.getElementById('frontImageInput').addEventListener('change', (e) => {
    var file = e.target.files[0]
    if (file) {
        var img = new Image()
        img.onload = () => { proj.setTargetImage(img) }
        img.src = URL.createObjectURL(file)
    }
})

document.getElementById('sideImageInput').addEventListener('change', (e) => {
    var file = e.target.files[0]
    if (file) {
        var img = new Image()
        img.onload = () => { proj.setTargetImageSide(img) }
        img.src = URL.createObjectURL(file)
    }
})

// Weight controls
document.getElementById('frontWeight').addEventListener('input', (e) => {
    var fw = parseFloat(e.target.value)
    var sw = 1 - fw
    proj.setViewWeights(fw, sw)
    document.getElementById('sideWeight').value = sw
})

document.getElementById('sideWeight').addEventListener('input', (e) => {
    var sw = parseFloat(e.target.value)
    var fw = 1 - sw
    proj.setViewWeights(fw, sw)
    document.getElementById('frontWeight').value = fw
})

// Render loop
function render() {
    if (!paused) {
        for (var i = 0; i < gensPerFrame; i++) {
            proj.runGeneration()
        }
        generations += gensPerFrame
    }
    
    // Update stats
    document.getElementById('scoreFront').textContent = 
        proj.getScoreFront().toFixed(2)
    document.getElementById('scoreSide').textContent = 
        proj.getScoreSide().toFixed(2)
    document.getElementById('scoreCombined').textContent = 
        proj.getScoreCombined().toFixed(2)
    
    // Render both views
    proj.draw(-cameraRot[0], -cameraRot[1])  // Front view on main canvas
    
    // Render side view on second canvas (need to bind context)
    // This requires modifying the library to accept different canvas contexts
    // OR render to same canvas with viewport split
    
    requestAnimationFrame(render)
}
```

---

## Advanced Optimizations

### 1. Z-Sorting Strategy

The current Z-sorting may need adjustment for dual-view:

```javascript
// In polydata.js - modify sortPolygonsByZ()
this.sortPolygonsByZ = function (viewAngle) {
    var i, j
    var sortdat = []
    
    // Calculate Z based on view angle
    var cosA = Math.cos(viewAngle || 0)
    var sinA = Math.sin(viewAngle || 0)
    
    for (i = 0; i < vertArr.length; i += 9) {
        var zavg = 0
        for (j = 0; j < 3; j++) {
            var x = vertArr[i + j*3]
            var z = vertArr[i + j*3 + 2]
            // Rotate Z calculation
            zavg += (z * cosA - x * sinA) / 3
        }
        sortdat.push({ index: i / 9, z: zavg })
    }
    
    sortdat.sort(sortFcn)
    // ... rest of sorting logic
}
```

**Note:** For dual-view, you may want to sort based on an average Z or skip sorting since order matters for both views differently.

### 2. Mutation Strategy Adjustments

Consider biasing mutations toward 3D depth changes:

```javascript
// In polydata.js - modify mutateSomething() or mutation weights
function mutateSomething() {
    var r = rand()
    if (r < 0.2) {
        polys.mutateValue()
    } else if (r < 0.4) {
        polys.mutateVertex()
    } else if (r < 0.5) {
        polys.mutateDepth()  // New: focus on Z-axis changes
    } else if (r < 0.8) {
        polys.addPoly()
    } else {
        polys.removePoly()
    }
}

// Add to polydata.js
this.mutateDepth = function () {
    // Specifically mutate Z coordinates to help dual-view convergence
    var vi = (rand() * this.getNumVerts()) | 0
    var zi = vi * 3 + 2  // Z component
    vertArr[zi] = randomizeVal(vertArr[zi])
}
```

### 3. Weighted Score Annealing

Gradually shift weight focus during evolution:

```javascript
// In maker.js render loop
var totalGens = 1000000
var progress = generations / totalGens

// Start with equal weights, gradually favor the harder view
if (proj.getScoreFront() < proj.getScoreSide()) {
    proj.setViewWeights(0.5 + progress * 0.3, 0.5 - progress * 0.3)
} else {
    proj.setViewWeights(0.5 - progress * 0.3, 0.5 + progress * 0.3)
}
```

---

## Testing Strategy

### Phase 1: Single-Image Validation
1. Load same image for both front and side views
2. Set weights to 0.5/0.5
3. Verify combined score converges similar to original single-view

### Phase 2: Simple Dual Images
1. Use high-contrast, simple shapes (circle front, triangle side)
2. Verify algorithm can balance both views
3. Monitor individual scores vs combined score

### Phase 3: Complex Images
1. Use photos or complex images
2. Experiment with weight ratios
3. Analyze convergence time and final quality

---

## Performance Considerations

### Computational Cost
- **2x rendering per generation** (front + side view)
- **2x FBO comparisons** per generation
- Estimated: ~50% slower than single-view

### Memory Impact
- **+2 FBOs** (referenceFBSide, scratchFBSide)
- **+1 texture** (tgtTextureSide)
- Total memory increase: ~+50% of original usage

### Optimization Tips
1. **Reduce FBO size** for initial testing (e.g., 128x128)
2. **Alternate views**: Compare front view every frame, side view every N frames
3. **Progressive weights**: Start with single view, add second view after convergence
4. **Cull polygons**: Remove polygons that don't contribute to either view

---

## Expected Behavior

### Convergence Characteristics
- **Slower convergence** than single-view (more constraints)
- **Higher final polygon count** (needs to satisfy both projections)
- **More 3D structure** (depth becomes critical)
- **Potential local minima** (harder to escape suboptimal solutions)

### Visual Results
- Front view should resemble target image A
- Side view should resemble target image B
- 3D structure should be coherent (not just two independent flat projections)
- Rotation between views should show meaningful 3D geometry

---

## Future Enhancements

1. **Multiple views** (3+): Add top view, multiple angles
2. **Stereo pairs**: Generate 3D viewable content
3. **Video sequences**: Evolve for rotating animation
4. **Adaptive weights**: ML-based weight adjustment
5. **Hierarchical evolution**: Evolve coarse structure first, then details

---

## Implementation Checklist

- [ ] Add dual framebuffers and variables to index.js
- [ ] Extend API with dual-view methods
- [ ] Modify runGeneration() for dual-view scoring
- [ ] Implement setTargetImageSide() function
- [ ] Add side view rendering functions
- [ ] Update export/import for dual-view data
- [ ] Create dual-canvas UI in demo
- [ ] Add file inputs for both images
- [ ] Add weight controls
- [ ] Implement statistics display
- [ ] Test with identical images first
- [ ] Test with different images
- [ ] Optimize Z-sorting strategy
- [ ] Document performance characteristics
- [ ] Create sample dual-view datasets

---

## Conclusion

This dual-view extension transforms GLSL-Projectron from a 2D-projection genetic algorithm into a true **3D structure evolution system**. The polygons must now form coherent 3D geometry that satisfies two orthogonal constraints simultaneously, resulting in more interesting and structurally sound results.

The key insight is that the **combined fitness score** acts as a multi-objective optimization function, forcing the evolution to find solutions in a more constrained 3D space rather than just flat projections.
