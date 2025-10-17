import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
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
export const userGenderEnum = pgEnum('user_gender', ['male', 'female']);
export const caseStatusEnum = pgEnum('case_status', ['consultation', 'entrusted', 'in_progress', 'closed', 'terminated']);
export const caseBillingMethodEnum = pgEnum('case_billing_method', ['fixed_fee', 'hourly', 'contingency', 'hybrid']);

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    name: text('name'),
    image: text('image'),
    gender: userGenderEnum('gender'),
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
    maintainerId: text('maintainer_id')
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
    index('clients_maintainer_idx').on(table.maintainerId)
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

export const caseTypes = pgTable(
  'case_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    isSystem: boolean('is_system').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
  },
  (table) => [uniqueIndex('case_types_name_idx').on(table.name)]
);

export const caseCategories = pgTable(
  'case_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseTypeId: uuid('case_type_id')
      .notNull()
      .references(() => caseTypes.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortIndex: integer('sort_index').default(0).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
  },
  (table) => [
    index('case_categories_case_type_idx').on(table.caseTypeId),
    uniqueIndex('case_categories_case_type_name_idx').on(table.caseTypeId, table.name)
  ]
);

export const cases = pgTable(
  'cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    caseTypeId: uuid('case_type_id')
      .notNull()
      .references(() => caseTypes.id, { onDelete: 'restrict' }),
    caseCategoryId: uuid('case_category_id')
      .notNull()
      .references(() => caseCategories.id, { onDelete: 'restrict' }),
    status: caseStatusEnum('status').default('consultation').notNull(),
    description: text('description'),
    court: text('court'),
    filingDate: date('filing_date'),
    hearingDate: date('hearing_date'),
    evidenceDeadline: date('evidence_deadline'),
    appealDeadline: date('appeal_deadline'),
  disputedAmount: numeric('disputed_amount', { precision: 16, scale: 2 }),
    billingMethod: caseBillingMethodEnum('billing_method').notNull(),
    lawyerFeeTotal: numeric('lawyer_fee_total', { precision: 16, scale: 2 }),
    estimatedHours: integer('estimated_hours'),
    contingencyRate: numeric('contingency_rate', { precision: 6, scale: 2 }),
    otherFeeBudget: numeric('other_fee_budget', { precision: 16, scale: 2 }),
    paymentPlan: text('payment_plan'),
    opponentName: text('opponent_name').notNull(),
    opponentType: clientTypeEnum('opponent_type').notNull(),
    opponentIdNumber: text('opponent_id_number'),
    opponentLawyer: text('opponent_lawyer'),
    thirdParty: text('third_party'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow()
  },
  (table) => [
    index('cases_client_idx').on(table.clientId),
    index('cases_type_idx').on(table.caseTypeId),
    index('cases_category_idx').on(table.caseCategoryId),
    index('cases_status_idx').on(table.status),
    index('cases_created_idx').on(table.createdAt)
  ]
);

export const caseMaterialFiles = pgTable(
  'case_material_files',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    filename: text('filename').notNull(),
    fileType: text('file_type'),
    fileSize: integer('file_size'),
    fileData: text('file_data').notNull(),
    uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow()
  },
  (table) => [index('case_material_files_case_idx').on(table.caseId)]
);

export const caseLawyers = pgTable(
  'case_lawyers',
  {
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    lawyerId: text('lawyer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    isPrimary: boolean('is_primary').default(false).notNull(),
    hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow()
  },
  (table) => [
    primaryKey({ name: 'case_lawyers_pk', columns: [table.caseId, table.lawyerId] }),
    index('case_lawyers_case_idx').on(table.caseId),
    index('case_lawyers_lawyer_idx').on(table.lawyerId)
  ]
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
export type UserGender = typeof userGenderEnum.enumValues[number];
export type CaseTypeRow = typeof caseTypes.$inferSelect;
export type CaseCategoryRow = typeof caseCategories.$inferSelect;
export type CaseRow = typeof cases.$inferSelect;
export type CaseLawyerRow = typeof caseLawyers.$inferSelect;
export type CaseStatus = typeof caseStatusEnum.enumValues[number];
export type CaseBillingMethod = typeof caseBillingMethodEnum.enumValues[number];
