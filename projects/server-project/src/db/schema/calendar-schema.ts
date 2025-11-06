import { relations, sql } from 'drizzle-orm';
import { date, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { users } from './auth-schema';
import { cases } from './case-schema';

export const calendarEventTypeEnum = pgEnum('calendar_event_type', ['custom', 'hearing']);

export const calendarEvents = pgTable(
  'calendar_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: calendarEventTypeEnum('type').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    tagColor: text('tag_color').notNull(),
    eventDate: date('event_date').notNull(),
    eventTime: text('event_time'),
    relatedCaseId: uuid('related_case_id').references(() => cases.id, { onDelete: 'cascade' }),
    sourceId: uuid('source_id'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull()
  },
  (table) => ({
    sourcePerUserUnique: uniqueIndex('calendar_event_source_user_ui').on(table.sourceId, table.userId)
  })
);

export const calendarEventRelations = relations(calendarEvents, ({ one }) => ({
  user: one(users, {
    fields: [calendarEvents.userId],
    references: [users.id]
  }),
  case: one(cases, {
    fields: [calendarEvents.relatedCaseId],
    references: [cases.id]
  })
}));

export type CalendarEventType = (typeof calendarEventTypeEnum.enumValues)[number];
export type CalendarEventRecord = typeof calendarEvents.$inferSelect;
export type CalendarEventInsert = typeof calendarEvents.$inferInsert;
