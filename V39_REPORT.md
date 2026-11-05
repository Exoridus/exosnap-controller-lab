# ExoSnap v39 – Abschlussbericht

## Ausgangslage

v38: nur zwei nahezu gleiche Hero-Looks. Beide Farb-Picker schienen nicht richtig kanalgetrennt: Die 2D-Referenz cachte den Materialzustand ausschließlich anhand von Variant, Mix und Szene. Ein reiner Farbwechsel bei unverändert gedrücktem Button übersprang `applyMaterialAppearance`. V38 hatte bereits getrennte 2D-/3D-Rezepte; der Fehler lag in der SVG-Cache-Invalidierung.

## Änderungen

1. `material-paint.js`: `appearanceCacheKey` umfasst nun aktive 2D-Farbe, Emissions-/Kantenfarbe, Deckkraft und Materialwerte. Bei Farbwechsel wird die pressed-Surface erneut gesetzt.
2. `active-color-state.js`: 2D-/3D-Color Picker standardmäßig unabhängig; expliziter Sync übernimmt jeweils den bearbeiteten Farbwert für beide. `pbr-lab.js` nutzt ausschließlich diese State-API.
3. `pbr-recipes.js`: Vier nicht nur umbenannte Kandidaten: Environment Solid (hohe Opacity), Environment Ghost (matte IBL-Transparenz), Outline Ghost (unlit, Backface-Kontur), Hybrid Identity (Farbidentität bei Transparenz). Unterschiede bei Mix 70 messbar an OriginalColorWeight, Opacity und Roughness.
4. `assets/studio-neutral.hdr` + `hdr-probe.js`: eine einzige echte HDR-Umgebungslichtprobe, original erzeugt, formatgeprüft. Kein Lichtobjekt im Vergleich; Qt-Referenz in `qt-quick3d-port/EnvironmentProbe.qml`.
5. `pbr-silhouette.js`: schmale dual-tone Backface-Kontur nur für Outline Ghost; BufferGeometry bleibt geteilt, keine Shader-Postprozesse oder Bodenschatten.
6. `ghost-depth-policy.js`: Rear-Hints nur in Ghost und Outline, nicht Solid/Identity; nur verdeckte Fragmente (GreaterDepth), schwaches gestricheltes Material.
7. `pbr-lab.html`: 4 einfache Grid-Zeilen mit jeweils 3D D/H/M und 2D D/H/M; ohne Cards, Labels oder iFrames. Vier kleine Zeilen-Toggles, ein Materialmix, zwei klar getrennte Picker mit optionalem Sync.

## Prüfung

Siehe `evidence/v39/verify.log` für die vollständige Testausgabe und `evidence/v39/http-smoke.json` für lokal ausgelieferte Dateien. Alle 27 Original-DualSense-OBJs und 20 Original-SVGs bleiben verfügbar. Keine GitHub-PRs verändert.

## Offene Grenzen

- Kein 3D-Screenshot aus dem wirklichen WebGL-Renderer verfügbar: der automatisierte Browser sperrt lokale Seiten mit `ERR_BLOCKED_BY_ADMINISTRATOR`, auch per file-URL.
- Keine native Qt-Binärdatei und kein Lichtwert-Pixelvergleich erstellt. Qt-Snippets bleiben Referenzen, nicht fertige Runtime.
- Silhouettenbreite und physische Depth-Occlusion aus Front/Seite/Ghost benötigen tatsächliche WebGL-Sichtprüfung vor Produktfreigabe.

## Finaler Prüfstand

- **337/337 Node-Tests bestanden**, 0 Fehler, 0 übersprungen.
- HTTP-Smoke: 16/16 lokale Einstiegspunkte, Module, Asset-Dateien und Qt-Probevorlage ausgeliefert.
- 47 Original-Assets (27 DualSense-OBJs und 20 2D-SVGs) byteidentisch zur v38-Quelle.
- Für Mixed / Hell / Dunkel fehlen weiterhin visuell geprüfte 3D-Screenshots aus einem WebGL-fähigen Browser.
