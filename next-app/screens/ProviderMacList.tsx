"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CloudDownload, Download, Network, RefreshCw } from "lucide-react";
import {
  fetchProviderMacList,
  fetchProviderMacOptions,
  syncProviderMacAddresses,
} from "@/api/invoices";
import PageHeader from "@/components/PageHeader";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { downloadTextFile, toCsv } from "@/lib/csv";
import { notify } from "@/lib/notify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function currentBillingMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function safeFilePart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warning";
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={tone === "warning" ? "mt-1 text-2xl font-bold text-amber-600" : "mt-1 text-2xl font-bold"}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

export default function ProviderMacListPage() {
  const { user } = useAuth();
  const hasAccess =
    can(user, "billing.invoiceUpload.create") && can(user, "users.view");
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth);
  const [provider, setProvider] = useState("");

  const providersQuery = useQuery({
    queryKey: ["invoice-provider-mac-options", billingMonth],
    queryFn: () => fetchProviderMacOptions(billingMonth),
    enabled: hasAccess && Boolean(billingMonth),
  });

  const providers = providersQuery.data ?? [];
  useEffect(() => {
    if (!providers.length) {
      setProvider("");
      return;
    }
    if (!providers.includes(provider)) setProvider(providers[0]);
  }, [provider, providers]);

  const macQuery = useQuery({
    queryKey: ["invoice-provider-macs", provider, billingMonth],
    queryFn: () => fetchProviderMacList(provider, billingMonth),
    enabled: hasAccess && Boolean(provider && billingMonth),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncProviderMacAddresses(provider, billingMonth),
    onSuccess: async (result) => {
      const uniqueMacs = result.macAddresses?.length ?? result.providerMacs;
      macQuery.refetch();
      notify.success(
        "MAC addresses synchronized",
        `${result.providerMacs} provider user(s) with MAC (${uniqueMacs} unique); ${result.matchedSubscribers} invoice subscriber(s) matched; ${result.updatedInvoiceRows} invoice row(s) updated.`
      );
    },
    onError: (error: any) => {
      notify.error(
        "MAC synchronization failed",
        error?.response?.data?.message || error?.message || "Unable to fetch MAC addresses from the provider."
      );
    },
  });

  const supportsLiveSync = ["myisp", "myisp2", "idm", "terra"].includes(provider);

  const filenameBase = useMemo(
    () => `${safeFilePart(provider || "provider")}-mac-addresses-${billingMonth}`,
    [billingMonth, provider]
  );

  const downloadCsv = () => {
    const content = toCsv(
      (macQuery.data?.macAddresses ?? []).map((macAddress) => ({
        mac_address: macAddress,
      })),
      ["mac_address"]
    );
    downloadTextFile(`${filenameBase}.csv`, content, "text/csv;charset=utf-8");
  };

  const downloadTxt = () => {
    const content = `${(macQuery.data?.macAddresses ?? []).join("\r\n")}\r\n`;
    downloadTextFile(`${filenameBase}.txt`, content);
  };

  if (!hasAccess) {
    return (
      <div className="w-full space-y-6 p-6">
        <PageHeader
          title="Provider MAC Lists"
          subtitle="Export subscriber MAC addresses by imported provider"
          icon={Network}
        />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You need both invoice-import and user-view permissions to access provider MAC lists.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Provider MAC Lists"
        subtitle="View and download unique MAC addresses from a provider billing import"
        icon={Network}
      />

      <Card>
        <CardHeader>
          <CardTitle>Select provider import</CardTitle>
          <CardDescription>
            For IDM / Terra / MyISP, MAC lists are pulled from active provider users with a MAC.
            Sync also writes matching values onto this month&apos;s imported invoice rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="provider-mac-month">Billing month</Label>
            <Input
              id="provider-mac-month"
              type="month"
              value={billingMonth}
              onChange={(event) => setBillingMonth(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select
              value={provider}
              onValueChange={setProvider}
              disabled={providersQuery.isLoading || providers.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={providersQuery.isLoading ? "Loading providers…" : "No providers found"}
                />
              </SelectTrigger>
              <SelectContent>
                {providers.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {providersQuery.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Provider imports could not be loaded.
          </CardContent>
        </Card>
      ) : null}

      {provider && macQuery.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric
              label={supportsLiveSync ? "Provider users w/ MAC" : "Subscribers"}
              value={macQuery.data.stats.totalSubscribers}
            />
            <Metric label="Assigned MACs" value={macQuery.data.stats.withMac} />
            <Metric label="Unique MACs" value={macQuery.data.stats.uniqueMacs} />
            <Metric label="Missing MAC" value={macQuery.data.stats.missingMac} tone="warning" />
            <Metric label="Invalid MAC" value={macQuery.data.stats.invalidMac} tone="warning" />
          </div>

          <Card>
            <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {provider.toUpperCase()} MAC addresses
                  <Badge variant="secondary">{billingMonth}</Badge>
                </CardTitle>
                <CardDescription>
                  Valid addresses are normalized and duplicates are removed automatically.
                  {macQuery.data.stats.duplicateAssignments
                    ? ` ${macQuery.data.stats.duplicateAssignments} duplicate assignment(s) were removed.`
                    : ""}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {supportsLiveSync ? (
                  <Button
                    onClick={() => syncMutation.mutate()}
                    disabled={syncMutation.isPending || !billingMonth}
                  >
                    <CloudDownload
                      className={`h-4 w-4 ${syncMutation.isPending ? "animate-pulse" : ""}`}
                    />
                    {syncMutation.isPending ? "Syncing…" : "Sync from provider"}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => macQuery.refetch()}
                  disabled={macQuery.isFetching}
                >
                  <RefreshCw className={`h-4 w-4 ${macQuery.isFetching ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadTxt}
                  disabled={macQuery.data.macAddresses.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Download TXT
                </Button>
                <Button
                  onClick={downloadCsv}
                  disabled={macQuery.data.macAddresses.length === 0}
                >
                  <Download className="h-4 w-4" />
                  Download CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {macQuery.data.macAddresses.length ? (
                <div className="max-h-[60vh] overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="w-20">#</TableHead>
                        <TableHead>MAC address</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {macQuery.data.macAddresses.map((macAddress, index) => (
                        <TableRow key={macAddress}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-mono text-base">{macAddress}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No valid MAC addresses were found for this provider and month.
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : provider && macQuery.isLoading ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Loading MAC addresses…
          </CardContent>
        </Card>
      ) : provider && macQuery.isError ? (
        <Card className="border-destructive/40">
          <CardContent className="p-6 text-sm text-destructive">
            MAC addresses could not be loaded.
          </CardContent>
        </Card>
      ) : !providersQuery.isLoading && providers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No provider invoices were imported for {billingMonth}.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
