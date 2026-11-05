// Ghost is a translucent *appearance*, not X-ray geometry.
// Rendering depth-only geometry first ensures that front-facing buttons,
// stick caps and housing hide any back-side and internal mesh/feature lines.
// This is intentionally independent of the controller input and motion paths.
export const OCCLUSION_STYLES=Object.freeze(['ghost','glass']);
export function usesPhysicalDepthMask(style){
  return OCCLUSION_STYLES.includes(style);
}
export function isSolidGhostPart(role){
  return ['button','trigger','paddle','touch-surface','stick-base','stick-pivot','stick-stem','stick-cap'].includes(role);
}
export function physicalDepthPolicy(style,role){
  return {
    enabled:usesPhysicalDepthMask(style)&&role!=='touch-contact',
    colorWrite:false,
    depthTest:true,
    depthWrite:true,
    // Opaque depth prepass, ahead of both translucent housing and contours.
    renderOrder:-100,
    side:'double',
  };
}
