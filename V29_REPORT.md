# Controller3D Lab v29 RC1 – Änderungen und offene Abnahme

Stand: 3. November 2026. Basis: `ExoSnap_Controller3D_Lab_v28_1_KOMPLETT_LAUFZEITFIX(1).zip` (0.28.1).

## Ergebnis und Beweisgrenze

**Vollständiger, technisch korrigierter Release Candidate; keine visuelle Freigabe des 3D-Systems.** Die verlangte tatsächliche 3D-Abnahme ist blockiert. Grüne Node-Tests und SVG-Bilder werden ausdrücklich nicht als Ersatz ausgegeben.

Der Browser wurde über eine unterstützte interne HTTP-Vorschau gestartet. Schon die unveränderte v28.1 scheitert beim Erzeugen des `THREE.WebGLRenderer`. Die unabhängige Prüfseite fordert WebGL 2 und WebGL 1 jeweils mit Standardoptionen, Antialias/Alpha und Low-Power ohne Performance-Caveat an. Alle sechs liefern `context:false`, `GL_VENDOR=Disabled`, `GL_RENDERER=Disabled`, `BindToCurrentSequence failed`. Ein lokales Chromium fehlt ebenfalls, sein Download war gesperrt. Browsersperren wurden nicht umgangen.

Die tatsächliche SVG-Stufe wurde dagegen im Browser bedient, aufgenommen und angesehen. Diese Bilder sind als **Source Stage vor Rasterisierung und WebGL-Compositing** gekennzeichnet. Sie ersetzen keine 3D-Aufnahmen.

## A. Schwebende 3D-Sticks

Die originale DualSense-Baugruppe ist vollständig: `*_stick.obj` enthält Basis, Schaft und Kappenunterseite; `*_ring.obj` bildet die bewegliche äußere Gummiwand; `*_cap.obj` ist der kleine innere Einsatz. Das Manifest setzt beide Kinder an den vorhandenen Ring/Pivot.

Beide Verbindungen besitzen jeweils **24 exakt zusammenfallende Quellvertices**. Die Schaft-/Ring-Verbindung liegt bei nativem Y `0.176291`, die Ring-/Einsatz-Verbindung bei Y `0.216129`. Der bisherige Shared-Stick-Code ersetzte den kleinen Einsatz durch eine neue vollständige parametrische Kappe, ließ die ursprüngliche Außenwand bestehen, ergänzte einen künstlichen Torus an einer anderen Höhe und entfernte die Press-Zuordnung des Schafts.

Modelle mit `authoredCapAssembly` behalten nun Originalgeometrie und Manifest-Hierarchie. Dafür werden weder Ersatzkappe noch Torus erzeugt. Der stationäre Gehäusebereich bleibt im ursprünglichen Shell-Mesh. Ring, Schaft und Einsatz teilen LS/RS-Zuordnung, Cap-Materialgruppe, Rauheit, Alpha und Press-Farbe.

Die Tests laden **die beigelegten OBJ-Dateien durch die tatsächlichen Loader-/Rig-Funktionen**. Beide Sticks werden neutral, in acht maximalen Richtungen, bei übergroßen diagonalen Eingaben, mit und ohne Click-Travel sowie nach Rückkehr in Neutral geprüft. Die Verbindungen bleiben geschlossen, die konfigurierte radiale Auslenkung bleibt bei 14°, die Shell bleibt fest.

**Grenze:** Kein vollständiger Dreiecks-Kollisionstest der ganzen Shell und keine Sichtabnahme. Seitenansicht, mögliche Durchdringungen und räumliche Lesbarkeit müssen im echten WebGL-Renderer beurteilt werden.

## B. 2D bleibt frontal

Die unteren Panels wurden bisher mit der orbitierenden Perspektivkamera gerendert. Sie haben jetzt eine orthografische Frontkamera. Deren Bildhöhe folgt Abstand/FOV beziehungsweise orthografischem Zoom der 3D-Kamera. Pan wird in deren Bildschirmbasis übernommen und akkumuliert, damit ein nachfolgender Orbit die bereits verschobene Referenz nicht erneut dreht. Ein Reset des Orbit-Ziels setzt auch das 2D-Pan zurück.

Oben bleiben eine gemeinsame 3D-Kamera, ein Rig und ein Eingabestrom erhalten. Tests prüfen feste Frontorientierung bei Orbit, Zoom, Pan nach einer Seitenansicht und Reset. **Der gesamte Mausablauf in der sechsfachen WebGL-Vorschau ist noch blockiert.**

## C. Fehlende untere 2D-Sticklinien

Die Linien sind in den Original-SVGs vorhanden. Der alte Update-Pfad überschrieb die Transformation der geklonten Knockout-Ellipse. Die linke Maske verlor ihre Rotation und verschob sich von `(183.650, 222.506)` nach ungefähr `(183.182, 235.447)`. Damit schnitt sie die unteren Gehäuse-/Stickkonturen ab.

Daneben las die helle Variante nur `1024` Spalten der `2048` Pixel breiten Rastertextur. Die rechte Hälfte wurde nicht übertragen. Die frühere Mindest-Strichbreite traf sechs andere dünne Artwork-Elemente und löste den Maskierungsfehler nicht.

Nun bleibt die Originaltransformation auf der Form erhalten; nur ihre übergeordnete Gruppe bewegt sich. Die helle Textur verarbeitet die volle Breite, die pauschale Strichverbreiterung entfällt. Der Original-SVG-Hash bleibt:

`c9bb4dc84b225fca7a23470192e1cec99562b1993ff99b67e13bd9aee796b040`

Die echten Vorher-Bilder zeigen abgeschnittene untere Linien; die korrigierte SVG-Stufe zeigt die Bögen wieder. Neutral, maximale Abwärtsbewegung und maximale diagonale Bewegung mit Press-Zuständen wurden bei 240×160, 320×214 und 480×320 CSS-Pixeln angesehen. Die Flächengrößen wurden im DOM gemessen.

**Zusätzlicher Befund aus der Sichtprüfung:** Options/Create färbten nur das kleine Symbol ein. Der kombinierte CSS-Selektor wählte den ersten Pfad in Dokumentreihenfolge statt der Buttonfläche. Der gezielte Vorrang für `btn-view-face`/`btn-menu-face` verändert genau vier Zuordnungen: zwei Buttons bei DualSense und DualSense Edge. Die nun blauen Buttonflächen sind in den finalen Press-Screenshots sichtbar. Andere Zuordnungen der 20 SVGs bleiben unverändert.

**Grenzen:** Die SVG-Galerie beweist weder endgültige Texturfilterung noch Modellgröße im WebGL-Panel. Auf hellen Bereichen des gemischten Racing-Hintergrunds bleiben die originalen weißen Linien stellenweise schwach. Dies ist keine abgeschlossene Kontrastabnahme.

## D. Unerwünschte untere Kante

Der alte Schatten entstand aus einer konvexen Hülle projizierter Shell-Vertices. Diese überbrückt die Einbuchtung zwischen den Griffen. Der nach unten versetzte unscharfe Rand konnte deshalb eine künstliche untere Verbindung zeichnen. Der DOM-/SVG-Hüllenpfad und die alte Bodenellipse sind vollständig entfernt.

Die Ersatzkandidaten verwenden die physische Pixelabdeckung der tatsächlich sichtbaren Geometrie. Es entsteht keine zusätzliche Schattengeometrie. **Die Fehlerquelle ist entfernt; das endgültige Renderbild konnte noch nicht geprüft werden.**

## Kontrastvergleich: implementierte Kandidaten, keine abgenommene Auswahl

Die Diagnosegalerie hält Originalmeshes, Kamera, Lichtquellen, Material-Mix und Eingaben gleich. Dark/Light/Mixed stehen nebeneinander; alle drei geforderten Größen sind exakt wählbar. Die enthaltenen Arena-/Racing-SVGs sind **synthetische Spielreferenzen**, keine echten Gameplay-Aufnahmen.

| Variante | Ansatz | Noch visuell zu prüfen |
|---|---|---|
| A | Schmale dunkle Außenkante und feinere helle Innenkante | Konturdopplungen bei 240×160 |
| B | Kleine, weich versetzte Silhouetten-Abschattung | Trennung in sehr dunklen Bereichen |
| C | Weiche dunkle Silhouettenkante ohne Dreieckskanten | Schärfe der kleinen Darstellung |
| D | Oberflächen-Fresnel/Rim plus dunkle Gegenkante | Verhältnis zwischen Formlicht und dunkler Trennung |
| E | Lokale GPU-Hintergrundabtastung für Hell-/Dunkelgewichtung | Unruhe auf kontrastreichen Details |

**Es gibt keinen ausgeführten visuellen A–E-Vergleich und keinen abgenommenen Gewinner.** D ist nur die vorläufige RC-Voreinstellung. Eine optische Begründung für die endgültige Wahl wäre ohne Bilder nicht seriös. E arbeitet ausschließlich mit den bekannten Lab-Hintergründen; kein Zugriff auf beliebige Desktop-/Videohintergründe wird behauptet.

### Technischer Aufwand

Der bestehende Rig rendert unveränderte Geometrieobjekte in eine RGBA-Maske: Control-ID, Press-Stärke, Control-/Shell-Zuordnung, Silhouettenabdeckung. Kappe, Ring und Schaft teilen eine ID; Shell-Teile ebenfalls. Innere Gehäusenähte und einzelne Dreieckskanten werden dadurch nicht absichtlich hervorgehoben. Nearest-Depth entscheidet über sichtbare Flächen; die bisherigen farblosen Tiefen-Proxys der Hauptdarstellung bleiben bestehen.

Für drei gleich große 3D-Panels entsteht **ein zusätzlicher einfacher Geometriepass pro Frame**, den alle drei verwenden, plus **drei bildschirmfüllende Dreiecke** zur Komposition. Die bisherigen drei 3D-Farb- und drei 2D-Pässe bleiben bestehen. Keine zweite Controller-Szene, keine Geometrieerzeugung bei Material-Slidern, keine CPU-Readbacks im Kontrastpfad. Maskenpuffer werden nur bei Größenänderungen neu dimensioniert. RGBA8 benötigt bei 480×320 und DPR 1 rund 0,59 MiB für die aufgelöste Farbtextur; Depth und angeforderte MSAA-Puffer kommen hinzu. GPU-Zeiten wurden nicht gemessen.

Der unabhängige Code-Review fand und korrigierte vor Auslieferung doppelte DPR-Skalierung des Masken-Viewports, eine Verwechslung von MSAA-Abdeckung mit Control-ID-Grenzen und fehlendes `autoClear`-Restore nach einem Composite-Fehler. Der Rücksetzpfad wird am echten Pass-Objekt getestet. Shaderkompilierung und Pixelresultate bleiben offen.

Der abschließende Startpfad-Review fand außerdem eine verwaiste `shadow.visible`-Zuweisung in der Hintergrundinitialisierung. Nach dem Entfernen der alten Schattengeometrie hätte sie einen `ReferenceError` ausgelöst. Der WebGL-Kontextfehler dieser Umgebung verdeckte diesen nachgelagerten Fehler. Die Zuweisung ist entfernt; ein zusätzlicher Regressionstest führt die tatsächliche Hintergrundfunktion ohne Legacy-Schattenobjekt aus. Auch dieser Befund zeigt, weshalb Syntax- und Node-Tests keine vollständige Browserabnahme ersetzen.

## Tests

Die unveränderte Ausgangsbasis bestand 243/243 Node-Tests. Der abschließende vollständige Lauf mit `npm run verify` unter Node v24.22.1 besteht **261/261 Tests**: 0 Fehler, 0 abgebrochen, 0 übersprungen, 0 Todo; Exit-Code 0. Der vollständige aktuelle Lauf steht in `evidence/node-verify.log` und `evidence/test-summary.json`. Keine Tests wurden übersprungen oder deaktiviert.

Bestehende Tests wurden nur bei ersetzten Verträgen geändert: Der konvexe Shadow-Cache existiert nicht mehr; geprüft werden jetzt leerer/geladener Masken-Pass und Zustandswiederherstellung. Den Test der pauschalen Strichverbreiterung ersetzen vollständige Rasterübertragung und unveränderte Strichbreiten. Neue Tests prüfen reale OBJ-Verbindungen, Materialgruppe, feste 2D-Kamera, Knockout-Transformation und die tatsächlichen Options/Create-Flächen.

Die SVG-Seite erzeugte keine anwendungsbezogenen Browserfehler. Ein Rohprotokoll-Eintrag zur Metadatenübermittlung stammt von der Browser-Erweiterung, nicht vom Lab. Für den WebGL-Pfad lautet das Ergebnis ausdrücklich **BLOCKIERT**, nicht „0 Runtime-Fehler“: Die Ausführung kommt nicht bis zum Laden und Kompilieren der neuen Pipeline.

Alle 70 mit der Ausgangsbasis verglichenen Modell-/Referenzdateien sind unverändert; siehe `evidence/source-asset-integrity.json`.

## Offene Freigabepunkte

1. Echte 3D-Front-, Dreiviertel-, Seiten- und Stick-Nahaufnahmen mit beiden maximalen Stickposen.
2. Tatsächliche Depth-Occlusion, transparentes Idle, aktive blaue Controls und Material-Mix in einem WebGL-fähigen Browser.
3. A–E-Bildvergleich in allen drei Größen; danach endgültige Wahl aus höchstens zwei Techniken.
4. Volle 3D-/2D-Parity im Hauptfenster: Maus-Orbit, Zoom/Pan, Acht-Richtungs-Automatik.
5. Helle Abschnitte im gemischten 2D-Hintergrund und endgültige Sampling-Lesbarkeit.
6. Live-Controller und GPU-/Treiberleistung sind nicht an Hardware geprüft. Weitere 3D-Modelle sind nicht durch die DualSense-Prüfung freigegeben.

Die lokale Vergleichsgalerie und der deterministische Screenshot-/Runtime-Matrixlauf bereiten diese Prüfungen vor. Die Konfiguration enthält **170 geplante Aufnahmen**: 45 neutrale A–E-Vergleiche, 9 Press-Vergleiche mit D, 96 Stickansichten, 4 Stick-Click-Ansichten und 16 Hauptfensterfälle. Die Konfigurationsvalidierung bestand; die 170 Bilder wurden wegen des Browserblockers nicht gerendert. Die tatsächliche Screenshot-Galerie enthält 12 angesehene SVG-/Blockeraufnahmen, einschließlich historischer Vorherbilder. Sie sind keine vorgetäuschten erfolgreichen 3D-Ergebnisse.
