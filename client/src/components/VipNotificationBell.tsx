/**
 * VipNotificationBell — Header notification bell for VIP tweet alerts
 * Shows unread count badge and dropdown with recent VIP notifications
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, X, Crown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";

export function VipNotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = trpc.intelligence.getVipNotifications.useQuery(
    { limit: 10 },
    { refetchInterval: 15000 }
  );

  const markRead = trpc.intelligence.markVipNotificationsRead.useMutation({
    onSuccess: () => {
      utils.intelligence.getVipNotifications.invalidate();
    },
  });

  const utils = trpc.useUtils();

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = data?.unreadCount || 0;
  const notifications = data?.notifications || [];

  const handleOpen = () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      markRead.mutate();
    }
  };

  const sentimentIcon = {
    bullish: <TrendingUp className="w-3 h-3 text-emerald-400" />,
    bearish: <TrendingDown className="w-3 h-3 text-rose-400" />,
    neutral: <Minus className="w-3 h-3 text-amber-400" />,
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors"
        title="VIP Notifications"
      >
        <Bell className="w-4 h-4 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-violet-500 text-[8px] font-bold text-white flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-border/50 bg-card shadow-2xl z-50"
          >
            <div className="p-3 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-bold text-foreground">VIP Alerts</span>
              </div>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-muted/50">
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground/50">No VIP alerts yet</p>
                <p className="text-[10px] text-muted-foreground/30 mt-1">Monitoring high-signal accounts</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {notifications.map((n: any) => (
                  <Link key={n.id} href={`/predictions?ticker=${n.ticker}`}>
                    <div className={`p-3 hover:bg-muted/30 transition-colors cursor-pointer ${!n.read ? "bg-violet-500/5" : ""}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-violet-400">@{n.handle}</span>
                        <span className="text-[9px] text-muted-foreground">{n.displayName}</span>
                        {sentimentIcon[n.sentiment as keyof typeof sentimentIcon]}
                      </div>
                      <p className="text-[11px] text-foreground/80 line-clamp-2 mb-1">{n.content}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono">
                          ${n.ticker}
                        </span>
                        <span className="text-[9px] text-muted-foreground/50">
                          {new Date(n.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="p-2 border-t border-border/30">
              <Link href="/vip-signals">
                <button className="w-full text-center text-[10px] text-violet-400 hover:text-violet-300 py-1 transition-colors">
                  View all VIP signals
                </button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
