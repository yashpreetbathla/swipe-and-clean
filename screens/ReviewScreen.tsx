import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useState, useEffect, useCallback, useRef } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

import SwipeCard from '../components/SwipeCard';
import { useDeleted, StoredAsset } from '../store/DeletedContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LOAD_BATCH = 30;

export default function ReviewScreen() {
  const [permission] = MediaLibrary.usePermissions();
  const [queue, setQueue] = useState<StoredAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [endCursor, setEndCursor] = useState<string | undefined>(undefined);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [reviewed, setReviewed] = useState(0);
  const [tutorialShown, setTutorialShown] = useState(false);

  const { deletedAssets, keptIds, addDeleted, addKept, undoLast, lastAction } = useDeleted();
  const deletedIds = new Set(deletedAssets.map((a) => a.id));
  const keptSet = new Set(keptIds);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const isTransitioning = useRef(false);
  const insets = useSafeAreaInsets();

  const backCardStyle = useAnimatedStyle(() => ({
    transform: [{
      scale: interpolate(Math.abs(translateX.value), [0, 120], [0.94, 1.0], Extrapolation.CLAMP),
    }],
    opacity: interpolate(Math.abs(translateX.value), [0, 60], [0.65, 1.0], Extrapolation.CLAMP),
  }));

  const loadMore = useCallback(async (cursor?: string) => {
    if (!permission?.granted) return;
    try {
      const result = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.photo,
        first: LOAD_BATCH,
        after: cursor,
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      if (!cursor) setTotalCount(result.totalCount);
      const newAssets: StoredAsset[] = result.assets
        .filter((a) => !deletedIds.has(a.id) && !keptSet.has(a.id))
        .map((a) => ({
          id: a.id, uri: a.uri, filename: a.filename,
          creationTime: a.creationTime, width: a.width, height: a.height,
        }));
      setQueue((prev) => (cursor ? [...prev, ...newAssets] : newAssets));
      setEndCursor(result.endCursor);
      setHasNextPage(result.hasNextPage);
    } catch (e) {
      console.warn('Failed to load photos:', e);
    } finally {
      setLoading(false);
    }
  }, [permission?.granted]);

  useEffect(() => {
    if (permission?.granted) loadMore();
    else setLoading(false);
  }, [permission?.granted]);

  useEffect(() => {
    if (!loading && queue.length > 0 && !tutorialShown) {
      setTutorialShown(true);
      setTimeout(() => {
        translateX.value = withSequence(
          withTiming(-55, { duration: 300 }),
          withSpring(55, { damping: 10 }),
          withSpring(0, { damping: 14 })
        );
      }, 600);
    }
  }, [loading, queue.length, tutorialShown]);

  useEffect(() => {
    if (queue.length < 5 && hasNextPage && !loading && endCursor) loadMore(endCursor);
  }, [queue.length]);

  const advanceQueue = useCallback(() => {
    // Update queue first, then reset position on next frame to avoid glitch
    setQueue((prev) => prev.slice(1));
    setReviewed((r) => r + 1);
    requestAnimationFrame(() => {
      translateX.value = 0;
      translateY.value = 0;
      isTransitioning.current = false;
    });
  }, []);

  const handleKeep = useCallback(() => {
    if (!queue[0]) return;
    addKept(queue[0]);
    advanceQueue();
  }, [queue, addKept, advanceQueue]);

  const handleDelete = useCallback(() => {
    if (!queue[0]) return;
    addDeleted(queue[0]);
    advanceQueue();
  }, [queue, addDeleted, advanceQueue]);

  const handleUndo = useCallback(() => {
    if (!lastAction) return;
    undoLast();
    setQueue((prev) => [lastAction.asset, ...prev]);
    setReviewed((r) => Math.max(0, r - 1));
    translateX.value = 0;
    translateY.value = 0;
  }, [lastAction, undoLast]);

  // Skip: move current photo to end of queue without deciding
  const handleSkip = useCallback(() => {
    if (!queue[0]) return;
    translateX.value = withTiming(0, { duration: 0 });
    translateY.value = withTiming(0, { duration: 0 });
    setQueue((prev) => {
      const [current, ...rest] = prev;
      return [...rest, current];
    });
  }, [queue]);

  const handleManualKeep = () => {
    if (isTransitioning.current || queue.length === 0) return;
    isTransitioning.current = true;
    translateX.value = withSpring(SCREEN_WIDTH * 1.5, { velocity: 2000 }, () => { handleKeep(); });
  };

  const handleManualDelete = () => {
    if (isTransitioning.current || queue.length === 0) return;
    isTransitioning.current = true;
    translateX.value = withSpring(-SCREEN_WIDTH * 1.5, { velocity: 2000 }, () => { handleDelete(); });
  };

  const progress = totalCount > 0 ? reviewed / totalCount : 0;
  const currentAsset = queue[0];
  const nextAsset = queue[1];

  if (!permission?.granted) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="lock-closed-outline" size={56} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No Photo Access</Text>
        <Text style={styles.emptySubtitle}>Go to Gallery tab and allow photo access.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading photos...</Text>
      </View>
    );
  }

  if (!currentAsset) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={48} color="#fff" />
        </View>
        <Text style={styles.doneTitle}>All Done!</Text>
        <Text style={styles.emptySubtitle}>
          You've reviewed all your photos.{'\n'}Check the Deleted tab to manage removed photos.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Review</Text>
        <Text style={styles.headerSubtitle}>{reviewed} reviewed · {queue.length} remaining</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>

      <View style={styles.hintRow}>
        <View style={styles.hintLeft}>
          <Ionicons name="close-circle" size={18} color="#FF3B30" />
          <Text style={styles.hintTextDelete}>Delete</Text>
        </View>
        <View style={styles.hintRight}>
          <Text style={styles.hintTextKeep}>Keep</Text>
          <Ionicons name="checkmark-circle" size={18} color="#34C759" />
        </View>
      </View>

      <View style={styles.cardStack}>
        {nextAsset && (
          <Animated.View style={[styles.backCardWrapper, backCardStyle]}>
            <View style={styles.backCard}>
              <Image source={{ uri: nextAsset.uri }} style={styles.backCardImage} resizeMode="cover" />
            </View>
          </Animated.View>
        )}
        <SwipeCard
          asset={currentAsset}
          translateX={translateX}
          translateY={translateY}
          onKeep={handleKeep}
          onDelete={handleDelete}
        />
      </View>

      <View style={[styles.actionRow, { paddingBottom: insets.bottom + 8 }]}>
        {/* Delete */}
        <TouchableOpacity style={[styles.actionButton, styles.deleteButton]} onPress={handleManualDelete} activeOpacity={0.8}>
          <Ionicons name="close" size={32} color="#FF3B30" />
        </TouchableOpacity>

        {/* Back (undo last swipe) */}
        <TouchableOpacity
          style={[styles.navButton, !lastAction && styles.navButtonDisabled]}
          onPress={handleUndo}
          disabled={!lastAction}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-undo-outline" size={24} color={lastAction ? '#fff' : '#444'} />
        </TouchableOpacity>

        {/* Forward (skip current photo) */}
        <TouchableOpacity
          style={[styles.navButton, queue.length <= 1 && styles.navButtonDisabled]}
          onPress={handleSkip}
          disabled={queue.length <= 1}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-redo-outline" size={24} color={queue.length > 1 ? '#fff' : '#444'} />
        </TouchableOpacity>

        {/* Keep */}
        <TouchableOpacity style={[styles.actionButton, styles.keepButton]} onPress={handleManualKeep} activeOpacity={0.8}>
          <Ionicons name="checkmark" size={32} color="#34C759" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', padding: 32 },
  header: { alignSelf: 'stretch', paddingHorizontal: 20, paddingBottom: 10, paddingTop: 8 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, color: '#8E8E93' },
  progressTrack: { alignSelf: 'stretch', height: 3, backgroundColor: '#2C2C2E', marginHorizontal: 20, borderRadius: 2, marginBottom: 12 },
  progressFill: { height: 3, backgroundColor: '#007AFF', borderRadius: 2 },
  hintRow: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', paddingHorizontal: 28, marginBottom: 12 },
  hintLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hintRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hintTextDelete: { color: '#FF3B30', fontSize: 13, fontWeight: '600' },
  hintTextKeep: { color: '#34C759', fontSize: 13, fontWeight: '600' },
  cardStack: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backCardWrapper: { position: 'absolute', width: SCREEN_WIDTH - 24, alignItems: 'center' },
  backCard: { width: SCREEN_WIDTH - 24, height: SCREEN_HEIGHT * 0.68, borderRadius: 20, overflow: 'hidden', backgroundColor: '#1C1C1E' },
  backCardImage: { flex: 1, width: '100%' },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 16, paddingHorizontal: 24, alignSelf: 'stretch' },
  actionButton: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C1C1E', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  deleteButton: { borderWidth: 2, borderColor: '#FF3B30' },
  keepButton: { borderWidth: 2, borderColor: '#34C759' },
  navButton: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1C1C1E', borderWidth: 1.5, borderColor: '#3A3A3C', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
  navButtonDisabled: { opacity: 0.3 },
  doneIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#34C759', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  doneTitle: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 12 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 20, marginBottom: 10, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#8E8E93', textAlign: 'center', lineHeight: 22 },
  loadingText: { marginTop: 12, fontSize: 15, color: '#8E8E93' },
});
