import { useState } from "react";
import { Share2, Check, Copy, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface ShareButtonProps {
  reportType: "backtest" | "portfolio";
  title: string;
  getData: () => string;
}

export function ShareButton({ reportType, title, getData }: ShareButtonProps) {
  const { isAuthenticated } = useAuth();
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  const createShare = trpc.watchlist.shareCreate.useMutation({
    onSuccess: (result) => {
      const url = `${window.location.origin}/shared/${result.shareId}`;
      setShareUrl(url);
    },
  });

  const handleShare = async () => {
    if (!isAuthenticated) {
      // Show toast or message that login is required
      return;
    }
    setShowPanel(true);
    if (!shareUrl) {
      const data = getData();
      createShare.mutate({ reportType, title, data });
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        disabled={!isAuthenticated}
        className="gap-1.5 text-xs"
      >
        <Share2 className="w-3.5 h-3.5" />
        Share
      </Button>

      {showPanel && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setShowPanel(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-border/40 bg-surface/95 backdrop-blur-xl shadow-xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Share Report</span>
            </div>

            {createShare.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating share link...
              </div>
            ) : shareUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 text-xs font-mono bg-background/60 border border-border/30 rounded-md px-2.5 py-1.5 text-foreground/80 truncate"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="shrink-0 gap-1 text-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground/60">
                  Anyone with this link can view this report. Link expires in 30 days.
                </p>
              </div>
            ) : createShare.isError ? (
              <p className="text-xs text-rose">Failed to create share link. Please try again.</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
