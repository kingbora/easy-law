'use client';

import { Button, Collapse, Descriptions, Drawer, Empty, Space, Spin, Tag, Typography } from 'antd';
import type { CollapseProps } from 'antd';
import { useMemo } from 'react';

import type { CaseDetail } from '@/lib/cases-api';
import { CASE_BILLING_METHOD_LABELS, CASE_STATUS_LABELS } from '@/lib/cases-constants';

const { Title, Text, Paragraph } = Typography;

export interface CaseDetailDrawerProps {
  open: boolean;
  loading?: boolean;
  caseDetail?: CaseDetail | null;
  onClose: () => void;
  onEdit?: (detail: CaseDetail) => void;
}

const formatAmount = (value: string | null, suffix = '元') => {
  if (!value) {
    return '—';
  }
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return `${value}${suffix}`;
  }
  return `${numeric.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${suffix}`;
};

const formatPercent = (value: string | null) => {
  if (!value) {
    return '—';
  }
  const numeric = Number.parseFloat(value);
  if (Number.isNaN(numeric)) {
    return `${value}%`;
  }
  return `${numeric.toFixed(2)}%`;
};

const formatText = (value: string | null | undefined) => (value && value.trim() ? value : '—');

const formatDate = (value: string | null) => value ?? '—';

export default function CaseDetailDrawer({ open, loading, caseDetail, onClose, onEdit }: CaseDetailDrawerProps) {
  const headerExtra = useMemo(() => {
    if (!caseDetail || !onEdit) {
      return null;
    }
    return (
      <Button type="primary" onClick={() => onEdit(caseDetail)}>
        编辑案件
      </Button>
    );
  }, [caseDetail, onEdit]);

  const lawyersContent = useMemo(() => {
    if (!caseDetail || caseDetail.lawyers.length === 0) {
      return <Text type="secondary">暂无负责律师</Text>;
    }
    return (
      <Space size={[8, 8]} wrap>
        {caseDetail.lawyers.map((lawyer, index) => (
          <Tag color={lawyer.isPrimary ? 'blue' : 'default'} key={lawyer.id ?? lawyer.email ?? index}>
            {lawyer.name ?? lawyer.email ?? '未命名律师'}
            {lawyer.hourlyRate ? ` · ${formatAmount(lawyer.hourlyRate, '元/小时')}` : ''}
            {lawyer.isPrimary ? '（主办）' : ''}
          </Tag>
        ))}
      </Space>
    );
  }, [caseDetail]);

  const collapseItems: CollapseProps['items'] = useMemo(() => {
    if (!caseDetail) {
      return [];
    }
    return [
      {
        key: 'supplement',
        label: '补充信息',
        children: (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Paragraph>{formatText(caseDetail.description)}</Paragraph>
            <Descriptions column={2} size="small" labelStyle={{ width: 160 }}>
              <Descriptions.Item label="受理法院/机构">{formatText(caseDetail.court)}</Descriptions.Item>
              <Descriptions.Item label="立案日期">{formatDate(caseDetail.filingDate)}</Descriptions.Item>
              <Descriptions.Item label="开庭日期">{formatDate(caseDetail.hearingDate)}</Descriptions.Item>
              <Descriptions.Item label="举证截止日">{formatDate(caseDetail.evidenceDeadline)}</Descriptions.Item>
              <Descriptions.Item label="上诉截止日">{formatDate(caseDetail.appealDeadline)}</Descriptions.Item>
              <Descriptions.Item label="标的额">{formatAmount(caseDetail.disputedAmount)}</Descriptions.Item>
            </Descriptions>
            <div>
              <Title level={5} style={{ marginBottom: 8 }}>
                材料补充清单
              </Title>
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{formatText(caseDetail.materialsChecklist)}</Paragraph>
            </div>
          </Space>
        )
      },
      {
        key: 'billing',
        label: '收费详情',
        children: (
          <Descriptions column={2} size="small" labelStyle={{ width: 180 }}>
            <Descriptions.Item label="收费方式">
              {CASE_BILLING_METHOD_LABELS[caseDetail.billingMethod] ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="律师费总额">
              {formatAmount(caseDetail.billing.lawyerFeeTotal)}
            </Descriptions.Item>
            <Descriptions.Item label="预计小时数">
              {caseDetail.billing.estimatedHours !== null && caseDetail.billing.estimatedHours !== undefined
                ? `${caseDetail.billing.estimatedHours} 小时`
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="风险代理比例">
              {formatPercent(caseDetail.billing.contingencyRate)}
            </Descriptions.Item>
            <Descriptions.Item label="其他费用预算">
              {formatAmount(caseDetail.billing.otherFeeBudget)}
            </Descriptions.Item>
            <Descriptions.Item label="付款计划">
              {formatText(caseDetail.billing.paymentPlan)}
            </Descriptions.Item>
          </Descriptions>
        )
      },
      {
        key: 'opponent-extra',
        label: '对方当事人补充信息',
        children: (
          <Descriptions column={1} size="small" labelStyle={{ width: 180 }}>
            <Descriptions.Item label="证件号码">{formatText(caseDetail.opponent.idNumber)}</Descriptions.Item>
            <Descriptions.Item label="对方代理律师">{formatText(caseDetail.opponent.lawyer)}</Descriptions.Item>
            <Descriptions.Item label="第三人">{formatText(caseDetail.opponent.thirdParty)}</Descriptions.Item>
          </Descriptions>
        )
      }
    ];
  }, [caseDetail]);

  return (
    <Drawer
      open={open}
      width={880}
      title="案件详情"
      onClose={onClose}
      destroyOnClose
      maskClosable={false}
      extra={headerExtra}
    >
      <Spin spinning={loading ?? false} tip="正在加载案件信息...">
        {!caseDetail ? (
          <Empty description="请选择案件查看详情" style={{ marginTop: 80 }} />
        ) : (
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <Space direction="vertical" size={12}>
              <Title level={4} style={{ marginBottom: 0 }}>
                {caseDetail.name}
              </Title>
              <Space size={8}>
                <Tag color="processing">{CASE_STATUS_LABELS[caseDetail.status]}</Tag>
                <Tag color="purple">{CASE_BILLING_METHOD_LABELS[caseDetail.billingMethod]}</Tag>
              </Space>
            </Space>

            <Descriptions column={2} labelStyle={{ width: 160 }}>
              <Descriptions.Item label="客户">{caseDetail.client.name}</Descriptions.Item>
              <Descriptions.Item label="案由">
                {caseDetail.caseType.name} / {caseDetail.caseCategory.name}
              </Descriptions.Item>
              <Descriptions.Item label="主办律师">
                {caseDetail.primaryLawyerId
                  ? caseDetail.lawyers.find((lawyer) => lawyer.id === caseDetail.primaryLawyerId)?.name ?? '—'
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="负责律师">{lawyersContent}</Descriptions.Item>
            </Descriptions>

            <Descriptions column={2} labelStyle={{ width: 160 }}>
              <Descriptions.Item label="对方当事人">{caseDetail.opponent.name}</Descriptions.Item>
              <Descriptions.Item label="类型">
                {caseDetail.opponent.type === 'company' ? '企业' : '自然人'}
              </Descriptions.Item>
            </Descriptions>

            <Collapse bordered={false} items={collapseItems} />

            <Descriptions column={2} labelStyle={{ width: 160 }}>
              <Descriptions.Item label="创建时间">
                {caseDetail.createdAt ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="更新时间">
                {caseDetail.updatedAt ?? '—'}
              </Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Spin>
    </Drawer>
  );
}
