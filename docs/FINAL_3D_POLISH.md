# Final 3D polish — source LEDs, Ghost RGB and final-alpha edge

This change intentionally closes only three small presentation gaps. It does **not** replace approved models, their OBJ vertices, the 2D paint palette, input data, Nintendo hardware settings or the native Qt port.

## Nintendo player LEDs — authored graphics, original PBR surface

- **SwitchPro**: 4 rectangles from `references/controllers/switch_pro/source.svg`, on the original `top_shell.obj` front surface.
- **JoyconGrip**: 4 rectangles per side from `references/controllers/joycon_grip/source.svg`, on the original `extra.obj` center-grip front surface.
- Derivation: `mapping.json` supplies the unpadded authored SVG viewBox. Rect centers, widths, heights and spacing are mapped to original OBJ source-space X/Z bounds. A raycast against the specific PBR shell rejects missing, rear-facing and off-shell positions. No guessed per-device physical index is used.
- One `onBeforeCompile` fragment stage tints just the tiny projected rectangles of the existing physical mesh. All eight uniforms share one shader, with separate 4-bit LED masks that are identical for the two Joy-Con Grip banks. Inactive rectangles retain a subtle border; lit rectangles have light fill. No LED mesh, face decal, second draw, CPU readback or per-frame texture upload is introduced.
- The LED-bearing shell is excluded from **static housing batch fusion only**; it remains the original mesh and material. Other eligible housing meshes, exact geometry sharing and stick instancing remain unchanged.
- LED color may locally increase alpha **only within the tiny indicator pixels** so inactive marks remain visible on a light background at full Ghost. Housing and ordinary control alpha are unchanged.
- Web UI starts at demo P1. P1–P8 and Off are explicit *overlay-only* previews. Auto stays unknown without a trusted provider player assignment. Browser `Gamepad.index` is not a player index. No physical LED state is read, written, or claimed.

## Less gray at unchanged transparency

`resolveLabRecipe` supplies `ghostSourceRetention: 0.16`. For neutral interactive 3D roles only, the shared neutral `#9ca3aa` blend becomes `smoothstep(mix) * (1 - 0.16)`. At mix=0 nothing changes; at mix=1 a subtle 16% share of source RGB survives. Original model geometry/shells, 2D RGBA, source-SVG glyph ink, button press activation, white feedback, roughness, and the original housing (1 / .32 / .10) and interactive opacity (1 / .48 / .25) mix anchors remain identical.

## Outer silhouette A/B

The existing `silhouette-composite.js` shader already samples the final controller alpha texture for outer-edge contrast. A small optional `silhouetteEmphasis` strengthens its **narrow exterior** only (not the outlines of individual shells/sticks/buttons), with a low default factor of 0.42. The user can turn **3D-Außenkontur** off inside the collapsed appearance panel to get the previous compositor weights. No extra effect pass, mesh outline or geometry copies; transparent depth semantics and source alpha remain unchanged.

## Test and native handoff

- Node coverage checks projection against original SwitchPro/JoyconGrip OBJ faces and exact 2D SVG rectangles; no geometry mutation or additional meshes; 4/8 LED uniform counts and P1–P8 masks; ghost RGB with alpha invariant; single-pass silhouette toggle.
- The real Chromium capture gate checks actual PNG pixel differences from the 3D-only panel for P1 versus P4, not just status text or a 2D-SVG change. Other existing 2D/3D/Qt/real model checks stay mandatory.
- These are browser Three.js material/geometry facts, **not** evidence of finished Qt Quick 3D native shader parity. Exported Qt parameters identify `nativeValidated:false` and require an explicit source-position shader port, alpha-composite and D3D11 validation. Do not write the Nintendo hardware LEDs from ExoSnap.

## Closure limits

No Generic Pro redesign, new licensed asset, GameCube center-logo transfer or general material system rewrite is included here. Those require a separate approved scope. The current controller artwork remains the accepted baseline.
