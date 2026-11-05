// One device/layout identity shared by the 2D reference and the 3D viewer.
// A proxy is NOT a fully modelled variant: missing 3D controls are never
// passed off as implemented. Reference-only layouts remain usable in 2D.
const BASES = Object.freeze({
  dualsense:       ['DualSenseCompact','native'],
  dualshock4:      ['DS4Compact','native'],
  xbox_series:     [null,'license-review'],
  xbox_one:        ['XboxOneClean','native'],
  generic:         ['GenericPro','native'],
  switch_pro:      ['SwitchPro','native'],
  joycon_grip:     ['JoyconGrip','native'],
  joycon_pair:     [null,'composite'], // Two existing, independently animated Joy-Cons.
  joycon_left:     ['JoyconLeft','native'],
  joycon_right:    ['JoyconRight','native'],
  joycon_left_horizontal:  ['JoyconLeft','proxy'],
  joycon_right_horizontal: ['JoyconRight','proxy'],
  steam_controller:['', 'reference'],
  steam_deck_full: [null,'reference'],
  steam_deck_compact: [null,'reference'],
  steam_controller_2026: [null,'license-review'],
  xbox_360:        ['Xbox360','native'],
  gamecube:        ['Gamecube','native'],
  dualsense_edge:  ['DualSenseCompact','proxy'],
  xbox_elite:      [null,'reference']
});
const NAMES = Object.freeze({
  dualsense:'DualSense',dualshock4:'DualShock 4',xbox_series:'Xbox Series',xbox_one:'Xbox One',
  generic:'Generic Dual-Stick',switch_pro:'Switch Pro',joycon_grip:'Joy-Cons im Grip',
  joycon_pair:'Joy-Cons getrennt',joycon_left:'Joy-Con L',joycon_right:'Joy-Con R',
  joycon_left_horizontal:'Joy-Con L · horizontal',joycon_right_horizontal:'Joy-Con R · horizontal',
  steam_controller:'Steam Controller (2015)',steam_deck_full:'Steam Deck',
  steam_deck_compact:'Steam Deck (kompakt)',steam_controller_2026:'Steam Controller (2026)',
  xbox_360:'Xbox 360',gamecube:'GameCube',dualsense_edge:'DualSense Edge',xbox_elite:'Xbox Elite'
});
const FAMILIES = Object.freeze({
  playstation:['dualsense','dualshock4','dualsense_edge'],
  xbox:['xbox_series','xbox_one','xbox_360','xbox_elite'],
  nintendo:['switch_pro','joycon_grip','joycon_pair','joycon_left','joycon_right','joycon_left_horizontal','joycon_right_horizontal','gamecube'],
  steam:['steam_controller','steam_deck_full','steam_deck_compact','steam_controller_2026'],
  generic:['generic']
});
const familyOf=id=>Object.entries(FAMILIES).find(([,ids])=>ids.includes(id))?.[0]||'generic';
export const LAYOUTS=Object.freeze(Object.entries(BASES).map(([id,[modelId,availability]])=>Object.freeze({
  id,name:NAMES[id],family:familyOf(id),modelId:modelId||null,availability,
  modelIds:id==='joycon_pair'?['JoyconLeft','JoyconRight']:null,
  has2D:true,source:`./references/controllers/${id}/source.svg`,
  mapping:`./references/controllers/${id}/mapping.json`,
  note:availability==='proxy'?'3D-Grundmodell: zusätzliche Tasten/Details sind nur in der 2D-Referenz vollständig.':
    availability==='composite'?'Zwei vorhandene 3D-Joy-Cons als Komposition. Riemen/SL-SR-Details nur in der 2D-Referenz vollständig.':
    availability==='license-review'?'3D-Quelle vorhanden, aber die Weiterverwendungsrechte sind nicht für ExoSnap nachgewiesen.':
    availability==='reference'?'Für diese Variante ist noch kein verifiziertes 3D-Modell eingebunden.':'3D-Grundmodell und 2D-Referenz vorhanden.'
})));
export const VIEWER_LAYOUTS=Object.freeze([...LAYOUTS,Object.freeze({
  id:'wavebird',name:'WaveBird',family:'nintendo',modelId:'Wavebird',availability:'3d-only',has2D:false,
  source:null,mapping:null,note:'3D vorhanden; passende 2D-Vorlage fehlt.'
})]);
export function layoutForId(id){return VIEWER_LAYOUTS.find(x=>x.id===id)||null;}
export function layoutForModel(id){return VIEWER_LAYOUTS.find(x=>x.modelId===id&&x.availability==='native')||null;}
export function detectLayoutFromGamepad(raw){
  const name=String(raw||'').toLowerCase();
  // Specific generations must be matched first: "Xbox" and "Steam Controller"
  // alone do not reliably identify exact hardware revisions.
  if(/dual\s*sense.*edge/.test(name))return 'dualsense_edge';
  if(/dual\s*sense|0ce6|0df2/.test(name))return 'dualsense';
  if(/dualshock|wireless controller|05c4|09cc/.test(name))return 'dualshock4';
  if(/joy.?con.*\(l\)|joy.?con.*left/.test(name))return 'joycon_left';
  if(/joy.?con.*\(r\)|joy.?con.*right/.test(name))return 'joycon_right';
  if(/switch pro|pro controller/.test(name))return 'switch_pro';
  if(/steam deck/.test(name))return 'steam_deck_compact';
  if(/steam controller.*(?:2026|second|2nd)/.test(name))return 'steam_controller_2026';
  if(/steam controller/.test(name))return 'steam_controller';
  if(/xbox.*(?:elite|series 2)/.test(name))return 'xbox_elite';
  if(/xbox\s*360|xinput.*360/.test(name))return 'xbox_360';
  if(/xbox\s*one/.test(name))return 'xbox_one';
  if(/xbox.*(?:series|x\|s)/.test(name))return 'xbox_series';
  if(/xbox/.test(name))return 'generic'; // Do not guess Series/One/360 from a generic descriptor.
  return null;
}
export const STANDARD_MASK_CONTROL=Object.freeze({1:'start',2:'select',4:'b1',8:'b2',16:'b3',32:'b4',
  64:'up',128:'down',256:'left',512:'right',1024:'l1',2048:'r1'});
export function semanticControlFrom2DLayer(layer){
  const binding=layer?.binding;
  if(binding?.type==='button')return STANDARD_MASK_CONTROL[binding.mask]||null;
  if(binding?.type==='stick')return binding.axes?.[0]?.startsWith('left_')?'ls':'rs';
  if(binding?.type==='axis')return binding.field==='left_trigger'?'l2':binding.field==='right_trigger'?'r2':null;
  if(binding?.type==='auxiliary')return ({home:'home',touchpad:'touchpad',share:'share'})[binding.field]||null;
  if(layer?.preview?.key)return ({'touch-l':'leftpad','touch-r':'rightpad'})[layer.preview.key]||layer.preview.key;
  return null;
}
const OVERRIDES={
  gamecube:{b1:'A',b2:'B',b3:'X',b4:'Y',r1:'Z',l2:'L',r2:'R',start:'START/PAUSE',rs:'C-Stick'},
  wavebird:{b1:'A',b2:'B',b3:'X',b4:'Y',r1:'Z',l2:'L',r2:'R',start:'START/PAUSE',rs:'C-Stick'},
  joycon_left_horizontal:{l1:'SL',r1:'SR',b1:'Links',b2:'Unten',b3:'Oben',b4:'Rechts'},
  joycon_right_horizontal:{l1:'SL',r1:'SR'},
  joycon_left:{sl:'SL',sr:'SR'},
  joycon_right:{sl:'SL',sr:'SR'},
  steam_controller_2026:{l4:'L4',l5:'L5',r4:'R4',r5:'R5','quick-access':'Schnellzugriff'},
};
export function controllerLabelOverride(layoutId,controlId){return OVERRIDES[layoutId]?.[controlId]||null;}
