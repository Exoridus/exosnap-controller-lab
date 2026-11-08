# Qt Material Lab – v29.1 (diagnostische Erweiterung)

> Historischer Referenzstand. Für die aktuelle konsolidierte Lab gilt das [Visual-Finish-/Qt-Portabilitäts-Gate](docs/VISUAL_FINISH_QT_GATE.md). Insbesondere Aufdruckshader, verdeckte Konturen und Alpha-Edge-Compositor sind nicht durch Standard-PBR allein abgedeckt; native Teilproben sind keine vollständige ExoSnap-Parität.

## Ziel

Acht **echte 2D-SVG**-Materialvarianten mit **einem** Materialmix-Regler 0–100,
20 Controllerlayouts und den drei Hintergrundtypen Dark / Light / Mixed.
Die Hauptvorschau und ihre bestehenden WebGL-/Kontrast-Passes sind **unverändert**.
Die Varianten gehören zur **separaten Diagnosegalerie** und sind kein Freigabebeleg für 3D.

**Zu starten:** `qt-material-lab.html` per `npm start`, dann `http://127.0.0.1:8792/qt-material-lab.html`.
Alternativ die komplett offline funktionierende `qt-material-standalone.html` direkt öffnen.

## Warum Qt-kompatibel

Die Experimente verwenden nur:
- eine je Controller vereinfachte Modellfarbpalette (in `qt-material-presets.js`),
- lineare RGB-Mischung der Farben,
- Alpha-/Deckkraft-Mischung und normale Source-Over-Komposition,
- SVG-Pfade mit `fill`, `stroke`, `stroke-width`, `fill-opacity`, `stroke-opacity`,
- bei Dual-Tone zwei zusätzliche Pfadstriche derselben Silhouette,
- bei aktiven Buttons eine transparente blaue Fläche und **einen zusätzlichen Pfadstrich** (Schein-Glow ohne Blur),
- skalierte Vektorformen und vorhandene Joystick-Masken.

**Ausgeschlossen**: CSS-Filter, Blur, Multiply/Screen, Hintergrund-Pixelabfragen, Farbumkehr
pro Pixel, Custom Shader, GPU-Readback, separate 3D-/Postprocessing-Passes.

Qt 6 SVG unterstützt `<mask>`, aber nicht `<clipPath>`. Die Galerie konvertiert
existierende `clipPath`-Definitionen in weiße SVG-Masken. Das ist eine
Assetkompatibilitäts-Transformation, **keine zusätzliche Modellkopie**.
Die Varianten können alternativ in einer Qt-QPainter-Implementierung mit
vorberechneten `QPainterPath`-Geometrien und nativen `setClipPath`-Operationen
gezeichnet werden; dann ist keine SVG-Maskenverarbeitung nötig.

Qt-Nachweis im Paket: `qt-port-example` lädt einen exportierten SVG-Schnappschuss
mit `QSvgRenderer` und rendert mit `QPainter` auf `QImage`. Zum Bauen:

```bash
cmake -S qt-port-example -B qt-port-example/build
cmake --build qt-port-example/build
qt-port-example/build/exosnap-svg-proof qt-dualsense-frost-65.svg proof.png
```

Das Beispiel ist hier **nicht nativ kompiliert oder pixelweise mit dem Browser
verglichen**, da keine Qt-6-Entwicklungsbibliotheken vorhanden sind. Qt API-
Unterstützung und Formate wurden anhand der offiziellen Qt-Dokumentation
geprüft; **pixelgenaue Gleichheit** benötigt ein Cross-Renderer-Golden-Testset.

## Gemeinsame Slider-Logik

`t = value / 100`: `0 = Normal`, `0.5 = Glass`, `1 = Ghost`.
Dazwischen interpoliert `styleAt(t)` (bereits vorhandener v29-Code) mit
`k = x*x*(3-2*x)` innerhalb jeder Halbphase.

| Endpunkt | Shell-Alpha | Controls-Alpha | Materialidentität |
|---|---:|---:|---|
| Normal 0 | 1.00 | 1.00 | Modellpalette |
| Glass 50 | 0.26 | 0.62 | interpoliert |
| Ghost 100 | 0.06 | 0.36 | je Variante neutral/kühl/teilweise erhalten |

Varianten dürfen die Flächen unterschiedlich gewichten, **müssen aber immer**
`controlAlpha >= shellAlpha` und `activeAlpha >= controlAlpha` erfüllen.
Einheitliche Blaukonstante `QT_BLUE = #4b9fe3`. Nicht-gedrückte Controls werden
leicht transparenter; gedrückte bleiben zumindest im Ghost halbtransparent.
Spezielle Werte stehen vollständig in `qt-material-presets.js` und sind
mit Node-Tests für alle acht Varianten und 0–100 abgedeckt.

## Die acht Versuche

1. **Originalton** – Farbidentität länger erhalten; besonders bei farbigen Modellen.
2. **Graphit** – reiner, kontraststarker neutraler Ghost.
3. **Frost** – sehr zurückhaltender blau-kühler Ghost (ausgewählte Startvariante).
4. **Soft Fill** – höhere Flächenpräsenz, aber Controls weiterhin lesbar.
5. **Ink Ghost** – frühes Verschwinden der Flächen; Konturen bleiben sichtbar.
6. **Dual-Tone** – schmale dunkle Außen- und helle Innenkante mit denselben Pfaden.
7. **Szenenprofil** – feste Hell-/Dunkel-Farben für bekannte Bühnen, **kein**
   adaptiver Zugriff auf beliebige Videoframes.
8. **Entsättigt** – Interpolation zur Helligkeits-Graustufe; kein Multiply.

Die Varianten sind absichtlich **diagnostische Alternativen**, keine acht
parallel gerenderten Effekte im fertigen ExoSnap-Overlay.

## Performance und Einbau

- 2D: Geometry und Semantic IDs einmal laden, Konturen in Qt einmal vorberechnen;
  pro Slideränderung nur Brushes, Pens, Deckkraft ändern und einmal neu malen.
- Ein einzelner 2D-Canvas/`QQuickPaintedItem`/`QWidget` genügt im Produkt.
- Für Video-Backdrops keine Pixelabtastung; Dual-Tone ist der konservative Default.
- 3D: Farben/Alpha im normalen Material pro Objekt ändern. Für Outline nur
  bereits bekannte Konturgeometrie verwenden, wenn vorhanden. **Echtes Fresnel-
  Lighting ohne shaderbasierte Beleuchtung ist nicht dieselbe Funktion**;
  dafür würde ich für diese Qt-portable Varianten bewusst keine Gleichheit
  versprechen. Qt Quick 3D bietet Standardmaterialien für Farbe und Opazität,
  aber deren PBR-Pipeline ist nicht pixelgleich zu WebGL.

## Grenzen

- Original-SVGs sind überwiegend weißes Linienartwork, nicht verifizierte
  farbige Herstellermaterialien; die Normal-Paletten sind ausdrücklich
  **annähernd**. Ein echter weiß/schwarzer DualSense-Innenbereich erfordert
  getrennte semantische Farbflächen, die nicht alle SVG-Quellen besitzen.
- Beim 3D-/2D-Vergleich sind Modellgeometrie, Rasterantialiasing, Masken und
  Materiallichter getrennt zu prüfen. Die Galerie zeigt nur echte 2D-Stufe.
- `Dual-Tone` benötigt zwei Vektorkonturstriche, aber keinen Bildschirm-Effektpass.
- Weitere Mix-Presets sollten zunächst im Diagnose-Lab bewertet werden und erst
  nach visueller Abnahme in den Produkt-Default gelangen.
