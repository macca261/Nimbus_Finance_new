# Nimbus Finance - Design System & Guidelines

## Project Overview

**App Name:** Nimbus Finance  
**Type:** Single Page Application (SPA) / Personal Finance Dashboard  
**Core Aesthetic:** "Windows AI" / Glassmorphism

## Technical Stack

- **Framework:** React (Functional Components + Hooks)
- **Styling:** Tailwind CSS (Utility-first)
- **Icons:** `lucide-react` ONLY
- **Charts:** Pure CSS `conic-gradient` for pie charts (NO Recharts, Chart.js, or other heavy libraries)
- **Drag & Drop:** Custom HTML5 Drag & Drop implementation (no heavy dnd libraries)

## Design System Rules

### Dark Mode (Default)

**Background:**
- `bg-slate-950` with ambient background blobs (Blue/Cyan/Purple) positioned absolutely behind content

**Cards:**
- `bg-slate-800/40` + `backdrop-blur-xl` + `border border-white/5`
- Never use solid backgrounds - must be translucent to let ambient blobs shine through

**Typography:**
- White text for primary
- `text-slate-400` for secondary text

**Accents:**
- Cyan: `text-cyan-400`
- Blue
- Purple

**Shadows:**
- `shadow-cyan-500/20` for glows

### Light Mode (Variant)

**Background:**
- `bg-slate-50`

**Cards:**
- `bg-white/70` + `backdrop-blur-xl` + `border border-slate-200`

**Typography:**
- `text-slate-900` for primary
- `text-slate-500` for secondary

**Accents:**
- Blue: `text-blue-600`
- Cyan

## Glassmorphism Implementation Guide (STRICT)

### The Glass Container

**Required Classes:**
```tsx
className="relative bg-slate-800/40 backdrop-blur-xl border border-white/5 rounded-3xl shadow-xl"
```

**Important:** Never use solid backgrounds for main containers. The background must be translucent.

### The "Sheen" Effect (Optional Premium Look)

Add as a child div inside cards for a premium, reflective surface:
```tsx
<div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/5 to-transparent pointer-events-none opacity-50" />
```

### Inner Elements (Inputs/Lists)

**Required Classes:**
```tsx
className="bg-slate-950/30 border border-white/5 rounded-xl"
```

For search bars or inner lists, go darker and more transparent than the parent card.

### Ambient Background Blobs

Create atmospheric depth with absolutely positioned gradient blobs:
```tsx
<div className="fixed inset-0 -z-10 overflow-hidden">
  <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
  <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl" />
  <div className="absolute bottom-1/4 left-1/2 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
</div>
```

## Component Architecture

### Sidebar
- Fixed width (`w-64`) on desktop
- Off-canvas on mobile
- Contains navigation and user profile

### DraggableDashboard
- Main container using CSS Grid
- Maintains an array of card objects
- Handles `drag-start`, `drag-over`, and `drag-end` events to reorder the array

### Widgets
- Small, modular components (Streak, Accounts, Chart, AI Chat)
- Must fit within dashboard grid cells
- Follow glassmorphism patterns strictly

## Coding Guidelines

1. **Simplicity:** Prefer CSS solutions over JavaScript libraries
2. **Responsiveness:** Implement mobile-first or desktop-first consistently
   - Use: `md:grid-cols-2 lg:grid-cols-4`
3. **State:** Use `useState` for UI state (tabs, modals, inputs)
4. **No Dead Code:** Clean up unused imports immediately
5. **Aesthetics First:** Prioritize the "glass" look - expensive and modern

## Example Widget Implementation

When creating a new widget (e.g., Stock Watchlist), it must:
1. Use the glass container pattern
2. Include ambient lighting effects
3. Use lucide-react icons only
4. Use pure CSS/SVG for visualizations (sparklines, charts)
5. Match the dark mode glassmorphism aesthetic
6. Be responsive and fit within grid cells

## Color Palette Reference

### Dark Mode
- **Background:** `bg-slate-950`
- **Cards:** `bg-slate-800/40` with `backdrop-blur-xl`
- **Borders:** `border-white/5`
- **Text Primary:** White
- **Text Secondary:** `text-slate-400`
- **Accent Cyan:** `text-cyan-400`
- **Accent Blue:** `text-blue-400`
- **Accent Purple:** `text-purple-400`

### Light Mode
- **Background:** `bg-slate-50`
- **Cards:** `bg-white/70` with `backdrop-blur-xl`
- **Borders:** `border-slate-200`
- **Text Primary:** `text-slate-900`
- **Text Secondary:** `text-slate-500`
- **Accent Blue:** `text-blue-600`
- **Accent Cyan:** `text-cyan-600`

## Responsive Breakpoints

- Mobile: `< 768px` (default)
- Tablet: `md: >= 768px`
- Desktop: `lg: >= 1024px`
- Large Desktop: `xl: >= 1280px`

