import { and, asc, eq, inArray, not } from 'drizzle-orm';

import { db } from '../db/client';
import { users } from '../db/schema/auth-schema';
import {
  calendarEvents,
  type CalendarEventInsert,
  type CalendarEventRecord,
  type CalendarEventType
} from '../db/schema/calendar-schema';
import { cases, caseHearings } from '../db/schema/case-schema';
import type { SessionUser } from '../utils/auth-session';
import { BadRequestError } from '../utils/http-errors';

const DEFAULT_CUSTOM_COLOR = '#52c41a';
const DEFAULT_HEARING_COLOR = '#1677ff';

interface CalendarEventMetadata {
  caseNumber?: string | null;
  trialStage?: string | null;
  hearingId?: string | null;
  hearingTime?: string | null;
}

export interface CalendarEventDTO {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  tagColor: string;
  eventDate: string;
  eventTime: string | null;
  type: CalendarEventType;
  relatedCaseId: string | null;
  metadata: CalendarEventMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomEventInput {
  title: string;
  date: string;
  time?: string | null;
  tagColor?: string | null;
  description?: string | null;
}

function sanitizeTitle(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function sanitizeDescription(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeDateOnly(value: string): string {
  if (typeof value !== 'string') {
    throw new BadRequestError('无效的日期格式');
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new BadRequestError('请选择日程日期');
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new BadRequestError('无效的日期格式，应为YYYY-MM-DD');
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestError('无效的日期格式');
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function sanitizeTime(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const match = /^([0-1]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!match) {
    throw new BadRequestError('无效的时间格式，需为HH:mm');
  }
  const hours = match[1].padStart(2, '0');
  const minutes = match[2].padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDateOnly(value: Date | string | null | undefined): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTime(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function mapCalendarEvent(record: CalendarEventRecord): CalendarEventDTO {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    description: record.description ?? null,
    tagColor: record.tagColor,
    eventDate: formatDateOnly(record.eventDate) || '',
    eventTime: record.eventTime ?? null,
    type: record.type,
    relatedCaseId: record.relatedCaseId ?? null,
  metadata: (record.metadata as CalendarEventMetadata | null) ?? null,
    createdAt: record.createdAt?.toISOString?.() ?? new Date(record.createdAt ?? new Date()).toISOString(),
    updatedAt: record.updatedAt?.toISOString?.() ?? new Date(record.updatedAt ?? new Date()).toISOString()
  } satisfies CalendarEventDTO;
}

async function fetchSupervisorId(userId: string): Promise<string | null> {
  const record = await db.query.users.findFirst({
    columns: {
      supervisorId: true
    },
    where: eq(users.id, userId)
  });
  const supervisorId = record?.supervisorId ?? null;
  return supervisorId && supervisorId.trim().length > 0 ? supervisorId : null;
}

const TEAM_ROLES = new Set(['lawyer', 'assistant', 'sale']);

async function fetchTeamMemberIds(managerId: string): Promise<string[]> {
  const members = await db.query.users.findMany({
    columns: {
      id: true,
      role: true
    },
    where: eq(users.supervisorId, managerId)
  });
  return members.filter((member) => TEAM_ROLES.has(member.role ?? '')).map((member) => member.id);
}

async function resolveVisibleScope(user: SessionUser): Promise<{ userIds: string[]; includeCustom: boolean }> {
  switch (user.role) {
    case 'lawyer':
    case 'assistant':
    case 'sale':
      return { userIds: [user.id], includeCustom: true };
    case 'administration': {
      const supervisorId = user.supervisorId ?? (await fetchSupervisorId(user.id));
      if (!supervisorId) {
        return { userIds: [], includeCustom: false };
      }
      const members = await fetchTeamMemberIds(supervisorId);
      return { userIds: members, includeCustom: false };
    }
    case 'admin': {
      const members = await fetchTeamMemberIds(user.id);
      return { userIds: members, includeCustom: false };
    }
    case 'super_admin': {
      const allMembers = await db.query.users.findMany({
        columns: {
          id: true,
          role: true
        },
        where: inArray(users.role, Array.from(TEAM_ROLES))
      });
      return { userIds: allMembers.map((member) => member.id), includeCustom: false };
    }
    default:
      return { userIds: [], includeCustom: false };
  }
}

export async function listCalendarEvents(user: SessionUser): Promise<CalendarEventDTO[]> {
  const { userIds, includeCustom } = await resolveVisibleScope(user);

  if (userIds.length === 0) {
    return [];
  }

  const whereCondition = includeCustom
    ? inArray(calendarEvents.userId, userIds)
    : and(inArray(calendarEvents.userId, userIds), not(eq(calendarEvents.type, 'custom')));

  const records = await db.query.calendarEvents.findMany({
    where: whereCondition,
    orderBy: () => [asc(calendarEvents.eventDate), asc(calendarEvents.eventTime), asc(calendarEvents.createdAt)]
  });

  return records.map(mapCalendarEvent);
}

export async function createCustomCalendarEvent(input: CreateCustomEventInput, user: SessionUser): Promise<CalendarEventDTO> {
  const title = sanitizeTitle(input.title);
  if (!title) {
    throw new BadRequestError('请填写日程内容');
  }

  if (!input.date || typeof input.date !== 'string') {
    throw new BadRequestError('请选择日程日期');
  }

  const eventDate = normalizeDateOnly(input.date);
  const eventTime = sanitizeTime(input.time ?? null);
  const description = sanitizeDescription(input.description ?? null);
  const tagColor = sanitizeColor(input.tagColor, DEFAULT_CUSTOM_COLOR);

  const [record] = await db
    .insert(calendarEvents)
    .values({
      userId: user.id,
      type: 'custom',
      title,
      description,
      tagColor,
      eventDate,
      eventTime,
      relatedCaseId: null,
      sourceId: null,
    metadata: {} as Record<string, unknown>
    })
    .returning();

  if (!record) {
    throw new Error('创建日程失败');
  }

  return mapCalendarEvent(record);
}

export async function deleteCustomCalendarEvent(id: string, user: SessionUser): Promise<boolean> {
  const [deleted] = await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, user.id), eq(calendarEvents.type, 'custom')))
    .returning({ id: calendarEvents.id });

  return Boolean(deleted?.id);
}

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function buildHearingEventBase(
  hearing: typeof caseHearings.$inferSelect,
  caseId: string
): Omit<CalendarEventInsert, 'id' | 'userId' | 'type'> | null {
  if (!hearing.hearingTime) {
    return null;
  }

  const eventDateStr = formatDateOnly(hearing.hearingTime);
  if (!eventDateStr) {
    return null;
  }

  const eventTime = formatTime(hearing.hearingTime);
  const metadata: CalendarEventMetadata = {
    caseNumber: hearing.caseNumber ?? null,
    trialStage: hearing.trialStage ?? null,
    hearingId: hearing.id,
    hearingTime:
      hearing.hearingTime instanceof Date
        ? hearing.hearingTime.toISOString()
        : hearing.hearingTime
        ? new Date(hearing.hearingTime).toISOString()
        : null
  };

  return {
    title: hearing.caseNumber ?? '未填写案号',
    description: hearing.hearingLocation ?? null,
    tagColor: DEFAULT_HEARING_COLOR,
    eventDate: normalizeDateOnly(eventDateStr),
    eventTime,
    relatedCaseId: caseId,
    sourceId: hearing.id,
    metadata: metadata as Record<string, unknown>
  } satisfies Omit<CalendarEventInsert, 'id' | 'userId' | 'type'>;
}

export async function syncCaseHearingEvents(tx: DbTransaction, caseId: string): Promise<void> {
  if (!caseId) {
    return;
  }

  const caseRecord = await tx.query.cases.findFirst({
    columns: {
      id: true,
      assignedLawyerId: true,
      assignedAssistantId: true,
      assignedSaleId: true
    },
    where: eq(cases.id, caseId)
  });

  if (!caseRecord) {
    return;
  }

  const hearingRecords = await tx.query.caseHearings.findMany({
    where: eq(caseHearings.caseId, caseId)
  });

  await tx
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.relatedCaseId, caseId), eq(calendarEvents.type, 'hearing')));

  if (hearingRecords.length === 0) {
    return;
  }

  const baseAssignmentIds = new Set<string>();
  [caseRecord.assignedLawyerId, caseRecord.assignedAssistantId, caseRecord.assignedSaleId]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .forEach((value) => baseAssignmentIds.add(value));

  const values: CalendarEventInsert[] = [];

  for (const hearing of hearingRecords) {
    const base = buildHearingEventBase(hearing, caseId);
    if (!base) {
      continue;
    }

    const participantIds = new Set(baseAssignmentIds);
    if (typeof hearing.trialLawyerId === 'string' && hearing.trialLawyerId.trim().length > 0) {
      participantIds.add(hearing.trialLawyerId);
    }

    participantIds.forEach((userId) => {
      values.push({
        ...base,
        userId,
        type: 'hearing'
      });
    });
  }

  if (values.length > 0) {
    await tx
      .insert(calendarEvents)
      .values(values)
      .onConflictDoNothing({ target: [calendarEvents.sourceId, calendarEvents.userId] });
  }
}
