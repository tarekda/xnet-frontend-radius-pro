import { useQuery } from "@tanstack/react-query";
import { fetchRadiusPacketAudit, type PacketAuditListResponse, type PacketAuditQuery } from "@/api/radiusPacketAudit";

export function useRadiusPacketAudit(params: PacketAuditQuery, enabled = true) {
  return useQuery<PacketAuditListResponse, Error>({
    queryKey: ["radius-packet-audit", params],
    queryFn: () => fetchRadiusPacketAudit(params),
    enabled,
  });
}
