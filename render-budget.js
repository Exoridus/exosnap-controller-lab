// Per-panel rendering diagnostics. Never divide an aggregated total by three.
const metric=(x)=>({calls:x?.calls??0,triangles:x?.triangles??0});
export function summarizePanelBudget({mode,sceneNames,source=null,blits=[],direct=[]}){
  if(!Array.isArray(sceneNames)||sceneNames.length===0)throw Error('Expected scene names');
  if(mode!=='shared'&&mode!=='direct')throw Error(`Unknown budget mode ${mode}`);
  const panels={};let calls=0,triangles=0,sourceCalls=0;
  if(mode==='shared'){
    const src=metric(source);calls=src.calls;triangles=src.triangles;sourceCalls=src.calls;
    sceneNames.forEach((name,i)=>{const blit=metric(blits[i]);panels[name]={calls:blit.calls,compositeCalls:blit.calls,triangles:blit.triangles,sourceCallsShared:sourceCalls};calls+=blit.calls;triangles+=blit.triangles;});
  }else{
    sceneNames.forEach((name,i)=>{const draw=metric(direct[i]);panels[name]={...draw,compositeCalls:0,sourceCallsShared:0};calls+=draw.calls;triangles+=draw.triangles;});
  }
  return {mode,calls,triangles,sourceCalls,panels};
}
