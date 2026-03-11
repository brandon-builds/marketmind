import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useKeyboardShortcuts, KeyboardShortcutsModal } from "./components/KeyboardShortcuts";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import Home from "./pages/Home";
import TickerDeepDive from "./pages/TickerDeepDive";
import ModelPerformance from "./pages/ModelPerformance";
import Narratives from "./pages/Narratives";
import Predictions from "./pages/Predictions";
import DataSources from "./pages/DataSources";
import Compare from "./pages/Compare";
import Backtest from "./pages/Backtest";
import Portfolio from "./pages/Portfolio";
import Watchlist from "./pages/Watchlist";
import Settings from "./pages/Settings";
import SharedReport from "./pages/SharedReport";
import AdminAnalytics from "./pages/AdminAnalytics";
import CollabWatchlists from "./pages/CollabWatchlists";
import ModelWeights from "./pages/ModelWeights";
import Reports from "./pages/Reports";
import Snapshot from "./pages/Snapshot";
import VipSignals from "./pages/VipSignals";
import AlphaLeaderboard from "./pages/AlphaLeaderboard";
import TradeJournal from "./pages/TradeJournal";
import AlphaAlerts from "./pages/AlphaAlerts";
import AlphaBacktest from "./pages/AlphaBacktest";
import DailyDigest from "./pages/DailyDigest";
import StrategyBuilder from "./pages/StrategyBuilder";
import CorrelationMatrix from "./pages/CorrelationMatrix";
import StrategyMarketplace from "./pages/StrategyMarketplace";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/ticker/:symbol">{(params) => <TickerDeepDive symbol={params.symbol} />}</Route>
      <Route path="/model-performance" component={ModelPerformance} />
      <Route path="/narratives" component={Narratives} />
      <Route path="/predictions" component={Predictions} />
      <Route path="/data-sources" component={DataSources} />
      <Route path="/compare" component={Compare} />
      <Route path="/watchlist" component={Watchlist} />
      <Route path="/backtest" component={Backtest} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/settings" component={Settings} />
      <Route path="/shared/:shareId" component={SharedReport} />
      <Route path="/admin" component={AdminAnalytics} />
      <Route path="/collab" component={CollabWatchlists} />
      <Route path="/model-weights" component={ModelWeights} />
      <Route path="/reports" component={Reports} />
      <Route path="/vip-signals" component={VipSignals} />
      <Route path="/alpha-leaderboard" component={AlphaLeaderboard} />
      <Route path="/trade-journal" component={TradeJournal} />
      <Route path="/alpha-alerts" component={AlphaAlerts} />
      <Route path="/alpha-backtest" component={AlphaBacktest} />
      <Route path="/daily-digest" component={DailyDigest} />
      <Route path="/strategy-builder" component={StrategyBuilder} />
      <Route path="/correlation" component={CorrelationMatrix} />
      <Route path="/strategy-marketplace" component={StrategyMarketplace} />
      <Route path="/snapshot/:id" component={Snapshot} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { showHelp, setShowHelp } = useKeyboardShortcuts();
  return (
    <>
      <TooltipProvider>
        <Toaster />
        <Router />
        <KeyboardShortcutsModal open={showHelp} onClose={() => setShowHelp(false)} />
        <PWAInstallPrompt />
      </TooltipProvider>
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        switchable
      >
        <AppContent />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
