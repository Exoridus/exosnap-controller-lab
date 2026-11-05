# ExoSnap Qt Material Lab – technischer Nachweis

**Erweiterung des vorhandenen v29 RC1, keine v30-Fortsetzung.**

## Ergebnis

- 8 vordefinierte Materialvarianten × 3 Szenenhintergründe = 24 echte
  2D-SVG-Lab-Panels. Dasselbe Original-SVG in allen Panels.
- Nur ein `input[type=range]` im Vergleichslabor, der eine Mix-Wert steuert
  die gesamte Variantenmatrix. Controllerwahl, Panelgröße und Press-Checkbox
  sind zusätzliche Bedienelemente, aber keine Effektregler.
- Mix 0 Normal, Mix 50 Glass, Mix 100 Ghost; vorhandene `styleAt`-Kurve.
- Controls bleiben bei jeder Variante mindestens so opak wie die Shell.
- Gleiches Press-Blau `#4b9fe3`, aktive Controls werden in Ghost nicht
  pauschal voll deckend. Keine CSS-Filter/Glow-Blur/Multiply-Algorithmen.
- Echte SVG-Originalformen; keinerlei generierte Controllerbilder.
- Export des aktuell markierten Verfahrens als direkt ladbares SVG.

## Verifiziert

- `npm run verify`: **269 Tests bestanden**, 0 Fehler / 0 übersprungen,
  Exit-Code 0 (vgl. `evidence/qt-materials/node-verify.log`).
- Chromium 144, Offline-Assets, echte DOM-SVG-Zeichnung:
  **20 von 20 Controllerlayouts** gewechselt und mit je 24 SVG-Ansichten
  dargestellt; keine PageErrors / Konsolenfehler.
- 240×160, 320×214 und 480×320 CSS-Panelgrößen geprüft.
- Mix-Werte 0,10,25,50,65,75,90,100 auf allen 24 Panels geprüft.
- Controls-Deckkraft ≥ Shell-Deckkraft bei jedem Browser-Mix-Wert.
- Exportieren-Schaltfläche tatsächlich betätigt; die erzeugten
  DualSense-/Xbox-Series-SVGs als XML geparst, `clipPath` entfernt,
  keine `filter`- oder `script`-Elemente.
- Browseraufnahmen wurden tatsächlich geöffnet und visuell geprüft:
  Normal, Ghost, Glass, gedrückte Xbox-Controls und GameCube.
- **Keine Qt-6-Kompilierung und kein Qt-Pixelvergleich**, da native Qt-6-
  Entwicklungsbibliotheken nicht verfügbar sind.
- **Keine 3D-Abnahme dieser Varianten**. Die bestehende Hauptvorschau und
  ihr WebGL-Kontrastpass sind unangetastet.

## Sichtprüfung

- Normal: auf hellen Flächen klare Konturen, verschiedene Modellpaletten
  für Shell und Controls. Die Farben sind nur Annäherungen.
- Ghost: hellen und gemischten Szenen bleiben fein; die feine Innensymbolik
  kann bei 240×160 noch zu schwach sein. Dual-Tone ist kontrastreicher,
  auf dunkler Szene jedoch stellenweise etwas doppelt.
- Mixed: weiße Linien und sehr helle Details konkurrieren teilweise mit
  Fahrbahn- und Himmelbereichen. Das ist kein gelöstes adaptives
  Hintergrundkontrastproblem; die Szenenvariante ist nur manuell bekannt.
- Xbox Press: blaue Flächen und D-Pad-Cross lesbar, aber aktive Trigger
  visuell stärker als andere Bedienelemente. Weiterer optischer Feinschliff
  in Qt-/Produktoberfläche ist sinnvoll.
- GameCube: separate Silhouettengeometrie sichtbar, Materialmix stabil;
  ursprüngliche grafische Zoneneinteilung bleibt unzureichend für
  authentische Herstellerfarben.

## Bibliothek

`qt-material-standalone.html`: Eigenständige HTML-Datei mit allen Original-
SVGs, Mappings und benötigten JS-Modulen inline, dadurch ohne Server nutzbar.
Die Browserprüfung erfolgte mittels `page.set_content` desselben HTML,
weil diese Browserumgebung direkte localhost-/file-Navigation blockiert.
Es handelt sich um echte Browserdarstellung, nicht um generierte Bilder;
**die konkrete Datei-Navigation per Doppelklick wurde nicht separat ausgeführt**.

`qt-material-lab.html`: dieselbe Galerie als Datei im vollständigen
Lab-Paket, über `npm start` erreichbar.

`QT_PORT.md`: mathematischer Mix-Vertrag, Qt-Primitiven, Port-Anleitung
und Grenzen.
