import hashlib,pathlib
items=[
('README.md', '6b20eae616182f9684b232d66312c8ae3e55e17d5d639116ff1e10e7abe8bb7a', 'c391e8416f536ca1eb8392936557cea6098492820f3f113b9e3d7003a80a2af6', [
(5,5,r"""
## Finaler Stand

**Demo ON · Markings ON.** Die Lab startet mit synchronisierten 2D-/3D-Eingaben und mechanischen Buttons/Triggern. Material- und Debug-Regler sind eingeklappt. Der 2D-Ring ist eine Aktivfläche; der Mittelteil zeigt unabhängig L3/R3. [Umsetzung, Artefaktquellen und Abnahme](docs/FINAL_POLISH.md).
"""),
(12,13,r"""- **2D — Transparent:** Original-SVG-Pfade, neutrale Eingabeflächen mit 0,30 Alpha und aktive weiße Flächen mit 0,96. Äußere und innere Gehäusekonturen, Controls und Symbole haben dieselbe Farbregel pro Hintergrund. Auf Hell und Gemischt erscheinen graue statt schwarze Zusatzkonturen. Das SVG enthält seitliche Sicherheitsränder; Verzierungen erhalten kein Eingabefeedback.
"""),
(19,20,r"""Sichtbare Trigger werden nicht mehr anhand eines Kamerawinkels vollständig ausgeblendet. Der Tiefentest entscheidet über ihre sichtbaren Teile. Verdeckte Schultertasten erhalten gestrichelte Konturen mit dunkler Gegenkontur und eigenem Eingabefeedback. Die bewegliche Stick-Hierarchie kippt Kappe und Schaft gemeinsam in die angezeigte Richtung. Face-, quellgetreue materialgebundene D-Pad-Prägungen kommen aus den originalen SVG-Pfaden.
"""),
(29,30,r"""`npm run verify` prüft Syntax und die vollständige Node-Suite. `tools/capture-pages.mjs` erzeugt echte Chromium-WebGL2-/SVG-Bilder und prüft zusätzlich Mix-Unabhängigkeit, einzelne verdeckte Eingaben, Originalsymbole, Kamerapositionen und Aktivfarben. Zusätzlich prüft die echte Browser-Abnahme Demo, mechanische Druckbewegung, Oberflächentexturen und den globalen Markings-Schalter und zeichnet eine Demo als WebM auf. Ein Fehler verhindert die Pages-Veröffentlichung. Bilder sind Rendernachweise; die finale ästhetische Auswahl trifft der Nutzer.
"""),
]),
('docs/CONTROLLER_CONSOLIDATION.md', '19ae096cf5d68a574b554e7db311859c71524823d7d8a1b2bff0263e538ba0af', 'c3db2172bbd1cb12d5f6d0660a0161bfca3288f897add9b729f19f9be378df8d', [
(1,1,r"""
**Superseded interaction/marking details:** see [final polish](FINAL_POLISH.md). The current Lab starts Demo/Markings enabled, uses .30/.96 2D opacity and real ring fills, restored button mechanics and surface-material ink. No floating 3D Create/Options labels remain.
"""),
]),
('docs/FINAL_POLISH.md', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '4636429759ea1f62ab0b96ad08aa894f4aff27b265ac86ea11be2982e9777a4d', [
(0,0,r"""# Final Controller Lab polish — 2026-11-08

## Source recovery and scope

The current published baseline is `6af4f221f3adecd8b8efde46d788f9dc94c00739`. Implementation was recovered from **artifacts**, not guessed from screenshots:

- GitHub Pages artifact `13610100058`, workflow `42460765877`, contains the complete running Lab and its older `app.js`.
- Source-review artifact `13610905527`, workflow `42463397151`, contains the repository plus full Git history.
- `app.js` in the Pages artifact is byte-identical to the original v40 publication commit `f9597e2`: SHA-256 `5ccc9c0277c05c037fdd63bddb0f9ee0e1be2019d39ec457dfec25465da43bc2`.

The old `highlightPart` used `pressTravelFor` and `triggerMechanics`, while `updateDemo` used the sequential face/D-pad/shoulder/trigger/click combinations and `demoStickAxes`. The current PBR page had lost these calls and animated only its sticks. Those mechanical policies and the demo sequence are now reused by the current PBR rig, not by a parallel renderer.

## Current behavior

**Demo** and **Markings** start on. The automatic twenty-second cycle combines the existing left/right stick curves, separate and combined presses, short/long presses, analog trigger ramps and a neutral loop boundary. `ControllerDemo` writes one reused state object/Map. The frame samples it once; SVG and 3D use exactly that sample. Manual controls take priority, live input suspends the demo through a one-second release window, and background tabs pause the clock. No demo inputs are merged into manual/live input.

Only controller, camera, Demo and Markings are permanently visible. Material, color and size options are in a collapsed section; individual debug controls are in another collapsed section. Clicking ordinary 2D buttons operates them; dragging sticks operates analog axes without inventing L3/R3; a double-click on a stick operates its click. Real standard Gamepad input is detected without selecting a mode.

### 2D

The existing moving outer and inner SVG shapes define a real annular surface. An untransformed wrapper applies a group-coordinate mask with the original center cut out. Shape transforms remain intact, and the center never receives a second alpha layer. Movement changes the ring **fill**, never the contour. L3/R3 independently changes the center. The simple independent 2D transparency control starts at 70%: neutral opacity 0.30, active opacity 0.96. The 3D material slider remains independent. Existing coherent scene ink, decorative paths and side margins remain intact.

### 3D

Face buttons, directional parts and bumpers regain physical travel using the historical policies. Triggers use the authored hinge and per-model rotation, proportional to input. The physically sliding GameCube trigger remains a translation by design. The generated Generic Pro has no authored hinge; its trigger uses a rest-pose-preserving front/top geometry hinge instead of rotating around the controller origin. Child contour geometry follows the moving physical mesh.

Runtime button markings are alpha-mask textures sampled in the existing PBR surface material. They add **zero meshes and zero draw calls**. UVs are generated from unchanged source vertices before exact geometry sharing; the actual source SVG paths preserve orientation and placement. Only front-facing surface normals receive ink. There is no offset plane and therefore no inter-surface z-fighting. D-pad ink is dark at rest. Share/Options labels above the buttons are absent in 3D; the buttons remain interactive. A single global toggle changes material uniforms and SVG glyph visibility, not geometry or mechanics. Textures are created at load and disposed with the rig.

The small surface-ink shader patch is shared; it does not add a rendering pass. Static input states skip redundant drawing while input polling continues. The existing one-rig render-to-texture/background reuse remains unchanged.

## Validation

`npm run verify` includes the historical suite and new regression tests for physical travel, analog rotation, contour movement, deterministic demo coverage, source arbitration, source-bound markings, global toggles, annular fill, independent click and material alpha.

`tools/capture-final-polish.mjs` extends the real Chromium/WebGL release checks: startup defaults, physical controls and exact return, partial/full triggers, underside view, material-bound markings, 2D ring/click states, toggles and opacity. It records `controller-demo.webm` from a separate default-state browser context. The original broad model/2D screenshot matrix still runs afterward. A successful build alone is not visual acceptance.

Native Qt Quick/Nexus rendering and performance measurement remain outside this browser-Lab change. Port the shared input sample, old mechanical policies and scalar material parameters; the alpha-mask ink requires an equivalent material shader. `nativeValidated` stays false.
"""),
]),
('pbr-lab.html', 'c8a32644f3992f8bb5ac94da2b6dbaa3d8e7f8d86f7d1fdd94afe26050a50430', '14821f654016299d46107a51507cef41a5f6d206df501bf5501872fb36580d7d', [
(2,3,r"""<meta name="theme-color" content="#09111b"><link rel="icon" href="data:,"><title>ExoSnap · Controller Lab</title>
"""),
(7,27,r""" <div class="toolbar">
  <label class="field model-field"><span>Controller</span><select id="controller" aria-label="3D-Modell"></select></label>
  <label class="field view-field"><span>Kamera</span><select id="view" aria-label="Gemeinsame Kameraposition"><option value="front" selected>Front</option><option value="angled">3/4</option><option value="top">Schräg oben</option><option value="profile">Seite</option><option value="bottom">Von unten</option><option value="rear">Hinten</option></select></label>
  <label class="press-field"><input type="checkbox" id="demoToggle" checked> Demo</label>
  <label class="press-field"><input type="checkbox" id="markingsToggle" checked> Markings</label>
  <span class="press-field">Aktiv: Weiß</span>
 </div>
 <details class="settings" id="appearanceSettings"><summary>Darstellung &amp; Material</summary><div class="toolbar">
  <label class="field size-field"><span>Größe</span><select id="panelSize" aria-label="Panelgröße"><option value="240">240 × 160</option><option value="320" selected>320 × 214</option><option value="480">480 × 320</option></select></label>
  <label class="field mix-field"><span class="mix-title">Materialmix · nur 3D <output id="mixValue">70 %</output></span><input type="range" min="0" max="100" step="1" value="70" id="materialMix" aria-label="Materialmix nur 3D"><span class="range-labels"><i>Original</i><i>Ghost</i></span></label>
  <label class="field mix-field"><span class="mix-title">Transparenz · 2D <output id="flatValue">70 %</output></span><input type="range" min="0" max="90" step="1" value="70" id="flatTransparency" aria-label="Transparenz 2D"></label>
  <label class="press-field"><input type="checkbox" id="colorSync" checked> Farben koppeln</label>
  <label class="field color-field"><span>2D aktiv</span><input id="color2D" type="color" value="#ffffff" aria-label="Aktivfarbe 2D"></label>
  <label class="field color-field"><span>3D aktiv</span><input id="color3D" type="color" value="#ffffff" aria-label="Aktivfarbe 3D"></label>
  <button id="exportRecipe">Qt-Parameter</button>
 </div></details>
 <details class="settings" id="inputDebug"><summary>Debug · einzelne Eingaben</summary><div class="toolbar">
  <label class="field"><span>Sticks</span><select id="stickPose" aria-label="Stickzustand"><option value="neutral">Neutral</option><option value="move">Bewegt</option><option value="click">L3/R3 gedrückt</option><option value="live">Live</option></select></label>
  <label class="field trigger-field"><span>Trigger L2/R2 <output id="triggerValue">0 %</output></span><input id="triggerPressure" type="range" min="0" max="100" step="1" value="0" aria-label="Analogen Druck der Trigger L2 und R2 simulieren"></label>
  <label class="field"><span>Einzeln testen</span><select id="testControl" aria-label="Einzelne Eingabe testen"><option value="">Keine</option><option value="l1">L1 / LB</option><option value="r1">R1 / RB</option><option value="l2">L2 / LT</option><option value="r2">R2 / RT</option><option value="ls">L3</option><option value="rs">R3</option><option value="b1">Kreuz / A</option><option value="b2">Kreis / B</option><option value="b3">Quadrat / X</option><option value="b4">Dreieck / Y</option><option value="up">D-Pad oben</option><option value="down">D-Pad unten</option><option value="left">D-Pad links</option><option value="right">D-Pad rechts</option><option value="select">Share / Create</option><option value="start">Options</option><option value="home">PS / Home</option><option value="touchpad">Touchpad</option></select></label>
  <label class="press-field"><input type="checkbox" id="pressAll"> Alle drücken</label>
  <select id="renderMode" hidden><option value="shared">1× 3D + 3 Blits</option><option value="direct">3× 3D</option></select>
 </div></details>
 <div class="status-row"><span id="rendererStatus" role="status">Originalmodell wird geladen …</span><span id="modelInfo"></span><nav><a href="./artwork-source-review.html">SVG-Quelle</a> · <a href="./screenshots.html">Bildnachweise</a></nav></div>
"""),
(28,29,r"""<main><div id="failureBanner" role="alert" hidden></div><div id="gallery" aria-label="Synchronisierte 3D- und 2D-Controller-Demo auf drei Hintergründen"></div></main>
"""),
]),
('pbr-lab.js', 'a84b125365685be5ba6261092ac3a06bb3a68c8866c67c60a79853bdffb314a7', '0cae6bb2fa950a713d406e794fb4a1474b2567d8509f48ea46caba327c69de6f', [
(9,10,r"""import {applyPbrRecipeToRig,applyControlPoseToRig} from './pbr-appearance.js';
"""),
(15,16,r"""import {LAB_VARIANTS,resolveLabRecipe,flatAppearanceKey,qtLabDescriptor,resolveFlatMaterial} from './controller-lab-style.js';
"""),
(18,19,r"""import {applyControllerArtwork,setControllerMarkings} from './control-glyphs.js';
"""),
(22,22,r"""import {ControllerDemo,createControllerState} from './controller-demo.js';
"""),
(36,36,r"""const demo=new ControllerDemo();
const manualInput=createControllerState();
state.frameInput=createControllerState();state.markings=true;state.flatTransparency=.70;
state.manualButtons=new Map();state.manualHeld=new Set();
const demoPresets={neutral:poseForStickDemo('neutral'),move:poseForStickDemo('move'),click:poseForStickDemo('click')};
"""),
(44,44,r"""let cachedRecipe=null,cachedRecipeKey='';
"""),
(45,45,r"""  const key=variantKey+':'+state.mix+':'+activeColors.color3D;
  if(key===cachedRecipeKey)return cachedRecipe;
"""),
(48,49,r"""  cachedRecipeKey=key;cachedRecipe=recipe;return recipe;
"""),
(135,136,r"""    const ref=new ControllerReference(pending,{onPress:(key,event)=>{
      if(key==='ls'||key==='rs')return; // dragging a stick must not invent a click
      state.manualHeld.add(key);state.manualButtons.set(key,performance.now()+100);
      event?.currentTarget?.setPointerCapture?.(event.pointerId);scheduleRender();
    }});
"""),
(145,145,r"""    ref.svg.addEventListener('dblclick',event=>{
      const entry=ref.controls.find(c=>c.stickSide&&c.group.contains(event.target));
      if(entry){state.manualButtons.set(entry.control,performance.now()+180);scheduleRender();}
    });
"""),
(152,152,r"""    setControllerMarkings(state.native,state.markings);
"""),
(159,168,r"""function visualInput(now=performance.now()){
  for(const [key,until]of state.manualButtons)if(until<=now)state.manualButtons.delete(key);
  const manual=state.pressed||state.testControl||state.triggerPressure>0||
    state.manualSticks.left||state.manualSticks.right||state.manualButtons.size||state.manualHeld.size||
    (state.stickPose!=='neutral'&&state.stickPose!=='live');
  if(manual){
    manualInput.values.clear();manualInput.allPressed=state.pressed;
    if(state.pressed)for(const id of CONTROL_IDS)manualInput.values.set(id,1);
    for(const key of state.manualButtons.keys())manualInput.values.set(key,1);
    for(const key of state.manualHeld)manualInput.values.set(key,1);
    if(state.testControl)manualInput.values.set(state.testControl,1);
    const preset=demoPresets[state.stickPose]||demoPresets.neutral;
    for(const [side,key]of [['left','ls'],['right','rs']]){
      const stick=state.manualSticks[side]||preset[side];
      manualInput[side].x=stick.x||0;manualInput[side].y=stick.y||0;
      manualInput[side].click=Boolean(stick.click)||Boolean(manualInput.values.get(key));
      if(manualInput[side].click)manualInput.values.set(key,1);
    }
    manualInput.triggers.left=manualInput.triggers.right=state.triggerPressure;
"""),
(169,176,r"""  return demo.sample(now,{manual:manual?manualInput:null,live:getLiveStickPose()});
"""),
(177,178,r"""function updateFlatReferences(input=state.frameInput){
"""),
(182,184,r"""  const key=flatAppearanceKey(input,activeColors.color2D)+`:${flatLoadSerial}:${flatReferences.size}:${state.panelWidth}:${state.flatTransparency}:${state.markings}`;
"""),
(189,190,r"""      stickFeedback:'ring',showFaceSymbols:true,edgeLight:0,edgeShadow:0,coherentContours:true,
      ringSurface:true,material2D:resolveFlatMaterial(state.flatTransparency),markings:state.markings});
"""),
(219,220,r"""  const poses={front:[0,0],angled:[.52,.30],top:[.28,.70],profile:[1.5,.04],bottom:[.24,-.65],rear:[Math.PI,.12]};
"""),
(237,238,r"""function render(now=performance.now()){
"""),
(239,241,r"""  const dirty=state.paintDirty;state.paintDirty=false;
  if(document.hidden)return;
  const pose=visualInput(now);state.frameInput=pose;
  const animate=()=>{if(demo.enabled||state.manualButtons.size||state.frameInput.source==='live'||state.stickPose==='live'||Array.from(navigator.getGamepads?.()||[]).some(p=>p?.connected))scheduleRender(false);};
  const inputKey=flatAppearanceKey(pose);
  if(!dirty&&inputKey===state.lastFrameKey){animate();return;}
  state.lastFrameKey=inputKey;
  updateFlatReferences(pose);
  if(!state.renderer||!state.native||!state.environmentMap){if(flatReferences.size)animate();return;}
"""),
(254,256,r"""  applyControlPoseToRig(state.native,pose);
  setControllerMarkings(state.native,state.markings);
"""),
(329,330,r"""  setStatus(`${state.native.model.name} · 2D + 3D synchron · ${pose.source==='demo'?'Demo':pose.source==='live'?'Live-Gamepad':pose.source==='manual'?'Manuelle Eingabe':'Neutral'}`);
  animate();
"""),
(335,336,r"""  if(!input)return null;
"""),
(341,344,r"""function scheduleRender(dirty=true){
  state.paintDirty=state.paintDirty||Boolean(dirty);
  if(state.renderPending||document.hidden)return;
"""),
(386,387,r"""    geometryReuse:state.native?.geometryReuse,demo:demo.enabled,markings:state.markings,flatMaterial:resolveFlatMaterial(state.flatTransparency),
"""),
(408,408,r"""  $('demoToggle').addEventListener('change',e=>{demo.setEnabled(e.target.checked);scheduleRender();});
  $('markingsToggle').addEventListener('change',e=>{state.markings=e.target.checked;scheduleRender();});
  $('flatTransparency').addEventListener('input',e=>{state.flatTransparency=Number(e.target.value)/100;$('flatValue').textContent=e.target.value+' %';scheduleRender();});
"""),
(427,428,r"""  $('stickPose').addEventListener('change',e=>{state.stickPose=e.target.value;if(state.stickPose==='live'){demo.setEnabled(false);$('demoToggle').checked=false;}scheduleRender();});
"""),
(441,442,r"""  window.addEventListener('pointerup',()=>{state.drag=null;state.manualHeld.clear();scheduleRender();});
  window.addEventListener('pointercancel',()=>{state.manualHeld.clear();scheduleRender();});
  window.addEventListener('blur',()=>{state.drag=null;state.manualHeld.clear();state.manualButtons.clear();scheduleRender();});
"""),
(452,454,r"""  window.addEventListener('gamepadconnected',scheduleRender);
  window.addEventListener('gamepaddisconnected',scheduleRender);
  document.addEventListener('visibilitychange',()=>{demo.resetClock();if(!document.hidden)scheduleRender();});
"""),
(461,462,r"""  window.__exoPbrLab={get input(){return state.frameInput},get demo(){return demo},get markings(){return state.markings},get flatReferences(){return flatReferences},get status(){return document.body.dataset.renderReady},get model(){return state.native},get variant(){return state.selected},get mix(){return state.mix},get renderer(){return state.renderer},get renderTarget(){return state.renderTarget},get drawStats(){return {...state.drawStats}},get renderMode(){return state.renderMode},get colors(){return {color2D:activeColors.color2D,color3D:activeColors.color3D,sync:activeColors.sync}},get triggerPressure(){return state.triggerPressure}};
"""),
]),
 ]
for name,before,after,edits in items:
 p=pathlib.Path(name)
 source=p.read_text() if p.exists() else ''
 assert hashlib.sha256(source.encode()).hexdigest()==before, 'Source changed: '+name
 lines=source.splitlines(keepends=True)
 for a,b,text in reversed(edits): lines[a:b]=[text]
 result=''.join(lines)
 assert hashlib.sha256(result.encode()).hexdigest()==after, 'Result mismatch: '+name
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(result)
print('Verified source files:', len(items))
