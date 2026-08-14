import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../stores/cartStore';
import { COLORS } from '../constants/colors';

const { width } = Dimensions.get('window');

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
    <SafeAreaView style={styles.container}>
      {/* Decorative blobs */}
      <View style={styles.blob1} />
      <View style={styles.blob2} />
      <View style={styles.blob3} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoEmoji}>☕</Text>
        </View>
        <Text style={styles.title}>Chúc Chúc</Text>
        <Text style={styles.subtitle}>Chọn loại đơn để bắt đầu</Text>
      </View>

      {/* Order type cards */}
      <View style={styles.cardContainer}>
        {/* Mang về */}
        <TouchableOpacity
          id="btn-takeaway"
          style={styles.cardTakeaway}
          onPress={() => handleSelect('takeaway')}
          activeOpacity={0.85}
        >
          <View style={styles.cardInner}>
            <View style={styles.cardIconWrap}>
              <Text style={styles.cardEmoji}>🛍️</Text>
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>Mang về</Text>
              <Text style={styles.cardDesc}>Chọn món → Thanh toán ngay</Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Tại bàn */}
        <TouchableOpacity
          id="btn-dine-in"
          style={styles.cardDineIn}
          onPress={() => handleSelect('dine_in')}
          activeOpacity={0.85}
        >
          <View style={styles.cardInner}>
            <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
              <Text style={styles.cardEmoji}>🪑</Text>
            </View>
            <View style={styles.cardTextWrap}>
              <Text style={styles.cardTitle}>Tại bàn</Text>
              <Text style={styles.cardDesc}>Chọn bàn → Gọi món → Thanh toán</Text>
            </View>
            <Text style={styles.cardArrow}>›</Text>
          </View>
        </TouchableOpacity>

        {/* Management, History & Analytics buttons */}
        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity
            id="btn-manage"
            style={styles.smallBtn}
            onPress={() => router.push('/manage')}
            activeOpacity={0.85}
          >
            <Text style={styles.smallBtnEmoji}>🛠️</Text>
            <Text style={styles.smallBtnTitle}>Quản lý</Text>
          </TouchableOpacity>

          <TouchableOpacity
            id="btn-orders-history"
            style={styles.smallBtn}
            onPress={() => router.push('/orders-history' as any)}
            activeOpacity={0.85}
          >
            <Text style={styles.smallBtnEmoji}>📜</Text>
            <Text style={styles.smallBtnTitle}>Lịch sử đơn</Text>
          </TouchableOpacity>

          <TouchableOpacity
            id="btn-dashboard"
            style={styles.smallBtn}
            onPress={() => router.push('/dashboard')}
            activeOpacity={0.85}
          >
            <Text style={styles.smallBtnEmoji}>📊</Text>
            <Text style={styles.smallBtnTitle}>Báo cáo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.footer}>Chúc bạn một ngày tốt lành 🌿</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  blob1: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: COLORS.blob1,
  },
  blob2: {
    position: 'absolute',
    bottom: -50,
    left: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: COLORS.blob2,
  },
  blob3: {
    position: 'absolute',
    top: '40%',
    left: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.blob3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: COLORS.shadowDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
  },
  logoEmoji: { fontSize: 34 },
  title: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 28,
    color: COLORS.primaryDeep,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  cardContainer: {
    width: '100%',
    gap: 12,
  },
  cardTakeaway: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.shadowDeep,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 7,
  },
  cardDineIn: {
    width: '100%',
    borderRadius: 22,
    backgroundColor: COLORS.tableOccupied,
    shadowColor: 'rgba(244, 133, 90, 0.3)',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 7,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 14,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: { fontSize: 26 },
  cardTextWrap: { flex: 1 },
  cardTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: COLORS.white,
    marginBottom: 2,
  },
  cardDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.82)',
  },
  cardArrow: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 26,
    color: 'rgba(255,255,255,0.7)',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  smallBtn: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  smallBtnWide: { flex: 1.8 },
  smallBtnEmoji: { fontSize: 18 },
  smallBtnTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.primaryDeep,
  },
  footer: {
    marginTop: 36,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: COLORS.textMuted,
  },
});
