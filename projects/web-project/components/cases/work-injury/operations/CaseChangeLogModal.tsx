import { Empty, Modal, Space, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type { FC } from 'react';

import type { CaseChangeDetail, CaseChangeLog } from '@/lib/cases-api';
import type { UserRole } from '@/lib/users-api';

interface CaseChangeLogModalProps {
  open: boolean;
  loading: boolean;
  logs: CaseChangeLog[];
  caseTitle?: string;
  onClose: () => void;
}

const ROLE_LABEL_MAP: Record<UserRole, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  administration: '行政',
  lawyer: '律师',
  assistant: '律助',
  sale: '销售'
};

const formatActorLabel = (log: CaseChangeLog): string => {
  const actorName = log.actorName ?? '系统';
  const roleKey = (log.actorRole ?? '') as UserRole;
  const roleLabel = ROLE_LABEL_MAP[roleKey];
  return roleLabel ? `${actorName}（${roleLabel}）` : actorName;
};

const formatTimestampLabel = (timestamp: string): string => {
  const instance = dayjs(timestamp);
  if (!instance.isValid()) {
    return timestamp;
  }
  return instance.format('YYYY-MM-DD HH:mm');
};

const renderChangeDetails = (changes: CaseChangeDetail[]) => {
  if (!changes.length) {
    return null;
  }

  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      {changes.map((change) => {
        const previousText = change.previousValue ?? '—';
        const currentText = change.currentValue ?? '—';

        return (
          <Typography.Paragraph key={change.field} style={{ marginBottom: 0 }}>
            <Typography.Text strong>{change.label}：</Typography.Text>
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              {previousText} → {currentText}
            </Typography.Text>
          </Typography.Paragraph>
        );
      })}
    </Space>
  );
};

const columns: ColumnsType<CaseChangeLog> = [
  {
    title: '变更内容',
    key: 'content',
    render: (_, log) => {
      const actionText = log.description ?? log.action ?? '—';

      return (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text>{actionText}</Typography.Text>
          {log.changes ? renderChangeDetails(log.changes) : null}
        </Space>
      );
    }
  },
  {
    title: '变更人',
    dataIndex: 'actorName',
    key: 'actorName',
    width: 180,
    render: (_, log) => <Typography.Text>{formatActorLabel(log)}</Typography.Text>
  },
  {
    title: '变更时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 180,
    render: (value: string) => <Typography.Text>{formatTimestampLabel(value)}</Typography.Text>
  }
];

const CaseChangeLogModal: FC<CaseChangeLogModalProps> = ({ open, loading, logs, caseTitle, onClose }) => {
  const title = caseTitle ? `案件变更日志 - ${caseTitle}` : '案件变更日志';

  return (
    <Modal title={title} open={open} onCancel={onClose} footer={null} width={720} destroyOnClose>
      <Table
        rowKey={(log) => log.id}
        size="small"
        loading={loading}
        pagination={false}
        dataSource={logs}
        columns={columns}
        locale={{ emptyText: <Empty description="暂无变更记录" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
      />
    </Modal>
  );
};

export default CaseChangeLogModal;
