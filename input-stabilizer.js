// Keeps visible button presses stable across one dropped HID report or a
// momentary Gamepad API/WebHID handoff. It never fabricates sensor data and
// never extends a disconnected/stale press indefinitely.
const ACTIVE_SOURCES = new Set(['WebHID', 'Gamepad API', 'Gamepad API (fallback)']);

export class LiveButtonStabilizer {
  constructor({releaseGraceMs=48,staleGraceMs=90}={}) {
    this.releaseGraceMs=releaseGraceMs;
    this.staleGraceMs=staleGraceMs;
    this.reset();
  }
  reset(){this.buttons=new Map();this.lastValidAt=-Infinity;}
  update(state,source,now){
    const current=state || {values:new Map(),left:{x:0,y:0,amount:0},right:{x:0,y:0,amount:0}};
    const valid=ACTIVE_SOURCES.has(source);
    const raw=current.values || new Map();
    if(valid){
      this.lastValidAt=now;
      for(const [key,value] of raw){
        if(value>.08)this.buttons.set(key,{value,lastSeen:now});
      }
    }
    const values=new Map();
    for(const [key,entry] of this.buttons){
      const age=now-entry.lastSeen;
      if((valid && age<=this.releaseGraceMs) || (!valid && now-this.lastValidAt<=this.staleGraceMs && age<=this.staleGraceMs)){
        values.set(key,entry.value);
      }else{
        this.buttons.delete(key);
      }
    }
    return {...current,values};
  }
}
