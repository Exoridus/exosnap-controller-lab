import QtQuick3D
// Qt Quick 3D v39 reference: source HDRI is shared with Three.js RGBELoader.
// Use as the View3D.environment; scene needs no DirectionalLight/PointLight.
SceneEnvironment {
    backgroundMode: SceneEnvironment.Transparent
    antialiasingMode: SceneEnvironment.MSAA
    antialiasingQuality: SceneEnvironment.High
    lightProbe: Texture { source: "../assets/studio-neutral.hdr" }
    probeExposure: 1.0 // compare against Three scene.environmentIntensity per renderer
}
