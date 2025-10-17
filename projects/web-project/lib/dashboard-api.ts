import { apiFetch } from './api-client';
import type { UserRole } from './users-api';

export type MetricPeriod = 'daily' | 'weekly' | 'monthly';

export interface MetricSeries {
  period: MetricPeriod;
  current: number;
  previous: number;
  changeRatio: number;
  comparisonLabel: string;
  comparisonTarget: string;
}

export interface MetricCard {
  key: string;
  label: string;
  unit: string;
  description?: string;
  series: MetricSeries[];
}

export interface RevenueInsight {
  amount: number;
  currency: string;
  note?: string;
  trend?: number;
}

export interface HighlightItem {
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export interface DashboardOverviewResponse {
  role: UserRole;
  metrics: MetricCard[];
  revenueToday: RevenueInsight;
  highlights?: HighlightItem[];
  generatedAt: string;
}

export async function fetchDashboardOverview(): Promise<DashboardOverviewResponse> {
  return apiFetch<DashboardOverviewResponse>('/api/dashboard/overview');
}
