import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, adminAc, userAc } from 'better-auth/plugins/admin/access';

export const statement = {
  ...defaultStatements,
  team: ['list', 'add-member', 'remove-member', 'update'],
  case: ['list', 'create', 'update', 'delete'],
  client: ['list', 'create', 'update', 'delete'],
} as const;

export const ac = createAccessControl(statement);

export const super_admin = ac.newRole({
  ...adminAc.statements,
  team: ['list', 'add-member', 'remove-member', 'update'],
  case: ['list', 'create', 'update', 'delete'],
  client: ['list', 'create', 'update', 'delete'],
});

export const admin = ac.newRole({
  ...userAc.statements,
  user: ['list', 'create', 'update'],
  team: ['list', 'add-member', 'remove-member', 'update'],
});

export const administration = ac.newRole({
  ...userAc.statements,
});

export const lawyer = ac.newRole({
  ...userAc.statements,
  case: ['list', 'create', 'update', 'delete'],
  client: ['list', 'create', 'update', 'delete'],
});

export const assistant = ac.newRole({
  ...userAc.statements,
  case: ['list', 'create', 'update'],
  client: ['list', 'create', 'update'],
});

export const sale = ac.newRole({
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
