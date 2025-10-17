import { and, eq, gte, lt, sql, type SQL } from 'drizzle-orm';
import { Router } from 'express';

import { db } from '../db/client';
import { caseLawyers, cases, clients, type UserRole } from '../db/schema';

import { requireCurrentUser } from './utils/current-user';

const router = Router();

const PERIOD_ORDER = ['daily', 'weekly', 'monthly'] as const;
type MetricPeriod = (typeof PERIOD_ORDER)[number];

interface PeriodWindow {
  start: Date;
  end: Date;
  label: string;
}

interface PeriodConfig {
  current: PeriodWindow;
  previous: PeriodWindow;
}

interface MetricSeries {
  period: MetricPeriod;
  current: number;
  previous: number;
  changeRatio: number;
  comparisonLabel: string;
  comparisonTarget: string;
}

interface MetricCard {
  key: string;
  label: string;
  unit: string;
  description?: string;
  series: MetricSeries[];
}

interface RevenueToday {
  amount: number;
  currency: string;
  note?: string;
  trend?: number;
}

interface HighlightItem {
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

interface OverviewResponse {
  role: UserRole;
  metrics: MetricCard[];
  revenueToday: RevenueToday;
  highlights?: HighlightItem[];
  generatedAt: string;
}

const startOfDay = (input: Date) => {
  const date = new Date(input);
  date.setHours(0, 0, 0, 0);
  return date;
};

const addDays = (input: Date, amount: number) => {
  const date = new Date(input);
  date.setDate(date.getDate() + amount);
  return date;
};

const startOfWeek = (input: Date) => {
  const date = startOfDay(input);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday as first day of week
  return addDays(date, -diff);
};

const startOfMonth = (input: Date) => {
  const date = startOfDay(input);
  date.setDate(1);
  return date;
};

const addMonths = (input: Date, amount: number) => {
  const date = new Date(input);
  date.setMonth(date.getMonth() + amount);
  return date;
};

const combineWhere = (conditions: Array<SQL | undefined>) => {
  const filtered = conditions.filter((item): item is SQL => Boolean(item));
  if (filtered.length === 0) {
    return undefined;
  }
  if (filtered.length === 1) {
    return filtered[0];
  }
  return and(...(filtered as [SQL, SQL, ...SQL[]]));
};

const calculateChangeRatio = (current: number, previous: number) => {
  if (previous === 0) {
    if (current === 0) {
      return 0;
    }
    return 1;
  }
  return (current - previous) / previous;
};

const formatTrendLabel = (changeRatio: number) => {
  if (changeRatio === 0) {
    return '保持稳定';
  }
  const percent = Math.abs(changeRatio * 100).toFixed(1);
  return changeRatio > 0 ? `上涨 ${percent}%` : `下降 ${percent}%`;
};

const countNewCases = async (start: Date, end: Date, extra: SQL[] = []) => {
  const where = combineWhere([gte(cases.createdAt, start), lt(cases.createdAt, end), ...extra]);
  const query = db.select({ value: sql<number>`count(*)::int` }).from(cases);
  const rows = await (where ? query.where(where) : query);
  return rows[0]?.value ?? 0;
};

const countClosedCases = async (start: Date, end: Date, extra: SQL[] = []) => {
  const where = combineWhere([
    eq(cases.status, 'closed'),
    gte(cases.updatedAt, start),
    lt(cases.updatedAt, end),
    ...extra
  ]);
  const query = db.select({ value: sql<number>`count(*)::int` }).from(cases);
  const rows = await (where ? query.where(where) : query);
  return rows[0]?.value ?? 0;
};

const countNewClients = async (start: Date, end: Date, maintainerId?: string) => {
  const where = combineWhere([
    gte(clients.createdAt, start),
    lt(clients.createdAt, end),
    maintainerId ? eq(clients.maintainerId, maintainerId) : undefined
  ]);
  const query = db.select({ value: sql<number>`count(*)::int` }).from(clients);
  const rows = await (where ? query.where(where) : query);
  return rows[0]?.value ?? 0;
};

const countAssignedCasesByCreatedAt = async (userId: string, start: Date, end: Date) => {
  const where = combineWhere([
    eq(caseLawyers.lawyerId, userId),
    gte(cases.createdAt, start),
    lt(cases.createdAt, end)
  ]);
  const query = db
    .select({ value: sql<number>`count(distinct ${cases.id})::int` })
    .from(cases)
    .innerJoin(caseLawyers, eq(caseLawyers.caseId, cases.id));
  const rows = await (where ? query.where(where) : query);
  return rows[0]?.value ?? 0;
};

const countAssignedClosedCases = async (userId: string, start: Date, end: Date) => {
  const where = combineWhere([
    eq(caseLawyers.lawyerId, userId),
    eq(cases.status, 'closed'),
    gte(cases.updatedAt, start),
    lt(cases.updatedAt, end)
  ]);
  const query = db
    .select({ value: sql<number>`count(distinct ${cases.id})::int` })
    .from(cases)
    .innerJoin(caseLawyers, eq(caseLawyers.caseId, cases.id));
  const rows = await (where ? query.where(where) : query);
  return rows[0]?.value ?? 0;
};

const buildPeriodConfigs = (now: Date): Record<MetricPeriod, PeriodConfig> => {
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const yesterdayStart = addDays(todayStart, -1);

  const weekStart = startOfWeek(todayStart);
  const nextWeekStart = addDays(weekStart, 7);
  const previousWeekStart = addDays(weekStart, -7);

  const monthStart = startOfMonth(todayStart);
  const nextMonthStart = addMonths(monthStart, 1);
  const previousMonthStart = addMonths(monthStart, -1);

  return {
    daily: {
      current: { start: todayStart, end: tomorrowStart, label: '今日' },
      previous: { start: yesterdayStart, end: todayStart, label: '昨日' }
    },
    weekly: {
      current: { start: weekStart, end: nextWeekStart, label: '本周' },
      previous: { start: previousWeekStart, end: weekStart, label: '上周' }
    },
    monthly: {
      current: { start: monthStart, end: nextMonthStart, label: '本月' },
      previous: { start: previousMonthStart, end: monthStart, label: '上月' }
    }
  };
};

const buildSeries = async (
  periodConfigs: Record<MetricPeriod, PeriodConfig>,
  counter: (start: Date, end: Date) => Promise<number>
): Promise<MetricSeries[]> => {
  return Promise.all(
    PERIOD_ORDER.map(async (period) => {
      const config = periodConfigs[period];
      const [current, previous] = await Promise.all([
        counter(config.current.start, config.current.end),
        counter(config.previous.start, config.previous.end)
      ]);
      return {
        period,
        current,
        previous,
        changeRatio: calculateChangeRatio(current, previous),
        comparisonLabel: '环比',
        comparisonTarget: config.previous.label
      };
    })
  );
};

const buildHighlights = (metrics: MetricCard[]): HighlightItem[] => {
  const highlights: HighlightItem[] = [];
  const weeklyNewCases = metrics.find((item) => item.key === 'newCases')?.series.find((series) => series.period === 'weekly');
  if (weeklyNewCases) {
    highlights.push({
      title: '案件增长趋势',
      description: `本周新增案件 ${weeklyNewCases.current} 件，相比${weeklyNewCases.comparisonTarget}${formatTrendLabel(weeklyNewCases.changeRatio)}。`
    });
  }
  const weeklyClients = metrics.find((item) => item.key === 'newClients')?.series.find((series) => series.period === 'weekly');
  if (weeklyClients) {
    highlights.push({
      title: '客户拓展情况',
      description: `本周新增客户 ${weeklyClients.current} 位，相比${weeklyClients.comparisonTarget}${formatTrendLabel(weeklyClients.changeRatio)}。`,
      action: {
        label: '查看客户列表',
        href: '/clients/my'
      }
    });
  }
  return highlights;
};

const buildPersonalHighlights = (role: UserRole, metrics: MetricCard[]): HighlightItem[] => {
  const highlights: HighlightItem[] = [];
  const weeklyAssigned = metrics.find((item) => item.key === 'myAssignedCases')?.series.find((series) => series.period === 'weekly');
  if (weeklyAssigned) {
    highlights.push({
      title: '本周案件动向',
      description: `你本周接手 ${weeklyAssigned.current} 件案件，相比${weeklyAssigned.comparisonTarget}${formatTrendLabel(weeklyAssigned.changeRatio)}。`,
      action: {
        label: '前往案件列表',
        href: '/cases/my'
      }
    });
  }
  const weeklyClients = metrics.find((item) => item.key === 'myNewClients')?.series.find((series) => series.period === 'weekly');
  if (weeklyClients && role === 'sale') {
    highlights.push({
      title: '客户跟进提醒',
      description: `你本周新增客户 ${weeklyClients.current} 位，相比${weeklyClients.comparisonTarget}${formatTrendLabel(weeklyClients.changeRatio)}。`,
      action: {
        label: '查看我的客户',
        href: '/clients/my'
      }
    });
  }
  return highlights;
};

router.get('/overview', async (req, res, next) => {
  try {
  const user = await requireCurrentUser(req);
    const now = new Date();
    const periodConfigs = buildPeriodConfigs(now);

    let metrics: MetricCard[] = [];
    let highlights: HighlightItem[] | undefined;
  const revenueToday: RevenueToday = {
      amount: 126_500,
      currency: 'CNY',
      note: '预估值，含固定服务费与待确认回款',
      trend: 0.08
    };

    if (user.role === 'master' || user.role === 'admin') {
      const [newCasesSeries, closedCasesSeries, newClientsSeries] = await Promise.all([
        buildSeries(periodConfigs, (start, end) => countNewCases(start, end)),
        buildSeries(periodConfigs, (start, end) => countClosedCases(start, end)),
        buildSeries(periodConfigs, (start, end) => countNewClients(start, end))
      ]);

      metrics = [
        {
          key: 'newCases',
          label: '新增案件',
          unit: '件',
          description: '按创建时间统计',
          series: newCasesSeries
        },
        {
          key: 'closedCases',
          label: '已结案案件',
          unit: '件',
          description: '按结案更新时间统计',
          series: closedCasesSeries
        },
        {
          key: 'newClients',
          label: '新增客户',
          unit: '位',
          series: newClientsSeries
        }
      ];

      highlights = buildHighlights(metrics);
    } else {
      const [assignedSeries, closedSeries, newClientSeries] = await Promise.all([
        buildSeries(periodConfigs, (start, end) => countAssignedCasesByCreatedAt(user.id, start, end)),
        buildSeries(periodConfigs, (start, end) => countAssignedClosedCases(user.id, start, end)),
        user.role === 'sale' ? buildSeries(periodConfigs, (start, end) => countNewClients(start, end, user.id)) : Promise.resolve([] as MetricSeries[])
      ]);

      metrics = [
        {
          key: 'myAssignedCases',
          label: '我负责的新增案件',
          unit: '件',
          series: assignedSeries
        },
        {
          key: 'myClosedCases',
          label: '我结案的案件',
          unit: '件',
          series: closedSeries
        }
      ];

      if (user.role === 'sale') {
        metrics.push({
          key: 'myNewClients',
          label: '我拓展的客户',
          unit: '位',
          series: newClientSeries
        });
      }

      highlights = buildPersonalHighlights(user.role, metrics);
    }

    const response: OverviewResponse = {
      role: user.role,
      metrics,
      revenueToday,
      highlights,
      generatedAt: now.toISOString()
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
