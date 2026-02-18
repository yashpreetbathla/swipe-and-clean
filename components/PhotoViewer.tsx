import {
  Modal,
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { useDeleted, StoredAsset } from '../store/DeletedContext';

const { width: SW, height: SH } = Dimensions.get('window');
const SWIPE_THRESHOLD = 100;

function toStored(a: MediaLibrary.Asset): StoredAsset {
  return {
    id: a.id,
    uri: a.uri,
    filename: a.filename,
    creationTime: a.creationTime,
    width: a.width,
    height: a.height,
  };
}

interface Props {
  visible: boolean;
  photos: MediaLibrary.Asset[];
  initialIndex: number;
  onClose: () => void;
  title?: string;
}

export default function PhotoViewer({
  visible,
  photos,
  initialIndex,
  onClose,
  title,
}: Props) {
  const { addDeleted, addKept, deletedAssets } = useDeleted();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const isTransitioningRef = useRef(false);
  const insets = useSafeAreaInsets();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const bgOpacity = useSharedValue(1);

  const deletedIds = new Set(deletedAssets.map((a) => a.id));
  const safeIdx = Math.min(Math.max(currentIndex, 0), Math.max(photos.length - 1, 0));
  const currentPhoto = photos[safeIdx];
  const nextPhoto = photos[safeIdx + 1];
  const isDeleted = currentPhoto ? deletedIds.has(currentPhoto.id) : false;

  useEffect(() => {
    if (!visible) return;
    setCurrentIndex(initialIndex);
    translateX.value = 0;
    translateY.value = 0;
    rotate.value = 0;
    bgOpacity.value = 1;
    isTransitioningRef.current = false;
  }, [visible, initialIndex]);

  // ─── JS callbacks ─────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    rotate.value = 0;
    bgOpacity.value = 1;
    onClose();
  }, [onClose]);

  const handleDelete = useCallback(() => {
    if (!currentPhoto) return;
    addDeleted(toStored(currentPhoto));
    setCurrentIndex((i) => Math.min(i + 1, photos.length - 1));
    requestAnimationFrame(() => {
      translateX.value = 0;
      rotate.value = 0;
      translateY.value = 0;
      isTransitioningRef.current = false;
    });
  }, [currentPhoto, addDeleted, photos.length]);

  const handleKeep = useCallback(() => {
    if (!currentPhoto) return;
    addKept(toStored(currentPhoto));
    setCurrentIndex((i) => Math.min(i + 1, photos.length - 1));
    requestAnimationFrame(() => {
      translateX.value = 0;
      rotate.value = 0;
      translateY.value = 0;
      isTransitioningRef.current = false;
    });
  }, [currentPhoto, addKept, photos.length]);

  const handleManualDelete = () => {
    if (isTransitioningRef.current || !currentPhoto) return;
    isTransitioningRef.current = true;
    translateX.value = withSpring(-SW * 1.5, { damping: 15, stiffness: 100, velocity: 2000 }, () =>
      runOnJS(handleDelete)()
    );
  };

  const handleManualKeep = () => {
    if (isTransitioningRef.current || !currentPhoto) return;
    isTransitioningRef.current = true;
    translateX.value = withSpring(SW * 1.5, { damping: 15, stiffness: 100, velocity: 2000 }, () =>
      runOnJS(handleKeep)()
    );
  };

  const goPrev = () => {
    if (currentIndex <= 0) return;
    translateX.value = 0;
    rotate.value = 0;
    setCurrentIndex((i) => i - 1);
  };

  const goNext = () => {
    if (currentIndex >= photos.length - 1) return;
    translateX.value = 0;
    rotate.value = 0;
    setCurrentIndex((i) => i + 1);
  };

  // ─── Gestures (Gesture.Race = native direction detection, no JS jitter) ──

  // Horizontal pan: Tinder swipe left = delete, right = keep
  // activeOffsetX fires as soon as X movement starts; failOffsetY cancels if
  // the user drifts vertically first — all decided on the native thread.
  const panH = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-20, 20])
    .onUpdate((e) => {
      translateX.value = e.translationX;
      rotate.value = (e.translationX / SW) * 12;
    })
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD || e.velocityX < -800) {
        translateX.value = withSpring(
          -SW * 1.5,
          { damping: 15, stiffness: 100, velocity: e.velocityX },
          () => runOnJS(handleDelete)()
        );
      } else if (e.translationX > SWIPE_THRESHOLD || e.velocityX > 800) {
        translateX.value = withSpring(
          SW * 1.5,
          { damping: 15, stiffness: 100, velocity: e.velocityX },
          () => runOnJS(handleKeep)()
        );
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        rotate.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  // Vertical pan: swipe down to dismiss
  const panV = Gesture.Pan()
    .activeOffsetY([10, SH])
    .failOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        bgOpacity.value = interpolate(
          e.translationY,
          [0, 300],
          [1, 0.25],
          Extrapolation.CLAMP
        );
      }
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 700) {
        bgOpacity.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(
          SH + 50,
          { duration: 280 },
          () => runOnJS(handleClose)()
        );
      } else {
        translateY.value = withSpring(0, { damping: 20 });
        bgOpacity.value = withSpring(1);
      }
    });

  // Race: whichever gesture activates first wins, the other is cancelled
  const gesture = Gesture.Race(panH, panV);

  // ─── Animated styles ──────────────────────────────────────────────────────

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const bgStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));

  // KEEP / NOPE overlays: driven purely by translateX, no direction check needed
  // (translateX is only set by panH, so it's 0 unless swiping horizontally)
  const keepOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [20, 100], [0, 1], Extrapolation.CLAMP),
  }));

  const nopeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(-translateX.value, [20, 100], [0, 1], Extrapolation.CLAMP),
  }));

  // Back card: scales up and brightens as the front card is dragged
  const backCardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          Math.abs(translateX.value),
          [0, 120],
          [0.94, 1.0],
          Extrapolation.CLAMP
        ),
      },
    ],
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, 80],
      [0.65, 1.0],
      Extrapolation.CLAMP
    ),
  }));

  if (!visible || photos.length === 0) return null;

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.bg, bgStyle]}>

        {/* Back card (next photo) */}
        {nextPhoto && (
          <Animated.View style={[styles.backCardContainer, backCardStyle]}>
            <Image
              source={{ uri: nextPhoto.uri }}
              style={styles.backCardImage}
              contentFit="contain"
              recyclingKey={`back-${nextPhoto.id}`}
              transition={0}
            />
          </Animated.View>
        )}

        {/* Current card */}
        <GestureDetector gesture={gesture}>
          <Animated.View style={[StyleSheet.absoluteFill, cardStyle]}>
            {currentPhoto && (
              <Image
                source={{ uri: currentPhoto.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                recyclingKey={currentPhoto.id}
                transition={0}
              />
            )}

            {/* KEEP label */}
            <Animated.View style={[styles.keepLabel, keepOverlayStyle, { top: insets.top + 90 }]}>
              <View style={styles.keepLabelInner}>
                <Text style={styles.keepLabelText}>KEEP</Text>
              </View>
            </Animated.View>

            {/* NOPE label */}
            <Animated.View style={[styles.nopeLabel, nopeOverlayStyle, { top: insets.top + 90 }]}>
              <View style={styles.nopeLabelInner}>
                <Text style={styles.nopeLabelText}>NOPE</Text>
              </View>
            </Animated.View>

            {/* Deleted badge */}
            {isDeleted && (
              <View style={[styles.deletedBadge, { top: insets.top + 56 }]}>
                <Ionicons name="trash-outline" size={13} color="#fff" />
                <Text style={styles.deletedBadgeText}>Marked for deletion</Text>
              </View>
            )}
          </Animated.View>
        </GestureDetector>

        {/* Top bar — fixed */}
        <View
          style={[styles.topBar, { paddingTop: insets.top + 6 }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            onPress={handleClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="chevron-down" size={26} color="#fff" />
          </TouchableOpacity>
          <View style={styles.topCenter}>
            {title ? <Text style={styles.topTitle}>{title}</Text> : null}
            <Text style={styles.counter}>
              {safeIdx + 1} of {photos.length}
            </Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {/* Bottom action bar — fixed */}
        <View style={[styles.actionRow, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleManualDelete}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={32} color="#FF3B30" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButton, currentIndex === 0 && styles.navButtonDisabled]}
            onPress={goPrev}
            disabled={currentIndex === 0}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-undo-outline"
              size={22}
              color={currentIndex > 0 ? '#fff' : '#444'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.navButton,
              currentIndex >= photos.length - 1 && styles.navButtonDisabled,
            ]}
            onPress={goNext}
            disabled={currentIndex >= photos.length - 1}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-redo-outline"
              size={22}
              color={currentIndex < photos.length - 1 ? '#fff' : '#444'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.keepButton]}
            onPress={handleManualKeep}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark" size={32} color="#34C759" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: '#000' },

  backCardContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backCardImage: {
    width: SW - 24,
    height: SH * 0.7,
    borderRadius: 16,
  },

  keepLabel: { position: 'absolute', right: 20 },
  keepLabelInner: {
    borderWidth: 3,
    borderColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    transform: [{ rotate: '10deg' }],
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  keepLabelText: { color: '#34C759', fontSize: 28, fontWeight: '800', letterSpacing: 2 },

  nopeLabel: { position: 'absolute', left: 20 },
  nopeLabelInner: {
    borderWidth: 3,
    borderColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    transform: [{ rotate: '-10deg' }],
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  nopeLabelText: { color: '#FF3B30', fontSize: 28, fontWeight: '800', letterSpacing: 2 },

  deletedBadge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,59,48,0.85)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  deletedBadgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 20,
  },
  topCenter: { alignItems: 'center' },
  topTitle: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  counter: { color: '#fff', fontSize: 15, fontWeight: '600' },

  actionRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  actionButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  deleteButton: { borderWidth: 2, borderColor: '#FF3B30' },
  keepButton: { borderWidth: 2, borderColor: '#34C759' },
  navButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    borderWidth: 1.5,
    borderColor: '#3A3A3C',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  navButtonDisabled: { opacity: 0.3 },
});
