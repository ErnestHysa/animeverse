# Recommended Features Implementation Guide

**Date:** 2026-03-28
**Status:** Future Enhancements Guide

---

## Overview

This document provides implementation guidance for recommended features based on competitor analysis. Most core features have been implemented; this guide focuses on remaining enhancements.

---

## Currently Implemented Features ✅

See [STATUS.md](./STATUS.md) for the complete list of implemented features.

All major features from the original recommendation list have been completed:
- [x] Most Viewed section on homepage
- [x] Coming Soon page
- [x] Enhanced episode list component
- [x] History page with filtering
- [x] Genres browse page
- [x] Studios browse page
- [x] Studio detail pages
- [x] Related anime on detail pages
- [x] Advanced search with filters

---

## Remaining Recommendations

### Phase 1: Quick Wins (1-2 days)

#### 1. Server Latency Indicator

**Description:** Show ping/latency for each video server

**Implementation:**
```typescript
// Add to server-selector.tsx
async function measureServerLatency(url: string): Promise<number> {
  const start = performance.now();
  try {
    await fetch(url, { method: 'HEAD', mode: 'no-cors' });
    return Math.round(performance.now() - start);
  } catch {
    return -1; // Error
  }
}
```

**Files to modify:**
- `components/player/server-selector.tsx`

---

#### 2. Per-Anime Language Preference

**Description:** Remember sub/dub preference per anime

**Implementation:**
```typescript
// Add to store
interface PerAnimePreferences {
  [animeId: number]: {
    preferredLanguage: 'sub' | 'dub';
    preferredServer: string;
  };
}

// Add to store state
perAnimePreferences: PerAnimePreferences;
setPerAnimePreference: (animeId: number, pref: Partial<PerAnimePreferences[number]>) => void;
```

**Files to modify:**
- `store/index.ts`
- `components/player/enhanced-video-player.tsx`

---

#### 3. Enhanced Episode Thumbnails

**Description:** Generate thumbnails from video for preview

**Implementation:**
Consider using a service like:
- AniList's episode images (if available)
- Third-party thumbnail service
- Local generation (requires video processing)

**Files to modify:**
- `components/player/episode-thumbnails.tsx`
- `lib/video-sources-fast.ts`

---

### Phase 2: Content Discovery (3-5 days)

#### 4. MAL/Kitsu Integration

**Description:** Sync with MyAnimeList or Kitsu

**Implementation:**
- OAuth flow for MAL/Kitsu
- Sync watch history both ways
- Import/export lists
- Show MAL ratings

**Files to create:**
- `lib/mal-api.ts` or `lib/kitsu-api.ts`
- `app/auth/mal/` or `app/auth/kitsu/`

---

#### 5. Simulcast Badges

**Description:** Highlight currently airing simulcast anime

**Implementation:**
```typescript
// Add to anime-card.tsx
const isSimulcast = media.status === 'RELEASING' &&
                     media.seasonYear === currentYear &&
                     media.season === currentSeason;

{isSimulcast && (
  <Badge className="absolute top-2 right-2 bg-blue-500">
    SIMULCAST
  </Badge>
)}
```

**Files to modify:**
- `components/anime/anime-card.tsx`

---

#### 6. Character & Staff Sections

**Description:** Show characters and staff on detail pages

**Implementation:**
AniList provides this data. Add sections to detail page:

```typescript
// Add to anime/[id]/page.tsx
<CharacterSection characters={media.characters} />
<StaffSection staff={media.staff} />
```

**Files to modify:**
- `app/anime/[id]/page.tsx`
- Create: `components/anime/character-section.tsx`
- Create: `components/anime/staff-section.tsx`

---

### Phase 3: Personalization (5-7 days)

#### 7. Reviews & Ratings System

**Description:** User reviews and ratings for anime

**Implementation:**
- Star rating component
- Review text input
- Review list with sorting
- Helpful votes

**Files to create:**
- `components/reviews/review-card.tsx`
- `components/reviews/review-form.tsx`
- `components/reviews/reviews-list.tsx`
- `lib/reviews.ts`

---

#### 8. Watch Party Real-time Sync

**Description:** Real-time synchronized watching with friends

**Implementation:**
- WebSocket or WebRTC connection
- Room creation and management
- Invite link generation
- Chat functionality

**Files to create:**
- `lib/watch-party.ts`
- `components/player/watch-party-room.tsx`
- API routes for WebSocket signaling

---

#### 9. Advanced Search Improvements

**Description:** More search filters and options

**Implementation:**
- Year range slider
- Score range slider
- Exclude genres
- More sort options
- Save search presets

**Files to modify:**
- `app/search/page.tsx`
- `components/search/anime-filters.tsx`

---

## Implementation Priority

### High Priority
1. Server latency indicator
2. Per-anime language preference
3. Simulcast badges

### Medium Priority
4. MAL/Kitsu integration
5. Character & Staff sections
6. Reviews system

### Low Priority
7. Watch party real-time sync
8. Advanced search improvements
9. Enhanced episode thumbnails

---

## Technical Considerations

### API Limits
- AniList: No rate limit (but be reasonable)
- Jikan: 3 requests/second
- MAL API: Requires OAuth, has rate limits

### Storage
- Per-anime preferences: localStorage
- Reviews: Would need backend (or use AniList's list updates)
- Watch party: Requires WebSocket server

### Performance
- Thumbnail generation is CPU intensive
- Consider CDN for thumbnails
- Lazy load review sections

---

## API Endpoints Reference

### AniList GraphQL
```graphql
# Characters
query($id: Int) {
  Media(id: $id) {
    characters {
      edges {
        node { name { english } }
        voiceActors { languageV2 name { english } }
      }
    }
  }
}

# Staff
query($id: Int) {
  Media(id: $id) {
    staff {
      edges { node { name { english } } role }
    }
  }
}
```

### Jikan REST
```
GET /anime/{id}/characters_staff
GET /anime/{id}/episodes
GET /top/anime (for most viewed)
```

---

*Last updated: 2026-03-28*
