// Single render policy: no physical-posture state may pause live orientation.
import {overlayOrientation,heldDirectOrientation} from './overlay-motion.js';
export function presentationOrientation({mode='overlay',relative,motion,adaptive,now=0}={}){
  if(mode==='free')return overlayOrientation(relative,'free');
  if(mode==='direct')return heldDirectOrientation(relative,motion?.options);
  const source=motion?.options?.adaptiveHand && adaptive?adaptive.corrected(relative):relative;
  return motion.update(source,now);
}
