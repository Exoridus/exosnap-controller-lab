# ExoSnap Controller3D Parity Preview v26 – Stand 2026-11-03

## Six-view comparison

- Full-width UI without header; top row: authentic OBJ 3D views on dark, light, mixed backgrounds.
- Bottom row: each model's supplied 2D SVG on a **flat plane**, with exactly the same orbit camera (so a side view of the 2D plane becomes edge-on, not simulated 3D).
- One shared Three.js renderer/scene state, three scissor viewports per row. Camera orbit, zoom, and pan are synchronized across all six panels.
- Presets Normal/Glass/Ghost; shared material mix, global contrast-halo, rear-hint and control-opacity settings. The old full motion/diagnostic UI is hidden, but legacy modules are retained for compatibility.

## Synthetic full-press + maximum-stick qualification (new in this build)

- Enable **Alle Tasten + Sticks max.** to illuminate all modeled controls and deflect **both sticks to the same maximum radial position**.
- The compact **Stick-Richtung** dropdown appears only while this test mode is on. Default is **Automatisch · 3 s**.
- Automatic poses cycle clockwise through ↗, →, ↘, ↓, ↙, ←, ↖, ↑ and repeat. A 220 ms smooth transition keeps radial magnitude at 1.0.
- Choose a fixed direction to pause the cycle indefinitely and inspect a specific pose.
- The *same* `previewStickPose` object feeds the `ls`/`rs` 3D pivot machinery and both 2D SVG stick translations. All six viewports therefore share exact synthetic state, independent of local camera angle.
- Reset Inputs unchecks all, resets the direction selector to Automatic, and stops synthetic state. Switching into Controller (Live) also disables all synthetic input automatically.
- No hardware input is fabricated. 2D source art is the SVG reference, not a claimed pixel-identical native GPU renderer.

## Verification

- `node --check app.js` and `node --check parity-test-pose.js` passed.
- New `tests/v26-pose-cycle.test.mjs`: **5/5 passed**. Together with the updated `v25-style-mix.test.mjs`: **8/8 passed**.
- Full historical suite: 214/230 passed in the provided runtime; 16 failures are pre-existing compatibility expectations for the removed old interface/old Ghost defaults or require the `three` npm package. The old style-mix contour-monotonicity assertion was corrected to agree with the user's choice to fade out outlines.
- **Full interactive WebGL rendering has NOT been validated here.** The environment could not reach `registry.npmjs.org` (`EAI_AGAIN`); local Three.js installation and remote OBJ model downloads are required on the user's computer. The package includes no fabricated v26 screenshots.

## Setup

On Windows, extract ZIP and run `start.cmd`, open <http://127.0.0.1:8787>. This attempts `npm install` once if Three.js is absent. Download actual model OBJ data from the upstream source when prompted. Stop any previous viewer server using port 8787.

This v26 preview remains an independent browser prototype, not the native Qt 3D PR #506.
