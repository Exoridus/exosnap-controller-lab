# ExoSnap Controller Lab

**[Controller-Lab öffnen](https://exoridus.github.io/exosnap-controller-lab/pbr-lab.html)** · [Screenshots](https://exoridus.github.io/exosnap-controller-lab/screenshots.html) · [Qt-Handoff](docs/VISUAL_FINISH_QT_GATE.md) · [Lizenzen](THIRD_PARTY_NOTICES.md)

Das Lab ist die bearbeitbare Referenz für das ExoSnap-Controller-Overlay. Originale 2D-SVGs und 3D-Quellmeshes zeigen **denselben normalisierten Inputzustand** auf dunklen, hellen und gemischten Hintergründen. Standard: Demo und Markings an, weißes 3D-Feedback, transparente 2D-Reihe, einklappbare Einstellungen.

## Dateien: 2D und 3D, aber eine Ansteuerung

| | **2D-Controller** | **3D-Controller** |
| --- | --- | --- |
| Bearbeitbare Quelle | Vollständige `source.svg`, `mapping.json` | Original-OBJ-Dateien + `info.json`, Generatoren |
| Einzelne Controls | Benannte SVG-Gruppen / exportierte `elements/*.svg` | Separate benannte Meshes und Pivot-Nodes **innerhalb einer GLB** |
| Austauschformat | SVG + Mapping | **Eine `model.glb` pro Grundmodell**, dazu `rig.json` |
| Qt-Produktformat | Einmal erzeugter **Sprite-Atlas** + Elementdaten | Qt-Balsam-Import: **Qt-Meshes + QML-Rig** |
| Ansteuerung | Kanonischer `GamepadState` | **Derselbe GamepadState** |

Eine GLB ist nicht ein einziges unbewegliches Mesh. Die Face-Buttons, D-Pad, Trigger und Stick-Gruppen bleiben unabhängig animierbar. Originale Vertices/Normals/UVs werden nicht verlustbehaftet reduziert. **Exakt identische Buffer können gemeinsam genutzt werden**, ohne die Bewegungen oder Materialien zu vereinheitlichen.

## Controller-Matrix

| Modell | 2D | 3D | Native Qt-Parität |
| --- | --- | --- | --- |
| DualSense, DualShock 4 | Quelle vorhanden | Original-OBJ, GLB-Export | Offen |
| Xbox One / Xbox 360 | Quelle vorhanden | Original-OBJ, GLB-Export | Offen |
| Switch Pro, Joy-Con L/R/Grip | Quelle vorhanden | Original-OBJ, GLB-Export | Offen |
| GameCube | Quelle vorhanden | Original-OBJ, GLB-Export | Offen |
| Generic Pro | Quelle vorhanden | MIT-Xbox-One-Rig als neutraler Proxy | Offen |
| WaveBird | Keine 2D-Vorlage | Original-OBJ, 3D-only | Offen |
| Xbox Series, Steam, Edge-/Elite-Sondermodelle | 2D-Referenzen | Kein vollständig lizenzierter, passender 3D-Rig | Nicht freigegeben |

Der **Browser-Lab-Renderer und die nativen Qt-Smoke-Tests sind kein vollständiger ExoSnap-/D3D11-Paritätsnachweis**. Insbesondere Shader, Transparenz, Tiefenpuffer und Hardware-Input bleiben gesondert abzunehmen.

## Ein Controller-Paket bauen

~~~sh
npm ci
npm run verify
npm run build:controller-pack -- --model DualSenseCompact
npm run build:controller-pack -- --model Gamecube
npm run build:controller-pack -- --model all
~~~

Optional: `--out ./anderer-ordner`. Standardziel ist **`.workspace/controller-packs/`** (gitignored). Die GLB, Control-Dateien und SVG-Einzelteile sind **generierte Build-Artefakte**, keine zweite bearbeitbare Quelle.

~~~text
.workspace/controller-packs/
  DualSenseCompact/
    source.svg         # Original-2D-Artwork
    mapping.json       # 2D-Schichten und Inputzuordnung
    elements/          # generiert aus den originalen SVG-Gruppen
      body.svg
      btn-up.svg
      ...
    model.glb          # EIN 3D-Modell, viele bewegliche Nodes
    rig.json           # Quell-Node, Control, Pivot, Mechanik
    controls.json      # kanonische IDs für 2D und 3D
    manifest.json      # SHA-256 von Quelle und Ausgabe, Herkunft/Lizenz
~~~

Die Namen im `elements/`-Ordner stammen aus dem jeweiligen Mapping und sind nicht bei allen Controllern identisch. WaveBird wird ohne 2D-Dateien exportiert, weil dafür keine passende Vorlage existiert.

### Derselbe Control-State für beide Darstellungen

| Kanonischer Input | 2D | 3D |
| --- | --- | --- |
| `south` | Richtige Kreuz-/A-/B-Fläche aktivieren | Physische Taste drücken/färben |
| `left_stick` | Kappe bewegen, Ring aktivieren | Pivot neigen |
| `left_stick_click` | Kappenmitte aktivieren | Kappe herunterdrücken, wenn unterstützt |
| `left_trigger` | Analoge Füllung | Mechanischen Winkel/Weg anpassen |
| `dpad_up` | Oberen D-Pad-Bereich aktivieren | Oberes D-Pad-Teil bewegen |
| `player_index` | Vorhandene LED-Kästchen aktualisieren | Anzeige-LEDs im Material aktualisieren |

`south/east/west/north` sind **Tastenpositionen**, keine A/B/X/Y-Aufdrucke. Die Familien behalten ihre eigenen Symbole. Die bisherigen Lab-Schlüssel (`b1`–`b4`, `ls`, `l2` usw.) werden über `controller-asset-contract.js` einheitlich abgebildet. Stick-Achsen und L3/R3 bleiben getrennt. `player_index` ist optionale vertrauenswürdige Geräteinformation – **niemals** der Browser-`Gamepad.index`.

**Wichtig:** Der native ExoSnap-Input und die dort bereits erweiterten SVG-Mappings bleiben autoritativ. `controls.json` ist eine semantische Austauschschicht und darf ExoSnaps bestehende Mapping-Dateien **nicht** automatisch überschreiben.

## Qt Quick: vorbereitete Integration

1. `model.glb` via **Qt Balsam offline** zu Qt-Meshes/QML importieren; Namen, Pivot-/Parent-Hierarchie und Geometrie erhalten. `RuntimeLoader` nur für dynamische Vorschau oder frei geladene Modelle verwenden.
2. Importierte Nodes anhand `rig.json` mit dem bestehenden nativen `ControllerState` verbinden, **ohne zweiten Hardware-Reader**. Button-Bewegung über Node-Transforms, Farbe/Alpha über Materialzustände.
3. Für 2D ExoSnaps vorhandene `GamepadSprites`-/`QSvgRenderer`-/Atlas-Pipeline nutzen. Einzelelemente einmalig rasterisieren und wiederverwenden; keine SVG-Neurasterisierung bei jedem Inputframe.
4. Originale Quell-Glyphen, Ghost-/PBR-Parameter, Innenkonturen, verdeckte Schultern und Alpha-Edge-Compositor als separate Qt-Shader-/Depth-Passes abgleichen. Die hier mitgelieferten QML-Dateien sind **Referenzbausteine, kein fertiger Qt-Rig-Import**.

Die vorhandenen Generatoren, Original-Meshes, Original-SVGs, Copyright-/Lizenzhinweise und die visuellen Regressionstests bleiben erhalten. Die 2D- und 3D-Lizenzen eines Controllers können sich unterscheiden (insbesondere GameCube). [Native Integrationsgates](docs/VISUAL_FINISH_QT_GATE.md) · [Vollständiger Handoff](docs/CONTROLLER_CONSOLIDATION.md)

## Entwicklung und Veröffentlichung

~~~sh
npm start       # http://127.0.0.1:8792/
npm run verify  # Node + Asset-Pack-Smoke-Tests
~~~

GitHub Actions führt echte Chromium-WebGL-Aufnahmen und Qt-Portabilitätsproben aus; nur erfolgreiche Builds werden auf GitHub Pages veröffentlicht. Die Hauptvorschau liegt unter `pbr-lab.html`, ältere visuelle Vergleiche sind weiterhin über die Git-Historie nachvollziehbar.

[Originalquellen](references/SOURCE_README.md) · [Lizenzhinweise](THIRD_PARTY_NOTICES.md) · [Pages-Setup](GITHUB_PAGES_SETUP.md)
