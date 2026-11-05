# v33 Rendering and Lab Navigation Implementation Plan

> User requested immediate implementation on the supplied v32 prototype; no GitHub mutation.

**Goal:** Add accurate per-panel GPU metrics, geometry reuse, reduced 3-view rendering, two polished controller styles and synchronized neutral/move/click stick states; organize all lab pages behind one index link.

**Architecture:** Preserve the v32 OBJ scene and existing A–H variants. Add an optional optimized render mode that renders one transparent controller frame per variant into an on-GPU target and composites it into each background viewport. Preserve the direct 3D path as a diagnostic comparison. Batch only compatible static meshes and share identical stick geometries. Keep model-specific colors and real source hierarchy.

**Constraints:** Zero CPU readbacks per frame; no custom shader required for visual materials; one material mix slider; no fabricated GPU metrics or 3D screenshots. All original models/assets intact.

**Tasks:**
- [x] Tests RED: per-panel metrics; shared GPU render; idle/move/click stick colors; source geometry sharing; page directory links.
- [x] Implement reusable statistics, GPU target and screen-copy path; show accurate separate per-panel and total counts.
- [x] Conservative static housing merge and identical stick geometry sharing; no guess-based face/D-pad instancing.
- [x] Introduce two hero looks as default without deleting legacy A–H research; improve idle blue and pressed alpha.
- [x] Add homepage single link to all lab pages, dedicated linked directory and neutral/move/click control.
- [x] Run full tests; run real browser if WebGL available, otherwise document exact blocker; zip complete project and evidence.

**Validation:** 309 Node tests pass; 10 local endpoints HTTP 200; browser navigation/html screenshot succeeds; 3D WebGL blocked by sandbox restrictions and is explicitly not approved.
