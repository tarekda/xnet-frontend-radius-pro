import React from "react";
import {
  Line as RechartsLine,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RejectTrendPoint } from "./dashboardShared";
import { CHART_COLORS, CHART_TOOLTIP_STYLE } from "@/lib/chartTheme";

type Props = {
  data: RejectTrendPoint[];
  onSelectRejectBucket: (bucket: string) => void;
};

/** Reject-rate mini line chart, split out so recharts can be lazy-loaded. */
const RejectTrendChart: React.FC<Props> = ({ data, onSelectRejectBucket }) => (
  <ResponsiveContainer width="100%" height="100%">
    <RechartsLineChart data={data} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
      <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={20} />
      <YAxis tick={{ fontSize: 10 }} width={28} domain={[0, 100]} />
      <RechartsTooltip
        formatter={(value: number, _name: string, item: any) => {
          const attempts = Number(item?.payload?.attempts ?? 0);
          const rejected = Number(item?.payload?.rejected ?? 0);
          return [`${Number(value).toFixed(1)}%`, `Reject rate (${rejected}/${attempts})`];
        }}
      />
      <RechartsLine
        type="monotone"
        dataKey="rejectRate"
        stroke={CHART_COLORS.quinary}
        strokeWidth={2}
        dot={{ r: 2 }}
        activeDot={{
          r: 5,
          onClick: (_event: any, payload: any) => {
            const bucket = payload?.payload?.bucket;
            if (bucket) onSelectRejectBucket(String(bucket));
          },
          style: { cursor: "pointer" },
        }}
      />
    </RechartsLineChart>
  </ResponsiveContainer>
);

export default RejectTrendChart;
