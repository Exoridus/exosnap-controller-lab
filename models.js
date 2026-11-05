// Final curated controller set for the local ExoSnap lab.
// Focus: clean front-facing gamepads with a unibody shell impression.
export const SOURCES = Object.freeze({
  co: 'https://raw.githubusercontent.com/Khyretos/3dco-plus/main/assets/models',
  padforge: 'https://raw.githubusercontent.com/hifihedgehog/PadForge/main/PadForge.App/3DModels',
});
export function assetFolder(model) { return model.folder ?? model.id; }
export function remoteAssetUrl(model, file) {
  const base = SOURCES[model.source ?? 'co'];
  if (!base) throw new Error('Unknown model source: '+model.source);
  return `${base}/${assetFolder(model).split('/').map(encodeURIComponent).join('/')}/${encodeURIComponent(file)}`;
}
export function remoteAssetMirrors(model, file) {
  const primary = remoteAssetUrl(model, file);
  const match = primary.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
  if (!match) return [primary];
  const [, owner, repo, branch, rest] = match;
  return [primary, `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${rest}`];
}
const fromCo = (id, folder, name, brand, family, color, extra={}) => ({
  id, source:'co', folder, manifest:true, name, brand, family, color, group:'Final', ...extra
});
const fromPadforge = (id, folder, name, brand, family, color, parts, extra={}) => ({
  id, source:'padforge', folder, name, brand, family, color, group:'Final', parts:parts.trim().split(/\s+/).map(n=>n+'.obj'), ...extra
});
export const CONTROLLERS = [
  fromCo('DualSenseCompact','DualSense','DualSense','PlayStation 5','playstation','#e3e7ee',{orbitY:0, shellParts:['top_shell','bottom_shell','grip_left','grip_right']}),
  fromCo('DS4Compact','DualShock 4','DualShock 4','PlayStation 4','playstation','#404a58',{orbitY:0, shellParts:['top_shell','bottom_shell']}),
  fromCo('XboxOneClean','Xbox One','Xbox One','Microsoft Xbox One','xbox','#e5e9f1',{orbitY:0, shellParts:['top_shell','bottom_shell','left_grip','right_grip']}),
  fromPadforge('XboxSeries','XboxSeries/Carbon','Xbox Series X|S','Microsoft Xbox Series','xbox','#333d47',`B1 B2 B3 B4 Back DPadDown DPadLeft DPadRight DPadUp Joystick-Left-Ring Joystick-Right-Ring L1 LeftStickClick MainBody MotorLeft MotorRight R1 RightStickClick Share Shoulder-Left-Trigger Shoulder-Right-Trigger Special Start`,{orbitY:0, shellParts:['mainbody']}),
  fromCo('SwitchPro','Switch Pro','Switch Pro','Nintendo Switch Pro','nintendo','#303840',{orbitY:0, shellParts:['top_shell','bottom_shell']}),
  fromCo('JoyconGrip','Joycon Grip','Joy-Cons · Grip','Nintendo Joy-Cons in grip','nintendo','#343e49',{orbitY:0, shellParts:['grip_top','grip_bottom','left_shell','right_shell']}),
  fromCo('JoyconLeft','Left Joycon','Joy-Con · left','Nintendo Joy-Con left','nintendo','#465a75',{orbitY:0, shellParts:['top_shell','bottom_shell']}),
  fromCo('JoyconRight','Right Joycon','Joy-Con · right','Nintendo Joy-Con right','nintendo','#536c78',{orbitY:0, shellParts:['top_shell','bottom_shell']}),
  fromCo('Gamecube','Gamecube','GameCube','Nintendo GameCube','nintendo','#5e6175',{orbitY:0, shellParts:['top_shell','bottom_shell','left_grip','right_grip']}),
  fromCo('Wavebird','Wavebird','WaveBird','Nintendo WaveBird','nintendo','#7d808e',{orbitY:0, shellParts:['top_shell','bottom_shell','left_grip','right_grip']}),
  fromCo('SteamController2026','Steam Controller 2026','Steam Controller (2026)','Valve Steam Controller','steam','#353c48',{orbitY:0, shellParts:['shell_top','shell_bottom','left_grip','right_grip']})
];
export const CONTROL_IDS = ['b1','b2','b3','b4','up','right','down','left','l1','r1','l2','r2','ls','rs','start','select','home','touchpad'];
export function controlFromFilename(filename) {
  const n = filename.replace(/\.obj$/i,'').toLowerCase();
  if (/^(b[1-4])(?:-|button|$)/.test(n)) return n.match(/^b[1-4]/)[0];
  if (/^(a|b|x|y)_button$/.test(n)) return ({a:'b1',b:'b2',x:'b3',y:'b4'})[n[0]];
  if (/^button_(a|b|x|y)$/.test(n)) return ({a:'b1',b:'b2',x:'b3',y:'b4'})[n.slice(-1)];
  if (/^dpad_(up|right|down|left)$/.test(n)) return n.slice(5);
  if (/^((left|right)_bumper|bumper_(left|right))$/.test(n)) return n.includes('left')?'l1':'r1';
  if (/^((left|right)_trigger|trigger_(left|right))$/.test(n)) return n.includes('left')?'l2':'r2';
  if (/^(left|right)_(ring|stick|cap)$/.test(n)) return n.startsWith('left')?'ls':'rs';
  if (/^thumbstick_(left|right)(_ring|_cap)?$/.test(n)) return n.includes('left')?'ls':'rs';
  if (n==='back_button'||n==='button_back') return 'select';
  if (n==='start_button'||n==='button_start') return 'start';
  if (n==='guide_button'||n==='button_guide') return 'home';
  if (n==='touchpad') return 'touchpad';
  if (n==='touchpad_left'||n==='leftpadtouch') return 'leftpad';
  if (n==='touchpad_right'||n==='rightpadtouch') return 'rightpad';
  if (n.startsWith('dpadup')) return 'up';
  if (n.startsWith('dpadright')) return 'right';
  if (n.startsWith('dpaddown') || n === 'arrowdown') return 'down';
  if (n.startsWith('dpadleft')) return 'left';
  if (n === 'l1' || n.startsWith('shoulder-left-middle')) return 'l1';
  if (n === 'r1' || n.startsWith('shoulder-right-middle')) return 'r1';
  if (n.startsWith('shoulder-left-trigger')) return 'l2';
  if (n.startsWith('shoulder-right-trigger')) return 'r2';
  if (n.startsWith('leftstickclick')) return 'ls';
  if (n.startsWith('rightstickclick')) return 'rs';
  if (n === 'start' || n === 'startsymbol') return 'start';
  if (n === 'back' || n === 'backicon' || n === 'backsymbol' || n === 'sharebutton' || n === 'sharesymbol') return 'select';
  if (['special','home','powersymbol','powerbutton','logo'].includes(n)) return 'home';
  return null;
}
export function controlDisplayName(id, family) {
  const ps = family === 'playstation';
  const labels = ps
    ? { b1:'Cross', b2:'Circle', b3:'Square', b4:'Triangle', l1:'L1',r1:'R1',l2:'L2',r2:'R2'}
    : family==='nintendo'
      ? {b1:'B',b2:'A',b3:'Y',b4:'X',l1:'L',r1:'R',l2:'ZL',r2:'ZR'}
      : { b1:'A',b2:'B',b3:'X',b4:'Y',l1:'LB',r1:'RB',l2:'LT',r2:'RT'};
  return labels[id] || ({ up:'D-pad up', right:'D-pad right', down:'D-pad down', left:'D-pad left', ls:'Left stick', rs:'Right stick', start:'Menu', select:'View', home:'Home',touchpad:'Touchpad',leftpad:'Left touchpad',rightpad:'Right touchpad'})[id] || id;
}
