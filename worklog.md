---
Task ID: 1
Agent: Main Agent
Task: Add alternating row colors and dark mode support to Lead Dashboard

Work Log:
- Created ThemeProvider component using next-themes
- Updated layout.tsx to wrap app with ThemeProvider (attribute="class", defaultTheme="light")
- Added ThemeToggle component (Sun/Moon icon) in the header
- Added alternating row colors to DashboardGrid (white/slate-50 in light, gray-900/gray-800/60 in dark)
- Added alternating row colors to ClosingRateProductTab and ClosingRateCSTab
- Applied dark: variant classes to all text, backgrounds, borders, shadows across all components
- Ensured all rate color helpers return dark mode variants (e.g., bg-emerald-50 dark:bg-emerald-950/40)
- Verified no hydration errors, all 200 responses, lint passes cleanly

Stage Summary:
- Alternating row colors: even rows = white/dark:gray-900, odd rows = slate-50/dark:gray-800/60
- Dark mode toggle added as Sun/Moon button in header
- All font colors have dark variants for readability (gray-800 → dark:gray-200, etc.)
- Rate colors: emerald-50/700 → dark:emerald-950/40 + emerald-400, amber similar, red similar
- Backgrounds: white → dark:gray-900, slate-50 → dark:gray-800/60, slate-800 → dark:gray-950
