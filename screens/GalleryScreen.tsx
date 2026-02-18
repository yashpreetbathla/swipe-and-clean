import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDeleted, StoredAsset } from '../store/DeletedContext';
import { detectSimilarGroups, detectLowQuality } from '../utils/photoAnalysis';
import PhotoViewer from '../components/PhotoViewer';
import SimilarGroupsScreen from './SimilarGroupsScreen';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const CELL_SIZE = (width - 2) / NUM_COLUMNS;
const INITIAL_BATCH = 60;
const BG_BATCH = 150;

// ─── Collections helpers ────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

// Flat list item types for Collections view (avoids SectionList complexity)
type CollItem =
  | { type: 'header'; title: string; count: number }
  | { type: 'row'; photos: MediaLibrary.Asset[] };

export default function GalleryScreen() {
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [photos, setPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Background full-library load for smart analysis
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState({ loaded: 0, total: 0 });
  const analyzeStartRef = useRef(0);
  const bgLoadingRef = useRef(false);

  // Viewer state (single PhotoViewer used for all entry points)
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerTitle, setViewerTitle] = useState<string | undefined>(undefined);

  // UI
  const [segment, setSegment] = useState<'library' | 'collections'>('library');
  const [showSimilar, setShowSimilar] = useState(false);

  const { deletedAssets, addDeleted } = useDeleted();
  const deletedIds = useMemo(() => new Set(deletedAssets.map((a) => a.id)), [deletedAssets]);
  const insets = useSafeAreaInsets();

  // ─── derived data ──────────────────────────────────────────────────────────

  const visiblePhotos = useMemo(
    () => photos.filter((p) => !deletedIds.has(p.id)),
    [photos, deletedIds]
  );

  const similarGroups = useMemo(() => detectSimilarGroups(photos), [photos]);

  const lowQualityPhotos = useMemo(
    () => detectLowQuality(photos.filter((p) => !deletedIds.has(p.id))),
    [photos, deletedIds]
  );

  const totalSimilarPhotos = similarGroups.reduce((sum, g) => sum + g.length, 0);

  // Collections: photos grouped by month, flattened into header + row items
  const collectionsFlat = useMemo<CollItem[]>(() => {
    // Build ordered month map (photos already sorted newest-first)
    const groups = new Map<string, { title: string; photos: MediaLibrary.Asset[] }>();
    visiblePhotos.forEach((photo) => {
      const date = new Date(photo.creationTime);
      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      if (!groups.has(key)) {
        groups.set(key, {
          title: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
          photos: [],
        });
      }
      groups.get(key)!.photos.push(photo);
    });

    const items: CollItem[] = [];
    groups.forEach((group) => {
      items.push({ type: 'header', title: group.title, count: group.photos.length });
      chunkArray(group.photos, NUM_COLUMNS).forEach((row) => {
        items.push({ type: 'row', photos: row });
      });
    });
    return items;
  }, [visiblePhotos]);

  // ETA for background analysis
  const analyzeEta = useMemo(() => {
    const { loaded, total } = analyzeProgress;
    if (!isAnalyzing || loaded === 0 || total === 0 || loaded >= total) return '';
    const elapsed = Date.now() - analyzeStartRef.current;
    if (elapsed < 800) return '';
    const rate = loaded / elapsed;
    const etaMs = (total - loaded) / rate;
    if (etaMs < 60000) return `~${Math.ceil(etaMs / 1000)}s`;
    return `~${Math.ceil(etaMs / 60000)}m`;
  }, [analyzeProgress, isAnalyzing]);

  // ─── loading ───────────────────────────────────────────────────────────────

  const loadAllInBackground = useCallback(
    async (cursor: string, total: number, already: MediaLibrary.Asset[]) => {
      if (bgLoadingRef.current) return;
      bgLoadingRef.current = true;
      setIsAnalyzing(true);
      analyzeStartRef.current = Date.now();
      setAnalyzeProgress({ loaded: already.length, total });

      let all = [...already];
      let nextCursor = cursor;

      try {
        while (true) {
          const result = await MediaLibrary.getAssetsAsync({
            mediaType: MediaLibrary.MediaType.photo,
            first: BG_BATCH,
            after: nextCursor,
            sortBy: [MediaLibrary.SortBy.creationTime],
          });

          all = [...all, ...result.assets];
          setPhotos(all);
          setAnalyzeProgress({ loaded: all.length, total });

          if (!result.hasNextPage) break;
          nextCursor = result.endCursor;

          // Yield briefly to keep UI responsive
          await new Promise((r) => setTimeout(r, 30));
        }
      } catch (e) {
        console.warn('Background photo load error:', e);
      } finally {
        setIsAnalyzing(false);
        bgLoadingRef.current = false;
      }
    },
    []
  );

  const loadInitial = useCallback(async () => {
    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        first: INITIAL_BATCH,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      setPhotos(result.assets);
      setTotalCount(result.totalCount);
      setInitialLoading(false);

      if (result.hasNextPage) {
        loadAllInBackground(result.endCursor, result.totalCount, result.assets);
      }
    } catch (e) {
      console.warn('Failed to load photos:', e);
      setInitialLoading(false);
    }
  }, [loadAllInBackground]);

  useEffect(() => {
    if (permission?.granted) loadInitial();
  }, [permission?.granted]);

  // ─── viewer openers ────────────────────────────────────────────────────────

  const openViewer = useCallback(
    (photo: MediaLibrary.Asset) => {
      const index = visiblePhotos.findIndex((p) => p.id === photo.id);
      setViewerPhotos(visiblePhotos);
      setViewerTitle(undefined);
      setViewerIndex(index >= 0 ? index : 0);
      setViewerVisible(true);
    },
    [visiblePhotos]
  );

  const openSimilarViewer = useCallback(() => {
    setShowSimilar(true);
  }, []);

  const openLowQualityViewer = useCallback(() => {
    if (lowQualityPhotos.length === 0) return;
    setViewerPhotos(lowQualityPhotos);
    setViewerTitle('Low Quality');
    setViewerIndex(0);
    setViewerVisible(true);
  }, [lowQualityPhotos]);

  // ─── permission gate ───────────────────────────────────────────────────────

  const handlePermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert('Permission Required', 'Please enable photo library access in Settings.');
    }
  };

  if (!permission) return <View style={styles.center} />;

  if (!permission.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="images-outline" size={64} color="#C7C7CC" />
        <Text style={styles.permissionTitle}>No Photo Access</Text>
        <Text style={styles.permissionSubtitle}>
          SwipeAndClean needs access to your photo library.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={handlePermission}>
          <Text style={styles.permissionButtonText}>Allow Access</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (initialLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your photos…</Text>
      </View>
    );
  }

  // ─── shared header (appears in both Library and Collections) ───────────────

  const ListHeader = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.headerTitle}>Photos</Text>
      <Text style={styles.headerSubtitle} numberOfLines={1}>
        {totalCount !== null
          ? `${totalCount - deletedAssets.length} photos`
          : `${visiblePhotos.length} photos`}
        {isAnalyzing && analyzeProgress.total > 0
          ? `  ·  Analyzing ${analyzeProgress.loaded.toLocaleString()} / ${analyzeProgress.total.toLocaleString()}${analyzeEta ? `  ${analyzeEta}` : ''}…`
          : ''}
      </Text>

      {/* Segmented control */}
      <View style={styles.segControl}>
        <TouchableOpacity
          style={[styles.seg, segment === 'library' && styles.segActive]}
          onPress={() => setSegment('library')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segText, segment === 'library' && styles.segTextActive]}>
            Library
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.seg, segment === 'collections' && styles.segActive]}
          onPress={() => setSegment('collections')}
          activeOpacity={0.8}
        >
          <Text style={[styles.segText, segment === 'collections' && styles.segTextActive]}>
            Collections
          </Text>
        </TouchableOpacity>
      </View>

      {/* Smart Review — only in Library */}
      {segment === 'library' && (similarGroups.length > 0 || lowQualityPhotos.length > 0) && (
        <View style={styles.smartSection}>
          <View style={styles.smartTitleRow}>
            <Text style={styles.smartTitle}>Smart Review</Text>
            {isAnalyzing && (
              <View style={styles.analyzingPill}>
                <ActivityIndicator
                  size="small"
                  color="#007AFF"
                  style={{ transform: [{ scale: 0.65 }] }}
                />
                <Text style={styles.analyzingText}>
                  {analyzeEta ? `${analyzeEta} left` : 'Analyzing…'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.smartCards}>
            {similarGroups.length > 0 && (
              <TouchableOpacity
                style={styles.smartCard}
                onPress={openSimilarViewer}
                activeOpacity={0.8}
              >
                <View style={styles.smartCardThumbs}>
                  {similarGroups[0].slice(0, 3).map((a, i) => (
                    <Image
                      key={a.id}
                      source={{ uri: a.uri }}
                      style={[styles.smartThumb, { left: i * 18, zIndex: i }]}
                      contentFit="cover"
                    />
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smartCardLabel}>Similar Photos</Text>
                  <Text style={styles.smartCardCount}>
                    {similarGroups.length} group{similarGroups.length !== 1 ? 's' : ''} ·{' '}
                    {totalSimilarPhotos} photos
                    {isAnalyzing ? ' · finding more…' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </TouchableOpacity>
            )}

            {lowQualityPhotos.length > 0 && (
              <TouchableOpacity
                style={styles.smartCard}
                onPress={openLowQualityViewer}
                activeOpacity={0.8}
              >
                <View style={styles.smartCardThumbs}>
                  {lowQualityPhotos.slice(0, 3).map((a, i) => (
                    <Image
                      key={a.id}
                      source={{ uri: a.uri }}
                      style={[styles.smartThumb, { left: i * 18, zIndex: i }]}
                      contentFit="cover"
                    />
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.smartCardLabel}>Low Quality</Text>
                  <Text style={styles.smartCardCount}>
                    {lowQualityPhotos.length} photos
                    {isAnalyzing ? ' · finding more…' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {segment === 'library' ? (
        /* ── Library: standard 3-column grid ── */
        <FlatList
          key="library"
          data={visiblePhotos}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => openViewer(item)} activeOpacity={0.85}>
              <Image
                source={{ uri: item.uri }}
                style={styles.photo}
                contentFit="cover"
                recyclingKey={item.id}
              />
            </TouchableOpacity>
          )}
          numColumns={NUM_COLUMNS}
          columnWrapperStyle={styles.row}
          removeClippedSubviews
          windowSize={5}
          initialNumToRender={30}
          maxToRenderPerBatch={20}
          updateCellsBatchingPeriod={50}
          getItemLayout={(_, index) => ({
            length: CELL_SIZE,
            offset: CELL_SIZE * Math.floor(index / NUM_COLUMNS),
            index,
          })}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={
            isAnalyzing ? <ActivityIndicator style={{ margin: 16 }} color="#8E8E93" /> : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={56} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No Photos</Text>
            </View>
          }
        />
      ) : (
        /* ── Collections: months with section headers ── */
        <FlatList
          key="collections"
          data={collectionsFlat}
          keyExtractor={(item, i) =>
            item.type === 'header'
              ? `h-${item.title}`
              : `r-${(item as { type: 'row'; photos: MediaLibrary.Asset[] }).photos[0]?.id ?? i}`
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View style={styles.collHeader}>
                  <Text style={styles.collMonth}>{item.title}</Text>
                  <Text style={styles.collCount}>{item.count} photos</Text>
                </View>
              );
            }
            const rowPhotos = (item as { type: 'row'; photos: MediaLibrary.Asset[] }).photos;
            return (
              <View style={styles.row}>
                {rowPhotos.map((photo) => (
                  <TouchableOpacity
                    key={photo.id}
                    onPress={() => openViewer(photo)}
                    activeOpacity={0.85}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.photo}
                      contentFit="cover"
                      recyclingKey={photo.id}
                    />
                  </TouchableOpacity>
                ))}
                {/* Fill partial last row so grid stays aligned */}
                {rowPhotos.length < NUM_COLUMNS &&
                  Array.from({ length: NUM_COLUMNS - rowPhotos.length }).map((_, i) => (
                    <View key={`sp-${i}`} style={styles.photo} />
                  ))}
              </View>
            );
          }}
          ListHeaderComponent={ListHeader}
          removeClippedSubviews
          windowSize={7}
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          updateCellsBatchingPeriod={50}
          ListFooterComponent={
            isAnalyzing ? <ActivityIndicator style={{ margin: 16 }} color="#8E8E93" /> : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={56} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No Photos</Text>
            </View>
          }
        />
      )}

      {/* Grouped similar photos modal */}
      <SimilarGroupsScreen
        visible={showSimilar}
        groups={similarGroups}
        onClose={() => setShowSimilar(false)}
        onDeleteAssets={() => {}}
      />

      {/* PhotoViewer for gallery tap + low quality */}
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={viewerIndex}
        title={viewerTitle}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 32,
  },

  // Header
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#000', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: '#8E8E93', marginBottom: 14 },

  // Segmented control
  segControl: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    padding: 2,
    marginBottom: 16,
  },
  seg: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  segActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  segText: { fontSize: 14, fontWeight: '500', color: '#8E8E93' },
  segTextActive: { color: '#000', fontWeight: '600' },

  // Grid
  row: { gap: 1, marginBottom: 1 },
  photo: { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#E5E5EA' },

  // Collections month headers
  collHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  collMonth: { fontSize: 20, fontWeight: '700', color: '#000' },
  collCount: { fontSize: 13, color: '#8E8E93', marginTop: 1 },

  // Smart Review
  smartSection: { marginBottom: 16, marginTop: 2 },
  smartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  smartTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
  analyzingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EAF4FF',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  analyzingText: { fontSize: 12, color: '#007AFF', fontWeight: '500' },
  smartCards: { gap: 10 },
  smartCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  smartCardThumbs: { width: 70, height: 50, position: 'relative' },
  smartThumb: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  smartCardLabel: { fontSize: 15, fontWeight: '600', color: '#000' },
  smartCardCount: { fontSize: 12, color: '#8E8E93', marginTop: 2 },

  // Permission / empty / loading
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  permissionButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#8E8E93' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#000', marginTop: 16 },
});
