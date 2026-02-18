import * as MediaLibrary from 'expo-media-library';

/**
 * Groups photos taken within 8000ms (8 seconds) of each other.
 * Returns only groups with 2 or more photos.
 */
export function detectSimilarGroups(
  assets: MediaLibrary.Asset[]
): MediaLibrary.Asset[][] {
  if (assets.length === 0) return [];

  // Sort ascending by creationTime
  const sorted = [...assets].sort((a, b) => a.creationTime - b.creationTime);

  const groups: MediaLibrary.Asset[][] = [];
  let currentGroup: MediaLibrary.Asset[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (curr.creationTime - prev.creationTime <= 8000) {
      currentGroup.push(curr);
    } else {
      if (currentGroup.length >= 2) {
        groups.push(currentGroup);
      }
      currentGroup = [curr];
    }
  }

  // Push the last group if it qualifies
  if (currentGroup.length >= 2) {
    groups.push(currentGroup);
  }

  return groups;
}

/**
 * Returns assets where width < 800 OR height < 800 (and width > 0).
 */
export function detectLowQuality(
  assets: MediaLibrary.Asset[]
): MediaLibrary.Asset[] {
  return assets.filter(
    (a) => a.width > 0 && (a.width < 800 || a.height < 800)
  );
}
