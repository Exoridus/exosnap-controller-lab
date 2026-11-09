import QtQuick
import QtQuick3D
import QtQuick3D.AssetUtils

// Qt 6.12+ development/inspection component. The host supplies rig.json and
// canonical GamepadState v1. No hardware input, browser Gamepad index, or
// per-frame node-name search. For production import model.glb through Balsam.
Node {
    id: pack
    property url modelSource
    property var rigData: ({ parts: [] })
    property var frame: ({ buttons: {}, axes: {} })
    readonly property bool ready: loader.status === RuntimeLoader.Success
    readonly property string loadError: loader.errorString
    property var partNodes: ({})
    signal rigReady()

    RuntimeLoader {
        id: loader
        source: pack.modelSource
        onStatusChanged: {
            if (status === RuntimeLoader.Success)
                pack.cacheNodes()
            else if (status === RuntimeLoader.Error)
                console.warn("Controller GLB failed:", errorString)
        }
    }

    function cacheNodes() {
        var found = {}
        for (var i = 0; i < rigData.parts.length; ++i) {
            var part = rigData.parts[i]
            var node = loader.query(part.node)
            if (!node)
                console.warn("Missing controller pivot:", part.node)
            else
                found[part.node] = node
        }
        partNodes = found
        applyFrame()
        rigReady()
    }

    function multiply(a, b) {
        // Quaternion source format is glTF [x,y,z,w]; Qt.quaternion is w,x,y,z.
        return [
            a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
            a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
            a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
            a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]
        ]
    }

    function xRotation(degrees) {
        var half = degrees * Math.PI / 360
        return [Math.sin(half), 0, 0, Math.cos(half)]
    }

    function stickRotation(x, y, tilt, frontSign) {
        var a = y * tilt * Math.PI / 360
        var b = -x * tilt * frontSign * Math.PI / 360
        var sx = Math.sin(a), cx = Math.cos(a)
        var sz = Math.sin(b), cz = Math.cos(b)
        return [sx*cz, -sx*sz, cx*sz, cx*cz]
    }

    function scalar(v) {
        return Math.min(1, Math.max(0, Number(v) || 0))
    }

    function applyFrame() {
        if (!ready || !rigData || !frame)
            return
        var buttons = frame.buttons || {}
        var axes = frame.axes || {}
        for (var i = 0; i < rigData.parts.length; ++i) {
            var part = rigData.parts[i]
            var target = partNodes[part.node]
            if (!target || !part.motion)
                continue
            var m = part.motion, p = part.pivot, rest = part.rotation
            var amount = 0, delta = [0, 0, 0], q = [0, 0, 0, 1]
            if (m.kind === "stick") {
                var stick = axes[m.axis] || { x: 0, y: 0 }
                var x = Math.max(-1, Math.min(1, Number(stick.x) || 0))
                var y = Math.max(-1, Math.min(1, Number(stick.y) || 0))
                q = stickRotation(x, y, m.maxTiltDegrees, m.frontSign)
                amount = scalar(buttons[m.axis + "_click"])
                delta[1] = -m.clickTravel * amount
            } else {
                amount = scalar(buttons[m.control])
                delta = m.translation.map(function(v){ return v * amount })
                if (m.kind === "trigger")
                    q = xRotation(m.angleXDegrees * amount)
            }
            target.position = Qt.vector3d(p[0]+delta[0],p[1]+delta[1],p[2]+delta[2])
            var rotated = multiply(rest, q)
            target.rotation = Qt.quaternion(rotated[3],rotated[0],rotated[1],rotated[2])
        }
    }

    onRigDataChanged: if (ready) cacheNodes()
    onFrameChanged: applyFrame()
}
