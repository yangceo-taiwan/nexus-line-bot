const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.CHANNEL_ACCESS_TOKEN = 'test-token';
process.env.CHANNEL_SECRET = 'test-secret';
process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_KEY = 'test-key';

const app = require('../api/index');
const { __test } = app;

test('common road name produces only one query variant', () => {
  assert.deepEqual(__test.buildKeywordVariants('海安路'), ['海安路']);
});

test('city prefix is removed without adding redundant prefixes', () => {
  assert.deepEqual(
    __test.buildKeywordVariants('台南市海安路'),
    ['台南市海安路', '海安路']
  );
});

test('Arabic digits keep a full-width fallback variant', () => {
  assert.deepEqual(
    __test.buildKeywordVariants('永華路2段'),
    ['永華路2段', '永華路２段']
  );
});

test('sale filters are combined into one PostgREST OR request', () => {
  assert.equal(
    __test.buildIlikeOrFilter('海安路', ['address', 'notes']),
    'address.ilike.%海安路%,notes.ilike.%海安路%'
  );
});

test('unsafe PostgREST punctuation is stripped', () => {
  assert.equal(__test.safeKeywordForOr('海安路,(測試)%'), '海安路 測試');
});

test('LINE webhook acknowledges an empty verified event immediately', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  await new Promise(resolve => server.once('listening', resolve));

  const { port } = server.address();
  const body = JSON.stringify({
    destination: 'test-destination',
    events: []
  });
  const signature = crypto
    .createHmac('sha256', process.env.CHANNEL_SECRET)
    .update(body)
    .digest('base64');
  const startedAt = Date.now();

  const response = await fetch(`http://127.0.0.1:${port}/api`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-line-signature': signature
    },
    body
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'OK');
  assert.ok(Date.now() - startedAt < 1000);
});
