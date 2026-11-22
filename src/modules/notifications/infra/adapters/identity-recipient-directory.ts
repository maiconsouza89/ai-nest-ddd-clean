import { UserDirectoryFacade } from '#modules/identity/contracts/user-directory.facade';
import { RecipientDirectory } from '../../application/ports/recipient-directory.js';

// Traduz o contrato do identity para o port do notifications.
export class IdentityRecipientDirectory implements RecipientDirectory {
  constructor(private readonly users: UserDirectoryFacade) {}

  emailOf(customerId: string) {
    return this.users.emailOf(customerId);
  }
}
