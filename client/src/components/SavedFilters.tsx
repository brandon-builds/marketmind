import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
import { Bookmark, Plus, X, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

interface SavedFiltersProps {
  page: "narratives" | "predictions";
  currentFilters: Record<string, string>;
  onApply: (filters: Record<string, string>) => void;
}

export function SavedFilters({ page, currentFilters, onApply }: SavedFiltersProps) {
  const { isAuthenticated } = useAuth();
  const [showSave, setShowSave] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: filters, refetch } = trpc.watchlist.filtersList.useQuery(
    { page },
    { enabled: isAuthenticated }
  );

  const createMutation = trpc.watchlist.filtersCreate.useMutation({
    onSuccess: () => {
      refetch();
      setShowSave(false);
      setName("");
      setSaving(false);
      toast.success("Filter saved");
    },
    onError: () => {
      setSaving(false);
      toast.error("Failed to save filter");
    },
  });

  const deleteMutation = trpc.watchlist.filtersDelete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Filter removed");
    },
  });

  if (!isAuthenticated) return null;

  const handleSave = () => {
    if (!name.trim()) return;
    setSaving(true);
    createMutation.mutate({
      page,
      name: name.trim(),
      filters: JSON.stringify(currentFilters),
    });
  };

  const handleApply = (filterJson: string) => {
    try {
      const parsed = JSON.parse(filterJson);
      onApply(parsed);
      toast.success("Filter applied");
    } catch {
      toast.error("Invalid filter data");
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Saved filter pills */}
      {filters && filters.length > 0 && (
        <>
          <Bookmark className="w-3.5 h-3.5 text-muted-foreground/40" />
          {filters.map((f) => (
            <div
              key={f.id}
              className="group flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/5 border border-primary/15 hover:bg-primary/10 transition-colors cursor-pointer"
              onClick={() => handleApply(f.filters)}
            >
              <span className="text-[11px] font-medium text-foreground/70">{f.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteMutation.mutate({ filterId: f.id });
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5"
              >
                <X className="w-3 h-3 text-muted-foreground/50 hover:text-rose-400" />
              </button>
            </div>
          ))}
        </>
      )}

      {/* Save current button */}
      {showSave ? (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Filter name..."
            className="h-7 px-2 text-[11px] rounded-md bg-muted/10 border border-border/20 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 w-32"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="h-7 w-7 flex items-center justify-center rounded-md bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
            ) : (
              <Check className="w-3 h-3 text-primary" />
            )}
          </button>
          <button
            onClick={() => { setShowSave(false); setName(""); }}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted/10 transition-colors"
          >
            <X className="w-3 h-3 text-muted-foreground/50" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowSave(true)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted-foreground/40 hover:text-foreground/60 hover:bg-muted/10 transition-colors border border-transparent hover:border-border/15"
        >
          <Plus className="w-3 h-3" />
          Save Filter
        </button>
      )}
    </div>
  );
}
