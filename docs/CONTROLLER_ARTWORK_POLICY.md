# ExoSnap controller model artwork policy

## Clean gamepad appearance

For every 3D model matching an existing 2D reference:

- Preserve the original physical silhouette and individual pressable controls, including button-face legends (e.g. A/B/X/Y, PlayStation shapes) and a logo **only when it is actually inside a physical button**.
- Remove extra shell prints: manufacturer wordmarks outside buttons, model names, serial numbers, advertising, stickers and unrelated decoration. Do not introduce these marks as new textures/decals.
- Preserve source-model colors as the initial palette. GameCube defaults: purple body, green A, red B and yellow C-stick; look-specific Ghost/Pressed materials remain editable.
- The browser runtime currently adds only button-face decals. The original Larf OBJ manifests provide colors and geometry; they do not supply printed shell textures. Any later authored mesh containing baked-in shell text needs a genuine geometry/texture cleanup during asset preparation, not merely a hidden UI flag.
- Do not apply PlayStation glyphs to Nintendo, Xbox or Steam models. Keep 2D mappings as the semantic source; use correct device-family visuals.
- Buttons, logos and geometry are independent: editing the artwork must not change model mesh counts, control pivots, input mapping, touchpad or stick mechanics.

## Rights and future clean-room models

- The current GameCube 3D source is the original MIT-licensed Larf controller geometry, vendored from pinned 3dco+ and verified byte-identical to the upstream OBJ. It is a licensed derivative when recolored or modified; retain the original notices.
- The alternative Sketchfab URL supplied in discussion has not been independently verified for license/download status; do not import it into this repository unless its precise model license and attribution requirements are confirmed.
- An independently authored controller-inspired mesh can be owned/licensed as original *geometry* if it was actually created independently using suitable physical design references. Recoloring or remeshing another author's mesh does not make the original copyright disappear; third-party trademarks and design rights remain separate.
- Source/license review precedes any public distribution. Different 2D SVG licenses do not automatically license their matching 3D models, or vice versa.

### Current first-pass implementation

`control-glyphs.js` paints source-attached face-button decals per model family, rather than using PlayStation glyphs on all models. Existing shell text is not being painted by the runtime. Branded center-button marks are not synthesized when absent from licensed input assets; those need a verified/source-authorized embedded-button artwork pass.
