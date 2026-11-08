import QtQuick
import QtQuick3D
import "../qt-quick3d-port" as Lab

// API/material smoke only, NOT a second controller renderer or parity proof.
Item {
    id: root
    width: 256; height: 256
    property real alpha: 0.3
    property real turn: 0
    property real press: 0
    View3D {
        anchors.fill: parent
        environment: SceneEnvironment {
            backgroundMode: SceneEnvironment.Transparent
            antialiasingMode: SceneEnvironment.NoAA
        }
        PerspectiveCamera { z: 250 }
        DirectionalLight { eulerRotation: Qt.vector3d(-20, -20, 0) }
        Node {
            eulerRotation.y: root.turn
            Model {
                source: "#Cube"
                materials: Lab.ControllerSurface {
                    originalColor: "#9ca3aa"
                    surfaceOpacity: root.alpha
                    pressedAmount: root.press
                    pressedBlue: "#ffffff"
                    pressedEmissive: "#ffffff"
                    pressedEmissiveIntensity: 0.16
                }
            }
        }
    }
}
