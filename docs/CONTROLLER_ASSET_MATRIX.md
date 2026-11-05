# ExoSnap controller asset status (2026-11-05)

Each of these **20 independent 2D layouts is already present** under `references/controllers/<id>/`. 3D availability below describes only genuine source geometry; proxies are not labelled as exact matches.

| 2D layout | Licensed 3D model | Status / next action |
|---|---|---|
| dualsense | DualSenseCompact | MIT native |
| dualshock4 | DS4Compact | MIT native |
| xbox_series | – | PadForge CGTrader source not cleared for redistribution; find separately licensed model |
| xbox_one | XboxOneClean | MIT native |
| generic | – | No single matching physical device; custom generic mesh needed |
| switch_pro | SwitchPro | MIT native |
| joycon_grip | JoyconGrip | MIT native |
| joycon_pair | JoyconLeft + JoyconRight | Two MIT native rigs available; combined layout/pose not implemented in the lab |
| joycon_left | JoyconLeft | MIT native |
| joycon_right | JoyconRight | MIT native |
| joycon_left_horizontal | JoyconLeft | MIT source available, horizontal pose not implemented; not an exact variant yet |
| joycon_right_horizontal | JoyconRight | MIT source available, horizontal pose not implemented; not an exact variant yet |
| steam_controller | – | No cleared 2015 Steam Controller geometry in the current sources |
| steam_deck_full | – | PadForge body is CC BY-NC-SA 4.0; not cleared for commercial use |
| steam_deck_compact | – | Same issue; no separate reusable compact 3D model |
| steam_controller_2026 | – | Model creator permission/asset rights unverified |
| xbox_360 | Xbox360 | MIT native |
| gamecube | Gamecube | MIT native (2D artwork independently GPL-3.0-only) |
| dualsense_edge | DualSenseCompact | Only original DualSense shell is approved; Edge-specific model remains uncleared |
| xbox_elite | – | Xbox Series paid-model source uncleared; custom back-paddles and geometry needed |

**10 licensed physical source model families** include WaveBird, which has no matching 2D source. **9 of the 20 2D layouts** currently have an exact licensed 3D model; other layouts are incomplete, composite, or require a new license/source. The browser lab selects only the nine exact matches, not unlicensed placeholders. Any new geometry modifications should keep upstream licensing and origin tracking.
