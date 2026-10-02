import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const prefix = `opendots-smoke-${randomUUID()}`;
const owner = randomBytes(24).toString('hex');
const secret = randomBytes(24).toString('hex');
const origin = 'http://opendots.test';
const containers = new Set();
let network;
let volume;

async function docker(...args) {
  const { stdout, stderr } = await exec('docker', args, {
    timeout: 30_000, killSignal: 'SIGKILL', maxBuffer: 1_000_000,
  });
  return (args[0] === 'logs' ? stdout + stderr : stdout).trim();
}
async function request(base, path, headers = {}, method = 'GET', body, timeout = 5000) {
  const response = await fetch(`${base}${path}`, {
    method, headers, signal: AbortSignal.timeout(timeout), redirect: 'error',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data };
}
async function ready(base, path) {
  const deadline = Date.now() + 45_000;
  let last;
  while (Date.now() < deadline) {
    try {
      last = await request(base, path);
      if (last.status === 401) return;
    } catch (error) { last = error.message; }
    await delay(250);
  }
  throw new Error(`Readiness timed out for ${path}: ${JSON.stringify(last)}`);
}
async function create(image, name, port, args) {
  const id = await docker('create', '--name', `${prefix}-${name}`, '--network', network,
    '-p', `127.0.0.1::${port}`, ...args, image);
  containers.add(id);
  await docker('start', id);
  const address = await docker('port', id, `${port}/tcp`);
  assert.match(address, /^127\.0\.0\.1:\d+$/);
  return { id, base: `http://${address}` };
}
const appHeaders = { Authorization: `Bearer ${owner}`, Origin: origin, 'Content-Type': 'application/json' };
const browserHeaders = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };
const appArgs = () => ['--user', '0', '-v', `${volume}:/data`,
  '-e', 'HOST=::', '-e', 'PORT=4310', '-e', 'DATABASE_PATH=/data/opendots.sqlite',
  '-e', `OWNER_TOKEN=${owner}`, '-e', `APP_ORIGIN=${origin}`, '-e', 'OWNER_ID=smoke-owner',
  '-e', 'INTELLIGENCE_API_KEY=', '-e', 'OPENAI_API_KEY=', '-e', 'OPENAI_MODEL=',
  '-e', 'BROWSER_URL=http://browser:4311', '-e', `BROWSER_SECRET=${secret}`];

try {
  await docker('image', 'inspect', 'opendots-railway:app', 'opendots-railway:browser');
  network = await docker('network', 'create', prefix);
  volume = await docker('volume', 'create', prefix);
  const browser = await create('opendots-railway:browser', 'browser', 4311,
    ['--network-alias', 'browser', '-e', 'BROWSER_HOST=::', '-e', 'BROWSER_PORT=4311', '-e', `BROWSER_SECRET=${secret}`]);
  await ready(browser.base, '/health');
  assert.equal((await request(browser.base, '/health')).status, 401);
  assert.equal((await request(browser.base, '/health', { Authorization: 'Bearer wrong' })).status, 401);
  assert.deepEqual(await request(browser.base, '/health', browserHeaders), { status: 200, data: { ok: true } });
  const blocked = await request(browser.base, '/browse', browserHeaders, 'POST', { url: 'http://127.0.0.1/' });
  assert.equal(blocked.status, 502);
  assert.match(blocked.data.error, /Private or special network addresses are blocked/);

  let app = await create('opendots-railway:app', 'app', 4310, appArgs());
  await ready(app.base, '/api/workspace');
  const processStatus = await docker('exec', app.id, 'sh', '-c', 'cat /proc/1/comm /proc/1/status');
  assert.match(processStatus, /^node\n/);
  assert.match(processStatus, /^Uid:\s+1000\s+1000\s+1000\s+1000$/m);
  assert.match(processStatus, /^Gid:\s+1000\s+1000\s+1000\s+1000$/m);
  assert.equal((await request(app.base, '/')).status, 200);
  assert.equal((await request(app.base, '/api/workspace')).status, 401);
  assert.equal((await request(app.base, '/api/workspace', { ...appHeaders, Authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await request(app.base, '/api/workspace', { ...appHeaders, Origin: 'https://invalid.example' })).status, 403);
  assert.equal((await request(app.base, '/api/workspace', { ...appHeaders, 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  const workspace = await request(app.base, '/api/workspace', appHeaders);
  assert.equal(workspace.status, 200);
  assert.deepEqual(workspace.data.setup.missing, ['INTELLIGENCE_API_KEY', 'OPENAI_API_KEY', 'OPENAI_MODEL']);
  const space = await request(app.base, '/api/spaces', appHeaders, 'POST', { name: 'Railway smoke', description: 'persistence check' });
  assert.equal(space.status, 201);
  assert.equal(typeof space.data.id, 'string');
  const page = await request(app.base, `/api/spaces/${space.data.id}/pages`, appHeaders, 'POST',
    { title: 'Persistence smoke', content: prefix });
  assert.equal(page.status, 201);
  assert.equal(page.data.revision, 1);
  const pagePath = `/api/spaces/${space.data.id}/pages/${page.data.id}`;
  await docker('stop', '--time', '12', app.id);
  await docker('rm', app.id);
  containers.delete(app.id);
  app = await create('opendots-railway:app', 'app-recreated', 4310, appArgs());
  await ready(app.base, '/api/workspace');
  assert.deepEqual(await request(app.base, pagePath, appHeaders), { status: 200, data: page.data });

  const browsed = await request(browser.base, '/browse', browserHeaders, 'POST', { url: 'https://example.com/' }, 45_000);
  assert.equal(browsed.status, 200, `Public browsing failed: ${JSON.stringify(browsed.data)}`);
  assert.equal(typeof browsed.data.text, 'string');
  assert.ok(browsed.data.text.trim().length > 0, 'Public browsing returned empty text');
  assert.match(browsed.data.screenshot, /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/);
  assert.ok(Buffer.from(browsed.data.screenshot.split(',')[1], 'base64').length > 100, 'Screenshot is empty');
  console.log('PASS: auth, origin, non-root Node PID 1, recreated-container persistence, browser auth, SSRF blocking, and public browsing.');
} catch (error) {
  process.exitCode = 1;
  console.error(error);
  for (const id of containers) {
    try { console.error(await docker('logs', '--tail', '40', id)); }
    catch (logError) { console.error(`Could not read container logs: ${logError.message}`); }
  }
} finally {
  const cleanup = [...containers].map((id) => ['rm', '-f', id]);
  if (volume) cleanup.push(['volume', 'rm', volume]);
  if (network) cleanup.push(['network', 'rm', network]);
  for (const args of cleanup) {
    try { await docker(...args); }
    catch (error) { process.exitCode = 1; console.error(`Cleanup failed: ${error.message}`); }
  }
}
