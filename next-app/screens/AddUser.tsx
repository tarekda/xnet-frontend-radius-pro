import React, { useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfiles, type Profile } from "@/hooks/useProfiles";
import useUsers, { AccountStatus } from "@/hooks/useUsers";
import { ArrowLeft, UserPlus, Eye, EyeOff, HardDrive, Calendar, DollarSign } from "lucide-react";
import { notify } from "@/lib/notify";
import { useTranslation } from "react-i18next";

const formatQuota = (quota: string) => {
  const bytes = parseInt(quota, 10);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
};

const PlanCard: React.FC<{
  profile: Profile;
  selected: boolean;
  onSelect: () => void;
}> = ({ profile, selected, onSelect }) => {
  const price = profile.price ?? 0;
  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
        selected
          ? "ring-2 ring-primary border-primary bg-primary/5"
          : "hover:border-primary/50 border-border"
      }`}
      onClick={onSelect}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{profile.profileName}</CardTitle>
        <CardDescription className="flex items-center gap-2">
          {price > 0 && (
            <span className="flex items-center gap-1 font-semibold text-primary">
              <DollarSign className="h-4 w-4" />
              {price.toLocaleString()} / month
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Daily:</span>
          <span className="font-medium">{formatQuota(profile.dailyQuota)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Monthly:</span>
          <span className="font-medium">{formatQuota(profile.monthlyQuota)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default function AddUserPage() {
  const { t } = useTranslation("screens");
  const router = useRouter();
  const { data: profilesData, isLoading: profilesLoading } = useProfiles();
  const { createUserMutation } = useUsers();

  const profiles = profilesData?.data ?? [];
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(AccountStatus.ACTIVE);
  const [quotaResetDay, setQuotaResetDay] = useState("1");
  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [expiryFramedIp, setExpiryFramedIp] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const profileId = selectedProfileId ? parseInt(selectedProfileId, 10) : -1;
    if (profileId < 1) {
      notify.error("Select a plan", "Please choose a plan for the user.");
      return;
    }
    createUserMutation.mutate(
      {
        username,
        password,
        profileId,
        accountStatus,
        quotaResetDay: parseInt(quotaResetDay, 10),
        ...(expiresAtLocal ? { expiresAt: new Date(expiresAtLocal).toISOString() } : {}),
        ...(expiryFramedIp.trim() ? { expiryFramedIp: expiryFramedIp.trim() } : {}),
        fullName: fullName || undefined,
        address: address || undefined,
        phoneNumber: phoneNumber || undefined,
        email: email || undefined,
      },
      {
        onSuccess: () => {
          notify.success("User created", `${username} has been added successfully.`);
          router.push("/users/list");
        },
        onError: (error) => {
          notify.error("Create failed", error.message);
        },
      }
    );
  };

  return (
    <div className="w-full space-y-6 py-6 sm:py-8 px-2 sm:px-0 animate-in fade-in-50">
      <PageHeader
        title={t("addUser.title")}
        subtitle={t("addUser.subtitle")}
        icon={UserPlus}
      />

      <div className="flex items-center gap-2 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/users/list")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Users
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Plan selection - left */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-lg font-semibold">Choose a plan</h3>
            <p className="text-sm text-muted-foreground">
              Select a plan to assign to this user. Each plan includes daily and monthly quotas.
            </p>
            {profilesLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader><div className="h-5 bg-muted rounded" /></CardHeader>
                    <CardContent><div className="h-16 bg-muted rounded" /></CardContent>
                  </Card>
                ))}
              </div>
            ) : profiles.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No plans available. Create plans in the Profiles section first.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {profiles.map((p) => (
                  <PlanCard
                    key={p.id}
                    profile={p}
                    selected={selectedProfileId === String(p.id)}
                    onSelect={() => setSelectedProfileId(String(p.id ?? ""))}
                  />
                ))}
              </div>
            )}
          </div>

          {/* User form - right */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>User details</CardTitle>
                <CardDescription>Enter the username, password, and optional contact information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. john_doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="flex gap-2">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="accountStatus">Account status</Label>
                    <Select value={accountStatus} onValueChange={(v) => setAccountStatus(v as AccountStatus)}>
                      <SelectTrigger id="accountStatus">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="terminated">Terminated</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quotaResetDay">Quota reset day (1–31)</Label>
                    <Input
                      id="quotaResetDay"
                      type="number"
                      min={1}
                      max={31}
                      value={quotaResetDay}
                      onChange={(e) => setQuotaResetDay(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="expiresAt">Access expires (optional)</Label>
                    <Input
                      id="expiresAt"
                      type="datetime-local"
                      value={expiresAtLocal}
                      onChange={(e) => setExpiresAtLocal(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      After this time, the account becomes expired and cannot connect until staff renews it.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryFramedIp">Optional framed IP (legacy)</Label>
                    <Input
                      id="expiryFramedIp"
                      value={expiryFramedIp}
                      onChange={(e) => setExpiryFramedIp(e.target.value)}
                      placeholder="e.g. 10.255.255.2"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone number</Label>
                    <Input
                      id="phoneNumber"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" disabled={createUserMutation.isPending || !selectedProfileId}>
                    {createUserMutation.isPending ? "Creating..." : "Create user"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push("/users/list")}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
