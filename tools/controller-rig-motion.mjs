// Renderer-independent motion descriptors, matching the lab's authored
// holder hierarchy. The Qt port animates pivots, never raw mesh vertices.
import {stickMechanics,triggerMechanics} from '../model-mechanics.js';
import {pressTravelFor} from '../v24-policy.js';
import {canonicalControlId} from '../controller-pack-contract.js';

export function describeRigMotions(native){
  const parts=native.parts||[],motion=new Map(),source=native.model?.source||'co';
  const byFile=file=>parts.find(p=>p.file===file);
  for(const side of ['left','right']){
    const stem=byFile(side+'_stick.obj')?.holder;
    const ring=byFile(side+'_ring.obj')?.holder;
    const selected=ring&&stem?.parent===ring?ring:stem;
    if(!selected)continue;
    const spec=stickMechanics(native.model?.id,side);
    motion.set(selected,{kind:'stick',axis:side+'_stick',
      maxTiltDegrees:spec.maxTiltDeg,clickTravel:spec.clickTravel||0,
      frontSign:source==='padforge'?-1:1});
  }
  const trigger=triggerMechanics(native.model?.id);
  for(const part of parts){
    const holder=part.holder,key=holder.userData.control,role=holder.userData.role;
    if(!key||motion.has(holder)||role.startsWith('stick-'))continue;
    const canonical=canonicalControlId(key);
    if(!canonical)continue;
    if(role==='trigger'){
      motion.set(holder,{kind:'trigger',control:canonical,
        angleXDegrees:-(trigger.maxRotationDeg||0),
        translation:trigger.translation||[0,0,0]});
    }else if(!['housing','decoration','touch-contact'].includes(role)){
      const p=pressTravelFor(key,source==='padforge'?'padforge':'co');
      motion.set(holder,{kind:'press',control:canonical,translation:[p.x,p.y,p.z]});
    }
  }
  return motion;
}
