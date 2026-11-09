// A deliberately guided IMU calibration. The user first moves the controller
// in a known physical direction, allowing us to learn gyro axis + sign instead
// of assuming the raw DualSense axes match the rendered model's axes.
const GYRO_DPS_PER_COUNT = 1/16.384;
const EXPECTED_SIGNS = [1,-1,1]; // raise triggers; raise right grip; yaw nose to left
const PERMUTATION_NAMES = ['Pitch','Roll','Yaw'];
export const DEFAULT_AXIS_MAPPING = Object.freeze([
  {index:0,sign:1},{index:2,sign:-1},{index:1,sign:1}
]);
export const AXIS_INSTRUCTIONS = Object.freeze([
  '1/3 · Schultertasten anheben (zuerst nach oben, dann zurück)',
  '2/3 · Rechten Griff anheben (zuerst nach oben, dann zurück)',
  '3/3 · Schultertasten nach links drehen (zuerst nach links, dann zurück)'
]);
export function mapAxes(values, mapping=DEFAULT_AXIS_MAPPING){
  if(!Array.isArray(values)||values.length!==3||!validAxisMapping(mapping))throw Error('Invalid IMU axis mapping');
  return mapping.map(({index,sign})=>sign*values[index]);
}
export function signedPermutationDeterminant(mapping){
  if(!Array.isArray(mapping)||mapping.length!==3)return NaN;
  const order=mapping.map(x=>x.index);
  if(order.some(x=>!Number.isInteger(x)||x<0||x>2)||new Set(order).size!==3)return NaN;
  let inversions=0;
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(order[i]>order[j])inversions++;
  return (inversions%2?-1:1)*mapping.reduce((v,x)=>v*x.sign,1);
}
export function validAxisMapping(m){
  return Array.isArray(m)&&m.length===3&&
    m.every(x=>x&&Number.isInteger(x.index)&&x.index>=0&&x.index<3&&(x.sign===1||x.sign===-1))&&
    new Set(m.map(x=>x.index)).size===3&&signedPermutationDeterminant(m)===1;
}
export class AxisAlignment {
  constructor(){this.start();}
  start(){this.step=0;this.status='idle';this.mapping=null;this.partial=[];this.message='';this.progress=0;this.startedAt=0;this.lastTs=null;this.integrated=[0,0,0];}
  beginCapture(now=0){
    if(this.status==='complete')return false;
    this.status='capturing';this.message=AXIS_INSTRUCTIONS[this.step]||'';
    this.startedAt=now;this.lastTs=now;this.integrated=[0,0,0];this.progress=0;
    return true;
  }
  feed({gyroRaw,gyroBias=[0,0,0],now}){
    if(this.status!=='capturing')return this.status;
    if(!Number.isFinite(now)||!Array.isArray(gyroRaw)||gyroRaw.length!==3)return this.status;
    const dt=(now-this.lastTs)/1000;
    if(dt<=0||dt>0.12)return this.status;
    this.lastTs=now;
    const v=gyroRaw.map((x,i)=>Number.isFinite(x)?(x-(gyroBias[i]||0))*GYRO_DPS_PER_COUNT:0);
    if(!v.every(Number.isFinite))return this.status;
    // Ignore rest noise. Detect the first outward movement only; the return
    // stroke must not cancel it or invert the learned sign.
    if(Math.hypot(...v)<7)return this.status;
    for(let i=0;i<3;i++)this.integrated[i]+=v[i]*dt;
    const magnitudes=this.integrated.map(Math.abs);
    const best=magnitudes.indexOf(Math.max(...magnitudes));
    const sorted=[...magnitudes].sort((a,b)=>b-a);
    this.progress=Math.min(1,sorted[0]/12);
    if(sorted[0]<12)return this.status;
    if(sorted[1]>sorted[0]*.62){
      this.status='invalid';this.message='Bewegung uneindeutig – bitte gerade in die angezeigte Richtung bewegen';return this.status;
    }
    if(this.partial.some(x=>x.index===best)){
      this.status='invalid';this.message='Achse bereits belegt – diese Bewegung muss um eine andere Achse erfolgen';return this.status;
    }
    const sign=(Math.sign(this.integrated[best])||1)*EXPECTED_SIGNS[this.step];
    const candidate={index:best,sign};
    const next=[...this.partial,candidate];
    if(this.step===2&&signedPermutationDeterminant(next)!==1){
      this.status='invalid';this.message='Ausrichtung wäre gespiegelt – letzte Bewegung prüfen und wiederholen';return this.status;
    }
    this.partial=next;this.step++;
    if(this.step===3){this.mapping=next;this.status='complete';this.message='Achsen erfasst · Controller ruhig in die Ausgangslage zurückführen';}
    else {this.status='step-done';this.message=`${PERMUTATION_NAMES[this.step-1]} erkannt · zurück in Neutralposition, dann Weiter`;
    }
    return this.status;
  }
}
