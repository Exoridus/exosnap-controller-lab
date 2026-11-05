# ExoSnap v40 – Qt Quick 3D / Three.js parity note

Source: `silhouette-composite.js`, `ghost-depth-policy.js`, `control-glyphs.js`, `pbr-recipes.js`, plus the actual original OBJ controller mesh hierarchy.

## Rendering contract

1. Render the physical controller once per Look with the authoritative depth test. The moving stick cap, lip and shaft must write depth before the stationary well. Transparent geometry must **not** permit the well to pre-blend under the front cap. Hidden rear triggers/paddles are suppressed in the front-facing Ghost view; optional dashed hints use `GreaterDepth` against the shell.
2. Preserve the original RGB and alpha output of the controller to a transparent RGBA texture. The normal 3D texture remains background-independent.
3. Composite this same texture in three view rectangles in the order dark, light, mixed. v40 adds a **small per-pixel alpha silhouette shader** (`silhouette-composite.js`); it samples 8 neighbors at two radii and applies background-specific dark/light edge weights. It uses **no CPU readbacks** and changes RGB only for weak alpha pixels. Fully opaque pressed buttons remain unchanged.
4. 2D is not 3D: it is its original flat SVG, with color profiles for Dark/Light/Mixed and independent RGB control. The same zoom ratio is applied to the 2D DOM presentation without 3D orbit.

## Qt port feasibility

Qt Quick 3D `View3D` + `SceneEnvironment` with an HDR light probe reproduces the light source inputs but **does not automatically reproduce this screen-space silhouette**. The new operation needs a Qt Quick shader/presentation compositor (for example, a `ShaderEffect` generated using Qt Shader Tools `qsb`) over the shared transparent Quick3D texture; identical inputs do not imply pixel equality. Transfer the shader's coverage threshold, sample offsets and blend mode rather than recreating an unrelated CSS shadow. `qt-quick3d-port/pbr-reference-recipes.json` now labels Hero looks `usesCustomShader=true`, `usesPostprocess=true` and includes the three contrast profiles. Historic A–H recipes remain independent material-only references.

`control-glyphs.js` makes four two-triangle decal planes, each with a small alpha texture prepared only on load. Equivalent Qt `Model` planes with transparent materials can use the same image surfaces and normal orientation. No font files are included.

## Expected cost and validation

- Extra render passes: **0 additional 3D geometry passes**; the three existing per-panel compositing draws become a small alpha-edge shader instead of a plain textured quad.
- Extra shader work: approximately 16 neighbor texture taps per composited screen pixel. Benchmarks on a real GPU are still required.
- Decals: four small source-attached planes add up to four simple draw calls; none of the original OBJ geometry is removed.
- The existing one-render-per-look optimization, geometric stick buffer sharing and 4× MSAA offscreen target remain in place.

Native Qt/WebGL GPU timing, final pixel appearance, alpha blending, AA and color management **remain unverified** in this environment. Use actual Dark/Light/Mixed 240×160, 320×214 and 480×320 captures and check full press states, camera yaw and both maximum stick deflections before approval.
