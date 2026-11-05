# ExoSnap Controller3D Lab v24 – technical handoff

## Scope and provenance

This is a **standalone browser experiment** derived directly from the last supplied **v23.1 source ZIP**. Its intent is to implement selected v23.2/v24 requirements in a reproducible source tree. The actual v23.2 *source archive* is not present in this environment, so this package must not be described as a verified incremental patch on the complete v23.2 source.

The archived `reference-v23.2/` images are genuine v23.2 WebGL screenshots obtained from a cleaned evidence archive. They are visual benchmarks **not screenshots of the newly generated v24 3D geometry**. The local `gallery-v24.html` labels them accordingly. The gallery can be opened without Three.js.

## Changes

1. **Static body**: `v24-static-body.js` groups unmoving source-mesh geometry per source model and material role (`front`, `rear`, `trim`). Controls with animations, nested animated parents, stick components and triggers stay separate. Material and depth proxies are rebuilt on the merged geometry. Source triangles are preserved; this is deliberately *not* destructive Boolean union, automatic hole filling, or decimation.
2. **Sticks**: `v24-stick-geometry.js` creates a low-segment lathed cap per source-equivalent extents. `model-mechanics.js` sets DualSense 14°, Xbox One 17°, Switch Pro 15° visual tilt limits. The existing 5% radial inner deadzone/5% outer saturation remains unchanged. The ring/well stays fixed while cap and stem move with a dedicated pivot. GameCube and its C-stick remain source-authored exceptions. Caps are 32 radial segments, not the multi-thousand-triangle native Qt test caps.
3. **Ghost**: Ghost body surfaces remain transparent with depth-only geometry, with a dark silhouette-only expanded backface as the default body outline. The legacy detailed housing edge extraction remains opt-in via the Ghost outline dropdown. Controls are translucent at rest and become blue/opaque on press. Optional subdued dashed rear hints for controls eligible as shoulders, triggers and paddles rely on depth testing against the physical shell.
4. **Local button movement**: compact system buttons and bumpers use smaller local movements rather than a generic 0.014-unit press.
5. **Inspection**: current rendered mesh/triangle counts are displayed in the viewer. `npm run topology` checks cached OBJ source topology, reporting invalid references, degenerates and nonmanifold/boundary edges, without changing imported data.

## Validation and limits

`node --check` passes for all top-level JS modules and the viewer entrypoint. Pure-policy tests, the existing radial-stick tests, gate/touch geometry tests and Ghost defaults pass. Tests importing `three` cannot execute until `npm install`; Three.js and actual downloaded OBJ assets are not available in the analysis runtime. **A v24 WebGL screenshot, full 360° appearance approval, rear-hint depth approval, frame-time measurement and parity tests are therefore still outstanding**. Any reported source counts refer to source geometry, not post-GPU-optimization.

The preliminary static-body batch is an exploration, not a guaranteed manifold closed solid, not guaranteed optimal meshlet/vertex-cache optimization, and should not be applied to a native Qt production mesh without visual/depth regression tests. `v24-rear-hints.js` specifically requires an occluded/visible/partial-occlusion WebGL test; treat it as an experiment pending those tests.

## Running locally

- Windows: unzip into `.workspace/ExoSnap_Controller3D_Lab_v24`, then run `start.cmd`. This installs Three.js through npm on first launch.
- Optionally prefetch the common model sources: `npm run download-assets -- DualSenseCompact XboxOneClean SwitchPro Gamecube`.
- Open `http://127.0.0.1:8787/` and select *Ghost*, *Solid Body*, *Shared Sticks*, *Rear-Hints* and the outline variant. Buttons can be simulated through the `Tasten` panel.
- Open `gallery-v24.html` to compare *v23.2* reference images on their original backgrounds.
- Generate topology evidence after caching assets: `npm run topology` (writes untracked `.workspace/v24-topology.json`).

The normal viewer does not require a physical controller. For reproduction and screenshots, a supported browser, real WebGL and the downloaded OBJ parts are needed. The model downloader does not ship assets or copy the original author’s copyright to the local package.

## License boundary

Source code of Larf's original 3D Controller Overlay is MIT licensed. Original DualSense, Xbox One and GameCube OBJ files in the 3dco+ fork were verified byte-for-byte identical to original-repository Git blobs. Each model's individual license should remain recorded; in particular, Steam Controller 2026 is CC BY-NC-SA 4.0 and PadForge models have distinct/uncertain rights. None of these OBJ files are bundled here. The embedded 2D reference assets retain their existing mixed per-layout notices.

## Next native step

Use **PR #506** only as the Qt Quick 3D host/input/depth-test foundation. After #505 is integrated, restack #506. Port *original source geometry* or vetted offline conversions; don't copy this browser renderer as-is. Separate static shell batches by material and moving controls, preserve correct pivots, use small procedural stick caps only where better than source 3D. Normal/Ghost should be compared in real 240×160/320×214/480×320 captures on dark/light/game scenes, plus 360° sweeps and physical hardware diagnostics.
