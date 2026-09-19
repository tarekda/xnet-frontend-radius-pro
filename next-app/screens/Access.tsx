import { useEffect, useMemo, useRef, useState } from "react";

import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { fetchPermissions, fetchRoles, fetchUserOverrides, searchAccessUsers, updateRolePermissions, updateUserOverrides, type AccessUserDto, type RoleDto, type UserOverride } from "@/api/access";
import { Shield } from "lucide-react";
import { notify } from "@/lib/notify";
import { MESSAGES } from "@/constants/messages";
import { useTranslation } from "react-i18next";

export default function AccessPage() {
  const { t } = useTranslation("screens");
  const { user } = useAuth();

  const canManage = can(user, "admin.access.manage");

  const [allPermissions, setAllPermissions] = useState<string[]>([]);
  const [roles, setRoles] = useState<RoleDto[]>([]);
  const [selectedRoleKey, setSelectedRoleKey] = useState<string>("");
  const [rolePermsDraft, setRolePermsDraft] = useState<Record<string, boolean>>({});

  const [userIdInput, setUserIdInput] = useState<string>("");
  const [userOverrides, setUserOverrides] = useState<UserOverride[]>([]);
  const [userMatches, setUserMatches] = useState<AccessUserDto[]>([]);
  const [userMatchesOpen, setUserMatchesOpen] = useState(false);
  const userSearchSeq = useRef(0);
  const userBoxRef = useRef<HTMLDivElement | null>(null);

  const selectedRole = useMemo(() => roles.find((r) => r.key === selectedRoleKey) ?? null, [roles, selectedRoleKey]);
  const sidebarPerms = useMemo(() => allPermissions.filter((p) => p.startsWith("ui.sidebar.")), [allPermissions]);
  const featurePerms = useMemo(() => allPermissions.filter((p) => !p.startsWith("ui.sidebar.")), [allPermissions]);

  useEffect(() => {
    if (!canManage) return;
    (async () => {
      const [perms, r] = await Promise.all([fetchPermissions(), fetchRoles()]);
      setAllPermissions(perms);
      setRoles(r);
      if (!selectedRoleKey && r[0]?.key) setSelectedRoleKey(r[0].key);
    })().catch((e) => {
      notify.error("Load failed", e?.message || MESSAGES.common.loadFailed);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManage]);

  useEffect(() => {
    if (!selectedRole) return;
    const next: Record<string, boolean> = {};
    for (const p of selectedRole.permissions) next[p] = true;
    setRolePermsDraft(next);
  }, [selectedRole]);

  // Close username autocomplete when clicking outside
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!userBoxRef.current) return;
      if (!userBoxRef.current.contains(e.target as Node)) {
        setUserMatchesOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // Username autocomplete for userId input
  useEffect(() => {
    const raw = userIdInput.trim();
    const isNumeric = raw !== "" && /^[0-9]+$/.test(raw);

    if (raw === "" || isNumeric) {
      setUserMatches([]);
      setUserMatchesOpen(false);
      return;
    }

    const seq = ++userSearchSeq.current;
    const t = setTimeout(() => {
      searchAccessUsers(raw, 20)
        .then((users) => {
          if (seq !== userSearchSeq.current) return;
          setUserMatches(users);
          setUserMatchesOpen(true);
        })
        .catch(() => {
          if (seq !== userSearchSeq.current) return;
          setUserMatches([]);
          setUserMatchesOpen(false);
        });
    }, 250);

    return () => clearTimeout(t);
  }, [userIdInput]);

  if (!canManage) {
    return (
      <div className="w-full space-y-6 py-6">
        <PageHeader title={t("access.title")} subtitle={t("access.subtitle_forbidden")} icon={Shield} />
        <Card>
          <CardContent className="p-6">Forbidden</CardContent>
        </Card>
      </div>
    );
  }

  const saveRole = async () => {
    if (!selectedRole) return;
    try {
      const perms = allPermissions.filter((p) => !!rolePermsDraft[p]);
      await updateRolePermissions(selectedRole.key, perms);
      const refreshed = await fetchRoles();
      setRoles(refreshed);
      notify.success("Saved", `Updated permissions for ${selectedRole.key}`);
    } catch (e: any) {
      notify.error("Save failed", e?.message || MESSAGES.common.saveFailed);
    }
  };

  const loadOverrides = async () => {
    const id = Number(userIdInput);
    if (!Number.isFinite(id)) {
      notify.error("Invalid userId", MESSAGES.validation.invalidUserId);
      return;
    }
    try {
      const o = await fetchUserOverrides(id);
      setUserOverrides(o);
      notify.success("Loaded", `Loaded overrides for user ${id}`);
    } catch (e: any) {
      notify.error("Load failed", e?.message || MESSAGES.common.loadFailed);
    }
  };

  const saveOverrides = async () => {
    const id = Number(userIdInput);
    if (!Number.isFinite(id)) {
      notify.error("Invalid userId", MESSAGES.validation.invalidUserId);
      return;
    }
    try {
      const cleaned = userOverrides
        .filter((o) => allPermissions.includes(o.permission))
        .map((o) => ({ permission: o.permission, effect: o.effect }));
      await updateUserOverrides(id, cleaned);
      notify.success("Saved", `Updated overrides for user ${id}`);
    } catch (e: any) {
      notify.error("Save failed", e?.message || MESSAGES.common.saveFailed);
    }
  };

  return (
    <div className="w-full space-y-6 py-6 sm:py-8 px-2 sm:px-0 animate-in fade-in-50">
      <PageHeader title={t("access.title")} subtitle={t("access.subtitle")} icon={Shield} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.map((r) => (
              <Button
                key={r.key}
                variant={r.key === selectedRoleKey ? "default" : "outline"}
                className="w-full justify-start"
                onClick={() => setSelectedRoleKey(r.key)}
              >
                {r.name} ({r.key})
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{selectedRole ? `Role permissions: ${selectedRole.name}` : "Role permissions"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-semibold mb-2">Feature permissions</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {featurePerms.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={!!rolePermsDraft[p]}
                        onCheckedChange={(v) => setRolePermsDraft((prev) => ({ ...prev, [p]: !!v }))}
                      />
                      <span className="font-mono">{p}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Sidebar tabs (show/hide)</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {sidebarPerms.map((p) => (
                    <label key={p} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={!!rolePermsDraft[p]}
                        onCheckedChange={(v) => setRolePermsDraft((prev) => ({ ...prev, [p]: !!v }))}
                      />
                      <span className="font-mono">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveRole} disabled={!selectedRole}>
                Save role permissions
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const r = await fetchRoles();
                    setRoles(r);
                    notify.success("Refreshed", "Reloaded roles");
                  } catch (e: any) {
                    notify.error("Refresh failed", e?.message || MESSAGES.common.actionFailed);
                  }
                }}
              >
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User overrides (allow/deny)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div ref={userBoxRef} className="relative sm:w-[320px]">
              <Input
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                aria-label="User ID or username for permission overrides"
                placeholder="User ID or username…"
                className="w-full"
                onFocus={() => {
                  if (userMatches.length > 0) setUserMatchesOpen(true);
                }}
              />
              {userMatchesOpen && userMatches.length > 0 ? (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-background shadow-md max-h-64 overflow-auto">
                  {userMatches.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                      onClick={() => {
                        setUserIdInput(String(u.id));
                        setUserMatchesOpen(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{u.username}</div>
                        <div className="text-xs text-muted-foreground">#{u.id}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">{u.email} {u.role ? `• ${u.role}` : ""}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <Button variant="outline" onClick={loadOverrides}>
              Load
            </Button>
            <Button onClick={saveOverrides}>
              Save overrides
            </Button>
            <Button
              variant="secondary"
              onClick={() => setUserOverrides((prev) => [...prev, { permission: allPermissions[0] ?? "", effect: "deny" }])}
              disabled={allPermissions.length === 0}
            >
              Add override
            </Button>
          </div>

          <div className="space-y-2">
            {userOverrides.length === 0 ? (
              <div className="text-sm text-muted-foreground">No overrides loaded.</div>
            ) : (
              userOverrides.map((o, idx) => (
                <div key={`${o.permission}-${idx}`} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={o.permission}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserOverrides((prev) => prev.map((x, i) => (i === idx ? { ...x, permission: val } : x)));
                    }}
                  >
                    {allPermissions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={o.effect}
                    onChange={(e) => {
                      const val = e.target.value as "allow" | "deny";
                      setUserOverrides((prev) => prev.map((x, i) => (i === idx ? { ...x, effect: val } : x)));
                    }}
                  >
                    <option value="allow">allow</option>
                    <option value="deny">deny</option>
                  </select>
                  <Button
                    variant="destructive"
                    onClick={() => setUserOverrides((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    Remove
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

