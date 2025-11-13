'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  List,
  Result,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DollarOutlined,
  RiseOutlined,
  TeamOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { TRIAL_STAGE_LABEL_MAP, USER_DEPARTMENTS } from '@easy-law/shared-types';
import type { CaseStatus, TrialStage, UserDepartment, UserRole } from '@easy-law/shared-types';

import { fetchCalendarEvents, type CalendarEventRecord } from '@/lib/calendar-events-api';
import {
  fetchCases,
} from '@/lib/cases-api';
import {
  fetchUsers,
  type CurrentUserResponse,
  type UserResponse
} from '@/lib/users-api';
import { ApiError } from '@/lib/api-client';
import { useCurrentUser } from '@/lib/stores/session-store';
import {
  CASE_STATUS_COLOR_MAP,
  CASE_STATUS_LABEL_MAP,
  CASE_TYPE_LABEL_MAP,
  DEPARTMENT_LABEL_MAP,
  ROLE_COLOR_MAP,
  ROLE_LABEL_MAP,
  type CaseListQuery,
  type CaseRecord
} from '@easy-law/shared-types';

import styles from './page.module.scss';

const { Title, Text } = Typography;

interface SummaryMetrics {
  totalCases: number;
  openCases: number;
  closedCases: number;
  voidCases: number;
  myCases?: number;
  totalCollections?: number;
  monthlyCollections?: number;
  averageCollection?: number;
  conversionRate?: number;
  upcomingCount?: number;
}

interface DashboardCaseSummary {
  id: string;
  displayName: string;
  status: CaseStatus | null;
  department: UserDepartment | null;
  updatedAt: string;
  caseType: CaseRecord['caseType'];
  caseLevel: CaseRecord['caseLevel'];
  assignedSaleName: string | null;
  assignedLawyerName: string | null;
  assignedAssistantName: string | null;
}

interface DistributionItem {
  key: string;
  label: string;
  count: number;
}

interface EventSummary {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  tagColor: string;
  description?: string | null;
  caseNumber?: string | null;
  trialStage?: TrialStage | null;
}

interface FinancialReceiptSummary {
  id: string;
  caseId: string;
  caseName: string;
  department: UserDepartment | null;
  amount: number;
  receivedAt: string;
}

interface DashboardTeamMember {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  department: UserDepartment | null;
}

interface DashboardRoleData {
  role: UserRole;
  summary: SummaryMetrics;
  recentCases: DashboardCaseSummary[];
  upcomingEvents: EventSummary[];
  warnings: string[];
  departmentDistribution?: DistributionItem[];
  statusDistribution?: Array<{ status: CaseStatus; count: number }>;
  teamSummary?: Array<{ role: UserRole; count: number }>;
  teamMembers?: DashboardTeamMember[];
  financials?: {
    totalCollections: number;
    monthlyCollections: number;
    averageCollection: number;
    latestReceipts: FinancialReceiptSummary[];
  };
  myCases?: DashboardCaseSummary[];
  pipeline?: Array<{ status: CaseStatus; count: number }>;
  highlightText?: string;
}

const numberFormatter = new Intl.NumberFormat('zh-CN');
const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0
});

const CASE_STATUS_ORDER: CaseStatus[] = ['open', 'closed', 'void'];

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return numberFormatter.format(Math.round(value));
}

function formatCurrency(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) {
    return '¥0';
  }
  return currencyFormatter.format(Math.round(value));
}

function safeParseAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const sanitized = value.replace(/,/g, '');
  const parsed = Number.parseFloat(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildCaseDisplayName(record: CaseRecord): string {
  const claimantNames = record.participants?.claimants
    ?.map((participant) => participant.name?.trim())
    .filter((name): name is string => Boolean(name && name.length > 0));

  if (claimantNames && claimantNames.length > 0) {
    if (claimantNames.length === 1) {
      return claimantNames[0];
    }
    return `${claimantNames[0]} 等 ${claimantNames.length} 人`;
  }

  if (record.assignedSaleName) {
    return `${record.assignedSaleName} - ${CASE_TYPE_LABEL_MAP[record.caseType]}`;
  }

  return `案件 ${record.id.slice(0, 6).toUpperCase()}`;
}

function mapCaseToSummary(record: CaseRecord): DashboardCaseSummary {
  return {
    id: record.id,
    displayName: buildCaseDisplayName(record),
    status: record.caseStatus ?? null,
    department: record.department ?? null,
    updatedAt: record.updatedAt,
    caseType: record.caseType,
    caseLevel: record.caseLevel,
    assignedSaleName: record.assignedSaleName ?? null,
    assignedLawyerName: record.assignedLawyerName ?? null,
    assignedAssistantName: record.assignedAssistantName ?? null
  } satisfies DashboardCaseSummary;
}

function pickUpcomingEvents(records: CalendarEventRecord[], limit = 6): EventSummary[] {
  const now = dayjs();

  return records
    .map((record) => {
      const date = dayjs(record.eventDate);
      const datetime = record.eventTime ? dayjs(`${record.eventDate}T${record.eventTime}`) : date;

      if (!datetime.isValid()) {
        return null;
      }

      return {
        id: record.id,
        title: record.title,
        date: datetime.format('YYYY-MM-DD'),
        time: record.eventTime,
        tagColor: record.tagColor,
        description: record.description,
        caseNumber: record.metadata?.caseNumber ?? null,
        trialStage: record.metadata?.trialStage ?? null,
        occursAt: datetime
      } as EventSummary & { occursAt: dayjs.Dayjs };
    })
    .filter((item): item is EventSummary & { occursAt: dayjs.Dayjs } => Boolean(item && item.occursAt.isAfter(now.subtract(1, 'day'))))
    .sort((a, b) => a.occursAt.valueOf() - b.occursAt.valueOf())
    .slice(0, limit)
  .map(({ occursAt: _occursAt, ...rest }) => rest);
}

function extractHearingEvents(cases: CaseRecord[], limit = 6): EventSummary[] {
  const now = dayjs();
  const events: Array<EventSummary & { occursAt: dayjs.Dayjs }> = [];

  cases.forEach((record) => {
    record.hearings?.forEach((hearing) => {
      if (!hearing.hearingTime) {
        return;
      }
      const occursAt = dayjs(hearing.hearingTime);
      if (!occursAt.isValid() || occursAt.isBefore(now.subtract(1, 'day'))) {
        return;
      }
      events.push({
        id: `${record.id}-${hearing.id}`,
        title: `${record.assignedLawyerName ?? '庭审'}——${hearing.tribunal ?? '待定'}`,
        date: occursAt.format('YYYY-MM-DD'),
        time: occursAt.format('HH:mm'),
        tagColor: '#13c2c2',
        description: hearing.hearingLocation ?? undefined,
        caseNumber: hearing.caseNumber ?? null,
        trialStage: hearing.trialStage ?? null,
        occursAt
      });
    });
  });

  return events
    .sort((a, b) => a.occursAt.valueOf() - b.occursAt.valueOf())
    .slice(0, limit)
  .map(({ occursAt: _occursAt, ...rest }) => rest);
}

function aggregateTeamByRole(members: DashboardTeamMember[]): Array<{ role: UserRole; count: number }> {
  const counter = new Map<UserRole, number>();

  members.forEach((member) => {
    counter.set(member.role, (counter.get(member.role) ?? 0) + 1);
  });

  return Array.from(counter.entries()).map(([role, count]) => ({ role, count }));
}

function shouldLoadTeam(user: CurrentUserResponse): boolean {
  return user.role === 'super_admin' || user.role === 'admin';
}

function getRoleScopedQuery(user: CurrentUserResponse): CaseListQuery {
  if ((user.role === 'admin' || user.role === 'administration') && user.department) {
    return { department: user.department } satisfies CaseListQuery;
  }
  if (user.role === 'lawyer') {
    return { assignedLawyerId: user.id } satisfies CaseListQuery;
  }
  if (user.role === 'sale') {
    return { assignedSaleId: user.id } satisfies CaseListQuery;
  }
  return {};
}

async function fetchCaseTotal(query: CaseListQuery): Promise<number> {
  const response = await fetchCases({ ...query, page: 1, pageSize: 1 });
  const total = response.pagination?.total;
  return typeof total === 'number' ? total : response.data.length;
}

async function fetchCaseList(query: CaseListQuery, limit = 6): Promise<CaseRecord[]> {
  const response = await fetchCases({
    ...query,
    page: 1,
    pageSize: limit,
    orderBy: 'updatedAt',
    orderDirection: 'desc'
  });
  return response.data;
}

async function loadDashboardData(user: CurrentUserResponse): Promise<DashboardRoleData> {
  const warnings: string[] = [];
  const scopedQuery = getRoleScopedQuery(user);

  const countsPromise = Promise.all([
    fetchCaseTotal(scopedQuery),
    fetchCaseTotal({ ...scopedQuery, caseStatus: 'open' }),
    fetchCaseTotal({ ...scopedQuery, caseStatus: 'closed' }),
    fetchCaseTotal({ ...scopedQuery, caseStatus: 'void' }),
    fetchCaseList(scopedQuery, 10)
  ]);

  const eventsPromise = fetchCalendarEvents().catch((error) => {
    warnings.push(error instanceof ApiError ? error.message : '日程数据加载失败');
    return [] as CalendarEventRecord[];
  });

  const teamPromise: Promise<UserResponse[] | null> = shouldLoadTeam(user)
    ? fetchUsers()
        .then((list) => list)
        .catch((error) => {
          warnings.push(
            error instanceof ApiError
              ? error.message
              : '团队成员数据加载失败，相关模块将暂时隐藏'
          );
          return null;
        })
    : Promise.resolve(null);

  const [[totalCases, openCases, closedCases, voidCases, recentCaseRecords], calendarEvents, teamUsers] =
    await Promise.all([countsPromise, eventsPromise, teamPromise]);

  const summary: SummaryMetrics = {
    totalCases,
    openCases,
    closedCases,
    voidCases
  };

  const recentCases = recentCaseRecords.map(mapCaseToSummary);
  let upcomingEvents = pickUpcomingEvents(calendarEvents, 6);

  const baseData: DashboardRoleData = {
    role: user.role,
    summary,
    recentCases,
    upcomingEvents,
    warnings
  };

  if (user.role === 'super_admin') {
    const departmentCounts = await Promise.all(
      USER_DEPARTMENTS.map(async (department) => ({
        department,
        count: await fetchCaseTotal({ department })
      }))
    );

    const departmentDistribution: DistributionItem[] = departmentCounts.map(({ department, count }) => ({
      key: department,
      label: DEPARTMENT_LABEL_MAP[department],
      count
    }));

    const teamMembers: DashboardTeamMember[] = (teamUsers ?? []).map((member) => ({
      id: member.id,
      name: member.name ?? member.email,
      role: member.role,
      email: member.email,
      department: member.department ?? null
    }));

    return {
      ...baseData,
      summary: {
        ...summary,
        conversionRate: summary.totalCases > 0 ? Math.round((summary.closedCases / summary.totalCases) * 100) : 0
      },
      departmentDistribution,
      teamSummary: aggregateTeamByRole(teamMembers),
      teamMembers: teamMembers.slice(0, 6)
    } satisfies DashboardRoleData;
  }

  if (user.role === 'admin') {
    const teamMembers: DashboardTeamMember[] = (teamUsers ?? [])
      .filter((member) => member.department === user.department)
      .map((member) => ({
        id: member.id,
        name: member.name ?? member.email,
        role: member.role,
        email: member.email,
        department: member.department ?? null
      }));

    const statusDistribution = CASE_STATUS_ORDER.map((status) => ({
      status,
      count: status === 'open' ? summary.openCases : status === 'closed' ? summary.closedCases : summary.voidCases
    }));

    return {
      ...baseData,
      statusDistribution,
      teamSummary: aggregateTeamByRole(teamMembers),
      teamMembers: teamMembers.slice(0, 6)
    } satisfies DashboardRoleData;
  }

  if (user.role === 'administration') {
    const financialCases = await fetchCaseList(scopedQuery, 50);
    const receipts: FinancialReceiptSummary[] = financialCases
      .flatMap((record) =>
        record.collections?.map((collection) => ({
          id: `${record.id}-${collection.id}`,
          caseId: record.id,
          caseName: buildCaseDisplayName(record),
          department: record.department ?? null,
          amount: safeParseAmount(collection.amount),
          receivedAt: collection.receivedAt
        })) ?? []
      )
      .filter((item) => item.amount > 0)
      .sort((a, b) => dayjs(b.receivedAt).valueOf() - dayjs(a.receivedAt).valueOf());

    const totalCollections = receipts.reduce((acc, item) => acc + item.amount, 0);
    const monthlyCollections = receipts
      .filter((item) => dayjs(item.receivedAt).isSame(dayjs(), 'month'))
      .reduce((acc, item) => acc + item.amount, 0);
    const averageCollection = receipts.length > 0 ? totalCollections / receipts.length : 0;

    return {
      ...baseData,
      summary: {
        ...summary,
        totalCollections,
        monthlyCollections,
        averageCollection,
        conversionRate: summary.totalCases > 0 ? Math.round((summary.closedCases / summary.totalCases) * 100) : 0
      },
      financials: {
        totalCollections,
        monthlyCollections,
        averageCollection,
        latestReceipts: receipts.slice(0, 6)
      },
      statusDistribution: CASE_STATUS_ORDER.map((status) => ({
        status,
        count: status === 'open' ? summary.openCases : status === 'closed' ? summary.closedCases : summary.voidCases
      }))
    } satisfies DashboardRoleData;
  }

  if (user.role === 'lawyer') {
    const myCasesRecords = await fetchCaseList({ ...scopedQuery, assignedLawyerId: user.id }, 20);
    const myCases = myCasesRecords.map(mapCaseToSummary);
    summary.myCases = myCasesRecords.length;

    if (upcomingEvents.length < 3) {
      const hearingEvents = extractHearingEvents(recentCaseRecords, 6);
      const merged = [...upcomingEvents, ...hearingEvents];
      const deduplicated = new Map<string, EventSummary>();
      merged.forEach((event) => {
        deduplicated.set(event.id, event);
      });
      upcomingEvents = Array.from(deduplicated.values())
        .sort((a, b) => dayjs(`${a.date} ${a.time ?? '00:00'}`).valueOf() - dayjs(`${b.date} ${b.time ?? '00:00'}`).valueOf())
        .slice(0, 6);
    }

    summary.upcomingCount = upcomingEvents.length;

    return {
      ...baseData,
      summary,
      myCases
    } satisfies DashboardRoleData;
  }

  if (user.role === 'assistant') {
    const assistantCases = await fetchCaseList({ ...scopedQuery, pageSize: 30 }, 30);
    const myCases = assistantCases
      .filter((record) => record.assignedAssistantId === user.id)
      .map(mapCaseToSummary);
    summary.myCases = myCases.length;

    if (upcomingEvents.length < 3) {
      const hearingEvents = extractHearingEvents(assistantCases, 6);
      const merged = [...upcomingEvents, ...hearingEvents];
      const deduplicated = new Map<string, EventSummary>();
      merged.forEach((event) => {
        deduplicated.set(event.id, event);
      });
      upcomingEvents = Array.from(deduplicated.values())
        .sort((a, b) => dayjs(`${a.date} ${a.time ?? '00:00'}`).valueOf() - dayjs(`${b.date} ${b.time ?? '00:00'}`).valueOf())
        .slice(0, 6);
    }

    summary.upcomingCount = upcomingEvents.length;

    return {
      ...baseData,
      summary,
      myCases,
      statusDistribution: CASE_STATUS_ORDER.map((status) => ({
        status,
        count: status === 'open' ? summary.openCases : status === 'closed' ? summary.closedCases : summary.voidCases
      }))
    } satisfies DashboardRoleData;
  }

  if (user.role === 'sale') {
    summary.conversionRate = summary.totalCases > 0 ? Math.round((summary.closedCases / summary.totalCases) * 100) : 0;
    const pipeline = CASE_STATUS_ORDER.map((status) => ({
      status,
      count: status === 'open' ? summary.openCases : status === 'closed' ? summary.closedCases : summary.voidCases
    }));

    return {
      ...baseData,
      summary,
      pipeline
    } satisfies DashboardRoleData;
  }

  return baseData;
}

interface SummaryCardProps {
  title: string;
  value: string;
  suffix?: string;
  description?: string;
  trend?: { value: string; type: 'up' | 'down' };
}

function SummaryCard({ title, value, suffix, description, trend }: SummaryCardProps) {
  const trendIcon = trend?.type === 'up' ? <ArrowUpOutlined /> : <ArrowDownOutlined />;
  return (
    <Card className={styles.summaryCard} bordered={false}>
      <Space direction="vertical" size={12} className={styles.summaryCardBody}>
        <Statistic
          title={title}
          value={value}
          suffix={suffix}
          valueStyle={{ fontSize: '32px', fontWeight: 600, lineHeight: '40px' }}
        />
        {trend ? (
          <Space size={6} className={`${styles.summaryCardTrend} ${trend.type === 'up' ? styles.trendUp : styles.trendDown}`}>
            {trendIcon}
            <span>{trend.value}</span>
          </Space>
        ) : null}
        {description ? <Text type="secondary">{description}</Text> : null}
      </Space>
    </Card>
  );
}

function DistributionChart({ data }: { data: DistributionItem[] }) {
  const max = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className={styles.barChart}>
      {data.map((item) => {
        const heightPercent = Math.round((item.count / max) * 100);
        return (
          <div key={item.key} className={styles.barItem}>
            <div className={styles.barValue}>{formatNumber(item.count)}</div>
            <div className={styles.barWrapper}>
              <div className={styles.bar} style={{ height: `${heightPercent}%` }} />
            </div>
            <div className={styles.barLabel}>{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatusLegend({
  data
}: {
  data: Array<{ status: CaseStatus; count: number }>
}) {
  const total = data.reduce((acc, item) => acc + item.count, 0);

  return (
    <Space size={[16, 12]} wrap className={styles.statusLegend}>
      {data.map((item) => {
        const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
        return (
          <Tag key={item.status} color={CASE_STATUS_COLOR_MAP[item.status]} className={styles.statusLegendItem}>
            <span className={styles.statusLegendTitle}>{CASE_STATUS_LABEL_MAP[item.status]}</span>
            <span className={styles.statusLegendValue}>{formatNumber(item.count)}</span>
            <span className={styles.statusLegendPercent}>{percent}%</span>
          </Tag>
        );
      })}
    </Space>
  );
}

function CaseList({ title, data, emptyText }: { title: string; data: DashboardCaseSummary[]; emptyText: string }) {
  return (
    <Card title={title} className={styles.sectionCard} bordered={false}>
      {data.length === 0 ? (
        <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={data}
          renderItem={(item) => (
            <List.Item key={item.id} className={styles.caseListItem}>
              <div className={styles.caseListMeta}>
                <div className={styles.caseListTitle}>{item.displayName}</div>
                <div className={styles.caseListTags}>
                  {item.status ? (
                    <Tag color={CASE_STATUS_COLOR_MAP[item.status]}>{CASE_STATUS_LABEL_MAP[item.status]}</Tag>
                  ) : null}
                  {item.department ? (
                    <Tag color="default">{DEPARTMENT_LABEL_MAP[item.department]}</Tag>
                  ) : null}
                  <Tag color="default">{CASE_TYPE_LABEL_MAP[item.caseType]}</Tag>
                </div>
              </div>
              <div className={styles.caseListMetaRight}>
                <Text type="secondary">最近更新：{dayjs(item.updatedAt).format('MM-DD HH:mm')}</Text>
              </div>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

function EventList({ title, data }: { title: string; data: EventSummary[] }) {
  return (
    <Card title={title} className={styles.sectionCard} bordered={false}>
      {data.length === 0 ? (
        <Empty description="暂无日程事件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={data}
          renderItem={(item) => (
            <List.Item key={item.id} className={styles.eventListItem}>
              <Space direction="vertical" size={4} className={styles.eventListContent}>
                <Space size={12}>
                  <Tag color={item.tagColor} className={styles.eventTag}>{item.title}</Tag>
                  {
                    item.trialStage ?
                      <Text type="secondary">{TRIAL_STAGE_LABEL_MAP[item.trialStage]}</Text>
                    : null
                  }
                </Space>
                <Text strong>{item.date}{item.time ? ` ${item.time}` : ''}</Text>
                {item.caseNumber ? <Text type="secondary">案号：{item.caseNumber}</Text> : null}
                {item.description ? <Text type="secondary">{item.description}</Text> : null}
              </Space>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

function TeamList({ title, members }: { title: string; members: DashboardTeamMember[] }) {
  return (
    <Card title={title} className={styles.sectionCard} bordered={false}>
      {members.length === 0 ? (
        <Empty description="暂无可显示的团队成员" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={members}
          renderItem={(member) => (
            <List.Item key={member.id} className={styles.teamListItem}>
              <Space direction="vertical" size={0}>
                <Text strong>{member.name}</Text>
                <Space size={8}>
                  <Tag color={ROLE_COLOR_MAP[member.role]}>{ROLE_LABEL_MAP[member.role]}</Tag>
                  {member.department ? <Tag>{DEPARTMENT_LABEL_MAP[member.department]}</Tag> : null}
                </Space>
                <Text type="secondary">{member.email}</Text>
              </Space>
            </List.Item>
          )}
        />
      )}
    </Card>
  );
}

function FinancialSnapshot({
  summary,
  receipts
}: {
  summary: SummaryMetrics;
  receipts: FinancialReceiptSummary[];
}) {
  return (
    <Card title="收款概览" className={styles.sectionCard} bordered={false}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space size={24} wrap>
          <Statistic
            title="总收款"
            prefix={<DollarOutlined />}
            value={formatCurrency(summary.totalCollections ?? 0)}
            className={styles.statistic}
          />
          <Statistic
            title="本月到账"
            prefix={<RiseOutlined />}
            value={formatCurrency(summary.monthlyCollections ?? 0)}
            className={styles.statistic}
          />
          <Statistic
            title="平均单笔"
            value={formatCurrency(summary.averageCollection ?? 0)}
            className={styles.statistic}
          />
        </Space>
        <div className={styles.receiptListTitle}>最近到账（前 6 笔）</div>
        {receipts.length === 0 ? (
          <Empty description="暂无收款记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            dataSource={receipts}
            renderItem={(item) => (
              <List.Item key={item.id} className={styles.receiptListItem}>
                <Space direction="vertical" size={0}>
                  <Text strong>{item.caseName}</Text>
                  <Space size={8}>
                    {item.department ? <Tag>{DEPARTMENT_LABEL_MAP[item.department]}</Tag> : null}
                    <Text type="secondary">到账时间：{dayjs(item.receivedAt).format('MM-DD')}</Text>
                  </Space>
                </Space>
                <Text strong className={styles.receiptAmount}>{formatCurrency(item.amount)}</Text>
              </List.Item>
            )}
          />
        )}
      </Space>
    </Card>
  );
}

function PipelineCard({ data }: { data: Array<{ status: CaseStatus; count: number }> }) {
  const total = data.reduce((acc, item) => acc + item.count, 0);
  return (
    <Card title="销售漏斗" className={styles.sectionCard} bordered={false}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {data.map((item) => {
          const percent = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div key={item.status} className={styles.pipelineRow}>
              <div className={styles.pipelineLabel}>{CASE_STATUS_LABEL_MAP[item.status]}</div>
              <div className={styles.pipelineBar}>
                <div
                  className={styles.pipelineBarInner}
                  style={{ width: `${percent}%`, backgroundColor: CASE_STATUS_COLOR_MAP[item.status] }}
                />
              </div>
              <div className={styles.pipelineValue}>{formatNumber(item.count)}</div>
            </div>
          );
        })}
      </Space>
    </Card>
  );
}

export default function DashboardHomePage() {
  const { message } = App.useApp();
  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardRoleData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadData = useCallback(async () => {
    if (!currentUser) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await loadDashboardData(currentUser);
      setData(result);
    } catch (err) {
      const messageText = err instanceof ApiError ? err.message : err instanceof Error ? err.message : '仪表盘数据加载失败';
      setError(messageText);
      message.error(messageText);
    } finally {
      setLoading(false);
    }
  }, [currentUser, message]);

  useEffect(() => {
    void loadData();
  }, [loadData, reloadKey]);

  const handleRetry = useCallback(() => {
    setReloadKey((prev) => prev + 1);
  }, []);

  const summaryCards = useMemo((): Parameters<typeof SummaryCard>[0][] => {
    if (!data) {
      return [];
    }

    const cards: Parameters<typeof SummaryCard>[0][] = [
      {
        title: '案件总量',
        value: formatNumber(data.summary.totalCases)
      },
      {
        title: '跟进中',
        value: formatNumber(data.summary.openCases),
        description: '当前仍在推进的案件'
      },
      {
        title: '已结案',
        value: formatNumber(data.summary.closedCases)
      },
      {
        title: '废单',
        value: formatNumber(data.summary.voidCases)
      }
    ];

    if (data.summary.totalCollections !== undefined) {
      cards.push({
        title: '累计收款',
        value: formatCurrency(data.summary.totalCollections)
      });
    }

    if (data.summary.conversionRate !== undefined) {
      cards.push({
        title: '转化率',
        value: `${data.summary.conversionRate}%`
      });
    }

    if (data.summary.upcomingCount !== undefined) {
      cards.push({
        title: '近期待办',
        value: formatNumber(data.summary.upcomingCount)
      });
    }

    if (data.summary.myCases !== undefined) {
      cards.push({
        title: '我的案件',
        value: formatNumber(data.summary.myCases)
      });
    }

    return cards;
  }, [data]);

  if (!currentUser) {
    return <Skeleton active className={styles.loadingSkeleton} />;
  }

  if (loading && !data) {
    return <Skeleton active className={styles.loadingSkeleton} paragraph={{ rows: 6 }} />;
  }

  if (error && !data) {
    return (
      <Result
        status="error"
        title="仪表盘加载失败"
        subTitle={error}
        extra={
          <Button type="primary" onClick={handleRetry}>
            重新加载
          </Button>
        }
      />
    );
  }

  if (!data) {
    return null;
  }

  const renderRoleSpecificContent = () => {
    switch (data.role) {
      case 'super_admin':
        return (
          <>
            {data.departmentDistribution ? (
              <Card title="部门案件分布" className={styles.sectionCard} bordered={false}>
                <DistributionChart data={data.departmentDistribution} />
              </Card>
            ) : null}
            {data.teamSummary ? (
              <Card title="团队角色概览" className={styles.sectionCard} bordered={false}>
                <Space direction="vertical" size={8} className={styles.teamSummaryWrap}>
                  {data.teamSummary.map((item) => (
                    <div key={item.role} className={styles.teamSummaryRow}>
                      <div className={styles.teamSummaryRole}>
                        <TeamOutlined />
                        <span>{ROLE_LABEL_MAP[item.role]}</span>
                      </div>
                      <span className={styles.teamSummaryValue}>{formatNumber(item.count)}</span>
                    </div>
                  ))}
                </Space>
              </Card>
            ) : null}
            {data.teamMembers ? <TeamList title="核心成员" members={data.teamMembers} /> : null}
          </>
        );
      case 'admin':
        return (
          <>
            {data.statusDistribution ? (
              <Card title="案件状态分布" className={styles.sectionCard} bordered={false}>
                <StatusLegend data={data.statusDistribution} />
              </Card>
            ) : null}
            {data.teamMembers ? <TeamList title="部门成员" members={data.teamMembers} /> : null}
          </>
        );
      case 'administration':
        return (
          <>
            {data.financials ? (
              <FinancialSnapshot
                summary={data.summary}
                receipts={data.financials.latestReceipts}
              />
            ) : null}
            {data.statusDistribution ? (
              <Card title="案件进度情况" className={styles.sectionCard} bordered={false}>
                <StatusLegend data={data.statusDistribution} />
              </Card>
            ) : null}
          </>
        );
      case 'lawyer':
        return (
          <>
            {data.myCases ? <CaseList title="我负责的案件" data={data.myCases} emptyText="暂未分配到您的案件" /> : null}
          </>
        );
      case 'assistant':
        return (
          <>
            {data.myCases ? <CaseList title="我协助的案件" data={data.myCases} emptyText="暂无协助中的案件" /> : null}
            {data.statusDistribution ? (
              <Card title="案件状态快照" className={styles.sectionCard} bordered={false}>
                <StatusLegend data={data.statusDistribution} />
              </Card>
            ) : null}
          </>
        );
      case 'sale':
        return data.pipeline ? <PipelineCard data={data.pipeline} /> : null;
      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        {data.warnings.length > 0 ? (
          <Alert
            type="warning"
            showIcon
            message="部分数据暂时不可用"
            description={
              <Space direction="vertical" size={4}>
                {data.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </Space>
            }
          />
        ) : null}

        <Title level={3}>欢迎回来，{currentUser.name ?? currentUser.email}</Title>

        <Row gutter={[16, 16]}>
          {summaryCards.map((cardProps, index) => (
            <Col key={`${cardProps.title}-${index}`} xs={24} sm={12} xl={8} xxl={6}>
              <SummaryCard {...cardProps} />
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <CaseList title="最近更新的案件" data={data.recentCases} emptyText="暂无案件记录" />
          </Col>
          <Col xs={24} xl={8}>
            <EventList title="即将到来的日程" data={data.upcomingEvents} />
          </Col>
        </Row>

        {renderRoleSpecificContent()}

        <div className={styles.footerActions}>
          <Button type="default" onClick={handleRetry}>刷新数据</Button>
        </div>
      </Space>
    </div>
  );
}
