# ExoSnap Controller3D Lab v40 – technische Übergabe

**Basis:** Vollständiges v39-Archiv, unveränderte Original-DualSense-OBJ/SVG-Assets. Die Eingangsreferenzen sind die zwei vom Benutzer gelieferten v39-Screenshots in `evidence/v40/v39-user-reference-*`; sie sind **keine** neuen v40-Rendererbilder.

## Implementiert

- **6×4-Grid unverändert breit:** vier unabhängig zuschaltbare Looks; je sechs Viewports nebeneinander (3D dark/light/mixed, 2D dark/light/mixed). `main` scrollt horizontal; bei Mauszeiger über einem 2D-/3D-Panel wird Wheel ausschließlich zum synchronen Zoom und verhindert vertikales Seiten-Scrolling an dieser Stelle; Shift+Wheel = horizontal. Außerhalb normale Seitenbedienung. Canvas bleibt ein gemeinsamer WebGL-Renderer.
- **Background-aware GPU-Silhouette:** `silhouette-composite.js` ersetzt den bisherigen reinen Blit durch einen schmalen kantenbewussten Blit: auf Weiß dunkel, auf Dunkel hell, auf Mixed zweifarbig. Die vier Varianten verwenden weiterhin je einen einzigen 3D-Render für ihre drei Hintergründe. Die frühere vergrößerte Backface-Outline wird im Vergleich deaktiviert (keine Doppelkontur).
- **Schutz der Originalfarben:** Im Hintergrundcompositor werden nur Pixel mit schwachem Alpha gedämpft; voll deckende pressed-Controls erhalten weder Farb- noch Alphakorrektur. 2D-Hell und Mixed erhalten etwas kräftigere Flächenfüllungen und unveränderte SVG-Glyphen.
- **3D Occlusion:** bewegliche Stickkappe/-ring/-schaft schreiben ihre Tiefe vor dem festen Well. Die vollständigen hinteren Trigger/Paddles werden im Front- und Dreiviertel-Ghost unterdrückt, statt durch das Gehäuse zu mischen. Bei Seiten-/Rückansicht werden sie wieder als physische Geometrie freigegeben; optional gestrichelte `GreaterDepth`-Hints bleiben.
- **Beschriftete 3D-Face-Buttons:** auf originalen DualSense-OBJ-Buttons liegen vier 2-Triangle-Textur-Decals mit Kreuz, Kreis, Dreieck und Quadrat. Die Texture wird beim Laden erstellt, nicht pro Frame.
- **2D-Scale:** die 2D-Referenzen belegen 86 % des Panels und reagieren auf dieselbe Zoomsteuerung wie die 3D-Modelle; kein 2D-Orbit.

## Verifikation

- `npm run verify`: **344 PASS, 0 FAIL, 0 SKIP**, auch aus frischer ZIP-Extraktion.
- ZIP-Integrität: `unzip -t` fehlerfrei.
- HTTP-Smoke aus frischer Extraktion: **14/14** gültige Start-, Modell-, HDR-, CSS-, ES-Modul- und Qt-Rezeptdateien (`evidence/v40/http-smoke.json`).
- Echte 3D-WebGL-Browser-Sichtabnahme: **nicht erfolgt**. Chromium verweigert sowohl HTTP- als auch `file://`-Navigation mit `net::ERR_BLOCKED_BY_ADMINISTRATOR` (siehe `evidence/v40/browser-blocker.txt`). Kein Shader-Compile-, Glow-, AA-, Farb-, Geometrie- oder Qt-Renderbild darf als bestätigt ausgegeben werden.

## Grenzen / Freigabepunkte

1. Auf einem WebGL-fähigen Gerät 4 Looks bei 240×160, 320×214, 480×320 auf Dark/Light/Mixed anschauen, vor allem Schattenkante, Deckkraft und Glyph-Kontrast.
2. L1/R1/L2/R2 bei Front, 3/4, Seite und Rückseite samt gestrichelten Hints sowie beide Stickkappen in den maximalen acht Richtungen prüfen.
3. Qt Quick 3D `QML`-Materialeinstellungen können die HDR-Leuchtprobe übernehmen; der neue Silhouetten-Blit benötigt aber **einen eigenen Compositor-Shader** (siehe `QT_V40_COMPOSITOR.md`). Native Qt Parität und Performance wurden nicht gemessen.
4. Performance-Vergleich: Das zusätzliche Verfahren ändert **keine 3D-Mesh-Draws**, aber liest ~16 benachbarte Pixel pro 3D-Kompositionsbild; außerdem vier kleine Glyph-Planes. Auf echtem GPU-Profiling prüfen.

**Status:** technisch geprüfter Release Candidate, keine visuelle Finalfreigabe.
