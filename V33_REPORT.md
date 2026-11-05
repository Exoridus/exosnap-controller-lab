# ExoSnap Controller3D Lab v33 — Source-driven optimization and two clean looks

## Source and scope

This complete ZIP is a **standalone derivative of the supplied v32 ZIP**. It does not change the GitHub ExoSnap repository or PR #517. The two new Three.js looks are preview candidates and **not native Qt render results**. The previous eight A–H looks remain accessible through `pbr-lab.html?variants=all`.

## How to start

1. Unzip into a clean directory; use `start.cmd` on Windows or `npm start` anywhere with Node >=20.
2. Open `http://127.0.0.1:8792/` for the unchanged 3×2 main UI (apart from centralized navigation).
3. Click **Alle Labs** > **Material Identity / Frosted Ghost** or open `/pbr-lab.html`.
4. Inspect `Rendering = 3D einmal · GPU-Kopie` and `3D drei Mal (Diagnose)` at the same material mix, camera and size. In a WebGL-capable browser the panels show **individually observed draw calls**.
5. Change the single material slider (0 solid, 50 glass, 100 ghost), choose Neutral/Bewegt/L3/R3/Live Gamepad. Both sticks are independent in live input. When their individual press-alpha differs, the instanced pair automatically falls back to its two original meshes.

## Exact audited source geometry (DualSenseCompact)

`npm run audit:v33` parses the original OBJ files with the actual project OBJ loader; see `evidence/v33/audit.json`.

| Quantity | Original | Optimized neutral |
|---|---:|---:|
| Visible 3D mesh draw candidates per controller | 26 | 22 |
| Visible triangles submitted per 3D pass | 6,998 | 6,998 |
| Distinct manifest triangles including hidden touch sensors | 7,030 | 7,030 |
| **Estimated** calls for three backgrounds | 78 | 25 (22 once + 3 GPU copies) |
| **Estimated** triangles for three backgrounds | 20,994 | 7,004 (6,998 once + 3×2) |

**These are source-derived theoretical counts, NOT measured driver/WebGL data.** In a working browser the new per-panel counters use `renderer.info.reset()` immediately before each actual `renderer.render`, not a total divided by three. Direct mode displays the actual count per Dark/Light/Mixed panel. Shared mode reports a shared one-time 3D count and an individual GPU compositing/blit count per panel. The source render is charged once to the variant, not incorrectly billed three times. Native Qt 3D counts require separate profiling of PR #517.

### GPU rendering reduction

The controller is drawn into a single transparent `THREE.WebGLRenderTarget` per recipe and then placed in three background panels through three ordinary screen-quad draws, using one `THREE.WebGLRenderer` and one `THREE.Scene`, without CPU `readPixels`, a second controller rig, extra shader code or a new texture download. Target is resized only when panel dimensions change. Since backgrounds are separate CSS layers, each final panel has the same geometry and pose, with a different backdrop. Mixed backgrounds must not influence the controller appearance for this optimization to be equivalent. If scene-dependent lighting or background-adaptive contrast is introduced later, use direct mode or a separate source pass as appropriate.

A 320×214 RGBA8 target consumes roughly **267.5 KiB of color texture** at 1× DPR, plus depth storage, GPU backend overhead and copies during resizing. At DPR=1.25 the color target is roughly **419 KiB**. This is deliberately a memory-for-draw-call trade-off. There is still one RGBA8 framebuffer for the shared gallery output, whose memory is unchanged.

### Geometry batching, reuse and instances

- A pair of same-color static `top_shell.obj` submeshes is conservatively merged after applying source local transforms, preserving normals and materials; **1 visible draw saved** for DualSense. Other color regions remain separate.
- The L/R source geometry of stick **stem, rim and cap** is truly identical; the GPU buffers are shared (59,136 bytes of redundant attribute data avoided in source measurement). In optimized mode, these three pairs are represented by three `THREE.InstancedMesh` nodes instead of six individual draws, **3 additional visible draws saved** when material opacity/press states are compatible.
- Independent L3/R3 alpha remains correct: if click states or required activity alpha diverge, instance nodes are hidden and original meshes are shown, with no geometry regeneration.
- Original face buttons and D-pad submeshes are **NOT instanced**. Although they are functionally similar, their source triangulations differ (including printed/molded details) and they need independent press states. Instancing them without proper asset normalization would sacrifice fidelity or button control. Further savings require verified neutralized/re-authored geometry/UV decals.
- No automatic triangle decimator has been applied. The **actual source has only 6,998 visible triangles**, and eliminating more without verified closeups would be speculative. The earlier ~21k count was three passes of the source, not one controller. Native Qt #517's procedural stick geometry is a separate concern, and 32 radial segments should be profiled there before changing PR code.

## Clean material and joystick behavior

`Material Identity Clean` keeps original model color regions intact at Mix 0, with subtle cool-blue idle controls at high mix values; `Frosted Ghost Clean` uses softer matte PBR, transparent shell and slightly bluer idle controls. Both use a single directional key plus modest ambient. Old A–H variants are archived and unchanged.

- **Neutral:** source-authored control look, no fake activation.
- **Moving:** stick stems/rims/caps brighten subtly without being considered a button press; both original pivot hierarchies rotate (max 0.23 radians).
- **L3/R3 clicked:** muted, partially transparent blue instead of opaque neon; strongest response on moving stick elements, not the stationary housing well.
- **Independent hardware input:** reads browser Gamepad API if available; all states return to neutral on release or disconnected pad. Source input is not altered.

Both hero looks and stick appearance are exported in `qt-quick3d-port/pbr-reference-recipes.json` with shared input-space parameters. The Qt QML examples remain reference components, not a standalone compiled native renderer. Same numeric inputs do not ensure identical GPU lighting, alpha blending or tone mapping. The GPU texture reuse is a gallery/application compositing optimization, not an intrinsic part of the PBR material.

## Lab navigation

The main `index.html` now presents **one primary navigation link: Alle Labs**. `labs.html` routes to the two clean looks, 2D reference gallery and Qt renderer audit; historic A–H/2D material/contrast/V24 galleries, single-reference check and diagnostics are grouped separately below. Secondary HTML pages include a link back. Nothing has been silently deleted; old URLs continue to work. Static navigation screenshot: `evidence/v33/labs-browser-real.png`, captured from Chromium rendering the actual HTML/CSS of `labs.html`. It does not demonstrate WebGL.

## Verification and limitations

- Project Node suite: full `npm run verify`; see `evidence/v33/verify.log`.
- Source geometry audit: `npm run audit:v33`; see `evidence/v33/audit.json`.
- Browser probe: Chromium local HTTP and file URLs both returned `ERR_BLOCKED_BY_ADMINISTRATOR`; a real `webgl2` context also returns null on about:blank, even with SwiftShader arguments. Logs in `evidence/v33/browser-qa.log` and `evidence/v33/browser-file-qa.log`.
- Actual 3D screenshots, render-target RGB/premultiplied-alpha visual parity, observed GPU call numbers and native Qt measurements **remain unverified** in this environment. No static image or generative substitute is counted as a 3D proof.
- For a production approval run compare direct vs shared at Dark/Light/Mixed, all three panel sizes, Mix 0/50/100, both stick clicks independent and 3D orbit/zoom. Pay particular attention to composite alpha edges, translucent controls, physical depth and sorting; if a blend difference occurs, the direct mode is the safe diagnostic fallback.
