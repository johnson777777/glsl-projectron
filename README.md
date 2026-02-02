# GLSL-Projectron

**GPU-accelerated evolutionary image approximation using semi-transparent polygons**

![Version](https://img.shields.io/badge/version-0.4.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

An experimental GPGPU (General-Purpose GPU) project that uses WebGL and genetic algorithms to evolve 3D polygon clouds that approximate target images. The system renders semi-transparent polygons and compares them against reference images, iteratively improving the match through mutation and selection.

## Features

- **GPU-Accelerated Evolution**: All rendering and comparison operations run on the GPU for maximum performance
- **3D Polygon Clouds**: Uses semi-transparent triangular polygons in 3D space
- **Dual-View Optimization**: Supports simultaneous optimization from multiple camera angles (front and side views)
- **Adaptive Mutations**: Automatically adjusts mutation strategies based on convergence progress
- **Real-time Visualization**: Interactive viewer with camera rotation and snapping
- **Data Import/Export**: Save and restore polygon configurations

## How It Works

1. **Initialize**: Start with a target image (or two images for dual-view mode)
2. **Mutate**: Randomly modify polygon positions, colors, or add/remove polygons
3. **Render**: Draw the polygon cloud to a framebuffer using WebGL
4. **Compare**: Calculate fitness score by comparing rendered output to target image
5. **Select**: Keep beneficial mutations, discard harmful ones
6. **Repeat**: Iterate until convergence or user satisfaction

The comparison is done entirely on the GPU using GLSL shaders that compute pixel-by-pixel differences and progressively reduce the result to a single fitness score.

## Installation

```bash
npm install
```

## Usage

### Development Server

Start the webpack dev server:

```bash
npm start
```

Then open your browser to the localhost address shown (typically `http://localhost:8080`).

### Production Build

Build optimized bundles for production:

```bash
npm run build
```

This generates `maker-bundle.js` and `viewer-bundle.js` in the `docs/` directory.

## Project Structure

```
glsl-projectron/
├── projectron.js          # Core engine - manages WebGL context, evolution loop
├── polydata.js            # Polygon data management and mutation operations
├── maker.js               # Interactive creation interface
├── viewer.js              # Standalone viewer for saved results
├── webpack.config.js      # Build configuration
├── shaders/               # GLSL shader programs
│   ├── camera-*.glsl      # 3D polygon rendering
│   ├── flatTexture-*.glsl # 2D texture rendering
│   ├── diffReduce4-*.glsl # GPU-based image comparison (initial)
│   └── avgReduce4-*.glsl  # GPU-based image comparison (reduction)
└── docs/                  # Built demo files and assets
    ├── index.html         # Maker interface
    ├── viewer.html        # Viewer interface
    ├── data.txt           # Default polygon data
    └── img/               # Sample target images
```

## Key Classes and APIs

### Projectron

The main engine class that manages the evolutionary process.

**Constructor:**
```javascript
import { Projectron } from './projectron'
const proj = new Projectron(canvasElement, comparisonSize)
```

**Key Methods:**
- `setTargetImage(image)` - Set the front-view target image
- `setTargetImageSide(image)` - Set the side-view target image (optional)
- `runGeneration()` - Execute one generation of evolution
- `draw(xRot, yRot)` - Render the current polygon cloud
- `exportData()` - Export polygon configuration as string
- `importData(dataString)` - Load polygon configuration
- `getScore()` / `getScoreFront()` / `getScoreSide()` - Get fitness scores
- `setViewWeights(frontWeight, sideWeight)` - Adjust dual-view optimization weights

### PolyData

Manages polygon vertex and color data, handles mutations.

**Mutation Operations:**
- `addPoly()` - Add a new random polygon
- `removePoly()` - Remove a random polygon
- `mutateVertex()` - Adjust a vertex position
- `mutateValue()` - Adjust a color/alpha value
- `sortPolygonsByZ()` - Sort for proper alpha blending

## Technical Details

### GPU-Based Comparison

The fitness comparison uses a multi-stage GPU pipeline:

1. **Diff Shader**: Computes per-pixel RGB difference between target and rendered image, reduces resolution by 4x
2. **Average Shader**: Progressively reduces the difference map by 4x per stage
3. **CPU Readback**: Reads the final small buffer (≤16x16) and computes average difference

This approach is much faster than CPU-based comparison for large images.

### Adaptive Evolution

The system includes several optimization strategies:

- **Multi-Mutation Trials**: Tests multiple mutations per generation, keeps the best
- **Adaptive Aggressiveness**: Increases mutation magnitude when stuck in local optima
- **Z-Sort Skipping**: Skips expensive depth sorting for color-only mutations
- **Poly Count Tolerance**: Prefers solutions with fewer polygons if quality is similar

### Dual-View Mode

When a side-view target is provided:
- Each generation renders from both camera angles
- Fitness is a weighted combination of both views
- Helps create more accurate 3D polygon distributions

## Configuration

Query parameters for `maker.js`:
- `?size=N` - Set internal comparison texture size (default: 256, power of 2)

Adjustable parameters in the maker UI:
- Alpha range (min/max transparency)
- Adjustment amount (mutation magnitude)
- Poly tolerance (preference for fewer polygons)
- View weights (front/side importance in dual-view mode)

## Browser Compatibility

Requires WebGL support. Tested on:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Dependencies

- **WebGL Utilities**: gl-now, gl-shader, gl-buffer, gl-fbo, gl-vao, gl-texture2d
- **Math**: gl-mat4
- **Build Tools**: webpack, glslify

## License

MIT License - Copyright (c) Andy Hall

## Links

- **Repository**: https://github.com/fenomas/glsl-projectron
- **Issues**: https://github.com/fenomas/glsl-projectron/issues

## Credits

Forked from Andy Hall's [glsl-projectron](https://github.com/fenomas/glsl-projectron)
