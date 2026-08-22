import React, { useMemo, useState, useEffect, useCallback } from 'react';
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import StatCard from "@/components/StatCard";
import FilterPills from "@/components/FilterPills";
import ActionConfirmDialog from "@/components/ActionConfirmDialog";
import { CountUpNumber } from "@/components/viz";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/api/client";
import { Profile, useProfiles } from '../hooks/useProfiles';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Download,
  Upload,
  Clock,
  Users,
  Pencil,
  Network,
  Trash2,
  Copy,
  RefreshCw,
  Layers,
  Gauge,
  CircleDollarSign,
  Moon,
  ArrowDownUp,
} from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import SearchBar from "@/components/SearchBar";
import QueryState from "@/components/QueryState";

type ProfileUsage = {
  profileId: number;
  usersCount: number;
  activeCount: number;
};

const formatQuota = (quota?: string) => {
  const bytes = Number(quota);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatSpeed = (speedKbps?: number) => {
  const v = Number(speedKbps ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "—";
  if (v >= 1000000) return `${(v / 1000000).toFixed(2)} Gbps`;
  if (v >= 1000) return `${(v / 1000).toFixed(2)} Mbps`;
  return `${v} Kbps`;
};

const formatSessionTimeout = (seconds?: number) => {
  const s = Number(seconds ?? 0);
  if (!Number.isFinite(s) || s <= 0) return "—";
  if (s >= 86400) return `${Math.floor(s / 86400)} day(s)`;
  if (s >= 3600) return `${Math.floor(s / 3600)} hour(s)`;
  if (s >= 60) return `${Math.floor(s / 60)} minute(s)`;
  return `${s} second(s)`;
};

const ProfileCard: React.FC<{
  profile: Profile;
  usage?: ProfileUsage;
  onEdit: () => void;
  onClone: () => void;
  onDelete: () => void;
}> = ({ profile, usage, onEdit, onClone, onDelete }) => {
  const usersCount = usage?.usersCount ?? 0;
  const hasNightWindow = Boolean(profile.nightStart && profile.nightEnd);

  return (
    <Card className="group overflow-hidden border-border/80 shadow-none transition-[border-color] hover:border-primary/30">
      <CardHeader className="border-b border-border/60 p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg text-card-foreground">{profile.profileName}</CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="bg-card/85">
                ID: {profile.id}
              </Badge>
              {profile.price != null && profile.price > 0 ? (
                <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-300">
                  {Number(profile.price).toLocaleString()} / mo
                </Badge>
              ) : null}
              {hasNightWindow ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Moon className="h-3 w-3" />
                  {profile.nightStart} – {profile.nightEnd}
                </span>
              ) : null}
            </CardDescription>
          </div>

          <div className="flex gap-1.5">
            <Button variant="outline" size="icon" className="h-8 w-8 bg-card/85" onClick={onClone} title="Duplicate profile">
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 bg-card/85" onClick={onEdit} title="Edit profile">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-card/85 text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              title="Delete profile"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-card/85 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Download className="h-4 w-4 text-primary" />
              Download
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">{formatSpeed(profile.speedDown)}</div>
          </div>
          <div className="rounded-lg border bg-card/85 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Upload className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Upload
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">{formatSpeed(profile.speedUp)}</div>
          </div>
          <div className="rounded-lg border bg-card/85 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              Session timeout
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">{formatSessionTimeout(profile.sessionTimeout)}</div>
          </div>
          <div className="rounded-lg border bg-card/85 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-4 w-4 text-primary" />
              Max sessions
            </div>
            <div className="mt-1 font-mono text-sm text-foreground">{profile.maxSessions ?? "—"}</div>
          </div>
          <div className="rounded-lg border bg-card/85 p-3">
            <div className="text-xs text-muted-foreground">Daily quota</div>
            <div className="mt-1 font-mono text-sm text-foreground">{formatQuota(profile.dailyQuota)}</div>
          </div>
          <div className="rounded-lg border bg-card/85 p-3">
            <div className="text-xs text-muted-foreground">Monthly quota</div>
            <div className="mt-1 font-mono text-sm text-foreground">{formatQuota(profile.monthlyQuota)}</div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {usersCount > 0 && usage
              ? `${usage.activeCount.toLocaleString()} active of ${usersCount.toLocaleString()} assigned`
              : "No users assigned"}
          </span>
          {usersCount > 0 ? (
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" asChild>
              <Link href={`/users/list?profile=${encodeURIComponent(profile.profileName.toLowerCase())}`}>
                <Users className="h-3.5 w-3.5" />
                View {usersCount.toLocaleString()} user{usersCount !== 1 ? "s" : ""}
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
};

const profileSchema = z.object({
  id: z.optional(z.number()),
  profileName: z.string().min(1, "Profile name is required"),
  dailyQuota: z.string().min(1, "Daily quota is required"),
  monthlyQuota: z.string().min(1, "Monthly quota is required"),
  price: z.number().min(0, "Price must be 0 or greater").optional(),
  speedDown: z.number().min(1, "Download speed is required"),
  speedUp: z.number().min(1, "Upload speed is required"),
  nightStart: z.string().optional(),
  nightEnd: z.string().optional(),
  sessionTimeout: z.number().optional(),
  idleTimeout: z.number().optional(),
  maxSessions: z.number().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormModalProps {
  profile?: Profile;
  onSave: (profile: Profile) => void;
  onClose: () => void;
}

const emptyFormValues: ProfileFormData = {
  profileName: '',
  dailyQuota: '',
  monthlyQuota: '',
  price: 0,
  nightStart: '',
  nightEnd: '',
  speedDown: 0,
  speedUp: 0,
  sessionTimeout: 0,
  idleTimeout: 0,
  maxSessions: 0
};

const ProfileFormModal: React.FC<ProfileFormModalProps> = ({ profile, onSave, onClose }) => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyFormValues
  });

  // Use useEffect to reset form values when the profile changes
  useEffect(() => {
    if (profile) {
      reset({
        profileName: profile.profileName,
        dailyQuota: (parseInt(profile.dailyQuota) / (1024 * 1024 * 1024)).toString(),
        monthlyQuota: (parseInt(profile.monthlyQuota) / (1024 * 1024 * 1024)).toString(),
        price: profile.price ?? 0,
        nightStart: profile.nightStart ?? '',
        nightEnd: profile.nightEnd ?? '',
        speedDown: profile.speedDown ?? 0,
        speedUp: profile.speedUp ?? 0,
        sessionTimeout: profile.sessionTimeout ?? 0,
        idleTimeout: profile.idleTimeout ?? 0,
        maxSessions: profile.maxSessions ?? 0,
      });
    } else {
      reset(emptyFormValues);
    }
  }, [profile, reset]);

  const onSubmit = (data: ProfileFormData) => {
    // Convert quota values back to bytes before saving
    const updatedData: Profile = {
      ...(profile ?? {}),
      profileName: data.profileName,
      dailyQuota: (parseFloat(data.dailyQuota) * 1024 * 1024 * 1024).toString(),
      monthlyQuota: (parseFloat(data.monthlyQuota) * 1024 * 1024 * 1024).toString(),
      price: data.price ?? 0,
      nightStart: data.nightStart || undefined,
      nightEnd: data.nightEnd || undefined,
      speedDown: data.speedDown ?? 0,
      speedUp: data.speedUp ?? 0,
      sessionTimeout: data.sessionTimeout ?? undefined,
      idleTimeout: data.idleTimeout ?? undefined,
      maxSessions: data.maxSessions ?? undefined,
    };
    onSave(updatedData);
    onClose();
  };

  const title = profile?.id ? 'Edit Profile' : profile ? 'Duplicate Profile' : 'Create New Profile';

  return (
    <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit(onSubmit as (data: ProfileFormData) => void)}>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="profileName" className="text-right">
              Profile Name
            </Label>
            <div className="col-span-3">
              <Input id="profileName" {...register("profileName")} className="w-full" />
              {errors.profileName && <p className="text-destructive text-sm mt-1">{errors.profileName.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="dailyQuota" className="text-right">
              Daily Quota (GB)
            </Label>
            <div className="col-span-3">
              <Input id="dailyQuota" type="text" {...register("dailyQuota")} className="w-full" />
              {errors.dailyQuota && <p className="text-destructive text-sm mt-1">{errors.dailyQuota.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="monthlyQuota" className="text-right">
              Monthly Quota (GB)
            </Label>
            <div className="col-span-3">
              <Input id="monthlyQuota" type="text" {...register("monthlyQuota")} className="w-full" />
              {errors.monthlyQuota && <p className="text-destructive text-sm mt-1">{errors.monthlyQuota.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="price" className="text-right">
              Price (per month)
            </Label>
            <div className="col-span-3">
              <Input id="price" type="number" min={0} {...register("price", { valueAsNumber: true })} className="w-full" placeholder="0" />
              {errors.price && <p className="text-destructive text-sm mt-1">{errors.price.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="nightStart" className="text-right">
              Night Start
            </Label>
            <Input id="nightStart" type="time" {...register("nightStart")} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="nightEnd" className="text-right">
              Night End
            </Label>
            <Input id="nightEnd" type="time" {...register("nightEnd")} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="speedDown" className="text-right">
              Download Speed (Kbps)
            </Label>
            <div className="col-span-3">
              <Input id="speedDown" type="number" {...register("speedDown", { valueAsNumber: true })} className="w-full" />
              {errors.speedDown && <p className="text-destructive text-sm mt-1">{errors.speedDown.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="speedUp" className="text-right">
              Upload Speed (Kbps)
            </Label>
            <div className="col-span-3">
              <Input id="speedUp" type="number" {...register("speedUp", { valueAsNumber: true })} className="w-full" />
              {errors.speedUp && <p className="text-destructive text-sm mt-1">{errors.speedUp.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sessionTimeout" className="text-right">
              Session Timeout (sec)
            </Label>
            <Input id="sessionTimeout" type="number" {...register("sessionTimeout", { valueAsNumber: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="idleTimeout" className="text-right">
              Idle Timeout (sec)
            </Label>
            <Input id="idleTimeout" type="number" {...register("idleTimeout", { valueAsNumber: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="maxSessions" className="text-right">
              Max Sessions
            </Label>
            <Input id="maxSessions" type="number" {...register("maxSessions", { valueAsNumber: true })} className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

type SortKey = "name" | "price" | "speed" | "users";

const ProfilesComponent: React.FC = () => {
  const { t } = useTranslation("screens");
  const { data, error, isLoading, refetch, updateProfile, createProfile, deleteProfile } = useProfiles();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const usageQuery = useQuery({
    queryKey: ["profiles", "usage"],
    queryFn: async () => {
      const resp = await apiClient.get("/profiles/usage");
      return (resp?.data?.data ?? []) as ProfileUsage[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
  const usageMap = useMemo(() => {
    const m = new Map<number, ProfileUsage>();
    for (const u of usageQuery.data ?? []) m.set(u.profileId, u);
    return m;
  }, [usageQuery.data]);

  const allProfiles = useMemo(() => data?.data ?? [], [data?.data]);

  const totals = useMemo(() => {
    let assignedUsers = 0;
    let activeUsers = 0;
    let revenue = 0;
    let fastest: Profile | null = null;
    for (const p of allProfiles) {
      const u = p.id != null ? usageMap.get(p.id) : undefined;
      const count = u?.usersCount ?? 0;
      assignedUsers += count;
      activeUsers += u?.activeCount ?? 0;
      revenue += (Number(p.price) || 0) * count;
      if ((Number(p.speedDown) || 0) > (Number(fastest?.speedDown) || 0)) fastest = p;
    }
    return { totalProfiles: allProfiles.length, assignedUsers, activeUsers, revenue, fastest };
  }, [allProfiles, usageMap]);

  const visibleProfiles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const filtered = q ? allProfiles.filter((p) => p.profileName.toLowerCase().includes(q)) : allProfiles;
    const usersOf = (p: Profile) => (p.id != null ? usageMap.get(p.id)?.usersCount ?? 0 : 0);
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "price":
          return (Number(b.price) || 0) - (Number(a.price) || 0);
        case "speed":
          return (Number(b.speedDown) || 0) - (Number(a.speedDown) || 0);
        case "users":
          return usersOf(b) - usersOf(a);
        default:
          return a.profileName.localeCompare(b.profileName);
      }
    });
  }, [allProfiles, searchTerm, sortBy, usageMap]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetch(), usageQuery.refetch()]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch, usageQuery]);

  const handleSaveProfile = async (profile: Profile) => {
    // Toasts are handled by the hook.
    if (profile.id) updateProfile(profile);
    else createProfile(profile);
  };

  const openEditModal = (profile: Profile) => {
    setEditingProfile({
      ...profile,
      speedDown: Number(profile.speedDown),
      speedUp: Number(profile.speedUp),
      sessionTimeout: Number(profile.sessionTimeout),
      idleTimeout: Number(profile.idleTimeout),
      maxSessions: Number(profile.maxSessions),
    });
    setIsModalOpen(true);
  };

  const openCloneModal = (profile: Profile) => {
    setEditingProfile({
      ...profile,
      id: undefined,
      profileName: `${profile.profileName} (copy)`,
      speedDown: Number(profile.speedDown),
      speedUp: Number(profile.speedUp),
      sessionTimeout: Number(profile.sessionTimeout),
      idleTimeout: Number(profile.idleTimeout),
      maxSessions: Number(profile.maxSessions),
    });
    setIsModalOpen(true);
  };

  const deleteTargetUsage = deleteTarget?.id != null ? usageMap.get(deleteTarget.id) : undefined;

  return (
    <div className="w-full min-w-0 space-y-5">
      <PageHeader
        title={t("profiles.title")}
        subtitle={t("profiles.subtitle")}
        icon={Network}
        actions={(
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <IconActionButton
              label={isRefreshing ? "Refreshing..." : "Refresh"}
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              icon={<RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
            />
            <IconActionButton
              label="Add Profile"
              onClick={() => {
                setEditingProfile(undefined);
                setIsModalOpen(true);
              }}
              variant="default"
              icon={<Plus className="h-4 w-4" />}
            />
          </div>
        )}
      />

      <QueryState
        isLoading={isLoading}
        error={error}
        // only show empty state when there are truly no profiles in the system
        isEmpty={!isLoading && !error && allProfiles.length === 0}
        onRetry={() => refetch()}
        loading={
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i} className="border-border/80 shadow-none">
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="mt-2 h-8 w-20" />
                    <Skeleton className="mt-2 h-3 w-28" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden border-border/80 shadow-none">
                  <Skeleton className="h-24 w-full" />
                  <div className="space-y-3 p-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        }
        errorTitle="Error loading profiles"
        emptyTitle="No profiles yet"
        emptyDescription="Create your first profile plan."
      >
        {/* KPI cards */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Profiles"
            value={<CountUpNumber value={totals.totalProfiles} />}
            sublabel="Configured speed plans"
            icon={<Layers className="h-4 w-4" />}
          />
          <StatCard
            label="Assigned users"
            value={<CountUpNumber value={totals.assignedUsers} />}
            sublabel={`${totals.activeUsers.toLocaleString()} active accounts`}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Revenue potential"
            value={<CountUpNumber value={totals.revenue} />}
            sublabel="Price × assigned users, per month"
            icon={<CircleDollarSign className="h-4 w-4" />}
          />
          <StatCard
            label="Fastest plan"
            value={formatSpeed(totals.fastest?.speedDown)}
            sublabel={totals.fastest ? totals.fastest.profileName : "No plans yet"}
            icon={<Gauge className="h-4 w-4" />}
          />
        </div>

        {/* Search & sort */}
        <Card className="border-border/80 shadow-none">
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="order-1 w-full md:w-[70%]">
                <SearchBar
                  currentSearchTerm={searchTerm}
                  onSearch={(term) => setSearchTerm(term)}
                  placeholder="Search profiles by name..."
                />
              </div>
              <div className="order-2 hidden min-w-0 flex-1 justify-end text-sm text-muted-foreground md:flex">
                {visibleProfiles.length} of {allProfiles.length} profile{allProfiles.length !== 1 ? "s" : ""}
              </div>
              <div className="order-3 w-full border-t border-border/60 pt-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
                    <ArrowDownUp className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Sort by</span>
                  </div>
                  <FilterPills
                    name="profiles-sort"
                    value={sortBy}
                    onChange={(value) => setSortBy(value as SortKey)}
                    options={[
                      { value: "name", label: "Name" },
                      { value: "price", label: "Price" },
                      { value: "speed", label: "Speed" },
                      { value: "users", label: "Users" },
                    ]}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {visibleProfiles.map(profile => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              usage={profile.id != null ? usageMap.get(profile.id) : undefined}
              onEdit={() => openEditModal(profile)}
              onClone={() => openCloneModal(profile)}
              onDelete={() => setDeleteTarget(profile)}
            />
          ))}
        </div>
        {visibleProfiles.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No profiles found"
            description={searchTerm ? "Try adjusting your search" : "Create your first profile"}
            actionLabel={searchTerm ? "Clear search" : "Add Profile"}
            onAction={() => {
              if (searchTerm) setSearchTerm("");
              else setIsModalOpen(true);
            }}
          />
        ) : null}
      </QueryState>

      <ActionConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Delete profile "${deleteTarget?.profileName ?? ""}"?`}
        description={
          deleteTargetUsage && deleteTargetUsage.usersCount > 0
            ? `${deleteTargetUsage.usersCount.toLocaleString()} user(s) are still assigned to this profile. The server will refuse the delete until they are reassigned.`
            : "This cannot be undone."
        }
        confirmText="Delete"
        confirmTone="destructive"
        onConfirm={() => {
          if (deleteTarget?.id != null) deleteProfile(deleteTarget.id);
        }}
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <ProfileFormModal
          profile={editingProfile}
          onSave={handleSaveProfile}
          onClose={() => {
            setIsModalOpen(false);
            setEditingProfile(undefined);
          }}
        />
      </Dialog>
    </div>
  );
};

export default ProfilesComponent;
