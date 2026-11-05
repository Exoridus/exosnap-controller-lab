# Three.js / Qt Quick 3D PBR Vergleichslabor Implementation Plan

> For agentic workers: implement task-by-task with TDD.

**Goal:** Six genuinely different 3D material/lighting recipes A–F, one mix slider, three backgrounds; real local OBJ model and Qt Quick 3D mappings.

**Architecture:** One THREE.Scene, one model rig of the original OBJ geometry, a single WebGLRenderer with scissor viewports for all 18 comparisons. The gallery operates separately from `index.html` and the pre-existing 2D reference. Renderer-neutral recipe data feeds Three.js and a documented Qt Quick 3D mapping.

**Tech Stack:** Three.js 0.180.0, native ES modules, node:test, Chromium/Playwright for runtime inspection when supported.

**Spec:** User-approved approaches A Original PBR, B Frosted Ghost, C Smoked Glass, D Edge Lighting, E Soft Studio, F Material Identity; 0 Normal/50 Glass/100 Ghost.

## Constraints
- No new 3D mesh copy per variant; no shader customizations or post-processing passes.
- Original OBJ and manifest hierarchies preserved; never substitute a generated controller image.
- All variants follow one mix slider; 3D Dark / Light / Mixed use identical pose, scale, same camera; maintain original 2D and main UI.
- Qt parameter equivalents recorded, with renderer/calibration differences marked.
- Honest browser/WebGL release status, never treat mockups as evidence.

## Tasks
- [ ] 1. Write failing recipe tests, implement pure `pbr-recipes.js` with all six unique PBR/light configurations and Qt descriptor export; rerun tests.
- [ ] 2. Write failing native OBJ rig tests, implement `pbr-model.js` preserving mesh geometry, part hierarchy, model colors and framing; rerun tests.
- [ ] 3. Create `pbr-lab.html`, `pbr-lab.js` and `pbr-lab.css`: shared-scene scissor comparison with one mix slider and fixed three backgrounds, selection, camera controls and JSON export. Add link from existing UI, leave 2D renderer unchanged.
- [ ] 4. Run complete suite + syntax checks, browser capability and DOM runtime probes, inspect real captures if WebGL available; prepare Qt mapping and full ZIP without falsely claiming a GPU image review.
