# ExoSnap Controller3D Lab – GitHub Pages / Screenshot-Historie

**Generic Pro v1:** 23 original authored 3D-OBJ parts (`assets/GenericPro`), paired with the existing 2D generic layout. Browser-smoke and neutral/pressed screenshots are mandatory in CI. The existing cleared core models remain selectable; Xbox Series / Steam Controller 2026 are not misrepresented as cleared.


**Live:** [Controller Lab](https://exoridus.github.io/exosnap-controller-lab/) · [Screenshot-Historie](https://exoridus.github.io/exosnap-controller-lab/screenshots.html). Veröffentlichung per GitHub Actions nach erfolgreichen Tests und echten WebGL2-Aufnahmen.

- **Start:** `npm start` → `http://127.0.0.1:8792/` (ein 6-Spalten-Grid, vier Looks, 2D/3D).
- **Setup:** [GITHUB_PAGES_SETUP.md](GITHUB_PAGES_SETUP.md).
- **Aktuelle und alte Screenshots:** `/screenshots.html` nach erfolgreichem Pages-Deploy; historische Bilder im Branch `visual-history`, unter der Quell-SHA.
- **CI:** `.github/workflows/pages-and-screenshots.yml` – Tests → echte Chromium-WebGL-Aufnahmen → Versionsarchiv → Pages.
- **Rendering-Nachweis:** Die CI erzeugt und archiviert echte WebGL2-Screenshots (neutral/pressed) im Branch [`visual-history`](https://github.com/Exoridus/exosnap-controller-lab/tree/visual-history). Ein Screenshot belegt Rendering, aber noch keine visuelle Qualitätsfreigabe.

---

# ExoSnap Controller3D Lab v40 – Kontrast, Verdeckung und korrektes 6er-Grid

**Start:** `start.cmd` oder `npm start`; `http://127.0.0.1:8792/` öffnet direkt das vierzeilige Materialvergleichs-Grid. Das Modell DualSense ist offline enthalten.

**Navigation und Zoom:** Sechs Spalten pro Look (3D Dunkel/Hell/Mixed, 2D Dunkel/Hell/Mixed); horizontales Scrollen ist ausdrücklich erlaubt. Das Mausrad über **jedem** 2D-/3D-Feld zoomt und verhindert vertikales Seitenscrollen an dieser Stelle. **Shift + Mausrad** scrollt innerhalb des Grids horizontal. Außerhalb der Viewer kann die Seite normal vertikal scrollen. Keine zusätzlichen Labels/Cards.

**Neu:**
- `silhouette-composite.js`: jedes 3D-Modell wird pro Look weiterhin nur einmal als transparente GPU-Textur gerendert; beim Einblenden erhalten Dark/Light/Mixed verschiedene dunkle/helle Außenkanten. Auf hellen Hintergründen wird nur schwach transparentes Material dezent abgedunkelt, nicht der voll deckende blaue Press-Zustand. Kein CPU-Readback. Der Compositor benötigt einen eigenen kleinen Fragment-Shader; dieser ist nach Qt Quick zu portieren.
- `ghost-depth-policy.js`: bewegliche Kappen und Schäfte schreiben Tiefe **vor** den Sockeln; in Ghost/Outline werden hintere Trigger/Paddles frontal als vollständige Flächen ausgeblendet, während optionale depth-getestete gestrichelte Hints bleiben. Seiten-/Rückansichten geben die echten Teile wieder frei.
- `control-glyphs.js`: echte 3D-Planes mit vier Sony-Tastensymbolen auf der Original-DualSense-Geometrie, ohne Änderung ihrer OBJ-Dreiecke.
- 2D-SVGs mit 86 % Panelgröße und einem auf Hell/Mixed angepassten Flächenkontrast. Gemeinsamer Zoom auch für das flache SVG, das nicht dem 3D-Orbit folgt.
- Vier Looks und separate 2D-/3D-Press-Color-Picker bleiben erhalten.

**Qualitätsgrenze:** Frühere lokale Browserprüfungen dieser Chat-Umgebung scheiterten mit `ERR_BLOCKED_BY_ADMINISTRATOR`. Die GitHub-CI erzeugt inzwischen echte Chromium-WebGL2-Bildnachweise; eine ästhetische 3D-Freigabe oder native Qt-Quick-3D-Parität folgt daraus noch nicht. Für den Qt-Port siehe `QT_V40_COMPOSITOR.md`.

---

# ExoSnap Controller3D Lab v39 – vier echte Rendering-Looks

**Windows:** ZIP vollständig entpacken, `start.cmd` öffnen; `http://127.0.0.1:8792/` startet automatisch `pbr-lab.html`.
**Alternativ:** Node.js ≥ 20 → `npm start`.

## Vergleichsfläche

Ein einziges Grid, keine iFrames, vier einzeln abschaltbare Look-Reihen. Jede Reihe zeigt 3D Dunkel / Hell / Gemischt direkt neben 2D Dunkel / Hell / Gemischt. Gemeinsamer Materialmix (Standard 70 %), Kamera, Gamepad, Stickpose, Press-All. Nur ein Three.js-WebGL-Kontext und ein originales OBJ-Rig.

Die vier Look-Schalter sind bewusst klein gehalten; ihre Namen stehen im Hover-Titel:

- **A – Environment Solid:** Originalfarben, deckendes IBL-Material, normale PBR-Reflexionen, keine Szenenlampen.
- **B – Environment Ghost:** Matte transparente Oberflächen, klarere kühle Controls, dieselbe HDR-Lichtprobe, keine Szenenlampen.
- **C – Outline Ghost:** Unlit, minimale Shell-Deckkraft, schmale helle/dunkle backface-Silhouette ohne Shader-Postprocessing.
- **D – Hybrid Identity:** Erhält Originalfarbzonen wesentlich stärker, halbtransparent mit kontrollierter kühler Control-Tönung.

**Aktivfarbe:** Unabhängige Color Picker `2D aktiv` und `3D aktiv`. Standardmäßig **nicht gekoppelt**; die Checkbox **Sync** koppelt sie auf ausdrücklichen Wunsch. 2D-Pressed-Paint wird bei einer Farbänderung trotz unverändertem Press-State neu gezeichnet. Der 3D-Pressed-State benutzt direkt den neuen 3D-Wert, mit eigenem Emissionston. Materialmix-Updates regenerieren keine Modellgeometrie.

## Technischer Rahmen

Eine einzige originale 256×128 Radiance-HDR-Datei `assets/studio-neutral.hdr` beleuchtet die drei PBR-Looks über `Scene.environment`. Keine `PointLight`-/`DirectionalLight`-/`AmbientLight`-Objekte im Vierer-Vergleich. Für Qt Quick 3D enthält `qt-quick3d-port/EnvironmentProbe.qml` die passende `SceneEnvironment.lightProbe`-Referenz; Licht- und Farbskalen beider Renderer müssen bei der Portierung visuell kalibriert werden.

Der Three.js-Decoder `hdr-probe.js` liest das originale HDR-Asset direkt; es wird **kein zusätzlicher Download** benötigt. Das Unlit-Outline nutzt zwei zusätzliche Backface-Draws pro sichtbarem Shell-Mesh und teilt sich dessen BufferGeometry. Rear-Hints werden ausschließlich bei Ghost/Outline aktiviert, sind gestrichelt und depth-getestet.

Three.js-Renderer: echtes WebGL2, MSAA 4× im Offscreen-Ziel (wenn unterstützt), DPR max. 1,75; ein 3D-Render pro Look + 3 GPU-Blits für die drei Hintergrundansichten. Die 2D-Panels rendern unveränderte Original-SVGs mit eigenen Materialfarben.

## Checks und Grenzen

`npm run verify` führt die gesamte Node-Test-Suite aus. `tests/v39-four-looks.test.mjs`, `v39-color-controls.test.mjs`, `v39-rear-hints.test.mjs` und `v39-hdr-probe.test.mjs` prüfen insbesondere die neuen Zustands-/Beleuchtungs-/Importverträge. 

**Keine visuelle 3D-Freigabe:** Lokale Navigation in den verfügbaren Chromium-Tests schlägt mit `ERR_BLOCKED_BY_ADMINISTRATOR` fehl. Ohne echtes WebGL-Bild wird weder die finale 3D-Ästhetik noch native Qt-Quick-3D-Parität behauptet. Die v39-Looks sind ein implementierter, reproduzierbarer Vergleichsstand, keine endgültige Produktionsabnahme.

Die alte technische v28–v38-Hauptvorschau bleibt via `index.html?layout=dualsense` erreichbar. Archivseiten bleiben im ZIP, sind aber nicht Bestandteil des Startmenüs.
