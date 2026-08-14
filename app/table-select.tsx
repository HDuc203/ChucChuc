import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useCartStore } from '../stores/cartStore';
import { COLORS } from '../constants/colors';
import { CartItem, Order, Product, Table } from '../types';
import { formatVND } from '../utils/format';

export default function TableSelectScreen() {
  const router = useRouter();
  const { setTable, setActiveOrder, setOrderType, clearCart } = useCartStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal for occupied table options
  const [selectedOccupiedTable, setSelectedOccupiedTable] = useState<Table | null>(null);
  const [occupiedOrder, setOccupiedOrder] = useState<Order | null>(null);
  const [occupiedItems, setOccupiedItems] = useState<CartItem[]>([]);
  const [fetchingOccupied, setFetchingOccupied] = useState(false);

  // Modal for transfer table
  const [isTransferModalVisible, setIsTransferModalVisible] = useState(false);

  useEffect(() => {
    fetchTables();

    // Realtime subscription with unique channel name to prevent duplicate subscribe error
    const channelName = `tables-realtime-${Math.random()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tables' },
        () => fetchTables()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTables = async () => {
    const { data, error } = await supabase
      .from('tables')
      .select('*');
    if (!error && data) {
      // Natural numeric sort: Bàn 1, Bàn 2, ..., Bàn 10
      const sorted = (data as Table[]).sort((a, b) => {
        const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });
      setTables(sorted);
    }
    setLoading(false);
  };

  // Helper to load order items for an occupied table
  const loadOccupiedOrderDetails = async (table: Table) => {
    setFetchingOccupied(true);
    try {
      // Find latest open order for this table (use limit(1) instead of maybeSingle to avoid crash if multiple test orders exist)
      const { data: ordersList, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('table_id', table.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1);

      if (orderError) throw orderError;

      const orderData = ordersList?.[0];

      if (!orderData) {
        // Fallback: If table says occupied but no open order found, reset to empty
        await supabase.from('tables').update({ status: 'empty' }).eq('id', table.id);
        fetchTables();
        Alert.alert('Thông báo', `Không tìm thấy đơn mở cho ${table.name}. Đã chuyển về bàn trống.`);
        setFetchingOccupied(false);
        return null;
      }

      // Fetch order items for this order
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderData.id);

      if (itemsError) throw itemsError;

      // Fetch corresponding products
      let loadedCartItems: CartItem[] = [];
      if (itemsData && itemsData.length > 0) {
        const productIds = itemsData.map((item) => item.product_id);
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds);

        if (productsError) throw productsError;

        const productMap = new Map((productsData || []).map((p) => [p.id, p]));

        loadedCartItems = itemsData
          .map((item) => {
            const prod = productMap.get(item.product_id);
            if (!prod) return null;
            return {
              product: prod as Product,
              quantity: item.quantity,
              note: item.note || '',
              orderItemId: item.id,
            };
          })
          .filter(Boolean) as CartItem[];
      }

      setOccupiedOrder(orderData as Order);
      setOccupiedItems(loadedCartItems);
      setFetchingOccupied(false);
      return { order: orderData as Order, items: loadedCartItems };
    } catch (err: any) {
      setFetchingOccupied(false);
      Alert.alert('Lỗi', `Không thể lấy thông tin đơn hàng: ${err?.message || 'Lỗi không xác định'}`);
      console.error('loadOccupiedOrderDetails Error:', err);
      return null;
    }
  };

  // Handler when staff taps a table
  const handleSelectTable = async (table: Table) => {
    if (table.status === 'empty') {
      // 🟢 1. EMPTY TABLE: Select table, clear cart, go to Menu to pick items
      clearCart();
      setOrderType('dine_in');
      setTable(table);
      router.push('/menu');
    } else if (table.status === 'occupied') {
      // 🟠 2. OCCUPIED TABLE: Show action modal (Add items / Pay / Transfer / Cancel)
      setSelectedOccupiedTable(table);
      await loadOccupiedOrderDetails(table);
    } else if (table.status === 'needs_cleaning') {
      // 🟡 3. NEEDS CLEANING: Prompt to clear table
      Alert.alert(
        'Bàn cần dọn dẹp',
        `${table.name} đang chờ dọn bàn trước khi đón khách mới.`,
        [
          { text: 'Bỏ qua', style: 'cancel' },
          {
            text: 'Xác nhận đã dọn xong',
            onPress: async () => {
              // Constraint 3: Check if there are still open orders for this table
              const { data: openOrders } = await supabase
                .from('orders')
                .select('id')
                .eq('table_id', table.id)
                .eq('status', 'open');

              if (openOrders && openOrders.length > 0) {
                Alert.alert(
                  'Không thể giải phóng bàn',
                  `${table.name} vẫn còn đơn hàng chưa thanh toán. Vui lòng thanh toán hoặc hủy đơn trước khi giải phóng bàn.`
                );
                return;
              }

              await supabase
                .from('tables')
                .update({ status: 'empty' })
                .eq('id', table.id);
              fetchTables();
            },
          },
        ]
      );
    }
  };

  // Actions for Occupied Table Modal:

  // Action 1: Add more items -> Open Menu
  const handleGoToMenu = () => {
    if (!selectedOccupiedTable || !occupiedOrder) return;
    setActiveOrder(occupiedOrder.id, selectedOccupiedTable, occupiedItems);
    setSelectedOccupiedTable(null);
    router.push('/menu');
  };

  // Action 2: Go to Payment directly
  const handleGoToPayment = () => {
    if (!selectedOccupiedTable || !occupiedOrder) return;
    if (occupiedItems.length === 0) {
      Alert.alert('Chưa gọi món', 'Bàn này chưa có món nào trong đơn hàng.');
      return;
    }
    setActiveOrder(occupiedOrder.id, selectedOccupiedTable, occupiedItems);
    setSelectedOccupiedTable(null);
    router.push('/payment');
  };

  // Action 3: Transfer table to a new empty table
  const handleTransferTable = async (targetTable: Table) => {
    if (!selectedOccupiedTable || !occupiedOrder) return;
    try {
      setLoading(true);
      // 1. Move order to new table_id
      await supabase
        .from('orders')
        .update({ table_id: targetTable.id })
        .eq('id', occupiedOrder.id);

      // 2. Set old table to empty
      await supabase
        .from('tables')
        .update({ status: 'empty' })
        .eq('id', selectedOccupiedTable.id);

      // 3. Set new table to occupied
      await supabase
        .from('tables')
        .update({ status: 'occupied' })
        .eq('id', targetTable.id);

      setLoading(false);
      setIsTransferModalVisible(false);
      setSelectedOccupiedTable(null);
      Alert.alert('Thành công', `Đã chuyển đơn từ ${selectedOccupiedTable.name} sang ${targetTable.name}.`);
      fetchTables();
    } catch (err) {
      setLoading(false);
      Alert.alert('Lỗi', 'Không thể chuyển bàn.');
    }
  };

  // Action 4: Cancel order at table
  const handleCancelOrder = () => {
    if (!selectedOccupiedTable || !occupiedOrder) return;
    Alert.alert(
      'Xác nhận hủy đơn',
      `Bạn có chắc chắn muốn hủy toàn bộ đơn hàng tại ${selectedOccupiedTable.name}?`,
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy đơn & Giải phóng bàn',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              // Update order status to cancelled
              await supabase
                .from('orders')
                .update({ status: 'cancelled' })
                .eq('id', occupiedOrder.id);

              // Reset table to empty
              await supabase
                .from('tables')
                .update({ status: 'empty' })
                .eq('id', selectedOccupiedTable.id);

              setLoading(false);
              setSelectedOccupiedTable(null);
              Alert.alert('Thành công', `Đã hủy đơn và giải phóng ${selectedOccupiedTable.name}.`);
              fetchTables();
            } catch (err) {
              setLoading(false);
              Alert.alert('Lỗi', 'Không thể hủy đơn.');
            }
          },
        },
      ]
    );
  };

  const getStatusLabel = (status: Table['status']) => {
    switch (status) {
      case 'empty': return '🌱 Trống';
      case 'occupied': return '🪑 Có khách';
      case 'needs_cleaning': return '🧹 Cần dọn';
    }
  };

  const emptyTables = tables.filter((t) => t.status === 'empty');
  const occupiedTables = tables.filter((t) => t.status === 'occupied');
  const cleaningTables = tables.filter((t) => t.status === 'needs_cleaning');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.blob1} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity id="btn-back-table" onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Quản lý bàn ({tables.length} bàn)</Text>
        <Text style={styles.subtitle}>Chạm vào bàn để mở đơn, gọi thêm món hoặc thanh toán</Text>
      </View>

      {/* Legend / Status Stats Pills */}
      <View style={styles.legend}>
        <View style={[styles.legendPill, { backgroundColor: '#EAF5EC' }]}>
          <Text style={[styles.legendPillText, { color: COLORS.primaryDeep }]}>🌱 Trống ({emptyTables.length})</Text>
        </View>
        <View style={[styles.legendPill, { backgroundColor: '#FFF3E0' }]}>
          <Text style={[styles.legendPillText, { color: '#E65100' }]}>🪑 Có khách ({occupiedTables.length})</Text>
        </View>
        {cleaningTables.length > 0 && (
          <View style={[styles.legendPill, { backgroundColor: '#FFFDE7' }]}>
            <Text style={[styles.legendPillText, { color: '#F57F17' }]}>🧹 Cần dọn ({cleaningTables.length})</Text>
          </View>
        )}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tables}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => {
            const isOccupied = item.status === 'occupied';
            const isNeedsCleaning = item.status === 'needs_cleaning';

            return (
              <TouchableOpacity
                id={`btn-table-${item.name.replace(' ', '-')}`}
                style={[
                  styles.tableCard,
                  isOccupied
                    ? styles.tableCardOccupied
                    : isNeedsCleaning
                    ? styles.tableCardCleaning
                    : styles.tableCardEmpty,
                ]}
                onPress={() => handleSelectTable(item)}
                activeOpacity={0.85}
              >
                <View style={styles.tableCardHeader}>
                  <Text style={styles.tableNumberText}>
                    {item.name}
                  </Text>
                </View>

                {/* Status Badge */}
                <View
                  style={[
                    styles.statusPill,
                    isOccupied
                      ? styles.statusPillOccupied
                      : isNeedsCleaning
                      ? styles.statusPillCleaning
                      : styles.statusPillEmpty,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      isOccupied
                        ? styles.statusTextOccupied
                        : isNeedsCleaning
                        ? styles.statusTextCleaning
                        : styles.statusTextEmpty,
                    ]}
                  >
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ── MODAL: Action options for Occupied Table ─────────────────────── */}
      <Modal
        visible={!!selectedOccupiedTable && !isTransferModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedOccupiedTable(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedOccupiedTable(null)}
        >
          <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedOccupiedTable?.name}</Text>
              <Text style={styles.modalSubTitle}>Bàn đang dùng</Text>
            </View>

            {fetchingOccupied ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 20 }} />
            ) : (
              <>
                {/* Summary of items in table order */}
                <View style={styles.occupiedItemsBox}>
                  <Text style={styles.occupiedItemsHeader}>
                    Món đã gọi ({occupiedItems.reduce((s, i) => s + i.quantity, 0)} món):
                  </Text>
                  {occupiedItems.length === 0 ? (
                    <Text style={styles.emptyItemsText}>Chưa chọn món nào</Text>
                  ) : (
                    occupiedItems.map((item) => (
                      <View key={item.product.id} style={styles.occupiedItemRow}>
                        <Text style={styles.occupiedItemName}>
                          {item.quantity}× {item.product.name}
                        </Text>
                        <Text style={styles.occupiedItemPrice}>
                          {formatVND(item.product.price * item.quantity)}
                        </Text>
                      </View>
                    ))
                  )}
                  <View style={styles.occupiedTotalRow}>
                    <Text style={styles.occupiedTotalLabel}>Tổng tạm tính:</Text>
                    <Text style={styles.occupiedTotalValue}>
                      {formatVND(occupiedItems.reduce((s, i) => s + i.product.price * i.quantity, 0))}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    id="btn-add-items"
                    style={[styles.actionBtn, styles.actionAddBtn]}
                    onPress={handleGoToMenu}
                  >
                    <Text style={styles.actionAddText}>+ Gọi thêm món</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    id="btn-pay-table"
                    style={[styles.actionBtn, styles.actionPayBtn]}
                    onPress={handleGoToPayment}
                  >
                    <Text style={styles.actionPayText}>Thanh toán đơn này</Text>
                  </TouchableOpacity>

                  <View style={styles.actionRowHalf}>
                    <TouchableOpacity
                      id="btn-transfer-table"
                      style={[styles.actionBtn, styles.actionTransferBtn]}
                      onPress={() => setIsTransferModalVisible(true)}
                    >
                      <Text style={styles.actionTransferText}>Chuyển bàn</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      id="btn-cancel-table"
                      style={[styles.actionBtn, styles.actionCancelBtn]}
                      onPress={handleCancelOrder}
                    >
                      <Text style={styles.actionCancelText}>Hủy đơn</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL: Transfer Table ───────────────────────────────────────── */}
      <Modal
        visible={isTransferModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTransferModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔄 Chuyển bàn</Text>
            <Text style={styles.modalSubTitle}>
              Chuyển đơn từ {selectedOccupiedTable?.name} sang bàn trống:
            </Text>

            {emptyTables.length === 0 ? (
              <Text style={styles.emptyItemsText}>Hiện không có bàn nào trống để chuyển.</Text>
            ) : (
              <FlatList
                data={emptyTables}
                keyExtractor={(t) => t.id}
                style={{ maxHeight: 200, marginVertical: 12 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    id={`btn-transfer-to-${item.name.replace(' ', '-')}`}
                    style={styles.transferItemCard}
                    onPress={() => handleTransferTable(item)}
                  >
                    <Text style={styles.transferItemText}>{item.name}</Text>
                    <Text style={styles.transferItemBadge}>Trống → Chọn</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setIsTransferModalVisible(false)}
            >
              <Text style={styles.closeBtnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  blob1: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: COLORS.blob1,
  },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  backBtn: { marginBottom: 12 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: COLORS.primary },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 26, color: COLORS.textPrimary, marginBottom: 4 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textSecondary },
  legend: { flexDirection: 'row', gap: 10, paddingHorizontal: 24, marginBottom: 16 },
  legendPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  legendPillText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },

  grid: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  row: { gap: 14 },

  tableCard: {
    flex: 1,
    borderRadius: 22,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1.5,
  },
  tableCardEmpty: {
    backgroundColor: '#FFFFFF',
    borderColor: COLORS.primaryLight,
  },
  tableCardOccupied: {
    backgroundColor: '#FFF8F5',
    borderColor: 'rgba(244,133,90,0.4)',
  },
  tableCardCleaning: {
    backgroundColor: '#FFFDE7',
    borderColor: 'rgba(255,214,0,0.4)',
  },

  tableCardHeader: { alignItems: 'center', marginBottom: 8 },
  tableNumberText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 20,
    color: COLORS.textPrimary,
  },

  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillEmpty: { backgroundColor: COLORS.primaryLight },
  statusPillOccupied: { backgroundColor: 'rgba(244,133,90,0.2)' },
  statusPillCleaning: { backgroundColor: 'rgba(255,214,0,0.3)' },

  statusPillText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  statusTextEmpty: { color: COLORS.primaryDeep },
  statusTextOccupied: { color: '#D84315' },
  statusTextCleaning: { color: '#F57F17' },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: { alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontFamily: 'Nunito_700Bold', fontSize: 22, color: COLORS.textPrimary },
  modalSubTitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textSecondary },
  occupiedItemsBox: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  occupiedItemsHeader: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.textSecondary },
  emptyItemsText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' },
  occupiedItemRow: { flexDirection: 'row', justifyContent: 'space-between' },
  occupiedItemName: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textPrimary },
  occupiedItemPrice: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.textSecondary },
  occupiedTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: COLORS.divider,
    paddingTop: 6,
    marginTop: 4,
  },
  occupiedTotalLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.textPrimary },
  occupiedTotalValue: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.primary },
  actionButtons: { gap: 10 },
  actionBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionAddBtn: { backgroundColor: COLORS.primary },
  actionAddText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.white },
  actionPayBtn: { backgroundColor: COLORS.tableOccupied },
  actionPayText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.white },
  actionRowHalf: { flexDirection: 'row', gap: 10 },
  actionTransferBtn: { flex: 1, backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.primary },
  actionTransferText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.primary },
  actionCancelBtn: { flex: 1, backgroundColor: '#FFEBEE', borderWidth: 1, borderColor: COLORS.danger },
  actionCancelText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.danger },
  transferItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    marginBottom: 8,
  },
  transferItemText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.textPrimary },
  transferItemBadge: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.primary },
  closeBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  closeBtnText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: COLORS.textMuted },
});
