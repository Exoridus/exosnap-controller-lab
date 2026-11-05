// Fail closed on HTML error pages, Git LFS pointer stubs and empty mesh objects.
// Length alone is not enough: GitHub sometimes returns HTTP 200 for a placeholder.
export function inspectObjText(source) {
  if (typeof source !== 'string' || source.length < 40) return {valid:false,vertices:0,faces:0,reason:'empty OBJ response'};
  const vertices = (source.match(/^v[ \t]+[-+0-9.]/gm) || []).length;
  const faces = (source.match(/^f[ \t]+[0-9-]/gm) || []).length;
  const valid = vertices>=3 && faces>=1;
  return {valid,vertices,faces,reason:valid?'':`invalid OBJ: ${vertices} vertices, ${faces} faces (possibly cached HTML or a pointer file)`};
}
