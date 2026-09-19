"use client";

import { useMemo } from "react";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import type { User } from "@/types/api";
import { getChartPalette, CHART_TOOLTIP_STYLE } from "@/lib/chartTheme";

/** Pie chart of users per profile. Loaded via next/dynamic to keep recharts out of the main bundle. */
const ProfileDistributionChart = ({ users }: { users: User[] }) => {
  const chartData = useMemo(() => {
    const profileStats = users.reduce((acc, user) => {
      const profileName = user.profile.profileName;
      acc[profileName] = (acc[profileName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const palette = getChartPalette();
    return Object.entries(profileStats)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], index) => ({
        name,
        value,
        fill: palette[index % palette.length],
      }));
  }, [users]);

  return (
    <div className="h-64 relative">
      <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-50/30 to-purple-50/30 dark:from-primary/10 dark:to-primary/5" />
      <div className="relative z-10 h-full">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsPieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={CHART_TOOLTIP_STYLE}
            />
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ProfileDistributionChart;
