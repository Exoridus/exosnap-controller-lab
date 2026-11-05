#!/usr/bin/env node
/**
 * Real Chromium/WebGL captures. A successful capture is not visual acceptance.
 *
 * node tools/generate-capture-matrix.mjs
 * node tools/browser-capture.mjs --base http://127.0.0.1:8792/ \
 *   --matrix evidence/capture-cases.json --out evidence/browser
 *
 * Cases: {name,path,viewport?:{width,height},size?:'240x160',model?,renderModel?,
 *         actions?,assertions?,ready?,deviceScaleFactor?,settleMs?,fullPage?}.
 * viewport and size are equivalent; if both are present they must agree.
 * No browser is downloaded. --executable or CHROMIUM_EXECUTABLE takes priority;
 * otherwise installed Playwright Chromium, Chrome, Chromium, or Edge is located.
 */
import { createRequire } from 'node:module';
import { existsSync, statSync, readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const flags = new Set(['--help', '--validate-only']);
const values = new Set(['--base', '--out', '--viewport', '--timeout', '--settle', '--device-scale', '--executable', '--matrix', '--renderer', '--group']);
const options = {};
for (let i = 0; i < process.argv.slice(2).length; i++) {
  const args = process.argv.slice(2), key = args[i];
  if (flags.has(key)) options[key] = true;
  else if (values.has(key) && args[i + 1] && !args[i + 1].startsWith('--')) options[key] = args[++i];
  else throw new Error(`Unknown option or missing value: ${key}`);
}
if (options['--help']) {
  console.log('node tools/browser-capture.mjs [--base http://127.0.0.1:8792/] [--matrix FILE] [--out DIR]\n  [--executable PATH] [--viewport WIDTHxHEIGHT] [--device-scale NUMBER]\n  [--renderer software|default] [--timeout MS] [--settle MS] [--group CATEGORY] [--validate-only]');
  process.exit(0);
}
function numberInRange(value, label, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${label} must be a number from ${min} to ${max}`);
  return n;
}
function dimensions(value, label) {
  let width, height;
  if (typeof value === 'string' && /^\d+x\d+$/.test(value)) [width, height] = value.split('x').map(Number);
  else if (value && typeof value === 'object') ({ width, height } = value);
  if (![width, height].every(n => Number.isInteger(n) && n > 0 && n <= 8192) || width * height > 16777216)
    throw new Error(`${label} must have positive integer width/height, at most 8192 each and 16 million pixels`);
  return { width, height };
}
const base = new URL(options['--base'] || 'http://127.0.0.1:8792/');
if (!['http:', 'https:'].includes(base.protocol) || base.search || base.hash) throw new Error('--base must be an HTTP(S) directory URL without query or fragment');
if (!base.pathname.endsWith('/')) base.pathname += '/';
const baseURL = base.href;
const outputDir = path.resolve(options['--out'] || 'evidence/browser');
const viewport = dimensions(options['--viewport'] || '1500x1000', '--viewport');
const timeoutMs = numberInRange(options['--timeout'] || 45000, '--timeout', 1000, 300000);
const settleMs = numberInRange(options['--settle'] ?? 900, '--settle', 0, 30000);
const deviceScaleFactor = numberInRange(options['--device-scale'] || 1, '--device-scale', 0.25, 4);
const rendererMode = options['--renderer'] || 'software';
if (!['software', 'default'].includes(rendererMode)) throw new Error('--renderer must be software or default');
const defaultCases = [
  { name: 'normal-six-panel', path: 'index.html', model: 'dualsense' },
  { name: 'diagnostic-front-left', path: 'index.html?diagnostic=1&layout=dualsense&mix=1&view=front&focus=left&label=0&alphaSamples=1', model: 'dualsense' },
  { name: 'diagnostic-profile-left', path: 'index.html?diagnostic=1&layout=dualsense&mix=1&view=profile&focus=left&label=0&alphaSamples=1', model: 'dualsense' },
];
const rawCases = options['--matrix'] ? JSON.parse(await readFile(options['--matrix'], 'utf8')) : defaultCases;
if (!Array.isArray(rawCases) || !rawCases.length) throw new Error('Matrix must be a nonempty JSON array');
const actionTypes = new Set(['click', 'select', 'check', 'uncheck', 'fill', 'range']);
const assertionKinds = new Set(['value', 'checked', 'hidden', 'class', 'text']);
let cases = rawCases.map((item, index) => {
  const label = `Case ${index + 1}`;
  if (!item || typeof item.name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/.test(item.name) || typeof item.path !== 'string')
    throw new Error(`${label} needs a safe name and URL path`);
  const url = new URL(item.path, baseURL);
  if (url.origin !== base.origin || !['http:', 'https:'].includes(url.protocol)) throw new Error(`${label} must stay on the supplied base origin`);
  const caseViewport = item.viewport !== undefined ? dimensions(item.viewport, `${label} viewport`) : item.size !== undefined ? dimensions(item.size, `${label} size`) : viewport;
  if (item.viewport !== undefined && item.size !== undefined) {
    const size = dimensions(item.size, `${label} size`);
    if (size.width !== caseViewport.width || size.height !== caseViewport.height) throw new Error(`${label} viewport and size disagree`);
  }
  for (const field of ['model', 'renderModel']) if (item[field] !== undefined && (typeof item[field] !== 'string' || !item[field])) throw new Error(`${label} ${field} must be a nonempty string`);
  if (item.fullPage !== undefined && typeof item.fullPage !== 'boolean') throw new Error(`${label} fullPage must be boolean`);
  const actions = item.actions || [];
  if (!Array.isArray(actions)) throw new Error(`${label} actions must be an array`);
  for (const action of actions) {
    if (!actionTypes.has(action.type) || typeof action.selector !== 'string' || !action.selector) throw new Error(`${label} has an invalid action`);
    if (['select', 'fill', 'range'].includes(action.type) && action.value === undefined) throw new Error(`${label} action ${action.type} needs a value`);
    if (action.type === 'range' && !Number.isFinite(Number(action.value))) throw new Error(`${label} range value must be finite`);
  }
  const assertions = item.assertions || [];
  if (!Array.isArray(assertions)) throw new Error(`${label} assertions must be an array`);
  for (const assertion of assertions) if (!assertionKinds.has(assertion.kind) || typeof assertion.selector !== 'string' || assertion.expected === undefined) throw new Error(`${label} has an invalid UI assertion`);
  const ready = item.ready ? (Array.isArray(item.ready) ? item.ready : [item.ready]) : [];
  for (const marker of ready) if (!marker || typeof marker.dataset !== 'string' || typeof marker.value !== 'string') throw new Error(`${label} ready markers need dataset/value strings`);
  return { ...item, url: url.href, diagnostic: url.searchParams.get('diagnostic') === '1',
    model: item.model || url.searchParams.get('layout') || undefined, viewport: caseViewport, actions, assertions, ready,
    deviceScaleFactor: numberInRange(item.deviceScaleFactor ?? deviceScaleFactor, `${label} deviceScaleFactor`, 0.25, 4),
    settleMs: numberInRange(item.settleMs ?? settleMs, `${label} settleMs`, 0, 30000) };
});
if (new Set(cases.map(item => item.name)).size !== cases.length) throw new Error('Capture case names must be unique');
if (options['--group']) cases = cases.filter(item => item.category === options['--group']);
if (!cases.length) throw new Error('No cases match the requested group');
const groupCounts = Object.fromEntries([...new Set(cases.map(item => item.category || 'default'))].map(category => [category, cases.filter(item => (item.category || 'default') === category).length]));
if (options['--validate-only']) {
  console.log(JSON.stringify({ validCases: cases.length, groups: groupCounts, viewportSizes: [...new Set(cases.map(item => `${item.viewport.width}x${item.viewport.height}`))], status: 'Configuration validation only; no browser render or visual acceptance' }, null, 2));
  process.exit(0);
}
await mkdir(outputDir, { recursive: true });
const manifest = { startedAt: new Date().toISOString(), baseURL, defaultViewport: viewport,
  deviceScaleFactor, requestedRenderer: rendererMode, expectedCases: cases.length, groups: groupCounts,
  visualAcceptance: 'Not assessed by the capture runner; every image requires review', cases: [] };
const saveManifest = () => writeFile(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

function installedBrowser(playwright) {
  const explicit = options['--executable'] || process.env.CHROMIUM_EXECUTABLE;
  const isFile = candidate => { try { return existsSync(candidate) && statSync(candidate).isFile(); } catch { return false; } };
  if (explicit) {
    const candidate = path.resolve(explicit);
    if (!isFile(candidate)) throw new Error(`Explicit Chromium executable does not exist: ${candidate}`);
    return { executablePath: candidate, source: options['--executable'] ? '--executable' : 'CHROMIUM_EXECUTABLE' };
  }
  const candidates = [playwright.chromium.executablePath()];
  if (process.platform === 'win32') {
    for (const root of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) candidates.push(path.join(root, 'Microsoft/Edge/Application/msedge.exe'));
    for (const root of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) candidates.push(path.join(root, 'Google/Chrome/Application/chrome.exe'));
  } else if (process.platform === 'darwin') {
    candidates.push('/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else candidates.push('/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/opt/google/chrome/chrome', '/opt/microsoft/msedge/msedge');
  const browserNames = process.platform === 'win32' ? ['msedge.exe', 'chrome.exe', 'chromium.exe'] : ['chromium', 'chromium-browser', 'google-chrome', 'microsoft-edge'];
  for (const dir of (process.env.PATH || '').split(path.delimiter).filter(Boolean)) for (const name of browserNames) candidates.push(path.join(dir, name));
  const cacheRoots = [path.resolve(playwright.chromium.executablePath(), '../../..'),
    process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0' ? path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH) : null,
    process.platform === 'win32' && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'ms-playwright') : process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Caches/ms-playwright') : path.join(os.homedir(), '.cache/ms-playwright')].filter(Boolean);
  for (const root of new Set(cacheRoots)) {
    let entries = []; try { entries = readdirSync(root).filter(name => name.startsWith('chromium_headless_shell-')).sort().reverse(); } catch {}
    for (const entry of entries) for (const suffix of ['chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-headless-shell-mac-x64/chrome-headless-shell']) candidates.push(path.join(root, entry, suffix));
  }
  const attempted = [...new Set(candidates)];
  const executablePath = attempted.find(isFile);
  manifest.browserDiscovery = { attempted, executablePath: executablePath || null };
  if (!executablePath) throw new Error('No installed Chromium, Chrome, or Edge executable was found. Supply --executable PATH or CHROMIUM_EXECUTABLE.');
  return { executablePath, source: 'installed browser discovery' };
}
async function waitForRenderer(page, item, expected) {
  await page.waitForFunction(({ diagnostic, model, renderModel, ready, expected }) => {
    const data = document.body?.dataset;
    if (!data?.modelReady || (expected && model && data.modelReady !== model)) return false;
    if (diagnostic && (!data.renderReady || (expected && renderModel && data.renderReady !== renderModel) || !data.webglRenderer)) return false;
    const overlay = document.querySelector('#loadOverlay');
    if (overlay && !overlay.classList.contains('hidden')) return false;
    const canvas = document.querySelector('#scene');
    if (!canvas || canvas.width < 2 || canvas.height < 2) return false;
    return !expected || ready.every(marker => data[marker.dataset] === marker.value);
  }, { diagnostic: item.diagnostic, model: item.model, renderModel: item.renderModel, ready: item.ready, expected }, { timeout: timeoutMs });
}
async function inspectFrame(page) {
  return page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => {
    const canvas = document.querySelector('#scene'), rect = canvas?.getBoundingClientRect();
    const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
    const debug = gl?.getExtension('WEBGL_debug_renderer_info');
    let alpha = null, readbackError = null;
    if (gl && !gl.isContextLost()) {
      try {
        const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        alpha = { zero: 0, translucent: 0, opaque: 0, sampled: 0 };
        const stepX = Math.max(1, Math.floor(width / 96)), stepY = Math.max(1, Math.floor(height / 96));
        for (let y = 0; y < height; y += stepY) for (let x = 0; x < width; x += stepX) {
          const a = pixels[(y * width + x) * 4 + 3];
          alpha[a === 0 ? 'zero' : a === 255 ? 'opaque' : 'translucent']++; alpha.sampled++;
        }
      } catch (error) { readbackError = String(error); }
    }
    resolve({ title: document.title, dataset: { ...document.body.dataset },
      viewport: { width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio },
      canvas: canvas && { width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height },
      webgl: gl && { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER), vendor: gl.getParameter(gl.VENDOR), unmaskedRenderer: debug && gl.getParameter(debug.UNMASKED_RENDERER_WEBGL), unmaskedVendor: debug && gl.getParameter(debug.UNMASKED_VENDOR_WEBGL), contextLost: gl.isContextLost(), alpha, readbackError },
      panels: [...document.querySelectorAll('[data-parity-kind]')].map(element => ({ kind: element.dataset.parityKind, scene: element.dataset.parityScene, rect: element.getBoundingClientRect().toJSON() })),
      controls: Object.fromEntries(['simpleModel', 'simpleMode', 'simpleLookMix', 'simpleStickDirection'].map(id => [id, document.getElementById(id)?.value])),
      allButtons: document.getElementById('simpleAllButtons')?.checked,
      overflow: { documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, documentHeight: document.documentElement.scrollHeight, viewportHeight: innerHeight },
      visibleText: document.body.innerText });
  })));
}

let browser;
try {
  let playwright;
  const runtime = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules';
  for (const moduleName of ['playwright', 'playwright-core', path.join(runtime, 'playwright')]) {
    try { playwright = require(moduleName); manifest.automationPackage = moduleName; break; } catch {}
  }
  if (!playwright) throw new Error('Playwright is unavailable. Run this tool in an environment with playwright or playwright-core installed.');
  const discovery = installedBrowser(playwright);
  Object.assign(manifest, discovery);
  const browserArgs = rendererMode === 'software' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [];
  if (process.platform === 'linux') browserArgs.push('--disable-dev-shm-usage');
  if (process.platform === 'linux' && process.getuid?.() === 0) browserArgs.push('--no-sandbox');
  manifest.browserArgs = browserArgs;
  browser = await playwright.chromium.launch({ headless: true, executablePath: discovery.executablePath, args: browserArgs, timeout: timeoutMs });
  manifest.browserVersion = browser.version();
  await saveManifest();
  for (const item of cases) {
    const record = { name: item.name, category: item.category, url: item.url, requestedViewport: item.viewport,
      deviceScaleFactor: item.deviceScaleFactor, startedAt: new Date().toISOString(), visualAcceptance: 'Not assessed',
      console: [], pageErrors: [], requestFailures: [], httpErrors: [] };
    let context, page, detach = () => {};
    try {
      context = await browser.newContext({ viewport: item.viewport, deviceScaleFactor: item.deviceScaleFactor, reducedMotion: 'reduce' });
      page = await context.newPage(); page.setDefaultTimeout(timeoutMs);
      let rejectFatal;
      const fatal = new Promise((resolve, reject) => { rejectFatal = reject; });
      fatal.catch(() => {});
      const runtimeError = message => { if (!record.fatalRuntimeError) { record.fatalRuntimeError = message; rejectFatal(new Error(message)); } };
      const handlers = {
        console: message => { const entry = { type: message.type(), text: message.text(), location: message.location() }; record.console.push(entry); if (entry.type === 'error') runtimeError(`Browser console.error: ${entry.text}`); },
        pageerror: error => { record.pageErrors.push(error.stack || error.message); runtimeError(`Uncaught page error: ${error.message}`); },
        requestfailed: request => { record.requestFailures.push({ url: request.url(), failure: request.failure() }); runtimeError(`Request failed: ${request.url()}`); },
        response: response => { if (response.status() >= 400) { record.httpErrors.push({ url: response.url(), status: response.status() }); runtimeError(`HTTP ${response.status()}: ${response.url()}`); } },
      };
      for (const [event, handler] of Object.entries(handlers)) page.on(event, handler);
      detach = () => { for (const [event, handler] of Object.entries(handlers)) page.off(event, handler); };
      const guarded = async (promise, label) => {
        let timer;
        try { return await Promise.race([promise, fatal, new Promise((resolve, reject) => { timer = setTimeout(() => reject(new Error(`${label} exceeded ${timeoutMs} ms`)), timeoutMs); })]); }
        finally { clearTimeout(timer); }
      };
      const response = await guarded(page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs }), 'Navigation');
      record.navigationStatus = response?.status();
      await guarded(waitForRenderer(page, item, false), 'Initial renderer readiness');
      for (const action of item.actions) {
        const locator = page.locator(action.selector);
        if (action.type === 'click') await guarded(locator.click(), 'UI click');
        else if (action.type === 'select') await guarded(locator.selectOption(action.value), 'UI select');
        else if (action.type === 'check') await guarded(locator.check(), 'UI check');
        else if (action.type === 'uncheck') await guarded(locator.uncheck(), 'UI uncheck');
        else if (action.type === 'fill') await guarded(locator.fill(String(action.value)), 'UI fill');
        else if (action.type === 'range') await guarded(locator.evaluate((element, value) => {
          if (!(element instanceof HTMLInputElement) || element.type !== 'range') throw new Error('Range action requires an actual range input');
          if (Number(value) < Number(element.min || 0) || Number(value) > Number(element.max || 100)) throw new Error('Range value exceeds the UI limits');
          element.value = String(value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
        }, action.value), 'UI range');
      }
      await guarded(waitForRenderer(page, item, true), 'Requested renderer readiness');
      await guarded(page.waitForLoadState('networkidle', { timeout: timeoutMs }), 'Asset loading');
      await guarded(page.waitForTimeout(item.settleMs), 'Render settling');
      record.uiAssertions = await guarded(page.evaluate(assertions => assertions.map(assertion => {
        const matches = document.querySelectorAll(assertion.selector), element = matches.length === 1 ? matches[0] : null;
        const actual = !element ? null : assertion.kind === 'class' ? element.classList.contains(assertion.expected)
          : assertion.kind === 'text' ? element.textContent : element[assertion.kind];
        const passed = Boolean(element) && (assertion.kind === 'class' ? actual === true : actual === assertion.expected);
        return { ...assertion, matches: matches.length, actual, passed };
      }), item.assertions), 'UI state checks');
      if (record.uiAssertions.some(assertion => !assertion.passed)) throw new Error('Requested UI state was not reached');
      record.runtime = await guarded(inspectFrame(page), 'Actual WebGL frame inspection');
      const runtime = record.runtime, gl = runtime.webgl;
      const requested = new URL(item.url).searchParams;
      if (requested.has('contrast') && runtime.dataset.contrast !== requested.get('contrast')) throw new Error('Active contrast candidate differs from the requested case');
      if (item.diagnostic && requested.has('mix') && Math.abs(Number(runtime.controls.simpleLookMix) - Number(requested.get('mix')) * 100) > 0.01) throw new Error('Active diagnostic material mix differs from the requested case');
      if (!gl || gl.contextLost) throw new Error('The actual scene has no live WebGL context');
      if (gl.readbackError || !gl.alpha || gl.alpha.translucent + gl.alpha.opaque === 0) throw new Error('The actual WebGL frame has no nontransparent rendered samples');
      if (runtime.viewport.width !== item.viewport.width || runtime.viewport.height !== item.viewport.height) throw new Error('Actual browser viewport does not match the requested case size');
      if (item.diagnostic && (Math.abs(runtime.canvas.cssWidth - item.viewport.width) > 0.5 || Math.abs(runtime.canvas.cssHeight - item.viewport.height) > 0.5)) throw new Error('Diagnostic canvas CSS dimensions do not match the requested size');
      if (item.diagnostic && new URL(item.url).searchParams.get('alphaSamples') === '1') {
        let samples; try { samples = JSON.parse(runtime.dataset.alphaSamples); } catch {}
        if (!samples || !(samples.translucent + samples.opaque > 0)) throw new Error('The app has not reported a nonempty diagnostic rendered frame');
      }
      record.screenshot = `${item.name}.png`;
      await page.screenshot({ path: path.join(outputDir, record.screenshot), fullPage: Boolean(item.fullPage), timeout: timeoutMs });
      record.status = 'captured';
    } catch (error) {
      record.status = 'failed'; record.error = error.stack || error.message;
      if (page) {
        if (!record.runtime) try { record.failureDOM = await page.evaluate(() => ({ title: document.title, dataset: { ...document.body.dataset }, viewport: { width: innerWidth, height: innerHeight }, visibleText: document.body.innerText })); } catch {}
        try { record.failureScreenshot = `${item.name}-failure.png`; await page.screenshot({ path: path.join(outputDir, record.failureScreenshot), fullPage: Boolean(item.fullPage), timeout: timeoutMs }); } catch (screenshotError) { delete record.failureScreenshot; record.screenshotError = screenshotError.message; }
      }
    } finally {
      detach();
      record.errorCounts = { console: record.console.filter(entry => entry.type === 'error').length,
        shader: record.console.filter(entry => /THREE\.WebGLProgram: Shader Error|shader.*(?:compile|link).*(?:fail|error)|(?:compile|link).*shader.*(?:fail|error)/i.test(entry.text)).length,
        page: record.pageErrors.length, request: record.requestFailures.length, http: record.httpErrors.length };
      if (Object.values(record.errorCounts).some(count => count > 0)) record.status = 'failed';
      if (context) try { await context.close(); } catch (error) { record.closeError = error.message; record.status = 'failed'; }
      record.finishedAt = new Date().toISOString();
      manifest.cases.push(record);
      await writeFile(path.join(outputDir, `${item.name}.json`), JSON.stringify(record, null, 2) + '\n');
      await saveManifest();
      console.log(`${record.status}: ${item.name}${record.runtime?.webgl ? ` (${record.runtime.webgl.unmaskedRenderer || record.runtime.webgl.renderer})` : ''}`);
    }
  }
} catch (error) {
  manifest[browser ? 'captureError' : 'launchError'] = error.stack || error.message;
  console.error(error.message);
} finally {
  if (browser) try { await browser.close(); } catch (error) { manifest.closeError = error.message; }
  manifest.finishedAt = new Date().toISOString();
  manifest.summary = { captured: manifest.cases.filter(item => item.status === 'captured').length,
    failed: manifest.cases.filter(item => item.status === 'failed').length, notRun: cases.length - manifest.cases.length };
  manifest.status = manifest.launchError ? 'blocked' : manifest.captureError || manifest.closeError || manifest.summary.failed || manifest.summary.notRun ? 'failed' : 'captured-pending-visual-review';
  await saveManifest();
}
if (manifest.status !== 'captured-pending-visual-review') process.exitCode = 1;
