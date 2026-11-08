# ExoSnap Controller Lab — Abschlussvergleich

[Lab öffnen](https://exoridus.github.io/exosnap-controller-lab/pbr-lab.html) · [Bildnachweise und Verlauf](https://exoridus.github.io/exosnap-controller-lab/screenshots.html) · [Qt-Handoff und genaue Parameter](docs/CONTROLLER_CONSOLIDATION.md)

Das Lab zeigt eine Original-3D-Darstellung mit weißem Aktivfeedback und eine unabhängige transparente 2D-Ansicht. Jede Reihe hat drei Hintergründe: dunkel, hell und gemischt.

## Finaler Stand

**Demo ON · Markings ON.** Die Lab startet mit synchronisierten 2D-/3D-Eingaben und mechanischen Buttons/Triggern. Material- und Debug-Regler sind eingeklappt. Der 2D-Ring ist eine Aktivfläche; der Mittelteil zeigt unabhängig L3/R3. [Umsetzung, Artefaktquellen und Abnahme](docs/FINAL_POLISH.md).

## Start und Bedienung

Node.js ≥ 20: `npm ci`, danach `npm start`. Unter Windows kann `start.cmd` verwendet werden. `http://127.0.0.1:8792/` öffnet `pbr-lab.html`; die freigegebenen Modelle und die HDR-Lichtprobe liegen im Repository.

- **3D · Weiß:** Eine einzige, quelldatengetreue 3D-Reihe mit weißem Aktivfeedback. Die frühere Blauweiß-Vergleichsreihe wurde entfernt.
- **Materialmix — nur 3D:** 0 % bewahrt die deckende Darstellung; 100 % reduziert das Gehäuse auf 0,10 und neutrale Eingabeflächen auf 0,25 Alpha. Die 2D-Reihe bleibt unverändert.
- **2D — Transparent:** Original-SVG-Pfade, neutrale Eingabeflächen mit 0,30 Alpha und aktive weiße Flächen mit 0,96. Äußere und innere Gehäusekonturen, Controls und Symbole haben dieselbe Farbregel pro Hintergrund. Auf Hell und Gemischt erscheinen graue statt schwarze Zusatzkonturen. Das SVG enthält seitliche Sicherheitsränder; Verzierungen erhalten kein Eingabefeedback.
- **Eingaben:** Einzelne Tasten, beide analogen Trigger, Stick-Bewegung, L3/R3, alle Tasten oder ein Standard-Gamepad lassen sich vergleichen. Die 2D-Sticks können direkt gezogen werden; Bewegung und Klick bleiben unabhängig.
- **Kamera und Größe:** Gemeinsame Kameraposition für 3D; 240, 320 oder 480 Pixel pro Feld. Das Mausrad über 2D/3D zoomt, Shift + Mausrad scrollt horizontal. Das 2D-SVG folgt dem Zoom, bleibt aber frontal.
- **Aktivfarben & Qt-Parameter:** Eigene Farben für 2D/3D mit optionaler Kopplung; Sync ist standardmäßig aktiv. Der Download enthält die tatsächlich gewählten Parameter und benennt offene native Arbeit.

## Darstellung und Ressourcen

Sichtbare Trigger werden nicht mehr anhand eines Kamerawinkels vollständig ausgeblendet. Der Tiefentest entscheidet über ihre sichtbaren Teile. Verdeckte Schultertasten erhalten gestrichelte Konturen mit dunkler Gegenkontur und eigenem Eingabefeedback. Die bewegliche Stick-Hierarchie kippt Kappe und Schaft gemeinsam in die angezeigte Richtung. Face-, quellgetreue materialgebundene D-Pad-Prägungen kommen aus den originalen SVG-Pfaden.

Ein originales Rig, ein WebGL-Kontext, eine Kamera und eine HDR-Probe versorgen die Ansicht. Das Modell wird einmal gerendert; dieselbe GPU-Textur wird auf die drei Hintergründe gelegt. Änderungen werden bedarfsgesteuert gezeichnet. Ein 3D-Materialwechsel zeichnet das unveränderte 2D-SVG nicht neu.

`shareEquivalentControlGeometry` teilt nur exakt nachgewiesene Geometrien und erhält individuelle Materialien und Bewegungen. Gemeinsame Buffer sparen Speicher; kompatible Stick-Instanzen sparen zusätzlich Draw Calls. Unterschiedliche Eingabe-/Materialzustände wechseln für das betroffene Paar zu getrennten Meshes. `node tools/audit-geometry-reuse.mjs --json` gibt die tatsächlichen Einsparungen pro Modell aus. Face- und D-Pad-Teile werden nicht aufgrund bloßer Ähnlichkeit vereinheitlicht.

Der Qt-Port verwendet einen kleinen, rendererneutralen Materialvertrag. Das Lab installiert keinen zusätzlichen Fresnel-Patch auf den PBR-Materialien. Die verdeckten Linien und der Hintergrund-Compositor benötigen dennoch eine eigene native Umsetzung und Bildprüfung; `nativeValidated` bleibt `false`. Details stehen im [aktuellen Handoff](docs/CONTROLLER_CONSOLIDATION.md).

## Prüfung und Veröffentlichung

`npm run verify` prüft Syntax und die vollständige Node-Suite. `tools/capture-pages.mjs` erzeugt echte Chromium-WebGL2-/SVG-Bilder und prüft zusätzlich Mix-Unabhängigkeit, einzelne verdeckte Eingaben, Originalsymbole, Kamerapositionen und Aktivfarben. Zusätzlich prüft die echte Browser-Abnahme Demo, mechanische Druckbewegung, Oberflächentexturen und den globalen Markings-Schalter und zeichnet eine Demo als WebM auf. Ein Fehler verhindert die Pages-Veröffentlichung. Bilder sind Rendernachweise; die finale ästhetische Auswahl trifft der Nutzer.

Der Workflow `.github/workflows/pages-and-screenshots.yml` archiviert erfolgreiche Aufnahmen dauerhaft im Branch `visual-history` unter ihrer Quell-SHA und veröffentlicht anschließend Pages. Der Arbeitsbranch führt alle Prüfungen mit Artefakten aus. GitHub Pages wird aufgrund der vorhandenen Umgebungsschutzregeln nur durch eine freigegebene Übernahme nach `main` veröffentlicht. Siehe auch [Pages-Setup](GITHUB_PAGES_SETUP.md).

**Modelle und Lizenzen:** Generic Pro enthält 23 eigene OBJ-Teile und verwendet das vorhandene generische 2D-Layout. Nur freigegebene Kernmodelle sind auswählbar; Xbox Series / Steam Controller 2026 werden nicht als freigegebene 3D-Modelle ausgegeben. Lizenzprüfung und Originaldateien bleiben Bestandteil des Repositories.

Die technische ältere Vorschau bleibt unter `index.html?layout=dualsense` erreichbar. Frühere Vergleichsrezepte sind erhalten; ihre Beschreibung steht in den [historischen v39/v40-Notizen](docs/ARCHIVE_V39_V40.md).
