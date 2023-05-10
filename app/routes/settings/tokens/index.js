import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';

import { TrackedArray } from 'tracked-built-ins';

export default class TokenListRoute extends Route {
  @service store;

  async model() {
    let apiTokens = await this.store.findAll('api-token', { reload: true });
    return TrackedArray.from(apiTokens.slice());
  }

  /**
   * Ensure that all plaintext tokens are deleted from memory after leaving
   * the API tokens settings page.
   */
  resetController(controller) {
    for (let token of controller.model) {
      if (token.token) {
        token.token = undefined;
      }
    }
  }
}
