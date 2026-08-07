import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Edit, Trash2, CalendarPlus } from 'lucide-react';
import Loader from '@/components/ui/loader';
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import type { User } from "@/types/api";
import { getUserHealth } from "@/lib/userHealth";
import MonthlyCycleCell from "@/components/MonthlyCycleCell";

interface UserCardProps {
    user: User;
    onEdit: () => void;
    onDelete: () => void;
    onResetMAC?: () => void;
    onResetQuota?: () => void;
    onResetMonthly?: () => void;
    onRenew?: () => void;
    isResettingMAC?: boolean;
    isSelected?: boolean;
    onToggleSelected?: (selected: boolean) => void;
    canManageUsers?: boolean;
    manageUsersReason?: string;
    canResetMac?: boolean;
    canResetDailyQuota?: boolean;
    canResetMonthlyQuota?: boolean;
}

const UserCard: React.FC<UserCardProps> = ({
    user,
    onEdit,
    onDelete,
    onResetMAC,
    onResetQuota,
    onResetMonthly,
    onRenew,
    isResettingMAC,
    isSelected,
    onToggleSelected,
    canManageUsers = true,
    manageUsersReason = "You don't have permission to manage users.",
    canResetMac = true,
    canResetDailyQuota = true,
    canResetMonthlyQuota = true,
}) => {
    const router = useRouter();
    const health = getUserHealth(user);
    // const dailyUsagePercentage = user.profile.dailyQuota ? (user.profile.dailyUsage / user.profile.dailyQuota) * 100 : 0;
    // const monthlyUsagePercentage = user.profile.monthlyQuota ? (user.monthlyUsage / user.profile.monthlyQuota) * 100 : 0;

    return (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                        <Checkbox
                            checked={Boolean(isSelected)}
                            onCheckedChange={(v) => onToggleSelected?.(Boolean(v))}
                            aria-label="Select user"
                        />
                    <button
                        type="button"
                        className="min-w-0 text-left hover:underline truncate"
                        onClick={() => router.push(`/users/${encodeURIComponent(user.username)}`)}
                        title="View user"
                    >
                        {user.username}
                    </button>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <Badge variant={user.isOnline ? "success" : "secondary"}>
                            {user.isOnline ? "Online" : "Offline"}
                        </Badge>
                        <Badge
                            variant="outline"
                            className={
                                health.level === "healthy"
                                    ? "border-emerald-500 text-emerald-600"
                                    : health.level === "warning"
                                      ? "border-amber-500 text-amber-600"
                                      : "border-red-500 text-red-600"
                            }
                            title={health.reason}
                        >
                            {health.label}
                        </Badge>
                    </div>
                </CardTitle>
                <CardDescription>{user.userDetails?.fullName || 'N/A'}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <div>
                        <span className="font-semibold">Profile:</span>{" "}
                        {user.profile?.profileName ?? '—'}
                    </div>
                    <div>
                        <span className="font-semibold">MAC Address:</span>{" "}
                        {user.macAddress?.macAddress ?? 'Not set'}
                    </div>
                    <div>
                        <span className="font-semibold">Monthly cycle:</span>
                        <div className="mt-1">
                            <MonthlyCycleCell
                                monthlyUsage={user.monthlyUsage}
                                monthlyQuota={user.profile?.monthlyQuota}
                                monthlyCycleStart={user.monthlyCycleStart}
                                monthlyCycleResetAt={user.monthlyCycleResetAt}
                                quotaResetDay={user.quotaResetDay}
                                quotaCycleStartDate={user.quotaCycleStartDate}
                                isMonthlyExceeded={user.isMonthlyExceeded}
                                isMonthlyExceededComputed={user.isMonthlyExceededComputed}
                                monthlyUsagePct={user.monthlyUsagePct}
                            />
                        </div>
                    </div>
                    <div>
                        <span className="font-semibold">Last Active:</span>{" "}
                        {user.lastTimeActive
                            ? new Date(user.lastTimeActive).toLocaleString()
                            : "—"}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="w-full justify-center" onClick={onEdit} disabled={!canManageUsers} title={!canManageUsers ? manageUsersReason : "Edit user"}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
                {onResetMAC ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center"
                        onClick={onResetMAC}
                        disabled={Boolean(isResettingMAC) || !canManageUsers || !canResetMac}
                        title={
                            !canManageUsers
                                ? manageUsersReason
                                : !canResetMac
                                  ? "No MAC is currently bound for this user."
                                  : "Reset MAC"
                        }
                    >
                        {isResettingMAC ? <Loader /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Reset MAC
                    </Button>
                ) : null}
                {onResetQuota ? (
                    <Button variant="outline" size="sm" className="w-full justify-center" onClick={onResetQuota} disabled={!canResetDailyQuota} title={!canResetDailyQuota ? "You don't have permission to reset daily quota." : "Reset daily quota"}>
                        <RefreshCw className="w-4 h-4 mr-2" /> Reset Quota
                    </Button>
                ) : null}
                {onResetMonthly ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="col-span-2 w-full justify-center"
                        onClick={onResetMonthly}
                        disabled={!canResetMonthlyQuota}
                        title={!canResetMonthlyQuota ? "You don't have permission to reset monthly quota." : "Reset Monthly Traffic"}
                    >
                        <RefreshCw className="w-4 h-4 mr-2" /> Reset Monthly
                    </Button>
                ) : null}
                {onRenew ? (
                    <Button
                        variant="secondary"
                        size="sm"
                        className="col-span-2 w-full justify-center"
                        onClick={onRenew}
                        disabled={!canManageUsers}
                        title={
                            !canManageUsers
                                ? manageUsersReason
                                : "Add 1 calendar month, set active, and request disconnect"
                        }
                    >
                        <CalendarPlus className="w-4 h-4 mr-2" /> Renew +1 month
                    </Button>
                ) : null}
                <Button variant="outline" size="sm" className="w-full justify-center text-red-600" onClick={onDelete} disabled={!canManageUsers} title={!canManageUsers ? manageUsersReason : "Delete user"}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                </Button>
            </CardFooter>
        </Card>
    );
};

export default UserCard;