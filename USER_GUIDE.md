# AnimeVerse - Complete User Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Running the App](#running-the-app)
4. [Feature Guide](#feature-guide)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before running AnimeVerse, ensure you have:

- **Node.js** version 18.0 or higher
- **npm** (comes with Node.js) or **yarn** or **pnpm**
- **Git** (optional, for cloning)

### Check your versions:
```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be 9.0.0 or higher
```

---

## Installation

### Option 1: Clone from GitHub
```bash
git clone https://github.com/ErnestHysa/animeverse.git
cd animeverse
```

### Option 2: Already have the code
```bash
cd C:\Users\ErnestW11\DEVPROJECTS\anime-stream
```

### Install Dependencies
```bash
npm install
```

**⏱️ This takes 2-5 minutes on first run**

---

## Running the App

### Development Mode (Recommended)
```bash
npm run dev
```

**The app will start at: http://localhost:3000**

**Features in dev mode:**
- Fast refresh with Hot Module Replacement
- Detailed error messages
- Source maps for debugging

### Production Mode
```bash
# Build the app
npm run build

# Start production server
npm start
```

### Stopping the App
- Press `Ctrl + C` in the terminal

---

## Feature Guide

### 🏠 Home Page

**What you'll see:**
- Featured anime with hero banner
- Trending Now section
- All Time Popular section
- Continue Watching (if you've watched episodes)
- AI Picks For You (personalized recommendations)

**How to use:**
1. Browse anime by hovering over cards
2. Click any anime to see details
3. Click "Watch Now" or the play button to start watching

### 🎬 Watching Anime

**Video Player Controls:**

```
┌─────────────────────────────────────────────────────────┐
│  [◄] [▶️||] [►]  ●─────── [🔔] [⚙️] [🌐] [📥] [⛶]    │
│  Previous Play Pause Next Progress  Notify Lang DL Full  │
└─────────────────────────────────────────────────────────┘
```

**Keyboard Shortcuts:**
- `Space` - Play/Pause
- `←` / `→` - Skip 10 seconds backward/forward
- `↑` / `↓` - Volume up/down
- `M` - Mute/Unmute
- `F` - Toggle Fullscreen
- `T` - Toggle Theater Mode

**Quality Selector:**
1. Click ⚙️ (Settings) button
2. Select quality: 360p, 480p, 720p, 1080p

**Language Selector (Sub/Dub):**
1. Click 🌐 (Globe) button
2. Choose "Subtitles" or "Dubbed" (if available)

**Server Selector:**
1. Click ⚙️ (Settings) → Server
2. Choose different streaming server if one is slow

### 🔔 Notifications (New Episodes)

**How to enable:**
1. Click the 🔔 bell icon in the header
2. Click "Enable Notifications"
3. Allow browser permissions when prompted

**Managing notifications:**
1. Click the 🔔 bell icon
2. See which anime you're tracking
3. Toggle notifications on/off per anime

**What happens:**
- You'll get browser notifications when new episodes air
- Works even if the tab is closed (background)

### 👥 Watch Party (Watch Together)

**How to start a Watch Party:**
1. Start watching any episode
2. Click the "Watch Party" button
3. Click "Create Room"
4. Share the Room ID with friends

**How to join a Watch Party:**
1. Get the Room ID from the host
2. Click "Watch Party" → "Join Room"
3. Enter the Room ID
4. Watch together in real-time with chat!

### ⭐ My List & Watchlist

**Adding to Favorites:**
1. Go to any anime detail page
2. Click the ❤️ (Heart) button

**Adding to Watchlist:**
1. Go to any anime detail page
2. Click the 🕐 (Clock) button

**Accessing your lists:**
- Click "Favorites" in navigation
- Click "Watchlist" in navigation

### 📥 Offline Downloads

**How to download episodes:**
1. Start watching an episode
2. Click the 📥 (Download) button in player controls
3. Wait for download to complete
4. Watch offline anytime!

**Managing downloads:**
- Click the download button to see your downloaded episodes
- Downloaded episodes show a ✓ checkmark

### 🔍 Search

**How to search:**
1. Click the 🔍 (Search) icon in header
2. Type anime name
3. Press Enter or click search

**Advanced filters:**
- Filter by genre, year, format, status
- Sort by popularity, rating, trendiness

### 📅 Schedule

**What it shows:**
- Weekly airing schedule
- What time new episodes air
- Currently airing anime

---

## Keyboard Shortcuts Reference

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `←` | Skip back 10s |
| `→` | Skip forward 10s |
| `↑` | Volume Up |
| `↓` | Volume Down |
| `M` | Mute |
| `F` | Fullscreen |
| `T` | Theater Mode |
| `N` | Next Episode |
| `1-9` | Jump to 10%-90% of video |

---

## Troubleshooting

### App won't start

**Problem:** `npm run dev` shows errors

**Solutions:**
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install

# Check Node version (must be 18+)
node --version

# Try different port
PORT=3001 npm run dev
```

### Video won't play

**Problem:** Black screen or error when playing

**Solutions:**
1. Try a different server (⚙️ → Server)
2. Check your internet connection
3. Try refreshing the page
4. Clear browser cache

### Notifications not working

**Problem:** Not getting episode alerts

**Solutions:**
1. Check browser permissions (Settings → Site Permissions → Notifications)
2. Make sure you've added anime to notifications (click 🔔 → toggle anime)
3. Check that the anime is currently airing

### Downloads not working

**Problem:** Download button missing or failing

**Solutions:**
1. Downloads only work for "direct" streaming sources
2. Check browser storage quota (Settings → Site Data → Storage)
3. Try with fewer downloaded episodes

### App is slow

**Solutions:**
1. Close unused browser tabs
2. Clear browser cache
3. Check your internet speed
4. Try lowering video quality (⚙️ → Quality → 720p)

---

## Tips & Tricks

### 🎯 Find New Anime
- Check "AI Picks For You" on home page (personalized just for you!)
- Browse "Trending" for popular shows
- Check "Seasonal" for current season anime

### 📱 Progressive Web App
AnimeVerse is a PWA! You can install it:
1. Open the app in your browser
2. Click the install icon in the address bar
3. Add to your home screen like a native app

### 🔒 Privacy First
- No account required
- No tracking or data collection
- All data stored locally on your device
- Watchlist, favorites, and history stay on your device

### 🌙 Dark Mode
AnimeVerse uses a beautiful dark theme optimized for late-night viewing sessions.

---

## Getting Help

If you encounter issues not covered here:
1. Check the GitHub Issues: https://github.com/ErnestHysa/animeverse/issues
2. Report bugs with detailed steps to reproduce

---

## Feature Checklist

Use this to explore all features:

- [ ] Browse trending anime
- [ ] Search for specific anime
- [ ] Add anime to favorites
- [ ] Add anime to watchlist
- [ ] Watch an episode
- [ ] Try video player shortcuts
- [ ] Change video quality
- [ ] Switch between Sub/Dub
- [ ] Enable push notifications
- [ ] Create a Watch Party room
- [ ] Join a Watch Party room
- [ ] Download episode for offline viewing
- [ ] Check weekly schedule
- [ ] View AI recommendations
- [ ] Continue watching from where you left off

---

**Enjoy watching anime on AnimeVerse! 🎌**
