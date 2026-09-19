import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { FaCheckCircle } from 'react-icons/fa';
import Link from "next/link";
import type { InboxNotification, InboxNotificationCategory } from '@/types/notifications';
import { cn } from '@/lib/utils';

interface NotificationPopupProps {
  isOpen: boolean;
  notifications: InboxNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onViewAll: () => void;
}

function categoryLabel(c: InboxNotificationCategory): string {
  switch (c) {
    case 'invoice':
      return 'Invoice';
    case 'external_invoice':
      return 'External';
    case 'pay_due':
      return 'Pay due';
    case 'user_status':
      return 'Status';
    default:
      return 'System';
  }
}

const notificationVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
      ease: 'easeIn',
    },
  },
};

export const NotificationPopup: React.FC<NotificationPopupProps> = ({
  isOpen,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onViewAll,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={notificationVariants}
          className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover text-popover-foreground shadow-lg dark:shadow-[var(--shop-shadow-lg,0_20px_50px_rgba(0,0,0,0.45))]"
        >
          <div className="border-b border-border p-4">
            <div className="flex justify-between items-center gap-2">
              <h3 className="font-semibold text-lg">Notifications</h3>
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="text-sm text-blue-500 hover:text-blue-600 whitespace-nowrap"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'border-b border-border p-4',
                    !notification.read ? 'bg-muted/80' : ''
                  )}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">
                          {categoryLabel(notification.category)}
                        </span>
                        {!notification.read ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />
                        ) : null}
                      </div>
                      <h4 className="font-medium text-sm mt-0.5">{notification.title}</h4>
                      <p className="mt-1 text-sm text-muted-foreground">{notification.body}</p>
                      <p className="mt-1 text-xs text-muted-foreground/90">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                      {notification.href ? (
                        <Link
                          href={notification.href}
                          className="text-xs text-blue-500 hover:text-blue-600 mt-2 inline-block"
                          onClick={() => onMarkAsRead(notification.id)}
                        >
                          Open
                        </Link>
                      ) : null}
                    </div>
                    {!notification.read && (
                      <button
                        type="button"
                        onClick={() => onMarkAsRead(notification.id)}
                        className="shrink-0 p-1 text-muted-foreground hover:text-primary"
                        aria-label="Mark as read"
                      >
                        <FaCheckCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <FaCheckCircle className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No notifications</p>
                <p className="text-xs text-muted-foreground/70">You&apos;re all caught up</p>
              </div>
            )}
          </div>

          <div className="border-t border-border p-4">
            <button type="button" onClick={onViewAll} className="w-full text-center text-blue-500 hover:text-blue-600">
              View all in inbox
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
