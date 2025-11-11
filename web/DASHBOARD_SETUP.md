# Dashboard Setup & Installation Guide

## Overview

This is a premium fintech dashboard for Nimbus Finance with all modern features:
- Left sidebar navigation
- Welcome header with achievements
- KPI cards with sparklines
- Pie chart (spending by category)
- Line chart (balance over time)
- Upcoming subscriptions list
- AI Q&A panel
- Recent transactions table

## Required Dependencies

The following dependencies are already installed:
- ✅ `react` & `react-dom`
- ✅ `react-router-dom`
- ✅ `lucide-react` (icons)
- ✅ `recharts` (charts)
- ✅ `tailwindcss` (styling)

## Optional Dependencies (for enhanced animations)

If you want smoother animations, install:
```bash
npm install framer-motion
```

Then update `Dashboard.tsx` and other components to use Framer Motion for animations.

## File Structure

```
web/src/
├── components/
│   └── dashboard/
│       ├── Dashboard.tsx      (main orchestrator)
│       ├── Sidebar.tsx        (navigation sidebar)
│       ├── KpiCard.tsx        (KPI cards with sparklines)
│       ├── Charts.tsx          (Pie + Line charts)
│       ├── AiPanel.tsx        (AI chat interface)
│       ├── Subscriptions.tsx   (subscriptions list)
│       └── Transactions.tsx  (transactions table)
├── lib/
│   ├── format.ts              (currency/date utilities)
│   └── mockData.ts            (all mock data)
└── pages/
    └── Dashboard.tsx          (page wrapper)
```

## Setup Steps

### 1. Verify TypeScript Path Alias

The `tsconfig.json` should have the path alias configured:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### 2. Verify Vite Config

The `vite.config.ts` should have the alias configured:
```typescript
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  },
}
```

### 3. Start Development Server

```bash
npm -w web run dev
```

Visit `http://localhost:5173/` to see the dashboard.

## Features Implemented

### ✅ Left Sidebar
- Fixed navigation with all routes
- Dark mode toggle
- User profile section
- Mobile-responsive (collapsible)

### ✅ Header
- Welcome message with user name
- Date range selector (This Month / Last 30d / YTD)
- API status indicator

### ✅ Trophy/Achievement Chips
- Dynamic calculation from mock data
- Color-coded badges
- Icons from lucide-react

### ✅ KPI Cards
- Balance, Income MTD, Expenses MTD
- Trend sparklines (Recharts LineChart)
- Trend direction indicators
- Loading skeleton states

### ✅ Charts
- **Pie Chart**: Spending by category with legend
- **Line Chart**: Balance over time with timeframe toggle
- Category filter for pie chart
- Empty states for both charts

### ✅ Subscriptions List
- Upcoming subscriptions with dates
- Pause/Cancel buttons (mock actions)
- Days until next charge
- Empty state handling

### ✅ AI Panel
- Chat interface with message history
- Sample prompts
- Mock responses based on query keywords
- Loading states

### ✅ Transactions Table
- Search functionality
- Category filter
- Empty state with CTA
- Responsive table design

## Customization

### Replace Mock Data with Real API

1. Update `src/lib/mockData.ts` to fetch from your API
2. Update components to use async data fetching
3. Add loading states and error handling

### Styling

All components use Tailwind CSS with the theme system:
- Light mode (default)
- Dark mode (via `data-theme="dark"`)
- Custom colors in `web/src/styles/theme.css`

### Adding New Features

1. Create new component in `src/components/dashboard/`
2. Import and use in `Dashboard.tsx`
3. Add mock data if needed in `src/lib/mockData.ts`

## Accessibility

- ✅ Keyboard navigation (Tab, Enter, Escape)
- ✅ ARIA labels on interactive elements
- ✅ Focus indicators
- ✅ Screen reader support
- ✅ WCAG-AA contrast ratios

## Responsive Design

- **Desktop**: 3-column grid for KPIs, 2-column for main content
- **Tablet**: 2-column grid, sidebar collapsible
- **Mobile**: 1-column layout, full-width sidebar overlay

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Troubleshooting

### Import Errors
If you see `Cannot find module '@/...'`, verify:
1. `tsconfig.json` has path alias configured
2. `vite.config.ts` has alias configured
3. Restart dev server after changes

### Theme Not Working
Ensure `data-theme` attribute is set on `document.documentElement`:
```typescript
document.documentElement.setAttribute('data-theme', 'light' | 'dark');
```

### Charts Not Rendering
Ensure `recharts` is installed:
```bash
npm install recharts
```

## Next Steps

1. Connect to real API endpoints
2. Add authentication
3. Implement real subscription management
4. Add more chart types
5. Integrate real AI service for chat panel

