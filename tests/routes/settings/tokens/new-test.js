import { click, currentURL, fillIn, waitFor } from '@ember/test-helpers';
import { module, test } from 'qunit';

import { defer } from 'rsvp';

import { Response } from 'miragejs';

import { setupApplicationTest } from 'cargo/tests/helpers';

import { visit } from '../../../helpers/visit-ignoring-abort';

module('/settings/tokens/new', function (hooks) {
  setupApplicationTest(hooks);

  function prepare(context) {
    let user = context.server.create('user', {
      login: 'johnnydee',
      name: 'John Doe',
      email: 'john@doe.com',
      avatar: 'https://avatars2.githubusercontent.com/u/1234567?v=4',
    });

    context.authenticateAs(user);
  }

  test('can navigate to the route', async function (assert) {
    prepare(this);

    await visit('/');
    assert.strictEqual(currentURL(), '/');

    await click('[data-test-user-menu] [data-test-toggle]');
    await click('[data-test-user-menu] [data-test-settings]');
    assert.strictEqual(currentURL(), '/settings/profile');

    await click('[data-test-settings-menu] [data-test-tokens] a');
    assert.strictEqual(currentURL(), '/settings/tokens');

    await click('[data-test-new-token-button]', { altKey: true });
    assert.strictEqual(currentURL(), '/settings/tokens/new');
  });

  test('access is blocked if unauthenticated', async function (assert) {
    await visit('/settings/tokens/new');
    assert.strictEqual(currentURL(), '/settings/tokens/new');
    assert.dom('[data-test-title]').hasText('This page requires authentication');
    assert.dom('[data-test-login]').exists();
  });

  test('happy path', async function (assert) {
    prepare(this);

    await visit('/settings/tokens/new');
    assert.strictEqual(currentURL(), '/settings/tokens/new');

    await fillIn('[data-test-name]', 'token-name');
    await click('[data-test-scope="publish-update"]');
    await click('[data-test-generate]');

    let token = this.server.schema.apiTokens.findBy({ name: 'token-name' });
    assert.ok(Boolean(token), 'API token has been created in the backend database');
    assert.strictEqual(token.name, 'token-name');
    assert.strictEqual(token.crateScopes, null);
    assert.deepEqual(token.endpointScopes, ['publish-update']);

    assert.strictEqual(currentURL(), '/settings/tokens');
    assert.dom('[data-test-api-token="1"] [data-test-name]').hasText('token-name');
    assert.dom('[data-test-api-token="1"] [data-test-token]').hasText(token.token);
    assert.dom('[data-test-api-token="1"] [data-test-endpoint-scopes]').hasText('Scopes: publish-update');
    assert.dom('[data-test-api-token="1"] [data-test-crate-scopes]').doesNotExist();
  });

  test('crate scopes', async function (assert) {
    prepare(this);

    await visit('/settings/tokens/new');
    assert.strictEqual(currentURL(), '/settings/tokens/new');

    await fillIn('[data-test-name]', 'token-name');
    await click('[data-test-scope="publish-update"]');
    await click('[data-test-scope="yank"]');

    assert.dom('[data-test-crates-unrestricted]').exists();
    assert.dom('[data-test-crate-pattern]').doesNotExist();

    await click('[data-test-add-crate-pattern]');
    assert.dom('[data-test-crates-unrestricted]').doesNotExist();
    assert.dom('[data-test-crate-pattern]').exists({ count: 1 });
    assert.dom('[data-test-crate-pattern="0"] [data-test-description]').hasText('Please enter a crate name pattern');

    await fillIn('[data-test-crate-pattern="0"] input', 'serde');
    assert.dom('[data-test-crate-pattern="0"] [data-test-description]').hasText('Matches only the serde crate');

    await click('[data-test-crate-pattern="0"] [data-test-remove]');
    assert.dom('[data-test-crates-unrestricted]').exists();
    assert.dom('[data-test-crate-pattern]').doesNotExist();

    await click('[data-test-add-crate-pattern]');
    assert.dom('[data-test-crates-unrestricted]').doesNotExist();
    assert.dom('[data-test-crate-pattern]').exists({ count: 1 });
    assert.dom('[data-test-crate-pattern="0"] [data-test-description]').hasText('Please enter a crate name pattern');

    await fillIn('[data-test-crate-pattern="0"] input', 'serde-*');
    assert
      .dom('[data-test-crate-pattern="0"] [data-test-description]')
      .hasText('Matches all crates starting with serde-');

    await click('[data-test-add-crate-pattern]');
    assert.dom('[data-test-crates-unrestricted]').doesNotExist();
    assert.dom('[data-test-crate-pattern]').exists({ count: 2 });
    assert.dom('[data-test-crate-pattern="1"] [data-test-description]').hasText('Please enter a crate name pattern');

    await fillIn('[data-test-crate-pattern="1"] input', 'inv@lid');
    assert.dom('[data-test-crate-pattern="1"] [data-test-description]').hasText('Invalid crate name pattern');

    await click('[data-test-add-crate-pattern]');
    assert.dom('[data-test-crates-unrestricted]').doesNotExist();
    assert.dom('[data-test-crate-pattern]').exists({ count: 3 });
    assert.dom('[data-test-crate-pattern="2"] [data-test-description]').hasText('Please enter a crate name pattern');

    await fillIn('[data-test-crate-pattern="2"] input', 'serde');
    assert.dom('[data-test-crate-pattern="2"] [data-test-description]').hasText('Matches only the serde crate');

    await click('[data-test-crate-pattern="1"] [data-test-remove]');
    assert.dom('[data-test-crates-unrestricted]').doesNotExist();
    assert.dom('[data-test-crate-pattern]').exists({ count: 2 });

    await click('[data-test-generate]');

    let token = this.server.schema.apiTokens.findBy({ name: 'token-name' });
    assert.ok(Boolean(token), 'API token has been created in the backend database');
    assert.strictEqual(token.name, 'token-name');
    assert.deepEqual(token.crateScopes, ['serde-*', 'serde']);
    assert.deepEqual(token.endpointScopes, ['publish-update', 'yank']);

    assert.strictEqual(currentURL(), '/settings/tokens');
    assert.dom('[data-test-api-token="1"] [data-test-name]').hasText('token-name');
    assert.dom('[data-test-api-token="1"] [data-test-token]').hasText(token.token);
    assert.dom('[data-test-api-token="1"] [data-test-endpoint-scopes]').hasText('Scopes: publish-update and yank');
    assert.dom('[data-test-api-token="1"] [data-test-crate-scopes]').hasText('Crates: serde-* and serde');
  });

  test('loading and error state', async function (assert) {
    prepare(this);

    let deferred = defer();
    this.server.put('/api/v1/me/tokens', deferred.promise);

    await visit('/settings/tokens/new');
    assert.strictEqual(currentURL(), '/settings/tokens/new');

    await fillIn('[data-test-name]', 'token-name');
    await click('[data-test-scope="publish-update"]');
    let clickPromise = click('[data-test-generate]');
    await waitFor('[data-test-generate] [data-test-spinner]');
    assert.dom('[data-test-name]').isDisabled();
    assert.dom('[data-test-generate]').isDisabled();

    deferred.resolve(new Response(500));
    await clickPromise;

    let message = 'An error has occurred while generating your API token. Please try again later!';
    assert.dom('[data-test-notification-message="error"]').hasText(message);
    assert.dom('[data-test-name]').isEnabled();
    assert.dom('[data-test-generate]').isEnabled();
  });

  test('cancel button navigates back to the token list', async function (assert) {
    prepare(this);

    await visit('/settings/tokens/new');
    assert.strictEqual(currentURL(), '/settings/tokens/new');

    await click('[data-test-cancel]');
    assert.strictEqual(currentURL(), '/settings/tokens');
  });

  test('empty name shows an error', async function (assert) {
    prepare(this);

    await visit('/settings/tokens/new');
    assert.strictEqual(currentURL(), '/settings/tokens/new');

    await click('[data-test-scope="publish-update"]');
    await click('[data-test-generate]');
    assert.strictEqual(currentURL(), '/settings/tokens/new');
    assert.dom('[data-test-name]').hasAria('invalid', 'true');
    assert.dom('[data-test-name-group] [data-test-error]').exists();
    assert.dom('[data-test-scopes-group] [data-test-error]').doesNotExist();
  });

  test('no scopes selected shows an error', async function (assert) {
    prepare(this);

    await visit('/settings/tokens/new');
    assert.strictEqual(currentURL(), '/settings/tokens/new');

    await fillIn('[data-test-name]', 'token-name');
    await click('[data-test-generate]');
    assert.strictEqual(currentURL(), '/settings/tokens/new');
    assert.dom('[data-test-name-group] [data-test-error]').doesNotExist();
    assert.dom('[data-test-scopes-group] [data-test-error]').exists();
  });
});
