import assert from 'node:assert/strict';
import { createRailwayContext, project } from 'railway/iac';
import configuration from '../.railway/railway.ts';

const { resources } = await configuration(
  createRailwayContext({ environment: 'production' }),
  project,
);
const app = resources.find(({ name }) => name === 'OpenDots');
const browser = resources.find(({ name }) => name === 'Browser');
const data = resources.find(({ type }) => type === 'volume');
assert.equal(resources.length, 3);

for (const service of [app, browser]) {
  assert.equal(service.source.repo, 'warengonzaga/opendots-railway');
  assert.equal(service.build.builder, 'DOCKERFILE');
  assert.equal(service.deploy.numReplicas, 1);
  assert.equal(service.deploy.sleepApplication, false);
  assert.equal(service.deploy.startCommand, undefined, 'Preserve the image entrypoint.');
  assert.equal(service.networking, undefined, 'Add a public domain only to OpenDots.');
}
assert.equal(app.variables.OPENDOTS_SERVICE.value, 'app');
assert.equal(browser.variables.OPENDOTS_SERVICE.value, 'browser');
assert.equal(app.variables.HOST.value, '::');
assert.equal(browser.variables.BROWSER_HOST.value, '::');
assert.equal(app.deploy.healthcheckPath, '/');
assert.equal(browser.deploy.healthcheckPath, undefined, 'Browser health requires bearer auth.');
assert.equal(app.volumeAttachments[data.name].volume, data.address);
assert.equal(app.volumeAttachments[data.name].mountPath, '/data');
assert.equal(app.variables.DATABASE_PATH.value, '/data/opendots.sqlite');
assert.equal(app.variables.OWNER_ID.value, '${{RAILWAY_PROJECT_ID}}');
assert.deepEqual(app.variables.OWNER_TOKEN, { type: 'sharedReference', name: 'OWNER_TOKEN' });
assert.deepEqual(browser.variables.BROWSER_SECRET, { type: 'sharedReference', name: 'BROWSER_SECRET' });
assert.deepEqual(app.variables.BROWSER_SECRET, {
  type: 'reference', resource: browser.address, output: 'BROWSER_SECRET',
});
assert.equal(app.variables.BROWSER_URL.value, 'http://${{Browser.RAILWAY_PRIVATE_DOMAIN}}:4311');
assert.equal(app.variables.APP_ORIGIN.value, 'https://${{RAILWAY_PUBLIC_DOMAIN}}');
assert.equal(app.variables.OPENAI_MODEL.value, 'gpt-4.1-mini');
assert.equal(app.variables.OPENAI_BASE_URL.value, 'https://api.openai.com/v1');
for (const key of ['INTELLIGENCE_API_KEY', 'OPENAI_API_KEY']) {
  assert.deepEqual(app.variables[key], { type: 'sharedReference', name: key });
}
console.log('Railway authoring configuration and security contracts passed (offline).');
