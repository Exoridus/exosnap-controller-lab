#!/usr/bin/env node
/** Generate pending real-render capture cases; this file contains no render results. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node tools/generate-capture-matrix.mjs [--out evidence/capture-cases.json]');
  process.exit(0);
}
if (args.length && (args.length !== 2 || args[0] !== '--out' || !args[1])) throw new Error('Use --out FILE or no arguments');
const output = args.length ? path.resolve(args[1]) : path.join(projectRoot, 'evidence/capture-cases.json');
const sizes = [{ width: 240, height: 160 }, { width: 320, height: 214 }, { width: 480, height: 320 }];
const backgrounds = [{ name: 'dark', query: 'dark' }, { name: 'light', query: 'light' }, { name: 'mixed', query: 'racing' }];
const diagonal = Math.SQRT1_2;
const directions = [
  { name: 'right', x: 1, y: 0 }, { name: 'down', x: 0, y: 1 },
  { name: 'left', x: -1, y: 0 }, { name: 'up', x: 0, y: -1 },
  { name: 'up-right', x: diagonal, y: -diagonal },
  { name: 'down-right', x: diagonal, y: diagonal },
  { name: 'down-left', x: -diagonal, y: diagonal },
  { name: 'up-left', x: -diagonal, y: -diagonal },
];
const cases = [];
function diagnosticCase({ name, category, variant = 'D', background, size, view = 'front', focus,
  stick = { x: 0, y: 0 }, buttons = false, click = false }) {
  const params = new URLSearchParams({ diagnostic: '1', layout: 'dualsense', contrast: variant, mix: '1',
    view, background: background.query, stick: `${stick.x},${stick.y}`, buttons: buttons ? '1' : '0',
    click: click ? '1' : '0', label: '0', alphaSamples: '1' });
  if (focus) params.set('focus', focus);
  return { name, category, path: `index.html?${params}`, viewport: { ...size },
    size: `${size.width}x${size.height}`, model: 'dualsense', renderModel: 'DualSenseCompact' };
}
for (const variant of ['A', 'B', 'C', 'D', 'E']) for (const background of backgrounds) for (const size of sizes) {
  cases.push(diagnosticCase({ name: `neutral-${variant}-${background.name}-${size.width}x${size.height}`,
    category: 'neutral-grid', variant, background, size }));
}
for (const background of backgrounds) for (const size of sizes) {
  cases.push(diagnosticCase({ name: `pressed-D-${background.name}-${size.width}x${size.height}`,
    category: 'pressed-grid', background, size, buttons: true, click: true }));
}
// Both actual stick rigs receive the same unit-length input; the paired focus
// views expose each rig independently without removing housing or occluders.
for (const view of ['angled', 'side']) for (const focus of ['left', 'right'])
  for (const direction of directions) for (const background of backgrounds) {
    cases.push(diagnosticCase({ name: `stick-${view}-${focus}-${direction.name}-${background.name}-480x320`,
      category: 'stick-geometry', background, size: sizes[2], view, focus, stick: direction }));
  }
// L3/R3 travel remains independent of the all-buttons switch and deflection.
for (const view of ['angled', 'side']) for (const focus of ['left', 'right']) {
  cases.push(diagnosticCase({ name: `stick-click-${view}-${focus}-up-right-mixed-480x320`,
    category: 'stick-click', background: backgrounds[2], size: sizes[2], view, focus,
    stick: directions.find(direction => direction.name === 'up-right'), click: true }));
}
function mainCase({ name, mix = 1, pressed = false, direction = 'up-right', view = 'front',
  useRange = false, resetInputs = false, resetCamera = false }) {
  const actions = [{ type: 'select', selector: '#simpleMode', value: 'manual' },
    { type: 'click', selector: '#simpleResetInputs' },
    useRange ? { type: 'range', selector: '#simpleLookMix', value: mix * 100 }
      : { type: 'click', selector: `[data-look="${mix}"]` }];
  if (pressed || resetInputs) actions.push({ type: 'check', selector: '#simpleAllButtons' },
    { type: 'select', selector: '#simpleStickDirection', value: direction });
  actions.push({ type: 'click', selector: `[data-view="${view}"]` });
  if (resetInputs) actions.push({ type: 'click', selector: '#simpleResetInputs' });
  if (resetCamera) actions.push({ type: 'click', selector: '#simpleReset' });
  const finalPressed = pressed && !resetInputs;
  return { name, category: 'main-ui', path: 'index.html?contrast=D', model: 'dualsense',
    viewport: { width: 1500, height: 1000 }, actions,
    assertions: [
      { selector: '#simpleMode', kind: 'value', expected: 'manual' },
      { selector: '#simpleLookMix', kind: 'value', expected: String(mix * 100) },
      { selector: '#simpleAllButtons', kind: 'checked', expected: finalPressed },
      { selector: '#simpleStickDirection', kind: 'value', expected: finalPressed ? direction : 'auto' },
      { selector: '#simpleStickPoseOptions', kind: 'hidden', expected: !finalPressed },
      { selector: `[data-view="${resetCamera ? 'front' : view}"]`, kind: 'class', expected: 'selected' },
    ] };
}
for (const [material, mix] of [['ghost', 1], ['glass', 0.5], ['normal', 0]]) {
  cases.push(mainCase({ name: `main-${material}-neutral-front`, mix }));
  cases.push(mainCase({ name: `main-${material}-pressed-up-right-front`, mix, pressed: true }));
}
for (const mix of [0.25, 0.75]) cases.push(mainCase({ name: `main-mix-${mix * 100}-neutral-front`, mix, useRange: true }));
for (const direction of ['right', 'down']) cases.push(mainCase({ name: `main-ghost-pressed-${direction}-front`, pressed: true, direction }));
for (const view of ['angled', 'rear']) {
  cases.push(mainCase({ name: `main-ghost-neutral-${view}`, view }));
  cases.push(mainCase({ name: `main-ghost-pressed-up-right-${view}`, view, pressed: true }));
}
cases.push(mainCase({ name: 'main-reset-inputs-after-press', view: 'angled', resetInputs: true }));
cases.push(mainCase({ name: 'main-reset-camera-after-angle', view: 'angled', resetCamera: true }));

if (new Set(cases.map(item => item.name)).size !== cases.length) throw new Error('Duplicate capture case name');
const counts = Object.fromEntries([...new Set(cases.map(item => item.category))].map(category =>
  [category, cases.filter(item => item.category === category).length]));
if (counts['neutral-grid'] !== 45 || counts['pressed-grid'] !== 9 || counts['stick-geometry'] !== 96)
  throw new Error('Required capture matrix coverage is incomplete');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(cases, null, 2) + '\n');
console.log(JSON.stringify({ file: output, cases: cases.length, categories: counts, status: 'Capture plan only; all visual review remains pending' }, null, 2));
