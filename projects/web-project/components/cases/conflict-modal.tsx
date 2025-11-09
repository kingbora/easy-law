import { useMemo, type ReactNode } from 'react';

import { Alert, Button, Descriptions, Modal, Space, Table, Tag, Typography } from 'antd';

import type {
  CaseUpdateConflictDetails,
  CaseUpdateConflictField,
  CaseUpdateConflictType
} from '@/lib/cases-api';

interface ConflictRow {
  key: string;
  label: string;
  base: string;
  remote: string;
  client: string;
  conflict: boolean;
}

const formatValue = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '—';
};

const buildRows = (details: CaseUpdateConflictDetails | null): ConflictRow[] => {
  if (!details) {
    return [];
  }

  const { remoteChanges, clientChanges, conflictingFields } = details;
  const fieldMap = new Map<string, ConflictRow>();

  const upsert = (field: CaseUpdateConflictField, type: 'remote' | 'client') => {
    const key = field.field;
    const existing = fieldMap.get(key) ?? {
      key,
      label: field.label,
      base: formatValue(field.baseValue),
      remote: '—',
      client: '—',
      conflict: conflictingFields.includes(key)
    };

    if (type === 'remote') {
      existing.remote = formatValue(field.remoteValue ?? field.baseValue);
    } else {
      existing.client = formatValue(field.clientValue ?? field.baseValue);
    }

    fieldMap.set(key, existing);
  };

  remoteChanges.forEach(change => upsert(change, 'remote'));
  clientChanges.forEach(change => upsert(change, 'client'));

  return Array.from(fieldMap.values());
};

const TYPE_LABEL_MAP: Record<CaseUpdateConflictType, string> = {
  hard: '需要刷新最新数据',
  mergeable: '可尝试合并'
};

export interface CaseConflictModalProps {
  open: boolean;
  details: CaseUpdateConflictDetails | null;
  onCancel: () => void;
  onRefresh: () => Promise<void> | void;
  onMerge?: () => Promise<void> | void;
  refreshing?: boolean;
  merging?: boolean;
}

export default function CaseConflictModal({
  open,
  details,
  onCancel,
  onRefresh,
  onMerge,
  refreshing,
  merging
}: CaseConflictModalProps) {
  const rows = useMemo(() => buildRows(details), [details]);
  const canMerge = details?.type === 'mergeable' && typeof onMerge === 'function';

  const footer: ReactNode[] = [
    <Button key="cancel" onClick={onCancel} disabled={refreshing || merging}>
      取消
    </Button>,
    <Button
      key="refresh"
      onClick={() => {
        void onRefresh();
      }}
      loading={refreshing}
      disabled={merging}
      type={canMerge ? 'default' : 'primary'}
    >
      刷新最新数据
    </Button>
  ];

  if (canMerge) {
    footer.push(
      <Button
        key="merge"
        type="primary"
        onClick={() => {
          void onMerge?.();
        }}
        loading={merging}
        disabled={refreshing}
      >
        合并后继续保存
      </Button>
    );
  }

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title="检测到其他人更新了案件"
      width={720}
      footer={footer}
      destroyOnClose
      maskClosable={false}
      closable={!refreshing && !merging}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Alert
          type="warning"
          message={details?.message ?? '检测到案件已被其他人更新'}
          showIcon
        />

        {details ? (
          <Descriptions
            size="small"
            column={1}
            items={[
              {
                key: 'type',
                label: '冲突处理建议',
                children: (
                  <Space>
                    <span>{TYPE_LABEL_MAP[details.type]}</span>
                    <Tag color={details.type === 'mergeable' ? 'blue' : 'red'}>{details.type}</Tag>
                  </Space>
                )
              },
              {
                key: 'updatedAt',
                label: '最后更新时间',
                children: details.updatedAt
              },
              {
                key: 'updatedBy',
                label: '最后更新人',
                children: details.updatedByName ?? '—'
              }
            ]}
          />
        ) : null}

        <Table<ConflictRow>
          dataSource={rows}
          pagination={false}
          size="small"
          columns={[
            {
              title: '字段',
              dataIndex: 'label',
              key: 'label',
              render: (value: string, record) => (
                <Space>
                  <span>{value}</span>
                  {record.conflict ? <Tag color="red">冲突</Tag> : null}
                </Space>
              )
            },
            {
              title: '原始值',
              dataIndex: 'base',
              key: 'base',
              render: (value: string) => <Typography.Text type="secondary">{value}</Typography.Text>
            },
            {
              title: '最新值',
              dataIndex: 'remote',
              key: 'remote',
              render: (value: string, record) => (
                <Typography.Text type={record.conflict ? 'danger' : undefined}>{value}</Typography.Text>
              )
            },
            {
              title: '我的修改',
              dataIndex: 'client',
              key: 'client',
              render: (value: string, record) => (
                <Typography.Text type={record.conflict ? 'danger' : undefined}>{value}</Typography.Text>
              )
            }
          ]}
        />
      </Space>
    </Modal>
  );
}
