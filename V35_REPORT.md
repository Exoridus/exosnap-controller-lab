# ExoSnap Controller3D Lab v35 — 2D/3D-Palette, Ghost-Occlusion, LED-Press

Status: **Release Candidate, no full native/WebGL visual acceptance**. This is a full version of the separate, local v34 browser prototype; **the `Exoridus/exosnap` GitHub repo and Qt native PRs were not modified**.

## Implemented

1. **Common semantic palette**: `palette.js` and `material-paint.js` supply neutral control, moving stick, pressed blue (`#4b9fe3`), emissive highlight (`#8fceff`), 2D contrast profiles, and opacity rules. `resolveHeroRecipe`/`qtQuickDescriptor`, the Three.js hero materials, the main 3×2 preview, and the SVG `ControllerReference` consume these values. Controls are not less visible than the shell. The 2D stage preserves the original SVG paths, cutouts and button glyphs rather than replacing source assets with mockups or raster stickers.
2. **Physical Ghost depth**: `ghost-depth-policy.js` renders the front shell first, then fixed wells and movable stick surfaces according to their authored depth, with `depthTest` and `depthWrite` enabled. The previous blanket opacity-dimming of the rear buttons/wells has been removed from the hero rig. Optional hidden shoulders/triggers/paddles use depth-tested **dashed** V24-style line hints (`GreaterDepth`) instead of full overlay copies. Line width uniforms are updated for each viewport size. Side/diagonal poses require actual WebGL picture inspection before production acceptance.
3. **Translucent pressed LED**: 3D `MeshPhysicalMaterial.emissive` now uses the shared cool emission, with intensity ~0.58, and pressed surfaces remain translucent (not forced fully opaque). 2D uses the same pressed blue and alpha-limited SVG face fill plus subtle CSS drop-shadow, preserving original button glyphs. Stick-motion brightening is separate from L3/R3 press state.
4. **Dual 2D/3D comparison**: `pbr-lab.html` renders one genuine native SVG row beneath each native OBJ 3D row, with Dark/Light/Mixed columns, one common mix slider and synchronized controls/stick pose.
5. **Navigation fix**: `index.html` remains a redirect to `labs.html` for a normal visit; each “Hauptvorschau” link now uses `index.html?layout=dualsense` to avoid redirect loops.
6. **Qt reference**: exported `qt-quick3d-port/pbr-reference-recipes.json` embeds the flat 2D scene palette and depth/LED semantics. `ControllerSurface.qml` now exposes a matching `emissiveFactor` reference. This is **not** a completed native Qt renderer or verified Qt visual parity.

## Testing

Run `npm run verify` from the unpacked directory. The v35 tests cover the shared palette, original OBJ depth sorting, non-opaque LED, six-panel 2D wiring, dashed hints, native-Qt descriptor data, light 2D remapping, main preview dependency, and navigation. In a separate Chromium DOM/SVG test (`python tools/v35-svg-browser-qa.py`, optional Playwright/Chromium installation), the **original DualSense SVG** was actually viewed in six combinations (two looks × three backgrounds) for idle and pressed. There were no JavaScript errors in that browser test. See `evidence/v35-browser/` for its two **real browser screenshots** and log. The screenshots show only the 2D SVG renderer, **not** a 3D WebGL render. The mixed backdrop in that fixture is an illustrative simple racing-like background rather than the live capture pipeline.

## Open blockers / limits

- Current automated Chromium cannot load local HTTP/file URLs and cannot initialize a WebGL 1/2 context even with SwiftShader. **No 3D image comparison, side-on stick depth or per-panel GPU performance has been visually verified in this environment.**
- True 2D/3D *pixel* color equality requires a GPU+Qt screenshot comparison including tone mapping, color space, PBR lighting and native blending; token equality is not pixel equivalence.
- `GreaterDepth` dashed rear hints and the transparent depth-writing ordering must be visually checked at front, side and 3/4 with each stick at neutral/max/pressed, especially on dark/light/mixed backgrounds. A green Node test of renderOrder does not prove correct physical occlusion.
- Qt 6 SDK is unavailable here. The Qt Quick 3D example remains a reference integration snippet, not a standalone compiled project.

## Start / compare

1. Unzip to a new directory, run `start.cmd` on Windows or `npm start` (Node 20+).
2. Open `http://127.0.0.1:8792/` to access **Alle Labs**.
3. Choose **Material Identity / Frosted Ghost** to view two 3D rows and their matching native 2D SVG rows. Use the single materialmix slider and “Alle Controls aktiv”.
4. To access the original 3×2 viewer directly, open `/index.html?layout=dualsense`.

Original OBJ and SVG source bytes are unchanged. Historical v24–v34 docs remain available but are not v35 validation evidence.
