# Controller3D Preview v25 — Implementierung und Prüfgrenzen

v25 ist eine gezielte Fortsetzung des verfügbaren v24-Pakets. v24 ging seinerseits aus v23.1 hervor und enthielt nicht den vollständigen v23.2-Quellstand. **Kein Release- oder native Qt-Änderungsstand.**

## Benutzeroberfläche

- Eine große interaktive **echte 3D-Szene** mit Orbit/Zoom/Pan.
- Controller-Auswahl (2D-only ausgeschlossen; Proxies explizit als 3D-Basis markiert).
- Modus `Vorschau` / `Controller (Live)`. Der Live-Modus bindet Gamepad-Buttons und -Achsen, sperrt aber weder Maus-Orbit noch Zoom.
- Hintergrund `Dunkel`, `Hell`, `Gemischt/Racing`, optional eigenes Bild.
- Drei Presets `Normal`, `Glass`, `Ghost` plus stufenloser Material-Mix-Regler; optionale fünf Detailregler.
- Alte Gyro-/Kalibrierungs-/Motion-/Tuning-/2D-Vergleichsoberfläche ausgeblendet. Die vorhandenen Module bleiben aus Kompatibilitätsgründen intern erhalten; das 3D-Lab ist keine neue native GameInput-Implementierung.

## Rendering-Vertrag

- Ein Modell und ein Rig werden beim Sliderbewegen **nicht** neu geladen. Farben, Opazität, Rauheit, Kantenlicht-Uniform und Konturstärken werden an vorhandenen Materialien aktualisiert.
- Ausgangswerte (base alpha): Normal Shell/Controls 100/100 %, Glass 52/74 %, Ghost 14/44 %, Ghost-Stickkappen 55 %.
- Weißes winkelabhängiges Rim-Licht besitzt ein eigenes Shader-Uniform. Sichtbares Shell-Alpha wird nicht mehr versteckt mit 0,35 multipliziert.
- Depth-only-Proxy bleibt physisch unabhängig vom sichtbaren Material. Materialüberblendung arbeitet ohne CPU-Readback.
- Hintergrundschatten wesentlich abgeschwächt; Ghost nur sehr leicht.
- Ausgewählte verdeckte Rear-Controls sind mit gestrichelter Tiefe-Kontur angedeutet und können bei Aktivierung blau hervorgehoben werden. Es entstehen dadurch keine physischen Eingabebindings.
- `GameCube` / `C-Stick` bleiben eigenständig.

## Stick-Korrektur

Die ursprünglichen 3dco+-`ring.obj`-Teile bei DualSense/Xbox One/Switch Pro sind bewegliche **Kappen-Seitenwände**, nicht starre Gehäusemulden. v24 hatte sie beim Shared-Stick-Umbau irrtümlich fixiert. v25 hängt `ring`, `stem` und `cap` an denselben beweglichen Pivot; die Gehäuseöffnung bleibt stationär. `attach()` übernimmt die World-Transforms vor dem Setzen des lokalen Base-Pose.

## Stand der Prüfung

- JS-Parser (`node --check app.js`) grün.
- Neue Style-Mix-, UI-Vertrags- und v24-Mechanik/Topologie-Tests grün.
- Voller historischer Testlauf: **206/222** bestanden. Die 16 Fehler enthalten 4 fehlende Three.js-Abhängigkeit-/Importprobleme; die übrigen betreffen alte DOM-/Default-/Motion-Annahmen, die durch die bewusst vereinfachte Preview teilweise nicht mehr gültig sind. Diese Alt-Tests sind nicht als vollständige v25-Freigabe verwendbar.
- **Keine unabhängig gerenderte neue v25-WebGL-Galerie**: `three@0.180.0` konnte in dieser Ausführungsumgebung aufgrund eines Netzwerk-Timeouts nicht installiert werden. Die Verknüpfung des Caps ist im Code korrigiert, die visuelle Wirkung auf einem echten Renderer bleibt zu prüfen.
- Keine Controller-Hardware-/Qt-/D3D11-Aufnahmeprüfung.

## Für die nächste tatsächliche Sichtprüfung

Mit `start.cmd` in einem Netz mit npm/GitHub-Zugriff starten. DualSense sowie Xbox One/Switch Pro jeweils bei 0 %, 50 % und 100 % Style-Mix auf Dunkel/Hell/Gemischt prüfen. Bei kardinaler und diagonaler Vollauslenkung die Kappenrundung und den beweglichen Ring überprüfen, L3/R3 betätigen, Orbit/Zoom auch im Live-Modus testen. Dann die drei Ziel-Alpha-Werte an **echten 3D-Frames** abnehmen.

Die Modellgeometrien werden bei Erstaufruf von den Quellen bezogen; lokale OBJ-Kopien sind nicht im ZIP. MIT-/modellbezogene Herkunft steht in `THIRD_PARTY_NOTICES.md`.
