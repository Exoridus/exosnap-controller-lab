# Third-party provenance – v27 development preview

## Bundled 3D geometry: DualSense

The **27 original `*.obj` parts** and associated `info.json` in
`assets/DualSenseCompact/` have been restored from the user's previously
provided v23.2 browser-validation archive. The source model in the original
[3D Controller Overlay](https://github.com/larfingshnew/3d-controller-overlay)
project is covered by its MIT repository license, Copyright (c) 2024 Larf.
Retain `licenses/MIT-Larf-3D-Controller-Overlay.txt` and attribution when
redistributing the preview. Restoring cached original bytes is not a claim
that these models were independently created for ExoSnap.

The Controller3D Lab is a **developer preview**, not a rights-cleared
commercial ExoSnap release. Per-model rights must be reevaluated for any
additional model imported from another repository.

## Bundled JavaScript modules: Three.js

The preview bundles original Three.js r180 cached from the same prior browser
validation session. Three.js is licensed under MIT,
Copyright 2010-2025 Three.js Authors. Retain `licenses/MIT-Three-js.txt`.
Three.js source modules preserve their own license headers.

Three compatibility modules under `node_modules/three/examples/jsm/lines/`
(`LineSegments2`, `LineSegmentsGeometry`, `LineMaterial`) are simplified local
compatibility wrappers used for this offline visual test, **not the upstream
Three.js fat-line implementation**. This may affect rear-hint line thickness.

## Unchanged 2D reference artwork

The 20-controller 2D reference set in `references/controllers/` is carried
forward from the user's original `gamepad-overlay-pads` package. Individual
source and license data are in `references/SOURCE_README.md`, each layout's
`mapping.json`, and the existing `licenses/` directory.

Important individual caveats: GameCube artwork includes GPL-3.0-only source;
Steam Controller 2026 outline source has CC BY-NC-SA provenance considerations.
These caveats are **not resolved** by the MIT license of the DualSense 3D mesh.
The 2D reference artwork has not been altered in this v27 iteration.

## Other 3D models (not bundled offline)

Further models may be loaded from
[3dco+](https://github.com/Khyretos/3dco-plus) or other model sources at
runtime. Their individual conditions differ; notably Steam Controller 2026
has CC BY-NC-SA 4.0 model restrictions. The MIT program license does not
supersede model-specific licensing.

## Commercial-use model import gate (November 2026)

The automatic asset downloader publishes **only** 10 original controller model families traceable to Larf's [3D Controller Overlay](https://github.com/larfingshnew/3d-controller-overlay) MIT-licensed source: DualSense, DualShock 4, Xbox One, Xbox 360, Switch Pro, Joy-Con Grip, left/right Joy-Con, GameCube and WaveBird. Every included visible OBJ has an identical Git blob SHA in that upstream repository. The model manifests are taken from a pinned [3dco+](https://github.com/Khyretos/3dco-plus) revision (`73b3a602a0b2afeb2fc7a2e9db940f9d2004ef9c`), which carries the original meshes. Respect the upstream MIT notices in `licenses/`; any later geometry edits must retain attribution and notices.

**Excluded from automatic import:** PadForge Xbox Series / DualSense Edge (paid CGTrader royalty-free models without established transferable redistribution rights); PadForge Steam Deck / Xbox 360 (CC BY-NC-SA 4.0); Steam Controller 2026 from 3dco+ (third-party author/link with no independently verified reuse license). Modifying or optimizing these sources does **not** remove their restrictions. No such 3D asset is included in the approved bundle until rights are verified or a commercially reusable alternative is available.

The Xbox One `info.json` in 3dco+ contains a mismatched external Sketchfab `source` URL. The **24 imported OBJ files**, however, are byte-for-byte identical to the original Larf repository's MIT-model files. The mismatched metadata is not treated as proof of rights to unrelated Sketchfab material.

The 2D artwork has independent terms: in particular, the GameCube reference is noted as GPL-3.0-only and Steam Controller 2026 outlines have outstanding provenance considerations. A valid 3D license does not automatically clear the matching SVG or proprietary names/logos.
