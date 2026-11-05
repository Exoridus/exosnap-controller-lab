import QtQuick
import QtQuick3D

// Example of the SAME normalized light positions as pbr-recipes.js.
// Brightness is intentionally exposed through factors for per-engine
// photometric calibration. This file is not an OBJ importer.
Node {
    id: root
    property real keyBrightness: 22.0
    property real rimBrightness: 2.6
    property real fillBrightness: 1.0
    property real ambientBrightness: 0.54
    property real pointCalibration: 1.0
    property real directionalCalibration: 1.0

    PointLight {
        visible: root.keyBrightness > 0
        position: Qt.vector3d(-3, 4, 6)
        color: "#ffffff"
        brightness: root.keyBrightness * root.pointCalibration
        constantFade: 1.0
        linearFade: 0.0
        quadraticFade: 1.0
        castsShadow: false
    }
    PointLight {
        visible: root.rimBrightness > 0
        position: Qt.vector3d(2.2, 1.7, -3.0)
        color: "#e1eeff"
        brightness: root.rimBrightness * root.pointCalibration
        constantFade: 1.0
        linearFade: 0.0
        quadraticFade: 1.0
        castsShadow: false
    }
    DirectionalLight {
        visible: root.fillBrightness > 0
        // Three.js fill.position = (4,2,5), target=(0,0,0).
        // Convert this world-space vector to the correct Qt node orientation
        // during import; do not copy Euler angles blindly.
        color: "#d9ebff"
        // Ambient remains active for the clean one-directional-light profiles.
        ambientColor: Qt.rgba(root.ambientBrightness, root.ambientBrightness, root.ambientBrightness, 1)
        brightness: root.fillBrightness * root.directionalCalibration
        castsShadow: false
    }
}
