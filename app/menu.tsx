import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useCartStore } from '../stores/cartStore';
import { COLORS } from '../constants/colors';
import { Category, Product } from '../types';
import { formatVND } from '../utils/format';

const NOTE_TAGS = ['Ít đường', 'Ít đá', 'Nhiều đá', 'Không đường', 'Đem ra sau'];

export default function MenuScreen() {
  const router = useRouter();
  const { orderType, selectedTable, items, totalItems, totalAmount, addItem } = useCartStore();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);

  // Note Modal state when adding item
  const [selectedProductForNote, setSelectedProductForNote] = useState<Product | null>(null);
  const [itemNoteText, setItemNoteText] = useState('');

  // Animated bump for add button
  const scaleValues: Record<string, Animated.Value> = {};

  const getScale = (productId: string) => {
    if (!scaleValues[productId]) {
      scaleValues[productId] = new Animated.Value(1);
    }
    return scaleValues[productId];
  };

  const animateBump = (productId: string) => {
    const scale = getScale(productId);
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.25, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, bounciness: 12 }),
    ]).start();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [catRes, prodRes] = await Promise.all([
      supabase.from('categories').select('*').or('is_deleted.eq.false,is_deleted.is.null').order('sort_order'),
      supabase.from('products').select('*').eq('is_available', true).or('is_deleted.eq.false,is_deleted.is.null'),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    setLoading(false);
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = !selectedCategory || p.category_id === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchText.toLowerCase());
    return matchCat && matchSearch;
  });



  const getItemCount = (productId: string) => {
    const found = items.find((i) => i.product.id === productId);
    return found ? found.quantity : 0;
  };

  // Open note modal when staff taps product or '+' button
  const handleOpenAddModal = (product: Product) => {
    const existing = items.find((i) => i.product.id === product.id);
    setSelectedProductForNote(product);
    setItemNoteText(existing?.note || '');
  };

  // Confirm add with note
  const handleConfirmAddWithNote = (withNote: boolean) => {
    if (!selectedProductForNote) return;
    const finalNote = withNote ? itemNoteText : '';
    addItem(selectedProductForNote, finalNote);
    animateBump(selectedProductForNote.id);
    setSelectedProductForNote(null);
    setItemNoteText('');
  };

  const handleToggleNoteTag = (tag: string) => {
    if (itemNoteText.includes(tag)) {
      setItemNoteText(itemNoteText.replace(tag, '').replace(/,\s*,/g, ',').trim());
    } else {
      setItemNoteText(itemNoteText ? `${itemNoteText}, ${tag}` : tag);
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
        <View style={styles.headerTop}>
          <TouchableOpacity id="btn-back-menu" onPress={() => router.back()} style={styles.backTouch}>
            <Text style={styles.backText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.shopName}>Chúc Chúc</Text>
            <Text style={styles.shopSub}>Trà · Cà phê · Trái cây</Text>
          </View>
          <View style={styles.orderBadge}>
            <Text style={styles.orderBadgeText}>{orderLabel}</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            id="input-search-menu"
            style={styles.searchInput}
            placeholder="Tìm món..."
            placeholderTextColor={COLORS.textMuted}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>
      </View>

      {/* Categories Horizontal Bar */}
      <View style={styles.categoryWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <TouchableOpacity
            id="cat-all"
            style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[styles.categoryText, !selectedCategory && styles.categoryTextActive]}>
              Tất cả
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              id={`cat-${cat.id}`}
              key={cat.id}
              style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat.id && styles.categoryTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Products grid */}
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.productGrid}
          columnWrapperStyle={styles.productRow}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const count = getItemCount(item.id);
            const scale = getScale(item.id);
            const existingItem = items.find((i) => i.product.id === item.id);

            return (
              <TouchableOpacity
                style={styles.productCard}
                onPress={() => handleOpenAddModal(item)}
                activeOpacity={0.9}
              >
                {/* Image or Leaf Fallback */}
                <View style={styles.productImageBox}>
                  {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.productImage} />
                  ) : (
                    <Text style={styles.productImageEmoji}>🍃</Text>
                  )}
                </View>

                {/* Info */}
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {existingItem?.note ? (
                    <Text style={styles.itemNoteBadge} numberOfLines={1}>
                      {existingItem.note}
                    </Text>
                  ) : null}
                  <View style={styles.productBottom}>
                    <Text style={styles.productPrice}>{formatVND(item.price)}</Text>
                    <Animated.View style={{ transform: [{ scale }] }}>
                      <TouchableOpacity
                        id={`btn-add-${item.id}`}
                        style={[styles.addBtn, count > 0 && styles.addBtnActive]}
                        onPress={() => handleOpenAddModal(item)}
                        activeOpacity={0.8}
                      >
                        {count > 0 ? (
                          <Text style={styles.addBtnCount}>{count}</Text>
                        ) : (
                          <Text style={styles.addBtnText}>+</Text>
                        )}
                      </TouchableOpacity>
                    </Animated.View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Cart floating bar */}
      {totalItems > 0 && (
        <TouchableOpacity
          id="btn-view-cart"
          style={styles.cartBar}
          onPress={() => router.push('/cart')}
          activeOpacity={0.9}
        >
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{totalItems}</Text>
          </View>
          <Text style={styles.cartBarText}>Xem giỏ hàng</Text>
          <Text style={styles.cartBarPrice}>{formatVND(totalAmount)}</Text>
        </TouchableOpacity>
      )}

      {/* ── MODAL: THÊM GHI CHÚ MÓN ──────────────────────────────────────── */}
      <Modal
        visible={!!selectedProductForNote}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedProductForNote(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalProdInfo}>
                <Text style={styles.modalProdName}>{selectedProductForNote?.name}</Text>
                <Text style={styles.modalProdPrice}>
                  {selectedProductForNote ? formatVND(selectedProductForNote.price) : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedProductForNote(null)}>
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Ghi chú cho bếp / pha chế (tùy chọn):</Text>

            {/* Quick Note Tags */}
            <View style={styles.tagsRow}>
              {NOTE_TAGS.map((tag) => (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.tagChip,
                    itemNoteText.includes(tag) && styles.tagChipActive,
                  ]}
                  onPress={() => handleToggleNoteTag(tag)}
                >
                  <Text
                    style={[
                      styles.tagText,
                      itemNoteText.includes(tag) && styles.tagTextActive,
                    ]}
                  >
                    {tag}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Note text input */}
            <TextInput
              id="input-item-note"
              style={styles.noteInputModal}
              placeholder="Ví dụ: ít đường, 50% đá, đem ra sau..."
              placeholderTextColor={COLORS.textMuted}
              value={itemNoteText}
              onChangeText={setItemNoteText}
              multiline
            />

            <View style={styles.modalActionCol}>
              <TouchableOpacity
                id="btn-confirm-add-note"
                style={styles.btnConfirmNote}
                onPress={() => handleConfirmAddWithNote(true)}
              >
                <Text style={styles.btnConfirmNoteText}>➕ Thêm vào giỏ với ghi chú</Text>
              </TouchableOpacity>

              <TouchableOpacity
                id="btn-quick-add"
                style={styles.btnQuickAdd}
                onPress={() => handleConfirmAddWithNote(false)}
              >
                <Text style={styles.btnQuickAddText}>⚡ Thêm nhanh (Không ghi chú)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  backTouch: {
    paddingRight: 4,
    paddingVertical: 2,
  },
  backText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 24,
    color: COLORS.primary,
  },
  headerInfo: { flex: 1 },
  shopName: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  shopSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  orderBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    alignSelf: 'center',
  },
  orderBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  categoryWrapper: {
    height: 48,
    marginBottom: 10,
  },
  categoryScroll: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  categoryChip: {
    height: 36,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: COLORS.categoryInactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: COLORS.categoryActive,
  },
  categoryText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: COLORS.categoryInactiveText,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  categoryTextActive: {
    color: COLORS.categoryActiveText,
    fontFamily: 'Nunito_700Bold',
  },
  productGrid: {
    paddingHorizontal: 12,
    paddingBottom: 100,
    gap: 12,
  },
  productRow: { gap: 12 },
  productCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  productImageBox: {
    height: 110,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  productImageEmoji: { fontSize: 36 },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 4,
    minHeight: 34,
    lineHeight: 18,
  },
  itemNoteBadge: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: COLORS.primary,
    marginBottom: 4,
  },
  productBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.textPrice,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  addBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: COLORS.primary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  addBtnCount: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.white,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  cartBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  cartBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.cartBadge,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cartBadgeText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 13,
    color: COLORS.white,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  cartBarText: {
    flex: 1,
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: COLORS.white,
  },
  cartBarPrice: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 16,
    color: COLORS.white,
  },

  // Modal Note Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalProdInfo: { flex: 1 },
  modalProdName: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: COLORS.textPrimary },
  modalProdPrice: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.primary, marginTop: 2 },
  modalCloseIcon: { fontSize: 20, color: COLORS.textMuted, padding: 4 },
  inputLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.textSecondary },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  tagChipActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  tagText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textSecondary },
  tagTextActive: { color: COLORS.primary, fontFamily: 'Nunito_700Bold' },
  noteInputModal: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 60,
  },
  modalActionCol: { gap: 10, marginTop: 6 },
  btnConfirmNote: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnConfirmNoteText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.white },
  btnQuickAdd: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnQuickAddText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: COLORS.textSecondary },
});
