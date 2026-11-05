import QtQuick
import QtQuick3D

// Material-only reference, to be attached to actual imported mesh parts.
// The native OBJ+manifest importer must provide originalColor for each part.
PrincipledMaterial {
    id: surface
    property color originalColor: "#e5e8ea"
    property color ghostColor: "#becad5"
    property real sourceWeight: 1.0
    property bool unlit: false
    property real surfaceOpacity: 1.0
    property real surfaceRoughness: 0.7
    property real surfaceMetalness: 0.0
    property real surfaceClearcoat: 0.1
    property real surfaceClearcoatRoughness: 0.3
    // Shared v37 2D/3D LED palette (see palette.js and exported JSON).
    property color idleControl: "#a4c5df"
    property color pressedBlue: "#4f9eeb"
    property color pressedEmissive: "#85c4fa"
    property real pressedEmissiveIntensity: 0.88
    property real pressedAmount: 0.0 // 0..1 from the canonical control state
    property real pressedOpacity: 1.0
    readonly property real pressWeight: Math.min(1.0, Math.max(0.0, surface.pressedAmount))


    baseColor: Qt.rgba(
        (originalColor.r * sourceWeight + ghostColor.r * (1.0 - sourceWeight)) * (1.0 - pressWeight) + pressedBlue.r * pressWeight,
        (originalColor.g * sourceWeight + ghostColor.g * (1.0 - sourceWeight)) * (1.0 - pressWeight) + pressedBlue.g * pressWeight,
        (originalColor.b * sourceWeight + ghostColor.b * (1.0 - sourceWeight)) * (1.0 - pressWeight) + pressedBlue.b * pressWeight, 1.0)
    emissiveFactor: surface.unlit ? Qt.vector3d(0, 0, 0) : Qt.vector3d(
        pressedEmissive.r * pressedEmissiveIntensity * pressedAmount,
        pressedEmissive.g * pressedEmissiveIntensity * pressedAmount,
        pressedEmissive.b * pressedEmissiveIntensity * pressedAmount)
    lighting: surface.unlit ? PrincipledMaterial.NoLighting : PrincipledMaterial.FragmentLighting
    roughness: surfaceRoughness
    metalness: surfaceMetalness
    clearcoatAmount: surfaceClearcoat
    clearcoatRoughnessAmount: surfaceClearcoatRoughness
    opacity: pressedAmount > 0.001 ? 1.0 : surfaceOpacity
    // Qt's AlwaysDepthDraw is necessary for semitransparent shells, but the
    // final native mesh sort must still be checked for physical occlusion.
    depthDrawMode: Material.AlwaysDepthDraw
    alphaMode: (pressedAmount < 0.001 && surfaceOpacity < 0.999) ? PrincipledMaterial.Blend : PrincipledMaterial.Opaque
    blendMode: PrincipledMaterial.SourceOver
}
