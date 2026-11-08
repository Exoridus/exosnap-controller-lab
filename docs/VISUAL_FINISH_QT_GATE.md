# Finaler Visual-Polish und Qt-Portabilitäts-Gate

Stand: 2026-11-08. Bezug: finale `pbr-lab.html`, nicht die archivierten A–H-/Material-Studien. Ausgangsstand: `b6e0df707c6a0f4305f72679c6e389741ea82f6c` (PR #6).

## Entscheidung

Die drei gezielten Korrekturen verwenden keine neue Rendering-Architektur. Alle untersuchten visuellen Operationen haben eine konkrete Qt-Entsprechung. **Das ist keine vollständige native Paritätsfreigabe:** Original-Rig, verdeckte Konturen und Alpha-Edge-Compositor müssen in ExoSnap noch implementiert beziehungsweise zusammen auf dem Zielbackend validiert werden. `qtLabDescriptor().nativeValidated` bleibt deshalb `false`.

Der native Abgleich verwendet **ExoSnap `next`, Commit `f4a338493f42d85fff421abf3ee091d899a1380e`, Qt 6.12.0**. Das ist eine unveränderliche untersuchte Momentaufnahme, keine Behauptung über spätere Änderungen an `next`.

## 1. Die tatsächlichen Sockel und ihre Korrektur

Die rot markierte breite Aufnahme ist beim Original-DualSense Bestandteil von `left_stick.obj` und `right_stick.obj`, semantisch `stick-stem`. Die Originaldateien nennen ihre Meshes teilweise `ring`; das ist nicht mit den separaten `left_ring.obj`/`right_ring.obj` (`stick-pivot`) gleichzusetzen. Die Quellgeometrie wurde mit gezielter Einfärbung im echten Renderer identifiziert. Beim DualSense existiert hier kein zusätzliches separates `stick-base`-/`stick-well`-Mesh.

Ursache: Die breite Originalkuppel behielt ihre dunkle Quellfarbe und Control-Materialwerte, obwohl ihre Alpha bereits der Gehäuseschale folgte. Mit der transparenten Überlagerung und dem vorhandenen Hintergrund-Compositor erschien sie besonders auf Hell als abgesetzte graue Innenfläche. Es war weder ein fehlendes Mesh noch ein Anlass, die Geometrie zu löschen oder den Tiefentest abzuschalten. Nur eine Farbangleichung war in den ersten echten Nachher-Aufnahmen noch zu auffällig.

`resolveLabRecipe()` und `applyPbrRecipeToRig()` behandeln nun beide Originalkuppeln konsistent. Mit `s = t²(3−2t)` und Materialmix `t` mischen sich Quellfarbe und PBR-Werte allmählich zur oberen Gehäuseschale. Die Support-Deckkraft ist `shellOpacity × (1−0.72s)`: im Originalmodus unverändert 1; bei 70 % Mix etwa 0,106 statt etwa 0,243; am Ghost-Endpunkt 0,028. Die Teile bleiben vorhanden und sichtbar, aber deutlich zurückhaltender. Die Korrektur gilt nur für den tatsächlich visuell untersuchten `DualSenseCompact` und beide dortigen Supports. Andere Familien behalten ihre vorhandenen Support-Farben und Gehäuse-Deckkraft; insbesondere werden dunkle Joy-Con-Sticks nicht von der farbigen Schale umgefärbt. Die bewegliche Bedienlippe `stick-pivot` und die Kappen bleiben unverändert.

Unverändert bleiben sämtliche Quellvertices, Meshes, Elternknoten, mechanischen Transformationen, Renderreihenfolge und Depth-Test/-Write. Insbesondere folgt die Originalkuppel weiterhin ihrer ursprünglichen beweglichen Stick-Hierarchie; sie wird nicht fälschlich als unbewegliches Gehäuseteil neu verdrahtet. Ringbewegung und L3/R3 bleiben getrennt. Keine zusätzlichen Meshes, Draw Calls oder Renderpasses; die kompatiblen Stickpaare bleiben instanziert.

## 2. Neutrale 2D-Flächen und Face-Symbole

Der aktive `coherentContours`-Pfad in `polish-2d-style.js` koppelte bisher Flächen und Zeichen an die gemeinsame Konturfarbe. Auf Dunkel war diese reines Weiß. Neutrale Flächen verwenden dort jetzt `#9ca3aa`; die bereits passenden Konturen, die anderen Hintergrundprofile und die weiße Aktivierung bleiben bestehen. `resolveFlatMaterial()` behält 70 % Standardtransparenz, 0,30 neutrale und 0,96 aktive Deckkraft.

`paintGlyphs()` bestimmt für die originalen Face-Pfade eine eigene helle oder dunkle Tinte anhand der resultierenden Button-Fläche. Die Glyphen-Deckkraft ist unabhängig von der Button-Deckkraft. Dadurch bleiben sie auch auf vollständig opaken Buttons und bei weißer Aktivierung lesbar. Kein neuer Hintergrundkreis, kein zusätzlicher Schatten, keine Doppelkontur. `paintControlGroup()` und die ursprüngliche Geometrie bleiben erhalten; `Markings` steuert weiterhin die Sichtbarkeit.

Die Kontrastentscheidung verwendet die **festen Lab-Hintergrundprofile**, keinen GPU-Readback. Die rechnerischen Kontrasttests gelten für diese Profile, nicht als universelle Kontrastgarantie über beliebigen hellen/dunklen Videopixeln. Diese Einschränkung muss die native Integration ebenso beachten.

## 3. Portabilitätsmatrix

**A:** native Standard-API vorhanden. **B:** konkrete eigene native Umsetzung/Shader nötig. **C:** kritischer zusammenhängender Nachweis noch offen. A/B beschreiben die Umsetzung, nicht automatisch einen bestandenen nativen Bildvergleich.

| Funktion | Tatsächlicher Browserpfad | Konkrete Qt-Entsprechung | Vorhanden / Nachweis / offener Anteil |
|---|---|---|---|
| Originale 2D-Pfade und Konturen | `ControllerReference`, Original-SVG; `paintControlGroup()` | `QSvgRenderer::render()`, `QPainter`, vorhandene Sprite-Atlas-Pipeline | **A.** In ExoSnap vorhanden; gezielte native SVG-Proben dieses PRs, keine vollständige ExoSnap-Ausführung. |
| 2D-Material/Alpha | `resolveFlatMaterial()`, `controlSurfaceState()` | Farbe/Alpha in vorbereiteten Atlas-Layern, `QPainter::CompositionMode_SourceOver`, bestehende GPU-Quads | **A/B.** Rasterisierung und Atlas vorhanden; neue Farb-/Alpha-Entkopplung in nativen Layern noch übernehmen. |
| Face-Symbole und Markings | `surfaceGlyphColor()`, `paintGlyphs()` | Originalpfade mit separat gesetzter Tinte; eigene Glyphen-Maske/Atlas-Lage und Sichtbarkeit | **A/B.** Keine Schrift-Rekonstruktion erforderlich. Finales Live-Umschalten in ExoSnap noch nicht nachgewiesen. |
| Stickring und Klickzentrum | `ensureStickAnnulus()`, maskierter Ring, getrennte Center-Fläche | Unterstützte SVG-Maske oder `QPainterPath::subtracted()`; vorhandene Knockout-/Sprite-Layer | **A/B.** Native Masken-/Pfad-Probe; Atlas-Anbindung des finalen Zustands noch offen. |
| SVG-CSS/Clipping | DOM-Styles, `!important`, Transformationen und Masken | Beim Atlas-Aufbau Styles in Attribute auflösen; vorhandenes `RasterizerMasks()` bzw. `QPainter::setClipPath()` | **B.** Kein unveränderter Browser-DOM-Import. Qt SVG unterstützt nicht beliebige Browser-SVG-/CSS-Funktionen; `clipPath` ist laut Qt-Tabelle nicht unterstützt. |
| Originale 3D-Meshes/Hierarchie | `loadNativeRig()`, OBJ + `info.json` | `Model`, `Node`, importierte `.mesh` oder `QQuick3DGeometry`; originale Pivots übertragen | **A/B/C.** ExoSnap besitzt einen parametrischen Pilot-Rig, nicht bereits diesen vollständigen Original-Rig. |
| Mechanik, Demo, Kamera | `applyControlPoseToRig()`, `ControllerDemo`, gemeinsame Zustände | vorhandene `ControllerState`/`ControllerMechanics`, `Node`-Rotation/Position, Camera | **A/B.** Native Mechanik vorhanden; Quaternion-/Positionsregeln wiederverwenden. Der vollständige Original-Rig wurde hier nicht nativ animiert. |
| PBR, Support-Mix, einfache Transparenz | `MeshPhysicalMaterial`, skalare Materialparameter | `PrincipledMaterial`, `opacity`, Roughness/Metalness/Clearcoat, `alphaMode`, `AlwaysDepthDraw` | **A.** Existierendes `ControllerSurface.qml` wird nativ isoliert geprüft; vollständige transparente Geometrie-Parität bleibt **C**. |
| HDRI/Umgebung | HDR + PMREM im bestehenden PBR-Lab | `SceneEnvironment.lightProbe` mit `Texture`, vorzugsweise vorgefilterte Cubemap | **A/B.** Lab-Qt-Referenz vorhanden; untersuchter ExoSnap-Pilot verwendet Richtungslichter. Belichtungs-/Tonemapping-Abgleich offen. |
| 3D-Oberflächenaufdrucke | `prepareSurfaceArtwork()`/`installSurfaceMarking()`: UV-Attribut, Alpha-Maske, Normalen-Gate im Material | `CustomMaterial` mit `TextureInput`, UV/Varying, `BASE_COLOR` und Aktivierungsuniform | **B/C.** Konkreter kleiner Materialshader, kein schwebendes Mesh und kein separater Aufdruckpass nötig. Noch nicht nativ nachgewiesen. |
| Sichtbare/gestrichelte Konturen | tatsächliche Mesh-Kanten, breite Linien, screenabhängige Strichparameter | `QQuick3DGeometry` für Linien-Dreiecke + unbeleuchtetes `CustomMaterial` mit Dash-/Pixelbreitenlogik | **B/C.** Nicht auf plattformabhängige Hardware-Linienbreite verlassen. Finaler nativer Konturshader fehlt. |
| Ghost-Occlusion/verdeckte Schultern | `ghost-depth-policy.js`, explizite Prioritäten, `GreaterDepth` für verdeckte Fragmente | Qt 6.12 `RenderPass`, gemeinsame/preservierte Depth-Attachment, `RenderablesFilter`, `PipelineStateOverride` mit `Greater`, Depth-Write aus | **B/C.** APIs seit Qt 6.11 vorhanden. Gezielter Zusatzpass im bestehenden View, keine neue Rendering-Architektur. `AlwaysDepthDraw` allein genügt nicht. Original-Rig/Backend-Test offen. |
| Hintergrund-/Alpha-Edge-Compositor | `silhouette-composite.js`: 8-Nachbar-Alpha, zwei Radien, profilabhängige Tinte, premultiplied SourceOver | vorhandenes `View3D`-Offscreen-Ergebnis + `ShaderEffect` mit `.qsb` oder Quick3D `Effect` | **B/C.** Shader muss Pixelgröße, Farbraumkonversion und Premultiplikation bewahren; kein Standard-PBR-Effekt. Zielbackend-Bild-/Kostenvergleich offen. |
| GPU-Wiederverwendung | ein Rig/RenderTarget, Hintergrund-Blits, bewiesene Geometriegleichheit/Instancing | Offscreen-`View3D`/Texture-Provider, gemeinsame Geometrie, `Instancing` bei gleichen Materialzuständen | **A/B/C.** Ohne CPU-Readback umsetzbar; Anzahl zusätzlicher Draws/Attachments und D3D11-Performance noch messen. |

## 4. Abgleich mit den bestehenden nativen Vorarbeiten

Untersuchte Dateien im gepinnten [ExoSnap-Stand](https://github.com/Exoridus/exosnap/tree/f4a338493f42d85fff421abf3ee091d899a1380e):

- `app/quick/ExoSnap/Quick/GamepadArtwork.cpp`: vorbereitetes SVG, Masken und explizite `clipPath`-Anpassung für Qt SVG.
- `app/quick/ExoSnap/Quick/GamepadSprites.cpp`: `QSvgRenderer`/`QPainter`, Idle-/Pressed-/Knockout-Tiles, Atlas bis 4096², premultiplied Rasterisierung und anschließende Konvertierung/Edge-Extrusion. Diesen bestehenden Pfad erweitern; nicht pro Eingabeframe neu rasterisieren oder Texturen hochladen.
- `app/quick/ExoSnap/Controller3D/ControllerScene.qml`, `ControllerStick.qml`, `ControllerState.*`, `ControllerMechanics.*`, `ControllerGeometry.*`: View3D, mechanische Nodes und generierte Geometrie existieren. Original-OBJ-Modell, finale weiße Feedback-Palette, HDRI, Oberflächentinte und Kontur-Compositor sind damit nicht schon integriert.

Die vorhandenen Lab-Referenzen bleiben erhalten. `qt-quick3d-port/ControllerSurface.qml` ist eine Materialreferenz, kein fertiger Port. Sie enthält noch historische blaue Defaults und schaltet Deckkraft bei `pressedAmount > 0.001` binär auf 1; `pressedOpacity` wird dort nicht ausgewertet. Für kontinuierliche native Trigger-Parität muss diese vorhandene Referenz auf die finale skalare Regel abgeglichen werden. Die Probe überschreibt die Farbe explizit mit Weiß und prüft die Endzustände, **nicht** eine bereits korrekte Zwischenwert-Kurve.

## 5. Nachweise und Grenzen

`npm run verify`: 433 Tests, 0 Fehler, 0 übersprungen. Neue Tests sichern neutrale Fläche gegen Kontur, Face-Kontrast/Deckkraft, beide Originalsupports, unveränderte Geometrie/Hierarchie/Depth und erhaltenes Instancing sowie unveränderte Hardwarefarben von Joy-Con, Switch Pro und Xbox ab. Die neuen Fehlerbilder wurden vor der Korrektur rot reproduziert.

Browser: `capture-visual-finish.mjs` prüft Demo OFF und echte Null-Eingaben für Neutralaufnahmen; 0/30/70/90 % Transparenz × neutral/gedrückt/bewegt/bewegt+Klick × drei Hintergründe. Zusätzlich beide Supports aus vier Kameraperspektiven, Originalmaterial und Markings aus/an. Die bestehende breite Controller-Matrix und automatische Demo-/Mechanik-Abnahme laufen weiterhin.

Native Proben: `qt-port-example/verify_portability.py` verwendet Qt 6.12.0/PySide unter Xvfb mit softwaregerendertem OpenGL, **nicht** den Qt-Quick-Software-Scenegraph. Es rendert die 48 aus der echten Lab exportierten SVG-Zustände, prüft getrennte Masken-/Center-Alpha und `QPainterPath`-Subtraktion sowie vier Zustände der vorhandenen `ControllerSurface.qml` in Quick3D. Das ist kein Build der vollständigen ExoSnap-Anwendung und kein D3D11-/Metal-/Vulkan-Paritätsbeleg.

**Laufergebnis und Provenienz:** Der PR-Abnahmelauf veröffentlicht `browser-probe.log`, `qt-fixtures/manifest.json` und `qt-native/native-report.json` gemeinsam mit den echten Renderbildern. Der Bericht nennt die tatsächliche Qt-Version und die getestete Commit-Revision. Ein fehlender oder fehlgeschlagener nativer Bericht ist kein Nachweis. Keine implizite Freigabe der noch nicht implementierten Shader-/Depth-Pass-Kombination.

Für die native Integration bleiben als gezielte Abnahme: Original-Rig und UV-/Normalenbasis; kontinuierliche Press-Alpha; transparente Überdeckungen in mehreren Blickwinkeln; sichtbare/verdeckte Konturen; Oberflächenaufdrucke; Compositor-Farbraum/Alpha; beliebige Videohintergründe; D3D11-GPU-Kosten. Diese Punkte rechtfertigen keine weitere Browser-Designstudie, wohl aber eine ehrliche native Integrationsabnahme.

## Offizielle Qt-Grundlagen

Geprüft am 2026-11-08; versionierte APIs und tatsächlicher Zielstand haben Vorrang vor allgemeinen Portabilitätsannahmen.

- [SVG-Feature-Tabelle](https://doc.qt.io/qt-6/topics-vectorimageformats.html), [QSvgRenderer](https://doc.qt.io/qt-6/qsvgrenderer.html), [QPainter](https://doc.qt.io/qt-6/qpainter.html)
- [PrincipledMaterial](https://doc.qt.io/qt-6/qml-qtquick3d-principledmaterial.html), [Material/Depth](https://doc.qt.io/qt-6/qml-qtquick3d-material.html), [CustomMaterial](https://doc.qt.io/qt-6/qml-qtquick3d-custommaterial.html)
- [SceneEnvironment/lightProbe](https://doc.qt.io/qt-6/qml-qtquick3d-sceneenvironment.html), [ShaderEffect und Alpha-/QSB-Vertrag](https://doc.qt.io/qt-6/qml-qtquick-shadereffect.html)
- [User-defined Render Passes](https://doc.qt.io/qt-6/qtquick3d-userpasses.html), [RenderPass](https://doc.qt.io/qt-6/qml-qtquick3d-renderpass.html), [PipelineStateOverride](https://doc.qt.io/qt-6.12/qml-qtquick3d-pipelinestateoverride.html)


## Cross-model consistency follow-up

See [MODEL_CONSISTENCY.md](MODEL_CONSISTENCY.md) for the shared semantic palette,
restored source provenance, geometry-aware support coverage, material-region
vertex channel and premultiplied nearest-surface target. The added 3D stages
require explicit Qt CustomMaterial/render-state work; prior API/capability
probes are **not** a native parity proof for these changes. `nativeValidated`
remains false. The existing QSvgRenderer/QPainter probe now receives fixtures
for every selectable paired model. No new runtime rasterization or render pass
is introduced by this follow-up.
