## v28.1 – Laufzeit-Hotfix (3. November 2026)

**Vollständiger Download, kein Patch.** Entpacken, `start.cmd` starten; dieser Stand nutzt `http://127.0.0.1:8791/`, um die vorherigen Server nicht zu überschneiden.

**Behoben:** `refreshSeparationShape()` löste `ReferenceError: projectionSample is not defined` aus, weil sowohl `projectionSample` als auch `lastSeparationAt` nie deklariert waren. Beide Cachezustände werden jetzt vor dem ersten Animationsframe initialisiert. Es wurden zwei dynamische Regressionstests für den leeren und den geladenen Modellzustand ergänzt.

**Prüfung:** 243/243 Node-Tests bestanden; HTTP-Start antwortet mit 200. Visuelle WebGL-Abnahme ist weiterhin **nicht** erfolgt: Der verfügbare Chromium verweigert den lokalen Aufruf mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Die früheren visuellen Beanstandungen sind daher nicht als behoben zu betrachten.

**Hinweis:** Die darunter stehenden v28/v27-Protokolle sind Historie. Ihre älteren Ports und Testergebnisse gelten nicht für v28.1.

---

# ExoSnap Controller3D Lab v28 – reduzierte Vergleichsvorschau

**Start:** `start.cmd` (Windows, Node.js 20+). Die Seite öffnet sich auf `http://127.0.0.1:8789/`, sodass ein alter v27-Server auf 8788 nicht stört. Die Three.js-Dateien und die DualSense-Modelldaten sind lokal beigelegt.

**Änderungen gegenüber v27:** Der sichtbare Bildschirm enthält nur noch Material-Mix, die drei Kernwerte Gehäuse/Controls/Kantenlicht, Vorschau/Live, Modellwahl und den bestehenden Test mit allen gedrückten Tasten und acht Stick-Richtungen. Halo-, Schatten- und Kontur-Slider sind entfernt. Ein einziger dezenter Schlagschatten folgt der projizierten 3D-Gehäusesilhouette, ohne die Ghost-Shell dunkel zu füllen. Die 2D-SVGs werden auf 2048 px vorgerechnet, und nur Striche unter 0,48 SVG-Einheiten erhalten **in der temporären Anzeigekopie** eine minimale Breite von 0,48. Originale Assets und 2D-Mappings bleiben unverändert.

**Prüfstand:** `node --check app.js` und die gezielten v25/v26/v27/v28-Vertragstests bestanden. Die historische Gesamtsuite hat 229/241 PASS, 12 Alt-Fehlschläge (veraltete Motion-/UI-/Depth-Annahmen). Ein aktueller WebGL-Screenshot konnte wegen Browser-Zugriffssperre (`ERR_BLOCKED_BY_ADMINISTRATOR`) **nicht** erstellt werden. Nur die 2D-Rasterisierung wurde zusätzlich bildlich außerhalb des Browsers überprüft. Dieser v28-Stand ist daher **nicht visuell als WebGL abgenommen**.

---

# ExoSnap Controller3D Lab v27 — tatsächliche WebGL-Abnahme

**Jetzt für DualSense tatsächlich im Browser getestet**, statt nur Quellcode und alte 2D-Bilder abzugeben. Oben drei echte OBJ-3D-Ansichten (Dunkel / Hell / Gemischt), darunter die originalen flachen 2D-SVG-Referenzen. Eine Kamera, synchronisierte Drehung, Zoom, Pan und synthetische Tasten/Sticks.

**Start (Windows):** Archiv vollständig entpacken und `start.cmd` ausführen. Der Viewer öffnet `http://127.0.0.1:8788` (absichtlich anderer Port als v26: 8787). Für **DualSense** sind alle 27 originalen OBJ-Teile plus Three.js r180 enthalten; dieser Controller benötigt keine weiteren Modell- oder npm-Downloads. Für andere Controller kann ein Download der Originalmodelle erforderlich sein. Node.js 20+ vorausgesetzt.

**Abnahmemodus:** „Alle Tasten + Sticks max.“ einschalten; beide Sticks sind maximal ausgelenkt und wechseln automatisch alle drei Sekunden die Richtung (↗ → ↘ ↓ ↙ ← ↖ ↑), oder über das Richtungsmenü eine Pose festhalten. Material-Presets und Advanced-Slider funktionieren in allen drei 3D-Ansichten synchron. Kontur kann bei 0 % bleiben; „Kontrast-Halo“ und „Schatten“ sind zwei getrennte *an die projizierte 3D-Geometrie gekoppelte* Screen-Space-Effekte. Die 2D-Art bleibt unmanipulierte Referenzgeometrie; nur neutrale helle Striche werden auf dem hellen Hintergrund dunkel umgefärbt. Blau gedrückter Controls bleibt blau.

**Visuelle Abnahme:** Siehe `V27_HANDOFF.md` und die echten Screenshots im `evidence/`-Ordner. Chromium / SwiftShader / Xvfb getestet, 27/27 OBJ-Teile geladen, 0 JS-Fehler, 0 fehlende Assets. Der Unterschied Halo/Schatten wurde über Screenshot-Pixelwerte gemessen. **227/239** historische Tests bestanden; die zwölf übrigen kodieren veraltete UI-/Implementierungsannahmen (Details im Handoff). Die nativen Qt-/D3D11-Versionen sind mit diesem Browserstand **nicht** automatisch repariert.

**Lizenzhinweise:** `THIRD_PARTY_NOTICES.md` und `licenses/`; die v27-Datei enthält erstmals lokal verteilte MIT-lizenzierte DualSense-3D-Modelle und Three.js. Alte v24–v26-Beschreibungen unten sind nur Archivtexte und gelten nicht als aktueller Paketinhalt.

---

## Historische Angaben v24–v26 (archiviert, nicht aktuell)

# ExoSnap Controller3D Parity Lab v26

**Sechs Ansichten auf voller Breite.** Oben drei echte 3D-Modelle vor dunklem, hellem und gemischtem Hintergrund. Darunter dieselben Controller als originale flache 2D-SVGs. **Eine gemeinsame Kamera** synchronisiert Orbit, Zoom und Verschieben; bei seitlicher Drehung wird die 2D-Ebene korrekt flach gezeigt.

**Schneller Input-Test:** Aktiviere **„Alle Tasten + Sticks max.“**. Dann sind alle Buttons gedrückt, beide Sticks maximal ausgelenkt und die Richtung wechselt **automatisch alle drei Sekunden** im Uhrzeigersinn: ↗ → ↘ ↓ ↙ ← ↖ ↑. Der Übergang dauert 220 ms und hält die Stickauslenkung auf 100 %. Über das Dropdown **„Stick-Richtung“** kannst du eine Position fest einstellen und den Wechsel pausieren. **„Eingaben löschen“** beendet den synthetischen Test; Live-Modus tut dies ebenfalls.

**Start unter Windows:** ZIP entpacken und `start.cmd` ausführen; anschließend <http://127.0.0.1:8787>. Beim ersten Start müssen Three.js (`npm`) und die externen Original-OBJ-Modelle erreichbar sein. Falls v25 oder ältere Versionen noch auf Port 8787 laufen, diesen Server zuerst schließen.

**Abnahme:** Die neuen Richtungs-/Synchronisations-Tests sind erfolgreich, aber **v26 wurde hier nicht vollständig mit echter WebGL-Ausgabe visuell geprüft** (lokaler npm-Zugriff nicht erreichbar). Frühere v23.2-Bilder im Paket sind nur als klar gekennzeichnete Referenzen enthalten. Hinweise zu Quelle/Lizenz der Modelle stehen in `THIRD_PARTY_NOTICES.md`.

Alle Details einschließlich Testgrenzen: [V26_HANDOFF.md](V26_HANDOFF.md).

---

# ExoSnap Controller 3D Preview v25

**Schlanke Vorschau statt überladenes Controller Lab.** Dieselben echten OBJ-Controller-Modelle aus v24, aber nur Controller-Auswahl, Vorschau/Live-Modus, Hintergrund, drei Look-Presets und ein Material-Mix-Slider. Orbit mit linker Maustaste, Zoom mit Mausrad, Pan mit rechter Maustaste. Details (Shell-Alpha, Controls-Alpha, Rim, Kontur, Schatten) sind optional aufklappbar.

**Windows:** ZIP entpacken, `start.cmd` ausführen. Für das lokale Three.js-Modul beim ersten Start Zugriff auf npm erforderlich, für 3D-Meshes auf die Originalquellen. Alternativ `npm ci --ignore-scripts && npm start`; danach <http://127.0.0.1:8787/> öffnen. Bei einem bereits laufenden v24-Server dessen Fenster zuerst schließen.

Die Shader- und Stick-Korrekturen wurden **nicht** mit einem neuen WebGL-Screenshot-Lauf freigegeben; siehe [V25_HANDOFF.md](V25_HANDOFF.md). Ältere Bildgalerien im Paket zeigen **v23.2-Referenzen**, keine als v25 ausgegebenen Renderbilder.

Die Modelllizenzen einschließlich zusätzlicher CC-BY-NC-SA-Einschränkungen für ausgewählte Modelle sind gesondert zu beachten.

---

# ExoSnap Controller3D Lab v24 - static body, shared sticks, Ghost

The **v24 browser preview** is an original local iteration on the available **v23.1 source** with selected v23.2 design decisions reimplemented. The exact v23.2 source archive was not supplied, so this is **not** a byte-for-byte v23.2 upgrade.

Run `start.cmd` (Windows) or `npm install && npm start`, select a controller and use Normal/Studio or Ghost. The OBJ models are downloaded at runtime from their upstream repository; run `npm run download-assets -- DualSenseCompact XboxOneClean SwitchPro` to cache the principal models.

**v24:** static shell meshes grouped by front/rear/trim materials (no destructive Boolean union), controls remain separate; 32-segment parametric caps for DualSense/Xbox One/Switch Pro, while GameCube remains original; Ghost uses dark outside silhouette rather than internal seams by default, translucent controls with blue presses, and opt-in rear dashed hints selected by the depth buffer. The `Solid Body`, `Shared Sticks`, `Ghost contour` and `Rear-Hints` controls need a reload when their *geometry* strategy changes; appearance changes take effect live. All four settings are experimental and have not undergone independent WebGL visual qualification here.

Run `npm run topology` after caching OBJ assets to inspect source mesh triangles and manifoldness. See [v24 technical handoff](V24_HANDOFF.md).

The static shell batching is **not** a watertight Boolean union; open original surfaces and model-specific material boundaries remain. No third-party OBJ meshes or Three.js node_modules are bundled. Model-specific redistribution permissions must be verified, especially for PadForge and Steam Controller 2026.

See [Gallery v24](gallery-v24.html) for clearly labeled **v23.2 source reference screenshots** rather than fabricated v24 renders.

# ExoSnap Controller3D Lab v23.1

Standalone Three.js prototype. The pilot models are DualSense and GameCube. Native ExoSnap, its 2D assets, motion fusion, hand calibration and automatic centering are unchanged.

## Focused visual polish

GameCube spherical stem faces are refined on their existing radii (left 0.20619, right 0.17557 source units). Non-spherical shaft triangles remain at their authored positions. The main thumb-cap and its rim are subdivided along the existing radial profile, retaining groove heights and original vertices. This replaces each affected mesh geometry once at load time; it adds no overlay cap. Crease-aware normals use scaled temporary coordinates to avoid the normal utility merging small source features. C-stick cap/rim vertex positions and all housing vertices/normals are unchanged. Both octagonal openings are preserved exactly. Matte stick materials reduce saturated highlights that hid the transitions.

Ghost keeps the same depth-only prepass, opaque controls and stationary contour proxy. The shell's base alpha now uses 35 percent of the Shell slider, with a narrow dark outer rim and brighter inner rim at grazing angles; shell clearcoat and metalness are removed. Idle controls use a lighter matte tint. Analog movement alone still adds no pressed glow. Existing Glass and Studio controls should retain their original material response except the targeted GameCube stick materials.

Diagnostic URLs additionally accept focus=left/right, isolate=stick, background=checker/arena/racing/fantasy and yaw in degrees. Focus uses the neutral assembly bounds, so the camera remains identical across tilt and click comparisons. The framebuffer alpha is sampled in diagnostics only. The 14/25-degree profile pair uses view=profile to look perpendicular to the X-input tilt plane, with the neutral axis vertical; view=side alone foreshortens that motion.

The evidence includes fixed-camera isolated/assembled close-ups, checker and bundled synthetic game backgrounds, and full 360-degree camera sequences for both pilot models. These are software WebGL frames, not physical-controller or GPU-performance measurements. No actual gameplay or photographic background is claimed. Model source faceting outside the touched stick surfaces, housing opening depth, and model/hardware calibration remain subject to visual acceptance.

## Run or update

Install Node.js 20 or newer. Extract the full package into a new directory, run `npm ci --ignore-scripts`, then `npm start` and open http://127.0.0.1:8787/. Windows users can use `start.cmd`. Stop an older server before starting this version. The header must show V23.1.

The v23-to-v23.1 patch contains changed/new files only, relative to the directory containing `app.js`. Back up local edits, verify the old hashes in PATCH_MANIFEST.json, and extract the patch over an unmodified v23 package. Do not overwrite differing local source files without reconciling them. Existing `assets/` and `node_modules/` are retained. Run `npm ci --ignore-scripts` and `npm run verify` after applying it.

No OBJ models or node_modules are redistributed. The existing downloader can fetch the two pilot models for local examination:

`node download-assets.mjs DualSenseCompact Gamecube`

Read THIRD_PARTY_NOTICES.md before using upstream models or distributing this lab. Download availability is not redistribution clearance.

## Geometry and Ghost rendering

The co model rings are moving cap walls. Their authored hierarchy already contains the stem and cap. Preserve that assembly and its manifest pivot. Fixed wells belong to the shell. Procedural cap deformation and extra skirts are disabled for the four inspected complete co assemblies; the original GameCube C-stick remains distinct.

DualSense and GameCube use a separate stationary housing contour proxy. Positions are transformed into a common model frame and welded before feature-edge extraction. This removes smooth assembly seams without altering or boolean-merging visible OBJ meshes. At a 63-degree contour threshold the combined GameCube housing falls from 447 to 227 feature edges, and DualSense from 540 to 252.

The existing per-mesh depth-only prepass remains the occlusion geometry. It writes depth without color before opaque controls, transparent housing and contours. Tests and actual WebGL depth-on/depth-off captures establish its effect. A new simplified closed shell was unnecessary for these views. Moving cap walls are now opaque in Ghost, like stems and caps. The rim shader uses the actual Three 0.180 opaque_fragment output hook.

## Model mechanics

`model-mechanics.js` owns per-model/per-stick rendering parameters, not input bindings. Coordinates are source-model local units. Explicit pivots match the upstream ring holders. Other models retain their source pivots.

| Model | Rig tilt | Hardware reference | Gate | Trigger animation |
| --- | --- | --- | --- | --- |
| DualSense | 14 degrees per stick | approximately 25 degrees, study measurement | circle | 16-degree rotation, no added translation |
| GameCube | 16 degrees per stick, provisional visual value | unknown | regular octagon approximation | authored local Z travel 0.08, no rotation |

The DualSense hardware value is independently confirmed in [Kyushu dissertation, Table 3.2, printed page 52](https://catalog.lib.kyushu-u.ac.jp/opac_download_md/7329489/design0340.pdf). It uses a ruler/manual goniometer and defines tilt from the original position. The 14/16-degree viewer references come from the supplied research catalog pointing to [Handheld Companion](https://github.com/Valkirie/HandheldCompanion/blob/main/HandheldCompanion/3DModels/ModelDualSense.cs); that source was not independently retrieved during this iteration. They remain animation choices, not hardware measurements. The imported co manifests independently contain 20-degree stick and 30-degree DualSense trigger animation limits; those are also model parameters.

Both sticks use innerDeadzone=0.05 and outerSaturation=0.05. The radial response maps radius 0.05..0.95 linearly onto 0..1, preserves direction, and then applies the directional gate radius. One axis-angle quaternion limits diagonal tilt to the same maximum as cardinal tilt. There is no extra stick smoothing. Click travel follows the rotated local stick axis. GameCube click travel/highlight is disabled.

Browser Gamepad and existing Sony HID readers expose rawLeft/rawRight before the legacy 13-percent deadzone. Only 3D consumes these raw values. Existing processed left/right, 2D reference rendering and motion activation remain intact. Missing, nonfinite, unavailable and unsupported stick values return neutral. A timestamp-free browser also considers raw-axis changes when deciding sample freshness. The lab still uses its existing input paths; it does not implement a new canonical binding registry or the future native ReadControl integration.

## Shapes and touch coordinates

A gate is `{type:'circle'}` or `{type:'polygon',vertices:[{x,y},...]}`. Vertices must form a strictly convex polygon in winding order with the origin strictly inside. Duplicate, crossing, collinear, concave and nonfinite geometry is rejected. Invalid gates produce neutral output. Radius is capped at one. GameCube's regular octagon is a documented approximation, not measured gate geometry.

`touchSurfacePoint({u,v},{quad,boundary},matrixElements)` maps UV coordinates to four local 3D corners ordered (0,0), (1,0), (1,1), (0,1). The optional convex boundary clips UV positions. Pass the owning node's updated matrixWorld.elements for world coordinates. Invalid/outside positions return null. This is geometry preparation only; no touch contacts, input providers or live touch support are invented.

## Verification and diagnostic views

Run `npm run verify`. The v23 suite covers raw input retention, stale input, radial boundaries, direction/circles, polygon validation, transformed touch surfaces, quaternions, rigid cap/stem attachment, click separation, frame-rate independence, housing contours and the installed shader hook. Existing regression tests remain included.

A deterministic diagnostic view uses the production scene/material/load path:

`/?diagnostic=1&layout=gamecube&style=ghost&view=angled&stick=1,1&background=light`

Supported diagnostic parameters: layout=dualsense/gamecube, style=studio/ghost, view=front/angled/side/rear, stick=x,y, background=light (otherwise dark), click=1, buttons=1, tilt=0..45 and depth=off. The diagnostic input is synthetic, explicitly requested by the URL, and never presented as a live controller. It disables motion presentation only inside that diagnostic view. The normal viewer retains its existing controls and motion behavior.

Actual Edge headless WebGL/SwiftShader screenshots cover both models, both materials, front/oblique/side/rear, dark/light, neutral/maximal diagonal and click combinations. The previous depth-on/off diagnosis remains applicable; the depth pass is unchanged. These are software WebGL renderings, not native Qt/D3D or physical-controller measurements. The accompanying evidence gallery preserves full-resolution PNGs.

## Remaining limits

Geometry: source stems intersect the shell even at neutral; source housing and controls retain visible low-poly faceting. Sampled cap/rim edges did not intersect housing at DualSense 14/25 degrees or GameCube 16 degrees across eight directions, but this is not exhaustive triangle collision proof. No new meshes were substituted to conceal those source limitations.

Animation: GameCube gate coordinates and tilt remain provisional. Hardware angle definition, pivot calibration and actual trigger travel need physical/model-author confirmation. Other controllers were not visually reworked or accepted.

Rendering: some fine contour aliasing remains. The tested views show controlled occlusion without the depth-off interior spikes. No hardware GPU performance, live Sony controller, native Qt rendering or full 360-degree continuous sweep was verified. Human visual approval is still the next step, not a claim that every source model is production ready.

Licenses: upstream OBJ rights and inherited restricted references remain unresolved for redistribution. The package is a local development artifact, not release-cleared content.
