# Screenshot-Verlauf

Diese Seite bekommt ihre **aktuellen** Bilddateien erst durch den erfolgreichen GitHub-Actions-Workflow.
Historische Bilder werden nicht in `main`, sondern im Branch `visual-history/snapshots/<Quell-Commit-SHA>/` gespeichert.
Lokale Aufnahme: `npm run capture:pages` nach Einrichtung von Playwright und laufendem Server. Ist WebGL nicht verfügbar, ist eine fehlende Aufnahme ein Blocker, kein Grund für ein Ersatzbild.
