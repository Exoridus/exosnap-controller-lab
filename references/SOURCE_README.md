# Gamepad-Overlay: überarbeitete Pads

Alle 14 Layouts aus dem Katalog von ExoSnap (`next`) als Drop-in-Ersatz für
`app/assets/gamepad/controllers/<id>/source.svg` und `mapping.json`, dazu vier
neue Layouts (`steam_deck_compact`, `steam_controller_2026`, `xbox_360`, `gamecube`, `dualsense_edge`, `xbox_elite`) und eine
`catalog.json` mit allen sechs hinten angehängt:

`dualsense`, `dualshock4`, `xbox_series`, `xbox_one`, `generic`, `switch_pro`,
`joycon_grip`, `joycon_pair`, `joycon_left`, `joycon_right`,
`joycon_left_horizontal`, `joycon_right_horizontal`, `steam_controller`,
`steam_deck_full`.

Grundlage sind die Repo-Fassungen aus dem AL2009man Gamepad Asset Pack
(MIT, Copyright (c) 2024 Al. Lopez). Die bearbeiteten Dateien fallen unter
dieselbe Lizenz, `LICENSE.txt` und `SOURCE-NOTICE.txt` im Repo bleiben gültig.
Lautsprecher-Löcher (DualSense, DualShock 4) stammen aus demselben Pack.

**Xbox 360:** aus „Xbox 360 VSCView - White“ desselben AL2009man-Packs (MIT), wie die anderen Pads
auf Linien umgestellt (Oberseiten der Tasten als Kontur, Sticks als konzentrische Kappen in der Mulde).

**GameCube:** nachgezeichnet nach `styles/gcn/gamecube_*.svg` aus
[datkat21/controlleroverlays](https://github.com/datkat21/controlleroverlays), **GPL-3.0**. ExoSnap
steht ebenfalls unter GPL-3.0, das passt; der Hinweis gehört in `SOURCE-NOTICE.txt` bzw.
`THIRD_PARTY_NOTICES.md`. Die `license`-Angabe im Mapping ist entsprechend `GPL-3.0-only`.

**Steam Controller 2026:** Der Umriss ist frei gezeichnet, nur Maße (Breite, Höhe, Ecken, Griffe,
Kerbe) wurden am 3D-Modell „Steam Controller 2026“ (Khyretos/3dco-plus, CC BY-NC-SA 4.0, Valve)
abgelesen; es ist keine Geometrie daraus übernommen. Alle Bedienelemente stammen aus dem MIT-Pack.

## Struktur

Unverändert gegenüber dem Repo:

- Gleiche viewBox, gleiche Koordinaten, gleiche Layer-Reihenfolge und IDs
  (`body`, `btn-*`, `trigger-*`, `stick-*-cap`, `dpad`, `trackpad-*`). Jede
  Taste ist eine eigene Gruppe, darüber färbt `GamepadArtwork` ein.
- Gleiches `mapping.json`-Schema (`schemaVersion` 1), gleiche Bindings,
  Button-Masken, `travelRadius`, `orientation` und `controlLabels`.
- Alles rein weiß gezeichnet (der Sprite-Test verlangt reines Weiß).

Angepasst im Mapping:

- `bounds` aus der finalen Geometrie neu berechnet (Druckflächen
  eingeschlossen, auf `clip` beschnitten). Stick-`motion.center` aus der
  neuen Kappe.
- `pressElement` für Schulter-Tasten (L1/R1/L2/R2, bei Joy-Cons auch L/ZL/R/ZR
  und SL/SR) auf eigene, unsichtbare `*-pressure`-Pfade, damit der ganze
  Button gefüllt wird. Bei Xbox reicht `pressClip` bis zur Trennlinie.
- DualShock 4: PS-Taste füllt sich als Taste (`pressElement: btn-home-face`,
  kein `pressMode: tint`), das Logo bleibt weiß.
- DualSense: `btn-mute` ist sichtbar, `binding` bleibt `null` (reine Grafik).
- **Neu: `knockout`** am Stick-Layer (alle Pads), Wert ist eine Element-ID (Kappen-Kontur, bei Joy-Cons
  die Druckfläche). Die Kappe stanzt diese Form an ihrer aktuellen Position aus dem `body`-Layer,
  damit Mulden-Ringe und Kanten nicht durch die ausgelenkte Kappe laufen. Braucht in `GamepadSprites`
  einen Ausstanz-Schritt (Composition Mode `DestinationOut`) vor dem Zeichnen der Kappe; ohne diesen
  Schritt wird das Feld einfach ignoriert.
- Steam Deck (beide): `btn-home` füllt sich über `btn-home-face` (die Taste), nicht über das Logo.
- Switch Pro: `dpad` hat jetzt `pressElement: dpad-surface` (Außenkontur des Kreuzes). Vorher war die
  größte Grafik das Pfeil-Symbol, dessen erste Kontur nur ein Pfeil ist, das D-Pad füllte sich praktisch nicht.
- DualSense `btn-mute`: `pressElement` und **neues optionales Feld `pressColor`** (`#ff8a3d`, orange wie
  die Mute-LED). Binding bleibt `null`; ohne native Unterstützung wird das Feld ignoriert.
- Xbox Series / Xbox One (und damit Elite): je Stick nur noch ein Mulden-Ring, der innere ist entfernt.
- Steam Deck (beide): Linien im Gehäuse (Griffkonturen) enden an den Rückseitentasten statt durchzulaufen.
- Einzelne Joy-Cons: SL/SR am Riemen mit eigener Kontur (geschlossene Taste statt nur Erhebung).
- **Rückseitentasten** L4/L5/R4/R5 bei Steam Deck, Deck kompakt, Steam Controller 2026 (Form aus dem 3D-Modell, auf die Griffe versetzt), Steam Deck (übereinander wie am Gerät), Xbox Elite und DualSense Edge: neue Layer
  `btn-l4`, `btn-l5`, `btn-r4`, `btn-r5` direkt nach `body`, gestrichelt und dezent an der Stelle der Griffe
  (Elite: Form der Paddle-Enden von einem Rückseitenfoto, gespiegelt; Edge: Pillen unter den Griffen, bündig an der inneren Griffkontur),
  `binding: null` mit `preview` (das Standard-Gamepad von GameInput kennt keine Paddles), eigene Druckfläche.
- Trackpads (Steam Controller 2015, Steam Deck, 2026) bleiben `touch-surface` ohne Binding: GameInput
  liefert dafür keine Daten, einen Finger-Punkt gibt es nur in der HTML-Vorschau.
- Steam Controller (2015): viewBox oben um 7 Einheiten erweitert, weil die neuen Schultern höher reichen.
- Analoge Trigger: nichts Neues nötig, `GamepadSprites` füllt sie schon von
  unten nach oben nach dem Wert.

In den SVGs aufgeräumt: Inkscape-/Sodipodi-Metadaten, ungenutzte `defs` und
bedeutungslose IDs entfernt. Die Geometrie bleibt dabei unverändert.

## Was optisch anders ist

Alle Pads:
- Kräftige Außenkontur (1,85 auf der 480×320-Leinwand) mittig auf der
  Original-Außenlinie, bei symmetrischen Pads gespiegelt, bei getrennten
  Joy-Cons je Gehäuse. An Schulter-Tasten ausgespart (außer Xbox, wo die
  Bumper die Oberkante bilden).
- Einheitliche Strichstärken auf allen Pads (gemessen auf der 480×320-Leinwand):
  Linien 1,25 (wie die Original-Xbox-Linien), Details 0,8 bei 50 % Deckkraft. Als dünne Fläche gezeichnete
  Linien (v. a. DualShock 4 und DualSense) bekommen einen Strich dazu, bis sie
  dieselbe Stärke erreichen.
- Face-Buttons als saubere Ellipsen, Buchstaben/Symbole unverändert.
- Stick-Kappen zwei konzentrische Ellipsen (außen 1,5, innen 0,85); Joy-Cons behalten ihre Kerben.
- PS5, Xbox One, Xbox Series, Generic: Stick-Kappe mittig in der Mulde (das Original
  zeigt sie nach unten versetzt); `motion.center` entsprechend.

| Pad | Zusätzlich |
| --- | --- |
| DualSense | L1/L2/R1/R2-Beschriftung entfernt, Tasten und D-Pad flach, zwei statt drei Mulden-Ringe, L2 als gespiegelte R2-Kontur, Lautsprecher-Löcher und Mute-Taste (ohne das kleine Mikrofon-Symbol darunter), L1/R1 füllen den unteren Gehäuseteil |
| DualShock 4 | L1/L2/R1/R2 und SHARE/OPTIONS entfernt; Touchpad mit einer Linie statt doppelt, Linie um das Touchpad entfernt; Tasten flach, Doppellinie an den Griffen entfernt, D-Pad-Dreiecke hohl, Lautsprecher-Löcher |
| Xbox Series | Hybrid-D-Pad: Schale mit breitem Kreuz und Mittelquadrat, beim Drücken füllt sich der jeweilige Arm (`pressElement: dpad-cross`); Pairing-Taste links neben dem USB-C-Anschluss oben (beides Grafik); Tasten flach, äußerer D-Pad-Ring entfernt, innerer Kreis der rechten Kappe ergänzt, Bumper-Streifen einfach und dünner, Leiste mit kräftiger Ober- und Unterkante |
| Xbox One | Tasten flach, innere D-Pad-Kontur entfernt, D-Pad-Schale wie die Mulden, doppelte Außenlinie entfernt, Leiste dünner |
| Generic | wie Xbox Series (ohne Hybrid-D-Pad) mit neutraler Mitte: Zurück/Start als Dreiecke ◀ ▶ wie beim Steam Controller, Aufnahme als Aufnahme-Punkt ●, Home als Linien-Icon (Dach, Wände, Tür); A/B/X/Y |
| Switch Pro | L/R und ZL/ZR als saubere Flächen ohne Überlappung (L/R füllt das ganze Band bis zur Gehäusekante, mit Trennlinie zur Mitte), Kontur läuft über die Schultertasten, L/R 4,5 Einheiten tiefer gesetzt (mehr ZL/ZR sichtbar), L/R und ZL/ZR füllen die ganze Fläche bis zur nächsten Linie, Switch-Logo voll deckend, Schriftzug „Nintendo Switch“ aus dem Original-Pack |
| Joy-Con Grip | Switch-Logo voll deckend, Schriftzug „Nintendo Switch“ aus dem Original-Pack |
| Joy-Cons (alle sechs) | Kontur je Gehäuse (bei L, R und Paar die gezeichnete Gehäuselinie, damit die Schiene sauber anliegt), Face- und Richtungstasten als Ellipsen, Stick-Kappen mit Kerben; einzelne Joy-Cons (hoch und quer) mit angestecktem Handgelenk-Riemen statt der Schiene: Band über die ganze Länge (Proportionen vom Riemen am 3D-Joy-Con-Modell gemessen), SL/SR als Erhebungen an der Außenkante; bei den queren füllen sich SL/SR dort; die seitlichen L/ZL bzw. R/ZR haben saubere Druckflächen, bleiben aber `binding: null`, solange nicht geklärt ist, wie der Treiber sie meldet; das Paar behält die Seitenschiene aus dem Original-Pack mit SL/SR | L/ZL bzw. R/ZR als saubere Flächen ohne Überlappung (auch beim Grip). Paar: dieselben Schienen mit SL/SR wie bei den einzelnen Joy-Cons (SL/SR nur Grafik).
| Steam Controller (2015) | Kontur, Face-Buttons, Stick mit innerem Ring ergänzt, doppelter Ring um D-Pad und Touchpad entfernt, D-Pad-Kreuz gedimmt (Detail-Linie, 50 %), weil es nur eine Markierung auf dem Touchpad ist; Schultern vom Steam Deck entlang der Kontur, Kontur läuft durchgehend unter L1/R1, L2/R2 dahinter ohne Überlappung |
| Steam Deck | Kontur, Face-Buttons, Sticks, Trackpads als volle Linie, Grip-Linien leichter, Steam-Logo statt STEAM-Schriftzug |
| Steam Deck kompakt (neu) | beide Bedienhälften ohne Bildschirm mit 12 Einheiten Abstand, Schnittkanten geschlossen; gleiche Bindings und Änderungen wie `steam_deck_full` |
| DualSense Edge (neu) | wie DualSense, dazu zwei Rückseitentasten (`btn-l4`/`btn-r4`, gestrichelt) und die Fn-Tasten als breite, gestrichelte Laschen an der Unterkante unter den Sticks (`btn-fn-l`/`btn-fn-r`, sitzen an der Unterseite); alle ohne Standard-Binding, mit `preview` |
| Xbox Elite (neu) | wie Xbox Series, dazu die vier Paddles (`btn-l4`/`btn-l5`/`btn-r4`/`btn-r5`, gestrichelt, kurzes oberes und langes unteres Paddle mit Haken nach außen, leicht schräg (inneres Ende oben), ohne Standard-Binding) |
| Xbox 360 (neu) | Kontur als Vereinigung von Gehäuse, Bumpern und vorstehender D-Pad-Mulde; Gehäuselinien dort ausgespart, wo im Original Flächen darüber lagen ; oben in der Mitte nur noch eine Kontur, die unter den Bumpern durchläuft; Ladebuchse entfernt; Xbox-Logo als Kontur, beim Drücken füllt sich nur der Knopf (`pressElement: btn-home-face`), der feine Ring bleibt Kontur, keine Kontur mehr um Back/Start; runde, dünne Mulden für Sticks und D-Pad; Bindings wie Xbox One |
| GameCube (neu, Entwurf) | Kontur aus der Vereinigung der Gehäuseteile, die beiden „Kuppeln“ als dezente Nahtlinien; L/R und Z nur mit ihrem sichtbaren Teil; Haupt-Stick und C-Stick mit dünner Achteck-Führung, Doppelring-Kappe bzw. „C“; A groß, B/X/Y in GameCube-Form und über dem Tasten-Ring (Ring darunter per `clipPath` ausgespart). Bindings: A/B/X/Y nach Buchstabe, Z = R1, L/R = analoge Trigger, START = Menu, C-Stick = rechter Stick (`controlLabels` entsprechend). `status: artwork-draft` |
| Steam Controller 2026 (neu, Entwurf) | Umriss frei gezeichnet (glatte Kurve durch 21 gemessene Punkte je Hälfte), Positionen und Größen am 3D-Modell gemessen (Leinwand 1520×1080). Schultern vom Steam Deck entlang der Kontur, Kontur läuft unter L1/R1, L2/R2 dahinter ohne Überlappung. Sticks vom Steam Controller 2015 in Originalgröße (Ring ≈ Einfassung am Gerät), Trackpads um ±9,4° gedreht, QAM, D-Pad, ABXY, View/Menu vom Steam Deck, runde Steam-Taste, LED, dezente Panelkante (innerhalb der Rückseitentasten ausgespart). `status: artwork-draft` |

## Einbau

1. Ordner nach `app/assets/gamepad/controllers/` kopieren.
2. Einzelteile neu erzeugen, die Sprite-Tests vergleichen sie mit der Quelle:
   `cargo exo-dev generate-gamepad-assets --svgo`.
3. `cargo exo-dev test --filter gamepad`, danach Screenshots für den PR.

Bei den neuen Layouts sitzen Verschiebungen auf den Kindelementen, nie auf der
Layer-Gruppe oder ihren Vorfahren: `GamepadArtwork` kopiert jede Gruppe einzeln in die
Leinwand und legt D-Pad-Regionen und `pressClip` im Koordinatensystem der Gruppe an.

Für die sechs neuen Layouts zusätzlich: `kGamepadOverlayArtworkIds` in
`GamepadOverlaySettings.h` um `steam_deck_compact`, `steam_controller_2026`, `xbox_360`, `gamecube`, `dualsense_edge` und `xbox_elite`
**hinten** erweitern (Indizes sind in Profilen gespeichert), Labels in
`GamepadOverlay::layouts()` und die Liste in `app/quick/ExoSnap/Quick/CMakeLists.txt`
ergänzen. `catalog.json` setzt `defaultLayouts.steam_deck` auf die kompakte Fassung.

Eigener Schritt: Glas und Schein aus dem Overlay entfernen
(`GamepadOverlaySettings`, `GamepadOverlayControls.qml`, `GamepadSprites`,
Profil-Migration).
