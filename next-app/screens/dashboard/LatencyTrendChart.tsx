import React from "react";
import {
  Line as RechartsLine,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { NocHealthSample } from "./dashboardShared";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/chartTheme";

type Props = {
  data: NocHealthSample[];
};

/** API health latency mini line chart, split out so recharts can be lazy-loaded. */
const LatencyTrendChart: React.FC<Props> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <RechartsLineChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
      <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={16} />
      <YAxis tick={{ fontSize: 10 }} width={26} />
      <RechartsTooltip contentStyle={CHART_TOOLTIP_STYLE} />
      <RechartsLine type="monotone" dataKey="dbLatencyMs" stroke={CHART_COLORS.primary} strokeWidth={1.5} dot={false} />
      <RechartsLine type="monotone" dataKey="serverProcessingMs" stroke={CHART_COLORS.secondary} strokeWidth={1.5} dot={false} />
      <RechartsLine type="monotone" dataKey="clientRttMs" stroke={CHART_COLORS.quinary} strokeWidth={1.5} dot={false} />
    </RechartsLineChart>
  </ResponsiveContainer>
);

export default LatencyTrendChart;
