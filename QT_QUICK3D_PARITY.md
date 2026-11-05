# ExoSnap – echtes 3D-PBR-Variantenlabor / Three.js ↔ Qt Quick 3D

## Was implementiert ist

`pbr-lab.html` ist eine separate **echte Three.js/WebGL-3D-Vergleichsseite** mit sechs unterschiedlichen, aus `pbr-recipes.js` parametrierten PBR- und Beleuchtungsrezepten A–F. Für jede Variante sind Dark, Light und Mixed sichtbar; der gemeinsame Materialmix steuert Normal (0), Glass (50), Ghost (100). Kamera, Controllerpose und Modellgröße sind identisch; jeder Rezeptwechsel variiert bewusst Material und **Lichtstärke**. Kamera Front/3/4/Profil, Panelgrößen und alle Controls aktiv sind zusätzliche Diagnosefunktionen und keine weiteren Effekt-Slider.

**Kein Fake-Controller:** `pbr-model.js` lädt die tatsächlichen OBJ-Dateien aus `assets/<ModelId>/` und die originale `info.json`-Hierarchie. Das Modell wird einmal in einen gemeinsamen `THREE.Scene`-Knoten geladen, auf maximales Maß 4,05 skaliert und zentriert. **Ein** WebGL-Canvas rendert per `renderer.setScissor()` in 18 Felder. Es gibt keine parallelen Controller-Modellkopien, keine CanvasTexture, keine CSS-gemalten Controller und keinen extra Shader/Postpass.

Im vollständigen ZIP ist **DualSenseCompact** mit 27 Original-OBJ-Komponenten lokal vorhanden. Weitere vom Katalog unterstützte 3D-Modelle benötigen vor dem Wechsel einen vollständigen Download der OBJ-Dateien: `npm run download-assets -- DS4Compact`, `XboxSeries` usw. Nicht vollständige Modelle liefern einen klaren Fehler und werden nicht durch Proxies ersetzt. WaveBird ist aus der neuen Galerie ausgeschlossen, entsprechend der früheren Benutzerentscheidung. Die vorhandene Hauptvorschau `index.html` und die nativen 2D-Referenzen wurden nicht verändert.

## Material- und Lichtsteuerung

Einziger Materialparameter: `t = slider / 100`. Die bestehende `styleAt(t)`-Kurve wird für Shell- und Controls-Opacity unverändert übernommen: Normal Shell/Controls 1/1, Glass 0.26/0.62, Ghost 0.06/0.36. Bei jedem t gilt `control.opacity >= shell.opacity`. Originalfarben stammen aus den jeweiligen `info.json`-Einträgen; die originale dunkelgraue DualSense-Unterseite wird bei Normal nicht zu Weiß. `originalColorWeight` bestimmt, wie stark Quellfarben im Ghost erhalten bleiben. Es gibt keinen Bildschirmhintergrund-Pixel-Readback und keinen globalen Multiply-/Invert-Look.

| Rezept | Eigentlicher Unterschied |
|---|---|
| A Original PBR | Natürliche, teils erhaltene Quellfarbe, moderate Rauheit und Kantenreflexion |
| B Frosted Ghost | Hohe Rauheit, sehr diffuser heller Körper, reduzierter Originalfarbanteil |
| C Smoked Glass | Niedrige Rauheit, stärkerer Clearcoat, dunkler Rauchglas-Ton |
| D Edge Lighting | Starke rückwärtige Punktlichtkomponente, kein Rim-Shader |
| E Soft Studio | Hohe diffuse Grundbeleuchtung, wenig Clearcoat, weiche Reflexe |
| F Material Identity | Quelle bleibt zu 86 % auch bei Ghost in Shell-/Control-Farbe erkennbar |

### Qt Quick 3D – exakte gemeinsame Eingangsbedingungen

- **Geometrie**: Original-OBJ-Sourcen plus `info.json`-Verwandtschaft, `controllerPartTransform()` und `frontFaceTransform()` portieren. Auf 4,05 maximale Controller-Ausdehnung normalisieren, danach geometrischen Mittelpunkt ins Weltzentrum verschieben. Qt benötigt dafür einen nativen Import (`.mesh`/glTF per Qt Asset-Import-Pipeline); ein bloßes `.obj` ist nicht automatisch ein Qt-Quick-3D-Model.
- **Kamera**: FOV 35°, Front/3/4/Profil mit exakt gemeinsamem Winkel und Radius wie `pbr-lab.js`; Quelle im JSON-Export unter `camera`.
- **Grundmaterial**: `MeshPhysicalMaterial.color` / `roughness` / `metalness` / `clearcoat` / `clearcoatRoughness` / `opacity` ↔ `PrincipledMaterial.baseColor` / `roughness` / `metalness` / `clearcoatAmount` / `clearcoatRoughnessAmount` / `opacity`. `ControllerSurface.qml` enthält den Mix-Vertrag, ohne echten Mesh-Import vorzutäuschen.
- **Beleuchtung**: Three `PointLight` an `[-3,4,6]` und `[2.2,1.7,-3]` ↔ Qt `PointLight` mit identischen **Positionen**. Fill `DirectionalLight.position=[4,2,5]` und target `[0,0,0]` ↔ Qt `DirectionalLight` **Richtung durch Rotation**; bloße Qt-Positionswerte eines Richtungslichts sind nicht ausreichend. Ambient ist in Three.js `AmbientLight`; bei Qt u. a. `Light.ambientColor`/IBL als Annäherung. Die beiden Renderer verwenden **nicht dieselbe Intensitätsskala / Abschwächungsformel**; `brightness` und `ambientColor` müssen für eine visuelle Parität gemessen/kalibriert werden.
- **Tonemapping**: Three `ACESFilmicToneMapping`, `SRGBColorSpace`, Exposure 1 ↔ Qt `SceneEnvironment.TonemapModeAces` mit passender Ausgabe-Farbtransformation.
- **Transparenz und Tiefe**: Three Materialien sind `transparent:true`, `depthWrite:true` auch für Ghost; Qt `PrincipledMaterial.SourceOver` und `alphaMode: Blend` können in anderer Reihenfolge und mit anderem Depth-Write gerendert werden. Genau diese Ebene ist besonders abnahmepflichtig, ehe man 1:1-Sichtparität behauptet.

Die exportierbaren vollständigen `qt`-Descriptors in `qt-quick3d-port/pbr-reference-recipes.json` sind die kanonischen 24 Rezept-Snapshots für Werte 0/50/65/100. Ein Qt-Port soll diese Zahlen **als Eingangsbedingungen** nutzen, nicht fiktive Pixelidentität versprechen. `QtPbrLightRig.qml` und `ControllerSurface.qml` sind Bausteine, **kein fertig portierter Qt-Renderer**.

## Technischer Nachweis und Grenzen

- `node --test tests/pbr-recipe.test.mjs` belegt alle sechs Varianten, Kennlinien und echte PBR-/Lichtparameter.
- `node --test tests/pbr-native-rig.test.mjs` parst die tatsächlich enthaltenen 27 DualSense-OBJ-Dateien und verifiziert Hierarchie, original getrennte Farben, Normalisierung und Dreiecksmengen.
- `node --test tests/pbr-interface.test.mjs` prüft Ein-Slider- und Ein-Renderer-Vertrag sowie den expliziten WebGL-Fehlerpfad.
- `npm run verify` prüft die vollständige Testsuite; Log unter `evidence/pbr-lab/verify-full.log`.

**WebGL-Blocker der vorliegenden Umgebung:** Chromium 144 ließ auch mit aktiviertem Software-Renderer keinen WebGL(2)-Kontext zu (`GL_VENDOR=Disabled`, `GL_RENDERER=Disabled`, `BindToCurrentSequence failed`). Eine echte visuelle 3D-Abnahme oder ein pixelgleicher Qt-Bildvergleich war deshalb hier nicht möglich. Screenshots aus einem Bildgenerator sind kein Ersatz und werden nicht als Nachweis geliefert. Erste ästhetische Empfehlung erst nach realen WebGL-Aufnahmen auf einem GPU-fähigen Rechner.

## Start

```sh
npm start
# Browser: http://127.0.0.1:8792/pbr-lab.html
```

`pbr-lab.html` ist **kein eigenständig per file:// lauffähiges HTML**: Three.js wird per lokalen ES-Modulen geladen. Im ZIP ist alles für den Browserzugriff über `npm start` vorhanden. Für weitere 3D-Modelle vorher `npm run download-assets -- MODEL_ID` ausführen. Eine neue Native-Qt-Build-/Visualprüfung ist noch nicht erfolgt.
