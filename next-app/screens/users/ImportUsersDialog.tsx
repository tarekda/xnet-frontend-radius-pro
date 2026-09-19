import React, { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { parseCsv } from "@/lib/csv";
import { notify } from "@/lib/notify";
import { bulkCreateUsers } from "@/api/users";

type ImportPreviewRow = { raw: Record<string, string>; errors: string[] };

function parseImportCsv(text: string): ImportPreviewRow[] {
  const parsed = parseCsv(text).filter((r) => r.some((c) => String(c ?? "").trim().length > 0));
  if (!parsed.length) return [];

  const header = (parsed[0] ?? []).map((h) => String(h ?? "").trim().toLowerCase());
  const mapKey = (k: string) => {
    const key = k.replace(/\s+/g, "");
    if (["username", "user", "login"].includes(key)) return "username";
    if (["password", "pass"].includes(key)) return "password";
    if (["profileid", "profile_id", "profile"].includes(key)) return "profileId";
    if (["accountstatus", "status"].includes(key)) return "accountStatus";
    if (["fullname", "name"].includes(key)) return "fullName";
    if (["phonenumber", "phone"].includes(key)) return "phoneNumber";
    if (["email"].includes(key)) return "email";
    if (["address"].includes(key)) return "address";
    return key;
  };

  const keys = header.map(mapKey);
  const out: ImportPreviewRow[] = [];

  for (let idx = 1; idx < parsed.length; idx++) {
    const row = parsed[idx] ?? [];
    const raw: Record<string, string> = {};
    keys.forEach((k, i) => {
      raw[k] = String(row[i] ?? "").trim();
    });
    const errors: string[] = [];
    const username = raw.username?.trim();
    const password = raw.password?.trim();
    const profileId = Number(raw.profileId);

    if (!username) errors.push("username is required");
    if (!password) errors.push("password is required");
    if (!Number.isFinite(profileId) || profileId <= 0) errors.push("profileId must be a positive number");

    out.push({ raw, errors });
  }

  return out;
}

function downloadTemplate() {
  const headers = "username,password,profileId,accountStatus,fullName,phoneNumber,email,address";
  const example = "user1,password123,1,active,John Doe,+1234567890,john@example.com,123 Main St";
  const csv = headers + "\n" + example;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
  notify.success("Template downloaded", "Save the file and fill in your user data.");
}

export const ImportUsersDialog = ({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful import so the caller can refetch the list. */
  onImported: () => Promise<unknown>;
}) => {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const handleFile = useCallback(async (file: File | null) => {
    setRows([]);
    setFileName(file?.name ?? "");
    if (!file) return;

    const text = await file.text();
    const parsed = parseImportCsv(text);
    if (!parsed.length) {
      notify.error("Import failed", "CSV file is empty.");
      return;
    }
    setRows(parsed);
  }, []);

  const runImport = useCallback(async () => {
    const valid = rows.filter((r) => r.errors.length === 0).map((r) => r.raw);
    if (!valid.length) {
      notify.error("Import", "No valid rows to import.");
      return;
    }

    setIsImporting(true);
    try {
      const result = await bulkCreateUsers(
        valid.map((r) => ({
          username: r.username,
          password: r.password,
          profileId: Number(r.profileId),
          accountStatus: r.accountStatus || "active",
          fullName: r.fullName,
          address: r.address,
          phoneNumber: r.phoneNumber,
          email: r.email,
        }))
      );

      await onImported();
      if (result.failed > 0 && Array.isArray(result.results)) {
        const firstErrors = result.results
          .filter((x) => !x.ok)
          .slice(0, 5)
          .map((x) => `${x.username || "(missing username)"}: ${x.error || "failed"}`);
        notify.error(
          "Import completed with errors",
          `${result.created} created, ${result.failed} failed.\n${firstErrors.join("\n")}`
        );
      } else {
        notify.success("Import complete", `${result.created} created, ${result.failed} failed.`);
      }
      onOpenChange(false);
      setRows([]);
      setFileName("");
    } finally {
      setIsImporting(false);
    }
  }, [rows, onImported, onOpenChange]);

  const validCount = rows.filter((r) => r.errors.length === 0).length;

  return (
    <Dialog open={open} onOpenChange={(next) => (isImporting ? null : onOpenChange(next))}>
      <DialogContent className="sm:max-w-[920px]">
        <DialogHeader>
          <DialogTitle>Import Users (CSV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Required columns: <span className="font-mono">username,password,profileId</span>. Optional:{" "}
            <span className="font-mono">accountStatus,fullName,phoneNumber,email,address</span>.
          </div>

          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" />
            Download template
          </Button>

          <Input
            type="file"
            accept=".csv,text/csv"
            aria-label="CSV file to import"
            onChange={(e) => void handleFile(e.target.files?.item(0) ?? null)}
            disabled={isImporting}
          />

          {fileName ? (
            <div className="text-sm">
              File: <span className="font-medium">{fileName}</span>
            </div>
          ) : null}

          {rows.length ? (
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline">Total: {rows.length}</Badge>
              <Badge variant="outline" className="border-green-500 text-green-700">
                Valid: {validCount}
              </Badge>
              <Badge variant="outline" className="border-red-500 text-red-700">
                Invalid: {rows.length - validCount}
              </Badge>
            </div>
          ) : null}

          {rows.length ? (
            <div className="max-h-[420px] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 border-b border-border bg-card/95 shadow-sm backdrop-blur-sm dark:bg-card/90">
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead className="w-[120px]">Profile</TableHead>
                    <TableHead className="w-[120px]">Status</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 50).map((r, idx) => (
                    <TableRow key={idx} className={r.errors.length ? "bg-red-50/40 dark:bg-red-950/35" : ""}>
                      <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{r.raw.username}</TableCell>
                      <TableCell className="font-mono text-sm">{r.raw.profileId}</TableCell>
                      <TableCell className="font-mono text-sm">{r.raw.accountStatus || "active"}</TableCell>
                      <TableCell className="text-sm">
                        {r.errors.length ? (
                          r.errors.join("; ")
                        ) : (
                          <span className="text-green-700 dark:text-green-400">OK</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 50 ? (
                <div className="p-2 text-xs text-muted-foreground">Showing first 50 rows.</div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isImporting}>
            Close
          </Button>
          <Button onClick={() => void runImport()} disabled={isImporting || validCount === 0}>
            {isImporting ? "Importing..." : "Create valid users"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
