import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
/** Restringe a rota a quem tem pelo menos um dos papéis. Regras por recurso ficam no caso de uso. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
