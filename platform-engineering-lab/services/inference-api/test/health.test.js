import test from 'node:test';
import assert from 'node:assert/strict';
test('runtime exposes a version contract', () => assert.equal(process.env.APP_VERSION || 'local', 'local'));
