# GitHub Pages für das ExoSnap Controller3D Lab

**Status:** GitHub Pages wird über **GitHub Actions** aus dem öffentlichen Repository [`Exoridus/exosnap-controller-lab`](https://github.com/Exoridus/exosnap-controller-lab) veröffentlicht.

- **Lab:** https://exoridus.github.io/exosnap-controller-lab/
- **Screenshot-Verlauf:** https://exoridus.github.io/exosnap-controller-lab/screenshots.html
- **Erster bestätigter Deploy:** [Workflowlauf vom 5. November 2026](https://github.com/Exoridus/exosnap-controller-lab/actions/runs/41974037777), Quell-Commit `1da7e7a`; Build und Deploy erfolgreich.
- **Dauerhaftes Bildarchiv:** [Branch `visual-history`](https://github.com/Exoridus/exosnap-controller-lab/tree/visual-history).

## Betrieb und Einstellungen

1. **Settings → Pages → Build and deployment → Source:** `GitHub Actions` (bereits eingerichtet).
2. Der Workflow [`.github/workflows/pages-and-screenshots.yml`](.github/workflows/pages-and-screenshots.yml) läuft bei jedem Push auf `main` und kann über `Actions → Run workflow` manuell gestartet werden.
3. Die CI benötigt `contents: write` für den Archiv-Branch `visual-history`, `pages: write` und `id-token: write` für das Deployment. Die entsprechenden Workflow-Permissions sind definiert; Repository-/Organisationsregeln dürfen sie nicht unterbinden.
4. Die aktuelle Ausführung und ggf. Fehler stehen unter [Actions](https://github.com/Exoridus/exosnap-controller-lab/actions). Ein verifiziertes Deploy ist Voraussetzung für die Aktualisierung der öffentlichen Website.

## Automatischer Ablauf bei jedem Push auf `main`

1. `npm ci` und **vollständige Node-Test-Suite**.
2. Chromium wird über Playwright eingerichtet; explizites Software-WebGL (SwiftShader) ist zugelassen, aber ein gescheiterter WebGL-Start **bricht den Workflow ab**.
3. Mit echten originalen 3D-OBJ-Meshes und 2D-SVGs entstehen `overview-neutral.png` und `overview-pressed.png`. Capture validiert Renderer-Status, zwölf sichtbare 3D-Felder, zwölf SVG-Felder, echte Draw-Call-Daten, keine JS-/HTTP-Fehler und unterschiedliche Bilddateien für Neutral/Pressed.
4. Die Dateien gehen als GitHub-Actions-Artefakt `visual-evidence-<SHA>` ins Runprotokoll. Die Laufzeit dieser *zusätzlichen* Download-Artefakte ist 90 Tage.
5. Eine Kopie wird **dauerhaft im Branch `visual-history`** gespeichert: `snapshots/<40-stellige-Quell-SHA>/overview-neutral.png`, `overview-pressed.png` und `capture-manifest.json`, plus `index.json`.
6. GitHub Pages erhält `screenshots/latest.png`, `screenshots/pressed.png`, `screenshots/history.json` und die Seite **`/screenshots.html`** mit Links zu älteren Ständen.
7. Nur wenn alles erfolgreich ist, wird die neue Seite veröffentlicht. Fehlerhafte oder leere Rendererbilder ersetzen **nicht** den letzten gültigen Pages-Stand.

Achtung: Eine **technisch erfolgreiche Aufnahme ist noch keine visuelle Freigabe**. Schatten, Tiefenverdeckung, Kontrast und Aliasing weiter tatsächlich ansehen.

## Lokal

- `npm run verify`: komplette vorhandene Node-Suite und zusätzliche Pages-/Screenshottests.
- `npm run build:pages`: erstellt `dist/` (statische Seite ohne generierte Screenshots).
- `start.cmd` (Windows, nutzt die beigelegten Three.js-Dateien) oder `npm start`: lokaler Server, anschließend `http://127.0.0.1:8792/`. `npm ci` ist für die Node-Tests nötig, nicht für das lokale Betrachten.
- Für manuelle echte Screenshots `npm install --no-save --package-lock=false playwright@1.64.1` und `npx playwright install chromium`, dann `npm run capture:pages` (benötigt funktionierendes WebGL2).

## Veröffentlichungsrechte

Das Paket enthält referenzierte Controller-Objekte und SVG-Grafiken mit **unterschiedlichen Drittanbieter-Lizenzen**. Vor dem öffentlichen Push bitte `THIRD_PARTY_NOTICES.md`, `references/SOURCE_README.md` und `licenses/` kontrollieren. Insbesondere gelten für GameCube/Steam-2026-Referenzen nicht automatisch dieselben Bedingungen wie für den MIT-lizenzierten DualSense.

## Grenzen

- Keine serverseitige API nötig; Node ist nur für Entwicklung, Tests und Deployment erforderlich.
- Die Funktion „weitere Modelle herunterladen“ speichert Assets zur Entwicklungszeit. GitHub Pages kann zur Laufzeit keine zusätzlichen OBJ-Dateien in das Repository schreiben. Bundled DualSense ist offline vorhanden.
- Qt Quick 3D wird hier **nicht** in Pages ausgeführt. Die Seite zeigt den echten Three.js-Prototyp und die historischen Referenzen.
- Der lokale Prüf-Browser der ursprünglichen Entwicklungsumgebung konnte keine WebGL-3D-Aufnahme liefern. Der GitHub-Actions-Lauf vom 5. November 2026 hat anschließend erfolgreich echte Chromium-WebGL2-Aufnahmen erstellt und veröffentlicht.
