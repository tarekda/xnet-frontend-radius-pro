import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteView, listSavedViewNames, readSavedViews, saveView, type SavedViewState } from "@/lib/savedViews";

type Props = {
  storageKey: string;
  /** Which keys to read/apply; also used to keep views small and predictable */
  keys: string[];
  /** Must return a map of key -> value (strings). */
  getState: () => SavedViewState;
  /** Apply a saved state (already filtered to `keys`). */
  applyState: (state: SavedViewState) => void;
  onSaved?: (name: string) => void;
  onDeleted?: (name: string) => void;
  className?: string;
  compact?: boolean;
};

export default function SavedViews({
  storageKey,
  keys,
  getState,
  applyState,
  onSaved,
  onDeleted,
  className,
  compact = true,
}: Props) {
  const [version, setVersion] = React.useState(0);
  const [selectedName, setSelectedName] = React.useState<string>("");
  const names = React.useMemo(() => {
    void version;
    return listSavedViewNames(storageKey);
  }, [storageKey, version]);

  const save = React.useCallback(
    (name: string) => {
      const n = name.trim();
      if (!n) return;
      const full = getState();
      const filtered: SavedViewState = {};
      keys.forEach((k) => {
        const v = full[k];
        if (typeof v === "string" && v.length) filtered[k] = v;
      });
      saveView(storageKey, n, filtered);
      setSelectedName(n);
      setVersion((v) => v + 1);
      onSaved?.(n);
    },
    [getState, keys, onSaved, storageKey]
  );

  const apply = React.useCallback(
    (name: string) => {
      setSelectedName(name);
      const all = readSavedViews(storageKey);
      const v = all[name];
      if (!v) return;
      const filtered: SavedViewState = {};
      keys.forEach((k) => {
        const value = v[k];
        if (typeof value === "string") filtered[k] = value;
      });
      applyState(filtered);
    },
    [applyState, keys, storageKey]
  );

  const remove = React.useCallback(() => {
    if (!selectedName) return;
    deleteView(storageKey, selectedName);
    onDeleted?.(selectedName);
    setSelectedName("");
    setVersion((v) => v + 1);
  }, [onDeleted, selectedName, storageKey]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1">
        <Input
          aria-label="Saved view name"
          placeholder={compact ? "Save view…" : "Save current view…"}
          className={cn(compact ? "h-8 w-28" : "h-9 w-44")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              save((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = "";
            }
          }}
          onBlur={(e) => {
            const v = (e.target as HTMLInputElement).value;
            if (v.trim()) {
              save(v);
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
        <Button
          size="sm"
          variant="secondary"
          className={cn(compact ? "h-8" : "h-9")}
          onClick={(e) => {
            const input = (e.currentTarget.previousSibling as HTMLInputElement) || null;
            if (input && input.value.trim()) {
              save(input.value);
              input.value = "";
            }
          }}
        >
          Save
        </Button>
      </div>

      <Select value={selectedName} onValueChange={apply}>
        <SelectTrigger aria-label="Saved views" className={cn(compact ? "h-8 w-32" : "h-9 w-44")}>
          <SelectValue placeholder="Views" />
        </SelectTrigger>
        <SelectContent align="end">
          {names.length === 0 && <div className="px-2 py-1 text-sm text-muted-foreground">No views</div>}
          {names.map((n) => (
            <SelectItem key={n} value={n}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        size="sm"
        variant="outline"
        className={cn(compact ? "h-8 px-2" : "h-9 px-3")}
        onClick={remove}
        disabled={!selectedName}
        title="Delete selected view"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

