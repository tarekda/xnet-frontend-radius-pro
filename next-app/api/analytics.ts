import { apiClient } from "./client";

export interface MonthlyRevenueTrend {
  month: string;
  invoiced: number;
  collected: number;
  expenses: number;
  netProfit: number;
}

export interface RevenueStatusBreakdown {
  status: string;
  count: number;
  totalAmount: number;
  color: string;
}

export interface TopSpender {
  username: string;
  fullName: string;
  invoicesCount: number;
  totalBilled: number;
  totalPaid: number;
}

export interface RevenueInsightsDto {
  summary: {
    grossInvoiced: number;
    collectedCash: number;
    outstandingDue: number;
    totalExpenses: number;
    netMargin: number;
    marginPct: number;
    collectionRate: number;
    activeSubscribers: number;
    arpu: number;
  };
  monthlyTrends: MonthlyRevenueTrend[];
  statusBreakdown: RevenueStatusBreakdown[];
  topSpenders: TopSpender[];
}

export async function fetchRevenueInsights(months = 6): Promise<RevenueInsightsDto> {
  const { data } = await apiClient.get("/analytics/revenue", { params: { months } });
  return (data?.data ?? data) as RevenueInsightsDto;
}
