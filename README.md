# SwipeAndClean

> A fast, intuitive iOS photo manager. Swipe left to delete, swipe right to keep — then bulk-clean duplicates and low-quality shots. Built with React Native + Expo.

---

## Features

| Feature | Description |
|---|---|
| **Tinder-style Review** | Full-screen swipe cards — left to delete, right to keep. Real-time NOPE/KEEP labels follow your finger. |
| **Back & Skip** | Undo your last swipe, or skip a photo to come back to it later. |
| **Smart Review** | Automatically groups burst/similar photos (taken within 8s of each other) and surfaces low-resolution photos for quick cleanup. |
| **Soft Delete** | Swiped-left photos land in an in-app Deleted folder — nothing is permanently removed until you confirm. |
| **Bulk Actions** | Recover All, Delete All, or select individual photos to recover or permanently delete. |
| **Live Gallery** | Full photo grid synced with your iOS library. Shows real-time count and a "photos to review" nudge. |
| **Progress Tracking** | Review progress bar and per-session counter so you always know where you are. |
| **Persistent State** | Deleted/kept lists survive app restarts via AsyncStorage. |

---

## Screenshots

> *(Coming soon — add yours here)*

| Gallery | Review | Deleted |
|---|---|---|
| | | |

---

## Architecture

```
SwipeAndClean/
│
├── App.tsx                        # Root: GestureHandler + SafeArea + Navigation + Store
│
├── store/
│   └── DeletedContext.tsx         # Global state (deleted + kept photo IDs)
│                                  # Persisted to AsyncStorage
│
├── screens/
│   ├── GalleryScreen.tsx          # Photo grid (paginated, virtualized)
│   │                              # Smart Review section (similar + low quality)
│   ├── ReviewScreen.tsx           # Swipe card review mode
│   │                              # Progress bar · Undo · Skip
│   ├── DeletedScreen.tsx          # Soft-deleted photos
│   │                              # Recover / Permanently Delete (bulk + select)
│   ├── SimilarGroupsScreen.tsx    # Modal: review burst/similar photo groups
│   └── LowQualityScreen.tsx       # Modal: review low-resolution photos
│
├── components/
│   └── SwipeCard.tsx              # Animated swipe card (Reanimated + Gesture Handler)
│                                  # KEEP/NOPE overlays · rotation · fly-off animation
│
└── utils/
    └── photoAnalysis.ts           # detectSimilarGroups() — time-proximity clustering
                                   # detectLowQuality()   — dimension threshold filter
```

### Data Flow

```
iOS Photo Library (expo-media-library)
        │
        │ getAssetsAsync()
        ▼
  GalleryScreen / ReviewScreen
        │
        │ swipe left         │ swipe right
        ▼                    ▼
  addDeleted(asset)      addKept(asset)
        │                    │
        └──────┬─────────────┘
               ▼
       DeletedContext (global)
               │
               ├── deletedAssets[]  ──► DeletedScreen
               │                        ├─ recoverAll()
               │                        ├─ recoverAsset(id)
               │                        └─ deleteAssetsAsync() ──► iOS Photo Library
               │
               └── keptIds[]        ──► GalleryScreen (filter unreviewed count)
```

### Key Libraries

| Library | Purpose |
|---|---|
| `expo-media-library` | Read iOS photo library, paginate assets, delete permanently |
| `expo-image` | Render `ph://` iOS photo URIs (React Native's `Image` can't handle these) |
| `react-native-reanimated` | Smooth 60fps swipe card animations |
| `react-native-gesture-handler` | Pan gesture detection for swipe cards |
| `@react-navigation/bottom-tabs` | 3-tab navigation (Gallery / Review / Deleted) |
| `@react-native-async-storage/async-storage` | Persist deleted/kept state across sessions |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo Go app installed on your iPhone ([App Store](https://apps.apple.com/app/expo-go/id982107779))
- Mac and iPhone on the **same Wi-Fi** (or use `--tunnel` mode)

### Install

```bash
git clone https://github.com/YOUR_USERNAME/SwipeAndClean.git
cd SwipeAndClean
npm install
```

### Run

```bash
npx expo start --tunnel
```

Scan the QR code with your iPhone camera (or from inside Expo Go) to open the app.

> **First launch:** The app will ask for photo library access. Tap **Allow Full Access** for the best experience.

---

## How It Works

### Swipe Review

1. Tap the **Review** tab
2. Swipe **left** to mark a photo for deletion, **right** to keep it
3. Use **↩ undo** to reverse your last swipe, or **↪ skip** to come back to a photo later
4. Tap the ✕ / ✓ buttons if you prefer tapping over swiping

### Deleted Folder

- Photos you swipe left are **not immediately deleted** from iOS — they go into the in-app Deleted folder first
- From the Deleted tab you can:
  - **Recover All** — puts everything back in the gallery
  - **Delete All** — permanently removes all (iOS will confirm)
  - Tap to **select individual photos**, then recover or permanently delete the selection

### Smart Review

- **Similar Photos** — the app clusters photos taken within 8 seconds of each other (burst shots, multiple takes). You pick the best one; the rest go to Deleted.
- **Low Quality** — surfaces photos with resolution below 800px in either dimension. Useful for cleaning up old compressed photos or accidental low-res saves.

---

## Roadmap

- [ ] Face/object-based similarity (on-device ML via Vision framework)
- [ ] Album view (collections like iOS Photos)
- [ ] iCloud sync awareness
- [ ] App Store release

---

## Tech Stack

- **React Native** 0.81 + **Expo** SDK 54
- **TypeScript** (strict mode)
- **React Native Reanimated** 4.1 + **Gesture Handler** 2.28
- **Expo Media Library** 18.2
- **React Navigation** 7 (Bottom Tabs)

---

## License

MIT — use freely, attribution appreciated.
