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
