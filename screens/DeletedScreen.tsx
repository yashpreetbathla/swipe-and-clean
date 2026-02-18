import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useState, useCallback } from 'react';
import * as MediaLibrary from 'expo-media-library';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDeleted, StoredAsset } from '../store/DeletedContext';

const { width } = Dimensions.get('window');
const CELL_SIZE = (width - 2) / 3;

export default function DeletedScreen() {
  const { deletedAssets, recoverAsset, recoverAll, removeFromDeleted } = useDeleted();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const insets = useSafeAreaInsets();

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = () => { setIsSelectMode(false); setSelectedIds(new Set()); };

  const handleDeleteAll = () => {
    Alert.alert('Permanently Delete All?', `This will permanently delete all ${deletedAssets.length} photos. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await MediaLibrary.deleteAssetsAsync(deletedAssets.map((a) => a.id));
            removeFromDeleted(deletedAssets.map((a) => a.id));
          } catch (e) { console.warn('Delete cancelled:', e); }
          finally { setDeleting(false); }
        }
      },
    ]);
  };

  const handleRecoverAll = () => {
    Alert.alert('Recover All Photos?', `${deletedAssets.length} photos will be moved back to your gallery.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Recover All', onPress: () => recoverAll() },
    ]);
  };

  const handleDeleteSelected = () => {
    const count = selectedIds.size;
    Alert.alert(`Delete ${count} Photo${count > 1 ? 's' : ''}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeleting(true);
          const ids = Array.from(selectedIds);
          try {
            await MediaLibrary.deleteAssetsAsync(ids);
            removeFromDeleted(ids);
            exitSelectMode();
          } catch (e) { console.warn('Delete cancelled:', e); }
          finally { setDeleting(false); }
        }
      },
    ]);
  };

  const handleRecoverSelected = () => {
    Array.from(selectedIds).forEach((id) => recoverAsset(id));
    exitSelectMode();
  };

  const renderItem = ({ item }: { item: StoredAsset }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (isSelectMode) { toggleSelect(item.id); }
          else { setIsSelectMode(true); toggleSelect(item.id); }
        }}
        onLongPress={() => { if (!isSelectMode) { setIsSelectMode(true); toggleSelect(item.id); } }}
        style={styles.photoWrapper}
      >
        <Image source={{ uri: item.uri }} style={[styles.photo, isSelected && styles.photoSelected]} contentFit="cover" recyclingKey={item.id} />
        {isSelected && (
          <View style={styles.checkOverlay}>
            <Ionicons name="checkmark-circle" size={26} color="#007AFF" />
          </View>
        )}
        {isSelectMode && !isSelected && <View style={styles.uncheckedOverlay} />}
      </TouchableOpacity>
    );
  };

  if (deleting) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#FF3B30" />
        <Text style={styles.deletingText}>Deleting photos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Sticky header — always visible */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>
              {isSelectMode ? `${selectedIds.size} Selected` : 'Deleted'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {deletedAssets.length} photo{deletedAssets.length !== 1 ? 's' : ''}
            </Text>
          </View>
          {isSelectMode && (
            <TouchableOpacity onPress={exitSelectMode} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bulk action buttons — always shown when photos exist */}
        {deletedAssets.length > 0 && !isSelectMode && (
          <View style={styles.bulkActions}>
            <TouchableOpacity style={[styles.bulkButton, styles.recoverButton]} onPress={handleRecoverAll} activeOpacity={0.8}>
              <Ionicons name="arrow-undo-outline" size={18} color="#007AFF" />
              <Text style={styles.recoverButtonText}>Recover All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkButton, styles.deleteAllButton]} onPress={handleDeleteAll} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              <Text style={styles.deleteAllButtonText}>Delete All</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Selection action buttons */}
        {isSelectMode && selectedIds.size > 0 && (
          <View style={styles.bulkActions}>
            <TouchableOpacity style={[styles.bulkButton, styles.recoverButton]} onPress={handleRecoverSelected} activeOpacity={0.8}>
              <Ionicons name="arrow-undo-outline" size={18} color="#007AFF" />
              <Text style={styles.recoverButtonText}>Recover Selected</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bulkButton, styles.deleteAllButton]} onPress={handleDeleteSelected} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              <Text style={styles.deleteAllButtonText}>Delete Selected</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={15} color="#8E8E93" />
          <Text style={styles.infoText}>
            Tap a photo to select. Photos are still in your iOS library until permanently deleted.
          </Text>
        </View>
      </View>

      {/* Photo grid */}
      {deletedAssets.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="trash-outline" size={44} color="#C7C7CC" />
          </View>
          <Text style={styles.emptyTitle}>No Deleted Photos</Text>
          <Text style={styles.emptySubtitle}>
            Photos you swipe left in Review will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={deletedAssets}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={3}
          columnWrapperStyle={styles.row}
          removeClippedSubviews
          windowSize={5}
          initialNumToRender={30}
          maxToRenderPerBatch={20}
          updateCellsBatchingPeriod={50}
          getItemLayout={(_, index) => ({
            length: CELL_SIZE,
            offset: CELL_SIZE * Math.floor(index / 3),
            index,
          })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 32 },
  stickyHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTitle: { fontSize: 32, fontWeight: '700', color: '#000', marginBottom: 2 },
  headerSubtitle: { fontSize: 14, color: '#8E8E93' },
  cancelButton: { paddingHorizontal: 12, paddingVertical: 6 },
  cancelText: { color: '#007AFF', fontSize: 17, fontWeight: '500' },
  bulkActions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  bulkButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12 },
  recoverButton: { backgroundColor: '#EAF4FF' },
  recoverButtonText: { color: '#007AFF', fontWeight: '600', fontSize: 14 },
  deleteAllButton: { backgroundColor: '#FFF0EE' },
  deleteAllButtonText: { color: '#FF3B30', fontWeight: '600', fontSize: 14 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  infoText: { flex: 1, fontSize: 12, color: '#8E8E93', lineHeight: 17 },
  row: { gap: 1, marginBottom: 1 },
  photoWrapper: { width: CELL_SIZE, height: CELL_SIZE, position: 'relative' },
  photo: { width: CELL_SIZE, height: CELL_SIZE, backgroundColor: '#E5E5EA' },
  photoSelected: { opacity: 0.7 },
  checkOverlay: { position: 'absolute', top: 4, right: 4, backgroundColor: '#fff', borderRadius: 13, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  uncheckedOverlay: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#fff' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIconWrapper: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#F2F2F7', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#000', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#8E8E93', textAlign: 'center', lineHeight: 22 },
  deletingText: { marginTop: 12, fontSize: 15, color: '#8E8E93' },
});
