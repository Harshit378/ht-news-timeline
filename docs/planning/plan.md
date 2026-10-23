# 📰 News Timeline — Website Project Plan

> A dark-themed, editorial news application built around a chronological timeline interface. Designed for readers who want to follow the news as it unfolds — moment by moment, day by day.

---

## 1. Project Overview

| Attribute | Detail |
|-----------|--------|
| **App Name** | News Timeline |
| **Type** | Web Application (Desktop-first, Responsive) |
| **Target Users** | News readers, journalists, researchers, power users |
| **Design Theme** | Light editorial — inspired by newspaper print culture |
| **Tech Stack** | React, IBM Plex Sans/Mono, Playfair Display |
| **Total Pages** | 6 core pages |

---

## 2. Page Structure

The application consists of **6 pages**, each serving a distinct purpose in the news reading experience.

### Page 1 — Timeline Feed (Home)
The primary screen. A chronological, scrollable feed of news events grouped by date.

**Layout:** Three-column — Sidebar · Feed Panel · Article Detail

**Key Components:**
- Breaking news banner (top, red highlight strip)
- Sticky date group headers with gold timestamp labels
- Timeline rail with animated dot indicators (pulsing for breaking news)
- News cards showing: source, tag, headline, excerpt, thumbnail emoji
- Filter chips (All · Tech · World · Finance · Science · Politics · Climate)
- Article detail pane that opens inline on card click

**Interactions:**
- Clicking a card loads article in the right panel without page navigation
- Breaking news dots pulse continuously
- Active card highlights its timeline dot in red with a glow effect
- Sticky date labels scroll with the feed but stay pinned at the top of each group

---

### Page 2 — Article Detail (Inline / Deep Link)
Opens within the feed layout on desktop. Full-screen on mobile.

**Key Components:**
- Sticky top bar with back button, bookmark icon, share icon, source link
- Reading progress bar (thin red line along top of viewport)
- Category label, full headline in Playfair Display
- Author byline with avatar, publish time, read-time estimate
- Hero image area (emoji placeholder until real images are loaded)
- Article body with drop caps, pull quotes, inline bold highlights
- Related articles grid (2-column, 4 cards) below the article

**Interactions:**
- Scroll-tracked reading progress bar
- Bookmark button toggles saved state (gold highlight)
- Related cards open new article in same detail panel

---

### Page 3 — Search
Full search experience with trending topics and live results.

**Key Components:**
- Large search input with icon, keyboard shortcut hint (`⌘K`)
- Trending topics grid (3-column chips ranked 01–09)
  - Each chip shows: rank number, topic label, article count
- Recent searches row (horizontally scrollable chips)
- Live search results list (same card format as Timeline Feed)
- Empty state with suggested searches

**Interactions:**
- `⌘K` / `Ctrl+K` focuses the search bar from anywhere in the app
- Trending chips pre-fill and execute the search on click
- Results update as the user types (debounced, 300ms)

---

### Page 4 — Topics / Categories
Browse all available news topics in a visual grid.

**Key Components:**
- Topics grid (3-column)
  - Each card has a background color tinted to its category color
  - Topic icon (emoji), topic name, article count
  - Hover: card lifts with shadow and border glow
- Optional: Subscribed topics pinned to the top row
- Sub-topics appear on clicking a category card

**Topics Included:**
Technology · World News · Finance · Science · Politics · Climate · Health · Culture · Sports · Opinion

**Interactions:**
- Clicking a topic navigates to a filtered timeline view for that topic
- Subscribe toggle saves topic to sidebar quick-access

---

### Page 5 — Bookmarks / Saved
A personal library of saved articles.

**Key Components:**
- Stats row: total saved · read · unread · reading streak
- 2-column bookmark card grid
  - Thumbnail, category tag, headline, source + date
  - Hover: lift + red border glow
- Filter tabs: All · Unread · Read · By Topic
- Bulk actions: Mark all read · Export · Clear

**Interactions:**
- Long-press or right-click a card for quick actions (mark read, remove, share)
- Export saved articles as PDF or email digest

---

### Page 6 — Settings / Preferences
User customization and app configuration.

**Key Components:**
- Profile section (avatar, display name, email)
- Notification preferences (push, email digest frequency)
- Feed preferences (topics to follow, sources to mute/prioritize)
- Appearance settings (dark/light/system theme, font size, timeline density)
- Data & Privacy (clear history, export data, account deletion)
- About section (app version, changelog link)

---

## 3. Global UI Components

These components appear across multiple pages.

### Navigation Sidebar
- **Position:** Fixed left, 68px wide
- **Contents:** Logo mark · Home · Search · Topics · Bookmarks · Settings
- **Behavior:** Icon-only with tooltip on hover; no labels to save space
- **Active state:** Red background tint on active icon

### Breaking News Banner
- **Position:** Top of the Feed panel, below the header
- **Style:** Solid red background, white text
- **Contents:** "BREAKING" label pill · scrolling headline · timestamp
- **Behavior:** Auto-dismisses after 60 seconds; reappears for new breaking events

### News Card (Timeline Item)
- **Structure:** Time dot · time label · source · tag chip · headline · excerpt · thumbnail
- **States:** Default · Hover (headline turns red) · Active (dot pulses red) · Breaking (dot pulses with glow)
- **Variants:** Compact (excerpt hidden) · Full (default) · Featured (larger, with image)

### Filter Chips
- **Style:** Pill-shaped, outlined by default, filled red when active
- **Behavior:** Multi-select supported; "All" deselects all others
- **Scroll:** Horizontally scrollable on narrow panels

### Article Tag
- **Variants by category:**
  - Breaking → Red background
  - Tech → Blue background
  - World → Green background
  - Finance → Gold background
  - Science → Purple background

### Icon Buttons
- Square, 36×36px, rounded corners
- States: Default · Hover (surface tint) · Active/Saved (gold color)

---

## 4. Design System

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#0a0a0b` | App background |
| `--surface` | `#111113` | Panels, sidebar |
| `--surface-alt` | `#18181c` | Cards, inputs |
| `--border` | `#222226` | Dividers, card borders |
| `--accent` | `#e83a2e` | CTA, breaking news, active states |
| `--accent-soft` | `rgba(232,58,46,0.12)` | Tinted backgrounds |
| `--text` | `#f0ede8` | Primary text (warm white) |
| `--text-muted` | `#7a7878` | Secondary text, metadata |
| `--text-dim` | `#3e3d3d` | Disabled, timeline rail |
| `--gold` | `#c9a84c` | Date labels, bookmarks |

### Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| App logo | Playfair Display | 900 | 22px |
| Page title | Playfair Display | 900 | 32–40px |
| Article headline | Playfair Display | 700 | 15–40px |
| Card body / UI | IBM Plex Sans | 300–600 | 12–16px |
| Timestamps / code | IBM Plex Mono | 400–500 | 10–13px |
| Tags / labels | IBM Plex Sans | 600 | 10–12px (uppercase) |

### Spacing Scale
`4 · 8 · 12 · 14 · 16 · 20 · 24 · 32 · 40 · 48 · 60 · 80px`

### Border Radius
`4px` (tags) · `6px` (buttons) · `8px` (thumbnails) · `10px` (cards) · `12px` (topic cards) · `100px` (chips)

### Shadows
- Card hover: `0 8px 32px rgba(0,0,0,0.4)`
- Topic card hover: `0 12px 40px rgba(0,0,0,0.5)`
- Bookmark hover: `0 8px 40px rgba(0,0,0,0.5)`

---

## 5. Animations & Motion

| Element | Animation | Duration |
|---------|-----------|----------|
| Breaking news dot | Pulse glow ring | 1.5s loop |
| Page transitions | Fade + slide up (8px) | 250ms |
| Card hover (related, bookmarks) | `translateY(-2px)` | 150ms |
| Reading progress bar | Width tracks scroll | 100ms |
| Tag tooltip | Opacity fade | 150ms |
| Chip active state | Background fill | 150ms |
| Detail panel open | Fade in from right | 200ms |

---

## 6. Responsive Behavior

| Breakpoint | Layout Change |
|------------|---------------|
| `> 1280px` | Full 3-column layout (sidebar + feed + detail) |
| `960–1280px` | Feed panel + detail; sidebar collapses to icon strip |
| `640–960px` | Feed only; detail opens as overlay slide-in |
| `< 640px` | Mobile: single column; bottom tab bar replaces sidebar |

---

## 7. Feature Roadmap

### Phase 1 — MVP
- Timeline feed with date grouping
- Article detail panel
- Breaking news banner
- Filter chips by category
- Bookmarks (local storage)

### Phase 2 — Enrichment
- Full search with trending topics
- Topics / categories page
- Reading progress tracker
- Related articles engine

### Phase 3 — Personalization
- User accounts & preferences
- Topic subscriptions
- Email digest export
- Push notifications
- Dark / light theme toggle

### Phase 4 — Power Features
- Live event timelines (elections, sports, summits)
- Side-by-side source comparison view
- AI-generated topic summaries
- Offline reading mode (PWA)
- Custom RSS feed ingestion

---

## 8. Data Architecture (Frontend)

```
App State
├── feed
│   ├── articles[]         ← grouped by date
│   ├── activeArticleId
│   ├── filters[]          ← active category filters
│   └── breakingNews{}
├── search
│   ├── query
│   ├── results[]
│   └── trending[]
├── bookmarks[]
├── topics[]
└── user
    ├── preferences{}
    └── readHistory[]
```

---

## 9. API Endpoints (Suggested)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/feed` | GET | Paginated timeline feed |
| `/api/feed?category=tech` | GET | Category-filtered feed |
| `/api/articles/:id` | GET | Single article detail |
| `/api/search?q=` | GET | Full-text search |
| `/api/trending` | GET | Trending topics list |
| `/api/topics` | GET | All topic categories |
| `/api/topics/:slug/feed` | GET | Topic-specific timeline |
| `/api/bookmarks` | GET/POST/DELETE | User saved articles |
| `/api/breaking` | GET | Active breaking news |

---

## 10. Success Metrics

- **Time on site:** Target > 8 minutes per session
- **Articles read per session:** Target > 3
- **Bookmark save rate:** > 15% of article opens
- **Return visit rate:** > 60% weekly active users
- **Search usage:** > 30% of sessions include a search
- **Breaking news CTR:** > 45% click-through on banners

---

*Plan version 1.0 — April 2026*