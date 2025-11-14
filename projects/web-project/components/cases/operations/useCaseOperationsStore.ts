import dayjs, { type Dayjs } from 'dayjs';
import type { MessageInstance } from 'antd/es/message/interface';

import { createAppStore } from '@/lib/stores/createStore';
import { ApiError } from '@/lib/api-client';
import {
  updateCase,
  type CaseRecord,
  type CaseStatus,
  type CaseTimelineInput
} from '@/lib/cases-api';
import { useSessionStore } from '@/lib/stores/session-store';

export type CaseStatusUpdatePayload = {
  caseStatus: CaseStatus;
  closedReason?: string | null;
  voidReason?: string | null;
};

export type FollowUpPayload = {
  occurredOn: Dayjs;
  note: string | null;
};

type OperationType = 'status' | 'followUp' | null;

export type CaseDetailLaunchOptions = {
  mode?: 'view' | 'update';
  tab?: string;
};

interface CaseOperationsState {
  targetCase: CaseRecord | null;
  activeOperation: OperationType;
  statusDefaults: CaseStatusUpdatePayload | null;
  followUpDefaults: FollowUpPayload | null;
  statusSubmitting: boolean;
  followUpSubmitting: boolean;
  messageApi: MessageInstance | null;
  setMessageApi: (api: MessageInstance | null) => void;
  applyCaseUpdate?: (record: CaseRecord) => void;
  registerCaseUpdater: (updater: (record: CaseRecord) => void) => void;
  caseDetailLauncher: ((caseId: string, options?: CaseDetailLaunchOptions) => Promise<void> | void) | null;
  registerCaseDetailLauncher: (
    launcher: ((caseId: string, options?: CaseDetailLaunchOptions) => Promise<void> | void) | null
  ) => void;
  openCaseDetailExternally: (caseId: string, options?: CaseDetailLaunchOptions) => Promise<void>;
  openStatusModal: (record: CaseRecord) => void;
  openFollowUpModal: (record: CaseRecord) => void;
  closeStatusModal: () => void;
  closeFollowUpModal: () => void;
  submitStatusUpdate: (payload: CaseStatusUpdatePayload) => Promise<void>;
  submitFollowUp: (payload: FollowUpPayload) => Promise<void>;
}

const formatDayValue = (value?: Dayjs | null): string | null =>
  value ? value.format('YYYY-MM-DD') : null;

const mapTimelineRecordsToInputs = (record: CaseRecord): CaseTimelineInput[] =>
  (record.timeline ?? []).map((item) => ({
    id: item.id,
    occurredOn: item.occurredOn,
    note: item.note ?? null,
    followerId: item.followerId ?? null
  }));

const normalizeNote = (value: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const useWorkInjuryCaseOperationsStore = createAppStore<CaseOperationsState>(
  (set, get) => ({
    targetCase: null,
    activeOperation: null,
    statusDefaults: null,
    followUpDefaults: null,
    statusSubmitting: false,
    followUpSubmitting: false,
    messageApi: null,
    setMessageApi(api) {
      set((draft) => {
        draft.messageApi = api;
      });
    },
    applyCaseUpdate: undefined,
    caseDetailLauncher: null,
    registerCaseUpdater(updater) {
      set((draft) => {
        draft.applyCaseUpdate = updater;
      });
    },
    registerCaseDetailLauncher(launcher) {
      set((draft) => {
        draft.caseDetailLauncher = launcher ?? null;
      });
    },
    async openCaseDetailExternally(caseId, options) {
      const launcher = get().caseDetailLauncher;
      if (!launcher) {
        const api = get().messageApi;
        api?.warning('当前无法打开案件详情，请先进入案件列表页面');
        return;
      }
      await Promise.resolve(launcher(caseId, options));
    },
    openStatusModal(record) {
      set((draft) => {
        draft.targetCase = record;
        draft.activeOperation = 'status';
        draft.statusDefaults = {
          caseStatus: record.caseStatus ?? 'open',
          closedReason: record.caseStatus === 'closed' ? record.closedReason ?? null : null,
          voidReason: record.caseStatus === 'void' ? record.voidReason ?? null : null
        };
        draft.statusSubmitting = false;
      });
    },
    openFollowUpModal(record) {
      set((draft) => {
        draft.targetCase = record;
        draft.activeOperation = 'followUp';
        draft.followUpDefaults = {
          occurredOn: dayjs(),
          note: null
        };
        draft.followUpSubmitting = false;
      });
    },
    closeStatusModal() {
      set((draft) => {
        if (draft.activeOperation === 'status') {
          draft.activeOperation = null;
          draft.statusDefaults = null;
          draft.statusSubmitting = false;
          draft.targetCase = null;
        }
      });
    },
    closeFollowUpModal() {
      set((draft) => {
        if (draft.activeOperation === 'followUp') {
          draft.activeOperation = null;
          draft.followUpDefaults = null;
          draft.followUpSubmitting = false;
          draft.targetCase = null;
        }
      });
    },
    async submitStatusUpdate(payload) {
      const state = get();
      const target = state.targetCase;
      if (!target) {
        state.messageApi?.error('未找到案件信息');
        return;
      }
      set((draft) => {
        draft.statusSubmitting = true;
      });
      try {
        const updated = await updateCase(target.id, {
          caseType: target.caseType,
          caseLevel: target.caseLevel,
          caseStatus: payload.caseStatus,
          closedReason:
            payload.caseStatus === 'closed' ? payload.closedReason ?? null : null,
          voidReason: payload.caseStatus === 'void' ? payload.voidReason ?? null : null
        });
        state.applyCaseUpdate?.(updated);
        set((draft) => {
          draft.targetCase = updated;
          draft.statusDefaults = {
            caseStatus: updated.caseStatus ?? 'open',
            closedReason: updated.closedReason ?? null,
            voidReason: updated.voidReason ?? null
          };
          draft.activeOperation = null;
          draft.statusSubmitting = false;
        });
        state.messageApi?.success('案件状态已更新');
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '更新案件状态失败，请稍后重试';
        state.messageApi?.error(errorMessage);
        set((draft) => {
          draft.statusSubmitting = false;
        });
      }
    },
    async submitFollowUp(payload) {
      const state = get();
      const target = state.targetCase;
      if (!target) {
        state.messageApi?.error('未找到案件信息');
        return;
      }
      const occurredOnText = formatDayValue(payload.occurredOn ?? null);
      if (!occurredOnText) {
        state.messageApi?.error('请选择发生日期');
        return;
      }
      set((draft) => {
        draft.followUpSubmitting = true;
      });
      try {
        const timeline = mapTimelineRecordsToInputs(target);
        timeline.push({
          occurredOn: occurredOnText,
          note: normalizeNote(payload.note),
          followerId: useSessionStore.getState().user?.id ?? null
        });
        const updated = await updateCase(target.id, {
          caseType: target.caseType,
          caseLevel: target.caseLevel,
          timeline
        });
        state.applyCaseUpdate?.(updated);
        set((draft) => {
          draft.targetCase = updated;
          draft.followUpDefaults = {
            occurredOn: dayjs(occurredOnText),
            note: null
          };
          draft.activeOperation = null;
          draft.followUpSubmitting = false;
        });
        state.messageApi?.success('跟进备注已添加');
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '保存跟进备注失败，请稍后重试';
        state.messageApi?.error(errorMessage);
        set((draft) => {
          draft.followUpSubmitting = false;
        });
      }
    }
  })
);
