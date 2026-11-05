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

### GameCube source-artwork parity pass (2026-11-05)

The GameCube 3D A/B/X/Y legends are reconstructed at runtime from the **actual SVG glyph paths** in `references/controllers/gamecube/source.svg`. `applyGameCubeButtonArtwork` finds the button's native 2D face/glyph, determines its authored proportions with SVG `getBBox()`, creates a source-shaped decal texture and enlarges the otherwise tiny projected label to a legible 54–68% of the physical button's narrow face dimension. Decals remain source-attached. Neither OBJ geometry nor the 2D source changes. Preserve the original 2D GPL-3.0 attribution separately from the MIT 3D mesh attribution. CI checks the four author-drawn glyphs and captures the actual GameCube WebGL view.

## Input color-state contract (2026-11-05)

**Only three input states exist**: neutral, analog motion/pressure, and clicked/pressed. **No focus or hover state is part of the controller visualization.** UI form controls may have their own keyboard focus indicators, unrelated to gameplay.

- Shared 2D/3D blue is `#4F9EEB` by default; `ActiveColorState` starts linked, and users can deliberately unlink the debug colors.
- Digital ABXY/D-pad/menu/shoulder buttons: idle muted blue, pressed solid blue; restrained emission (avoid washed-out cyan/white).
- Joystick: idle cap white-ish `#E6EFF6`, physical recesses dark neutral without *any idle colored accent ring or halo*. Moving the stick tints its cap toward pale blue; only L3/R3 click turns it fully active blue. A physical non-emissive socket outline is not an interactive status ring.
- Analog triggers: idle light gray-white `#E6EFF6`, smooth color interpolation to active blue proportional to actual L2/R2 pressure. In the browser lab the optional `Trigger L2/R2` slider drives both equally, live standard Gamepad API reads button values 6/7, and Press All overrides to full pressure.
- The material mix determines how transparent the *housing* and inactive controls are. The semantic input state and pressed blue do not change by dark/light/mixed backdrop; neutral stick and trigger surfaces remain legible.
- The browser test views are the validation target first. The QML sample palette is aligned, but full native Qt Quick 3D parity still needs its own rendered verification.
