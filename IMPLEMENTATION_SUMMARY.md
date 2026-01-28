# API Layer Implementation Summary

This document summarizes the implementation of the API layer with fallback functionality for the Musicians project.

## Overview

The implementation adds a service layer to the frontend that switches between mock data and real backend API calls using a single environment variable (`VITE_USE_MOCK`).

## What Was Implemented

### Phase 1: Infrastructure ✅

1. **Vite Proxy Configuration** (`frontend/vite.config.ts`)
   - Added proxy for `/api` → `http://localhost:3000`
   - Added proxy for `/socket.io` → `http://localhost:3000` with WebSocket support

2. **Environment Files**
   - `frontend/.env.development` - Sets `VITE_USE_MOCK=true` for development
   - `frontend/.env.production` - Sets `VITE_USE_MOCK=false` for production
   - `backend/.env.example` - Template with all required environment variables

3. **TypeScript Types** (`frontend/src/vite-env.d.ts`)
   - Added `VITE_USE_MOCK` and `VITE_API_URL` to `ImportMetaEnv` interface

### Phase 2: Service Layer ✅

Created 8 new service files in `frontend/src/services/`:

1. **apiClient.ts** - Base HTTP client
   - `isMockMode()` - Checks if mock mode is enabled
   - `apiGet<T>()`, `apiPost<T>()`, `apiPut<T>()`, `apiDelete<T>()` - HTTP methods
   - `ApiError` class for typed errors
   - Handles envelope responses `{ success, data }`
   - Automatic fallback to mock data on network errors

2. **posterService.ts**
   - `getPosters()` - Get all posters (mock or API)

3. **songService.ts**
   - `getSongs()` - Get all songs
   - `getSongLyrics(songId)` - Get lyrics for a specific song

4. **voteService.ts**
   - `getVoteResults()` - Get voting results
   - `castVote(songId)` - Submit a vote

5. **formatService.ts**
   - `getFormats()` - Get all formats
   - `getFormatById(id)` - Get specific format

6. **bookingService.ts**
   - `getAvailableDates(month?)` - Get available booking dates
   - `createBooking(data)` - Create a new booking

7. **reviewService.ts**
   - `submitReview({ rating, text })` - Submit a review

8. **partnerService.ts**
   - `getPartners()` - Get all partners

### Phase 3: Screen Integration ✅

Updated 10 files to use the new service layer:

1. **HomeScreen.tsx**
   - Removed inline poster mocks and type definitions
   - Added `getPosters()` and `getPartners()` service calls
   - Updated to use `Promise.all()` for parallel loading
   - Removed unused `apiBase` variable

2. **VotingScreen.tsx**
   - Replaced static mock data with `getSongs()` service
   - Added loading state
   - Added loading UI

3. **VotingResultsScreen.tsx**
   - Replaced mock data with `getSongs()` and `getVoteResults()`
   - Uses `Promise.all()` for parallel loading
   - Added loading state and UI

4. **WinningSongScreen.tsx**
   - Replaced direct mock access with `getSongs()` service
   - Added loading state
   - Added null checks for song data

5. **SongLyricsScreen.tsx**
   - Replaced mock data with `getSongs()` and `getSongLyrics()`
   - Added loading state
   - Updated to handle async data loading

6. **LyricsOverlay.tsx**
   - Replaced mock data with service calls
   - Added loading only when overlay is open
   - Updated to handle async data

7. **FormatScreen.tsx**
   - Replaced mock data with `getFormats()` service
   - Added loading state
   - Maintains sorting by order

8. **FormatDetailScreen.tsx**
   - Replaced mock data with `getFormatById()` service
   - Added loading state
   - Added proper null handling

9. **RequestScreens.tsx** (RequestCalendarScreen)
   - Added `getAvailableDates()` service integration
   - Disabled days are now fetched from backend
   - Supports month-based filtering

10. **App.tsx**
    - Added `castVote()` for voting submission
    - Added `submitReview()` for review submission
    - Replaced console.log with actual service calls
    - Added proper error handling

### Phase 4: Backend Prisma Migration ✅

1. **Updated Prisma Schema** (`backend/prisma/schema.prisma`)
   - Added `shortDescription` field
   - Added `imageUrl` field
   - Added `suitableFor` (JSON) field
   - Added `performers` (JSON) field
   - Added `status` field (default: "available")
   - Added `order` field (default: 0)

2. **Created Migration** (`backend/prisma/migrations/20260128150400_add_format_fields/migration.sql`)
   - SQL migration to add all new fields to the `formats` table

### Phase 5: Backend Implementation Guide ✅

Created `backend/IMPLEMENTATION_GUIDE.md` with:
- Detailed implementation instructions for PrismaFormatRepository
- FormatService implementation examples
- API route definitions
- Frontend type compatibility notes
- Testing examples
- Database seeding script

## How to Use

### Development Mode (Mock Data)

1. Ensure `frontend/.env.development` has `VITE_USE_MOCK=true`
2. Run frontend: `cd frontend && npm run dev`
3. All data will come from mock files (no backend needed)

### Production Mode (Real Backend)

1. Set `VITE_USE_MOCK=false` in environment
2. Ensure backend is running on `http://localhost:3000` (or set `VITE_API_URL`)
3. Frontend will make real API calls
4. If API fails, it automatically falls back to mock data

### Switching Between Modes

Simply change the `VITE_USE_MOCK` environment variable:

```bash
# Development with mocks
VITE_USE_MOCK=true npm run dev

# Development with real API
VITE_USE_MOCK=false npm run dev
```

## API Endpoints Expected

The frontend expects the following API endpoints:

- `GET /api/posters` - List all posters
- `GET /api/partners` - List all partners
- `GET /api/songs` - List all songs
- `GET /api/songs/:id/lyrics` - Get lyrics for a song
- `GET /api/votes/results` - Get voting results
- `POST /api/votes` - Cast a vote
- `GET /api/formats` - List all formats
- `GET /api/formats/:id` - Get specific format
- `GET /api/bookings/available-dates?month=YYYY-MM` - Get available dates
- `POST /api/bookings` - Create a booking
- `POST /api/reviews` - Submit a review

All endpoints should return data in the envelope format:
```json
{
  "success": true,
  "data": { ... }
}
```

## Benefits

1. **Single Toggle Switch** - One environment variable controls the entire system
2. **Automatic Fallback** - If API fails, automatically uses mock data
3. **Type Safety** - Full TypeScript types throughout
4. **Clean Architecture** - Service layer separates concerns
5. **Easy Testing** - Can develop frontend without backend
6. **Gradual Migration** - Can implement backend endpoints one at a time
7. **No CORS Issues** - Vite proxy handles CORS in development

## Next Steps

1. **Apply Prisma Migration**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

2. **Implement Backend Services** (see `backend/IMPLEMENTATION_GUIDE.md`)
   - Create PrismaFormatRepository
   - Create FormatService
   - Create API routes
   - Implement other endpoints (songs, votes, bookings, etc.)

3. **Test API Integration**
   - Set `VITE_USE_MOCK=false`
   - Test each endpoint
   - Verify data flows correctly

4. **Deploy**
   - Set production `VITE_API_URL` to your backend URL
   - Ensure `VITE_USE_MOCK=false` in production

## File Changes Summary

### New Files (10)
- `frontend/.env.development`
- `frontend/.env.production`
- `frontend/src/services/apiClient.ts`
- `frontend/src/services/posterService.ts`
- `frontend/src/services/songService.ts`
- `frontend/src/services/voteService.ts`
- `frontend/src/services/formatService.ts`
- `frontend/src/services/bookingService.ts`
- `frontend/src/services/reviewService.ts`
- `frontend/src/services/partnerService.ts`

### Modified Files (13)
- `frontend/vite.config.ts`
- `frontend/src/vite-env.d.ts`
- `frontend/src/screens/HomeScreen.tsx`
- `frontend/src/screens/VotingScreen.tsx`
- `frontend/src/screens/VotingResultsScreen.tsx`
- `frontend/src/screens/WinningSongScreen.tsx`
- `frontend/src/screens/SongLyricsScreen.tsx`
- `frontend/src/components/LyricsOverlay.tsx`
- `frontend/src/screens/FormatScreen.tsx`
- `frontend/src/screens/FormatDetailScreen.tsx`
- `frontend/src/screens/RequestScreens.tsx`
- `frontend/src/App.tsx`
- `backend/prisma/schema.prisma`

### Created Backend Files (3)
- `backend/.env.example`
- `backend/prisma/migrations/20260128150400_add_format_fields/migration.sql`
- `backend/IMPLEMENTATION_GUIDE.md`

## Testing Checklist

- [ ] Frontend runs in mock mode (`VITE_USE_MOCK=true`)
- [ ] All screens load without errors
- [ ] Mock data displays correctly
- [ ] Voting submission logs to console
- [ ] Review submission logs to console
- [ ] Backend migration can be applied
- [ ] Frontend can connect to backend (when implemented)
- [ ] Fallback to mocks works on API errors
- [ ] Production build works with `VITE_USE_MOCK=false`

## Conclusion

The implementation is complete and ready for testing. The frontend can now work with or without a backend, and switching between modes is as simple as changing one environment variable. The backend has a clear migration path and implementation guide to follow.
