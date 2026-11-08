# Controller Lab consolidation — browser contract and Qt handoff

The main Lab has two 3D feedback choices, **White** (`white`, default) and **Cool white** (`cool`), and one independent 2D appearance. Both 3D choices use the same original controller, neutral source colors, materials, camera and HDR lighting. Only active feedback differs. This is a browser implementation and a specification for a later Qt port: **`nativeValidated: false`**. No native ExoSnap renderer change or Qt visual parity is established.

The executable contract is [controller-lab-style.js](../controller-lab-style.js), with state application in [pbr-appearance.js](../pbr-appearance.js). Historical A–H/Hero comparisons and earlier Qt notes describe their own archived behavior.

## Appearance and input

The Material mix slider affects **3D only**. It changes transparency while preserving source RGB; it does not tint neutral controls or repaint the authored 2D row.

| Parameter | Mix 0 | Mix 0.5 | Mix 1 |
|---|---:|---:|---:|
| Housing opacity | 1.00 | 0.32 | 0.10 |
| Interactive control opacity | 1.00 | 0.48 | 0.25 |
| Structural stick stem/fixed well opacity | Housing | Housing | Housing |

Between these anchors, each half of the range uses smoothstep interpolation, `s(u)=u²(3−2u)`. There is no fixed 0.52/0.53 opacity floor in this contract. Active opacity approaches 1 in proportion to input strength.

White feedback targets `#ffffff`. Cool feedback also targets white on dark source controls; on bright source controls it mixes white toward `#4f9eeb` with weight `1−mix`. “Bright” means linear RGB luminance `0.2126R + 0.7152G + 0.0722B > 0.55`. Thus the cool distinction fades to white at mix 1. A user-selected custom active color takes precedence. Neutral source RGB is identical between choices at every mix.

The moving stick ring indicates analog travel; the cap center indicates L3/R3 click. The structural shaft/well stays neutral. The authored moving assembly is tilted once so the cap follows its shaft. Buttons, shoulders, triggers and paddles respond to their individual input values; trigger feedback follows pressure. Emission is the active color multiplied by **0.16 × input strength**, and is zero at rest.

The 2D row calls `paintPolished2D(reference, 'ghost', scene, options)` directly. It has no PBR recipe or Material mix input. Interactive surfaces use neutral opacity **0.26**, active opacity **0.40**, and white default active color. Neutral fills, glyphs and strokes are achromatic: light on dark, dark on light, paired contrast on mixed. Its optional active color remains independent of 3D unless the user synchronizes the color controls. Speaker holes, mute detail and shell decoration retain their complete authored paths and receive no artificial input feedback.

## Standard PBR, artwork and physical depth

The controller uses standard PBR materials. The consolidated recipe sets custom ghost Fresnel strength to zero and installs no new per-material Fresnel patch. Housing roughness is **0.58**; control recipe roughness is **0.64** (the current Three.js applicator adds 0.06, giving **0.70** on control-role meshes). Metalness is **0**, clearcoat **0.09**, and original color weight **1**. A shared `studio-neutral.hdr` probe has intensity **0.92**; direct recipe lights are off. Output is ACES tone mapping, exposure **1**, with sRGB output. These are renderer inputs to calibrate in Qt, not a pixel-match guarantee.

[control-glyphs.js](../control-glyphs.js) prepares face-button, D-pad and supported Create/Options artwork from the original 2D SVG paths, including their authored transforms. Decal sizes follow actual 3D part dimensions; small control labels can sit above their buttons. Textures are prepared when artwork loads, then reused by the same rig across backgrounds. Source geometry and ownership remain intact. Canvas preparation of source paths is separate from GPU rendering; the render pipeline performs no CPU pixel readback.

[ghost-depth-policy.js](../ghost-depth-policy.js) uses physical depth to decide visible fragments. The normal control surface retains depth testing/writing; no camera-yaw cutoff deletes an entire trigger. Dashed shoulder/trigger/paddle hints use a hidden-fragment depth comparison (`GreaterDepth`), with a contrasting outline. Their opacity interpolates from **0.28 idle** to **0.90 active**. A restrained hidden fill reaches **0.12 × input strength** only while active. Exposed fragments render normally. These overlays follow each control’s actual input, including independent left/right states.

## Rendering and resource reuse

The default shared rendering path has one source rig, one renderer/context, one camera and one HDR probe. It renders that rig once **per feedback choice**, then reuses the transparent GPU texture for dark, light and mixed panels. A queued render runs when inputs, model, camera or settings change. The fixed 2D row caches its own appearance inputs so a 3D mix/orbit change does not repaint its SVGs. A direct rendering comparison mode remains available for diagnostics.

[silhouette-composite.js](../silhouette-composite.js) supplies the background-aware alpha-edge compositor. It samples the existing texture to add light/dark outer contrast and adjust faint transparent pixels; fully opaque active surfaces are preserved. This is custom presentation shader work even though the controller surface materials are standard PBR. It supplements the physical depth buffer.

**Shared buffers and instancing are different optimizations.** `shareEquivalentControlGeometry(native)` shares only exactly proven source buffers, preserving ordered positions, normals, UVs, indices, groups and winding under verified proper axis rotations/translations. It keeps separate meshes, holders, materials and input state, and reports **zero saved draw calls**. Reflections, vertex reordering and approximate matches are declined. Run it immediately after loading the rig, before building geometry-derived hints or other auxiliary children; animate the existing holder hierarchy afterward.

The audit of **11 separately loaded approved/generated rigs** measures **246 → 227 unique geometries**, **19 proven matches**, and **282,624 bytes (276 KiB, 4.56%) saved** from 6,194,880 source attribute/index bytes. No triangles change. This aggregate is not one controller’s resident memory. Exact stick instancing separately saves up to **15 resting draw calls summed over those separate loads**. Each active rig’s real savings depend on final inputs/materials. Compatible stick pairs require equal final color, opacity, emissive, depth and other rendering state; otherwise that role falls back to its original two meshes. Face/D-pad candidates remain distinct where the exact proof fails. Reproduce the audit with `node tools/audit-geometry-reuse.mjs` or `--json`.

## Later Qt implementation

Map source colors, roughness, metalness, clearcoat, opacity and emission to Qt [PrincipledMaterial](https://doc.qt.io/qt-6/qml-qtquick3d-principledmaterial.html). Preserve source hierarchy, pivots, front-face transform and normalization to maximum extent **4.05**. Reuse one imported mesh resource with independent nodes/material state where the exact proof permits it. Qt [Instancing](https://doc.qt.io/qt-6/qml-qtquick3d-instancing.html) is a separate option; retain final-state compatibility checks and original-node fallback, and validate transparency/sorting against the rest of the scene.

Two renderer-specific pieces remain: the hidden-fragment dashed/fill overlay with physical depth access, and the background alpha-edge texture compositor. They need explicit Qt render-pass/shader implementations, potentially using [CustomMaterial](https://doc.qt.io/qt-6/qml-qtquick3d-custommaterial.html) and a Qt Quick presentation effect. They are not automatic PrincipledMaterial settings. The final Qt pass design is still open.

Validate actual native renders for front/tilted/side views, independent inputs, moving/clicked sticks, mix 0/0.5/1 and all three backgrounds. Calibrate alpha/depth ordering, HDR/BRDF response, color management, tone mapping and antialiasing; measure GPU cost on target hardware. Browser captures and parameter descriptors establish reproducible inputs, while **native validation remains outstanding**.
