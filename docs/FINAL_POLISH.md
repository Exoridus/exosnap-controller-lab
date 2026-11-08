# Final Controller Lab polish — 2026-11-08

> Ergänzung zum finalen Stand: [gezielte Sockel-/2D-Korrekturen und Qt-Portabilitätsmatrix](VISUAL_FINISH_QT_GATE.md). Die folgenden Mechanik-/Demo-Regeln bleiben bestehen.

## Source recovery and scope

The current published baseline is `6af4f221f3adecd8b8efde46d788f9dc94c00739`. Implementation was recovered from **artifacts**, not guessed from screenshots:

- GitHub Pages artifact `13610100058`, workflow `42460765877`, contains the complete running Lab and its older `app.js`.
- Source-review artifact `13610905527`, workflow `42463397151`, contains the repository plus full Git history.
- `app.js` in the Pages artifact is byte-identical to the original v40 publication commit `f9597e2`: SHA-256 `5ccc9c0277c05c037fdd63bddb0f9ee0e1be2019d39ec457dfec25465da43bc2`.

The old `highlightPart` used `pressTravelFor` and `triggerMechanics`, while `updateDemo` used the sequential face/D-pad/shoulder/trigger/click combinations and `demoStickAxes`. The current PBR page had lost these calls and animated only its sticks. Those mechanical policies and the demo sequence are now reused by the current PBR rig, not by a parallel renderer.

## Current behavior

**Demo** and **Markings** start on. The automatic twenty-second cycle combines the existing left/right stick curves, separate and combined presses, short/long presses, analog trigger ramps and a neutral loop boundary. `ControllerDemo` writes one reused state object/Map. The frame samples it once; SVG and 3D use exactly that sample. Manual controls take priority, live input suspends the demo through a one-second release window, and background tabs pause the clock. No demo inputs are merged into manual/live input.

Only controller, camera, Demo and Markings are permanently visible. Material, color and size options are in a collapsed section; individual debug controls are in another collapsed section. Clicking ordinary 2D buttons operates them; dragging sticks operates analog axes without inventing L3/R3; a double-click on a stick operates its click. Real standard Gamepad input is detected without selecting a mode.

### 2D

The existing moving outer and inner SVG shapes define a real annular surface. An untransformed wrapper applies a group-coordinate mask with the original center cut out. Shape transforms remain intact, and the center never receives a second alpha layer. Movement changes the ring **fill**, never the contour. L3/R3 independently changes the center. The simple independent 2D transparency control starts at 70%: neutral opacity 0.30, active opacity 0.96. The 3D material slider remains independent. Existing coherent scene ink, decorative paths and side margins remain intact.

### 3D

Face buttons, directional parts and bumpers regain physical travel using the historical policies. Triggers use the authored hinge and per-model rotation, proportional to input. The physically sliding GameCube trigger remains a translation by design. The generated Generic Pro has no authored hinge; its trigger uses a rest-pose-preserving front/top geometry hinge instead of rotating around the controller origin. Child contour geometry follows the moving physical mesh.

Runtime button markings are alpha-mask textures sampled in the existing PBR surface material. They add **zero meshes and zero draw calls**. UVs are generated from unchanged source vertices before exact geometry sharing; the actual source SVG paths preserve orientation and placement. Only front-facing surface normals receive ink. There is no offset plane and therefore no inter-surface z-fighting. D-pad ink is dark at rest. Share/Options labels above the buttons are absent in 3D; the buttons remain interactive. A single global toggle changes material uniforms and SVG glyph visibility, not geometry or mechanics. Textures are created at load and disposed with the rig.

The small surface-ink shader patch is shared; it does not add a rendering pass. Static input states skip redundant drawing while input polling continues. The existing one-rig render-to-texture/background reuse remains unchanged.

## Validation

`npm run verify` includes the historical suite and new regression tests for physical travel, analog rotation, contour movement, deterministic demo coverage, source arbitration, source-bound markings, global toggles, annular fill, independent click and material alpha.

`tools/capture-final-polish.mjs` extends the real Chromium/WebGL release checks: startup defaults, physical controls and exact return, partial/full triggers, underside view, material-bound markings, 2D ring/click states, toggles and opacity. It records `controller-demo.webm` from a separate default-state browser context. The original broad model/2D screenshot matrix still runs afterward. A successful build alone is not visual acceptance.

Native Qt Quick/Nexus rendering and performance measurement remain outside this browser-Lab change. Port the shared input sample, old mechanical policies and scalar material parameters; the alpha-mask ink requires an equivalent material shader. `nativeValidated` stays false.
