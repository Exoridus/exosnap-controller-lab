# ExoSnap Controller3D Lab v28 – Testvertrag aktualisiert

**Ausgangslage:** `npm test`: 229/241, 12 fehlgeschlagen. Quelle: `verfiy.log` aus Windows.

**Nach Korrektur:** `npm run verify`: 241/241, 0 fehlgeschlagen, 0 übersprungen (Node.js 22, Linux).

**Geändert:** ausschließlich acht Testdateien. `app.js`, `index.html`, Styles, Renderer, Modell- und Materialdateien sind byteidentisch zum ursprünglichen v28-ZIP. Keine visuellen Bugfixes.

| Historischer Fehlerblock | Anzahl | Neue Prüfung |
|---|---:|---|
| `compact-ui` | 2 | Sichtbares 6-Panel-Lab, Stil-Presets und versteckter alter Motion-Adapter |
| `ghost-defaults` | 1 | Tatsächliche Glass-Startposition, Ghost-Alpha und Kontur=0 statt historischer 10/20/50-Vorgabe |
| `handheld-ui` | 2 | Vorhandene Handhaltungs-/Kalibrierungsadapter ohne sichtbares Motion-Tuning |
| `overlay-ui` | 2 | Sichere manuelle Vorschau als Default und optionales Live-Gamepad |
| `v15-motion-ui` | 1 | Fortbestehende Motion-Tuning-Logik im ausgeblendeten Adapter |
| `v16-combined-ui` | 1 | Roll/Yaw-Kopplung und Speicherung im versteckten Adapter |
| `v21-parity` | 1 | 6 aktuelle 3D/2D-Panel-IDs statt entferntem alten 2D-Button |
| `v22-occlusion` | 2 | Transparente Ghost-Controls **mit** separatem farblosen Tiefenpass, nicht historisch opaque Controls |

## Offene Qualitätssicherung

- **Browser-Sichtprüfung nicht bestanden/ausgeführt:** Chromium-Aufruf `http://127.0.0.1:8790/` wurde in dieser Umgebung mit `ERR_BLOCKED_BY_ADMINISTRATOR` abgewiesen.
- Es existiert **kein** neuer visueller Fix für die von dir beobachteten 2D-Linien, den Schlagschatten oder die Joystick-Details. Die vollständige Node-Suite ist kein Ersatz für einen WebGL-Screenshot.
- Die Ghost-Tests prüfen den Policy-/Codevertrag, aber nicht die tatsächlichen Pixel.

## Anwendung

Patch in den entpackten v28-Ordner entpacken (nur die acht `tests/*.test.mjs` überschreiben), anschließend `npm run verify`.
