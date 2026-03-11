import { Brain, Home, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      {/* Subtle glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, oklch(0.55 0.22 260), transparent 70%)' }} />

      <div className="relative text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
          <Brain className="w-8 h-8 text-primary/60" />
        </div>

        <div className="font-mono text-6xl font-bold text-foreground/10 mb-2">404</div>

        <h1 className="font-display text-2xl font-bold mb-3">Page Not Found</h1>

        <p className="text-sm text-muted-foreground/60 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
          <br />
          Let's get you back on track.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted/10 border border-border/20 text-sm font-medium text-foreground/70 hover:bg-muted/20 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
