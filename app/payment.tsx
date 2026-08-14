import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
import { useCartStore } from '../stores/cartStore';
import { COLORS } from '../constants/colors';
import { PaymentMethod } from '../types';
import { formatVND } from '../utils/format';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

const PAYMENT_OPTIONS: { key: PaymentMethod; label: string }[] = [
  { key: 'cash', label: 'Tiền mặt' },
  { key: 'transfer', label: 'Chuyển khoản VietQR' },
  { key: 'qr', label: 'Mã QR' },
];

export default function PaymentScreen() {
  const router = useRouter();
  const { toast, hide, success: toastSuccess } = useToast();
  const { orderType, selectedTable, activeOrderId, items, totalAmount, clearCart } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer');
  const [loading, setLoading] = useState(false);

  // Bank settings state (Defaulting to MB Bank)
  const [bankCode, setBankCode] = useState('mbbank');
  const [accountNumber, setAccountNumber] = useState('0964544341');
  const [accountName, setAccountName] = useState('HUYNH THI THANH TRUC');
  const [template, setTemplate] = useState('compact2');

  useEffect(() => {
    fetchBankSettings();
  }, []);

  const fetchBankSettings = async () => {
    try {
      const { data } = await supabase.from('bank_settings').select('*').limit(1);
      if (data && data.length > 0) {
        setBankCode(data[0].bank_code || 'mbbank');
        setAccountNumber(data[0].account_number || '0964544341');
        setAccountName(data[0].account_name || 'HUYNH THI THANH TRUC');
        setTemplate(data[0].template || 'compact2');
      }
    } catch (err) {
      // Fallback stays as default state
    }
  };

  // Order reference code (e.g. DH-8A1B2C)
  const orderRefCode = activeOrderId
    ? `DH-${activeOrderId.substring(0, 6).toUpperCase()}`
    : `DH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  const transferMemo = `CHUCCHUC ${orderRefCode}`;

  // VietQR Image URL Generator
  const vietQrUrl = `https://img.vietqr.io/image/${bankCode}-${accountNumber}-${template}.png?amount=${totalAmount}&addInfo=${encodeURIComponent(
    transferMemo
  )}&accountName=${encodeURIComponent(accountName)}`;

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    toastSuccess(`Đã sao chép ${label}!`);
  };

  const handleConfirm = async () => {
    if (!orderType) return;

    // Constraint 5: Must select a payment method
    if (!paymentMethod) {
      Alert.alert('Chưa chọn phương thức thanh toán', 'Vui lòng chọn 1 trong 3 phương thức: Tiền mặt, Chuyển khoản hoặc Mã QR.');
      return;
    }

    // Constraint 2: Order must not be empty
    if (items.length === 0) {
      Alert.alert('Đơn hàng rỗng', 'Vui lòng chọn ít nhất 1 món trước khi thanh toán.');
      return;
    }

    setLoading(true);

    try {
      if (orderType === 'takeaway') {
        // ── 1. MANG VỀ (Takeaway): Tạo đơn mới và chốt paid ngay ─────────────────
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_type: 'takeaway',
            status: 'paid',
            payment_method: paymentMethod,
            total_amount: totalAmount,
            paid_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (orderError || !order) throw orderError;

        const orderItems = items.map((item) => ({
          order_id: order.id,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
          note: item.note || null,
        }));

        if (orderItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);
          if (itemsError) throw itemsError;
        }
      } else {
        // ── 2. TẠI BÀN (Dine-in): Hoàn tất thanh toán cho đơn đang mở ────────────
        let orderId = activeOrderId;

        if (orderId) {
          // Constraint 2: Guard against paying an already paid or cancelled order
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('status')
            .eq('id', orderId)
            .single();

          if (existingOrder && existingOrder.status !== 'open') {
            throw new Error(`Đơn hàng đã ở trạng thái '${existingOrder.status}', không thể thanh toán lại.`);
          }
        }

        if (!orderId) {
          const { data: newOrder, error: createError } = await supabase
            .from('orders')
            .insert({
              order_type: 'dine_in',
              table_id: selectedTable?.id || null,
              status: 'paid',
              payment_method: paymentMethod,
              total_amount: totalAmount,
              paid_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (createError || !newOrder) throw createError;
          orderId = newOrder.id;
        } else {
          const { error: updateOrderError } = await supabase
            .from('orders')
            .update({
              status: 'paid',
              payment_method: paymentMethod,
              total_amount: totalAmount,
              paid_at: new Date().toISOString(),
            })
            .eq('id', orderId);

          if (updateOrderError) throw updateOrderError;
        }

        await supabase.from('order_items').delete().eq('order_id', orderId);
        const orderItems = items.map((item) => ({
          order_id: orderId,
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.product.price,
          note: item.note || null,
        }));

        if (orderItems.length > 0) {
          const { error: itemsError } = await supabase
            .from('order_items')
            .insert(orderItems);
          if (itemsError) throw itemsError;
        }

        if (selectedTable) {
          await supabase
            .from('tables')
            .update({ status: 'empty' })
            .eq('id', selectedTable.id);
        }
      }

      setLoading(false);
      clearCart();
      router.replace('/');
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Lỗi thanh toán', err?.message || 'Không thể xử lý thanh toán.');
    }
  };

  const orderLabel =
    orderType === 'takeaway'
      ? '🛍️ Mang về'
      : `🪑 ${selectedTable?.name ?? 'Tại bàn'}`;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity id="btn-back-payment" onPress={() => router.back()} style={styles.backTouch}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Thanh toán</Text>
          <Text style={styles.headerSub}>{orderLabel}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Payment Method Selector */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phương thức thanh toán</Text>
          <View style={styles.paymentOptions}>
            {PAYMENT_OPTIONS.map((opt) => {
              const isSelected = paymentMethod === opt.key;
              return (
                <TouchableOpacity
                  id={`btn-payment-${opt.key}`}
                  key={opt.key}
                  style={[styles.payChip, isSelected && styles.payChipSelected]}
                  onPress={() => setPaymentMethod(opt.key)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.payLabel, isSelected && styles.payLabelSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Dynamic VietQR Card (for Transfer or QR) */}
        {(paymentMethod === 'transfer' || paymentMethod === 'qr') && (
          <View style={styles.qrCard}>
            <View style={styles.qrHeader}>
              <Text style={styles.qrHeaderTitle}>Mã VietQR Thanh Toán Chuyển Khoản</Text>
              <Text style={styles.qrHeaderSub}>Quét mã bằng app Ngân hàng / Momo / VNPay</Text>
            </View>

            {/* Dynamic VietQR Image */}
            <View style={styles.qrImageContainer}>
              <Image source={{ uri: vietQrUrl }} style={styles.qrImage} resizeMode="contain" />
            </View>

            {/* Account Info Details */}
            <View style={styles.bankDetailBox}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Ngân hàng:</Text>
                <Text style={styles.detailValueBold}>
                  {bankCode.toLowerCase().includes('mb')
                    ? 'MB Bank (MB)'
                    : bankCode.toLowerCase().includes('vcb') || bankCode.toLowerCase().includes('vietcombank')
                    ? 'Vietcombank (VCB)'
                    : bankCode.toUpperCase()}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Số tài khoản:</Text>
                <View style={styles.valueCopyRow}>
                  <Text style={styles.detailValueHighlight}>{accountNumber}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyToClipboard(accountNumber, 'Số tài khoản')}
                  >
                    <Text style={styles.copyBtnText}>Sao chép STK</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Chủ tài khoản:</Text>
                <Text style={styles.detailValueBold}>{accountName}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Số tiền:</Text>
                <Text style={styles.detailPriceHighlight}>{formatVND(totalAmount)}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Nội dung chuyển khoản:</Text>
                <View style={styles.valueCopyRow}>
                  <Text style={styles.detailMemoHighlight}>{transferMemo}</Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => copyToClipboard(transferMemo, 'Nội dung chuyển khoản')}
                  >
                    <Text style={styles.copyBtnText}>Sao chép</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Text style={styles.noticeText}>
              Nhân viên kiểm tra tiền về tài khoản ngân hàng, sau đó bấm nút xác nhận bên dưới.
            </Text>
          </View>
        )}

        {/* Order Summary Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tóm tắt đơn hàng</Text>
          {items.map((item) => (
            <View key={item.product.id} style={styles.itemRow}>
              <View style={styles.itemMainInfo}>
                <Text style={styles.itemName}>
                  {item.product.name} × {item.quantity}
                </Text>
                {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
              </View>
              <Text style={styles.itemSubtotal}>
                {formatVND(item.product.price * item.quantity)}
              </Text>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng thanh toán</Text>
            <Text style={styles.totalAmount}>{formatVND(totalAmount)}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer Confirm */}
      <View style={styles.footer}>
        <TouchableOpacity
          id="btn-confirm-payment"
          style={[styles.confirmBtn, loading && styles.btnDisabled]}
          onPress={handleConfirm}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.confirmBtnText}>
              {paymentMethod === 'cash'
                ? `Xác nhận đã nhận ${formatVND(totalAmount)} (Tiền mặt)`
                : `Xác nhận đã nhận tiền (${formatVND(totalAmount)})`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
      <Toast {...toast} onHide={hide} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  backTouch: { paddingRight: 8 },
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 24,
    color: COLORS.primary,
  },
  headerInfo: { flex: 1 },
  headerTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  content: { padding: 16, gap: 14 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },

  paymentOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  payChip: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  payChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  payEmoji: { fontSize: 22, marginBottom: 2 },
  payLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  payLabelSelected: {
    fontFamily: 'Nunito_700Bold',
    color: COLORS.primary,
  },

  // QR Card styles
  qrCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
    gap: 12,
  },
  qrHeader: { alignItems: 'center' },
  qrHeaderTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.textPrimary },
  qrHeaderSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  qrImageContainer: {
    width: 260,
    height: 320,
    backgroundColor: '#FAF9F6',
    borderRadius: 20,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  qrImage: { width: '100%', height: '100%' },

  bankDetailBox: {
    width: '100%',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textSecondary },
  detailValueBold: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.textPrimary },
  detailValueHighlight: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.primary },
  detailPriceHighlight: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.primary },
  detailMemoHighlight: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.tableOccupied },

  valueCopyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  copyBtn: { backgroundColor: COLORS.white, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primaryLight },
  copyBtnText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: COLORS.primary },

  noticeText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  itemMainInfo: { flex: 1, paddingRight: 8 },
  itemName: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  itemNote: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  itemSubtotal: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  totalAmount: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 22,
    color: COLORS.primary,
  },

  footer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: COLORS.white,
  },
  btnDisabled: { opacity: 0.7 },
});
