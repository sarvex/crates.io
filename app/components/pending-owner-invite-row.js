import { inject as service } from '@ember/service';
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

import { task } from 'ember-concurrency';

export default class PendingOwnerInviteRow extends Component {
  @service notifications;

  @tracked isAccepted = false;
  @tracked isDeclined = false;

  acceptInvitationTask = task(async () => {
    this.args.invite.set('accepted', true);

    try {
      await this.args.invite.save();
      this.isAccepted = true;
    } catch (error) {
      if (error.errors?.[0]?.detail && error.errors[0].detail !== '[object Object]') {
        this.notifications.error(`Error in accepting invite: ${error.errors[0].detail}`);
      } else {
        this.notifications.error('Error in accepting invite');
      }
    }
  });

  declineInvitationTask = task(async () => {
    this.args.invite.set('accepted', false);

    try {
      await this.args.invite.save();
      this.isDeclined = true;
    } catch (error) {
      if (error.errors?.[0]?.detail && error.errors[0].detail !== '[object Object]') {
        this.notifications.error(`Error in declining invite: ${error.errors[0].detail}`);
      } else {
        this.notifications.error('Error in declining invite');
      }
    }
  });
}
