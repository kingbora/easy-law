import { createAccessControl } from 'better-auth/plugins/access';
import type { AccessControl } from 'better-auth/plugins/access';
import { defaultStatements, adminAc, userAc } from 'better-auth/plugins/admin/access';

const customStatements = {
  team: ['list', 'add-member', 'remove-member', 'update'] as const,
  case: ['list', 'create', 'update', 'delete'] as const,
  client: ['list', 'create', 'update', 'delete'] as const
};

export const statements = {
  ...defaultStatements,
  ...customStatements
} satisfies typeof defaultStatements & typeof customStatements;

const internalAccessControl = createAccessControl(statements);
export const ac: AccessControl = internalAccessControl;

export const super_admin = internalAccessControl.newRole({
  ...adminAc.statements,
  team: ['list', 'add-member', 'remove-member', 'update'],
  case: ['list', 'create', 'update', 'delete'],
  client: ['list', 'create', 'update', 'delete'],
});

export const admin = internalAccessControl.newRole({
  ...userAc.statements,
  user: ['list', 'create', 'update'],
  team: ['list', 'add-member', 'remove-member', 'update'],
});

export const administration = internalAccessControl.newRole({
  ...userAc.statements,
});

export const lawyer = internalAccessControl.newRole({
  ...userAc.statements,
  case: ['list', 'create', 'update', 'delete'],
  client: ['list', 'create', 'update', 'delete'],
});

export const assistant = internalAccessControl.newRole({
  ...userAc.statements,
  case: ['list', 'create', 'update'],
  client: ['list', 'create', 'update'],
});

export const sale = internalAccessControl.newRole({
  ...userAc.statements,
  case: ['list', 'create', 'update'],
  client: ['list', 'create', 'update'],
});

export const allRoles = {
  super_admin,
  admin,
  administration,
  lawyer,
  assistant,
  sale,
};
