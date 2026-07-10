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

type Props = {
  data: NocHealthSample[];
};

/** API health latency mini line chart, split out so recharts can be lazy-loaded. */
const LatencyTrendChart: React.FC<Props> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
    <RechartsLineChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
      <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={16} />
      <YAxis tick={{ fontSize: 10 }} width={26} />
      <RechartsTooltip />
      <RechartsLine type="monotone" dataKey="dbLatencyMs" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
      <RechartsLine type="monotone" dataKey="serverProcessingMs" stroke="#0284c7" strokeWidth={1.5} dot={false} />
      <RechartsLine type="monotone" dataKey="clientRttMs" stroke="#dc2626" strokeWidth={1.5} dot={false} />
    </RechartsLineChart>
  </ResponsiveContainer>
);

export default LatencyTrendChart;
