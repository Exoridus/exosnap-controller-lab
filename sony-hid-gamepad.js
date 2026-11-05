// Independent live buttons/analog controls from the same Sony HID reports
// already used for IMU. A WebHID session may coexist with a stale browser
// Gamepad API snapshot; prefer the freshest Sony HID report in that case.
// Report offsets follow the SDL3 PS4/PS5 HIDAPI packet definitions.
import {deadzonePair} from './gamepad-input.js';
const EMPTY_AXES=Object.freeze({x:0,y:0,amount:0});
const readUnit=(view,index)=>view.getUint8(index)/255;
const normalizedStick=v=>(v-127.5)/127.5;

export function emptyLiveGamepadState(id=''){
  return {values:new Map(),left:{...EMPTY_AXES},right:{...EMPTY_AXES},rawLeft:{x:0,y:0},rawRight:{x:0,y:0},id,index:-1,timestamp:0};
}
function setButton(values,name,down,amount=1){if(down && amount>.08)values.set(name,amount);}
export function parseSonyHidGamepad(profileId,reportId,data){
  if(!(data instanceof DataView))return null;
  const ds=profileId==='dualsense';
  if(!ds && profileId!=='ds4')return null;
  const offset=ds ? (reportId===0x01 && data.byteLength>=10?0:
      reportId===0x31 && data.byteLength>=64?1:-1) :
    (reportId===0x01 && data.byteLength>=30?0:
      reportId>=0x11 && reportId<=0x19 && data.byteLength>=32?2:-1);
  if(offset<0)return null;
  const i=offset+(ds?7:4);
  if(data.byteLength<i+3)return null;
  const face=data.getUint8(i),shoulders=data.getUint8(i+1),special=data.getUint8(i+2);
  const hat=face&0x0f;
  const values=new Map();
  setButton(values,'b1',(face&0x20)!==0); // Cross/South
  setButton(values,'b2',(face&0x40)!==0); // Circle/East
  setButton(values,'b3',(face&0x10)!==0); // Square/West
  setButton(values,'b4',(face&0x80)!==0); // Triangle/North
  setButton(values,'up',hat===0||hat===1||hat===7);
  setButton(values,'right',hat===1||hat===2||hat===3);
  setButton(values,'down',hat===3||hat===4||hat===5);
  setButton(values,'left',hat===5||hat===6||hat===7);
  setButton(values,'l1',Boolean(shoulders&0x01));
  setButton(values,'r1',Boolean(shoulders&0x02));
  setButton(values,'select',Boolean(shoulders&0x10));
  setButton(values,'start',Boolean(shoulders&0x20));
  setButton(values,'ls',Boolean(shoulders&0x40));
  setButton(values,'rs',Boolean(shoulders&0x80));
  setButton(values,'home',Boolean(special&0x01));
  setButton(values,'touchpad',Boolean(special&0x02));
  const leftTrigger=readUnit(data,offset+(ds?4:7));
  const rightTrigger=readUnit(data,offset+(ds?5:8));
  // The physical trigger pressure must not become 100% just because its
  // accompanying digital pressed flag becomes true at a low threshold.
  setButton(values,'l2',Boolean(shoulders&0x04)||leftTrigger>.08,leftTrigger||((shoulders&0x04)?1:0));
  setButton(values,'r2',Boolean(shoulders&0x08)||rightTrigger>.08,rightTrigger||((shoulders&0x08)?1:0));
  const rawLeft={x:normalizedStick(data.getUint8(offset)),y:normalizedStick(data.getUint8(offset+1))};
  const rawRight={x:normalizedStick(data.getUint8(offset+2)),y:normalizedStick(data.getUint8(offset+3))};
  const left=deadzonePair(rawLeft.x,rawLeft.y);
  const right=deadzonePair(rawRight.x,rawRight.y);
  return {values,left,right,rawLeft,rawRight,id:ds?'DualSense via WebHID':'DualShock 4 via WebHID',index:-1,timestamp:0};
}
export function chooseLiveGamepadInput({standard=null,hid=null,hidAgeMs=Infinity,sonyHidConnected=false,standardFresh=false}={}){
  if(sonyHidConnected){
    if(hid && Number.isFinite(hidAgeMs) && hidAgeMs>=0 && hidAgeMs<=450)
      return {state:hid,source:'WebHID'};
    // Never revive an old L3 press from a browser snapshot frozen before
    // WebHID took over. A NEW Gamepad API timestamp can be used as fallback.
    if(standard && standardFresh)return {state:standard,source:'Gamepad API (fallback)'};
    return {state:emptyLiveGamepadState(standard?.id||hid?.id),source:'stale'};
  }
  return {state:standard||emptyLiveGamepadState(),source:standard?'Gamepad API':'unavailable'};
}

// The first browser snapshot after a reload may already report a held button.
// It is a baseline, NOT evidence that a new button event has arrived. Only
// changed timestamps (or changed states if a browser lacks timestamps) are
// allowed to stand in for a temporarily unavailable Sony HID stream.
export class BrowserGamepadFreshness {
  constructor(){this.reset();}
  reset(){this.lastId=null;this.lastStamp=null;this.lastSignature=null;this.changedAt=-Infinity;}
  observe(state,now){
    if(!state){this.reset();return false;}
    const key=state.index+':'+state.id;
    const signature=JSON.stringify([Array.from(state.values),state.left,state.right,state.rawLeft,state.rawRight]);
    const stamp=Number(state.timestamp)||0;
    if(this.lastId!==key){this.lastId=key;this.lastStamp=stamp;this.lastSignature=signature;this.changedAt=-Infinity;return false;}
    const changed=stamp>0?stamp!==this.lastStamp:signature!==this.lastSignature;
    if(changed)this.changedAt=now;
    this.lastStamp=stamp;this.lastSignature=signature;
    return now-this.changedAt<=450;
  }
}
