import { useMemo, useState } from 'react';
import { AlertCircle, Columns3, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  detectProviderFromMapping,
  IMPORT_FIELD_META,
  saveMappingForProvider,
  type ImportColumnMapping,
  type ImportPreviewData,
} from '@/lib/externalInvoiceImport';

const UNMAPPED = '__none__';

type Props = {
  preview: ImportPreviewData;
  mapping: ImportColumnMapping;
  onMappingChange: (mapping: ImportColumnMapping) => void;
  onRefreshPreview: () => void;
  isRefreshing?: boolean;
  rememberMapping?: boolean;
  onRememberMappingChange?: (value: boolean) => void;
};

export default function ExternalInvoiceImportPreviewPanel({
  preview,
  mapping,
  onMappingChange,
  onRefreshPreview,
  isRefreshing = false,
  rememberMapping = true,
  onRememberMappingChange,
}: Props) {
  const providerHint = useMemo(
    () => detectProviderFromMapping(mapping, preview.mappedPreview),
    [mapping, preview.mappedPreview]
  );
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [providerName, setProviderName] = useState('');

  const setFieldMapping = (field: keyof ImportColumnMapping, header: string) => {
    const next = { ...mapping };
    if (header === UNMAPPED) delete next[field];
    else next[field] = header;
    onMappingChange(next);
  };

  const handleSaveMapping = () => {
    if (providerHint) {
      saveMappingForProvider(providerHint, mapping);
      return;
    }
    setProviderName('');
    setProviderDialogOpen(true);
  };

  const handleConfirmSaveMapping = () => {
    const provider = providerName.trim();
    if (!provider) return;
    saveMappingForProvider(provider, mapping);
    setProviderDialogOpen(false);
    setProviderName('');
  };

  const previewColumns: Array<{ key: string; label: string }> = [
    { key: 'username', label: 'Username' },
    { key: 'fullName', label: 'Name' },
    { key: 'provider', label: 'Provider' },
    { key: 'amount', label: 'Amount' },
    { key: 'payDueDate', label: 'Pay due' },
    { key: 'debitLabel', label: 'Debit' },
  ];

  return (
    <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Columns3 className="h-4 w-4" />
            Import preview
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Sheet <span className="font-mono">{preview.sheetName}</span> — {preview.totalRows} row(s),{' '}
            {preview.validRowCount} ready, {preview.skippedRowCount} skipped
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={isRefreshing} onClick={onRefreshPreview}>
            {isRefreshing ? 'Refreshing…' : 'Refresh preview'}
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={handleSaveMapping}>
            <Save className="mr-2 h-4 w-4" />
            Save mapping{providerHint ? ` (${providerHint})` : ''}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {IMPORT_FIELD_META.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label className="text-xs">
              {field.label}
              {field.required ? <span className="text-red-500"> *</span> : null}
            </Label>
            <Select
              value={mapping[field.key] ?? UNMAPPED}
              onValueChange={(v) => setFieldMapping(field.key, v)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="— not mapped —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNMAPPED}>— not mapped —</SelectItem>
                {preview.headers.map((h) => (
                  <SelectItem key={`${field.key}-${h}`} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={rememberMapping}
          onCheckedChange={(v) => onRememberMappingChange?.(Boolean(v))}
        />
        Remember column mapping for this provider on future imports
      </label>

      {preview.issues.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-100">
            <AlertCircle className="h-4 w-4" />
            Validation notes ({preview.issues.length})
          </div>
          <ul className="max-h-32 overflow-auto space-y-1 text-xs text-amber-900/90 dark:text-amber-100/90">
            {preview.issues.slice(0, 12).map((issue, i) => (
              <li key={`${issue.row}-${issue.field}-${i}`}>
                Row {issue.row}, {issue.field}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {previewColumns.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {preview.mappedPreview.length === 0 ? (
              <TableRow>
                <TableCell colSpan={previewColumns.length} className="text-sm text-muted-foreground">
                  No valid rows in preview — check column mapping (username is required).
                </TableCell>
              </TableRow>
            ) : (
              preview.mappedPreview.map((row, idx) => (
                <TableRow key={idx}>
                  {previewColumns.map((c) => (
                    <TableCell key={c.key} className="text-sm">
                      {String((row as Record<string, unknown>)[c.key] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{preview.headers.length} columns detected</Badge>
        {!mapping.username ? (
          <Badge variant="destructive">Map username before import</Badge>
        ) : (
          <Badge variant="secondary">Username → {mapping.username}</Badge>
        )}
      </div>

      <Dialog
        open={providerDialogOpen}
        onOpenChange={(open) => {
          setProviderDialogOpen(open);
          if (!open) setProviderName('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save column mapping</DialogTitle>
            <DialogDescription>
              Name the provider so this mapping can be reused automatically on future imports.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="mapping-provider">Provider name</Label>
            <Input
              id="mapping-provider"
              autoFocus
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmSaveMapping();
              }}
              placeholder="For example: MyISP"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setProviderDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmSaveMapping} disabled={!providerName.trim()}>
              <Save className="mr-2 h-4 w-4" />
              Save mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
