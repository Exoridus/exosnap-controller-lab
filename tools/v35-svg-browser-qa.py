import json,re,subprocess,html,shutil,os
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
output_dir=root/'evidence/v35-browser'
output_dir.mkdir(parents=True,exist_ok=True)
svg=(root/'references/controllers/dualsense/source.svg').read_text('utf8')
mapping=json.loads((root/'references/controllers/dualsense/mapping.json').read_text())
recipe_js="import {resolveHeroRecipe} from './pbr-recipes.js'; console.log(JSON.stringify({solid:resolveHeroRecipe('solid',.7),ghost:resolveHeroRecipe('ghost',.7)}));"
recipe=json.loads(subprocess.check_output(['node','--input-type=module','-e',recipe_js],cwd=root,text=True))
# Standalone browser harness executes production ControllerReference + production material paint, not hand-painted SVGs.
palette=(root/'palette.js').read_text().replace('export const EXO_PALETTE','const EXO_PALETTE')
paint=(root/'material-paint.js').read_text();paint=re.sub(r"^import .*?;\n",'',paint,flags=re.M);paint=paint.replace('export function resolve2DPaint','function resolve2DPaint')
# wrap paint to avoid clamp var conflict
paint='const resolve2DPaint=(function(){\n'+paint+'\nreturn resolve2DPaint;})();\n'
ref=(root/'controller-reference.js').read_text();ref=re.sub(r"^import .*?;\n",'',ref,flags=re.M);ref=ref.replace('export function isolateReferenceIds','function isolateReferenceIds').replace('export class ControllerReference','class ControllerReference')
ref+='\nwindow.ControllerReference=ControllerReference;window.match2DControls=match2DControls;window.isolateReferenceIds=isolateReferenceIds;\n'
semantic='''
const STANDARD_MASK_CONTROL={1:'start',2:'select',4:'b1',8:'b2',16:'b3',32:'b4',64:'up',128:'down',256:'left',512:'right',1024:'l1',2048:'r1'};
function semanticControlFrom2DLayer(layer){const b=layer?.binding;if(b?.type==='button')return STANDARD_MASK_CONTROL[b.mask]||null;if(b?.type==='stick')return b.axes?.[0]?.startsWith('left_')?'ls':'rs';if(b?.type==='axis')return b.field==='left_trigger'?'l2':b.field==='right_trigger'?'r2':null;if(b?.type==='auxiliary')return ({home:'home',touchpad:'touchpad',share:'share'})[b.field]||null;return null;}
'''
js=palette+'\n'+semantic+'\n'+paint+'\n'+ref
style='''<style>*{box-sizing:border-box}body{margin:0;padding:22px;background:#0c1724;color:#e6eff7;font:14px system-ui}h1{font-size:20px;margin:0 0 8px}p{font-size:12px;color:#9eb8cb}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.sample{border:1px solid #36536a;border-radius:9px;overflow:hidden;background:#122031}.title{font-size:12px;padding:9px;background:#112538}.stage{height:220px;display:flex;align-items:center;justify-content:center;overflow:hidden}.stage svg{width:100%;height:100%;display:block}.stage[data-bg=dark]{background-color:#020915;background-image:linear-gradient(160deg,#081421 20%,#101d32 70%,#030811)}.stage[data-bg=light]{background:#f7f8fc}.stage[data-bg=mixed]{background:linear-gradient(160deg,#72aed9 0 35%,#234e65 35% 57%,#1e2735 57%)}.report{margin:16px 0 0;padding:10px;background:#122336;border:1px solid #34506a;border-radius:9px;font-size:12px;color:#a6c4da}</style>'''
containers=''
for key,title in [('solid','Material Identity Clean'),('ghost','Frosted Ghost Clean')]:
 containers+=f'<h2 style="font-size:16px;margin:18px 0 8px">{title}</h2><div class="grid">'
 for scene,label in [('dark','Dunkel'),('light','Hell'),('mixed','Gemischt')]:
  containers+=f'<div class="sample"><div class="title">2D · {label}</div><div class="stage" data-key="{key}" data-bg="{scene}">{svg}</div></div>'
 containers+='</div>'
content='<!doctype html><html lang="de"><head><meta charset="utf-8">'+style+'</head><body><h1>ExoSnap v35 – echte Browser-SVG-Referenzen</h1><p>Quelle: originales DualSense SVG; 2D-Materialfunktion des aktuellen Prototyps</p>'+containers+'<div class="report" id="status">Wird berechnet …</div></body></html>'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('EXOSNAP_CHROMIUM') or shutil.which('chromium') or shutil.which('chrome') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1450,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda err: errors.append(str(err)))
 page.set_content(content,wait_until='domcontentloaded',timeout=20000)
 page.add_script_tag(content=js)
 result=page.evaluate('''({mapping,recipe,pressed})=>{
  let refs=[];let handles=[];let issues=[];
  document.querySelectorAll('.stage').forEach((stage,i)=>{
   try {
    const root=stage.querySelector('svg');
    const r=new window.ControllerReference(stage);
    r.svg=root;r.mapping=mapping;r.controls=window.match2DControls(root,mapping);r.bodyShape=root.querySelector('#body');
    r.installKnockouts(root,r.controls,mapping);
    window.isolateReferenceIds(root,'qa-'+i);
    const key=stage.dataset.key,scene=stage.dataset.bg;
    r.applyMaterialAppearance(recipe[key],scene);
    const v=pressed?new Map(r.controls.map(x=>[x.control,1]).filter(([id])=>id)):new Map();
    r.update(v,{left:{x:.48,y:.32},right:{x:-.36,y:.4}});
    refs.push({scene,key,paint:r.paint,active:r.controls.filter(x=>(v.get(x.control)||0)>0).length});handles.push(r);
   }catch(e){issues.push('stage '+i+': '+String(e));}
  });
  window.__referenceQA=handles;
  document.querySelector('#status').textContent=`${refs.length} echte SVGs mit Materialfarben aktualisiert · ${issues.length} Fehler`;
  return {refs,issues};
 }''',dict(mapping=mapping,recipe=recipe,pressed=False))
 print('PAINT_RESULT:',json.dumps({**result,'refs':[{'key':x['key'],'scene':x['scene'],'paint':x['paint']} for x in result['refs']]},indent=2))
 print('BROWSER_ERRORS:',errors)
 page.screenshot(path=str(output_dir/'v35-dualsense-2d-idle.png'),full_page=True)
 result2=page.evaluate('''()=>{let pressed=0;for(const r of window.__referenceQA){const values=new Map(r.controls.filter(x=>x.control).map(x=>[x.control,1]));r.update(values,{left:{x:.48,y:.32,click:true},right:{x:-.36,y:.4,click:true}});pressed+=values.size}document.querySelector('#status').textContent+=` · ${pressed} pressed control mappings`;return {pressed}}''')
 print('pressed',result2)
 page.screenshot(path=str(output_dir/'v35-dualsense-2d-pressed.png'),full_page=True)
 browser.close()
