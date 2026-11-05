# Referenzanalyse – Controller-Bewegung und 3D-Overlays

Geprüft: 31.10.2026. Hier stehen **belegte Projektwerte**, **unbekannte Werte** und die **eigenen ExoSnap-Testparameter** getrennt. Gyro-Aiming-Einstellungen sind nicht automatisch sinnvoll für eine visuelle Controller-Animation.

## PadForge

Quelle: https://padforge.org/docs/guides/gyro/

- **Gyro-Kalibrierung:** ruhender Controller, etwa **1,5 s** Messzeit; danach wird der Bias abgezogen.
- **Gyro-Smoothing (für Eingaben):** unter **3°/s** das Mittel aus dem Puffer; ab **8°/s** unverändertes Rohsignal; dazwischen Mischung. Standard-Fenster **50 ms**.
- **Gyro-Sensitivität:** horizontal (Yaw/Roll) und vertikal (Pitch) getrennt, **0,1–10×**. Standardbezug für 1× ≈ 360° Kameradrehung pro physischem Vollkreis.
- **Koordinaten:** Local (Standard), Player (um Schwerkraft vertikal projiziert), World (zusätzliche Vertikalprojektion).
- **Motion Passthrough:** zusätzliche Filterung der an Spiele weitergereichten Sensorwerte ist **standardmäßig aus**; nur Bias wird korrigiert.
- **Motion Lean als Lenkeingabe:** innere Deadzone **15°**, äußere Grenze **135°**; volle Achsenauslenkung bei 45° Kippung aus der Neutralposition. Quelle: https://padforge.org/docs/guides/steering/
- **3D-Viewer:** reale Modelle, direkte Button-/Stick-/Triggeranimation und interaktive Kamera. **Keinen nachgewiesenen Default für 60-Sample-Neutralposition oder automatisches Neuausrichten der 3D-Viewer-Pose gefunden.**

**Übertragbar:** getrennter langsamer und schneller Pfad sowie ein sensorgestütztes Eingabe-/Diagnose-UI. Die 15°-Lenkdeadzone NICHT für das 3D-Overlay übernehmen.

## JoyShockOverlay / JoyShockMapper / JoyShockLibrary

Quellen:
- https://gyrowiki.jibbsmart.com/blog:joyshockmapper-3-and-the-future
- https://github.com/JibbSmart/JoyShockMapper/blob/master/README.md
- https://github.com/JibbSmart/JoyShockLibrary/blob/master/README.md

- **JoyShockOverlay:** live 3D-Controller als Streaming-Overlay dokumentiert; **keine öffentliche, überprüfbare Liste numerischer Pose-/Smoothing-Defaults** oder vollständige Filterimplementierung gefunden.
- **JoyShockMapper:** Standard `GYRO_SMOOTH_THRESHOLD=0 °/s` (bei Null keine zusätzliche Glättung), konfigurierbarer `GYRO_SMOOTH_TIME=0.125 s` wenn Glättung aktiv ist. Starker Cutoff kann absichtlich langsame Bewegungen unterdrücken.
- **JoyShockLibrary:** automatische Ruhekalibrierung mit einstellbaren Methoden und Konfidenz; Stop/Start und einmaliger Offset auch explizit möglich.
- **GamepadMotionHelpers:** mindestens **10** Stillstandssamples, **0,5 s** Sammlungszeit, **2 s** für die minimale Ruhe-Korrektur. Dynamische Schwerkraftkorrektur je nach Bewegungsunruhe.

**Übertragbar:** keine harte Sperre, langsame Bewegungen bleiben intakt; Gyro-Bias und sichtbare Pose unabhängig halten.

## OmniControl Live Viewer / Overlay Studio

Quellen:
- https://omnicontrol.me/features/controller
- https://omnicontrol.me/features/motion
- https://omnicontrol.me/features/overlay

- **Live Viewer:** 3D-Controller mit Tasten-, Stick-, Triggeranimation, Batteriedaten, Verbindung und Motion-Visualizer.
- **Motion Aiming:** regelbare Sensitivität und Smoothing, Kalibrierung, Always-On oder gedrückt-gehaltene Aktivierung, Stick-Kombination.
- **Overlay Studio:** separates transparentes Fenster, Opazität/Größe/Position, Klickdurchlässigkeit und OBS-Nutzung.
- **Nicht veröffentlicht beziehungsweise nicht nachprüfbar:** Standardwerte der **3D-Pose-Anpassung**, einer **60-Sample-Mittelung**, fixer **20°-Drehlimits** oder eines automatischen Handhaltungs-Recents.

**Übertragbar:** Motion-Diagnostik getrennt vom öffentlichen Overlay; UI-Einstellungen für die Darstellung, nicht mit der IMU-Kalibrierung vermischen.

## Emulator / Filterreferenzen

- **Dolphin** (https://github.com/dolphin-emu/dolphin/blob/master/Source/Core/InputCommon/ControllerEmu/ControlGroup/IMUGyroscope.cpp): Gyro-Deadzone **2°/s**, stabile Kalibrierungsdauer **3 s**, minimale Abtastrate während der Kalibrierung **25 Hz**.
- **GamepadMotionHelpers** (https://github.com/JibbSmart/GamepadMotionHelpers/blob/master/GamepadMotion.hpp): Stillstandserkennung und mit Unruhe gewichtete Schwerkraftkorrektur; kein für ein Overlay vorgegebener 20°-Grenzwinkel.

## Eigenes ExoSnap-Experiment „Adaptiv 60“ (NICHT von den Projekten übernommen)

| Parameter | Testwert | Funktion |
| --- | ---: | --- |
| Baseline-Puffer | 60 timestamped Quaternions, ca. 1 s | Nur langsamere Handreferenz |
| Pufferabtastung | maximal 60 Hz | Unabhängig von USB-/BT-Sensorrate |
| Ruhefenster | 0,5 s | Erst danach darf sich die Referenz bewegen |
| Ruhevalidierung | Gyro <3°/s, Accel-Betrag 0,92–1,08 g, keine aktive Taste/Sticks | Bewusst konservativer Test, nicht mit PadForge-Inputdeadzone gleichsetzen |
| Anpassung | 2 s Halbwertszeit | Weicher Drift zum längeren Handwinkel |
| Bewegungsreaktion | 45 ms am Motionfilter + 15 ms am Präsentationsfilter | Fast Path bleibt getrennt |
| Einzelne Winkel | Pitch/Roll/Yaw je ±20° | Getrennte Grenzen |
| Roll + Yaw gemeinsam | 20° | Diagonale Begrenzung |
| Alle drei gemeinsam | 20° | Gesamtbudget |
| Auto-Recenter | AUS | Kein starrer Timer |
| Haltungssperre | **keine** | Jedes gültige Motion-Frame darf weiterfließen |

**Nicht gemessen:** Empirisch beste Werte am echten DualSense, reale End-zu-End-Latenz, Verhalten bei schleichender bewusster Rotation und unter starker lineare Beschleunigung. Das Preset ist opt-in und dient genau diesem A/B-Vergleich.
