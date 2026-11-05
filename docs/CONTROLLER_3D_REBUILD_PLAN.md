# Controller3D – Scan / CC0 Source-to-Rig Implementation Plan

**Date:** 2026-11-05 · **Repository:** `Exoridus/exosnap-controller-lab` · **Target:** `main`

## Target and ground rules

Deliver **20 functional 3D presentation variants matching the already finished 20 original 2D layouts**, not 20 unrelated aesthetic assets. Reuse rigs for variants. A scan/AI mesh is a **geometry input**, never evidence that controls are correctly separated, licensed, mapped, or animated. Source provenance and first-hand visual checks are release gates.

- **Source-of-truth:** `references/controllers/catalog.json`, each `mapping.json` and `source.svg` for control placement, face glyph shapes, colors, and active surfaces. 3D must retain recognizable original silhouettes.
- **Visual contract:** preserve labels, symbols, and logos embedded *inside physical buttons*; remove nonfunctional shell markings, printed model IDs, branding on shell, stickers, and unrelated surface decorations. Keep source palettes where they provide recognition, including GameCube purple shell, green A, red B, yellow C-stick.
- **Asset contract:** independent shell, D-pad, face buttons, bumpers, triggers, sticks (shaft/cap/ring), home/menu and any back paddles/touchpads; stable named pivots; static parts do not deform when controls animate. No misleading `native` flag for an approximate proxy.
- **Legal contract:** trace every mesh through the *actual creator's* license. Meshy Community 3D output is generally CC0; Meshy Free **user-generated** output is CC BY 4.0; Meshy paid private outputs follow its terms. Uploaded third-party reference images and scans retain their upstream rights. A public CC0/MIТ label alone is not evidence that the uploader could license a copied branded model. Third-party product-design/trademark rights are independent. Never auto-import NC/ND/restricted/uncleared models.
- **Scope:** this is an internal development lab. No fake completed 3D models, no switching public production app to unfinished assets, no automatic merges into `Exoridus/exosnap`.

## Workstreams (in order)

### P0 – GameCube: make the existing MIT mesh match the 2D face artwork

- **Implemented first slice:** `control-glyphs.js` projects authored A/B/X/Y SVG glyph **paths** from `references/controllers/gamecube/source.svg` onto real source OBJ buttons instead of using a generic font. Scale from source glyph/face bounds; amplify to a 54–68% readable projection coverage at 240–480px panels. Never modify the 2D SVG, button pivots, source mesh triangles or source colors.
- **Complete with:** Playwright CI verifying 4 2D-derived decals and `gamecube-neutral.png`; manually check A, B, X, Y visibility at 240×160 / 320×214 / 480×320, Solid/Ghost/Outline/Identity, neutral/full-press; adjust size/contrast without losing the letter shapes.

### P1 – Steam Deck master → Full / Compact

- Source first: individually licensed CC0 community mesh, a commissioned independent scan, or photos of an actual device that you are entitled to use. **Exclude Valve's official Steam Deck CAD** for commercial reuse: CC BY-NC-SA 4.0, as confirmed in the official-material mirror. Also exclude existing PadForge/Handheld Companion deck derivatives based on that CAD unless a separate grant is obtained.
- Preserve signature wide 16:9 display, side grips, top sticks, square trackpads, D-pad, ABXY, speakers, bumpers, rear controls. Remove shell branding/printing. Reconstruct distinct controls on top of a retopologized shell.
- Use one `SteamDeckMaster` rig. `steam_deck_full` shows the complete device; `steam_deck_compact` is a *camera/crop/presentation* variant of that same rig. No second remodeled physical device, and no stretched shell.
- Acceptance: both catalog entries have the correct `source.svg` and `mapping.json` control IDs, independently testable press states, centered front/angled/rear views, no missing pieces. Target ~8k–25k source triangles prior to shared-instancing optimization (design budget, benchmark on actual hardware).

### P2 – Joy-Con family

- Use existing verified MIT left/right OBJ sets as mechanical candidates; improve recognizable contour and buttons if the 2D overlay differs. Alternative own/CC0 photo scans must pass the same source check.
- One master each for Left and Right; derive horizontal presentation with 90° rotation + proper per-layout button remapping; separate `joycon_pair` composite positions the two masters; `joycon_grip` reuses those masters with an independently licensed grip body.
- All six 2D layouts (`joycon_left`, `joycon_right`, `joycon_left_horizontal`, `joycon_right_horizontal`, `joycon_pair`, `joycon_grip`) require honest independently testable 3D variants. SL/SR, L/R, ZL/ZR and stick movements must follow the correct device-relative axes.

### P3 – Xbox 360 cleanup/replacement

- The actual Larf-derived Xbox 360 OBJ is already MIT-licensed and imported. First compare it against the 2D source and original physical controller photographs; **do not discard the cleared mesh simply to create more work**.
- If the contour is poor, replace the shell with an independent CC0/own scan while retaining separately movable D-pad, colored A/B/X/Y, Guide/Start/Back, shoulder/trigger and stick geometry. Never substitute the Xbox One/Series controller or transplant a paid model.
- Acceptance: correctly sized, high-contrast button legends; full side/angled view and functional press + maximum stick tests.

### P4 – Complete the other 20-layout gaps

- **Generic:** make an independent unbranded shape; candidates `polyhaven-gamepad`, `innerscene-gamepad`.
- **Xbox Series / Elite, DualSense Edge:** use a genuinely rights-cleared CC0/independent scan or new author-built geometry, never borrowed paid CGTrader meshes; Elite/Edge extra controls need separate actual geometry.
- **Steam Controller 2015 / 2026:** seek model-specific cleared geometry; touchpads and distinctive body shapes cannot be replaced by Steam Deck. Individually verify 2026 authorship/rights.
- **WaveBird:** keep available as 3D-only legacy diagnostic, outside the 20-layout completion metric unless a separately licensed 2D is introduced.

## Source-first acceptance pipeline

1. **Discovery:** collect exact model URL, uploader/creator, source type (Meshy Community vs self-generated, Poly Haven, independently photographed scan, existing MIT), current ToS/license permalink, reference provenance, download/creation date. Save license evidence in `.workspace/3d-sources/<asset-id>/`; do not import from a gallery *tag page* as though it were an individual licensed model.
2. **Rights review:** original author? no unlicensed scan/photography, copied commercial mesh, game texture, or unofficial re-licensing? Record `CC0-1.0`/`MIT`/`CC-BY-4.0` (with attribution where required) or block. The `docs/3d-source-candidates.json` registry is an **evidence index**, not an automatic legal approval.
3. **Geometry audit:** use Blender to inspect normals, holes, disconnected parts, scale, transforms and UVs. Save unedited original GLB/OBJ in gitignored `.workspace/` for audit; record SHA-256 of the original.
4. **Rebuild:** retopologize/decompose into shell and movable controls; correct pivots; replace scan-printed labels with original 2D button face glyphs. For variable printed text, clean shell textures instead of applying hiding overlays. Prefer GLB/GLTF master, export OBJ components with `info.json` for current Three.js rig until native loader is unified.
5. **Review:** compare 2D/3D at identical semantic button states; use front, 3/4, side, rear; 240×160, 320×214, 480×320; 0/100% pressed; both sticks in eight maximum directions; disabled/hidden controls tested. Capture real WebGL via CI with unique source SHA and source provenance.
6. **Ship gate:** verify licensing, no missing control parts, nonempty geometry, correct mapped IDs, no JS/WebGL errors, screenshots inspected, and performance on actual GPU. Only then update `controller-catalog.js` from `reference` or `proxy` to `native` and make it selectable.

## What not to infer

- A clean CC0 asset grants copyright-use permission from its author; it does not guarantee the *original designer's* marks, product designs, photos or any third-party inputs are cleared.
- A paid Meshy account does not clear somebody else's image; CC0 model pages do not give us exclusive ownership. We own only eligible independently authored additions.
- A 3D scan is usually a unified visual mesh, not an animatable controller. Remeshing alone does not create correct input controls.
- A passing static unit test proves no visual similarity. Human review of actual browser screenshots remains mandatory.

## Release milestones

- **M0:** GameCube glyph parity and screenshot green, visual signoff pending.
- **M1:** Steam Deck master and two views can be selected with correct functional input mapping.
- **M2:** Joy-Con six presentations share two master rigs plus grip body, verified.
- **M3:** Xbox 360 quality accepted (improved MIT or independently authored replacement).
- **M4:** all 20 2D identities have an honest corresponding 3D presentation, with provenance, button-face parity, visual pass and native Qt integration tracked independently.

Keep each family in its own branch/PR and attach screenshot evidence. Avoid new material styles until at least M0–M3 have been visually compared.
