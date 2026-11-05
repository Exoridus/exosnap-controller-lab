# v37 Änderungs- und Verifikationsbericht

## Fehlerursache v36

`look-matrix.html` enthielt eine Kaskade von `iframe`-Instanzen, die komplette Viewer-Dokumente, eigene Toolbars und mehrere Three.js-Runtimes in schmale Kacheln zwängte. Das war keine Ansicht mit sechs echten Panels pro Look. Zusätzlich blieb das 3D-Pressmaterial im Ghost trotz aktiver Farbe unter Opacity 1 (in v36 bis etwa 0,90); die 2D-Darstellung benutzte ebenfalls alpha-gemischtes Blau. Das sichtbare Ergebnis war zu dunkel und wirkte kaum aktiv.

## Korrekturen

1. **Eine Seite / ein Renderer**: `pbr-lab.html` erzeugt genau zwei Ziel-Looks in echten 6-Spalten-Zeilen. `pbr-lab.js` erzeugt sechs direkte Panels pro Look, mit einem WebGL-Canvas und nativem SVG-DOM. Kein `iframe` und keine eingebettete zweite App.
2. **Entfernte Zwischenoberflächen**: `index.html` öffnet standardmäßig den Direktvergleich. `look-matrix.html`, `labs.html` und `showcase.html` führen zu derselben Ansicht. Historische Quellseiten sind noch vorhanden, aber nicht in der Hauptoberfläche.
3. **Look-Schalter**: Zwei Checkboxen blenden Solid und Ghost ein/aus, und die Renderarbeit versteckter Zeilen wird ausgelassen. Materialmix, Kamera und Presszustand sind für sichtbare Zeilen gemeinsam.
4. **Opaker LED-Presszustand**: `palette.js`, `pbr-recipes.js`, `pbr-appearance.js`, `material-paint.js`, `controller-reference.js` nutzen dieselbe Press-Oberfläche `#79bdff`. 3D-Emission `#a9e1ff`, Intensität 1.05; 2D aktive Randfarbe `#eefaff`, ohne `drop-shadow`-Filter. Press-Alpha ist 1.0, Idle bleibt transparent.
5. **Qt-Port-Referenz**: `qt-quick3d-port/ControllerSurface.qml` und JSON-Rezeptausgabe haben dieselbe Blau-/Emissions-/Deckkraftdefinition. Der Port muss weiterhin gesondert gebaut und visuell kalibriert werden.
6. **Geometrie und Tiefenverdeckung**: Die Original-OBJ-Dateien und 2D-Quell-SVGs wurden nicht verändert. Optimierte Meshstruktur und vorhandene V35-Tiefenpolitik bleiben erhalten. Keine neue Schattengeometrie, keine neuen Framebuffer-Effekte.

## Verifikation

- Gezielt v37: RED vor Implementierung bei opaker LED-Pressfläche und verschachtelter Matrix; GREEN nach Korrektur. Qt-LED-Referenz ebenso mit RED→GREEN.
- Vollständige Testsuite: **326/326 PASS**, keine Fehlschläge oder übersprungenen Tests; siehe `evidence/v37/verify.log`.
- Server-Smoketest: **13/13 HTTP-200** für Einstieg, Vergleich, Module, Stylesheets, OBJ-Datei und Original-SVG. Siehe `evidence/v37/http-smoke.json`.
- ZIP frisch entpackt und identisch geprüft; Testergebnis siehe `evidence/v37/package-verify.log`.
- Browser-/WebGL-Blocker: `ERR_BLOCKED_BY_ADMINISTRATOR` beim Seitenaufruf in Chromium sowie `getContext('webgl2') = null` auch unter SwiftShader; somit **keine visuelle 3D-Abnahme** behauptet.

## Noch offen

- Physisches Look-Review auf Dark/Light/Mixed bei 240×160, 320×214 und 480×320.
- GPU-Draw-Call-Messungen im tatsächlich laufenden Browser und native Qt Quick 3D-Parität.
- Endgültige Sichtprüfung der Tiefenverdeckung von Schultern und Stick-Wells aus schrägen Winkeln.
