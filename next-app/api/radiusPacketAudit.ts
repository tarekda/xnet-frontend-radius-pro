import { apiClient } from "@/api/client";

export type PacketAuditRow = {
  ts: string;
  tsMs: number | null;
  dir: string;
  proto: string;
  srcIp: string;
  srcPort: string;
  dstIp: string;
  dstPort: string;
  code: string;
  framedProto: string;
  nasPortType: string;
  user: string;
  mac: string;
  nas: string;
  nasid: string;
  framed: string;
  sess: string;
  acct: string;
  inOctets: string;
  outOctets: string;
  cause: string;
  rate: string;
  timeout: string;
  result: string;
  raw: string;
};

export type PacketAuditListResponse = {
  available: boolean;
  truncated: boolean;
  filesScanned: number;
  from: string;
  to: string;
  total: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  rows: PacketAuditRow[];
};

export type PacketAuditQuery = {
  from: string;
  to: string;
  user?: string;
  q?: string;
  dir?: string;
  code?: string;
  kind?: string;
  proto?: string;
  srcIp?: string;
  dstIp?: string;
  framed?: string;
  mac?: string;
  nas?: string;
  dstPort?: string;
  page: number;
  pageSize: number;
};

export async function fetchRadiusPacketAudit(params: PacketAuditQuery): Promise<PacketAuditListResponse> {
  const resp = await apiClient.get("/radius-packet-audit", {
    params: {
      from: params.from,
      to: params.to,
      user: params.user || undefined,
      q: params.q || undefined,
      dir: params.dir && params.dir !== "all" ? params.dir : undefined,
      code: params.code && params.code !== "all" ? params.code : undefined,
      kind: params.kind || undefined,
      proto: params.proto || undefined,
      srcIp: params.srcIp || undefined,
      dstIp: params.dstIp || undefined,
      framed: params.framed || undefined,
      mac: params.mac || undefined,
      nas: params.nas || undefined,
      dstPort: params.dstPort || undefined,
      page: params.page,
      pageSize: params.pageSize,
    },
  });
  return (resp?.data?.data ?? {
    available: false,
    truncated: false,
    filesScanned: 0,
    from: params.from,
    to: params.to,
    total: 0,
    totalPages: 1,
    currentPage: params.page,
    pageSize: params.pageSize,
    rows: [],
  }) as PacketAuditListResponse;
}
