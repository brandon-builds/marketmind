# New User First 5 Minutes Experience Audit

## What the user sees first:
1. Onboarding tour modal with "Welcome to MarketMind" - GOOD
2. Background shows the full dashboard with ticker bar, navigation, etc.
3. Two CTAs: "Take the Product Tour" and "Skip — I'll explore on my own"
4. PWA install prompt at bottom right - DISTRACTING for new users

## Friction Points Identified:

### 1. PWA Install Prompt Competes with Onboarding
The PWA install prompt appears at the same time as the onboarding modal, creating visual clutter and competing for attention. New users shouldn't be asked to install the app before they've even seen what it does.
**Fix:** Delay PWA prompt until after onboarding is complete or user has visited 3+ pages.

### 2. Theme Toggle Not Immediately Obvious
The theme toggle says "Light" with a sun icon but it's small and could be missed.
Already enhanced in this round - labeled pill button added.

### 3. No Clear "What is this?" for Unauthenticated Users
When a new user lands on the dashboard without being logged in, they see all the data but no clear indication of what's personalized vs. what's public. No login CTA is prominently visible.
**Fix:** Add a subtle banner or CTA for unauthenticated users encouraging them to sign in for personalized features.

### 4. Quick-Add Ticker Buttons Could Be Confusing
The "+AAPL", "+NVDA" etc. buttons in the watchlist section don't have clear context for what they do.
**Fix:** Add a small tooltip or label "Quick add to watchlist" above the buttons.

### 5. Intelligence Stream Dominates Without Context
The activity feed shows signals and narratives but a new user doesn't know what "bullish signal" or "confidence" means in this context.
**Fix:** Add a small info tooltip on the first signal explaining the confidence score system.

### 6. Navigation Has Too Many Items
14 nav items is overwhelming. New users don't know where to start.
**Fix:** Group related items or highlight "Start Here" items.

### 7. Empty Watchlist Section
The watchlist section shows quick-add buttons but no explanation of what a watchlist is or why they should use it.
**Fix:** Add empty state messaging when no tickers are watched.
