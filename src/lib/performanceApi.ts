// ==============================================================================
// PostEx HR Onboarding Portal — User Performance Tracker API Client (Step 11B)
// ==============================================================================

import { getStaffAccessToken } from './staffAuth';

export interface PerformanceKpi {
  joiners_handled: number;
  total_items: number;
  items_provided: number;
  on_time_items: number;
  on_time_rate: number;
  overdue_items: number;
  open_clearance_forms: number;
  avg_days: number;
  emails_sent: number;
  emails_total: number;
}

export interface PerformanceScorecardRow {
  id: string;
  name: string;
  scope: string;
  joiners_count: number;
  total_items: number;
  items_provided: number;
  on_time_items: number;
  on_time_rate: number;
  overdue_items: number;
  emails_sent: number;
  emails_total: number;
  avg_days: number | null;
  exits_handled?: number;
  exits_completed?: number;
  open_clearance_forms: number;
  flag: string;
  flag_variant: 'neutral' | 'success' | 'warning' | 'error';
  flag_color: string;
}

export interface GetHrPerformanceResponse {
  success: boolean;
  kpi: PerformanceKpi;
  scorecard: {
    officers: PerformanceScorecardRow[];
    zones: PerformanceScorecardRow[];
    branches: PerformanceScorecardRow[];
  };
  error?: string;
}

export interface GetHrPerformanceParams {
  zone?: string;
  branch?: string;
  start_date?: string;
  end_date?: string;
  date_from?: string;
  date_to?: string;
}

async function getPerformanceAuthToken(): Promise<string> {
  const token = getStaffAccessToken();
  return token || '';
}

export async function getHrPerformance(
  params?: GetHrPerformanceParams
): Promise<GetHrPerformanceResponse> {
  const token = await getPerformanceAuthToken();
  const query = new URLSearchParams();
  if (params?.zone) query.set('zone', params.zone);
  if (params?.branch) query.set('branch', params.branch);
  if (params?.start_date || params?.date_from) {
    query.set('start_date', (params.start_date || params.date_from)!);
  }
  if (params?.end_date || params?.date_to) {
    query.set('end_date', (params.end_date || params.date_to)!);
  }

  const queryString = query.toString() ? `?${query.toString()}` : '';
  const res = await fetch(`/api/performance/hr${queryString}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `Failed to fetch HR performance data (HTTP ${res.status})`);
  }
  return data;
}

export const performanceApi = {
  getHrPerformance,
};
