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
import { useState, useEffect, useCallback, useMemo } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useDeleted, StoredAsset } from '../store/DeletedContext';
import { detectSimilarGroups, detectLowQuality } from '../utils/photoAnalysis';
import SimilarGroupsScreen from './SimilarGroupsScreen';
import LowQualityScreen from './LowQualityScreen';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const CELL_SIZE = (width - 2) / NUM_COLUMNS;

export default function GalleryScreen() {
  const [permission, requestPermission] = MediaLibrary.usePermissions();
  const [photos, setPhotos] = useState<MediaLibrary.Asset[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const { deletedAssets, keptIds, addDeleted } = useDeleted();
  const deletedIds = new Set(deletedAssets.map((a) => a.id));
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [showSimilar, setShowSimilar] = useState(false);
  const [showLowQuality, setShowLowQuality] = useState(false);

  const similarGroups = useMemo(() => detectSimilarGroups(photos), [photos]);
  const lowQualityPhotos = useMemo(
    () => detectLowQuality(photos.filter((p) => !deletedIds.has(p.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photos, deletedIds.size]
  );
  const totalSimilarPhotos = similarGroups.reduce((sum, g) => sum + g.length, 0);

  const handleDeleteAssets = (assets: StoredAsset[]) => {
    assets.forEach((a) => addDeleted(a));
  };

  const loadPhotos = useCallback(async (cursor?: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        first: 60,
        after: cursor,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      setPhotos((prev) => (cursor ? [...prev, ...result.assets] : result.assets));
      if (!cursor) setTotalCount(result.totalCount);
      setEndCursor(result.endCursor);
      setHasNextPage(result.hasNextPage);
    } catch (e) {
      console.warn('Failed to load photos:', e);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    if (permission?.granted) loadPhotos();
  }, [permission?.granted]);

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

  const visiblePhotos = photos.filter((p) => !deletedIds.has(p.id));
  const unreviewedCount = visiblePhotos.filter((p) => !keptIds.includes(p.id)).length;

  if (initialLoading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your photos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={visiblePhotos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Image source={{ uri: item.uri }} style={styles.photo} contentFit="cover" recyclingKey={item.id} />
        )}
        numColumns={NUM_COLUMNS}
        columnWrapperStyle={styles.row}
        onEndReached={() => hasNextPage && loadPhotos(endCursor)}
        onEndReachedThreshold={0.4}
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
        ListHeaderComponent={
          <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
            <Text style={styles.headerTitle}>Gallery</Text>
            <Text style={styles.headerSubtitle}>
              {totalCount !== null
                ? `${totalCount - deletedAssets.length} photos`
                : `${visiblePhotos.length} photos`}
            </Text>
            {unreviewedCount > 0 && (
              <TouchableOpacity
                style={styles.reviewBanner}
                onPress={() => navigation.navigate('Review')}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-horizontal-outline" size={20} color="#fff" />
                <Text style={styles.reviewBannerText}>
                  {unreviewedCount} photos to review
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </TouchableOpacity>
            )}
            {(similarGroups.length > 0 || lowQualityPhotos.length > 0) && (
              <View style={styles.smartSection}>
                <Text style={styles.smartTitle}>Smart Review</Text>
                <View style={styles.smartCards}>
                  {similarGroups.length > 0 && (
                    <TouchableOpacity
                      style={styles.smartCard}
                      onPress={() => setShowSimilar(true)}
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
                          {similarGroups.length} group{similarGroups.length !== 1 ? 's' : ''} · {totalSimilarPhotos} photos
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                    </TouchableOpacity>
                  )}
                  {lowQualityPhotos.length > 0 && (
                    <TouchableOpacity
                      style={styles.smartCard}
                      onPress={() => setShowLowQuality(true)}
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
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        }
        ListFooterComponent={
          loading ? <ActivityIndicator style={{ margin: 16 }} color="#8E8E93" /> : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="images-outline" size={56} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>No Photos</Text>
          </View>
        }
      />
      <SimilarGroupsScreen
        visible={showSimilar}
        groups={similarGroups}
        onClose={() => setShowSimilar(false)}
        onDeleteAssets={handleDeleteAssets}
      />
      <LowQualityScreen
        visible={showLowQuality}
        photos={lowQualityPhotos}
        onClose={() => setShowLowQuality(false)}
        onDeleteAssets={handleDeleteAssets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32 },
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#fff' },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#000', marginBottom: 2 },
  headerSubtitle: { fontSize: 14, color: '#8E8E93', marginBottom: 12 },
  reviewBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#007AFF',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, gap: 8,
  },
  reviewBannerText: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 15 },
  row: { gap: 1, marginBottom: 1 },
  photo: { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#E5E5EA' },
  permissionTitle: { fontSize: 22, fontWeight: '700', color: '#000', marginTop: 20, marginBottom: 10, textAlign: 'center' },
  permissionSubtitle: { fontSize: 15, color: '#8E8E93', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  permissionButton: { backgroundColor: '#007AFF', paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  permissionButtonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  loadingText: { marginTop: 12, fontSize: 15, color: '#8E8E93' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#000', marginTop: 16 },
  smartSection: { paddingHorizontal: 0, marginBottom: 16, marginTop: 4 },
  smartTitle: { fontSize: 20, fontWeight: '700', color: '#000', marginBottom: 10 },
  smartCards: { gap: 10 },
  smartCard: { backgroundColor: '#F2F2F7', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  smartCardThumbs: { width: 70, height: 50, position: 'relative' },
  smartThumb: { position: 'absolute', width: 44, height: 44, borderRadius: 8, borderWidth: 1.5, borderColor: '#fff' },
  smartCardLabel: { fontSize: 15, fontWeight: '600', color: '#000' },
  smartCardCount: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
});
