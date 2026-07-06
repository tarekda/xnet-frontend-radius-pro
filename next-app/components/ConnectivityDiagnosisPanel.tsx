import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, Sparkles, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConnectivityDiagnosis, type DiagnosisSeverity } from "@/hooks/useConnectivityDiagnosis";
import type { User } from "@/types/api";
import { isUserAtRisk } from "@/lib/userHealth";

type UserDetailTab = "overview" | "sessions" | "activity" | "actions";

function severityBadge(severity: DiagnosisSeverity) {
  if (severity === "critical") {
    return (
      <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-400">
        Critical
      </Badge>
    );
  }
  if (severity === "warning") {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
        Warning
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-300">
      OK
    </Badge>
  );
}

function findingIcon(severity: "info" | "warning" | "critical") {
  if (severity === "critical") return <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  if (severity === "warning") return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
  return <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />;
}

function shouldAutoDiagnose(user: User | null | undefined): boolean {
  if (!user) return false;
  const status = String(user.accountStatus ?? "").toLowerCase();
  if (status === "suspended" || status === "expired" || status === "terminated") return true;
  if (!user.isOnline) return true;
  return isUserAtRisk(user);
}

export default function ConnectivityDiagnosisPanel(props: {
  username: string;
  user?: User | null;
  onNavigateTab?: (tab: UserDetailTab) => void;
}) {
  const username = String(props.username ?? "").trim();
  const diagnosis = useConnectivityDiagnosis(username);
  const { mutate, isPending, data: result, isError } = diagnosis;
  const autoRanFor = useRef<string | null>(null);

  useEffect(() => {
    if (!username || !props.user) return;
    if (!shouldAutoDiagnose(props.user)) return;
    if (isPending || result) return;
    if (autoRanFor.current === username) return;

    autoRanFor.current = username;
    mutate();
  }, [username, props.user, isPending, result, mutate]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Connectivity Copilot
          </CardTitle>
          <CardDescription>
            Rule-based diagnosis from RADIUS account state, live session, and recent auth failures. Auto-runs when the user looks at risk.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={!username || isPending}
          onClick={() => mutate()}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Diagnosing…
            </>
          ) : (
            "Diagnose connection"
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            Could not run diagnosis. Check permissions and try again.
          </p>
        ) : null}

        {!result && !isPending && !isError ? (
          <p className="text-sm text-muted-foreground">
            Run a diagnosis when a customer reports they cannot connect — you will get likely causes and suggested next steps.
          </p>
        ) : null}

        {result ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {severityBadge(result.severity)}
              {result.aiEnhanced ? (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI summary
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {new Date(result.generatedAt).toLocaleString()}
              </span>
            </div>

            <p className="text-sm leading-relaxed">{result.summary}</p>

            {result.findings.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Findings</div>
                <ul className="space-y-2">
                  {result.findings.map((f) => (
                    <li key={f.code} className="flex gap-2 text-sm">
                      {findingIcon(f.severity)}
                      <div>
                        <div>{f.message}</div>
                        {f.evidence ? (
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{f.evidence}</div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {result.recommendedActions.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium">Suggested next steps</div>
                <ol className="space-y-2 text-sm">
                  {result.recommendedActions.map((a, idx) => (
                    <li key={a.action} className="flex gap-2">
                      <span className="text-muted-foreground tabular-nums">{idx + 1}.</span>
                      <div className="flex-1">
                        {a.tabHint && props.onNavigateTab ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-left text-primary underline-offset-2 hover:underline"
                            onClick={() => props.onNavigateTab?.(a.tabHint as UserDetailTab)}
                          >
                            {a.description}
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                          </button>
                        ) : (
                          <span>{a.description}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-border/60 text-xs">
              <div>
                <div className="text-muted-foreground">Online</div>
                <div className="font-medium">{result.context.isOnline ? "Yes" : "No"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Recent rejects</div>
                <div className="font-medium">{result.context.recentRejectCount}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Monthly quota</div>
                <div className="font-medium">
                  {result.context.isMonthlyExceeded
                    ? "Exceeded"
                    : result.context.monthlyUsagePct != null
                      ? `${result.context.monthlyUsagePct}%`
                      : "—"}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Live IP</div>
                <div className="font-mono font-medium truncate">
                  {result.context.liveSession?.framedIpAddress ?? "—"}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
