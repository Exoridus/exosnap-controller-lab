## v19 – Input-Quellen und Statusdiagnose

Im Browser kann die WebHID-Öffnung des Sony-Sensorinterfaces gleichzeitig mit der Gamepad API zu einem veralteten Button-Snapshot führen. Der Lab-Prototyp nutzt deswegen bei Sony-Geräten die Tasten/Trigger/Stickachsen aus demselben aktuellen HID-Report wie die IMU. Wenn HID-Reports ausbleiben und die Gamepad API seit der Verbindungsaufnahme keinen neuen Zustand gemeldet hat, wird ein alter gedrückter Zustand NICHT weiter angezeigt; die Quelle meldet `stale`. `touchpad.obj` wird als separater Klick behandelt, und Joystickachsen sind von L3/R3 getrennt. Die restlichen Geräte bleiben über die normale Gamepad API angebunden.

**Für native ExoSnap:** Die Eingabequelle muss klar vom Render-State getrennt sein. Eine einzelne GameInput-Lesepipeline bzw. ein zentraler Adapter soll die aktuellsten Gamepad- und Sensordaten zusammenführen, damit nicht zwei unabhängige HID-Handles dieselben Tastenzustände konkurrierend lesen. Sowohl Gamepad- als auch Sensorberichte benötigen Freshness-/Disconnect-Checks. Die bei v19 gefundene L3-Stale-Hypothese ist mit simulierten Berichten abgedeckt, nicht auf echter Hardware bestätigt.

**IMU:** Während der automatischen Ruhekalibrierung muss neben der geringen Varianz auch die mittlere Winkelgeschwindigkeit klein sein. Ansonsten kann eine gleichmäßige Rotation fälschlich als Gyro-Offset gespeichert werden. Ein kleiner Rest-Gyro-Deadband darf nur im Darstellungs-/Fusionspfad wirken, nicht in den physikalischen Telemetrie-Werten.

---

## v18 – Separate Display-Referenz statt physischer Haltungssperre

Ein optionaler `AdaptiveHandReference` führt eine maximal 60 Samples umfassende zeitgestempelte Historie (~1 s bei 60 Hz); bei ruhigem Gyro/Accel und ohne aktive Eingabe wird nach 0,5 s ein Quaternion-Mittel als neue Neutralreferenz schrittweise übernommen (2 s Halbwertszeit). Die IMU-Fusion, Hardware-Bias, Rohdaten und `360° frei` bleiben unverändert. Der Präsentationspfad verarbeitet **jedes** Frame – keine `postureHold`-Sperre. `motion-render-policy.js` enthält die reine Moduswahl. Experimente und Quellen siehe `REFERENCE_COMPARISON.md`.

Für die native Implementierung: Referenzpuffer und Handhold-Profil gehören in eine **Display-Policy** neben der Sensordaten-Pipeline, nicht in den GameInput-/HID-Adapter. 60-Sample-Größe bezieht sich auf Samples nach Zeitresampling, nicht blind auf die physische Pollrate. Erst nach Hardwaremessungen endgültige Parameter wählen.

---

# ExoSnap native: Sensor- und Overlay-Vertrag (v14-Prototyp)

## Ziel

Der aktuelle C++/Qt-Windows-Core nutzt GameInput für Gamepad-Tasten. Er sollte künftig eine optionale, austauschbare **MotionSource** besitzen, statt dass die Gamepad-Overlay-UI rohe HID-Reports interpretiert. Eine Browser-WebHID-Verbindung ist kein native Produkt-Backend.

## Kontrakte

```cpp
struct MotionFrame {
    uint64_t monotonicTimestampNs;
    std::array<float, 3> gyroRadPerSec;
    std::array<float, 3> accelMetersPerSecSquared;
    enum class CalibrationQuality { Factory, FactoryPlusRestBias, Fallback } quality;
};

struct ControllerOverlayFrame {
    /* Input aus GameInput, MotionFrame aus genau einer deduplizierten MotionSource */
    ControllerButtonState buttons;
    Quaternion relativeOrientation;
    enum class Mode { StabilizedHandheld, LimitedDirect, Full360 } displayMode;
};
```

- **InputAdapter / GameInput:** Tasten, Sticks, Trigger, Gerätezuordnung.
- **MotionSource:** SDL3-Sensoradapter oder separate native HID-Quelle; generische physikalische Einheiten nach SDL-Konvention. Sensoren nur aktivieren, wenn Gerät und Treiber dies tatsächlich unterstützen.
- **MotionFusion:** Ruhestands-Offset, Zeitstempel, Schwerkraftkorrektur, relative Quaternion, Nullpunkt. Keine doppelte Geräteinitialisierung und kein zweiter konkurrierender HID-Reader für denselben Controller.
- **Presentation:** Modell-Frontausrichtung, Ghost-Material, Pressed-Emissive-Blau, Quaternion-Policy (`StabilizedHandheld` / `LimitedDirect` / `Full360`). Die UI kennt weder Vendor IDs noch Report-Layouts.
- **Capability-Hinweise:** `motion_supported`, `factory_calibrated`, `sensor_source`, `sensor_freshness`, `yaw_absolute=false`.

## Geräte-Matrix / Feature-Gates

- **Sony:** DualSense, Edge, DS4 als Referenz; Werkskalibrierung über SDL3-HIDAPI oder kompatible native Quelle.
- **Nintendo:** Switch Pro, Joy-Con L/R; SPI-Werksdaten und Benutzerwerte; USB/BT-Handshake. Switch-2-Pro benötigt **separat verifizierten** Treiber.
- **Steam Controller/Steam Deck:** SDL3 besitzt Steam-HID-Unterstützung; erst nach validierter Geräteerkennung und Adapterintegration freigeben. Keine angenommene Kompatibilität mit nicht bestätigtem 2026-Modell.
- **Xbox / GameCube:** Buttons und Sticks unterstützen. IMU nur bei einem konkret nachgewiesenen Gerät/Adapter – keine generischen Gyrodaten aus der Gamepad API erfinden.

### Sicherheits- und Performance-Grenzen

- Controller-Verknüpfung über Device-ID + stabile VID/PID-/Serien-Metadaten, ohne unnötige Persistierung sensibler IDs.
- Native Sensor-Leseoperationen asynchron mit begrenzter Queue; UI erhält nur den letzten gültigen Frame, markiert stale Daten.
- Factory Calibration validieren; bei defekter/fehlender Kalibrierung explizite Fallback-Kennzeichnung.
- Im Voll-360-Modus `orientation` unverändert durchreichen. In beiden begrenzten Modi Pitch ±35°, Roll ±30°, Yaw ±45° und die Kamera gesperrt halten. `StabilizedHandheld` folgt dabei relativen Sensorrotations-Änderungen mit einer −12°-Pitch-Frontlage und inkrementeller Neigungsverarbeitung **ohne** zeitgesteuerte Rückstellung. Über den sichtbaren Grenzwinkel hinausreichende Drehänderungen werden verworfen (kein Wind-up); beim Rückdrehen reagiert die Anzeige sofort; `LimitedDirect` begrenzt dagegen kontinuierlich die absolute relative Orientierung. Die Presentation-Policy gehört **nicht** in MotionFusion oder die Device-Treiber.
- SDL3-API und GameInput können denselben Controller enumerieren. Ein Eigentümer-/Deduplizierungsvertrag verhindert doppelte Haptik-Outputs, Konflikte oder Tastenduplikate.

Diese Datei ist ein **Übergabevertrag**, keine Behauptung einer bereits implementierten nativen ExoSnap-Erweiterung.

## v14: HandheldOverlayMotion als Standard für ExoSnap

Die Browserimplementierung liegt isoliert in `overlay-motion.js` (`HandheldOverlayMotion`, `handheldNeutralOrientation`, `heldDirectOrientation`). Die native Entsprechung sollte pro Geräte-Overlay eine unabhängige zeitbasierte Display-Policy erhalten. Der Rohzustand `MotionFrame` und das physikalische `relativeOrientation` bleiben unverändert. Beim Wechsel des Controllers, Recenter, Sensor-Reconnect, Kalibrieren oder Umschalten des Anzeigemodus die Anzeige-Policy zurücksetzen.

**Testmatrix:** neutrales Gerät in Handhaltung, getrennte Pitch/Roll/Yaw-Eingaben, 360°-Drehung im begrenzten Modus, Neigungs-Hold bei Ruhe ohne Rückfederung, sofortiges Lösen vom Anschlag bei Rückdrehung, Jitter um die Neutralposition, 30/60/120 FPS, stales HID-Frame nach Tab-/App-Pause. `Full360` wird niemals durch die Frontfeder beeinflusst.

## v14: Auto-Connect und Live-Gamepad

- Browser: Gamepad API liefert nur Knöpfe, Sticks und Trigger. Vorher genehmigte WebHID-Geräte können nach Aktivierung ohne erneute Genehmigung via `navigator.hid.getDevices()` geöffnet werden; die *erste* Genehmigung erfordert immer einen echten User-Klick.
- Native ExoSnap: GameInput ist standardmäßig bereits die Quelle für Buttons/Sticks/Trigger. Die automatische Sensorinitialisierung kann über den vorhandenen deduplizierten Geräte-/Capability-Service erfolgen; **kein Browser-Permission-Flow** und keine doppelte HID-Session im Core.
- Dynamisches Overlay: Button-Stärke 0..1 auf Farbe/Emission/Alpha abbilden, Joystick-Vektoren (x,y) auf den Stick-Pivot, Joystick-Klick separat; gerätespezifische 3D-Namen müssen auf kanonische Input-IDs normalisiert sein.
- Native Integration sollte die Anzeige-Modi und Empfindlichkeit optional pro Overlay konfigurierbar halten. Begrenzung und Glättung gehören ausschließlich in Presentation, nicht in Rohinput oder MotionFusion.


## V15: Display-only Ergonomie-Regelung

Die native 3D-Overlay-View sollte zur Sensornormalisierung getrennte `MotionViewSettings` besitzen: `pitchGain=0.75`, `rollGain=0.65`, `yawGain=0.55`, `pitchLimitDeg=35`, `rollLimitDeg=22`, `yawLimitDeg=25`, `displayDeadzoneDeg=0.35`, `responseMs=65`, `autoReturn=false`. Optionaler Timeout `returnDelayMs=850`, `returnHalfLifeMs=1350`.

Der Sensorzustand (rad/s, m/s², relative Quaternion) bleibt unverändert. Die Ansicht integriert nur relative Quaternion-Deltas und sättigt pro Achse ohne Winkelstau. Ein Rückkehr-Toggle ist View-only und darf keine neue Hardware-Kalibrierung auslösen. `360°` verwendet die unveränderte Quaternion; „Direkt ±“ übernimmt nur die einstellbaren Limits. Für den Windows-Host die Parameter nicht in den GameInput-Adapter legen, sondern in die pro Overlay gespeicherte Darstellungskonfiguration.

## v16: ergonomische Gesamtgrenzen im View-Layer

Das 3D-Overlay arbeitet mit folgenden **Darstellungsparametern** (keine IMU-Treiberparameter):

- Achsen-Gains: Pitch/Roll/Yaw `0.90`.
- Einzelcaps: Pitch/Roll/Yaw `20°`.
- Teilcap: `hypot(roll, yaw) <= 20°`.
- Gesamtcap: `hypot(pitch, roll, yaw) <= 25°`.
- Neutralpose: `-12°` Pitch zusätzlich zur relativen Anzeige (nicht in Gesamtcap einrechnen).
- Visual-Deadzone `0.20°`, Response-Konstante `50 ms`, Auto-Recenter standardmäßig `false`.
- Bei einem Limit wird **der inkrementelle Anzeige-Akkumulator** projiziert, nicht nur die gerenderte Pose. Sonst entsteht Wind-up beim Rückbewegen.
- Kleine Gyroinkremente dürfen nicht pro Rohframe verworfen werden; Aktivität/Stillstand über kurze Zeitfenster erkennen. 3°/s bei 120 Hz liefert nur 0,025° pro Frame.
- Regler wirken ausschließlich in `Handhaltung`/`Direkt ±`; `360° frei` und die physikalischen Sensordaten bleiben unmodifiziert.

Die v16-Implementation ist ein Browser-Prototyp. Ein Hardware-Audit ist für das finale native C++-Overlay weiterhin nötig.


## v17: Automatische Tisch-/Hand-Haltungswechsel nur im Presentation-Layer

Für `StabilizedHandheld` kommt eine optionale `PostureTransitionGuard`-View-Policy hinzu:

- Eingaben: `MotionFrame.accelMetersPerSecSquared`, `gyroRadPerSec`, ein monotoner Timestamp sowie Gamepad-Tasten-/Stickaktivität. Im normierten SDL/GameInput-Frame bedeutet flach auf dem Tisch ungefähr `accel = (0, +9.80665, 0)` m/s².
- Zustand: `unknown`, `table`, `transfer`, `hand`. Stabile Tisch-/Hand-Lage mit Hysterese erkennen. **Nur** bei einem bestätigten Transfer die Displayrotation vorübergehend halten.
- Beim Ende des Transfers `HandheldOverlayMotion.rebase(currentRelativeQuaternion,timestamp)` verwenden: neue lokale Anzeige-Referenz ohne Winkelspeicher, mit kontinuierlichem Rendering. **Weder** `MotionFusion.recenter()` **noch** GameInput-/HID-Rohdaten verändern.
- Das Erkennungs-Feature `autoPostureSwitch` getrennt von `autoReturn` konfigurieren (standardmäßig ein/aus). `DirectLimited` und `Full360` müssen unbearbeitet bleiben.
- Bei manuellem Recenter, Sensor-Neukalibrierung, Wechsel des Eingabecontrollers oder Bewegungsausgabe-Modus den Guard zurücksetzen. Bei stalen Sensorframes muss der angehaltene Anzeigezustand freigegeben werden.
- Schutz vor Fehlklassifikation: Tasten-/Stickaktivität hat Vorrang, Winkelgeschwindigkeit und Schwerkraftbetrag plausibilisieren; ein anhaltender Transfer darf nicht unbegrenzt die Anzeige einfrieren. Ein IMU kann Absicht nicht vollständig erkennen.

**Abnahme vor ExoSnap-Integration:** DualSense über USB und Bluetooth auf realem Tisch und in gewöhnlicher Handhaltung mehrmals aufheben/ablegen; absichtlich ohne und mit Tastendruck neigen, 360°-Modus, verschiedene Aufnahme-FPS und Haltungen auf leicht schiefem Untergrund kontrollieren. Die Browserimplementierung ist nur ein geprüfter Ansatz, keine Hardwarevalidierung.


## v20 – Übergabe Ghost/Joystick/Input

- Pressed-state bei wechselnden Eingabequellen mit kurzer zeitbasierter Freigabeverzögerung stabilisieren, niemals Controller/Sensorströme blockieren oder Release dauerhaft speichern; Quellenstempel als Diagnose vorhalten.
- Analoge Stickbewegung vom Stick-Klick getrennt modellieren. Originales Controller-Mesh + Ring-Pivot behalten; Cap als echtes volumetrisches 3D-Mesh und nicht als 2D-Markierung darstellen.
- Transparente Shell-Oberflächen und Konturen getrennt rendern. Für helle Bildhintergründe unter einer hellen Edge-Highlightlinie eine dunkle Screen-Space-Silhouettenlinie verwenden. Nicht transparente Rückplatten gedankenlos geometrisch zusammenschweißen – das führt oft nicht zu korrekter Glas-Transparenz.
- Bei nativer Umsetzung die gleichen Tests für WebHID-, GameInput- und Gerätewechsel mit aufgezeichneten realen Reportfolgen wiederholen.

## v21-Addendum: Controller-Parität

Der lokale v21-Prototyp enthält erstmals einen **semantischen Katalog** (`controller-catalog.js`) mit allen 20 mitgelieferten 2D-Identitäten und markiert 3D-Modelle als `native`, `proxy`, `composite` oder `reference`. Das ist noch keine Änderung am nativen Rust/C++/QML-Gamepad-Overlay.

Die 2D-Vorlagen liegen unter `references/controllers/`, die Browserreferenz `controller-reference.js` ist **nicht** identisch mit dem nativen `GamepadSprites`-Renderer. Neue Referenzdaten `knockout`/`pressColor` erfordern weiterhin eine eigene native Umsetzung; der Browserpreview kann Druckfarben und den bewegten Stick-Ausschnitt nur anschaulich demonstrieren.

Für native Parität benötigt ExoSnap einen versionierten Controller-Descriptor mit semantischem Control-ID-Satz, Layerrollen, Modellvarianten, Perspektiv-/Riemenvarianten, Trigger- und Paddlesemantik, 2D-Catalog-ID und 3D-Modellquelle. Kein Fallthrough in falsche Controller-Generationen. 3D-Modellrechte vor jeglicher Auslieferung gesondert klären.

## v22-Addendum: 3D-Ghost-Tiefenmasken und physische Stickbewegung

- Native Renderpipeline: **depth-only prepass vor sichtbaren transparenten Ghost-Meshes und Linien**. Für Controller-Teile mit vollständig sichtbarer Frontpartie darf die farbliche Transparenz des Bodys **nicht** zugleich die Tiefenwirkung deaktivieren. Qt Quick 3D oder eine eigene QRhi-Renderstrecke muss für die Ghost-Außensilhouette und Button-/Stickmesh-Tiefen entsprechende Z-Write/Z-Test-Policies unterstützen.
- Ghost-Controls (D-Pad, Buttons, Triggers, Stick-Kappen) sollen eine **geschlossene, deckende Materialfläche** erhalten; Inputintensität moduliert Farbe und Emission, nicht die physische Sichtbarkeit hintenliegender Konturen. Gehäuse bleibt bei Bedarf schwach transparent, aber durch physische Meshes verdeckte Linien werden nicht durchgezeichnet.
- Pro Gerät **fixe Einfassung / beweglicher Pivot / physischer Schaft / geformte Originalkappe** unterscheiden. Die 2D-Zuordnung liefert IDs, aber nicht 3D-Hierarchie oder Pivot-Koordinaten. Stickachsen sind analog; L3/R3 bleibt unabhängiger Digitalzustand.
- Das Browser-Lab setzt die reine Tiefenmasken-Policy und eine einfache Schalenverformung um; die native GPU-Implementierung benötigt eine Sichtprüfung unter Windows, Tests auf Überlagerungs-Kanten, Tiefenpräzision, Close-up-Views und Kosten der zusätzlichen Mesh-Drawcalls.
- 2D-Knockouts: erst bei der späteren nativen 2D-Renderer-Anpassung umsetzen, nicht Bestandteil der v22-3D-Änderung. Qt Quick `MultiEffect` mit invertierter Alphamaske ist dafür eine mögliche Lösung; `Item.clip` reicht wegen rechteckiger Begrenzung nicht aus.
