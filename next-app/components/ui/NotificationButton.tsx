import React, { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Notification {
  id: number;
  message: string;
}

const NotificationButton: React.FC<{ className: string }> = ({ className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const popupRef = useRef<HTMLDivElement>(null);

  const togglePopup = () => setIsOpen(!isOpen);

  // Close Popup on Outside Click
  const handleClickOutside = (event: MouseEvent) => {
    if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  useFocusTrap(popupRef, isOpen);

  const clearNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell */}
      <button
        onClick={togglePopup}
        className="relative rounded-full p-2 bg-muted text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {notifications.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
            {notifications.length}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Notification Popup */}
      {isOpen && (
        <div
          ref={popupRef}
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover text-popover-foreground shadow-[var(--shop-shadow-lg)] z-50 animate-scale-in outline-none"
          role="dialog"
          aria-modal="true"
          aria-label="Notifications"
          tabIndex={-1}
        >
          <div className="border-b border-border p-4">
            <h3 className="text-sm font-semibold">Notifications</h3>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length > 0 ? (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    className="flex items-start gap-3 px-4 py-3 transition-colors duration-150 hover:bg-muted/50"
                  >
                    <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <span className="flex-1 text-sm text-foreground">{notification.message}</span>
                    <button
                      type="button"
                      onClick={() => clearNotification(notification.id)}
                      className="shrink-0 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      aria-label="Dismiss"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No notifications</p>
                <p className="text-xs text-muted-foreground/70">You&apos;re all caught up</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationButton;
