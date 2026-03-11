import { useState, useRef, useEffect } from "react";
import { Bell, Check, CheckCheck, AlertTriangle, FileText, Mail, Users, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  alert_triggered: { icon: AlertTriangle, color: "text-amber-400", label: "Alert" },
  digest_sent: { icon: Mail, color: "text-blue-400", label: "Digest" },
  report_generated: { icon: FileText, color: "text-emerald-400", label: "Report" },
  collab_annotation: { icon: Users, color: "text-purple-400", label: "Collab" },
  collab_joined: { icon: Users, color: "text-purple-400", label: "Collab" },
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: unreadData } = trpc.watchlist.notificationsUnreadCount.useQuery(undefined, {
    refetchInterval: 15_000,
  });
  const { data: notifications, refetch } = trpc.watchlist.notificationsList.useQuery(undefined, {
    enabled: open,
  });

  const markRead = trpc.watchlist.notificationsMarkRead.useMutation({
    onSuccess: () => refetch(),
  });
  const markAllRead = trpc.watchlist.notificationsMarkAllRead.useMutation({
    onSuccess: () => refetch(),
  });

  const utils = trpc.useUtils();

  const unreadCount = unreadData?.count ?? 0;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkRead = (id: number) => {
    markRead.mutate({ notificationId: id }, {
      onSuccess: () => {
        utils.watchlist.notificationsUnreadCount.invalidate();
      }
    });
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate(undefined, {
      onSuccess: () => {
        utils.watchlist.notificationsUnreadCount.invalidate();
      }
    });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[480px] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto flex-1">
            {!notifications || notifications.length === 0 ? (
              <div className="py-12 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No notifications yet</p>
                <p className="text-xs text-slate-600 mt-1">
                  Alerts, digests, and reports will appear here
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const config = TYPE_CONFIG[n.type] || { icon: Bell, color: "text-slate-400", label: "System" };
                const Icon = config.icon;

                return (
                  <div
                    key={n.id}
                    className={`flex gap-3 px-4 py-3 border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors ${
                      !n.isRead ? "bg-slate-800/30" : ""
                    }`}
                  >
                    {/* Icon */}
                    <div className={`flex-shrink-0 mt-0.5 ${config.color}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm leading-snug ${!n.isRead ? "text-white font-medium" : "text-slate-300"}`}>
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                        </div>
                        {!n.isRead && (
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            className="flex-shrink-0 p-1 rounded hover:bg-slate-700 transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${config.color} bg-white/5`}>
                          {config.label}
                        </span>
                        <span className="text-[10px] text-slate-600">{timeAgo(n.createdAt)}</span>
                        {n.link && (
                          <Link
                            href={n.link}
                            onClick={() => {
                              if (!n.isRead) handleMarkRead(n.id);
                              setOpen(false);
                            }}
                            className="text-[10px] text-cyan-500 hover:text-cyan-400 flex items-center gap-0.5"
                          >
                            View <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Unread dot */}
                    {!n.isRead && (
                      <div className="flex-shrink-0 mt-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications && notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-slate-700/50 text-center">
              <span className="text-xs text-slate-500">
                Showing {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
