const defaults = {innerDeadzone:.05, outerSaturation:.05, maxTiltDeg:16, gate:{type:'circle'}, clickTravel:.008};
const octagon = {type:'polygon', vertices:Array.from({length:8},(_,i)=>({x:Math.cos(i*Math.PI/4),y:Math.sin(i*Math.PI/4)}))};

export const MODEL_MECHANICS = {
  DualSenseCompact: {
    authoredCapAssembly:true,
    sticks:{left:{maxTiltDeg:14,pivot:[-.32,.2,-.02]},right:{maxTiltDeg:14,pivot:[.32,.2,-.02]}},
    triggers:{maxRotationDeg:16,travel:0},
    references:{
      hardware:{maxTiltDeg:25,kind:'approximate study measurement',source:'https://catalog.lib.kyushu-u.ac.jp/opac_download_md/7329489/design0340.pdf'},
      viewer:{maxTiltDeg:14,triggerRotationDeg:16,kind:'user-supplied animation reference, upstream source not independently retrieved',source:'https://github.com/Valkirie/HandheldCompanion/blob/main/HandheldCompanion/3DModels/ModelDualSense.cs'}
    }
  },
  Gamecube: {
    authoredCapAssembly:true,
    sticks:{left:{maxTiltDeg:16,pivot:[-.55,.16,-.21],gate:octagon,clickTravel:0},right:{maxTiltDeg:16,pivot:[.3,.13,.19],gate:octagon,clickTravel:0}},
    triggers:{maxRotationDeg:0,travel:0,translation:[0,0,.08]},
    references:{hardware:null,viewer:null,gate:'Regular octagon approximation, not measured notch coordinates'}
  },
  XboxOneClean:{
    authoredCapAssembly:true,
    sticks:{left:{maxTiltDeg:17},right:{maxTiltDeg:17}},
    references:{viewer:{maxTiltDeg:17,kind:'Handheld Companion animation limit, not a measured physical bound'}}
  },
  SwitchPro:{
    authoredCapAssembly:true,
    sticks:{left:{maxTiltDeg:15},right:{maxTiltDeg:15}},
    references:{hardware:{maxTiltDeg:15,kind:'approximate published physical measurement'}}
  }
};

export function stickMechanics(modelId,side){
  return {...defaults,...MODEL_MECHANICS[modelId]?.sticks?.[side]};
}

export function triggerMechanics(modelId){
  return MODEL_MECHANICS[modelId]?.triggers ?? {maxRotationDeg:.19*180/Math.PI,travel:.025};
}
