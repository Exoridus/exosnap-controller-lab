// Device-aware OBJ semantics. Every moving or pressed mesh has a stable role.
// An unqualified upstream input_binding never implies a browser standard button.
import { controlFromFilename } from './models.js';
const KNOWN_ROLES=Object.freeze(['housing','decoration','button','trigger','stick-pivot','stick-base','stick-stem','stick-cap','touch-surface','touch-contact','paddle']);
export {KNOWN_ROLES};
export function modelPartSemantics(file,model,meta=null){
  const id=String(model?.id||'');
  const layoutId=String(model?.layoutId||'');
  const n=String(file).replace(/\.obj$/i,'').toLowerCase();
  const part={control:controlFromFilename(file),role:'housing',preview:false,pickControl:null};
  if(/^(?:touch_point\d+)$/.test(n))return {control:null,role:'touch-contact',preview:false,pickControl:null};
  if(/^(?:left|right)_(?:ring)$|^thumbstick_(?:left|right)_ring$|^joystick-(?:left|right)-ring$/.test(n)){
    const left=n.includes('left'),key=left?'ls':'rs';
    // PadForge rings are the fixed outer wells. Only the synthetic internal
    // pivot and the real "LeftStickClick" / "RightStickClick" cap should tilt.
    if(model?.source==='padforge')return {control:null,role:'stick-base',preview:false,pickControl:key};
    return {control:key,role:'stick-pivot',preview:false,pickControl:key};
  }
  if(/^(?:left|right)_stick$|^thumbstick_(?:left|right)$/.test(n)){
    const left=n.includes('left');return {control:null,role:'stick-stem',preview:false,pickControl:left?'ls':'rs'};
  }
  if(/^(?:left|right)_cap$|^thumbstick_(?:left|right)_cap$|^(?:left|right)stickclick$/.test(n)){
    const left=n.includes('left');return {control:null,role:'stick-cap',preview:false,pickControl:left?'ls':'rs'};
  }
  if(/^(?:touchpad|touchpad_left|touchpad_right)$/.test(n)){
    const key=n==='touchpad'?'touchpad':n.endsWith('left')?'leftpad':'rightpad';
    return {control:key,role:'touch-surface',preview:key!=='touchpad',pickControl:key};
  }
  if(layoutId==='joycon_left_horizontal'){
    const button=({dpad_left:'b1',dpad_down:'b2',dpad_up:'b3',dpad_right:'b4'})[n];
    if(button)return {control:button,role:'button',preview:false,pickControl:button};
  }
  if(layoutId==='joycon_right_horizontal'){
    const button=({a_button:'b1',x_button:'b2',b_button:'b3',y_button:'b4'})[n];
    if(button)return {control:button,role:'button',preview:false,pickControl:button};
  }
  if(['JoyconLeft','JoyconRight'].includes(id)&&/^paddle[1-4]$/.test(n)){
    const side=n==='paddle1'||n==='paddle2'?'sl':'sr';
    const logical=layoutId.endsWith('_horizontal')?(side==='sl'?'l1':'r1'):side;
    return {control:logical,role:'paddle',preview:true,pickControl:logical};
  }
  const extras={
    button_l4:'l4',button_l5:'l5',button_r4:'r4',button_r5:'r5',
    button_misc:'quick-access',share:'share',
    paddle1:'l4',paddle3:'l5',paddle2:'r4',paddle4:'r5',
  };
  if(n in extras)return {control:extras[n],role:/^paddle|^button_[lr][45]/.test(n)?'paddle':'button',preview:true,pickControl:extras[n]};
  if(n==='misc'&&['SwitchPro','JoyconGrip','JoyconLeft'].includes(id))return {control:'share',role:'button',preview:true,pickControl:'share'};
  // Core Nintendo standard face positions are south/east/west/north, even
  // though its ABXY labels are reversed relative to Xbox. GameCube is not.
  if(model?.family==='nintendo'&&['SwitchPro','JoyconLeft','JoyconRight','JoyconGrip'].includes(id)){
    const letter=n.match(/^([abxy])_button$/);
    if(letter)part.control=({a:'b2',b:'b1',x:'b4',y:'b3'})[letter[1]];
  }
  if(part.control){
    part.role=['l2','r2'].includes(part.control)?'trigger':'button';part.pickControl=part.control;
    return part;
  }
  if(/(?:button|bumper|trigger|dpad|^l1$|^r1$|^l2$|^r2$|start|back|select|special|share|home|guide|menu|plus|minus|capture)/.test(n)){
    return {control:null,role:'decoration',preview:false,pickControl:null};
  }
  return {control:null,role:'housing',preview:false,pickControl:null};
}
export function isHousingRole(role){return role==='housing'||role==='decoration';}
export function shouldRenderPart(role){return role!=='touch-contact';}
export function shouldShowContour(file,role,style){
  if(style!=='ghost')return false;
  if(role==='touch-contact')return false;
  // The rear surface stays present for 360°/Studio but never forms a second
  // front-facing ghost mesh behind the buttons.
  return !/(^|[_-])(bottom[_-]?shell|back[_-]?shell|body[_-]?back|mainbodyback|battery[_-]?door)(\.|_|$)/i.test(file);
}
export function isSourceBodyPart(file){return /^(?:bottom[_-]?shell|back[_-]?shell)\.obj$/i.test(file);}
