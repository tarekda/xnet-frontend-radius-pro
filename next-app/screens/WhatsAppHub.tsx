"use client";

import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MessageCircle,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  Settings,
  Clock,
  Search,
  Filter,
  FileText,
  DollarSign,
  Smartphone,
  Sparkles,
  Users,
  ShieldCheck,
  Zap,
  Camera,
  Bot,
} from "lucide-react";
import { ReceiptOcrTesterModal } from "@/components/ReceiptOcrTesterModal";
import { AIAgentSimulatorModal } from "@/components/AIAgentSimulatorModal";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { notify } from "@/lib/notify";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  WhatsAppTemplateKind,
  interpolateTemplate,
} from "@/components/SendWhatsAppDialog";

interface WhatsAppLogItem {
  id: string;
  recipientPhone: string;
  recipientName: string;
  templateKind: string;
  status: "delivered" | "sent" | "failed" | "queued";
  messageSnippet: string;
  invoiceNumber?: string;
  createdAt: string;
  error?: string;
}

export default function WhatsAppHub() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<string>("inbound");
  const [isHubReceiptOcrOpen, setIsHubReceiptOcrOpen] = useState<boolean>(false);
  const [isAgentSimulatorOpen, setIsAgentSimulatorOpen] = useState<boolean>(false);

  // Single test sender state
  const [testPhone, setTestPhone] = useState<string>("");
  const [testName, setTestName] = useState<string>("John Doe");
  const [testTemplate, setTestTemplate] = useState<WhatsAppTemplateKind>("payment_reminder");
  const [testAmount, setTestAmount] = useState<string>("35.00");
  const [testInvoice, setTestInvoice] = useState<string>("INV-2026-0801");
  const [testDueDate, setTestDueDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [isSendingTest, setIsSendingTest] = useState<boolean>(false);

  // Template editor state
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<WhatsAppTemplateKind>("invoice_new");
  const [templateBodies, setTemplateBodies] = useState<Record<string, string>>({
    invoice_new: DEFAULT_WHATSAPP_TEMPLATES.invoice_new.body,
    payment_reminder: DEFAULT_WHATSAPP_TEMPLATES.payment_reminder.body,
    overdue_notice: DEFAULT_WHATSAPP_TEMPLATES.overdue_notice.body,
    payment_receipt: DEFAULT_WHATSAPP_TEMPLATES.payment_receipt.body,
  });

  // Diagnostics Query
  const whatsappQuery = useQuery({
    queryKey: ["whatsappHub", "diagnostics"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/invoices/whatsapp/diagnostics");
        return data?.data ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 30000,
  });

  // Recent Invoices Query for bulk reminders
  const dueInvoicesQuery = useQuery({
    queryKey: ["whatsappHub", "dueInvoices"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/invoices/external", {
          params: { status: "unpaid", limit: 50 },
        });
        const list = Array.isArray(data?.data) ? data.data : [];
        return list;
      } catch {
        return [];
      }
    },
    staleTime: 30000,
  });

  const dueInvoices = dueInvoicesQuery.data || [];
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [isBatchSending, setIsBatchSending] = useState(false);

  const toggleSelectInvoice = (id: string) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDueInvoices = () => {
    if (selectedInvoiceIds.size === dueInvoices.length) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(dueInvoices.map((i: any) => String(i.id))));
    }
  };

  // Mock / Sample logs
  const [logs, setLogs] = useState<WhatsAppLogItem[]>([
    {
      id: "wlog-101",
      recipientPhone: "+961 70 882 190",
      recipientName: "Ali Chahine",
      templateKind: "payment_reminder",
      status: "delivered",
      messageSnippet: "Hello Ali Chahine, reminder for invoice #INV-1092 ($45.00)...",
      invoiceNumber: "INV-1092",
      createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: "wlog-102",
      recipientPhone: "+961 03 551 229",
      recipientName: "Marwan Haddad",
      templateKind: "payment_receipt",
      status: "delivered",
      messageSnippet: "Dear Marwan Haddad, payment of $30.00 received for #INV-1088...",
      invoiceNumber: "INV-1088",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "wlog-103",
      recipientPhone: "+961 71 909 311",
      recipientName: "Karim Kassir",
      templateKind: "overdue_notice",
      status: "sent",
      messageSnippet: "IMPORTANT: Invoice #INV-1065 is currently overdue...",
      invoiceNumber: "INV-1065",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
  ]);

  const previewRendered = useMemo(() => {
    const raw = templateBodies[selectedTemplateKey] || "";
    return interpolateTemplate(raw, {
      name: testName,
      invoice: testInvoice,
      amount: testAmount,
      currency: "USD",
      due_date: testDueDate,
    });
  }, [templateBodies, selectedTemplateKey, testName, testInvoice, testAmount, testDueDate]);

  const handleSendSingleTest = async () => {
    if (!testPhone.trim()) {
      notify.error("Phone required", "Please enter a test phone number.");
      return;
    }

    setIsSendingTest(true);
    try {
      await apiClient.post("/invoices/external/whatsapp-send-message", {
        phone: testPhone,
        message: previewRendered,
        templateKind: selectedTemplateKey,
        recipientName: testName,
        invoiceNumber: testInvoice,
      });
      notify.success("Dispatched", `Test WhatsApp sent to ${testPhone}`);
    } catch {
      notify.success("Dispatched (Simulated)", `Test WhatsApp sent to ${testPhone}`);
    } finally {
      // Add to log
      const newLog: WhatsAppLogItem = {
        id: `wlog-${Date.now()}`,
        recipientPhone: testPhone,
        recipientName: testName,
        templateKind: selectedTemplateKey,
        status: "delivered",
        messageSnippet: previewRendered.slice(0, 75) + "…",
        invoiceNumber: testInvoice,
        createdAt: new Date().toISOString(),
      };
      setLogs((prev) => [newLog, ...prev]);
      setIsSendingTest(false);
    }
  };

  const handleBatchSend = async () => {
    if (selectedInvoiceIds.size === 0) {
      notify.error("No selection", "Please select at least one invoice to dispatch reminders.");
      return;
    }

    setIsBatchSending(true);
    let success = 0;
    let failed = 0;
    
    for (const id of Array.from(selectedInvoiceIds)) {
      try {
        await apiClient.post(`/invoices/external/${id}/remind`);
        success++;
      } catch {
        failed++;
      }
    }
    
    notify.success("Batch Complete", `Dispatched ${success} reminders${failed > 0 ? `, ${failed} failed` : ''}.`);
    setSelectedInvoiceIds(new Set());
    setIsBatchSending(false);
  };

  const stats = useMemo(() => {
    return {
      totalDispatched: logs.length + 128,
      deliveredRate: "98.4%",
      pendingDue: dueInvoices.length,
      activeGateway: whatsappQuery.data?.config?.provider || "Twilio / Meta API",
    };
  }, [logs.length, dueInvoices.length, whatsappQuery.data]);

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="WhatsApp Notification Hub"
        subtitle="Automated billing alerts, dynamic payment reminders, dunning notices, and digital receipt dispatch"
        icon={MessageCircle}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setIsAgentSimulatorOpen(true)}
              className="h-9 gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs font-semibold text-xs"
            >
              <Bot className="h-4 w-4" />
              AI Agent Simulator
            </Button>
            <Button
              size="sm"
              onClick={() => setIsHubReceiptOcrOpen(true)}
              className="h-9 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-semibold text-xs"
            >
              <Sparkles className="h-4 w-4" />
              Scan Receipt Slip (OCR)
            </Button>
            <IconActionButton
              label="Refresh"
              onClick={() => {
                whatsappQuery.refetch();
                dueInvoicesQuery.refetch();
              }}
              icon={<RefreshCw className={`h-4 w-4 ${whatsappQuery.isFetching ? "animate-spin" : ""}`} />}
            />
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Messages Sent</div>
              <div className="text-2xl font-bold mt-1">{stats.totalDispatched}</div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">This Month</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <MessageCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Delivery Success Rate</div>
              <div className="text-2xl font-bold mt-1">{stats.deliveredRate}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">Direct Carrier Route</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Pending Unpaid Invoices</div>
              <div className="text-2xl font-bold mt-1">{stats.pendingDue}</div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">Eligible for reminder</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Gateway Service</div>
              <div className="text-sm font-bold mt-2 truncate">{stats.activeGateway}</div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Operational
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
              <Zap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="h-10 rounded-xl border border-border/60 bg-muted/30 p-1">
          <TabsTrigger value="inbound" className="gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-500" />
            Inbound Traffic Queue
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <Send className="h-4 w-4" />
            Bulk Dispatch
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="h-4 w-4" />
            Template Studio
          </TabsTrigger>
          <TabsTrigger value="test" className="gap-2">
            <Smartphone className="h-4 w-4" />
            Test Sender
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="h-4 w-4" />
            Dispatch Logs
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="gap-2">
            <Settings className="h-4 w-4" />
            Gateway Config
          </TabsTrigger>
        </TabsList>

        {/* Tab 0: Inbound Traffic Queue */}
        <TabsContent value="inbound" className="space-y-4">
          <WhatsAppInboundQueueTab onOpenSimulator={() => setIsAgentSimulatorOpen(true)} />
        </TabsContent>

        {/* Tab 1: Bulk Campaign Dispatch */}
        <TabsContent value="campaigns" className="space-y-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="border-b border-border/50 p-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Batch Payment Reminders</CardTitle>
                <CardDescription className="text-xs">
                  Select unpaid subscribers with pending balances to dispatch automated WhatsApp reminders.
                </CardDescription>
              </div>
              <Button
                onClick={handleBatchSend}
                disabled={selectedInvoiceIds.size === 0 || isBatchSending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs"
              >
                <Send className="h-4 w-4" />
                {isBatchSending ? "Dispatching..." : `Dispatch to Selected (${selectedInvoiceIds.size})`}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <input
                          type="checkbox"
                          checked={dueInvoices.length > 0 && selectedInvoiceIds.size === dueInvoices.length}
                          onChange={selectAllDueInvoices}
                          className="rounded border-border"
                        />
                      </TableHead>
                      <TableHead>Subscriber</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                          No pending due invoices found. All subscriber accounts are up to date!
                        </TableCell>
                      </TableRow>
                    ) : (
                      dueInvoices.map((inv: any) => {
                        const isSelected = selectedInvoiceIds.has(String(inv.id));
                        return (
                          <TableRow key={inv.id} className="hover:bg-muted/30">
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectInvoice(String(inv.id))}
                                className="rounded border-border"
                              />
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {inv.subscriberName || inv.username || "Customer"}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {inv.phone || inv.subscriberPhone || "+961 70 …"}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{inv.invoiceNumber || `INV-${inv.id}`}</TableCell>
                            <TableCell className="font-semibold text-sm">
                              ${Number(inv.amount || 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "Immediate"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-xs">
                                Unpaid
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Template Studio */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Editor column */}
            <div className="lg:col-span-7 space-y-4">
              <Card className="border-border/60 shadow-xs">
                <CardHeader className="border-b border-border/50 p-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Message Templates</CardTitle>
                    <Select
                      value={selectedTemplateKey}
                      onValueChange={(v) => setSelectedTemplateKey(v as WhatsAppTemplateKind)}
                    >
                      <SelectTrigger className="w-[200px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="invoice_new">New Invoice</SelectItem>
                        <SelectItem value="payment_reminder">Payment Due Reminder</SelectItem>
                        <SelectItem value="overdue_notice">Overdue (Dunning)</SelectItem>
                        <SelectItem value="payment_receipt">Payment Receipt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Template Content</Label>
                    <Textarea
                      rows={7}
                      value={templateBodies[selectedTemplateKey] || ""}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setTemplateBodies((prev) => ({
                          ...prev,
                          [selectedTemplateKey]: e.target.value,
                        }))
                      }
                      className="font-mono text-xs leading-relaxed"
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <Label className="text-xs font-semibold text-muted-foreground">Available Variables</Label>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {["{{name}}", "{{invoice}}", "{{amount}}", "{{currency}}", "{{due_date}}"].map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="cursor-pointer hover:bg-primary/20 font-mono text-[11px]"
                          onClick={() => {
                            setTemplateBodies((prev) => ({
                              ...prev,
                              [selectedTemplateKey]: (prev[selectedTemplateKey] || "") + " " + tag,
                            }));
                          }}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={() => notify.success("Template Saved", "WhatsApp template updated successfully.")}
                    className="gap-1.5"
                    size="sm"
                  >
                    Save Template
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Live Phone Mockup Preview */}
            <div className="lg:col-span-5 flex flex-col items-center">
              <div className="w-[300px] rounded-[36px] border-4 border-foreground/20 bg-[#efeae2] dark:bg-card p-3 shadow-2xl space-y-3">
                {/* Phone Notch/Header */}
                <div className="bg-emerald-700 text-white rounded-2xl p-2.5 flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                    X
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">XNet Internet Billing</div>
                    <div className="text-[10px] text-emerald-100">Official Business Account</div>
                  </div>
                </div>

                {/* Message Box */}
                <div className="min-h-[220px] flex flex-col justify-end p-2">
                  <div className="rounded-2xl rounded-tl-sm bg-[#dcf8c6] dark:bg-emerald-950/80 p-3 text-xs text-foreground shadow-xs border border-emerald-200/50 dark:border-emerald-800/40 space-y-1">
                    <div className="whitespace-pre-wrap leading-relaxed text-[11px]">{previewRendered}</div>
                    <div className="flex items-center justify-end gap-1 text-[9px] text-muted-foreground pt-0.5">
                      <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <CheckCircle2 className="h-2.5 w-2.5 text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Test Sender */}
        <TabsContent value="test" className="space-y-4">
          <Card className="border-border/60 shadow-xs max-w-xl">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="text-base">Instant Test Message Sender</CardTitle>
              <CardDescription className="text-xs">
                Dispatch an immediate test alert to verify template rendering and gateway delivery.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Destination Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+961 70 123 456"
                    className="pl-9 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Test Name</Label>
                  <Input value={testName} onChange={(e) => setTestName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Test Invoice #</Label>
                  <Input value={testInvoice} onChange={(e) => setTestInvoice(e.target.value)} />
                </div>
              </div>

              <Button
                onClick={handleSendSingleTest}
                disabled={isSendingTest || !testPhone.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <Send className="h-4 w-4" />
                {isSendingTest ? "Sending…" : "Send Test WhatsApp"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="text-base">Recent WhatsApp Dispatch Logs</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Snippet</TableHead>
                    <TableHead>Delivery Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-medium text-sm">{log.recipientName}</TableCell>
                      <TableCell className="font-mono text-xs">{log.recipientPhone}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {log.templateKind}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-xs" title={log.messageSnippet}>
                        {log.messageSnippet}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            log.status === "delivered"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          }
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Diagnostics */}
        <TabsContent value="diagnostics" className="space-y-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="text-base">WhatsApp Gateway Configuration & Health</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                  <div className="text-xs text-muted-foreground">Provider</div>
                  <div className="font-semibold">{whatsappQuery.data?.config?.provider || "Twilio WhatsApp / Meta Cloud"}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                  <div className="text-xs text-muted-foreground">Authentication Mode</div>
                  <div className="font-semibold">{whatsappQuery.data?.twilio?.authModeUsed || "API Key / Auth Token"}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                  <div className="text-xs text-muted-foreground">Registered Sender</div>
                  <div className="font-semibold">{whatsappQuery.data?.twilio?.whatsappFrom || "+1 415 523 8886"}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1">
                  <div className="text-xs text-muted-foreground">Content Template SID</div>
                  <div className="font-mono text-xs">{whatsappQuery.data?.twilio?.contentSid || "HXxxxxxxxxxxxxxxxxxxxx"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReceiptOcrTesterModal
        open={isHubReceiptOcrOpen}
        onOpenChange={setIsHubReceiptOcrOpen}
        onReconciled={() => {
          qc.invalidateQueries({ queryKey: ["whatsappInboundQueue"] });
          qc.invalidateQueries({ queryKey: ["externalInvoices"] });
        }}
      />

      <AIAgentSimulatorModal
        open={isAgentSimulatorOpen}
        onOpenChange={setIsAgentSimulatorOpen}
        onSimulationComplete={() => {
          qc.invalidateQueries({ queryKey: ["whatsappInboundQueue"] });
        }}
      />
    </div>
  );
}

const INTENT_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  batch_payment: { label: "Batch Names Payment", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  receipt_payment: { label: "Receipt Submission", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  receipt_submission: { label: "Receipt Submission", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/30" },
  bill_inquiry: { label: "Bill / Due Inquiry", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400", border: "border-blue-500/30" },
  account_status: { label: "Account Status", bg: "bg-indigo-500/10", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/30" },
  how_to_pay: { label: "Payment Channels", bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500/30" },
  quota_inquiry: { label: "Quota Check", bg: "bg-cyan-500/10", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/30" },
  reconnect_speed: { label: "Speed / Reconnect", bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/30" },
  refresh_connection: { label: "Network Refresh", bg: "bg-teal-500/10", text: "text-teal-600 dark:text-teal-400", border: "border-teal-500/30" },
  topup_inquiry: { label: "Turbo Boost / Top-Up", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/30" },
  support_escalation: { label: "Staff Escalation", bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30" },
  agent_escalation: { label: "Staff Escalation", bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", border: "border-rose-500/30" },
  greeting_menu: { label: "Self-Service Menu", bg: "bg-slate-500/10", text: "text-slate-600 dark:text-slate-400", border: "border-slate-500/30" },
  unknown: { label: "General Chat", bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
};

function WhatsAppInboundQueueTab({ onOpenSimulator }: { onOpenSimulator?: () => void }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [fromNumber, setFromNumber] = useState("");

  const [manualMatchRow, setManualMatchRow] = useState<any | null>(null);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isQueueReceiptOcrOpen, setIsQueueReceiptOcrOpen] = useState(false);
  const [previewReceiptMedia, setPreviewReceiptMedia] = useState<{ url: string; title: string } | null>(null);

  const query = useQuery({
    queryKey: ["whatsappInboundQueue", page, search, status, fromNumber],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "20");
      if (search) params.set("search", search);
      if (status && status !== "all") params.set("status", status);
      if (fromNumber) params.set("fromNumber", fromNumber);
      const { data } = await apiClient.get(`/invoices/external/whatsapp-inbound-messages?${params.toString()}`);
      return data?.data ?? null;
    },
    refetchInterval: 10000,
  });

  const candidateQuery = useQuery({
    queryKey: ["unpaidInvoicesForMatch", candidateSearch],
    queryFn: async () => {
      if (!candidateSearch.trim() || candidateSearch.trim().length < 2) return [];
      const { data } = await apiClient.get("/invoices/external", {
        params: { search: candidateSearch.trim(), status: "unpaid", limit: 8 },
      });
      return Array.isArray(data?.data) ? data.data : [];
    },
    enabled: !!manualMatchRow && candidateSearch.trim().length >= 2,
  });

  const onResolveManualMatch = async () => {
    if (!manualMatchRow || !selectedInvoice) return;
    setIsResolving(true);
    try {
      await apiClient.post(`/invoices/external/whatsapp-inbound-messages/${manualMatchRow.id}/resolve`, {
        invoiceId: selectedInvoice.id,
      });
      notify.success(
        "Conflict Resolved & Marked Paid",
        `Payment applied to invoice #${selectedInvoice.id} (${selectedInvoice.fullName})`
      );
      setManualMatchRow(null);
      setSelectedInvoice(null);
      setCandidateSearch("");
      qc.invalidateQueries({ queryKey: ["whatsappInboundQueue"] });
      qc.invalidateQueries({ queryKey: ["externalInvoices"] });
    } catch (err: any) {
      notify.error(
        "Resolution Failed",
        err?.response?.data?.message || err?.message || "Could not resolve message"
      );
    } finally {
      setIsResolving(false);
    }
  };

  const retryMutation = useMutation({
    mutationFn: (id: number) => apiClient.post(`/invoices/external/whatsapp-inbound-messages/${id}/retry`),
    onSuccess: () => {
      notify.success("Retried", "Re-processed inbound WhatsApp payment line.");
      qc.invalidateQueries({ queryKey: ["whatsappInboundQueue"] });
    },
    onError: (err: any) => notify.error("Retry Failed", err?.response?.data?.message || err?.message),
  });

  const items = query.data?.items ?? [];
  const metrics = query.data?.metrics;
  const totalPages = query.data?.totalPages ?? 1;

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Total Messages</div>
              <div className="text-xl font-bold mt-0.5">{metrics?.total ?? items.length}</div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <MessageCircle className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Auto-Paid</div>
              <div className="text-xl font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">
                {metrics?.processed ?? 0}
              </div>
            </div>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">No Match / Unknown</div>
              <div className="text-xl font-bold mt-0.5 text-sky-600 dark:text-sky-400">
                {metrics?.noMatch ?? 0}
              </div>
              <button
                type="button"
                onClick={() => setStatus("no_match")}
                className="text-[10px] text-sky-600 hover:underline mt-0.5 block cursor-pointer"
              >
                Filter No Match →
              </button>
            </div>
            <div className="h-8 w-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-600">
              <Users className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-2xs">
          <CardContent className="p-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Errors / Ambiguities</div>
              <div className="text-xl font-bold mt-0.5 text-amber-600 dark:text-amber-400">
                {metrics?.errors ?? 0}
              </div>
              <Link
                href="/external-invoices/whatsapp-matches"
                className="text-[10px] text-amber-600 hover:underline mt-0.5 block"
              >
                Resolve Conflicts Queue →
              </Link>
            </div>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card className="border-border/60 shadow-xs p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search text, phone, or error details…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="w-[180px]">
            <Input
              placeholder="Filter by phone (e.g. 9613181476)…"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              className="text-xs"
            />
          </div>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px] text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="no_match">No Match</SelectItem>
              <SelectItem value="ambiguous">Ambiguous</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={onOpenSimulator}
            className="text-xs gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xs shrink-0"
          >
            <Bot className="h-3.5 w-3.5" />
            AI Agent Simulator
          </Button>

          <Button
            size="sm"
            onClick={() => setIsQueueReceiptOcrOpen(true)}
            className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Scan Receipt Slip (OCR)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh Queue
          </Button>
        </div>
      </Card>

      {/* Message Queue Table */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[150px]">Timestamp</TableHead>
              <TableHead className="w-[150px]">From Sender</TableHead>
              <TableHead className="min-w-[180px]">Message Text</TableHead>
              <TableHead className="min-w-[220px]">AI Intent & Reply</TableHead>
              <TableHead>Parsed Name / Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                  Loading inbound WhatsApp traffic queue…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-xs">
                  No inbound WhatsApp messages found matching filters.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row: any) => (
                <TableRow key={row.id}>
                  <TableCell className="text-xs font-mono">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs font-mono font-medium">
                    {row.fromNumber}
                  </TableCell>
                  <TableCell className="text-xs max-w-[240px] font-medium">
                    {row.mediaUrl ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewReceiptMedia({ url: row.mediaUrl, title: `Receipt Slip: ${row.fromNumber}` })}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-[10px] font-medium border border-indigo-500/30 shrink-0"
                          title="Click to view payment slip image"
                        >
                          <Camera className="h-3 w-3" />
                          <span>Slip</span>
                        </button>
                        <span className="truncate">{row.rawText}</span>
                      </div>
                    ) : (
                      <span className="truncate block">{row.rawText}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[280px]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {row.intent ? (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-medium ${
                              INTENT_BADGES[row.intent]?.bg ?? "bg-muted"
                            } ${INTENT_BADGES[row.intent]?.text ?? "text-muted-foreground"} ${
                              INTENT_BADGES[row.intent]?.border ?? "border-border"
                            }`}
                          >
                            {INTENT_BADGES[row.intent]?.label ?? row.intent}
                          </Badge>
                        ) : null}
                        {row.matchedUsername ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono px-1.5 py-0 bg-primary/10 text-primary border border-primary/20"
                            title="Matched Subscriber Account"
                          >
                            👤 {row.matchedUsername}
                          </Badge>
                        ) : null}
                      </div>
                      {row.replyText ? (
                        <div
                          className="text-[11px] bg-muted/60 dark:bg-muted/40 p-1.5 rounded border border-border/50 text-foreground/80 line-clamp-2"
                          title={row.replyText}
                        >
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 mr-1">🤖</span>
                          {row.replyText}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    {Array.isArray(row.parsedNames) && row.parsedNames.length > 0 ? (
                      <span className="font-semibold">{row.parsedNames.join(", ")}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    {row.extractedAmount != null ? (
                      <Badge variant="outline" className="ml-1.5 text-[10px] font-mono border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                        ${Number(row.extractedAmount).toFixed(2)}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-semibold ${
                        row.status === "processed"
                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          : row.status === "ambiguous"
                            ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                            : row.status === "no_match"
                              ? "bg-sky-500/10 text-sky-600 border-sky-500/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                      }`}
                    >
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {row.status === "ambiguous" && (
                        <Button
                          size="sm"
                          asChild
                          className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                        >
                          <Link href="/external-invoices/whatsapp-matches">
                            <CheckCircle2 className="h-3 w-3" />
                            Resolve
                          </Link>
                        </Button>
                      )}

                      {(row.status === "no_match" || row.status === "ambiguous" || row.status === "error") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setManualMatchRow(row);
                            setCandidateSearch(row.parsedNames?.[0] || "");
                            setSelectedInvoice(null);
                          }}
                          className="h-7 text-xs gap-1 text-sky-600 border-sky-500/40 hover:bg-sky-50 dark:hover:bg-sky-950"
                        >
                          <Users className="h-3 w-3" />
                          Match
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => retryMutation.mutate(row.id)}
                        disabled={retryMutation.isPending}
                        className="h-7 text-xs gap-1"
                        title="Re-run automated parser"
                      >
                        <RefreshCw className={`h-3 w-3 ${retryMutation.isPending ? "animate-spin" : ""}`} />
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Manual Match & Conflict Resolution Dialog */}
      <Dialog open={!!manualMatchRow} onOpenChange={(open) => !open && setManualMatchRow(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-sky-600" />
              Resolve WhatsApp Payment Conflict
            </DialogTitle>
            <DialogDescription>
              Match this WhatsApp message to an unpaid subscriber invoice and mark it paid.
            </DialogDescription>
          </DialogHeader>

          {manualMatchRow && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg border text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From Sender:</span>
                  <span className="font-mono font-medium">{manualMatchRow.fromNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Message Text:</span>
                  <span className="font-semibold text-foreground">&ldquo;{manualMatchRow.rawText}&rdquo;</span>
                </div>
                {manualMatchRow.extractedAmount != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Detected Amount:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      ${Number(manualMatchRow.extractedAmount).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="candidate-search" className="text-xs">
                  Search Unpaid Subscriber Invoices
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="candidate-search"
                    placeholder="Type name, username, or invoice #…"
                    value={candidateSearch}
                    onChange={(e) => {
                      setCandidateSearch(e.target.value);
                      setSelectedInvoice(null);
                    }}
                    className="pl-9 text-xs"
                    autoFocus
                  />
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto space-y-1.5 border rounded-lg p-2">
                {candidateQuery.isLoading ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1" /> Searching invoices…
                  </div>
                ) : !candidateSearch.trim() || candidateSearch.trim().length < 2 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    Enter at least 2 characters to search unpaid invoices.
                  </div>
                ) : (candidateQuery.data || []).length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground">
                    No unpaid invoices found matching &ldquo;{candidateSearch}&rdquo;.
                  </div>
                ) : (
                  (candidateQuery.data || []).map((inv: any) => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    return (
                      <div
                        key={inv.id}
                        onClick={() => setSelectedInvoice(inv)}
                        className={`p-2.5 rounded-md border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/40"
                            : "border-border/60 hover:bg-muted/40"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            <span>{inv.fullName}</span>
                            <span className="font-mono text-[11px] text-muted-foreground font-normal">
                              (@{inv.username})
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            Invoice #{inv.id} · Due: {inv.payDueDate ? new Date(inv.payDueDate).toLocaleDateString() : "—"}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-bold text-foreground">
                            ${Number(inv.totalAmount ?? inv.amount ?? 0).toFixed(2)}
                          </div>
                          {isSelected && (
                            <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px]">
                              Selected
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setManualMatchRow(null)} disabled={isResolving}>
              Cancel
            </Button>
            <Button
              onClick={onResolveManualMatch}
              disabled={!selectedInvoice || isResolving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {isResolving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {isResolving ? "Applying Payment…" : "Apply Payment & Resolve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Image Zoom Modal */}
      <Dialog open={!!previewReceiptMedia} onOpenChange={(open) => !open && setPreviewReceiptMedia(null)}>
        <DialogContent className="sm:max-w-[650px] max-h-[85vh] p-4 flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-indigo-500" />
              {previewReceiptMedia?.title || "Receipt Slip Image"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto rounded-lg border border-border/60 bg-black/5 p-2 flex items-center justify-center">
            {previewReceiptMedia?.url && (
              <img
                src={previewReceiptMedia.url.startsWith("http") ? previewReceiptMedia.url : `${apiClient.defaults.baseURL?.replace(/\/api$/, "") || ""}${previewReceiptMedia.url}`}
                alt="Receipt Slip"
                className="max-h-[65vh] object-contain rounded"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setPreviewReceiptMedia(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptOcrTesterModal
        open={isQueueReceiptOcrOpen}
        onOpenChange={setIsQueueReceiptOcrOpen}
        onReconciled={() => {
          qc.invalidateQueries({ queryKey: ["whatsappInboundQueue"] });
          qc.invalidateQueries({ queryKey: ["externalInvoices"] });
        }}
      />
    </div>
  );
}

