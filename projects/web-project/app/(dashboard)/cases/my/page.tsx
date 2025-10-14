'use client';

import { useCallback, useMemo, useState } from 'react';

import {
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  type MenuProps
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { MoreOutlined, PlusOutlined } from '@ant-design/icons';

import CaseModal, { type CaseAttachment, type CaseModalResult } from '@/components/cases/CaseModal';

import { useDashboardHeaderAction } from '../../header-context';

const CASE_STAGES = ['立案', '证据交换', '庭前会议', '庭审', '调解', '判决', '执行'] as const;
const URGENCY_OPTIONS = ['普通', '紧急', '特急'] as const;
const CASE_TYPES = ['民事纠纷', '劳动仲裁', '知识产权', '合同纠纷', '行政诉讼', '刑事辩护'] as const;

type CaseStage = (typeof CASE_STAGES)[number];
type UrgencyLevel = (typeof URGENCY_OPTIONS)[number];

interface CaseItem {
  id: string;
  caseNumber: string;
  type: string;
  clientName: string;
  party: string;
  lawyer: string;
  stage: CaseStage;
  urgency: UrgencyLevel;
  acceptedAt: string;
  description: string;
  attachments: CaseAttachment[];
}

const INITIAL_CASES: CaseItem[] = [
  {
    id: 'case-2025-001',
    caseNumber: '2025-沪民初字第001号',
    type: '合同纠纷',
    clientName: '上海腾达科技有限公司',
    party: '李四',
    lawyer: '王哲',
    stage: '证据交换',
    urgency: '普通',
    acceptedAt: '2025-03-12',
    description: '围绕技术服务费用结算产生争议，需确认合同履行情况与违约责任。',
    attachments: [
      {
        uid: 'att-001',
        name: '立案材料.pdf',
        url: '#'
      },
      {
        uid: 'att-002',
        name: '合同文本.zip',
        url: '#'
      }
    ]
  },
  {
    id: 'case-2025-002',
    caseNumber: '2025-沪劳仲字第018号',
    type: '劳动仲裁',
    clientName: '陈晓',
    party: '上海瀚锐传媒有限公司',
    lawyer: '周宁',
    stage: '调解',
    urgency: '紧急',
    acceptedAt: '2025-04-05',
    description: '涉及劳动合同解除及经济补偿金争议，当前处于调解阶段。',
    attachments: [
      {
        uid: 'att-101',
        name: '劳动合同扫描件.pdf',
        url: '#'
      }
    ]
  }
];

type Filters = {
  party?: string;
  stage?: CaseStage;
  urgency?: UrgencyLevel;
};

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; record?: undefined }
  | { open: true; mode: 'view' | 'edit'; record: CaseItem };

const { Text } = Typography;

function getStagePercent(stage: CaseStage) {
  const index = CASE_STAGES.indexOf(stage);
  if (index === -1) {
    return 0;
  }
  return Math.round(((index + 1) / CASE_STAGES.length) * 100);
}

const ACTION_MENU_ITEMS: MenuProps['items'] = [
  { key: 'supplement', label: '补充结案文件' },
  { key: 'archive', label: '案件归档' },
  { key: 'transfer', label: '转交' }
];

function createCaseId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `case-${Date.now()}`;
}

function transformToCaseItem(values: CaseModalResult, id?: string): CaseItem {
  return {
    id: id ?? createCaseId(),
    caseNumber: values.caseNumber,
    type: values.type,
    clientName: values.clientName,
    party: values.party,
    lawyer: values.lawyer,
    stage: values.stage as CaseStage,
    urgency: values.urgency as UrgencyLevel,
    acceptedAt: values.acceptedAt,
    description: values.description,
    attachments: values.attachments ?? []
  };
}

export default function MyCasesPage() {
  const [cases, setCases] = useState<CaseItem[]>(INITIAL_CASES);
  const [filters, setFilters] = useState<Filters>({});
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [submitting, setSubmitting] = useState(false);

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      if (filters.party && !item.party.toLowerCase().includes(filters.party.toLowerCase())) {
        return false;
      }
      if (filters.stage && item.stage !== filters.stage) {
        return false;
      }
      if (filters.urgency && item.urgency !== filters.urgency) {
        return false;
      }
      return true;
    });
  }, [cases, filters]);

  const handleFilterChange = (_: unknown, allValues: Filters) => {
    setFilters(allValues);
  };

  const openCreateModal = useCallback(() => {
    setModalState({ open: true, mode: 'create' });
  }, []);

  const headerAction = useMemo(
    () => (
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
        新增案件
      </Button>
    ),
    [openCreateModal]
  );

  useDashboardHeaderAction(headerAction);

  const handleViewCase = useCallback((record: CaseItem) => {
    setModalState({ open: true, mode: 'view', record });
  }, []);

  const closeModal = useCallback(() => {
    setModalState((prev) => {
      if (prev.open && prev.mode === 'edit') {
        return { open: true, mode: 'view', record: prev.record };
      } else {
        return { open: false };
      }
    });
    setSubmitting(false);
  }, []);

  const handleModeChange = useCallback((mode: 'create' | 'view' | 'edit') => {
    if (mode === 'view' || mode === 'edit') {
      setModalState((prev) => {
        if (prev.open && prev.mode !== 'create' && prev.record) {
          return { open: true, mode, record: prev.record };
        }
        return prev;
      });
    }
  }, []);

  const handleSubmit = useCallback(
    async (values: CaseModalResult) => {
      setSubmitting(true);
      await new Promise((resolve) => setTimeout(resolve, 350));

      const isEdit = modalState.open && modalState.mode === 'edit' && modalState.record;

      setCases((prev) => {
        if (isEdit && modalState.record) {
          return prev.map((item) => (item.id === modalState.record.id ? transformToCaseItem(values, modalState.record.id) : item));
        }

        return [transformToCaseItem(values), ...prev];
      });

      message.success(isEdit ? '案件信息已更新' : '新增案件成功');
      closeModal();
    },
    [closeModal, modalState]
  );

  const columns = useMemo<ColumnsType<CaseItem>>(
    () => [
      {
        title: '案号',
        dataIndex: 'caseNumber',
        fixed: 'left',
        width: 200,
        render: (_, record) => (
          <Button type="link" onClick={() => handleViewCase(record)}>
            {record.caseNumber}
          </Button>
        )
      },
      {
        title: '类型',
        dataIndex: 'type'
      },
      {
        title: '委托人',
        dataIndex: 'clientName'
      },
      {
        title: '当事人',
        dataIndex: 'party'
      },
      {
        title: '承办律师',
        dataIndex: 'lawyer'
      },
      {
        title: '案件进度',
        dataIndex: 'stage',
        render: (stage: CaseStage) => {
          const percent = getStagePercent(stage);
          return (
            <Space direction="vertical" size={4} style={{ width: 160 }}>
              <Progress percent={percent} steps={CASE_STAGES.length} status="active" showInfo={false} />
              <Text type="secondary">{stage}</Text>
            </Space>
          );
        }
      },
      {
        title: '紧急程度',
        dataIndex: 'urgency',
        render: (urgency: UrgencyLevel) => {
          const color = urgency === '特急' ? 'red' : urgency === '紧急' ? 'orange' : 'blue';
          return <Tag color={color}>{urgency}</Tag>;
        }
      },
      {
        title: '受理时间',
        dataIndex: 'acceptedAt',
        sorter: (a, b) => dayjs(a.acceptedAt).valueOf() - dayjs(b.acceptedAt).valueOf()
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 60,
        render: (_, record) => (
          <Dropdown menu={{ items: ACTION_MENU_ITEMS }} trigger={['click']}>
              <Button type="text" icon={<MoreOutlined />} aria-label={`操作 ${record.caseNumber}`} />
            </Dropdown>
        )
      }
    ],
    [handleViewCase]
  );

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      <Card>
        <Form layout="inline" onValuesChange={handleFilterChange} style={{ rowGap: 16 }}>
          <Form.Item label="当事人" name="party">
            <Input allowClear placeholder="请输入当事人姓名" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item label="案件进度" name="stage">
            <Select
              allowClear
              placeholder="请选择案件进度"
              style={{ width: 220 }}
              options={CASE_STAGES.map((stage) => ({ label: stage, value: stage }))}
            />
          </Form.Item>
          <Form.Item label="紧急程度" name="urgency">
            <Select
              allowClear
              placeholder="请选择紧急程度"
              style={{ width: 220 }}
              options={URGENCY_OPTIONS.map((level) => ({ label: level, value: level }))}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card styles={{ body: { padding: 0 }}}>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredCases}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {modalState.open ? (
        <CaseModal
          open
          mode={modalState.mode}
          caseStages={[...CASE_STAGES]}
          caseTypes={[...CASE_TYPES]}
          urgencyOptions={[...URGENCY_OPTIONS]}
          initialValues={modalState.mode === 'create' ? undefined : modalState.record}
          onCancel={closeModal}
          onSubmit={handleSubmit}
          onModeChange={handleModeChange}
          confirmLoading={submitting}
        />
      ) : null}
    </Space>
  );
}
