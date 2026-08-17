import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/colors';
import { Expense, ExpenseCategory } from '../types';
import { formatVND, formatNumberDot, formatNumberInput, parseNumberInput } from '../utils/format';
import Toast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';
import { useToast } from '../hooks/useToast';

const CATEGORIES: { key: ExpenseCategory; label: string; icon: string; color: string; bg: string }[] = [
  { key: 'nguyen_lieu', label: 'Nguyên liệu', icon: '🍃', color: '#16A34A', bg: '#DCFCE7' },
  { key: 'dien_nuoc', label: 'Điện nước', icon: '⚡', color: '#D97706', bg: '#FEF3C7' },
  { key: 'mat_bang', label: 'Mặt bằng', icon: '🏠', color: '#2563EB', bg: '#DBEAFE' },
  { key: 'luong', label: 'Lương NV', icon: '👨‍🍳', color: '#9333EA', bg: '#F3E8FF' },
  { key: 'khac', label: 'Chi phí khác', icon: '📦', color: '#4B5563', bg: '#F3F4F6' },
];

export default function ExpensesScreen() {
  const router = useRouter();
  const { toast, hide, success: toastSuccess, error: toastError } = useToast();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Category filter state ('all' or specific ExpenseCategory)
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');

  // Add / Edit Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('nguyen_lieu');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  // Confirm Modal state
  const [confirmConfig, setConfirmConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  useEffect(() => {
    fetchExpenses();
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExpenses((data as Expense[]) || []);
    } catch (err: any) {
      toastError(`Lỗi tải danh sách chi phí: ${err?.message || 'Thử lại'}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchExpenses();
  };

  const openAddModal = () => {
    setEditingExpense(null);
    setDescription('');
    setAmountStr('');
    setCategory('nguyen_lieu');
    setExpenseDate(new Date().toISOString().split('T')[0]);
    setIsModalVisible(true);
  };

  const openEditModal = (item: Expense) => {
    setEditingExpense(item);
    setDescription(item.description);
    setAmountStr(formatNumberDot(item.amount));
    setCategory(item.category);
    setExpenseDate(item.expense_date);
    setIsModalVisible(true);
  };

  const handleAmountChange = (text: string) => {
    setAmountStr(formatNumberInput(text));
  };

  const handleSaveExpense = async () => {
    if (!description.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mô tả khoản chi.');
      return;
    }

    const amountNum = parseNumberInput(amountStr);
    if (amountNum <= 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số tiền hợp lệ.');
      return;
    }

    setSaving(true);
    try {
      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update({
            description: description.trim(),
            amount: amountNum,
            category,
            expense_date: expenseDate,
          })
          .eq('id', editingExpense.id);

        if (error) throw error;
        toastSuccess(`Đã cập nhật khoản chi "${description.trim()}"`);
      } else {
        const { error } = await supabase.from('expenses').insert({
          description: description.trim(),
          amount: amountNum,
          category,
          expense_date: expenseDate,
        });

        if (error) throw error;
        toastSuccess(`Đã thêm khoản chi "${description.trim()}" (${formatVND(amountNum)})`);
      }

      setIsModalVisible(false);
      fetchExpenses();
    } catch (err: any) {
      Alert.alert('Lỗi', `Không thể lưu khoản chi. (${err?.message || 'Thử lại'})`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpensePrompt = (item: Expense) => {
    setConfirmConfig({
      visible: true,
      title: 'Xóa khoản chi phí',
      message: `Bạn có chắc muốn xóa khoản chi "${item.description}" (${formatVND(item.amount)})?`,
      onConfirm: async () => {
        setConfirmConfig((prev) => ({ ...prev, visible: false }));
        try {
          const { error } = await supabase.from('expenses').delete().eq('id', item.id);
          if (error) throw error;
          toastSuccess(`Đã xóa khoản chi "${item.description}"`);
          fetchExpenses();
        } catch (err: any) {
          Alert.alert('Lỗi', `Không thể xóa khoản chi: ${err?.message}`);
        }
      },
    });
  };

  // Filtering
  const filteredExpenses = selectedCatFilter === 'all'
    ? expenses
    : expenses.filter((e) => e.category === selectedCatFilter);

  const totalExpenseSum = filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const getCategoryMeta = (catKey: ExpenseCategory) => {
    return CATEGORIES.find((c) => c.key === catKey) || CATEGORIES[4];
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background decoration */}
      <View style={styles.blob1} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Quay lại</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnAdd} onPress={openAddModal}>
            <Text style={styles.btnAddText}>+ Thêm khoản chi</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>💸 Quản lý Chi phí</Text>
        <Text style={styles.subtitle}>Ghi nhận các khoản chi mua nguyên liệu, điện nước, lương...</Text>
      </View>

      {/* Summary KPI Box */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tổng Chi Phí ({filteredExpenses.length} khoản):</Text>
          <Text style={styles.summaryValue}>{formatVND(totalExpenseSum)}</Text>
        </View>

        {/* Category Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catFilterRow}>
          <TouchableOpacity
            style={[styles.catFilterChip, selectedCatFilter === 'all' && styles.catFilterChipActive]}
            onPress={() => setSelectedCatFilter('all')}
          >
            <Text style={[styles.catFilterText, selectedCatFilter === 'all' && styles.catFilterTextActive]}>
              Tất cả
            </Text>
          </TouchableOpacity>

          {CATEGORIES.map((c) => {
            const isSelected = selectedCatFilter === c.key;
            const catTotal = expenses
              .filter((e) => e.category === c.key)
              .reduce((s, e) => s + (Number(e.amount) || 0), 0);

            return (
              <TouchableOpacity
                key={c.key}
                style={[
                  styles.catFilterChip,
                  isSelected && { backgroundColor: c.bg, borderColor: c.color },
                ]}
                onPress={() => setSelectedCatFilter(c.key)}
              >
                <Text style={[styles.catFilterText, isSelected && { color: c.color, fontFamily: 'Nunito_700Bold' }]}>
                  {c.icon} {c.label} ({formatVND(catTotal)})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Expense List */}
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : filteredExpenses.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Chưa có khoản chi phí nào</Text>
          <Text style={styles.emptySub}>Nhấn vào nút "+ Thêm khoản chi" ở trên để ghi nhận khoản chi đầu tiên</Text>
        </View>
      ) : (
        <FlatList
          data={filteredExpenses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const meta = getCategoryMeta(item.category);

            return (
              <View style={styles.expenseCard}>
                <View style={styles.cardMain}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.catBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.catBadgeText, { color: meta.color }]}>
                        {meta.icon} {meta.label}
                      </Text>
                    </View>
                    <Text style={styles.expenseDateText}>{item.expense_date}</Text>
                  </View>

                  <Text style={styles.expenseDesc}>{item.description}</Text>
                  <Text style={styles.expenseAmount}>{formatVND(item.amount)}</Text>
                </View>

                {/* Actions */}
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionBtnEdit}
                    onPress={() => openEditModal(item)}
                  >
                    <Text style={styles.actionEditText}>Sửa</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnDelete}
                    onPress={() => handleDeleteExpensePrompt(item)}
                  >
                    <Text style={styles.actionDeleteText}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* ── MODAL: Add / Edit Expense ─────────────────────────────────── */}
      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={() => setIsModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsModalVisible(false)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
            <Text style={styles.modalTitle}>
              {editingExpense ? 'Sửa khoản chi phí' : 'Thêm khoản chi phí mới'}
            </Text>

            {/* Description Input */}
            <Text style={styles.inputLabel}>Mô tả khoản chi (*):</Text>
            <TextInput
              style={styles.input}
              placeholder="Vd: Mua trà, sữa, đường..."
              placeholderTextColor={COLORS.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            {/* Amount Input */}
            <Text style={styles.inputLabel}>Số tiền (VND) (*):</Text>
            <TextInput
              style={styles.input}
              placeholder="Vd: 250.000"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={amountStr}
              onChangeText={handleAmountChange}
            />
            {amountStr !== '' && parseNumberInput(amountStr) > 0 && (
              <Text style={styles.amountPreview}>
                Thành tiền: {formatVND(parseNumberInput(amountStr))}
              </Text>
            )}

            {/* Category Selector */}
            <Text style={styles.inputLabel}>Danh mục chi phí:</Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((c) => {
                const isSelected = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    style={[
                      styles.catOption,
                      isSelected && { backgroundColor: c.bg, borderColor: c.color, borderWidth: 1.5 },
                    ]}
                    onPress={() => setCategory(c.key)}
                  >
                    <Text style={[styles.catOptionText, isSelected && { color: c.color, fontFamily: 'Nunito_700Bold' }]}>
                      {c.icon} {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Date Input */}
            <Text style={styles.inputLabel}>Ngày chi (YYYY-MM-DD):</Text>
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={COLORS.textMuted}
              value={expenseDate}
              onChangeText={setExpenseDate}
            />

            {/* Submit Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, saving && styles.btnDisabled]}
                onPress={handleSaveExpense}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.modalSaveText}>
                    {editingExpense ? 'Cập nhật' : 'Lưu khoản chi'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Custom Confirmation Dialog */}
      <ConfirmModal
        visible={confirmConfig.visible}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText="Xóa khoản chi"
        cancelText="Bỏ qua"
        confirmType="danger"
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, visible: false }))}
      />

      <Toast {...toast} onHide={hide} />
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

  header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(197, 160, 89, 0.4)',
  },
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: '#234635',
  },
  btnAdd: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  btnAddText: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.white },

  title: { fontFamily: 'Nunito_700Bold', fontSize: 24, color: COLORS.textPrimary, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textSecondary },

  summaryCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  summaryLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.textSecondary },
  summaryValue: { fontFamily: 'Nunito_700Bold', fontSize: 22, color: COLORS.danger },

  catFilterRow: { flexDirection: 'row' },
  catFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  catFilterChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  catFilterText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textSecondary },
  catFilterTextActive: { fontFamily: 'Nunito_700Bold', color: COLORS.primaryDeep },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 10 },
  expenseCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 3,
  },
  cardMain: { flex: 1, paddingRight: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  catBadgeText: { fontFamily: 'Nunito_700Bold', fontSize: 11 },
  expenseDateText: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textMuted },
  expenseDesc: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.textPrimary, marginBottom: 4 },
  expenseAmount: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.danger },

  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtnEdit: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  actionEditText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.primaryDeep },
  actionBtnDelete: { backgroundColor: COLORS.dangerLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  actionDeleteText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.danger },

  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginTop: 40 },
  emptyTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.textPrimary, marginBottom: 6 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: COLORS.textPrimary, marginBottom: 14, textAlign: 'center' },
  inputLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.textSecondary, marginBottom: 4, marginTop: 6 },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  amountPreview: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.primary, marginTop: 2 },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
  catOption: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  catOptionText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textSecondary },

  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, backgroundColor: COLORS.background, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.textSecondary },
  modalSaveBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  modalSaveText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.white },
  btnDisabled: { opacity: 0.6 },
});
