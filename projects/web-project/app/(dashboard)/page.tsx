'use client';

import { ArrowDownOutlined, ArrowUpOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Col, Empty, Row, Space, Spin, Statistic, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchDashboardOverview, type DashboardOverviewResponse, type MetricSeries } from '@/lib/dashboard-api';

const { Title, Paragraph, Text } = Typography;

const periodLabelMap: Record<MetricSeries['period'], string> = {
  daily: '今日',
  weekly: '本周',
  monthly: '本月'
};

const roleDescriptionMap: Record<string, string> = {
  master: '作为超级管理员，你可以从这里快速了解团队整体运营表现。',
  admin: '管理员权限概览，帮助你掌握组织整体节奏与关键指标。',
  sale: '销售角色概览，聚焦你负责的客户与案件变化。',
  lawyer: '律师角色概览，展示你负责案件的新增与结案情况。',
  assistant: '业务助理视角概览，帮助你掌握协同案件的动态与进展。'
};

const percentFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

const numberFormatter = new Intl.NumberFormat('zh-CN');

const formatTrendTag = (changeRatio: number) => {
  if (!Number.isFinite(changeRatio) || changeRatio === 0) {
    return <Tag>持平</Tag>;
  }
  const color = changeRatio > 0 ? 'green' : 'red';
  const Icon = changeRatio > 0 ? ArrowUpOutlined : ArrowDownOutlined;
  const formatted = percentFormatter.format(Math.abs(changeRatio));
  const text = `${changeRatio > 0 ? '+' : '-'}${formatted}`;
  return (
    <Tag color={color} icon={<Icon />}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      {text}
    </Tag>
  );
};

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);

const renderSeriesRow = (series: MetricSeries, unit: string) => (
  <div
    key={series.period}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 0',
      borderBottom: '1px solid rgba(0,0,0,0.06)'
    }}
  >
    <div>
      <Text strong>{periodLabelMap[series.period]}</Text>
      <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
        {series.comparisonLabel} {series.comparisonTarget}
      </Paragraph>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>{numberFormatter.format(series.current)} {unit}</Text>
        {formatTrendTag(series.changeRatio)}
      </div>
      <Paragraph style={{ marginBottom: 0, fontSize: 12 }} type="secondary">
        上期 {numberFormatter.format(series.previous)} {unit}
      </Paragraph>
    </div>
  </div>
);

export default function DashboardHomePage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<DashboardOverviewResponse | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchDashboardOverview();
      setOverview(data);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '无法获取首页概览数据';
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const generatedAtText = useMemo(() => {
    if (!overview) {
      return '';
    }
    const generatedDate = new Date(overview.generatedAt);
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(generatedDate);
  }, [overview]);

  return (
    <div>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>首页概览</Title>
            <Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {overview ? roleDescriptionMap[overview.role] : '加载中，请稍候…'}
            </Paragraph>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadOverview} disabled={loading}>
            刷新
          </Button>
        </div>

        <Spin spinning={loading} tip="正在拉取数据…">
          {overview ? (
            <Space direction="vertical" size={24} style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12} xl={8}>
                  <Card>
                    <Statistic
                      title="当日收益预估"
                      value={formatCurrency(overview.revenueToday.amount, overview.revenueToday.currency)}
                    />
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                        {overview.revenueToday.note ?? '预估值，最终以财务确认为准'}
                      </Paragraph>
                      {typeof overview.revenueToday.trend === 'number' ? formatTrendTag(overview.revenueToday.trend) : null}
                    </div>
                  </Card>
                </Col>
                {overview.metrics.map((metric) => (
                  <Col xs={24} md={12} xl={8} key={metric.key}>
                    <Card
                      title={metric.label}
                      extra={metric.description ? <Text type="secondary">{metric.description}</Text> : undefined}
                      bodyStyle={{ paddingBottom: 0 }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size={0}>
                        {metric.series.length > 0 ? (
                          metric.series.map((series) => renderSeriesRow(series, metric.unit))
                        ) : (
                          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                            暂无数据
                          </Paragraph>
                        )}
                      </Space>
                    </Card>
                  </Col>
                ))}
              </Row>

              {overview.highlights && overview.highlights.length > 0 ? (
                <Card title="智能提示">
                  <Space direction="vertical" style={{ width: '100%' }} size={16}>
                    {overview.highlights.map((highlight) => (
                      <div key={highlight.title}>
                        <Text strong>{highlight.title}</Text>
                        <Paragraph style={{ marginBottom: 8 }}>{highlight.description}</Paragraph>
                        {highlight.action ? (
                          <Button type="link" size="small" href={highlight.action.href}>
                            {highlight.action.label}
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </Space>
                </Card>
              ) : null}

              <Text type="secondary">数据更新时间：{generatedAtText}</Text>
            </Space>
          ) : (
            <Card>
              <Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          )}
        </Spin>
      </Space>
    </div>
  );
}
