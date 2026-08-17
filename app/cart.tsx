import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCartStore } from '../stores/cartStore';
import { COLORS } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { formatVND } from '../utils/format';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function CartScreen() {
  const router = useRouter();
  const {
    orderType,
    selectedTable,
    activeOrderId,
    items,
    totalAmount,
    updateQuantityByIndex,
    updateNoteByIndex,
    clearCart,
    setActiveOrder,
  } = useCartStore();

  const { toast, hide, success, error: toastError } = useToast();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const handleConfirmDineInOrder = async () => {
    // Constraint 2: Đơn không được rỗng
    if (items.length === 0) {
      Alert.alert('Đơn hàng rỗng', 'Vui lòng chọn ít nhất 1 món trước khi xác nhận gọi món.');
      return;
    }
    if (!selectedTable) return;
    setSavingOrder(true);

    try {
      let orderId = activeOrderId;

      if (!orderId) {
        const { data: newOrder, error: createError } = await supabase
          .from('orders')
          .insert({
            order_type: 'dine_in',
            table_id: selectedTable.id,
            status: 'open',
            total_amount: totalAmount,
          })
          .select()
          .single();

        if (createError || !newOrder) throw createError;
        orderId = newOrder.id;
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
        const { error: insertError } = await supabase
          .from('order_items')
          .insert(orderItems);
        if (insertError) throw insertError;
      }

      await supabase
        .from('orders')
        .update({ total_amount: totalAmount })
        .eq('id', orderId);

      await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', selectedTable.id);

      setSavingOrder(false);
      clearCart();
      router.replace('/table-select');
    } catch (err: any) {
      setSavingOrder(false);
      Alert.alert('Lỗi', `Không thể lưu đơn hàng. (${err?.message || 'Thử lại'})`);
    }
  };

  const handleGoToPayment = () => {
    // Constraint 2: Chặn thanh toán đơn rỗng
    if (items.length === 0) {
      Alert.alert('Đơn hàng rỗng', 'Vui lòng chọn ít nhất 1 món trước khi chuyển sang thanh toán.');
      return;
    }
    router.push('/payment');
  };

  const orderLabel =
    orderType === 'takeaway'
      ? '🛍️ Mang về'
      : `🪑 ${selectedTable?.name ?? 'Tại bàn'}`;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity id="btn-back-cart" onPress={handleBack} style={styles.backTouch}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Giỏ hàng</Text>
          <Text style={styles.headerSub}>{orderLabel}</Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity onPress={clearCart} style={styles.clearBtn}>
            <Text style={styles.clearCartText}>Xóa tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cart Items */}
      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Giỏ hàng trống</Text>
          <Text style={styles.emptySub}>
            Chưa có món nào được chọn. Hãy quay lại menu để thêm món nhé!
          </Text>
          <TouchableOpacity
            id="btn-return-menu"
            style={styles.menuBtn}
            onPress={() => router.replace('/menu')}
          >
            <Text style={styles.menuBtnText}>Xem thực đơn →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item, index) => `${item.product.id}_${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <View style={styles.itemCard}>
              <View style={styles.itemTopRow}>
                {/* Leaf Badge */}
                <View style={styles.itemImageBox}>
                  <Text style={styles.itemEmoji}>🍃</Text>
                </View>

                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product.name}</Text>
                  <Text style={styles.itemPrice}>
                    {formatVND(item.product.price)} / ly
                  </Text>
                </View>

                {/* Quantity stepper (Constraint 1: Minimum quantity = 1, <=0 removes item) */}
                <View style={styles.qtyControl}>
                  <TouchableOpacity
                    id={`btn-minus-${item.product.id}-${index}`}
                    style={styles.qtyBtn}
                    onPress={() => updateQuantityByIndex(index, item.quantity - 1)}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <TouchableOpacity
                    id={`btn-plus-${item.product.id}-${index}`}
                    style={[styles.qtyBtn, styles.qtyBtnPlus]}
                    onPress={() => updateQuantityByIndex(index, item.quantity + 1)}
                  >
                    <Text style={[styles.qtyBtnText, styles.qtyBtnPlusText]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Note section */}
              <TouchableOpacity
                onPress={() =>
                  setEditingIndex(editingIndex === index ? null : index)
                }
                style={styles.noteTouchable}
              >
                <Text style={styles.noteToggle}>
                  {item.note ? `Ghi chú: ${item.note}` : '+ Thêm ghi chú (ít đường, ít đá...)'}
                </Text>
              </TouchableOpacity>
              {editingIndex === index && (
                <TextInput
                  id={`input-note-${item.product.id}-${index}`}
                  style={styles.noteInput}
                  placeholder="Ví dụ: ít đường, ít đá, thêm topping..."
                  placeholderTextColor={COLORS.textMuted}
                  value={item.note}
                  onChangeText={(text) => updateNoteByIndex(index, text)}
                  onBlur={() => setEditingIndex(null)}
                  autoFocus
                />
              )}

              {/* Subtotal chip */}
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Thành tiền:</Text>
                <Text style={styles.subtotal}>
                  {formatVND(item.product.price * item.quantity)}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Footer */}
      {items.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalAmount}>{formatVND(totalAmount)}</Text>
          </View>

          {orderType === 'dine_in' ? (
            <View style={styles.actionButtonsCol}>
              <TouchableOpacity
                id="btn-confirm-dinein"
                style={[
                  styles.confirmOrderBtn,
                  (savingOrder || items.length === 0) && styles.btnDisabled,
                ]}
                onPress={handleConfirmDineInOrder}
                disabled={savingOrder || items.length === 0}
                activeOpacity={0.85}
              >
                {savingOrder ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.confirmOrderText}>
                    Xác nhận gọi món — {selectedTable?.name}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                id="btn-goto-payment"
                style={[styles.payNowBtn, items.length === 0 && styles.btnDisabled]}
                onPress={handleGoToPayment}
                disabled={items.length === 0}
                activeOpacity={0.85}
              >
                <Text style={styles.payNowText}>Thanh toán ngay</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              id="btn-checkout-takeaway"
              style={[styles.checkoutBtn, items.length === 0 && styles.btnDisabled]}
              onPress={handleGoToPayment}
              disabled={items.length === 0}
              activeOpacity={0.85}
            >
              <Text style={styles.checkoutBtnText}>Thanh toán →</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Toast {...toast} onHide={hide} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
    gap: 8,
  },
  backTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(197, 160, 89, 0.4)',
    marginRight: 8,
  },
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#234635',
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
  clearBtn: {
    backgroundColor: COLORS.dangerLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  clearCartText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: COLORS.danger,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 20,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  emptySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
  },
  menuBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 18,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.white,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
    gap: 12,
  },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 14,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  itemImageBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primaryMist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemEmoji: { fontSize: 22 },
  itemInfo: { flex: 1 },
  itemName: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  itemPrice: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 4,
  },
  qtyBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  qtyBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: COLORS.textPrimary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  qtyBtnPlus: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  qtyBtnPlusText: { color: COLORS.white },
  qtyValue: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.textPrimary,
    minWidth: 20,
    textAlign: 'center',
  },
  noteTouchable: { marginBottom: 4 },
  noteToggle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  noteInput: {
    backgroundColor: COLORS.primaryMist,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  subtotalLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
  },
  subtotal: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.primaryDeep,
  },
  footer: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    shadowColor: COLORS.shadowDeep,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  totalAmount: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 24,
    color: COLORS.primaryDeep,
  },
  actionButtonsCol: { gap: 10 },
  confirmOrderBtn: {
    backgroundColor: COLORS.tableOccupied,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: 'rgba(244,133,90,0.35)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmOrderText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: COLORS.white,
  },
  payNowBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  payNowText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.white,
  },
  checkoutBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
  },
  checkoutBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: COLORS.white,
  },
  btnDisabled: { opacity: 0.5 },
});
