# ExoSnap Controller Lab

[Controller-Lab öffnen](https://exoridus.github.io/exosnap-controller-lab/pbr-lab.html) · [Screenshots](https://exoridus.github.io/exosnap-controller-lab/screenshots.html) · [Qt-Handoff](docs/CONTROLLER_CONSOLIDATION.md)

**Ziel:** Ein gemeinsamer Input-Vertrag für 2D und 3D, aber zwei jeweils passende Qt-Renderpfade. Freigegebene visuelle Basis: **PR #14**; die GameCube-Experimente #15/#16 sind nicht enthalten.

## 2D, 3D und Qt Quick

| | 2D | 3D |
|---|---|---|
| Bearbeitbare Quelle | Ein vollständiges `source.svg` | Original-OBJ-Meshes und `info.json` |
| Bedienelemente | Benannte SVG-Gruppen; daraus generierte `elements/*.svg` | Separat benannte Meshes und Nodes mit eigenen Pivots |
| Austauschpaket | SVG + `mapping.json` + `controls.json` | **Eine `model.glb` pro Grundmodell** + `rig.json` |
| Qt-Laufzeit | Ein vorberechneter Sprite-Atlas + Elementdaten | Balsam-importierte Qt-Meshes + erhaltene Rig-Hierarchie |
| Eingang | **Kanonischer GamepadState** | **Derselbe GamepadState** |
| Pro Frame | Atlas-Elemente einfärben und verschieben | Pivots/Materialparameter aktualisieren; keine Vertex-Neuberechnung |

Ein GLB ist **nicht** ein einziges starres Mesh. Es kann viele unabhängig bewegbare Nodes enthalten, z. B. beide Sticks, vier Face-Tasten, D-Pad, Trigger, Menü, Housing und Touchpad.

## Controller-Pakete erzeugen

Die originalen editierbaren Dateien bleiben unter `references/controllers/<layout-id>/` (2D) und `assets/<ModelId>/` (3D). Der Builder bearbeitet sie nicht.

~~~bash
npm ci
npm run build:controller-packs
npm run build:controller-packs -- --models dualsense,dualshock4,gamecube,generic
npm run build:controller-packs -- --out .workspace/my-controller-packs
~~~

Standardziel: `.workspace/controller-packs/` (gitignored). GitHub Actions stellt die Pakete zusätzlich als separates Download-Artefakt bereit; die generierten GLBs werden nicht als zweite manuell gepflegte Quelle ins Git-Repository eingecheckt.

~~~text
.workspace/controller-packs/
├── catalog.json
├── dualsense/
│   ├── source.svg         # Original, vollständig editierbar
│   ├── mapping.json       # Original einschließlich nativer Zusatzfelder
│   ├── elements/          # Aus den SVG-Gruppen erzeugt
│   │   ├── body.svg
│   │   ├── btn-cross.svg
│   │   └── ...
│   ├── model.glb          # Komplettes Modell mit vielen benannten Nodes
│   ├── rig.json           # Nodes, Pivots, Mechanik, Control-Zuordnung
│   ├── controls.json      # Gemeinsames 2D/3D-Control-Mapping
│   └── manifest.json      # Version, Lizenzen, Herkunft, SHA-256
└── gamecube/
    └── ...
~~~

**Lizenzgrenzen:** Fehlt ein freigegebenes 3D-Modell, gibt es nur das 2D-Paket. Die WaveBird besitzt bisher keine passende 2D-Vorlage. Generic nutzt das freigegebene Xbox-One-Rig mit generischen Bedienelementen. SVG- und OBJ-Lizenzen sind getrennt: Beim GameCube stammt das 2D-Artwork aus GPL-3.0-only, das 3D-Quellmesh aus MIT. Die vollständigen Quellen und [Lizenznachweise](THIRD_PARTY_NOTICES.md) bleiben erhalten.

## Ein Control-Vertrag, zwei Darstellungen

Nur der ExoSnap-Host liest SDL3/GameInput und liefert den aktuellen `GamepadState`. Weder SVG noch GLB noch QML öffnen selbst einen zusätzlichen Controller-Provider. `controller-pack-contract.js` übersetzt die bestehenden Browser-IDs, ohne die nativen Mappings zu überschreiben.

| Control-ID | 2D | 3D |
|---|---|---|
| `south` | Kreuz/A/B je Layout einfärben | Physische südliche Taste bewegen/einfärben |
| `dpad_up` | Oberen D-Pad-Sektor aktivieren | Oberen D-Pad-Node bewegen |
| `left_stick` | Ring bei X/Y-Bewegung aktivieren | Stick-Pivot entlang zweier Achsen neigen |
| `left_stick_click` | Kappenmitte separat aktivieren | Nur bei Klickfähigkeit L3 herunterdrücken |
| `left_trigger` | Füllung entsprechend dem Druck | Trigger proportional neigen/verschieben |
| `player_index` | Native LED-Maske | Material-LED aus vertrauenswürdiger Provider-Zuordnung |

`b1/b2/b3/b4` sind die Übergangs-IDs für `south/east/west/north`. Die bisherigen `ls/rs` bedeuten **Stick-Klick**, nicht Analogbewegung. X/Y-Achsen bleiben separat. `player_index` ist ein Metadatum und bleibt `null`, solange keine verlässliche Provider-Zuordnung vorliegt; der Browser-`Gamepad.index` zählt **nicht** als Spielerindex.

Das ursprüngliche `mapping.json` wird bytegenau mitgeliefert, einschließlich der ExoSnap-Erweiterungen `control` und `clickControl`. `controls.json` und `rig.json` sind erzeugte Übersetzungsschichten, keine neuen Quellen, die getrennt gepflegt werden müssten.

## Qt Quick 3D

Qt 6.12+ kann das GLB mit `QtQuick3D.AssetUtils.RuntimeLoader` laden. `qt-quick3d-port/ControllerPackRuntime.qml` zeigt das einmalige Auflösen benannter Pivots und deren Bewegung per gemeinsamem Input-Frame. Für eingebettete Produktionsmodelle ist ein **Buildzeit-Import über Balsam** effizienter.

~~~bash
balsam --outputPath qt-generated .workspace/controller-packs/dualsense/model.glb
~~~

Das erzeugt Qt-Quick-3D-Meshes und QML. Die beweglichen Nodes dürfen nicht durch `--preTransformVertices` flach zu einem starren Mesh werden. `rig.json` beschreibt Pivots und Eingaben für die native Anbindung.

**Noch nicht gleichbedeutend mit nativer ExoSnap-Parität:** Ghost-Material, Tiefen-/Occlusion-Regeln, Oberflächenbeschriftung, Nintendo-LEDs und der Screen-Space-Alpha-Edge-Compositor benötigen native Shader-/Materialarbeit und Bildprüfung. `nativeQtValidated` bleibt `false`. Der vorhandene Qt-Probe-Renderer ist kein fertiger ExoSnap-Port.

## Topologie: vereinfachen ohne Qualitätsverlust

Der GLB-Exporter lässt **alle Originaldreiecke, Wicklung, Normalen, UVs und beweglichen Nodes** erhalten. Er erzeugt nur einen Indexbuffer durch Zusammenführen exakt identischer Vertex-Tupel. Es gibt **keine automatische Dezimierung**, kein glattes Re-Meshing und keine nachträgliche Änderung von Griffkonturen oder Tastenformen.

Im Browser-Lab existieren bereits konservative Optimierungen (exakt bewiesene gemeinsame Geometrie-Buffer, kompatible Stick-Instanzen, vorsichtiges Housing-Batching). Ein Buffer-Reuse ist nicht automatisch ein Draw-Call-Gewinn.

~~~bash
node tools/audit-geometry-reuse.mjs --json
npm run verify
~~~

Die Tests prüfen Paket-Determinismus, Hashes, Geometriezahl, Node-Namen, Capabilities und Input-Semantik. In der CI folgen WebGL-Browseraufnahmen, Qt-Proben und die Pages-Prüfung. Die **visuelle Qt-Quick-Abnahme am Zielbackend** ist weiterhin erforderlich.

## Lab benutzen

`npm start` öffnet die Lab unter `http://127.0.0.1:8792/`. 2D- und 3D-Controller teilen sich Demo, Live-Gamepad, einzelne Buttons, Trigger, Stick-Bewegung und Klick. Drei Hintergründe, ein Materialmix nur für 3D, Kamerawinkel und 240/320/480-Pixel-Kacheln dienen der visuellen Kontrolle. Eingabefarbe und Darstellung bleiben unabhängig einstellbar.

Aktuelle technische Details: [Controller Consolidation](docs/CONTROLLER_CONSOLIDATION.md), [Visual Finish / Qt-Gate](docs/VISUAL_FINISH_QT_GATE.md), [Quellen/Lizenzen](references/SOURCE_README.md). Historische Prototypen und gelöschte Zwischenberichte sind über die Git-Historie verfügbar.
