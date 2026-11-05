# ExoSnap Controller3D Lab v27 – visual acceptance and handoff

## Purpose and scope

A self-contained browser prototype for comparing 3D Controller3D rendering
(top row: Dark / Light / Mixed) against the real supplied 2D native controller
reference SVG (bottom row: Dark / Light / Mixed). Six viewports share one
camera, one pose and one WebGL context. The 2D references are actual original
flat SVGs on a plane; they have no 3D thickness when the camera rotates.

This archive **includes 27 genuine DualSense OBJ mesh parts and Three.js r180**
recovered from a previously supplied v23.2 browser test archive. DualSense
can load locally without npm or remote model requests. Other selectable models
may still require model downloads; only DualSense is qualified here.

## Corrections compared with v26

1. Removed the ineffective free-floating CSS ellipse. Screen-space halo and
   shadow now follow a convex hull of **1,090 sampled vertices of actual
   original, static DualSense OBJ shell geometry**, projected using the same
   view camera and refreshed while zooming/orbiting. Halo and shadow are
   independently controllable with 0–100% settings. The old floor-scene
   shadow no longer impersonates the preview shadow.
2. Added a dedicated stationary recessed socket under each thumbstick and
   made the moving outer rubber ring share the stick-cap control color and
   pressed opacity. The shaft still follows the common pivot and the
   housing socket is deliberately stationary.
3. Fixed the controller selector's initialization ordering.
4. Increased the six-up model display area while retaining synchronized
   camera/orbit/zoom. Kept the 8-direction test: both sticks at maximum
   deflection, changing every three seconds, with deterministic easing.
5. Light 2D reference now remaps *only neutral light source strokes* to dark,
   while keeping pressed **blue** controller art blue. Previous logic darkened
   all 2D pixels together, corrupting the parity comparison.

## Actual visual/browser test (not a simulated mockup)

Test environment: Chromium + SwiftShader WebGL under Xvfb, using Playwright
with all 80 module/mesh/assets served from local files. The page reported:

- `modelReady=dualsense`, `modelParts=27`, `separationVertices=1090`,
  `separationHull=30` in initial front view.
- Six panels found in exact order: 3D Dark/Light/Mixed, 2D Dark/Light/Mixed.
- All buttons pressed + max sticks upper-right tested in actual rendered view.
- Both front and angled cameras captured; 3D+2D views remained synchronized.
- Zero JavaScript exceptions, zero missing/404 local requests.

### Quantified visible results on the LIGHT 3D panel

Same actual frame captured at halo 0/shadow 0 versus separate settings:

| Setting | Mean absolute RGB delta (0..255) | Image pixels differing by >=8 RGB |
| --- | ---: | ---: |
| Halo 50%, shadow 0 | 3.14 | 8.08% |
| Halo 100%, shadow 0 | 6.29 | 9.12% |
| Shadow 50%, halo 0 | 10.19 | 19.28% |
| Shadow 100%, halo 0 | 20.38 | 20.11% |

Measurements over the ~500×410px Light 3D viewport using screenshot pixel
differences. These are image effects, **not GPU timings**. Extreme 100% settings
are diagnostic and deliberately strong; normal defaults are lower.

## Test-suite status

`node --check app.js` passes. The ten focused v25/v26/v27 style/pose/color tests
pass. `npm run verify` executes all 239 historical tests, **227 pass / 12 fail**.
These 12 failures are chiefly stale v14–v22 assertions that insist on the
hidden old motion UI, old default styles, or exact string patterns from the
pre-StyleMix source. Do not claim complete regression green; reconcile them
against the intentionally simplified UI before production release.

## Visual findings still worth further refinement

- Original 3D DualSense is a real model but the ghost's shoulder/trigger hints
  still use a fallback thin-line implementation; these are not final quality.
- The fixed stick socket reduces the visible gap, but a detailed side-view
  mechanical clearance/hardware-timing validation has not been performed.
- Screen-space separation is prototype CSS/SVG, not yet implemented in the
  native GPU compositor. It is intended as a visual comparison experiment.
- Controller models other than DualSense have not received this v27 browser
  visual acceptance, even though they remain selectable in the source.
