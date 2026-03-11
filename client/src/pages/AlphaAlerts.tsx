import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Bell, BellRing, Plus, Trash2, RotateCcw, Zap,
  ArrowUp, ArrowDown, TrendingUp, TrendingDown, Clock,
} from "lucide-react";


export default function AlphaAlerts() {

  const [newTicker, setNewTicker] = useState("");
  const [newCondition, setNewCondition] = useState<string>("crosses_above");
  const [newThreshold, setNewThreshold] = useState("75");
  const [newLabel, setNewLabel] = useState("");

  const utils = trpc.useUtils();

  const { data: alerts, isLoading } = trpc.intelligence.getAlphaAlerts.useQuery(
    undefined,
    { refetchInterval: 30000 }
  );

  const createAlert = trpc.intelligence.createAlphaAlert.useMutation({
    onSuccess: () => {
      utils.intelligence.getAlphaAlerts.invalidate();
      setNewTicker("");
      setNewThreshold("75");
      setNewLabel("");
      // Alert created successfully
    },
  });

  const deleteAlert = trpc.intelligence.deleteAlphaAlert.useMutation({
    onSuccess: () => {
      utils.intelligence.getAlphaAlerts.invalidate();
      // Alert deleted
    },
  });

  const toggleAlert = trpc.intelligence.toggleAlphaAlert.useMutation({
    onSuccess: () => {
      utils.intelligence.getAlphaAlerts.invalidate();
    },
  });

  const resetAlert = trpc.intelligence.resetAlphaAlert.useMutation({
    onSuccess: () => {
      utils.intelligence.getAlphaAlerts.invalidate();
      // Alert reset
    },
  });

  const handleCreate = () => {
    const threshold = parseInt(newThreshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 100) {
      alert("Invalid threshold: must be 0-100");
      return;
    }
    createAlert.mutate({
      ticker: newTicker.trim().toUpperCase() || null,
      condition: newCondition as any,
      threshold,
      label: newLabel.trim() || undefined,
    });
  };

  const activeAlerts = (alerts || []).filter((a: any) => a.isActive && !a.triggered);
  const triggeredAlerts = (alerts || []).filter((a: any) => a.triggered);
  const inactiveAlerts = (alerts || []).filter((a: any) => !a.isActive && !a.triggered);

  const conditionIcon = (condition: string) => {
    switch (condition) {
      case "above": return <ArrowUp className="h-3 w-3" />;
      case "below": return <ArrowDown className="h-3 w-3" />;
      case "crosses_above": return <TrendingUp className="h-3 w-3" />;
      case "crosses_below": return <TrendingDown className="h-3 w-3" />;
      default: return <Zap className="h-3 w-3" />;
    }
  };

  const conditionLabel = (condition: string) => {
    switch (condition) {
      case "above": return "is above";
      case "below": return "is below";
      case "crosses_above": return "crosses above";
      case "crosses_below": return "crosses below";
      default: return condition;
    }
  };

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BellRing className="h-6 w-6 text-amber-400" />
          Alpha Score Alerts
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Get notified when tickers hit Alpha Score thresholds
        </p>
      </div>

      {/* Create New Alert */}
      <Card className="border-purple-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-purple-400" />
            Create Alert Rule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Ticker (blank = any)</label>
              <Input
                placeholder="e.g. AAPL"
                value={newTicker}
                onChange={(e) => setNewTicker(e.target.value)}
                className="w-28 h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Condition</label>
              <Select value={newCondition} onValueChange={setNewCondition}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Score is above</SelectItem>
                  <SelectItem value="below">Score is below</SelectItem>
                  <SelectItem value="crosses_above">Crosses above</SelectItem>
                  <SelectItem value="crosses_below">Crosses below</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Threshold (0-100)</label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="75"
                value={newThreshold}
                onChange={(e) => setNewThreshold(e.target.value)}
                className="w-20 h-9"
              />
            </div>
            <div className="space-y-1 flex-1 min-w-[150px]">
              <label className="text-xs text-muted-foreground">Label (optional)</label>
              <Input
                placeholder="Custom label..."
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={createAlert.isPending}
              className="h-9 gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Alert
            </Button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2 mt-4">
            <p className="text-xs text-muted-foreground self-center">Quick presets:</p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setNewTicker("");
                setNewCondition("crosses_above");
                setNewThreshold("80");
                setNewLabel("Any ticker enters high-alpha zone");
              }}
            >
              Any ticker &gt; 80
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setNewTicker("AAPL");
                setNewCondition("crosses_below");
                setNewThreshold("40");
                setNewLabel("AAPL drops to low alpha");
              }}
            >
              AAPL drops below 40
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setNewTicker("TSLA");
                setNewCondition("crosses_above");
                setNewThreshold("75");
                setNewLabel("TSLA enters top opportunities");
              }}
            >
              TSLA enters top opps
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => {
                setNewTicker("NVDA");
                setNewCondition("above");
                setNewThreshold("70");
                setNewLabel("NVDA high alpha alert");
              }}
            >
              NVDA above 70
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Triggered Alerts */}
      {triggeredAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-amber-400 flex items-center gap-1.5">
            <BellRing className="h-4 w-4" />
            Triggered ({triggeredAlerts.length})
          </h2>
          {triggeredAlerts.map((alert: any) => (
            <Card key={alert.id} className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-full bg-amber-500/10">
                      <BellRing className="h-4 w-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{alert.label}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/30">
                          {conditionIcon(alert.condition)}
                          <span className="ml-1">{alert.ticker || "Any"} {conditionLabel(alert.condition)} {alert.threshold}</span>
                        </Badge>
                        {alert.triggerContext && (
                          <span className="text-xs text-muted-foreground">{alert.triggerContext}</span>
                        )}
                      </div>
                      {alert.triggeredAt && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Triggered {new Date(alert.triggeredAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1"
                      onClick={() => resetAlert.mutate({ id: alert.id })}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAlert.mutate({ id: alert.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Active Alerts */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-emerald-400 flex items-center gap-1.5">
          <Bell className="h-4 w-4" />
          Active ({activeAlerts.length})
        </h2>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-10 bg-muted/30 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))
        ) : activeAlerts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No active alerts</p>
              <p className="text-xs mt-1">Create an alert rule above to get started</p>
            </CardContent>
          </Card>
        ) : (
          activeAlerts.map((alert: any) => (
            <Card key={alert.id} className="border-emerald-500/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-full bg-emerald-500/10">
                      <Bell className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{alert.label}</p>
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {conditionIcon(alert.condition)}
                        <span className="ml-1">{alert.ticker || "Any"} {conditionLabel(alert.condition)} {alert.threshold}</span>
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={alert.isActive}
                      onCheckedChange={(checked) => toggleAlert.mutate({ id: alert.id, isActive: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAlert.mutate({ id: alert.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Inactive Alerts */}
      {inactiveAlerts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            Paused ({inactiveAlerts.length})
          </h2>
          {inactiveAlerts.map((alert: any) => (
            <Card key={alert.id} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-full bg-muted">
                      <Bell className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{alert.label}</p>
                      <Badge variant="outline" className="text-xs mt-0.5">
                        {alert.ticker || "Any"} {conditionLabel(alert.condition)} {alert.threshold}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={alert.isActive}
                      onCheckedChange={(checked) => toggleAlert.mutate({ id: alert.id, isActive: checked })}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteAlert.mutate({ id: alert.id })}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
