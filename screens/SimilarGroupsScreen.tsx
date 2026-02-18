import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ListRenderItemInfo,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StoredAsset, useDeleted } from '../store/DeletedContext';
import PhotoViewer from '../components/PhotoViewer';

interface Props {
  visible: boolean;
  groups: MediaLibrary.Asset[][];
  onClose: () => void;
  onDeleteAssets: (assets: StoredAsset[]) => void;
}

function formatDate(creationTime: number): string {
  return new Date(creationTime).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SimilarGroupsScreen({ visible, groups, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { deletedAssets, keptIds } = useDeleted();

  // Viewer state for reviewing a single group
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<MediaLibrary.Asset[]>([]);

  const deletedSet = new Set(deletedAssets.map((a) => a.id));
  const keptSet = new Set(keptIds);

  // A group is resolved when every photo in it has been decided (deleted or kept)
  const activeGroups = groups.filter(
    (group) => !group.every((p) => deletedSet.has(p.id) || keptSet.has(p.id))
  );

  const openGroupViewer = (group: MediaLibrary.Asset[]) => {
    setViewerPhotos(group);
    setViewerVisible(true);
  };

  const renderGroup = ({ item }: ListRenderItemInfo<MediaLibrary.Asset[]>) => {
    const dateLabel = formatDate(item[0].creationTime);
    // Count how many in this group are already decided
    const decidedCount = item.filter((p) => deletedSet.has(p.id) || keptSet.has(p.id)).length;
    const remaining = item.length - decidedCount;

    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => openGroupViewer(item)}
        activeOpacity={0.8}
      >
        {/* Date + progress */}
        <View style={styles.groupCardHeader}>
          <Text style={styles.groupDate}>{dateLabel}</Text>
          <View style={styles.groupBadge}>
            <Text style={styles.groupBadgeText}>
              {remaining > 0 ? `${remaining} to review` : 'Done ✓'}
            </Text>
          </View>
        </View>

        {/* Thumbnail strip */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailRow}
          scrollEnabled={false}
        >
          {item.map((asset) => {
            const isDeleted = deletedSet.has(asset.id);
            const isKept = keptSet.has(asset.id);
            return (
              <View key={asset.id} style={styles.thumbnailWrapper}>
                <Image
                  source={{ uri: asset.uri }}
                  style={[styles.thumbnail, (isDeleted || isKept) && styles.thumbnailDim]}
                  contentFit="cover"
                  recyclingKey={asset.id}
                />
                {isDeleted && (
                  <View style={[styles.decisionBadge, styles.deletedBadge]}>
                    <Ionicons name="close" size={12} color="#fff" />
                  </View>
                )}
                {isKept && (
                  <View style={[styles.decisionBadge, styles.keptBadge]}>
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Tap hint */}
        <View style={styles.reviewHint}>
          <Text style={styles.reviewHintText}>Tap to review group</Text>
          <Ionicons name="chevron-forward" size={14} color="#007AFF" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#007AFF" />
            <Text style={styles.backText}>Similar Photos</Text>
          </TouchableOpacity>
          <Text style={styles.subtitle}>
            {activeGroups.length > 0
              ? `${activeGroups.length} group${activeGroups.length !== 1 ? 's' : ''} · swipe each group to keep or delete`
              : 'All groups reviewed!'}
          </Text>
        </View>

        {activeGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
            <Text style={styles.emptyText}>All groups reviewed!</Text>
          </View>
        ) : (
          <FlatList
            data={activeGroups}
            keyExtractor={(_, index) => String(index)}
            renderItem={renderGroup}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
          />
        )}
      </View>

      {/* PhotoViewer opens on top of this modal for the selected group */}
      <PhotoViewer
        visible={viewerVisible}
        photos={viewerPhotos}
        initialIndex={0}
        title="Review Group"
        onClose={() => setViewerVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backText: { fontSize: 17, fontWeight: '600', color: '#007AFF' },
  subtitle: { fontSize: 13, color: '#8E8E93', marginTop: 4 },

  list: { padding: 16 },

  groupCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  groupDate: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  groupBadge: {
    backgroundColor: '#EAF4FF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  groupBadgeText: { fontSize: 11, fontWeight: '600', color: '#007AFF' },

  thumbnailRow: { flexDirection: 'row', gap: 8, paddingBottom: 2 },
  thumbnailWrapper: { position: 'relative' },
  thumbnail: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#E5E5EA',
  },
  thumbnailDim: { opacity: 0.5 },
  decisionBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletedBadge: { backgroundColor: '#FF3B30' },
  keptBadge: { backgroundColor: '#34C759' },

  reviewHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 10,
  },
  reviewHintText: { fontSize: 13, color: '#007AFF', fontWeight: '500' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#34C759' },
});
