import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['master', 'admin', 'sale', 'lawyer', 'assistant']);

export const permissionCategoryEnum = pgEnum('permission_category', ['menu', 'action']);

export const clientTypeEnum = pgEnum('client_type', ['individual', 'company']);
export const clientStatusEnum = pgEnum('client_status', ['potential', 'active', 'dormant', 'lost']);
export const clientSourceEnum = pgEnum('client_source', ['referral', 'website', 'offline_event', 'other']);
export const clientGenderEnum = pgEnum('client_gender', ['male', 'female']);

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    name: text('name'),
    image: text('image'),
    role: userRoleEnum('role').default('assistant').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    password: text('password')
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)]
);

export const permissions = pgTable(
  'permissions',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    category: permissionCategoryEnum('category').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
  }
);

export const rolePermissions = pgTable(
  'role_permissions',
  {
    role: userRoleEnum('role').notNull(),
    permissionCode: text('permission_code')
      .notNull()
      .references(() => permissions.code, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
  },
  (table) => [primaryKey({ name: 'role_permissions_pk', columns: [table.role, table.permissionCode] })]
);

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    type: clientTypeEnum('type').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    address: text('address'),
    source: clientSourceEnum('source'),
    sourceRemark: text('source_remark'),
    status: clientStatusEnum('status').notNull().default('active'),
    responsibleLawyerId: text('responsible_lawyer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
  tags: text('tags').array(),
    remark: text('remark'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
  },
  (table) => [
    index('clients_name_idx').on(sql`to_tsvector('simple', ${table.name})`),
    index('clients_type_idx').on(table.type),
    index('clients_source_idx').on(table.source),
    index('clients_responsible_idx').on(table.responsibleLawyerId)
  ]
);

export const clientIndividuals = pgTable(
  'client_individual_profiles',
  {
    clientId: uuid('client_id')
      .primaryKey()
      .references(() => clients.id, { onDelete: 'cascade' }),
    idCardNumber: text('id_card_no').notNull(),
    gender: clientGenderEnum('gender'),
    occupation: text('occupation')
  },
  (table) => [uniqueIndex('client_individual_id_card_idx').on(table.idCardNumber)]
);

export const clientCompanies = pgTable(
  'client_company_profiles',
  {
    clientId: uuid('client_id')
      .primaryKey()
      .references(() => clients.id, { onDelete: 'cascade' }),
    unifiedCreditCode: text('unified_credit_code').notNull(),
    companyType: text('company_type'),
    industry: text('industry'),
    registeredCapital: numeric('registered_capital', { precision: 16, scale: 2 }),
    legalRepresentative: text('legal_representative')
  },
  (table) => [uniqueIndex('client_company_credit_code_idx').on(table.unifiedCreditCode)]
);

export const clientAttachments = pgTable(
  'client_attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    fileType: text('file_type'),
    fileUrl: text('file_url').notNull(),
    description: text('description'),
    uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow()
  },
  (table) => [index('client_attachments_client_idx').on(table.clientId)]
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent')
  },
  (table) => [uniqueIndex('sessions_token_idx').on(table.token)]
);

export const accounts = pgTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    accountId: text('account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    scope: text('scope'),
    password: text('password'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
  },
  (table) => [
    uniqueIndex('accounts_provider_account_idx').on(table.providerId, table.accountId)
  ]
);

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  type: text('type'),
  attempts: integer('attempts').default(0)
});

export type UserRole = typeof userRoleEnum.enumValues[number];
export type PermissionCategory = typeof permissionCategoryEnum.enumValues[number];
export type ClientType = typeof clientTypeEnum.enumValues[number];
export type ClientStatus = typeof clientStatusEnum.enumValues[number];
export type ClientSource = typeof clientSourceEnum.enumValues[number];
export type ClientGender = typeof clientGenderEnum.enumValues[number];
