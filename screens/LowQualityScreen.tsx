import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ListRenderItemInfo,
} from 'react-native';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StoredAsset } from '../store/DeletedContext';

interface Props {
  visible: boolean;
  photos: MediaLibrary.Asset[];
  onClose: () => void;
  onDeleteAssets: (assets: StoredAsset[]) => void;
}

const { width: screenWidth } = Dimensions.get('window');
const CELL_SIZE = (screenWidth - 2) / 3;

const toStoredAsset = (a: MediaLibrary.Asset): StoredAsset => ({
  id: a.id,
  uri: a.uri,
  filename: a.filename,
  creationTime: a.creationTime,
  width: a.width,
  height: a.height,
});

export default function LowQualityScreen({
  visible,
  photos,
  onClose,
  onDeleteAssets,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (!visible) {
      setSelectedIds(new Set());
    }
  }, [visible]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleDeleteAll = () => {
    onDeleteAssets(photos.map(toStoredAsset));
    onClose();
  };

  const handleDeleteSelected = () => {
    const selected = photos
      .filter((p) => selectedIds.has(p.id))
      .map(toStoredAsset);
    onDeleteAssets(selected);
    setSelectedIds(new Set());
    onClose();
  };

  const renderItem = ({ item }: ListRenderItemInfo<MediaLibrary.Asset>) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.8}
        style={styles.cell}
      >
        <Image
          source={{ uri: item.uri }}
          style={styles.photo}
          contentFit="cover"
          recyclingKey={item.id}
        />
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={26} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Sticky Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={22} color="#007AFF" />
              <Text style={styles.backText}>Low Quality Photos</Text>
            </TouchableOpacity>
            <View style={styles.headerActions}>
              {hasSelection && (
                <TouchableOpacity
                  style={[styles.headerButton, styles.headerButtonRed]}
                  onPress={handleDeleteSelected}
                  activeOpacity={0.8}
                >
                  <Text style={styles.headerButtonTextRed}>
                    Delete ({selectedIds.size})
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.headerButton, styles.headerButtonRed]}
                onPress={handleDeleteAll}
                activeOpacity={0.8}
              >
                <Text style={styles.headerButtonTextRed}>Delete All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {photos.length > 0 && (
            <Text style={styles.subtitle}>{photos.length} photos</Text>
          )}

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={15} color="#8E8E93" />
            <Text style={styles.infoBannerText}>
              These photos have a width or height below 800px and may appear blurry or low resolution.
            </Text>
          </View>
        </View>

        {photos.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={64} color="#34C759" />
            <Text style={styles.emptyText}>No low quality photos found</Text>
          </View>
        ) : (
          <FlatList
            data={photos}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={3}
            columnWrapperStyle={styles.row}
            removeClippedSubviews
            windowSize={5}
            initialNumToRender={30}
            contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
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
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  headerButtonRed: {
    backgroundColor: '#FEE8E8',
  },
  headerButtonTextRed: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 13,
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginBottom: 2,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#8E8E93',
    lineHeight: 17,
  },
  row: {
    gap: 1,
    marginBottom: 1,
  },
  cell: {
    position: 'relative',
  },
  photo: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    backgroundColor: '#E5E5EA',
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,122,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#8E8E93',
  },
});
