import { UserDirectoryFacade } from '../../../identity/contracts/user-directory.facade';
import { RecipientDirectory } from '../../application/ports/recipient-directory';

// Traduz o contrato do identity para o port do notifications.
export class IdentityRecipientDirectory implements RecipientDirectory {
  constructor(private readonly users: UserDirectoryFacade) {}

  emailOf(customerId: string) {
    return this.users.emailOf(customerId);
  }
}
