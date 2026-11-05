# ExoSnap – Three.js / Qt Quick 3D PBR Materialvergleich v31 (Implementierungsstand)

## Ausgeliefert

**Echte Codeimplementierung, kein generiertes Bild.** `pbr-lab.html` enthält sechs echte Three.js-PBR-Versuche A–F (Original PBR, Frosted Ghost, Smoked Glass, Edge Lighting, Soft Studio, Material Identity), je 3 Hintergründe Dark/Light/Mixed. Sie verwenden **einen** gemeinsamen Slider (0 Normal, 50 Glass, 100 Ghost), dieselbe 3D-Kamera, Modellgeometrie und die gleiche Pose. Ergänzende Diagnoseauswahl für Front/3/4/Seite, Größe 240×160 / 320×214 / 480×320 sowie alle Buttons aktiv; keine weiteren Material-/Lichtslider.

Der Renderer nutzt **genau eine originale Modellhierarchie** aus `info.json` und echten OBJ-Dateien, genau eine THREE.Scene und genau einen THREE.WebGLRenderer. 18 Felder werden über Scissor-Viewports erzeugt; jede Reihe wendet vor dem Zeichnen ihr Material-/Lichtrezept auf dieselben Mesh- und Materialinstanzen an. Keine zweite Controller-Modellkopie, kein 2D-Fake, kein Custom-Shader und kein eigener Postpass.

Die bestehende Hauptvorschau sowie 2D-Assetlogik blieben unverändert (nur ein Link auf das neue 3D-Lab wurde ergänzt). Die bisherige 2D-Qt-Materialgalerie bleibt als separate Diagnose erhalten.

**Geometrie:** 27 lokal enthaltene DualSense-OBJ-Komponenten werden tatsächlich geparst; Originalfarbzonen sind über die `info.json`-Farbe pro Teil korrekt getrennt. Bei Materialmix 0 sind sie nicht durch Einheitweiß ersetzt. Andere 3D-Modelle nur nach `npm run download-assets -- MODEL_ID` lokal verfügbar; unvollständige Modelle werden nicht durch Ersatzmeshes vorgetäuscht.

## Qt Quick 3D

`pbr-recipes.js` ist der Renderer-neutrale Ausgangspunkt. `qt-quick3d-port/pbr-reference-recipes.json` enthält 24 vollständige Vergleichskonfigurationen (6 Varianten × Mix 0/50/65/100) einschließlich expliziter Lichtpositionen, PBR-Koeffizienten und Portwarnungen. `qt-quick3d-port/ControllerSurface.qml` sowie `QtPbrLightRig.qml` sind **Port-Bausteine**, kein fertiger nativer Qt-Port. Details: `QT_QUICK3D_PARITY.md`.

Qt bietet `PrincipledMaterial` (Rauheit, Metalligkeit, Klarlack, Opazität) und `PointLight`, `DirectionalLight` mit realen Positionen. Deren Helligkeits-/Fade-/Tonemapping- und Alpha/Depth-Konventionen sind **nicht numerisch identisch** zu Three.js. Die Lichtpositionen und Modellnormierung sind 1:1 spezifiziert; für dieselben Bildwerte sind kalibrierte Portfaktoren und Qt-Golden-Renderbilder nötig.

## Tests

- Vor Implementierung: neue Tests wurden zuerst als fehlschlagend beobachtet und danach zum Bestehen gebracht (Logs `evidence/pbr-lab/red-*.log`, `green-*.log`).
- 6 PBR-Konfigurations-Tests, 3 OBJ-Rig-Tests, 3 Material-Anwendungstests, 4 Galerie-Interface/Größen-Tests.
- Gesamttests: siehe `evidence/pbr-lab/verify-full.log` für endgültiges `npm run verify` Ergebnis.
- Verifizierte HTTP-Dateiauslieferung durch den lokalen Node-Server für `pbr-lab.html` und ES-Module.

## Nicht behauptet / noch offen

**Keine visuelle 3D-Freigabe.** Chromium 144 erzeugt in dieser Umgebung auch mit SwiftShader keinen WebGL(2)-Kontext; außerdem wird lokale Browser-Navigation administrativ blockiert. Die tatsächliche 3D-Bildqualität, hintere Verdeckung, realistische Kantenreflexionen und optische Variantenwahl konnten deshalb nicht visuell geprüft werden. Es wurden keine künstlichen Controller-Screenshots als Nachweis erstellt. `tools/pbr-capture.mjs` kann auf einem WebGL-fähigen Rechner echte Vergleichsbilder erzeugen, bricht bei fehlendem WebGL aber ab.

**Kein vollständiger Qt Native Port / keine Qt Bildparität**; reine Rezept- und QML-Bausteinvorlage. Qt benötigt die Originalmesh-Konvertierung/Importpipeline. Die Stärke und Form der Lichtreflexionen müssen erst mit Qt gerendert und verglichen werden.

## Start

1. Entpacken und `start.cmd` (Windows) bzw. `npm start` aufrufen.
2. `http://127.0.0.1:8792/pbr-lab.html` aufrufen.
3. Einmal Materialmix für alle 18 Felder bewegen. Auswahl einer Reihe für den Download des Qt JSON-Rezepts.
4. Optional GPU-Bildvergleich: `node tools/pbr-capture.mjs --base http://127.0.0.1:8792/ --out evidence/local-pbr-webgl` mit vorher installiertem Playwright.
