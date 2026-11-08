import hashlib,pathlib
items=[
('THIRD_PARTY_NOTICES.md', '493e2375439cf8ecdae701b44e280ee9f3f11806cfdf3462fa46c075bdefe16a', '740d33597d17b34636368b45c188bb53422c729bc5bbcb8b0133ed6359fb0e5d', [
(58,58,r"""
## Generic Pro source-profile correction (2026-11-08)

The revised Generic Pro geometry follows the already approved native Generic 2D source profiles (Xelu/Luna CC0 silhouette and MIT control source). It retains the existing independently animated rig. Provenance is MIT AND CC0-1.0, not a claim of a third-party-free mesh. Source and notices: `references/controllers/SOURCE-NOTICE.txt`, `docs/MODEL_ASSET_PROVENANCE.json`, `assets/GenericPro/source-profile.json`. Original authors' notices remain applicable.
"""),
]),
('docs/MODEL_ASSET_PROVENANCE.json', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '99075aa26a3828ef5617589e94d514fe6be6a66f333d4e7ef56ef1e4cacea058', [
(0,0,r"""{
  "baseline": "acfa3d0c7d376944d8efebd4968e736c3c69cca7",
  "restored": [
    {
      "path": "references/controllers/gamecube/source.svg",
      "beforeSha256": "323f5210224bcd026eca9c657697d78cc7c26eac4c71b54ff875a4fe0bea8744",
      "sourceSha256": "33cf53ce1eeeea1a575f174f503f4415a13683967e6f275d1ad119cd4f273efc",
      "sourceRepository": "Exoridus/exosnap",
      "sourceCommit": "ee88ed6948795645a7e4d4d6fa497b63462c44f3",
      "resultSha256": "9e7974cd7b82beac6acd6d8a80886997e161019df2d1cc3abf4a7fd17e0605d5"
    },
    {
      "path": "references/controllers/gamecube/mapping.json",
      "beforeSha256": "df0490a4ac5d8966b1864b5e08e57d953a6832b8396916aa7612157378f8abe0",
      "sourceSha256": "7d90216132d25e5e1704e2e5e80f7278fbd928b081f0add9955435e8504b354a",
      "sourceRepository": "Exoridus/exosnap",
      "sourceCommit": "ee88ed6948795645a7e4d4d6fa497b63462c44f3",
      "resultSha256": "7d90216132d25e5e1704e2e5e80f7278fbd928b081f0add9955435e8504b354a"
    },
    {
      "path": "references/controllers/switch_pro/source.svg",
      "beforeSha256": "d78365d6d8faa14ebe8afa92be746e5bc3d706fe5db54c1e7569f599ad64dd33",
      "sourceSha256": "62c361f1a39d39a828e286ae4ee6682b2d82fe7dc7169e0149d0df4ffa26d685",
      "sourceRepository": "Exoridus/exosnap",
      "sourceCommit": "ee88ed6948795645a7e4d4d6fa497b63462c44f3",
      "resultSha256": "62c361f1a39d39a828e286ae4ee6682b2d82fe7dc7169e0149d0df4ffa26d685"
    },
    {
      "path": "references/controllers/switch_pro/mapping.json",
      "beforeSha256": "fb08f9de5e1d4493163072bdc2db6c15670739756f5c71cc9c010845b19ef2d4",
      "sourceSha256": "c913dcdf56f3712eecb14019b2418b5bcf433fc09c88c86034de540fdf67b92b",
      "sourceRepository": "Exoridus/exosnap",
      "sourceCommit": "ee88ed6948795645a7e4d4d6fa497b63462c44f3",
      "resultSha256": "c913dcdf56f3712eecb14019b2418b5bcf433fc09c88c86034de540fdf67b92b"
    },
    {
      "path": "references/controllers/joycon_grip/source.svg",
      "beforeSha256": "60926f8f212943608682bbd9678cd12c809e3ddf250a579348b7138b884ed6c6",
      "sourceSha256": "84cdfcfb2c82c6d4f8ddb2ae36625fb552945133312c0985ef06a02f93a29881",
      "sourceRepository": "Exoridus/exosnap",
      "sourceCommit": "ee88ed6948795645a7e4d4d6fa497b63462c44f3",
      "resultSha256": "9a2cdc41a133a081216f3eebaea4272b9f88441bebae43fcf2439d695931206d"
    },
    {
      "path": "references/controllers/joycon_grip/mapping.json",
      "beforeSha256": "93097233d8d37261e2c65d64c4f43807d76a786e05965975507716ad47dcca45",
      "sourceSha256": "25ede558dc7299b50dc258f76d604a9154c9deb09171de967ebbe9c921529f34",
      "sourceRepository": "Exoridus/exosnap",
      "sourceCommit": "ee88ed6948795645a7e4d4d6fa497b63462c44f3",
      "resultSha256": "25ede558dc7299b50dc258f76d604a9154c9deb09171de967ebbe9c921529f34"
    },
    {
      "path": "references/controllers/generic/source.svg",
      "beforeSha256": "b3ad9285dacd9c3345f07957255e6628b37561ad2411c23579686cd34558eb80",
      "sourceSha256": "4a192594e161098c1c344f39dfb9ac4635f589edefe0033fe8e1255fa4b97ccc",
      "sourceRepository": "Exoridus/exosnap",
      "sourceCommit": "ee88ed6948795645a7e4d4d6fa497b63462c44f3",
      "resultSha256": "4a192594e161098c1c344f39dfb9ac4635f589edefe0033fe8e1255fa4b97ccc"
    },
    {
      "path": "references/controllers/generic/mapping.json",
      "beforeSha256": "09f47fe4a1941b63e6886f70b0ffa9d0a36ccda5ecaff7ce41b44a48eb087fcf",
      "sourceSha256": "9b619a3b03cbc4c4b627d02c1c971afad3e9745cc6f21de80eac8b3e98d3edc8",
      "sourceRepository": "Exoridus/exosnap",
      "sourceCommit": "ee88ed6948795645a7e4d4d6fa497b63462c44f3",
      "resultSha256": "9b619a3b03cbc4c4b627d02c1c971afad3e9745cc6f21de80eac8b3e98d3edc8"
    }
  ],
  "notes": [
    "GameCube unchanged source geometry plus original custom tesseract and START/PAUSE paths.",
    "Switch/Grip remove previously removed decorative wordmarks, preserve functional glyphs and source shapes.",
    "Generic 2D restores native approved Luna-derived outline and transforms, NOT a new invented model.",
    "Joy-Con existing anonymous moving paths are named for semantic painting; d/transform unchanged."
  ]
}
"""),
]),
('docs/MODEL_CONSISTENCY.md', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'd2cdca233f6ec62b138c99c2b2eb54f38407fe4ba79034174a0d1282d33c431e', [
(0,0,r"""# Cross-model consistency — 2026-11-08

Baseline: `acfa3d0c7d376944d8efebd4968e736c3c69cca7` (PR #7).
This is a correction of the current renderer and asset selection, not a new look.

## One visual contract

`controller-visual-policy.js` owns the neutral control gray (`#9ca3aa`), subdued control contour colors, structural-role classification and continuous, softened legend contrast. Housing keeps its original colors. At the Original endpoint the original 3D colors remain; the same scalar transition brings every interactive surface toward the shared Ghost gray. Input interpolates toward the selected active color (white by default). Housing and supports never receive active emission.

The separate 2D material control still starts at 70% transparency: .30 neutral coverage, .96 active coverage. Housing contours remain the accepted PR #7 profile; control contours are independently gray. There is no new permanent control.

| Role | Material and state |
|---|---|
| Housing | Source color and original shell mix; no input feedback |
| Structural support / stem / well | Source-to-local-shell color, reduced shell-linked opacity; no input feedback |
| Button / directional surface / shoulder / trigger / bound touchpad | Shared neutral control material; independently activated |
| Stick ring | Original upper rim responds to analog magnitude; lower sidewall remains structural |
| Stick center | Independent stick-click state |
| Functional legend | Original paths/UV mask; subdued contrast against its surface; global Markings |
| Decorative marking | No fabricated input; approved emblem retained; removed commercial housing branding stays removed |

## Common causes corrected

1. `paintControlGroup()` was choosing surfaces by suffix and ignoring `mapping.pressElement`. DS4's single touchpad path, Xbox/Generic directional paths and some menu buttons consequently had no resting control material. Explicit mappings and existing role now choose the real source surface. Touchpad click remains the existing binding; no touch-contact state is invented.
2. Joy-Con cap paths were present but unnamed, while `paintStick()` searched for `-outline` and `-top`. Those exact existing paths now have stable semantic names. Grip nicks are structural detail; ring fill and center are independent. No source path is redrawn.
3. Converted filled outline paths and invisible pressure paths acquired a second stroke. The painter preserves the authored contour and does not add a second outline to hidden pressure geometry. This removes the redundant Xbox 360 home rim without deleting the home button.
4. PR #7's support material was restricted to DualSense. The same policy now applies across families. On split lateral housings the nearest source shell is selected geometrically at load, avoiding cross-color support leakage on the Joy-Con Grip.
5. One `left/right_ring.obj` can include both an interactive rim and a lower structural wall. A source-vertex weight separates them inside its existing material; it does not split or replace the mesh. Original transforms, vertices and depth settings remain.
6. Transparent surfaces were source-over accumulated inside the controller target before the nearest surface was final. The consolidated renderer now writes the nearest passing surface's premultiplied RGBA into that same target, and composites it once. Hidden input hints remain ordinary depth-tested overlays. This avoids self-darkening/overlap at housing joins without merging moving shoulder parts or adding another geometry pass.
7. Surface ink is not fixed black/white and is not faded solely with a Ghost button. The shared soft contrast policy uses bounded gray values and continuous interpolation; the existing material mask has independently bounded coverage (.72). Original symbol shapes remain. Contrast polarity cannot be continuous *and* guarantee a fixed contrast ratio at every intermediate crossover; the prescribed 0/30/70/90% neutral/pressed checkpoints are explicitly checked. No halo plate is added.

## Geometry-specific data, not family-specific material algorithms

- **Xbox 360 housing wells:** the D-pad dish and two stick wells are disconnected authored components inside `top_shell.obj`, not separate control files. `model-semantics.js` identifies their inspected original component bounds. Source vertex IDs determine the components (coordinate welding would falsely join their seams). The shared support-region shader reduces only those components' coverage. The original OBJ remains unchanged.
- **GameCube shoulders:** original `top_shell.obj` and `bottom_shell.obj` remain intact; the latter includes the two small shoulder connection faces. No blind merge or topology deletion. Physical nearest-surface compositing removes accumulation at overlaps. The actual shoulder/trigger controls retain their original hierarchy and mechanics.
- **GameCube C-stick:** the original 2D asset has one C-stick surface rather than two concentric cap regions; it is not replaced by invented circles. There are no hardware L3/R3 buttons on the source mapping. Matrix records mark such absent inputs rather than declaring them hardware-tested.
- **WaveBird:** licensed source rig still covered by Node invariants, but not selectable in the paired page because it has no 2D asset. No fabricated 2D view.

## Recovered sources

See `MODEL_ASSET_PROVENANCE.json`. The source-history artifact `13623621299` includes the Git history; baseline artifact `13623671174` includes genuine before renders for every selectable model and the pinned native asset pack.

Native source: `Exoridus/exosnap@ee88ed6948795645a7e4d4d6fa497b63462c44f3`, read only.

- GameCube retains its existing improved silhouette and controls; the actual previously authored `body-cube`, `body-cube-outer` tesseract and `body-start-label` are restored. No new emblem is invented. Its 3D transfer is not added as floating geometry; no previous approved surface-bound 3D emblem was found.
- Switch Pro and Joy-Con Grip recover their existing branding-free SVGs and mapping. Functional Home/Plus/Minus/Capture controls remain.
- Generic recovers its improved native SVG and matching mapping, not an old source over the new material system.
- Other sources retain their existing shapes. Stable Joy-Con IDs are non-geometric metadata.

## Generic Pro: bounded correction, not a claimed historical 3D restoration

No better earlier Generic 3D was found in the examined history. The old `a5e7520` blockout had incorrect control placement, square directional parts, detached rectangular shoulders and center-fan triangulation across a concave grip notch. It is not called an approved model merely because it loads.

The existing 23-part rig is now built from the approved native SVG perimeter and control profiles. `tools/extract-generic-profile.py` bakes the original transformed curves into a source-hashed profile; `tools/generate-generic-pro.mjs` triangulates the concave perimeter, adds bounded bevel/depth and builds the same independent mechanical parts. Directional pieces are sectors of the original connected D-pad, not four squares. Actual source positions, curved shoulder profiles and stick proportions replace the wrong blockout layout. There is no new foreign mesh or renderer.

This is a deliberate asset improvement, not a claim of byte-identical Generic geometry. The ten original licensed CO families remain unchanged. Exact-reuse checks still prohibit approximate welding. The revised Generic's distinct profiles no longer provide the old four identical blockout pad buffers; unsupported matches are not forced. Source provenance is **MIT AND CC0-1.0**, inherited from the already approved SVG, not misleadingly relabeled MIT-only.

## Qt portability delta

`docs/VISUAL_FINISH_QT_GATE.md` remains authoritative; `nativeValidated` remains false.

| Change | Native implementation | Evidence scope |
|---|---|---|
| Shared fill/outline/ink parameters and semantic path IDs | Existing QPainter / QSvgRenderer preparation and sprite atlas | Native SVG fixture probes repeated by PR workflow; not live ExoSnap parity |
| Original support component / ring weights | Vertex COLOR.r or UV1 plus the existing Quick3D CustomMaterial | API-supported; new shader not natively validated |
| Independent surface ink coverage | Existing CustomMaterial texture-mask stage, color/opacity uniforms | Browser-tested; final Qt shader adaptation still required |
| Nearest physical premultiplied target | Explicit material source=One, destination=Zero blend and depth writes; one offscreen View3D/target plus existing composite | Requires native render-state validation, especially backend transparency ordering; not automatic PrincipledMaterial parity |
| New Generic profile geometry | Existing Model/Node hierarchy and mesh conversion | Browser geometry and mechanics checked; final native asset conversion pending |

No new runtime texture rasterization, CPU readback, geometry pass or full-frame background sampling. All masks/weights are prepared at asset load; all input changes reuse materials, attributes and the original target. CI-only pixel readbacks provide evidence and are not production rendering.

Official API references: https://doc.qt.io/qt-6/qquick3dgeometry.html and https://doc.qt.io/qt-6/qml-qtquick3d-custommaterial.html . Qt fragment blend factors and custom vertex channels must be configured explicitly; the lab does not claim a full native D3D11/Metal/Vulkan validation.

## Acceptance

`tools/capture-model-consistency.mjs` discovers the actual page selector. Each paired model is checked across 0/30/70/90% 2D transparency, every present mapped 3D control, both available stick sides, available click bindings, analog trigger values and combinations, on all three backgrounds. Additional original/glass/ghost and front/angled/bottom render captures, Markings toggles, source-render pixel hashes and all-model native SVG fixtures are produced.

Checks inspect actual computed SVG paints, control type, PBR material uniforms and actual WebGL pixel changes. The before/after images must also be visually inspected. The machine report states exact executed samples and absent input capabilities; it is not an assertion that every possible Cartesian permutation was exercised.
"""),
]),
 ]
for name,before,after,edits in items:
 p=pathlib.Path(name);source=p.read_text() if p.exists() else ''
 assert hashlib.sha256(source.encode()).hexdigest()==before, 'Source changed: '+name
 lines=source.splitlines(keepends=True)
 for a,b,text in reversed(edits):lines[a:b]=[text]
 result=''.join(lines)
 assert hashlib.sha256(result.encode()).hexdigest()==after, 'Result mismatch: '+name
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(result)
print('Exact source files applied:',len(items))
