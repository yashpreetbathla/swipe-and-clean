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
import { StoredAsset } from '../store/DeletedContext';

interface Props {
  visible: boolean;
  groups: MediaLibrary.Asset[][];
  onClose: () => void;
  onDeleteAssets: (assets: StoredAsset[]) => void;
}

const toStoredAsset = (a: MediaLibrary.Asset): StoredAsset => ({
  id: a.id,
  uri: a.uri,
  filename: a.filename,
  creationTime: a.creationTime,
  width: a.width,
  height: a.height,
});

function formatDate(creationTime: number): string {
  const date = new Date(creationTime);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SimilarGroupsScreen({
  visible,
  groups,
  onClose,
  onDeleteAssets,
}: Props) {
  const insets = useSafeAreaInsets();
  const [localGroups, setLocalGroups] = useState<MediaLibrary.Asset[][]>(groups);
  const [selectingGroupIndex, setSelectingGroupIndex] = useState<number | null>(null);

  // Sync localGroups when the groups prop changes (e.g. when modal opens fresh)
  React.useEffect(() => {
    setLocalGroups(groups);
    setSelectingGroupIndex(null);
  }, [groups]);

  const totalPhotos = localGroups.reduce((sum, g) => sum + g.length, 0);

  const handleDeleteAll = (groupIndex: number) => {
    const group = localGroups[groupIndex];
    onDeleteAssets(group.map(toStoredAsset));
    setLocalGroups((prev) => prev.filter((_, i) => i !== groupIndex));
    if (selectingGroupIndex === groupIndex) {
      setSelectingGroupIndex(null);
    }
  };

  const handleSelectBest = (groupIndex: number) => {
    setSelectingGroupIndex(groupIndex);
  };

  const handleKeepOne = (groupIndex: number, keepAsset: MediaLibrary.Asset) => {
    const group = localGroups[groupIndex];
    const toDelete = group.filter((a) => a.id !== keepAsset.id);
    onDeleteAssets(toDelete.map(toStoredAsset));
    setLocalGroups((prev) => prev.filter((_, i) => i !== groupIndex));
    setSelectingGroupIndex(null);
  };

  const renderGroup = ({ item, index }: ListRenderItemInfo<MediaLibrary.Asset[]>) => {
    const isSelecting = selectingGroupIndex === index;
    const dateLabel = formatDate(item[0].creationTime);

    return (
      <View style={styles.groupCard}>
        <Text style={styles.groupDate}>{dateLabel}</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailRow}
        >
          {item.map((asset) => {
            if (isSelecting) {
              return (
                <TouchableOpacity
                  key={asset.id}
                  onPress={() => handleKeepOne(index, asset)}
                  activeOpacity={0.75}
                >
                  <View style={styles.thumbnailWrapper}>
                    <Image
                      source={{ uri: asset.uri }}
                      style={styles.thumbnail}
                      contentFit="cover"
                      recyclingKey={asset.id}
                    />
                    <View style={styles.thumbnailOverlay} />
                    <View style={styles.keepBadge}>
                      <Text style={styles.keepBadgeText}>Keep</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            }
            return (
              <Image
                key={asset.id}
                source={{ uri: asset.uri }}
                style={styles.thumbnail}
                contentFit="cover"
                recyclingKey={asset.id}
              />
            );
          })}
        </ScrollView>

        {isSelecting && (
          <Text style={styles.selectInstruction}>
            Tap the photo you want to keep
          </Text>
        )}

        <View style={styles.groupActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonBlue]}
            onPress={() => handleSelectBest(index)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonTextBlue}>Select Best to Keep</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonRed]}
            onPress={() => handleDeleteAll(index)}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonTextRed}>Delete All in Group</Text>
          </TouchableOpacity>
        </View>
      </View>
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
          {localGroups.length > 0 && (
            <Text style={styles.subtitle}>
              {localGroups.length} group{localGroups.length !== 1 ? 's' : ''} · {totalPhotos} photos
            </Text>
          )}
        </View>

        {localGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
            <Text style={styles.emptyText}>All groups reviewed!</Text>
          </View>
        ) : (
          <FlatList
            data={localGroups}
            keyExtractor={(_, index) => String(index)}
            renderItem={renderGroup}
            contentContainerStyle={[
              styles.list,
              { paddingBottom: insets.bottom + 16 },
            ]}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
  },
  list: {
    padding: 16,
  },
  groupCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  groupDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 10,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 2,
  },
  thumbnailWrapper: {
    position: 'relative',
  },
  thumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#E5E5EA',
  },
  thumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  keepBadge: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  keepBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  selectInstruction: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  groupActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonBlue: {
    backgroundColor: '#E8F0FE',
  },
  actionButtonRed: {
    backgroundColor: '#FEE8E8',
  },
  actionButtonTextBlue: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 13,
  },
  actionButtonTextRed: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#34C759',
  },
});
