import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

import { departmentEnum, users } from './auth-schema';

export interface CaseChangeDetail {
  field: string;
  label: string;
  previousValue: string | null;
  currentValue: string | null;
}

export const caseTypeEnum = pgEnum('case_type', ['work_injury', 'personal_injury', 'other']);
export const caseLevelEnum = pgEnum('case_level', ['A', 'B', 'C']);
export const participantRoleEnum = pgEnum('case_participant_role', ['claimant', 'respondent']);
export const participantEntityEnum = pgEnum('case_participant_entity', ['personal', 'organization']);
export const caseStatusEnum = pgEnum('case_status', ['未结案', '已结案', '废单']);
export const timelineNodeEnum = pgEnum('case_timeline_node', [
  'apply_labor_confirmation',
  'receive_labor_confirmation_award',
  'apply_work_injury_certification',
  'receive_work_injury_decision',
  'apply_work_ability_appraisal',
  'receive_work_ability_conclusion',
  'apply_work_injury_benefit_award',
  'lawsuit_filed',
  'filing_approved',
  'judgment_time',
  'custom'
]);
export const trialStageEnum = pgEnum('case_trial_stage', ['一审', '二审', '再审']);

export const cases = pgTable('case_record', {
  id: uuid('id').primaryKey().defaultRandom(),
  referenceNo: text('reference_no'),
  caseType: caseTypeEnum('case_type').notNull(),
  caseLevel: caseLevelEnum('case_level').notNull(),
  provinceCity: text('province_city'),
  targetAmount: text('target_amount'),
  feeStandard: text('fee_standard'),
  agencyFeeEstimate: text('agency_fee_estimate'),
  dataSource: text('data_source'),
  hasContract: boolean('has_contract'),
  hasSocialSecurity: boolean('has_social_security'),
  entryDate: date('entry_date'),
  injuryLocation: text('injury_location'),
  injurySeverity: text('injury_severity'),
  injuryCause: text('injury_cause'),
  workInjuryCertified: boolean('work_injury_certified'),
  monthlySalary: text('monthly_salary'),
  appraisalLevel: text('appraisal_level'),
  appraisalEstimate: text('appraisal_estimate'),
  existingEvidence: text('existing_evidence'),
  customerCooperative: boolean('customer_cooperative'),
  witnessCooperative: boolean('witness_cooperative'),
  remark: text('remark'),
  department: departmentEnum('department'),
  ownerId: text('owner_id').references(() => users.id),
  assignedLawyerId: text('assigned_lawyer_id').references(() => users.id),
  assignedAssistantId: text('assigned_assistant_id').references(() => users.id),
  assignedTrialLawyerId: text('assigned_trial_lawyer_id').references(() => users.id),
  caseStatus: caseStatusEnum('case_status').default('未结案'),
  closedReason: text('closed_reason'),
  voidReason: text('void_reason'),
  lawyerProgress: jsonb('lawyer_progress'),
  creatorId: text('creator_id').references(() => users.id),
  updaterId: text('updater_id').references(() => users.id),
  salesCommission: text('sales_commission'),
  handlingFee: text('handling_fee'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const caseHearings = pgTable('case_hearing', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' })
    .unique(),
  hearingTime: timestamp('hearing_time'),
  hearingLocation: text('hearing_location'),
  tribunal: text('tribunal'),
  judge: text('judge'),
  caseNumber: text('case_number'),
  contactPhone: text('contact_phone'),
  trialStage: trialStageEnum('trial_stage'),
  hearingResult: text('hearing_result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const caseParticipants = pgTable('case_participant', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  role: participantRoleEnum('role').notNull(),
  entityType: participantEntityEnum('entity_type'),
  name: text('name').notNull(),
  idNumber: text('id_number'),
  phone: text('phone'),
  address: text('address'),
  isDishonest: boolean('is_dishonest').default(false),
  sortOrder: integer('sort_order').default(0)
});

export const caseCollections = pgTable('case_collection', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  receivedAt: date('received_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const caseTimeline = pgTable('case_timeline', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  nodeType: timelineNodeEnum('node_type').notNull(),
  occurredOn: date('occurred_on').notNull(),
  followerId: text('follower_id').references(() => users.id),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const caseChangeLogs = pgTable('case_change_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').references(() => users.id),
  actorName: text('actor_name'),
  actorRole: text('actor_role'),
  action: text('action').notNull(),
  description: text('description'),
  changes: jsonb('changes')
    .$type<CaseChangeDetail[] | null>()
    .default(sql`'[]'::jsonb`),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const casesRelations = relations(cases, ({ many, one }) => ({
  owner: one(users, {
    fields: [cases.ownerId],
    references: [users.id]
  }),
  creator: one(users, {
    fields: [cases.creatorId],
    references: [users.id]
  }),
  updater: one(users, {
    fields: [cases.updaterId],
    references: [users.id]
  }),
  assignedLawyer: one(users, {
    fields: [cases.assignedLawyerId],
    references: [users.id]
  }),
  assignedAssistant: one(users, {
    fields: [cases.assignedAssistantId],
    references: [users.id]
  }),
  assignedTrialLawyer: one(users, {
    fields: [cases.assignedTrialLawyerId],
    references: [users.id]
  }),
  hearing: one(caseHearings, {
    fields: [cases.id],
    references: [caseHearings.caseId]
  }),
  participants: many(caseParticipants),
  collections: many(caseCollections),
  timeline: many(caseTimeline),
  changeLogs: many(caseChangeLogs)
}));

export const caseParticipantRelations = relations(caseParticipants, ({ one }) => ({
  case: one(cases, {
    fields: [caseParticipants.caseId],
    references: [cases.id]
  })
}));

export const caseCollectionRelations = relations(caseCollections, ({ one }) => ({
  case: one(cases, {
    fields: [caseCollections.caseId],
    references: [cases.id]
  })
}));

export const caseTimelineRelations = relations(caseTimeline, ({ one }) => ({
  case: one(cases, {
    fields: [caseTimeline.caseId],
    references: [cases.id]
  }),
  follower: one(users, {
    fields: [caseTimeline.followerId],
    references: [users.id]
  })
}));

export const caseHearingRelations = relations(caseHearings, ({ one }) => ({
  case: one(cases, {
    fields: [caseHearings.caseId],
    references: [cases.id]
  })
}));

export const caseChangeLogRelations = relations(caseChangeLogs, ({ one }) => ({
  case: one(cases, {
    fields: [caseChangeLogs.caseId],
    references: [cases.id]
  }),
  actor: one(users, {
    fields: [caseChangeLogs.actorId],
    references: [users.id]
  })
}));
