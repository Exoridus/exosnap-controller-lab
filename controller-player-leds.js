// Nintendo player LED patterns are taken from SDL's Switch HIDAPI driver.
// They represent assigned output patterns, never a measurement of physical LEDs.
// Browser Gamepad.index is an enumeration slot, NOT a player index.
export const SDL_SWITCH_LED_MASKS=Object.freeze([0x1,0x3,0x7,0xf,0x9,0x5,0xd,0x6]);
export const NINTENDO_LED_LAYOUTS=Object.freeze({
  switch_pro:Object.freeze([Object.freeze(['body-led-1','body-led-2','body-led-3','body-led-4'])]),
  joycon_grip:Object.freeze([
    Object.freeze(['body-led-l1','body-led-l2','body-led-l3','body-led-l4']),
    Object.freeze(['body-led-r1','body-led-r2','body-led-r3','body-led-r4'])
  ])
});
export function ledMaskForPlayerIndex(index){
  if(index===-1)return 0;
  if(!Number.isSafeInteger(index)||index<0)throw new RangeError('Invalid player index');
  return SDL_SWITCH_LED_MASKS[index%SDL_SWITCH_LED_MASKS.length];
}
// Browser-only presentation. "auto" MUST NOT guess a player from browserSlot.
// A future read-only provider may supply a reportedPlayerIndex, but GameInput
// currently does not provide it in ExoSnap's canonical GamepadReading.
export function previewPlayerIndex(selection='demo',browserSlot=null,reportedPlayerIndex=null){
  const slot=Number.isSafeInteger(browserSlot)&&browserSlot>=0?browserSlot:null;
  const reported=Number.isSafeInteger(reportedPlayerIndex)&&reportedPlayerIndex>=0?reportedPlayerIndex:null;
  let index,source;
  if(selection==='demo'){index=0;source='demo';}
  else if(selection==='auto'){
    index=reported??-1;
    source=reported===null?'unavailable':'reported';
  }else if(selection==='off'){index=-1;source='preview-off';}
  else if(typeof selection==='string'&&/^[0-7]$/.test(selection)){
    index=Number(selection);source='manual-preview';
  }else throw new RangeError('Invalid preview selection');
  return {index,mask:ledMaskForPlayerIndex(index),browserSlot:slot,source};
}
export function ledStates(mask){
  if(!Number.isInteger(mask)||mask<0||mask>15)throw new RangeError('Invalid LED mask');
  return Array.from({length:4},(_,i)=>Boolean(mask&(1<<i)));
}
export function previewLabel(preview){
  if(preview.source==='preview-off')return 'LED-Vorschau ausgeschaltet';
  if(preview.source==='unavailable')return 'Spielerindex unbekannt · keine Schätzung aus Browser-Slots';
  if(preview.source==='demo')return 'Demo P1 · keine Hardware-Abfrage';
  if(preview.source==='reported')return 'Gemeldeter Spieler P'+(preview.index+1)+' · keine LED-Rückmessung';
  return 'Vorschau P'+(preview.index+1)+' · nur Overlay, keine Hardware-Steuerung';
}
