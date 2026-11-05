# Controller3D Lab v28 – fokussierte Korrekturen

- **UI:** Halo-, Schatten- und Kontur-Slider entfernt; keine neuen Bedienelemente. Gehäuse, Controls, Kantenlicht und Material-Mix bleiben, ebenso die sechs synchronisierten Panels und synthetische Testeingaben.
- **3D-Separation:** v27 hatte zwei SVG-Silhouetteneffekte (flächigen Shadow und Halo). v28 verwendet einen einzigen festen, leicht versetzten und weichgezeichneten Schatten außerhalb der projizierten Gehäusesilhouette. Kein Schattenparameter oder separater Halo.
- **2D-Parity:** Canvas-Textur 1024→2048, nur sechs (<0,48) sehr dünne sichtbare Stroke-Elemente des DualSense werden in der geklonten Raster-Vorlage auf 0,48 begrenzt; `references/controllers/dualsense/source.svg` bleibt mit identischem SHA256 `c9bb4dc84b225fca7a23470192e1cec99562b1993ff99b67e13bd9aee796b040`. Diese Vorschau-Kompensation ist nicht Teil des produktiven 2D-Artworks.
- **Eigene Tests:** Syntaxprüfung erfolgreich, 12/12 gezielte v25/v26/v27/v28-Tests erfolgreich. Historisch 229/241 bestanden, 12 Fehltests mit alten Erwartungen. Bitte diese nicht als grüne Komplett-CI interpretieren.
- **WebGL-Befund:** Ein echter v28-Browseraufruf wurde mit `ERR_BLOCKED_BY_ADMINISTRATOR` verhindert. Ein SVG-Bildvergleich mit CairoSVG war erfolgreich, ersetzt aber keine echte sechsfach-WebGL-Abnahme. Nicht als visuell freigegeben markieren.
- **Bedienung:** `start.cmd`, http://127.0.0.1:8789/. Kamera und Testpose bleiben über alle sechs Ansichten synchron.
