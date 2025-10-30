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
export const trialStageEnum = pgEnum('case_trial_stage', ['一审', '二审', '再审']);

export const cases = pgTable('case_record', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseType: caseTypeEnum('case_type').notNull(), // 案件类型
  caseLevel: caseLevelEnum('case_level').notNull(), // 案件级别
  provinceCity: text('province_city'), // 省份/城市
  targetAmount: text('target_amount'), // 标的额
  feeStandard: text('fee_standard'), // 收费标准
  agencyFeeEstimate: text('agency_fee_estimate'), // 预估代理费
  dataSource: text('data_source'), // 数据来源
  hasContract: boolean('has_contract'), // 是否有合同
  hasSocialSecurity: boolean('has_social_security'), // 是否有社保
  entryDate: date('entry_date'), // 入职时间
  injuryLocation: text('injury_location'), // 受伤地点
  injurySeverity: text('injury_severity'), // 受伤程度
  injuryCause: text('injury_cause'), // 受伤原因
  workInjuryCertified: boolean('work_injury_certified'), // 是否工伤认定
  monthlySalary: text('monthly_salary'), // 月薪
  appraisalLevel: text('appraisal_level'), // 劳动力能力鉴定等级
  appraisalEstimate: text('appraisal_estimate'), // 劳动能力等级鉴定预估
  existingEvidence: text('existing_evidence'), // 已知证据
  customerCooperative: boolean('customer_cooperative'), // 是否配合提交材料
  witnessCooperative: boolean('witness_cooperative'), // 证人是否配合出庭
  remark: text('remark'), // 备注
  department: departmentEnum('department'), // 部门
  assignedSaleId: text('assigned_sale_id').references(() => users.id), // 跟进销售
  assignedLawyerId: text('assigned_lawyer_id').references(() => users.id), // 跟进律师
  assignedAssistantId: text('assigned_assistant_id').references(() => users.id), // 跟进助理
  caseStatus: caseStatusEnum('case_status').default('未结案'), // 案件状态
  closedReason: text('closed_reason'), // 结案原因
  voidReason: text('void_reason'), // 废单原因
  creatorId: text('creator_id').references(() => users.id), // 创建人
  updaterId: text('updater_id').references(() => users.id), // 更新人
  salesCommission: text('sales_commission'), // 销售提成
  handlingFee: text('handling_fee'), // 办案费用
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export const caseHearings = pgTable('case_hearing', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  trialLawyerId: text('trial_lawyer_id').references(() => users.id),
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
  occurredOn: date('occurred_on').notNull(),
  followerId: text('follower_id').references(() => users.id),
  note: text('note').notNull(),
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
  creator: one(users, {
    fields: [cases.creatorId],
    references: [users.id]
  }),
  updater: one(users, {
    fields: [cases.updaterId],
    references: [users.id]
  }),
  assignedSale: one(users, {
    fields: [cases.assignedSaleId],
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
  hearings: many(caseHearings),
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
  }),
  trialLawyer: one(users, {
    fields: [caseHearings.trialLawyerId],
    references: [users.id]
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
