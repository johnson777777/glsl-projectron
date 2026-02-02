
/*
 * 
 * 
 *  helper class to manage polygon data
 *  
 *  vertArr is [x,y,z, xyz, xyz,   ..] per poly (len=3*numVerts)
 *  colArr = [r,g,b,a, rgba, rgba, ..] per poly (len=4*numVerts)
 * 
*/


export function PolyData() {

    var minAlpha = 0.1
    var maxAlpha = 0.5
    var flattenZ = 0
    var adjAmount = 0.5

    var vertArr = []
    var colArr = []

    this.getNumVerts = () => (vertArr.length / 3) | 0
    this.getNumPolys = () => (vertArr.length / 9) | 0
    this.getVertArray = () => vertArr
    this.getColorArray = () => colArr

    this.setArrays = (v, c) => {
        vertArr = v
        colArr = c
    }
    this.setAlphaRange = (min, max) => {
        if (min || (min === 0)) minAlpha = min
        if (max || (max === 0)) maxAlpha = max
    }
    this.setAdjust = (num) => { adjAmount = num }
    this.setFlattenZ = (z) => { flattenZ = z }





    /*
     * 
     *  randomizer handlers
     * 
    */

    var rand = () => Math.random()
    var randRange = (a, b) => a + (b - a) * Math.random()

    // Bias random values toward center for better 3D distribution
    var randCenterBiased = () => {
        var r1 = Math.random()
        var r2 = Math.random()
        // Average of two random values creates center bias
        return (r1 + r2) / 2
    }

    var randomizeVal = (old) => {
        if (!old) return randCenterBiased()
        var a = Math.max(0, old - adjAmount)
        var b = Math.min(1, old + adjAmount)
        return randRange(a, b)
    }
    var randomizeAlpha = (old) => {
        if (!old) return randRange(minAlpha, maxAlpha)
        var a = Math.max(minAlpha, old - adjAmount)
        var b = Math.min(maxAlpha, old + adjAmount)
        return randRange(a, b)
    }





    /*
     * 
     * 
     *      data mutators 
     * 
     * 
    */

    this.addPoly = function (primitiveType) {
        // primitiveType: 'triangle' (default), 'quad', 'thin'
        primitiveType = primitiveType || 'triangle'
        
        if (primitiveType === 'thin') {
            // Thin elongated triangles - better for edges/lines
            var x = randomizeVal()
            var y = randomizeVal()
            var z = randRange(0.15, 0.85)
            var angle = rand() * Math.PI * 2
            var length = randRange(0.05, 0.2)
            var width = randRange(0.002, 0.01)
            
            var dx = Math.cos(angle) * length
            var dy = Math.sin(angle) * length
            var nx = -Math.sin(angle) * width
            var ny = Math.cos(angle) * width
            
            // Create thin triangle
            vertArr.push(x - dx, y - dy, z)
            vertArr.push(x + dx, y + dy, z)
            vertArr.push(x + dx + nx, y + dy + ny, z)
            
            // Same color for all vertices
            var r = randomizeVal(), g = randomizeVal(), b = randomizeVal(), a = randomizeAlpha()
            for (var i = 0; i < 3; i++) {
                colArr.push(r, g, b, a)
            }
        } else if (primitiveType === 'quad') {
            // Quad approximated by 2 triangles (6 vertices)
            var cx = randomizeVal()
            var cy = randomizeVal()
            var cz = randRange(0.15, 0.85)
            var size = randRange(0.05, 0.15)
            var angle = rand() * Math.PI * 2
            
            var cos = Math.cos(angle)
            var sin = Math.sin(angle)
            
            // 4 corners of quad
            var corners = [
                [cx - size * cos, cy - size * sin, cz],
                [cx + size * sin, cy - size * cos, cz],
                [cx + size * cos, cy + size * sin, cz],
                [cx - size * sin, cy + size * cos, cz]
            ]
            
            // Triangle 1: corners 0,1,2
            for (var j = 0; j < 3; j++) {
                vertArr.push(corners[j][0], corners[j][1], corners[j][2])
            }
            
            // Same color for triangle 1
            var r1 = randomizeVal(), g1 = randomizeVal(), b1 = randomizeVal(), a1 = randomizeAlpha()
            for (var k = 0; k < 3; k++) {
                colArr.push(r1, g1, b1, a1)
            }
        } else {
            // Default: standard triangle
            for (var i = 0; i < 3; i++) {
                for (var j = 0; j < 3; j++) {
                    // Wider Z range (j===2) for thicker side view depth
                    var val = (j === 2) ? randRange(0.15, 0.85) : randomizeVal()
                    vertArr.push(val)
                    colArr.push(randomizeVal())
                }
                colArr.push(randomizeAlpha())
            }
            if (flattenZ > 0) {
                var len = vertArr.length
                var z1 = vertArr[len - 1]
                vertArr[len - 4] += flattenZ * (z1 - vertArr[len - 4])
                vertArr[len - 7] += flattenZ * (z1 - vertArr[len - 7])
            }
        }
    }

    // remove a random poly
    this.removePoly = function () {
        if (this.getNumPolys() < 2) return
        var index = (rand() * vertArr.length / 9) | 0
        vertArr.splice(index * 9, 9)
        colArr.splice(index * 12, 12)
    }

    // randomize one R/G/B/A/X/Y/Z value
    this.mutateValue = function () {
        if (rand() < 0.5) {
            var ci = (rand() * colArr.length) | 0
            var randomizer = (ci % 4 === 3) ? randomizeAlpha : randomizeVal
            colArr[ci] = randomizer(colArr[ci])
        } else {
            var vi = (rand() * vertArr.length) | 0
            vertArr[vi] = randomizeVal(vertArr[vi])
        }
    }

    // Fine-tune mutation for high-score optimization
    this.mutateValueFine = function () {
        var savedAdjust = adjAmount
        adjAmount = Math.min(0.1, adjAmount * 0.2)  // 20% of normal adjustment
        if (rand() < 0.5) {
            var ci = (rand() * colArr.length) | 0
            var randomizer = (ci % 4 === 3) ? randomizeAlpha : randomizeVal
            colArr[ci] = randomizer(colArr[ci])
        } else {
            var vi = (rand() * vertArr.length) | 0
            vertArr[vi] = randomizeVal(vertArr[vi])
        }
        adjAmount = savedAdjust
    }

    // Mutate entire polygon (position + color together)
    this.mutatePolygon = function () {
        var polyIndex = (rand() * this.getNumPolys()) | 0
        var vi = polyIndex * 9
        var ci = polyIndex * 12
        
        // Mutate all 3 vertices
        for (var i = 0; i < 9; i++) {
            vertArr[vi + i] = randomizeVal(vertArr[vi + i])
        }
        // Mutate all 3 vertex colors
        for (var j = 0; j < 12; j++) {
            if (j % 4 === 3) {
                colArr[ci + j] = randomizeAlpha(colArr[ci + j])
            } else {
                colArr[ci + j] = randomizeVal(colArr[ci + j])
            }
        }
    }

    // randomize either all RGBA or all XYZ of one vertex
    this.mutateVertex = function () {
        var num = (rand() * this.getNumVerts()) | 0
        if (rand() < 0.5) {
            var ci = num * 4
            for (var i = 0; i < 3; i++) {
                colArr[ci + i] = randomizeVal(colArr[ci + i])
            }
            colArr[ci + 3] = randomizeAlpha(colArr[ci + 3])
        } else {
            var vi = num * 3
            for (var j = 0; j < 3; j++) {
                vertArr[vi + j] = randomizeVal(vertArr[vi + j])
            }
        }
    }





    // helpers

    this.cacheDataNow = function () {
        oldVertArr = vertArr.slice()
        oldColArr = colArr.slice()
    }
    this.restoreCachedData = function () {
        vertArr = oldVertArr
        colArr = oldColArr
    }
    var oldVertArr = null
    var oldColArr = null




    this.sortPolygonsByZ = function () {
        var i, j
        // make and sort an arr of z values averaged over each poly
        var sortdat = []
        for (i = 0; i < vertArr.length; i += 9) {
            var zavg = (vertArr[i + 2] + vertArr[i + 5] + vertArr[i + 8]) / 3
            sortdat.push({ index: i / 9, z: zavg })
        }
        sortdat.sort(sortFcn)
        var oldV = vertArr.slice()
        var oldC = colArr.slice()
        for (i = 0; i < sortdat.length; i++) {
            var item = sortdat[i]
            for (j = 0; j < 9; j++) {
                vertArr[i * 9 + j] = oldV[item.index * 9 + j]
            }
            for (j = 0; j < 12; j++) {
                colArr[i * 12 + j] = oldC[item.index * 12 + j]
            }
        }
    }
    var sortFcn = (a, b) => a.z - b.z



    // init
    this.addPoly()
    this.sortPolygonsByZ()

}