import { StyleSheet, View, Text, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  SharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import type { StoredAsset } from '../store/DeletedContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 110;

interface SwipeCardProps {
  asset: StoredAsset;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  onKeep: () => void;
  onDelete: () => void;
}

export default function SwipeCard({
  asset,
  translateX,
  translateY,
  onKeep,
  onDelete,
}: SwipeCardProps) {
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(SCREEN_WIDTH * 1.5, { velocity: e.velocityX }, () => {
          runOnJS(onKeep)();
        });
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-SCREEN_WIDTH * 1.5, { velocity: e.velocityX }, () => {
          runOnJS(onDelete)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 15 });
        translateY.value = withSpring(0, { damping: 15 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
          [-12, 0, 12],
          Extrapolation.CLAMP
        )}deg`,
      },
    ],
  }));

  const keepOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD * 0.6], [0, 1], Extrapolation.CLAMP),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD * 0.6, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const formattedDate = new Date(asset.creationTime).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Image
          source={{ uri: asset.uri }}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Gradient overlay for bottom info */}
        <View style={styles.bottomOverlay}>
          <Text style={styles.filename} numberOfLines={1}>
            {asset.filename}
          </Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>

        {/* KEEP label — top right */}
        <Animated.View style={[styles.labelContainer, styles.keepLabel, keepOpacity]}>
          <Text style={styles.keepText}>KEEP</Text>
        </Animated.View>

        {/* NOPE label — top left */}
        <Animated.View style={[styles.labelContainer, styles.nopeLabel, nopeOpacity]}>
          <Text style={styles.nopeText}>NOPE</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SCREEN_WIDTH - 24,
    height: SCREEN_HEIGHT * 0.68,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: 40,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  filename: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  date: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
  },
  labelContainer: {
    position: 'absolute',
    top: 36,
    borderWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  keepLabel: {
    right: 20,
    borderColor: '#34C759',
    transform: [{ rotate: '15deg' }],
  },
  nopeLabel: {
    left: 20,
    borderColor: '#FF3B30',
    transform: [{ rotate: '-15deg' }],
  },
  keepText: {
    color: '#34C759',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },
  nopeText: {
    color: '#FF3B30',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 2,
  },
});
