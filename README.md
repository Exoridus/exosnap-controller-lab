# ExoSnap Controller Lab — Abschlussvergleich

[Lab öffnen](https://exoridus.github.io/exosnap-controller-lab/pbr-lab.html) · [Bildnachweise und Verlauf](https://exoridus.github.io/exosnap-controller-lab/screenshots.html) · [Qt-Handoff und genaue Parameter](docs/CONTROLLER_CONSOLIDATION.md)

Das Lab zeigt zwei 3D-Aktivfarben auf derselben Darstellung und eine gemeinsame transparente 2D-Ansicht. Jede Reihe hat drei Hintergründe: dunkel, hell und gemischt.

## Start und Bedienung

Node.js ≥ 20: `npm ci`, danach `npm start`. Unter Windows kann `start.cmd` verwendet werden. `http://127.0.0.1:8792/` öffnet `pbr-lab.html`; die freigegebenen Modelle und die HDR-Lichtprobe liegen im Repository.

- **Weiß / Blauweiß:** Zwei einzeln abschaltbare 3D-Reihen. Ohne Eingabe sind Material und Farben identisch. Blauweiß färbt nur helle aktive Teile; sein Blauanteil nimmt zum Ghost-Ende ab.
- **Materialmix — nur 3D:** 0 % bewahrt die deckende Darstellung; 100 % reduziert das Gehäuse auf 0,10 und neutrale Eingabeflächen auf 0,25 Alpha. Die 2D-Reihe bleibt unverändert.
- **2D — Transparent:** Originale SVG-Pfade, einheitliche neutrale Eingabeflächen mit 0,26 Alpha und aktive weiße Flächen mit 0,40. Konturen und Symbole bleiben auf den drei Hintergründen lesbar; Verzierungen erhalten kein Eingabefeedback.
- **Eingaben:** Einzelne Tasten, beide analogen Trigger, Stick-Bewegung, L3/R3, alle Tasten oder ein Standard-Gamepad lassen sich vergleichen. Die 2D-Sticks können direkt gezogen werden; Bewegung und Klick bleiben unabhängig.
- **Kamera und Größe:** Gemeinsame Kameraposition für 3D; 240, 320 oder 480 Pixel pro Feld. Das Mausrad über 2D/3D zoomt, Shift + Mausrad scrollt horizontal. Das 2D-SVG folgt dem Zoom, bleibt aber frontal.
- **Aktivfarben & Qt-Parameter:** Eigene Farben für 2D/3D mit optionaler Kopplung; Sync ist standardmäßig aktiv. Der Download enthält die tatsächlich gewählten Parameter und benennt offene native Arbeit.

## Darstellung und Ressourcen

Sichtbare Trigger werden nicht mehr anhand eines Kamerawinkels vollständig ausgeblendet. Der Tiefentest entscheidet über ihre sichtbaren Teile. Verdeckte Schultertasten erhalten gestrichelte Konturen mit dunkler Gegenkontur und eigenem Eingabefeedback. Die bewegliche Stick-Hierarchie kippt Kappe und Schaft gemeinsam in die angezeigte Richtung. Face-, D-Pad- und unterstützte Create/Options-Symbole kommen aus den originalen SVG-Pfaden.

Ein originales Rig, ein WebGL-Kontext, eine Kamera und eine HDR-Probe versorgen die Ansicht. Das Modell wird pro Aktivfarben-Variante einmal gerendert; dieselbe GPU-Textur wird auf die drei Hintergründe gelegt. Änderungen werden bedarfsgesteuert gezeichnet. Ein 3D-Materialwechsel zeichnet das unveränderte 2D-SVG nicht neu.

`shareEquivalentControlGeometry` teilt nur exakt nachgewiesene Geometrien und erhält individuelle Materialien und Bewegungen. Gemeinsame Buffer sparen Speicher; kompatible Stick-Instanzen sparen zusätzlich Draw Calls. Unterschiedliche Eingabe-/Materialzustände wechseln für das betroffene Paar zu getrennten Meshes. `node tools/audit-geometry-reuse.mjs --json` gibt die tatsächlichen Einsparungen pro Modell aus. Face- und D-Pad-Teile werden nicht aufgrund bloßer Ähnlichkeit vereinheitlicht.

Der Qt-Port verwendet einen kleinen, rendererneutralen Materialvertrag. Das Lab installiert keinen zusätzlichen Fresnel-Patch auf den PBR-Materialien. Die verdeckten Linien und der Hintergrund-Compositor benötigen dennoch eine eigene native Umsetzung und Bildprüfung; `nativeValidated` bleibt `false`. Details stehen im [aktuellen Handoff](docs/CONTROLLER_CONSOLIDATION.md).

## Prüfung und Veröffentlichung

`npm run verify` prüft Syntax und die vollständige Node-Suite. `tools/capture-pages.mjs` erzeugt echte Chromium-WebGL2-/SVG-Bilder und prüft zusätzlich Mix-Unabhängigkeit, einzelne verdeckte Eingaben, Originalsymbole, Kamerapositionen und Aktivfarben. Ein Fehler verhindert die Pages-Veröffentlichung. Bilder sind Rendernachweise; die finale ästhetische Auswahl trifft der Nutzer.

Der Workflow `.github/workflows/pages-and-screenshots.yml` archiviert erfolgreiche Aufnahmen dauerhaft im Branch `visual-history` unter ihrer Quell-SHA und veröffentlicht anschließend Pages. Der Konsolidierungszweig kann den autorisierten Lab-Vergleich veröffentlichen, während der PR bis zur ästhetischen Entscheidung als Entwurf erhalten bleibt. Siehe auch [Pages-Setup](GITHUB_PAGES_SETUP.md).

**Modelle und Lizenzen:** Generic Pro enthält 23 eigene OBJ-Teile und verwendet das vorhandene generische 2D-Layout. Nur freigegebene Kernmodelle sind auswählbar; Xbox Series / Steam Controller 2026 werden nicht als freigegebene 3D-Modelle ausgegeben. Lizenzprüfung und Originaldateien bleiben Bestandteil des Repositories.

Die technische ältere Vorschau bleibt unter `index.html?layout=dualsense` erreichbar. Frühere Vergleichsrezepte sind erhalten; ihre Beschreibung steht in den [historischen v39/v40-Notizen](docs/ARCHIVE_V39_V40.md).
