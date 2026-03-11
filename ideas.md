# MarketMind — Design Brainstorm

## Context
Bloomberg-inspired autonomous market intelligence dashboard. Dark theme, data-dense, premium feel. Must display: market sentiment, narrative intelligence, predictions, experiment logs, signal leaderboard, accuracy tracking.

---

<response>
<text>

## Idea 1: "Terminal Noir" — Brutalist Data Terminal

**Design Movement**: Neo-brutalist terminal aesthetic crossed with Bloomberg Terminal density

**Core Principles**:
1. Raw data supremacy — information is the decoration
2. Monospace authority — code-like precision conveys trust
3. Chromatic restraint — near-black canvas with surgical accent colors
4. Zero ornamentation — every pixel serves a data purpose

**Color Philosophy**: 
- Background: #0A0A0F (near-black with blue undertone)
- Surface: #12121A (elevated panels)
- Primary accent: #00FF88 (terminal green for positive/bullish)
- Danger: #FF3366 (hot pink-red for bearish/negative)
- Neutral data: #8B8FA3 (muted lavender-gray)
- Highlight: #FFD700 (gold for top-performing signals)

**Layout Paradigm**: Dense grid with no gaps — panels separated by 1px hairline borders like a Bloomberg terminal. Full viewport utilization with no wasted whitespace. Sidebar navigation collapsed to icon rail.

**Signature Elements**:
1. Blinking cursor indicators on live data feeds
2. Scanline overlay effect on hero sections
3. Monospace data tables with alternating row opacity

**Interaction Philosophy**: Keyboard-first navigation hints, hover reveals additional data layers, click-to-drill-down with breadcrumb trails

**Animation**: Typewriter text reveals for narratives, number counters that tick up/down like stock tickers, subtle pulse on live data points

**Typography System**: 
- Display: JetBrains Mono Bold for headers and data
- Body: IBM Plex Mono for tables and feeds
- Accent: Space Grotesk for labels and navigation

</text>
<probability>0.06</probability>
</response>

---

<response>
<text>

## Idea 2: "Obsidian Intelligence" — Luxury Dark Analytics

**Design Movement**: Swiss International Style meets luxury fintech — think Cartier meets Bloomberg

**Core Principles**:
1. Restrained elegance — premium through subtlety, not excess
2. Typographic hierarchy — size and weight create information architecture
3. Ambient depth — layered surfaces with soft luminance
4. Purposeful negative space — breathing room signals confidence

**Color Philosophy**:
- Background: #09090B (true dark with warm undertone)
- Surface 1: #111113 (card level)
- Surface 2: #1A1A1F (elevated modals)
- Primary: #3B82F6 → #60A5FA gradient (institutional blue)
- Success: #10B981 (emerald green, muted)
- Danger: #EF4444 (clear red, not aggressive)
- Gold accent: #F59E0B (for leaderboard/top signals)
- Text primary: #F4F4F5 (warm white)
- Text secondary: #71717A (zinc-500)

**Layout Paradigm**: Asymmetric dashboard with a prominent left column (60%) for primary content (sentiment, predictions) and a narrower right column (40%) for feeds and logs. Top bar with key metrics as a persistent ticker. Cards with generous internal padding and 1px borders with 5% white opacity.

**Signature Elements**:
1. Frosted glass panels with backdrop-blur on overlays
2. Thin gradient accent lines at card tops (2px, blue-to-transparent)
3. Radial gradient glow behind key metrics (subtle, 5% opacity)

**Interaction Philosophy**: Smooth state transitions, cards that subtly lift on hover with shadow increase, tooltips with rich data previews, tab-based panel switching

**Animation**: Fade-up entrance for cards (staggered 50ms), smooth number interpolation for live data, gentle pulse rings around sentiment indicators, chart lines that draw themselves on load

**Typography System**:
- Display: Space Grotesk (700) for section headers
- Body: DM Sans (400/500) for readable content
- Data: Geist Mono for numbers, tickers, and data tables

</text>
<probability>0.08</probability>
</response>

---

<response>
<text>

## Idea 3: "Signal Grid" — Cyberpunk Data Mesh

**Design Movement**: Cyberpunk-inspired data visualization with neon accents on dark substrates

**Core Principles**:
1. Information as art — data visualizations are the primary visual element
2. Neon hierarchy — color intensity maps to data importance
3. Grid consciousness — everything snaps to a visible underlying grid
4. Atmospheric depth — fog, glow, and layered transparency

**Color Philosophy**:
- Background: #050510 (deep space blue-black)
- Grid lines: #1a1a2e at 30% opacity
- Primary neon: #00D4FF (cyan for primary actions)
- Secondary neon: #FF00FF (magenta for alerts)
- Success: #39FF14 (neon green)
- Warning: #FFE600 (electric yellow)
- Text: #E0E0FF (cool white with blue cast)

**Layout Paradigm**: Visible grid overlay with panels that snap to intersections. Asymmetric mosaic layout where panel sizes reflect data importance. Navigation via top command bar with search.

**Signature Elements**:
1. Visible dot-grid background pattern
2. Neon glow borders on active/hovered panels
3. Data particles floating between connected panels

**Interaction Philosophy**: Everything glows brighter on interaction, panels can be resized by dragging grid lines, command palette for power users

**Animation**: Neon flicker on new data arrival, particle trails connecting related data points, smooth morphing between chart states, typing animation for AI-generated content

**Typography System**:
- Display: Orbitron for major headings
- Body: Exo 2 for content
- Data: Fira Code for all numerical data

</text>
<probability>0.04</probability>
</response>

---

## Selected Approach: Idea 2 — "Obsidian Intelligence"

This approach best matches the Bloomberg-inspired, premium feel requested in the PRD. It balances data density with elegance, uses institutional colors that convey trust, and provides enough visual sophistication without crossing into gimmicky territory. The asymmetric layout with a persistent ticker bar creates the professional trading terminal feel while maintaining readability.
