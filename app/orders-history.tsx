import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/colors';
import { Order, OrderItem, Product, Table } from '../types';
import { formatVND } from '../utils/format';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

interface ExtendedOrder extends Order {
  tables?: Table;
}

const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Bỏ qua', style: 'cancel' },
      { text: 'Xác nhận', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

export default function OrdersHistoryScreen() {
  const router = useRouter();
  const { toast, hide, success: toastSuccess, error: toastError } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [orders, setOrders] = useState<ExtendedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Date Picker Modal state
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [pickerViewDate, setPickerViewDate] = useState<Date>(new Date());

  // Selected Order Detail Modal state
  const [selectedOrder, setSelectedOrder] = useState<ExtendedOrder | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);

  const formattedDateStr = selectedDate.toISOString().split('T')[0];

  useEffect(() => {
    fetchOrdersForDate(selectedDate);
  }, [selectedDate]);

  const fetchOrdersForDate = async (date: Date) => {
    setLoading(true);
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('orders')
        .select('*, tables(*)')
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data as ExtendedOrder[]) || []);
    } catch (err: any) {
      toastError(`Lỗi tải danh sách đơn: ${err?.message || 'Thử lại'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrdersForDate(selectedDate);
  };

  const changeDateByDays = (days: number) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + days);
    setSelectedDate(nextDate);
  };

  const openCalendarPicker = () => {
    setPickerViewDate(new Date(selectedDate));
    setIsDatePickerVisible(true);
  };

  const changePickerMonth = (delta: number) => {
    const next = new Date(pickerViewDate);
    next.setMonth(next.getMonth() + delta);
    setPickerViewDate(next);
  };

  const handleSelectDay = (dayNum: number) => {
    const newDate = new Date(pickerViewDate.getFullYear(), pickerViewDate.getMonth(), dayNum);
    setSelectedDate(newDate);
    setIsDatePickerVisible(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setIsDatePickerVisible(false);
  };

  const isToday = (d: Date) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  // Calendar Helper Functions
  const year = pickerViewDate.getFullYear();
  const month = pickerViewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0: Sun, 1: Mon, ...

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blankSlots = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  // Open Order Detail Modal & Load Order Items
  const handleOpenOrderDetail = async (order: ExtendedOrder) => {
    setSelectedOrder(order);
    setLoadingDetails(true);

    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*, products(*)')
        .eq('order_id', order.id);

      if (itemsError) throw itemsError;
      setOrderItems((itemsData as OrderItem[]) || []);
    } catch (err: any) {
      toastError(`Không thể lấy chi tiết đơn: ${err?.message || 'Lỗi mạng'}`);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Soft Delete / Cancel Order Logic
  const handleCancelOrderPrompt = (order: ExtendedOrder) => {
    if (order.status === 'cancelled') {
      Alert.alert('Thông báo', 'Đơn hàng này đã bị hủy trước đó.');
      return;
    }

    if (order.status === 'paid') {
      // ⚠️ 2-Step Confirmation for Paid Order Cancellation
      showConfirmDialog(
        '⚠️ Cảnh báo hủy đơn đã thanh toán',
        `Đơn hàng #${order.id.substring(0, 6).toUpperCase()} (${formatVND(
          order.total_amount
        )}) đã thu tiền.\n\nHủy đơn sẽ làm GIẢM doanh thu của ngày này. Bạn có chắc chắn muốn hủy đơn không?`,
        () => executeCancelOrder(order)
      );
    } else {
      // Open Order Cancellation
      showConfirmDialog(
        'Xác nhận hủy đơn',
        `Bạn có chắc muốn hủy đơn #${order.id.substring(0, 6).toUpperCase()}?`,
        () => executeCancelOrder(order)
      );
    }
  };

  const executeCancelOrder = async (order: ExtendedOrder) => {
    setCancellingOrder(true);
    try {
      // 1. Update order status to 'cancelled' (Does NOT hard delete row)
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // 2. Free associated table if it was assigned to this order
      if (order.table_id) {
        await supabase
          .from('tables')
          .update({ status: 'empty' })
          .eq('id', order.table_id);
      }

      toastSuccess(`Đã hủy đơn #${order.id.substring(0, 6).toUpperCase()}`);
      setSelectedOrder(null);
      fetchOrdersForDate(selectedDate);
    } catch (err: any) {
      Alert.alert('Lỗi', `Không thể hủy đơn hàng. (${err?.message || 'Thử lại'})`);
    } finally {
      setCancellingOrder(false);
    }
  };

  // Restore Order Logic (from 'cancelled' back to 'paid' or 'open')
  const handleRestoreOrderPrompt = (order: ExtendedOrder) => {
    const targetStatusText = order.paid_at ? 'Đã thanh toán' : 'Chưa thanh toán';
    showConfirmDialog(
      '🔄 Khôi phục đơn hàng',
      `Khôi phục đơn hàng #${order.id.substring(0, 6).toUpperCase()} về trạng thái "${targetStatusText}"?\n\n(Doanh thu sẽ được cộng lại vào báo cáo)`,
      () => executeRestoreOrder(order)
    );
  };

  const executeRestoreOrder = async (order: ExtendedOrder) => {
    try {
      const restoredStatus = order.paid_at ? 'paid' : 'open';
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: restoredStatus })
        .eq('id', order.id);

      if (updateError) throw updateError;

      // If restoring an open table order, update table status to occupied
      if (restoredStatus === 'open' && order.table_id) {
        await supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', order.table_id);
      }

      toastSuccess(`Đã khôi phục đơn #${order.id.substring(0, 6).toUpperCase()}!`);
      setSelectedOrder(null);
      fetchOrdersForDate(selectedDate);
    } catch (err: any) {
      Alert.alert('Lỗi', `Không thể khôi phục đơn. (${err?.message || 'Thử lại'})`);
    }
  };

  const formatTimeStr = (isoString: string) => {
    const d = new Date(isoString);
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${mins}`;
  };

  const getPaymentMethodLabel = (method: string | null) => {
    if (method === 'cash') return 'Tiền mặt';
    if (method === 'transfer') return 'Chuyển khoản VietQR';
    if (method === 'qr') return 'Mã QR';
    return 'Chưa thanh toán';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity id="btn-back-history" onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.title}>📜 Lịch sử đơn hàng</Text>
        <Text style={styles.subtitle}>Tra cứu & Quản lý đơn hàng</Text>
      </View>

      {/* Date Picker Bar */}
      <View style={styles.dateBar}>
        <TouchableOpacity style={styles.dateNavBtn} onPress={() => changeDateByDays(-1)}>
          <Text style={styles.dateNavText}>‹ Trước</Text>
        </TouchableOpacity>

        <TouchableOpacity id="btn-open-calendar-picker" style={styles.dateCurrentBox} onPress={openCalendarPicker}>
          <Text style={styles.dateCurrentText}>
            📅 {formattedDateStr} {isToday(selectedDate) ? '(Hôm nay)' : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.dateNavBtn, isToday(selectedDate) && styles.btnDisabled]}
          onPress={() => changeDateByDays(1)}
          disabled={isToday(selectedDate)}
        >
          <Text style={styles.dateNavText}>Sau ›</Text>
        </TouchableOpacity>
      </View>

      {/* Orders List */}
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : orders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Chưa có đơn hàng nào</Text>
          <Text style={styles.emptySub}>Không tìm thấy đơn hàng trong ngày {formattedDateStr}.</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
          }
          renderItem={({ item }) => {
            const isCancelled = item.status === 'cancelled';
            const isPaid = item.status === 'paid';

            return (
              <TouchableOpacity
                id={`btn-order-${item.id}`}
                style={[styles.orderCard, isCancelled && styles.orderCardCancelled]}
                onPress={() => handleOpenOrderDetail(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.codeWrap}>
                    <Text style={styles.orderCode}>
                      #{item.id.substring(0, 6).toUpperCase()}
                    </Text>
                    <Text style={styles.orderTime}>{formatTimeStr(item.created_at)}</Text>
                  </View>

                  {/* Status Badge */}
                  <View
                    style={[
                      styles.statusBadge,
                      isPaid
                        ? styles.statusPaid
                        : isCancelled
                        ? styles.statusCancelled
                        : styles.statusOpen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        isPaid
                          ? styles.statusPaidText
                          : isCancelled
                          ? styles.statusCancelledText
                          : styles.statusOpenText,
                      ]}
                    >
                      {isPaid ? 'Đã thanh toán' : isCancelled ? 'Đã hủy' : 'Chưa thanh toán'}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.cardInfoCol}>
                    <Text style={styles.orderTypeLabel}>
                      {item.order_type === 'takeaway'
                        ? '🛍️ Mang về'
                        : `🪑 ${item.tables?.name || 'Tại bàn'}`}
                    </Text>
                    <Text style={[styles.orderAmount, isCancelled && styles.textLineThrough]}>
                      {formatVND(item.total_amount)}
                    </Text>
                  </View>

                  {isCancelled ? (
                    <TouchableOpacity
                      id={`btn-direct-restore-${item.id}`}
                      style={styles.cardDirectRestoreBtn}
                      onPress={() => handleRestoreOrderPrompt(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cardDirectRestoreText}>Khôi phục</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      id={`btn-direct-cancel-${item.id}`}
                      style={styles.cardDirectDeleteBtn}
                      onPress={() => handleCancelOrderPrompt(item)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cardDirectDeleteText}>Xóa đơn</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── MODAL: ORDER DETAILS ────────────────────────────────────────────── */}
      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedOrder && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>
                      Đơn #{selectedOrder.id.substring(0, 6).toUpperCase()}
                    </Text>
                    <Text style={styles.modalSubTitle}>
                      {selectedOrder.order_type === 'takeaway'
                        ? '🛍️ Mang về'
                        : `🪑 ${selectedOrder.tables?.name || 'Tại bàn'}`}{' '}
                      · {formatTimeStr(selectedOrder.created_at)}
                    </Text>
                  </View>

                  {/* Status Badge */}
                  <View
                    style={[
                      styles.statusBadge,
                      selectedOrder.status === 'paid'
                        ? styles.statusPaid
                        : selectedOrder.status === 'cancelled'
                        ? styles.statusCancelled
                        : styles.statusOpen,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        selectedOrder.status === 'paid'
                          ? styles.statusPaidText
                          : selectedOrder.status === 'cancelled'
                          ? styles.statusCancelledText
                          : styles.statusOpenText,
                      ]}
                    >
                      {selectedOrder.status === 'paid'
                        ? 'Đã thanh toán'
                        : selectedOrder.status === 'cancelled'
                        ? 'Đã hủy'
                        : 'Chưa thanh toán'}
                    </Text>
                  </View>
                </View>

                {/* Items List */}
                {loadingDetails ? (
                  <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 30 }} />
                ) : (
                  <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
                    {orderItems.map((item) => (
                      <View key={item.id} style={styles.detailItemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailItemName}>
                            {item.products?.name || 'Sản phẩm'} × {item.quantity}
                          </Text>
                          {item.note ? (
                            <Text style={styles.detailItemNote}>Ghi chú: {item.note}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.detailItemPrice}>
                          {formatVND(item.unit_price * item.quantity)}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}

                <View style={styles.divider} />

                {/* Payment summary details */}
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phương thức thanh toán:</Text>
                  <Text style={styles.infoValue}>
                    {getPaymentMethodLabel(selectedOrder.payment_method)}
                  </Text>
                </View>

                {selectedOrder.paid_at && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Giờ thanh toán:</Text>
                    <Text style={styles.infoValue}>{formatTimeStr(selectedOrder.paid_at)}</Text>
                  </View>
                )}

                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tổng tiền đơn hàng:</Text>
                  <Text style={styles.totalAmount}>{formatVND(selectedOrder.total_amount)}</Text>
                </View>

                {/* Modal Footer Actions */}
                <View style={styles.modalFooter}>
                  {selectedOrder.status === 'cancelled' ? (
                    <TouchableOpacity
                      id="btn-restore-order-modal"
                      style={styles.btnRestoreOrder}
                      onPress={() => handleRestoreOrderPrompt(selectedOrder)}
                    >
                      <Text style={styles.btnRestoreOrderText}>🔄 Khôi phục đơn hàng</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      id="btn-cancel-order-modal"
                      style={[styles.btnCancelOrder, cancellingOrder && styles.btnDisabled]}
                      onPress={() => handleCancelOrderPrompt(selectedOrder)}
                      disabled={cancellingOrder}
                    >
                      {cancellingOrder ? (
                        <ActivityIndicator color={COLORS.danger} />
                      ) : (
                        <Text style={styles.btnCancelOrderText}>
                          {selectedOrder.status === 'paid' ? '⚠️ Hủy đơn đã thu tiền' : 'Hủy đơn'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.btnCloseModal}
                    onPress={() => setSelectedOrder(null)}
                  >
                    <Text style={styles.btnCloseModalText}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── MODAL: CALENDAR DATE PICKER ────────────────────────────────────── */}
      <Modal
        visible={isDatePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsDatePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsDatePickerVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.calendarCard}>
            {/* Calendar Header Month Control */}
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                style={styles.calNavBtn}
                onPress={() => changePickerMonth(-1)}
              >
                <Text style={styles.calNavText}>‹</Text>
              </TouchableOpacity>

              <Text style={styles.calMonthTitle}>
                Tháng {month + 1} / {year}
              </Text>

              <TouchableOpacity
                style={styles.calNavBtn}
                onPress={() => changePickerMonth(1)}
              >
                <Text style={styles.calNavText}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Weekday Labels */}
            <View style={styles.weekRow}>
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((w, idx) => (
                <Text
                  key={w}
                  style={[styles.weekDayText, idx === 0 && { color: COLORS.danger }]}
                >
                  {w}
                </Text>
              ))}
            </View>

            {/* Days Grid */}
            <View style={styles.daysGrid}>
              {blankSlots.map((_, idx) => (
                <View key={`blank_${idx}`} style={styles.dayCell} />
              ))}
              {daysArray.map((dayNum) => {
                const isSelected =
                  selectedDate.getDate() === dayNum &&
                  selectedDate.getMonth() === month &&
                  selectedDate.getFullYear() === year;

                const isTodayCell =
                  new Date().getDate() === dayNum &&
                  new Date().getMonth() === month &&
                  new Date().getFullYear() === year;

                return (
                  <TouchableOpacity
                    key={`day_${dayNum}`}
                    style={[
                      styles.dayCell,
                      isSelected && styles.dayCellSelected,
                      !isSelected && isTodayCell && styles.dayCellToday,
                    ]}
                    onPress={() => handleSelectDay(dayNum)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.dayTextSelected,
                        !isSelected && isTodayCell && styles.dayTextToday,
                      ]}
                    >
                      {dayNum}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Calendar Footer Actions */}
            <View style={styles.calFooter}>
              <TouchableOpacity style={styles.btnTodayQuick} onPress={handleSelectToday}>
                <Text style={styles.btnTodayText}>Về Hôm nay</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnCloseCal}
                onPress={() => setIsDatePickerVisible(false)}
              >
                <Text style={styles.btnCloseCalText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Toast {...toast} onHide={hide} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  backBtn: { marginBottom: 8 },
  backText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.primary },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 22, color: COLORS.primaryDeep, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textSecondary },

  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateNavBtn: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  dateNavText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.primaryDeep },
  dateCurrentBox: {
    backgroundColor: COLORS.primaryMist,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
  },
  dateCurrentText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.primaryDeep },

  listContent: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: COLORS.textPrimary, marginBottom: 6 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  orderCardCancelled: { opacity: 0.55, backgroundColor: '#FAF5F5' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  codeWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderCode: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.textPrimary },
  orderTime: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textMuted },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusPaid: { backgroundColor: COLORS.primaryLight },
  statusPaidText: { color: COLORS.primaryDeep },
  statusOpen: { backgroundColor: 'rgba(244,133,90,0.2)' },
  statusOpenText: { color: COLORS.tableOccupied },
  statusCancelled: { backgroundColor: COLORS.dangerLight },
  statusCancelledText: { color: COLORS.danger },
  statusText: { fontFamily: 'Nunito_700Bold', fontSize: 11 },

  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  cardInfoCol: { flex: 1 },
  orderTypeLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: COLORS.textSecondary, marginBottom: 2 },
  orderAmount: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.primaryDeep },
  textLineThrough: { textDecorationLine: 'line-through', color: COLORS.textMuted },
  cardDirectDeleteBtn: {
    backgroundColor: COLORS.dangerLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardDirectDeleteText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.danger,
  },
  cardDirectRestoreBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  cardDirectRestoreText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.primaryDeep,
  },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: COLORS.textPrimary },
  modalSubTitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  detailItemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  detailItemName: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: COLORS.textPrimary },
  detailItemNote: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.primary, marginTop: 2 },
  detailItemPrice: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.textPrimary },

  divider: { height: 1, backgroundColor: COLORS.divider, marginVertical: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textSecondary },
  infoValue: { fontFamily: 'Inter_500Medium', fontSize: 13, color: COLORS.textPrimary },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.divider },
  totalLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.textPrimary },
  totalAmount: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: COLORS.primaryDeep },

  modalFooter: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btnRestoreOrder: { flex: 1, backgroundColor: COLORS.primaryLight, borderRadius: 16, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.primary },
  btnRestoreOrderText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.primaryDeep },
  btnCancelOrder: { flex: 1, backgroundColor: COLORS.dangerLight, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  btnCancelOrderText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.danger },
  btnCloseModal: { flex: 1, backgroundColor: COLORS.background, borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  btnCloseModalText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.textPrimary },
  btnDisabled: { opacity: 0.6 },

  // Calendar Modal styles
  calendarCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    marginVertical: 'auto',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calNavText: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: COLORS.primaryDeep },
  calMonthTitle: { fontFamily: 'Nunito_700Bold', fontSize: 17, color: COLORS.primaryDeep },

  weekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  weekDayText: {
    width: 36,
    textAlign: 'center',
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  daysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  dayCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
    borderRadius: 20,
  },
  dayCellSelected: { backgroundColor: COLORS.primary },
  dayCellToday: { borderWidth: 1, borderColor: COLORS.primary },
  dayText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: COLORS.textPrimary },
  dayTextSelected: { fontFamily: 'Nunito_700Bold', color: COLORS.white },
  dayTextToday: { fontFamily: 'Nunito_700Bold', color: COLORS.primaryDeep },

  calFooter: { flexDirection: 'row', gap: 10, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.divider },
  btnTodayQuick: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnTodayText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.primaryDeep },
  btnCloseCal: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnCloseCalText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.textPrimary },
});
