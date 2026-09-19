"use client";

import { useRef, useState, useEffect } from "react";
import DarkModeToggle from "./DarkModeToggle";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import { FaBell } from "react-icons/fa";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificationInboxStore } from "@/store/notificationInboxStore";
import { NotificationPopup } from "./NotificationPopup";
import { UserMenu } from "./UserMenu";
import HeaderAlertWidget from "./HeaderAlertWidget";

type TopBarActionsProps = {
  /** Supplied by the app shell; the AI button only renders when this is provided. */
  onToggleCopilot?: () => void;
  isCopilotOpen?: boolean;
};

const TopBarActions: React.FC<TopBarActionsProps> = ({ onToggleCopilot, isCopilotOpen = false }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [userInfo, setUserInfo] = useState<{ username: string; email: string; role: string } | null>(null);
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notifications = useNotificationInboxStore((s) => s.items);
  const markReadInbox = useNotificationInboxStore((s) => s.markRead);
  const markAllReadInbox = useNotificationInboxStore((s) => s.markAllRead);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchUserInfo = async () => {
    try {
      const response = await apiClient.get(`/auth/profile`);
      setUserInfo(response.data.data);
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const getUserInitials = () => {
    if (userInfo?.username) {
      return userInfo.username.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const navigate = (path: string) => {
    router.push(path);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUserInfo();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (parentRef.current && !parentRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative flex shrink-0 items-center gap-2" ref={parentRef}>
      {onToggleCopilot ? (
        <button
          type="button"
          onClick={onToggleCopilot}
          className={cn(
            "relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-secondary/30 text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-secondary/70 hover:text-foreground hover:scale-105 active:scale-95",
            isCopilotOpen && "border-primary/40 bg-primary/10 text-primary"
          )}
          aria-label="AI Copilot"
          aria-expanded={isCopilotOpen}
          aria-controls="radius-copilot-drawer"
          title="AI Copilot"
        >
          <Bot className="h-4 w-4" />
        </button>
      ) : null}

      <HeaderAlertWidget />

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsNotificationOpen(!isNotificationOpen)}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-secondary/30 text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-secondary/70 hover:text-foreground hover:scale-105 active:scale-95"
          aria-label="Notifications"
        >
          <FaBell className="h-4 w-4 transition-transform duration-200 hover:rotate-12" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground shadow-sm animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <NotificationPopup
          isOpen={isNotificationOpen}
          notifications={notifications.slice(0, 12)}
          onMarkAsRead={(id) => markReadInbox(id)}
          onMarkAllAsRead={() => markAllReadInbox()}
          onViewAll={() => {
            setIsNotificationOpen(false);
            navigate("/notifications");
          }}
        />
      </div>

      <DarkModeToggle compact className="sm:hidden" />
      <DarkModeToggle className="hidden sm:inline-flex" />

      <div
        className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-gradient-to-tr from-primary via-indigo-600 to-purple-600 text-white font-bold text-xs shadow-sm ring-2 ring-primary/20 transition-all duration-200 hover:scale-105 hover:shadow-md hover:ring-primary/40 active:scale-95"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsMenuOpen((o) => !o);
          }
        }}
        aria-label="Open account menu"
      >
        <span className="select-none tracking-wider">
          {getUserInitials()}
        </span>
      </div>

      <UserMenu
        isOpen={isMenuOpen}
        userInfo={userInfo}
        onLogout={handleLogout}
        onNavigate={navigate}
        getUserInitials={getUserInitials}
      />
    </div>
  );
};

export default TopBarActions;
