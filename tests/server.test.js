// Server safety checks. Run: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const { server, isPrivateAddress, safeFetch } = require('../server.js');

test('private and local network addresses are refused', async () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '151.101.1.69', '2606:4700::1111']) assert.equal(isPrivateAddress(ip), false, ip);
  await assert.rejects(safeFetch('http://127.0.0.1/'), /local addresses/);
  await assert.rejects(safeFetch('http://localhost:3000/'), /unusual port|local addresses/);
  await assert.rejects(safeFetch('http://169.254.169.254/latest/meta-data/'), /local addresses/);
  await assert.rejects(safeFetch('file:///etc/passwd'), /only http and https/);
});

test('serves the app but nothing outside it', async (t) => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = (p) => fetch(base + p);

  assert.equal((await get('/')).status, 200);
  assert.match(await (await get('/')).text(), /<title>Cookbook/);
  assert.equal((await get('/parser.js')).status, 200);
  assert.equal((await get('/api/health')).status, 200);
  for (const p of ['/server.js', '/importer.js', '/tests/run.js', '/../server.js', '/%2e%2e/%2e%2e/etc/passwd', '/.git/config', '/package.json/../../etc/hosts']) {
    assert.equal((await get(p)).status, 404, p);
  }
  const bad = await get('/api/import?url=not-a-link');
  assert.equal(bad.status, 422);
  const badBody = await bad.json();
  assert.equal(badBody.code, 'invalid-link');
  assert.match(badBody.error, /^Enter a full link starting with http/);
  const local = await get('/api/import?url=' + encodeURIComponent('http://127.0.0.1/recipe'));
  const localBody = await local.json();
  assert.equal(localBody.code, 'unreachable');
  assert.match(localBody.error, /^Couldn't reach that page \(local addresses are not allowed\)/);
});
