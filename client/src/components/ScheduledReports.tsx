import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  CalendarClock,
  Plus,
  Trash2,
  Send,
  Loader2,
  Check,
  X,
  Clock,
  FileText,
  BarChart3,
  Target,
  Newspaper,
  Briefcase,
  Globe,
  ToggleLeft,
  ToggleRight,
  Bell,
  Mail,
  MessageSquare,
} from "lucide-react";

const CONTENT_SECTIONS = [
  { id: "watchlist", label: "Watchlist", description: "Your tracked tickers", icon: FileText, color: "blue" },
  { id: "predictions", label: "Predictions", description: "Top AI predictions", icon: Target, color: "purple" },
  { id: "narratives", label: "Narratives", description: "Market narrative shifts", icon: Newspaper, color: "amber" },
  { id: "backtest", label: "Backtest", description: "Prediction accuracy", icon: BarChart3, color: "emerald" },
  { id: "portfolio", label: "Portfolio", description: "Holdings & exposure", icon: Briefcase, color: "rose" },
  { id: "market_overview", label: "Market Overview", description: "SPY, QQQ, sectors", icon: Globe, color: "cyan" },
];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily", description: "Every morning at 8 AM ET" },
  { value: "weekly_monday", label: "Weekly (Mon)", description: "Every Monday morning" },
  { value: "weekly_friday", label: "Weekly (Fri)", description: "Every Friday morning" },
  { value: "monthly", label: "Monthly", description: "1st of each month" },
];

const DELIVERY_METHODS = [
  { id: "notification", label: "In-App", description: "Platform notification", icon: Bell },
  { id: "email", label: "Email", description: "Deliver via email", icon: Mail },
  { id: "slack", label: "Slack", description: "Post to Slack channel", icon: MessageSquare },
];

function formatFrequency(freq: string): string {
  return FREQUENCY_OPTIONS.find((f) => f.value === freq)?.label || freq;
}

function formatLastSent(ts: number | null): string {
  if (!ts) return "Never";
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDeliveryMethod(method: string): string {
  const methods = method.split(",").map((m) => m.trim());
  return methods
    .map((m) => DELIVERY_METHODS.find((d) => d.id === m)?.label || m)
    .join(" + ");
}

export function ScheduledReports() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFrequency, setNewFrequency] = useState("weekly_monday");
  const [newSections, setNewSections] = useState<string[]>(["watchlist", "predictions", "narratives"]);
  const [newDeliveryMethods, setNewDeliveryMethods] = useState<string[]>(["notification"]);
  const [newEmail, setNewEmail] = useState("");
  const [newSlackUrl, setNewSlackUrl] = useState("");

  const utils = trpc.useUtils();

  const schedulesQuery = trpc.watchlist.schedulesList.useQuery(undefined, {
    retry: 1,
  });

  const createMutation = trpc.watchlist.schedulesCreate.useMutation({
    onSuccess: () => {
      toast.success("Report schedule created");
      utils.watchlist.schedulesList.invalidate();
      setShowCreate(false);
      setNewName("");
      setNewSections(["watchlist", "predictions", "narratives"]);
      setNewDeliveryMethods(["notification"]);
      setNewEmail("");
      setNewSlackUrl("");
    },
    onError: () => toast.error("Failed to create schedule"),
  });

  const updateMutation = trpc.watchlist.schedulesUpdate.useMutation({
    onSuccess: () => {
      toast.success("Schedule updated");
      utils.watchlist.schedulesList.invalidate();
    },
    onError: () => toast.error("Failed to update schedule"),
  });

  const deleteMutation = trpc.watchlist.schedulesDelete.useMutation({
    onSuccess: () => {
      toast.success("Schedule deleted");
      utils.watchlist.schedulesList.invalidate();
    },
    onError: () => toast.error("Failed to delete schedule"),
  });

  const sendNowMutation = trpc.watchlist.schedulesSendNow.useMutation();
  const testWebhookMutation = trpc.watchlist.testSlackWebhook.useMutation();

  const toggleSection = (sectionId: string) => {
    setNewSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((s) => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const toggleDeliveryMethod = (methodId: string) => {
    setNewDeliveryMethods((prev) => {
      if (prev.includes(methodId)) {
        const next = prev.filter((m) => m !== methodId);
        return next.length === 0 ? ["notification"] : next;
      }
      return [...prev, methodId];
    });
  };

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("Please enter a report name");
      return;
    }
    if (newSections.length === 0) {
      toast.error("Select at least one content section");
      return;
    }
    if (newDeliveryMethods.includes("email") && !newEmail.trim()) {
      toast.error("Please enter an email address for email delivery");
      return;
    }
    if (newDeliveryMethods.includes("slack") && !newSlackUrl.trim()) {
      toast.error("Please enter a Slack webhook URL for Slack delivery");
      return;
    }

    createMutation.mutate({
      name: newName.trim(),
      frequency: newFrequency as any,
      sections: newSections,
      deliveryMethod: newDeliveryMethods.join(","),
      deliveryEmail: newDeliveryMethods.includes("email") ? newEmail.trim() : undefined,
      slackWebhookUrl: newDeliveryMethods.includes("slack") ? newSlackUrl.trim() : undefined,
    });
  };

  const handleSendNow = (scheduleId: number, name: string) => {
    sendNowMutation.mutate(
      { scheduleId },
      {
        onSuccess: (data) => {
          if (data.success) toast.success(data.message);
          else toast.error(data.message);
          utils.watchlist.schedulesList.invalidate();
        },
        onError: () => toast.error("Failed to send report"),
      }
    );
  };

  const schedules = schedulesQuery.data || [];

  return (
    <section className="rounded-2xl border border-border/20 bg-card/30 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/15 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <CalendarClock className="w-4.5 h-4.5 text-indigo-400" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold">Scheduled Reports</h3>
            <p className="text-[11px] text-muted-foreground/60">
              Automated custom reports delivered on your schedule
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
        >
          {showCreate ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          {showCreate ? "Cancel" : "New Schedule"}
        </button>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Create Form */}
        {showCreate && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-4">
            <div>
              <label className="text-[11px] text-muted-foreground/60 block mb-1.5 font-medium">
                Report Name
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder='e.g., "Weekly Portfolio Summary" or "Daily Market Brief"'
                className="w-full px-3 py-2 rounded-lg bg-background/50 border border-border/20 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/30 transition-colors"
              />
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground/60 block mb-1.5 font-medium">
                Delivery Schedule
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {FREQUENCY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setNewFrequency(opt.value)}
                    className={`p-2.5 rounded-lg border text-left transition-all text-xs ${
                      newFrequency === opt.value
                        ? "bg-primary/10 border-primary/30"
                        : "bg-background/30 border-border/20 hover:border-border/40"
                    }`}
                  >
                    <div className="font-medium">{opt.label}</div>
                    <div className="text-[10px] text-muted-foreground/50 mt-0.5">
                      {opt.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-muted-foreground/60 block mb-1.5 font-medium">
                Content Sections
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CONTENT_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isSelected = newSections.includes(section.id);
                  return (
                    <button
                      key={section.id}
                      onClick={() => toggleSection(section.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary/30"
                          : "bg-background/30 border-border/20 hover:border-border/40"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary/20" : "bg-muted/20"
                      }`}>
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-muted-foreground/50"}`} />
                      </div>
                      <div>
                        <div className={`text-[11px] font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                          {section.label}
                        </div>
                        <div className="text-[9px] text-muted-foreground/40 leading-tight">
                          {section.description}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-3 h-3 text-primary ml-auto shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Delivery Method */}
            <div>
              <label className="text-[11px] text-muted-foreground/60 block mb-1.5 font-medium">
                Delivery Method
              </label>
              <p className="text-[10px] text-muted-foreground/40 mb-2">
                Select one or more delivery channels. Reports will be sent to all selected channels.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {DELIVERY_METHODS.map((method) => {
                  const Icon = method.icon;
                  const isSelected = newDeliveryMethods.includes(method.id);
                  return (
                    <button
                      key={method.id}
                      onClick={() => toggleDeliveryMethod(method.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary/30"
                          : "bg-background/30 border-border/20 hover:border-border/40"
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary/20" : "bg-muted/20"
                      }`}>
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-primary" : "text-muted-foreground/50"}`} />
                      </div>
                      <div>
                        <div className={`text-[11px] font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                          {method.label}
                        </div>
                        <div className="text-[9px] text-muted-foreground/40 leading-tight">
                          {method.description}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-3 h-3 text-primary ml-auto shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email field — shown when email delivery selected */}
            {newDeliveryMethods.includes("email") && (
              <div>
                <label className="text-[11px] text-muted-foreground/60 block mb-1.5 font-medium">
                  <Mail className="w-3 h-3 inline mr-1" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 rounded-lg bg-background/50 border border-border/20 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/30 transition-colors"
                />
                <p className="text-[10px] text-muted-foreground/30 mt-1">
                  Reports will be sent to this email address
                </p>
              </div>
            )}

            {/* Slack webhook field — shown when slack delivery selected */}
            {newDeliveryMethods.includes("slack") && (
              <div>
                <label className="text-[11px] text-muted-foreground/60 block mb-1.5 font-medium">
                  <MessageSquare className="w-3 h-3 inline mr-1" />
                  Slack Webhook URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={newSlackUrl}
                    onChange={(e) => setNewSlackUrl(e.target.value)}
                    placeholder="Enter your Slack incoming webhook URL"
                    className="flex-1 px-3 py-2 rounded-lg bg-background/50 border border-border/20 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-primary/30 transition-colors font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newSlackUrl.trim()) {
                        toast.error("Enter a webhook URL first");
                        return;
                      }
                      try {
                        new URL(newSlackUrl.trim());
                      } catch {
                        toast.error("Invalid URL format");
                        return;
                      }
                      testWebhookMutation.mutate(
                        { webhookUrl: newSlackUrl.trim() },
                        {
                          onSuccess: (data) => {
                            if (data.success) toast.success(data.message);
                            else toast.error(data.message);
                          },
                          onError: () => toast.error("Failed to test webhook"),
                        }
                      );
                    }}
                    disabled={testWebhookMutation.isPending || !newSlackUrl.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-medium text-amber-400 hover:bg-amber-500/15 transition-colors disabled:opacity-40 shrink-0"
                  >
                    {testWebhookMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Test
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/30 mt-1">
                  Create an Incoming Webhook in your Slack workspace settings. Click "Test" to verify it works.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/10">
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isPending || !newName.trim() || newSections.length === 0}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CalendarClock className="w-3.5 h-3.5" />
                )}
                Create Schedule
              </button>
            </div>
          </div>
        )}

        {/* Existing Schedules */}
        {schedulesQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary/40" />
          </div>
        ) : schedules.length === 0 && !showCreate ? (
          <div className="text-center py-8">
            <CalendarClock className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground/50 mb-1">No scheduled reports yet</p>
            <p className="text-[11px] text-muted-foreground/30">
              Create a schedule to receive automated market intelligence reports
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map((schedule) => (
              <div
                key={schedule.id}
                className={`rounded-xl border p-3.5 transition-all ${
                  schedule.enabled
                    ? "border-border/20 bg-background/30"
                    : "border-border/10 bg-muted/5 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold truncate">{schedule.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium border ${
                        schedule.enabled
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                          : "bg-muted/20 border-border/20 text-muted-foreground/40"
                      }`}>
                        {schedule.enabled ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatFrequency(schedule.frequency)}
                      </span>
                      <span>
                        {schedule.sections.length} section{schedule.sections.length !== 1 ? "s" : ""}
                      </span>
                      <span>
                        Last sent: {formatLastSent(schedule.lastSentAt)}
                      </span>
                    </div>
                    {/* Delivery method badges */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[9px] text-muted-foreground/40">Delivers via:</span>
                      {(schedule.deliveryMethod || "notification").split(",").map((m) => {
                        const method = DELIVERY_METHODS.find((d) => d.id === m.trim());
                        const Icon = method?.icon || Bell;
                        return (
                          <span
                            key={m}
                            className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded bg-primary/5 border border-primary/10 text-primary/60"
                          >
                            <Icon className="w-2.5 h-2.5" />
                            {method?.label || m.trim()}
                          </span>
                        );
                      })}
                      {schedule.deliveryEmail && (
                        <span className="text-[9px] text-muted-foreground/30 truncate max-w-[120px]" title={schedule.deliveryEmail}>
                          ({schedule.deliveryEmail})
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {schedule.sections.map((s) => {
                        const section = CONTENT_SECTIONS.find((cs) => cs.id === s);
                        return (
                          <span
                            key={s}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-muted/15 border border-border/15 text-muted-foreground/60"
                          >
                            {section?.label || s}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle enabled */}
                    <button
                      onClick={() =>
                        updateMutation.mutate({
                          scheduleId: schedule.id,
                          enabled: !schedule.enabled,
                        })
                      }
                      className="w-7 h-7 rounded-md hover:bg-muted/20 flex items-center justify-center transition-colors"
                      title={schedule.enabled ? "Pause schedule" : "Enable schedule"}
                    >
                      {schedule.enabled ? (
                        <ToggleRight className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 text-muted-foreground/40" />
                      )}
                    </button>
                    {/* Send now */}
                    <button
                      onClick={() => handleSendNow(schedule.id, schedule.name)}
                      disabled={sendNowMutation.isPending}
                      className="w-7 h-7 rounded-md hover:bg-primary/10 flex items-center justify-center transition-colors"
                      title="Send report now"
                    >
                      {sendNowMutation.isPending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary/40" />
                      ) : (
                        <Send className="w-3.5 h-3.5 text-primary/60 hover:text-primary" />
                      )}
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => {
                        if (confirm(`Delete schedule "${schedule.name}"?`)) {
                          deleteMutation.mutate({ scheduleId: schedule.id });
                        }
                      }}
                      className="w-7 h-7 rounded-md hover:bg-destructive/10 flex items-center justify-center transition-colors"
                      title="Delete schedule"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-destructive" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
