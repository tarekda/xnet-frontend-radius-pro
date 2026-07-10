import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  DashboardAutoRefreshSeconds,
  DashboardWidgetSurface,
  WatchlistFilter,
  WatchlistStaleThresholdSeconds,
} from "./dashboardShared";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  watchlistDefaultFilter: WatchlistFilter;
  onWatchlistDefaultFilterChange: (filter: WatchlistFilter) => void;
  watchlistStaleThresholdSec: WatchlistStaleThresholdSeconds;
  onWatchlistStaleThresholdChange: (seconds: WatchlistStaleThresholdSeconds) => void;
  dashboardAutoRefreshSec: DashboardAutoRefreshSeconds;
  onAutoRefreshChange: (seconds: DashboardAutoRefreshSeconds) => void;
  widgetSurface: DashboardWidgetSurface;
  onWidgetSurfaceChange: (surface: DashboardWidgetSurface) => void;
  onResetDefaults: () => void;
};

/** Dashboard preferences dialog: watchlist triage defaults, auto-refresh cadence, widget surface. */
const DashboardSettingsDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  watchlistDefaultFilter,
  onWatchlistDefaultFilterChange,
  watchlistStaleThresholdSec,
  onWatchlistStaleThresholdChange,
  dashboardAutoRefreshSec,
  onAutoRefreshChange,
  widgetSurface,
  onWidgetSurfaceChange,
  onResetDefaults,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Dashboard settings</DialogTitle>
          <DialogDescription>
            Configure how watchlist triage and refresh behavior works on this dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Watchlist default filter</div>
            <Select
              value={watchlistDefaultFilter}
              onValueChange={(value) => {
                const next = (value === "fup" || value === "stale" || value === "all")
                  ? (value as WatchlistFilter)
                  : "all";
                onWatchlistDefaultFilterChange(next);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sessions</SelectItem>
                <SelectItem value="fup">FUP only</SelectItem>
                <SelectItem value="stale">Stale only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Stale session threshold</div>
            <Select
              value={String(watchlistStaleThresholdSec)}
              onValueChange={(value) => {
                const next = Number(value);
                if (next === 30 || next === 60 || next === 120) {
                  onWatchlistStaleThresholdChange(next);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 seconds</SelectItem>
                <SelectItem value="60">60 seconds</SelectItem>
                <SelectItem value="120">120 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Auto refresh dashboard data</div>
            <Select
              value={String(dashboardAutoRefreshSec)}
              onValueChange={(value) => {
                const next = Number(value);
                if (next === 0 || next === 30 || next === 60 || next === 120) {
                  onAutoRefreshChange(next);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Off</SelectItem>
                <SelectItem value="30">Every 30 seconds</SelectItem>
                <SelectItem value="60">Every 60 seconds</SelectItem>
                <SelectItem value="120">Every 2 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Widget background</div>
            <Select
              value={widgetSurface}
              onValueChange={(value) => {
                if (value === "white" || value === "theme") {
                  onWidgetSurfaceChange(value);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="white">White</SelectItem>
                <SelectItem value="theme">Theme default</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onResetDefaults}>
            Reset defaults
          </Button>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DashboardSettingsDialog;
