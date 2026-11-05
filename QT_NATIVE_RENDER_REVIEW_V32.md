# ExoSnap Qt-native 2D/3D Render Audit – PRs #513–#517 (2026-11-04)

**Scope & provenance:** Read-only GitHub investigation of `Exoridus/exosnap` at PR #517 head `161630c2b3b01023970a9505a10cd8d0d5e89a30`, dependent branches #513, #515, #516. PR #514 returned 404 and was not verified. This is source-based audit, **not** a local native Qt build, hardware performance test, or merged-code confirmation. The v32 lab is a separate Three.js prototype built from the v31 ZIP; GitHub's PRs were not changed.

## What the existing Qt port examples actually do

- `qt-port-example/CMakeLists.txt` and `main.cpp` are a **standalone Qt 6 Gui+Svg console executable**. It reads a *pre-exported* SVG, uses `QSvgRenderer::render(QPainter*)` and writes 480×320 PNG. It does not contain any 3D renderer, model importer, lighting, input, or ExoSnap integration. Requires Qt 6 developer headers/libs, CMake and C++ compiler. Valid build on Windows (adjust prefix to your installed Qt):

  ```powershell
  cmake -S qt-port-example -B qt-port-example/build -DCMAKE_PREFIX_PATH="C:/Qt/6.12.0/msvc2022_64"
  cmake --build qt-port-example/build --config Release
  .\qt-port-example\build\Release\exosnap-svg-proof.exe .\evidence\qt-materials\qt-dualsense-frost-65.svg .\qt-proof.png
  ```

- `qt-quick3d-port/ControllerSurface.qml`, `QtPbrLightRig.qml`, and `pbr-reference-recipes.json` are **reference components**, not a complete app. They require a `View3D`, camera, imported geometry + hierarchy, CMake project and gamepad input. Do not claim that simply building these QML snippets produces a controller. v32 adds the explicit `unlit` property and JSON examples for variants G/H.
- Qt 6 development libraries are absent from this analysis runtime, so no native executable was compiled here.

## Current native #517 3D

- Actual pilot geometry is **procedural**, not the detailed original OBJ used in the browser lab. `ControllerGeometry.cpp` builds the shell and four stick components (`stem`, `rim`, `cap`, `well`). `ControllerState.cpp` maps 17 moving buttons to cubes/cylinders. `ControllerScene.qml` includes 1 shell + 2×4 stick models + 17 button models = **26 Model objects**.
- Four `ControllerGeometry` objects supply both sticks. This is **shared geometry**, not instancing. The `Repeater3D` creates 17 separate button models. Qt does support explicit GPU instancing via `InstanceList`, but it is not used in this QML.
- `ControllerGeometry.cpp` sets `kSegments=64`. Based on the exact Lathe function and profile section counts (`stem 19`, `rim 16`, `cap 18`, `well 16`), unique generated stick-profile vertices: **8,970** across four shared geometries; both sticks draw from them. Two sticks' summed indexed-geometry vertex counts are 17,940, excluding shell and buttons. This is **not** a driver-observed GPU vertex count. Estimated counts at 32 segments: 4,554 vertices, 4,416 triangles per stick; at 24: 3,450 vertices, 3,312 triangles per stick. Actual visual parity is unmeasured.
- `ControllerScene.qml` uses `OrthographicCamera`, **two `DirectionalLight` objects**, `PrincipledMaterial`, `SceneEnvironment.MSAA High`, and `depthPrePassEnabled: true`. No point light in the current #517 controller scene. Shadow maps are not requested in the shown lights.
- `NativeRenderTarget.cpp`: `QQuickRenderControl` owns a `QQuickWindow` which adopts an existing **D3D11 device and immediate context**, and paints to a `DXGI_FORMAT_R8G8B8A8_UNORM` texture. Steps: polish → beginFrame → sync → render → endFrame. `NativeGamepadProducer.cpp` selects historical GameInput state, applies pose, renders texture, publishes through token/leases, and the host compositor consumes it without CPU pixel roundtrips.
- **26 Model objects ≠ 26 measured draw calls.** Depth prepass, transparency, MSAA, primitive allocations, and Qt Quick 3D/RHI batching influence actual draw and pass counts. Use `View3D.renderStats` (requires `extendedDataCollectionEnabled`) and optionally PIX/RenderDoc. PR #517's GPU timestamp spans contain submission gaps/waits and do not isolate GPU busy time.
- PR #517's description reports representative finished SDR AV1/MKV 1080p60 recordings of 2D, Normal and Ghost without **problem** drops in 30s, with measured native render-producer CPU means 2.536 ms (Normal), 2.502 ms (Ghost) and publication CPU means 0.128/0.103 ms; not a 120 fps/long-term hardware promise.

## Current native #513/#515/#517 2D

- `GamepadSprites.cpp` uses `QSvgRenderer` and `QPainter` to rasterize each body/control idle/pressed image into a **BGRA atlas** when the source or layout changes. It creates optional knockout/mask atlas rects. This happens outside normal per-frame input sampling.
- `GamepadFrameSampler::Sample` reuses a prepared `SpriteLayerSnapshot`. `FillGamepadLayer` emits one sprite quad per part, plus an optional second quad per nonzero trigger, and applies stick/press positions. Exact number depends on the selected SVG mapping; not one universal count.
- `GpuCompositor::DrawSpriteLayer` iterates the visible sprite quads. Each valid quad invokes `DrawTexture(...)`, which issues `ID3D11DeviceContext::Draw(3,0)` with atlas UVs and up to two mask constants: **one compositor draw per valid quad** in this code path. A `sprite_quad_draw_count_` counter is already present. No 3D lights, no per-frame SVG rasterization, no CPU readback in the intended steady state.
- 2D could batch many sprites into fewer draws by using an instance buffer/geometry and per-instance UV, opacity, mask rects. However the controller has relatively few quads, and layer ordering/alpha/masks must be preserved. Measure compositor CPU/GPU first; instancing is not automatically worthwhile.

## Recommended optimization order – without an architecture rewrite

1. **Instrument #517:** temporary diagnostics, record `drawCallCount`, `drawVertexCount`, `renderPassCount`, `renderTime`, optional GPU timestamps; compare Normal, Ghost, neutral, all pressed, both sticks angled at 240×160/320×214/480×320. Disable extended collection outside diagnostics.
2. **Test radial LOD:** `64 → 32 → 24` segments for stick parts, preserving the exact profile, pivot and press state. Generate each geometry **once per selected LOD**, not per input frame. Inspect zoomed close-ups, highlight stability and silhouette.
3. **A/B the Depth Prepass:** on vs. off; maintain correct Ghost depth and CPU/GPU costs. It may increase draw calls without benefit on such a small scene; do not simply disable it permanently without a depth-occlusion check.
4. **A/B lighting:** current 2 directional lights vs. one directional (PBR) vs. `PrincipledMaterial.NoLighting` (equivalent in *intent* to new lab G's `MeshBasicMaterial`). The unlit look can be great for a Ghost overlay but loses geometric highlights. Prefer small, renderer-neutral palette and edge contrast rather than adding a custom shader.
5. **Do not prioritize instancing:** 17 buttons, split across cube/cylinder, individual press state/transform, transparent groups. `InstanceList` can batch primitive groups but must update the instance buffer and preserve alpha ordering. The win is uncertain. If `drawCallCount` dominates, prototype two instance tables (round/square) without changing the product data model.
6. **2D stays sprite-based.** Measure `sprite_quad_draw_count_` and compositor timing. Batch only if measured pressure warrants it. The atlas already avoids repeated SVG rendering.

### Qt Quick 3D render counters (insert temporarily into `ControllerScene.qml`)

```qml
// Existing View3D root has id: controllerScene
renderStats.extendedDataCollectionEnabled: true // diagnostics only, not production default
Timer {
    interval: 500
    repeat: true
    running: true // gate behind a diagnostic flag in the real application
    onTriggered: {
        const s = controllerScene.renderStats
        console.log("QT3D_STATS", "draws", s.drawCallCount,
                    "vertices", s.drawVertexCount,
                    "passes", s.renderPassCount,
                    "renderMs", s.renderTime)
    }
}
```

**Measure with a live renderer.** Above is a suggested QML snippet, not patched into #517 and not compiled in this environment. `drawCallCount` is only available after enabling extended collection. The D3D11 texture-compositing draw is separate from the View3D render counters.

## Lab v32 A–H and Qt crosswalk

- **G – Unlit Clean:** `THREE.MeshBasicMaterial`, no active Three lights. Qt target: `PrincipledMaterial { lighting: PrincipledMaterial.NoLighting }` (or `DefaultMaterial.NoLighting`). Identical source OBJ geometry, independent of lights. Note: these renderers are not guaranteed pixel-identical.
- **H – Single-Key Ghost:** `THREE.MeshPhysicalMaterial`, **one** `DirectionalLight` (other light intensities zero). Qt target: `PrincipledMaterial.FragmentLighting` + one `DirectionalLight`, shadow casting off.
- A–F unchanged from v31. All eight use one material slider; existing geometry is reused. G caches `MeshBasicMaterial` per mesh once; changing modes or slider does not regenerate geometry. In the browser, actual WebGL draw calls are shown per three viewports if rendering succeeds. These are **not** Qt draw calls.

### Known blockers

- Browser runtime here: Chromium WebGL context unavailable even with SwiftShader/ANGLE flags. **No visual 3D approval, GPU performance conclusion, or genuine live screenshot of new G/H**.
- Native Qt 6 SDK absent; `qt-port-example` and #517 cannot be built locally here.
- Actual Qt Quick 3D stats for #517 are unknown until the Win/D3D11 native probe is instrumented.
- QML port material color interpolation may differ because Three.js PBR vs. Qt's BRDF and color pipelines differ.
- PR #514 was not accessible; no assumptions made about it.
