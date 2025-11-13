import type { TrialStage } from '@easy-law/shared-types';
import { apiFetch } from './api-client';

export type CalendarEventType = 'custom' | 'hearing';

export interface CalendarEventMetadata {
  caseNumber?: string | null;
  trialStage?: TrialStage | null;
  hearingId?: string | null;
  hearingTime?: string | null;
}

export interface CalendarEventRecord {
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

export interface CreateCustomCalendarEventPayload {
  title: string;
  date: string;
  time?: string | null;
  tagColor?: string | null;
  description?: string | null;
}

interface CalendarEventListResponse {
  data: CalendarEventRecord[];
}

interface CalendarEventMutationResponse {
  data: CalendarEventRecord;
}

export async function fetchCalendarEvents(): Promise<CalendarEventRecord[]> {
  const response = await apiFetch<CalendarEventListResponse>('/api/calendar-events');
  return response.data;
}

export async function createCalendarEvent(payload: CreateCustomCalendarEventPayload): Promise<CalendarEventRecord> {
  const response = await apiFetch<CalendarEventMutationResponse>('/api/calendar-events', {
    method: 'POST',
    body: payload
  });
  return response.data;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiFetch<void>(`/api/calendar-events/${id}`, {
    method: 'DELETE'
  });
}
