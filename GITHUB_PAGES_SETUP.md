# GitHub Pages für das ExoSnap Controller3D Lab

Dieses Paket ist **repository-ready**, aber wurde **nicht auf GitHub veröffentlicht**. In dieser Session steht keine GitHub-Repository-Erstellungsfunktion zur Verfügung.

## Einmalige Einrichtung

1. Das öffentliche Repository [`Exoridus/exosnap-controller-lab`](https://github.com/Exoridus/exosnap-controller-lab) ist bereits erstellt und derzeit leer. **Kein weiteres Repository anlegen.**
2. Die enthaltenen Dateien im Repository-Ordner mittels Git hochladen:

   ```powershell
   git init -b main
   git add .
   git commit -m "feat: publish Controller3D Lab v40 with visual history"
   git remote add origin https://github.com/Exoridus/exosnap-controller-lab.git
   git push -u origin main
   ```

   Die Remote-Adresse ist bereits der bestätigte Repositoryname.
3. In **Settings → Pages → Build and deployment → Source** den Eintrag **GitHub Actions** wählen.
4. Unter **Settings → Actions → General → Workflow permissions** sicherstellen, dass GitHub Actions **Read and write permissions** besitzt. Das wird für die separate `visual-history`-Branch benötigt. Im Zweifelsfall die Branch-/Organisationsrichtlinien prüfen.
5. In **Actions → Verify, capture real WebGL screenshots, publish Pages** den ersten Run starten (`Run workflow`) oder den bereits gestarteten Push-Run prüfen.

Die erwartete Projekt-URL lautet nach erfolgreicher Veröffentlichung:

`https://exoridus.github.io/exosnap-controller-lab/`

**Diese URL ist ein erwartetes Ziel, kein bestätigter Live-Link.** Erst den erfolgreichen GitHub-Pages-Deploy-Job abwarten.

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
- Der lokale Prüf-Browser dieser Chat-Umgebung hat keine erfolgreiche WebGL-3D-Aufnahme geliefert; das erste verifizierte **aktuelle** Bild entsteht erst bei einem erfolgreichen GitHub-Actions-Lauf.
