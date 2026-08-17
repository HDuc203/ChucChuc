import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ImageBackground,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../stores/cartStore';
import { COLORS } from '../constants/colors';

const { width } = Dimensions.get('window');

// ── Watercolor Bamboo Leaves Animation (Tranh Thủy Mặc) ────────────────────────
interface LeafProps {
  startX: number;
  delay: number;
  duration: number;
  length: number;
  width: number;
  color: string;
  swingAmp: number;
}

function WatercolorBambooLeaf({ startX, delay, duration, length, width, color, swingAmp }: LeafProps) {
  const fallAnim = useRef(new Animated.Value(0)).current;
  const swingAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnimation = () => {
      fallAnim.setValue(0);
      swingAnim.setValue(0);
      rotateAnim.setValue(0);
      opacityAnim.setValue(0);

      Animated.parallel([
        Animated.timing(fallAnim, {
          toValue: 1,
          duration,
          delay,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(opacityAnim, { toValue: 0.5, duration: 1400, delay, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0.5, duration: duration - 2800, delay: 0, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 0, duration: 1400, delay: 0, useNativeDriver: true }),
        ]),
        Animated.loop(
          Animated.sequence([
            Animated.timing(swingAnim, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), delay, useNativeDriver: true }),
            Animated.timing(swingAnim, { toValue: -1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ])
        ),
        Animated.loop(
          Animated.timing(rotateAnim, { toValue: 1, duration: duration * 0.45, delay, easing: Easing.linear, useNativeDriver: true })
        ),
      ]).start(() => {
        setTimeout(startAnimation, Math.random() * 3000 + 1000);
      });
    };

    startAnimation();
  }, []);

  const translateY = fallAnim.interpolate({ inputRange: [0, 1], outputRange: [-40, 860] });
  const translateX = swingAnim.interpolate({ inputRange: [-1, 1], outputRange: [-swingAmp, swingAmp] });
  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '325deg'] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width,
        height: length,
        backgroundColor: color,
        borderTopLeftRadius: length * 0.75,
        borderBottomRightRadius: length * 0.75,
        borderTopRightRadius: width * 0.25,
        borderBottomLeftRadius: width * 0.25,
        opacity: opacityAnim,
        transform: [{ translateY }, { translateX }, { rotate }],
        zIndex: 2,
        pointerEvents: 'none',
      }}
    />
  );
}

// ── Golden Glowing Sunlight Mote ───────────────────────────────────────────────
interface MoteProps {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

function GlowingMote({ x, y, size, delay, duration }: MoteProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: duration / 2, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -15, duration: duration / 2, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#FFE699',
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: size * 2,
        opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.7] }),
        transform: [{ translateY: floatAnim }],
        zIndex: 1,
        pointerEvents: 'none',
      }}
    />
  );
}

// Authentic watercolor ink tones matching the background painting
const LEAVES: LeafProps[] = [
  { startX: 35, delay: 0, duration: 11500, length: 22, width: 6.5, color: '#2B4D38', swingAmp: 28 },
  { startX: 105, delay: 3500, duration: 13500, length: 17, width: 5, color: '#3E664B', swingAmp: 22 },
  { startX: 185, delay: 1200, duration: 10800, length: 24, width: 7.5, color: '#244431', swingAmp: 32 },
  { startX: 265, delay: 5200, duration: 14000, length: 16, width: 4.5, color: '#4A7258', swingAmp: 20 },
  { startX: 325, delay: 2400, duration: 12200, length: 20, width: 6, color: '#335740', swingAmp: 26 },
];

const MOTES: MoteProps[] = [
  { x: 40, y: 180, size: 5, delay: 0, duration: 3400 },
  { x: 120, y: 260, size: 7, delay: 800, duration: 4200 },
  { x: 280, y: 220, size: 5, delay: 1500, duration: 3800 },
  { x: 70, y: 480, size: 6, delay: 400, duration: 4000 },
  { x: 310, y: 450, size: 5, delay: 1100, duration: 4400 },
  { x: 180, y: 380, size: 7, delay: 2000, duration: 3700 },
];

export default function IndexScreen() {
  const router = useRouter();
  const { setOrderType, clearCart } = useCartStore();

  const handleSelect = (type: 'takeaway' | 'dine_in') => {
    clearCart();
    setOrderType(type);
    if (type === 'dine_in') {
      router.push('/table-select');
    } else {
      router.push('/menu');
    }
  };

  return (
    <ImageBackground
      source={require('../assets/images/oriental_bg.jpg')}
      style={styles.bgImage}
      resizeMode="cover"
    >
      {/* Subtle misty tint overlay for readability */}
      <View style={styles.mistOverlay} />

      <SafeAreaView style={styles.container}>
        {/* Animated Falling Leaves Layer */}
        <View style={styles.leavesLayer} pointerEvents="none">
          {LEAVES.map((leaf, i) => (
            <WatercolorBambooLeaf key={`leaf-${i}`} {...leaf} />
          ))}
          {MOTES.map((mote, i) => (
            <GlowingMote key={`mote-${i}`} {...mote} />
          ))}
        </View>

        {/* ── HEADER: Brand & Service Prompt ─────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.brandIconContainer}>
            <Image
              source={require('../assets/images/chucchuc_logo.jpg')}
              style={styles.brandLogoImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brandTitle}>CHÚC CHÚC</Text>
          <Text style={styles.brandSubtitle}>Trà · Cà phê · Thư thái</Text>
          <View style={styles.dividerLine} />
          <Text style={styles.servicePrompt}>Quý khách vui lòng chọn dịch vụ</Text>
        </View>

        {/* ── MAIN ACTION CARDS (2D Hand-drawn Glassmorphism) ───────────────── */}
        <View style={styles.cardsRow}>
          {/* MANG VỀ (Takeaway) */}
          <TouchableOpacity
            id="btn-takeaway"
            style={styles.cardItem}
            onPress={() => handleSelect('takeaway')}
            activeOpacity={0.88}
          >
            <View style={styles.cardGlowBorder}>
              <View style={styles.cardArtFrame}>
                <Image
                  source={require('../assets/images/takeaway_icon.jpg')}
                  style={styles.cardArtImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.cardMainTitle}>MANG VỀ</Text>
              <Text style={styles.cardSubText}>Đặt món mang đi</Text>
              <Text style={styles.cardSubTextExtra}>nhanh chóng</Text>
            </View>
          </TouchableOpacity>

          {/* TẠI BÀN (Dine-in) */}
          <TouchableOpacity
            id="btn-dine-in"
            style={styles.cardItem}
            onPress={() => handleSelect('dine_in')}
            activeOpacity={0.88}
          >
            <View style={styles.cardGlowBorder}>
              <View style={styles.cardArtFrame}>
                <Image
                  source={require('../assets/images/dinein_icon.jpg')}
                  style={styles.cardArtImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.cardMainTitle}>TẠI BÀN</Text>
              <Text style={styles.cardSubText}>Đặt chỗ & Phục vụ</Text>
              <Text style={styles.cardSubTextExtra}>tại quán</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── BOTTOM DOCK: Frosted Glass Navigation Bar ───────────────────── */}
        <View style={styles.bottomDockWrapper}>
          <View style={styles.bottomDock}>
            <TouchableOpacity
              id="btn-manage"
              style={styles.dockTab}
              onPress={() => router.push('/manage')}
              activeOpacity={0.8}
            >
              <View style={styles.dockIconBox}>
                <Text style={styles.dockEmoji}>🛠️</Text>
              </View>
              <Text style={styles.dockLabel}>Quản lý</Text>
            </TouchableOpacity>

            <TouchableOpacity
              id="btn-orders-history"
              style={styles.dockTab}
              onPress={() => router.push('/orders-history' as any)}
              activeOpacity={0.8}
            >
              <View style={styles.dockIconBox}>
                <Text style={styles.dockEmoji}>📜</Text>
              </View>
              <Text style={styles.dockLabel}>Lịch sử</Text>
            </TouchableOpacity>

            <TouchableOpacity
              id="btn-expenses"
              style={styles.dockTab}
              onPress={() => router.push('/expenses' as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.dockIconBox, styles.dockIconExpense]}>
                <Text style={styles.dockEmoji}>💸</Text>
              </View>
              <Text style={[styles.dockLabel, styles.dockLabelExpense]}>Chi phí</Text>
            </TouchableOpacity>

            <TouchableOpacity
              id="btn-dashboard"
              style={styles.dockTab}
              onPress={() => router.push('/dashboard')}
              activeOpacity={0.8}
            >
              <View style={styles.dockIconBox}>
                <Text style={styles.dockEmoji}>📊</Text>
              </View>
              <Text style={styles.dockLabel}>Báo cáo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bgImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mistOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(250, 248, 240, 0.28)',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 18,
  },
  leavesLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },

  // Header Styles
  header: {
    alignItems: 'center',
    marginTop: 6,
    zIndex: 3,
  },
  brandIconContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 1.5,
    borderColor: 'rgba(197, 160, 89, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
    shadowColor: 'rgba(197, 160, 89, 0.35)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
  },
  brandLogoImage: {
    width: '92%',
    height: '92%',
    borderRadius: 35,
  },
  brandTitle: {
    fontSize: 24,
    fontFamily: 'Nunito_700Bold',
    color: '#234635',
    letterSpacing: 2.5,
    marginBottom: 2,
  },
  brandSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#657E70',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  dividerLine: {
    width: 42,
    height: 2,
    backgroundColor: 'rgba(197, 160, 89, 0.45)',
    borderRadius: 1,
    marginBottom: 6,
  },
  servicePrompt: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#4B6355',
    marginBottom: 14,
    letterSpacing: 0.3,
  },

  // 2D Service Cards
  cardsRow: {
    flexDirection: 'row',
    gap: 16,
    marginVertical: 18,
    zIndex: 3,
    justifyContent: 'center',
  },
  cardItem: {
    flex: 1,
    maxWidth: 175,
    borderRadius: 26,
    shadowColor: 'rgba(160, 130, 80, 0.25)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 8,
  },
  cardGlowBorder: {
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(215, 185, 135, 0.65)',
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  cardArtFrame: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(210, 185, 140, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: 'rgba(0, 0, 0, 0.05)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardArtImage: {
    width: '92%',
    height: '92%',
  },
  cardMainTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: '#284434',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  cardSubText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: '#5C7466',
    textAlign: 'center',
  },
  cardSubTextExtra: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: '#5C7466',
    textAlign: 'center',
  },

  // Bottom Frosted Navigation Dock
  bottomDockWrapper: {
    alignItems: 'center',
    zIndex: 3,
    marginBottom: 6,
  },
  bottomDock: {
    width: '100%',
    maxWidth: 390,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(205, 180, 135, 0.55)',
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    alignItems: 'center',
    shadowColor: 'rgba(60, 80, 60, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
  },
  dockTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dockIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(235, 247, 240, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(180, 220, 195, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  dockIconExpense: {
    backgroundColor: 'rgba(255, 245, 220, 0.9)',
    borderColor: 'rgba(230, 205, 135, 0.7)',
  },
  dockEmoji: {
    fontSize: 18,
  },
  dockLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 11,
    color: '#345543',
  },
  dockLabelExpense: {
    color: '#7D6010',
  },
});
