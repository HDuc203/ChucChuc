import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/colors';
import { Category, Product } from '../types';
import { formatVND } from '../utils/format';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

type ManageTab = 'products' | 'categories' | 'bank';

const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: 'Bỏ qua', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

export default function ManageScreen() {
  const router = useRouter();
  const { toast, hide, success: toastSuccess } = useToast();
  const [activeTab, setActiveTab] = useState<ManageTab>('products');
  const [loading, setLoading] = useState(true);

  // Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCatFilter, setSelectedCatFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Product Modal State
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCategoryId, setProdCategoryId] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [prodIsAvailable, setProdIsAvailable] = useState(true);
  const [savingProd, setSavingProd] = useState(false);

  // Category Modal State
  const [isCatModalVisible, setIsCatModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState('');
  const [catSortOrder, setCatSortOrder] = useState('1');
  const [savingCat, setSavingCat] = useState(false);

  // Bank Settings State (VietQR)
  const [bankCode, setBankCode] = useState('mbbank');
  const [accountNumber, setAccountNumber] = useState('0964544341');
  const [accountName, setAccountName] = useState('HUYNH THI THANH TRUC');
  const [savingBank, setSavingBank] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [catRes, prodRes, bankRes] = await Promise.all([
      supabase.from('categories').select('*').or('is_deleted.eq.false,is_deleted.is.null').order('sort_order'),
      supabase.from('products').select('*').or('is_deleted.eq.false,is_deleted.is.null').order('created_at', { ascending: false }),
      supabase.from('bank_settings').select('*').limit(1),
    ]);
    if (catRes.data) setCategories(catRes.data as Category[]);
    if (prodRes.data) setProducts(prodRes.data as Product[]);
    if (bankRes.data && bankRes.data.length > 0) {
      setBankCode(bankRes.data[0].bank_code || 'mbbank');
      setAccountNumber(bankRes.data[0].account_number || '0964544341');
      setAccountName(bankRes.data[0].account_name || 'HUYNH THI THANH TRUC');
    }
    setLoading(false);
  };

  // ── IMAGE PICKER FROM GALLERY ──────────────────────────────────────────────
  const pickImageFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Cần cấp quyền', 'Vui lòng cho phép ứng dụng truy cập Bộ sưu tập ảnh để chọn ảnh món ăn.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setSelectedImageUri(result.assets[0].uri);
    }
  };

  // Upload picked image file to Supabase Storage
  const uploadImageToSupabase = async (uri: string): Promise<string | null> => {
    if (!uri) return null;

    // Already a remote URL — nothing to upload
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      return uri;
    }

    // Fetch the local file as binary
    const response = await fetch(uri);
    if (!response.ok) throw new Error(`Không thể đọc file ảnh: ${response.status}`);

    const arrayBuffer = await response.arrayBuffer();

    // Detect MIME type from response headers (iOS returns correct content-type)
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Derive safe extension from MIME type
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('heic')) ext = 'heic';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';

    const fileName = `prod_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    const { error } = await supabase.storage
      .from('product-images')
      .upload(fileName, arrayBuffer, {
        contentType,
        upsert: true,
      });

    if (error) throw new Error(`Upload thất bại: ${error.message}`);

    const { data: publicUrlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    if (!publicUrlData?.publicUrl) throw new Error('Không lấy được URL ảnh công khai.');

    return publicUrlData.publicUrl;
  };

  // ── PRODUCT CRUD HANDLERS ──────────────────────────────────────────────────

  const openAddProductModal = () => {
    setEditingProduct(null);
    setProdName('');
    setProdPrice('');
    setProdCategoryId(categories[0]?.id || '');
    setSelectedImageUri(null);
    setProdIsAvailable(true);
    setIsProductModalVisible(true);
  };

  const openEditProductModal = (product: Product) => {
    setEditingProduct(product);
    setProdName(product.name);
    setProdPrice(product.price.toString());
    setProdCategoryId(product.category_id);
    setSelectedImageUri(product.image_url);
    setProdIsAvailable(product.is_available);
    setIsProductModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!prodName.trim()) {
      Alert.alert('Chưa nhập tên', 'Vui lòng nhập tên sản phẩm.');
      return;
    }
    const priceNum = parseInt(prodPrice.replace(/[^0-9]/g, ''), 10);
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Giá không hợp lệ', 'Giá sản phẩm phải lớn hơn 0đ.');
      return;
    }
    if (!prodCategoryId) {
      Alert.alert('Chưa chọn danh mục', 'Vui lòng chọn danh mục cho sản phẩm.');
      return;
    }

    // Constraint 4: Check duplicate product name in the same category
    const duplicateProduct = products.find(
      (p) =>
        p.category_id === prodCategoryId &&
        p.name.trim().toLowerCase() === prodName.trim().toLowerCase() &&
        (!editingProduct || p.id !== editingProduct.id)
    );
    if (duplicateProduct) {
      Alert.alert(
        'Tên món bị trùng',
        `Danh mục này đã có món "${duplicateProduct.name}". Vui lòng chọn tên khác để tránh nhầm lẫn.`
      );
      return;
    }

    setSavingProd(true);
    try {
      // Chỉ upload khi có ảnh MỚI được chọn (local URI, không phải URL http)
      let finalImageUrl: string | null = selectedImageUri;
      const isLocalUri = selectedImageUri &&
        !selectedImageUri.startsWith('http://') &&
        !selectedImageUri.startsWith('https://');

      if (isLocalUri) {
        // Upload ảnh mới lên Supabase Storage
        finalImageUrl = await uploadImageToSupabase(selectedImageUri!);
      }

      if (editingProduct) {
        const updateData: any = {
          name: prodName.trim(),
          price: priceNum,
          category_id: prodCategoryId,
          is_available: prodIsAvailable,
        };

        // Chỉ cập nhật image_url nếu người dùng có thay đổi ảnh
        // (tránh xóa mất ảnh cũ khi chỉ sửa tên/giá)
        if (selectedImageUri !== editingProduct.image_url) {
          updateData.image_url = finalImageUrl;
        }

        const { error } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        toastSuccess(`Đã cập nhật: ${prodName.trim()}`);
      } else {
        const { error } = await supabase.from('products').insert({
          name: prodName.trim(),
          price: priceNum,
          category_id: prodCategoryId,
          image_url: finalImageUrl,
          is_available: prodIsAvailable,
          is_deleted: false,
        });

        if (error) throw error;
        toastSuccess(`Đã thêm món: ${prodName.trim()}`);
      }

      setIsProductModalVisible(false);
      fetchData();
    } catch (err: any) {
      const msg = err?.message || 'Thử lại';
      if (msg.includes('Upload') || msg.includes('URL ảnh')) {
        Alert.alert(
          'Lỗi upload ảnh',
          `Không thể tải ảnh lên. Vui lòng kiểm tra kết nối mạng hoặc cài đặt Storage trên Supabase.\n\nChi tiết: ${msg}`
        );
      } else {
        Alert.alert('Lỗi', `Không thể lưu sản phẩm. (${msg})`);
      }
    } finally {
      setSavingProd(false);
    }
  };

  // Toggle is_available
  const handleToggleAvailable = async (product: Product, newValue: boolean) => {
    try {
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_available: newValue } : p))
      );
      await supabase
        .from('products')
        .update({ is_available: newValue })
        .eq('id', product.id);
    } catch (err) {
      fetchData();
    }
  };

  // Constraint 4: Soft Delete Product with check for open orders
  const handleSoftDeleteProduct = async (product: Product) => {
    try {
      // Check if product is used in any open orders
      const { data: openItems } = await supabase
        .from('order_items')
        .select('id, orders!inner(status)')
        .eq('product_id', product.id)
        .eq('orders.status', 'open');

      if (openItems && openItems.length > 0) {
        Alert.alert(
          'Không thể xóa món',
          `Món "${product.name}" đang nằm trong đơn hàng chưa thanh toán của bàn khác. Vui lòng hoàn tất đơn đó trước khi xóa món.`
        );
        return;
      }
    } catch (checkErr) {
      // Continue to prompt if check fails
    }

    showConfirmDialog(
      'Xóa món',
      `Bạn có chắc muốn xóa "${product.name}" khỏi thực đơn?\n(Lịch sử bán hàng và báo cáo cũ vẫn được giữ nguyên)`,
      async () => {
        await supabase
          .from('products')
          .update({ is_deleted: true })
          .eq('id', product.id);
        fetchData();
      }
    );
  };

  // ── CATEGORY CRUD HANDLERS ─────────────────────────────────────────────────

  const openAddCategoryModal = () => {
    setEditingCategory(null);
    setCatName('');
    setCatSortOrder((categories.length + 1).toString());
    setIsCatModalVisible(true);
  };

  const openEditCategoryModal = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatSortOrder(cat.sort_order.toString());
    setIsCatModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!catName.trim()) {
      Alert.alert('Chưa nhập tên', 'Vui lòng nhập tên danh mục.');
      return;
    }
    const orderNum = parseInt(catSortOrder, 10) || 1;

    setSavingCat(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({ name: catName.trim(), sort_order: orderNum })
          .eq('id', editingCategory.id);
        if (error) throw error;
        toastSuccess(`Đã cập nhật danh mục: ${catName.trim()}`);
      } else {
        const { error } = await supabase.from('categories').insert({
          name: catName.trim(),
          sort_order: orderNum,
          is_deleted: false,
        });
        if (error) throw error;
        toastSuccess(`Đã thêm danh mục: ${catName.trim()}`);
      }

      setIsCatModalVisible(false);
      fetchData();
    } catch (err: any) {
      Alert.alert('Lỗi', `Không thể lưu danh mục. (${err?.message || 'Thử lại'})`);
    } finally {
      setSavingCat(false);
    }
  };

  // Soft Delete Category
  const handleSoftDeleteCategory = (cat: Category) => {
    const prodsInCat = products.filter((p) => p.category_id === cat.id);
    if (prodsInCat.length > 0) {
      Alert.alert(
        'Không thể xóa',
        `Danh mục "${cat.name}" hiện đang chứa ${prodsInCat.length} sản phẩm. Vui lòng chuyển hoặc xóa hết các món trong danh mục này trước.`
      );
      return;
    }

    showConfirmDialog(
      'Xóa danh mục',
      `Bạn có chắc chắn muốn xóa danh mục "${cat.name}"?`,
      async () => {
        await supabase
          .from('categories')
          .update({ is_deleted: true })
          .eq('id', cat.id);
        fetchData();
      }
    );
  };

  // ── SAVE BANK SETTINGS (VIETQR) ────────────────────────────────────────────
  const handleSaveBankSettings = async () => {
    if (!accountNumber.trim()) {
      Alert.alert('Chưa nhập STK', 'Vui lòng nhập số tài khoản ngân hàng.');
      return;
    }
    if (!accountName.trim()) {
      Alert.alert('Chưa nhập tên chủ TK', 'Vui lòng nhập tên chủ tài khoản.');
      return;
    }

    setSavingBank(true);
    try {
      const { data: existing } = await supabase.from('bank_settings').select('id').limit(1);

      if (existing && existing.length > 0) {
        await supabase
          .from('bank_settings')
          .update({
            bank_code: bankCode.trim().toLowerCase(),
            account_number: accountNumber.trim(),
            account_name: accountName.trim().toUpperCase(),
            template: 'compact2',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing[0].id);
      } else {
        await supabase.from('bank_settings').insert({
          bank_code: bankCode.trim().toLowerCase(),
          account_number: accountNumber.trim(),
          account_name: accountName.trim().toUpperCase(),
          template: 'compact2',
        });
      }

      toastSuccess('Đã lưu cài đặt VietQR thành công!');
    } catch (err: any) {
      Alert.alert('Lỗi', err?.message || 'Không thể lưu cài đặt ngân hàng');
    } finally {
      setSavingBank(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = !selectedCatFilter || p.category_id === selectedCatFilter;
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.blob1} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity id="btn-back-manage" onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🛠️ Quản lý & Cài đặt</Text>
        <Text style={styles.subtitle}>Thực đơn, danh mục & Cài đặt Ngân hàng VietQR</Text>
      </View>

      {/* Main Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          id="tab-products"
          style={[styles.tabBtn, activeTab === 'products' && styles.tabBtnActive]}
          onPress={() => setActiveTab('products')}
        >
          <Text style={[styles.tabText, activeTab === 'products' && styles.tabTextActive]}>
            ☕ Món ({products.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          id="tab-categories"
          style={[styles.tabBtn, activeTab === 'categories' && styles.tabBtnActive]}
          onPress={() => setActiveTab('categories')}
        >
          <Text style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]}>
            Danh mục ({categories.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : activeTab === 'products' ? (
        /* ── TAB 1: QUẢN LÝ SẢN PHẨM ─────────────────────────────────────── */
        <View style={{ flex: 1 }}>
          {/* Action & Filter Bar */}
          <View style={styles.actionFilterBar}>
            <TouchableOpacity id="btn-open-add-product" style={styles.addPrimaryBtn} onPress={openAddProductModal}>
              <Text style={styles.addPrimaryText}>+ Thêm món mới</Text>
            </TouchableOpacity>

            <TextInput
              id="input-search-manage"
              style={styles.searchInput}
              placeholder="Tìm món..."
              placeholderTextColor={COLORS.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Category Filter Chips */}
          <View style={styles.catWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catChipScroll}>
              <TouchableOpacity
                style={[styles.catFilterChip, !selectedCatFilter && styles.catFilterChipActive]}
                onPress={() => setSelectedCatFilter(null)}
              >
                <Text style={[styles.catFilterText, !selectedCatFilter && styles.catFilterTextActive]}>Tất cả</Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catFilterChip, selectedCatFilter === c.id && styles.catFilterChipActive]}
                  onPress={() => setSelectedCatFilter(c.id)}
                >
                  <Text style={[styles.catFilterText, selectedCatFilter === c.id && styles.catFilterTextActive]}>
                    {c.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Products List */}
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const catObj = categories.find((c) => c.id === item.category_id);
              return (
                <View style={styles.itemCard}>
                  <View style={styles.itemMainRow}>
                    {/* Image display or fallback leaf */}
                    <View style={styles.itemImageBox}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.productImg} />
                      ) : (
                        <Text style={styles.itemEmoji}>🍃</Text>
                      )}
                    </View>

                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemCategory}>{catObj?.name || 'Chưa phân loại'}</Text>
                      <Text style={styles.itemPrice}>{formatVND(item.price)}</Text>
                    </View>

                    {/* Toggle Available */}
                    <View style={styles.switchCol}>
                      <Switch
                        value={item.is_available}
                        onValueChange={(val) => handleToggleAvailable(item, val)}
                        trackColor={{ false: '#E0E0E0', true: COLORS.primaryLight }}
                        thumbColor={item.is_available ? COLORS.primary : '#9E9E9E'}
                      />
                      <Text style={[styles.switchLabel, !item.is_available && styles.switchLabelOff]}>
                        {item.is_available ? 'Đang bán' : 'Hết món'}
                      </Text>
                    </View>
                  </View>

                  {/* Edit & Delete Action Buttons */}
                  <View style={styles.itemActionRow}>
                    <TouchableOpacity
                      id={`btn-edit-prod-${item.id}`}
                      style={styles.btnEdit}
                      onPress={() => openEditProductModal(item)}
                    >
                      <Text style={styles.btnEditText}>Sửa món</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      id={`btn-delete-prod-${item.id}`}
                      style={styles.btnDelete}
                      onPress={() => handleSoftDeleteProduct(item)}
                    >
                      <Text style={styles.btnDeleteText}>Xóa</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
          />
        </View>
      ) : (
        /* ── TAB 2: QUẢN LÝ DANH MỤC ────────────────────────────────────── */
        <View style={{ flex: 1 }}>
          <View style={styles.actionFilterBar}>
            <TouchableOpacity id="btn-open-add-cat" style={styles.addPrimaryBtn} onPress={openAddCategoryModal}>
              <Text style={styles.addPrimaryText}>+ Thêm danh mục mới</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={categories}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const countProds = products.filter((p) => p.category_id === item.id).length;
              return (
                <View style={styles.itemCard}>
                  <View style={styles.catMainRow}>
                    <View style={styles.catBadgeBox}>
                      <Text style={styles.catBadgeOrder}>#{item.sort_order}</Text>
                    </View>
                    <View style={styles.catInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemCategory}>{countProds} sản phẩm đang có</Text>
                    </View>

                    <View style={styles.catActionRow}>
                      <TouchableOpacity style={styles.btnEditCompact} onPress={() => openEditCategoryModal(item)}>
                        <Text style={styles.btnEditText}>Sửa</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnDeleteCompact} onPress={() => handleSoftDeleteCategory(item)}>
                        <Text style={styles.btnDeleteText}>Xóa</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* ── MODAL: THÊM / SỬA MÓN ────────────────────────────────────────── */}
      <Modal
        visible={isProductModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsProductModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingProduct ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Name Input */}
              <Text style={styles.inputLabel}>Tên món (*)</Text>
              <TextInput
                id="input-prod-name"
                style={styles.modalInput}
                placeholder="Ví dụ: Cà phê muối, Trà đào..."
                placeholderTextColor={COLORS.textMuted}
                value={prodName}
                onChangeText={setProdName}
              />

              {/* Price Input */}
              <Text style={styles.inputLabel}>Giá bán (VND) (*)</Text>
              <TextInput
                id="input-prod-price"
                style={styles.modalInput}
                placeholder="Ví dụ: 30000"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={prodPrice}
                onChangeText={setProdPrice}
              />

              {/* Category Selector */}
              <Text style={styles.inputLabel}>Danh mục (*)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.modalCatChip,
                      prodCategoryId === c.id && styles.modalCatChipSelected,
                    ]}
                    onPress={() => setProdCategoryId(c.id)}
                  >
                    <Text
                      style={[
                        styles.modalCatText,
                        prodCategoryId === c.id && styles.modalCatTextSelected,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Image Picker Section (Bộ sưu tập) */}
              <Text style={styles.inputLabel}>Hình ảnh sản phẩm</Text>
              <View style={styles.imagePickerContainer}>
                {selectedImageUri ? (
                  <View style={styles.imagePreviewBox}>
                    <Image source={{ uri: selectedImageUri }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.btnRemoveImage}
                      onPress={() => setSelectedImageUri(null)}
                    >
                      <Text style={styles.btnRemoveImageText}>✕ Xóa ảnh</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    id="btn-pick-gallery"
                    style={styles.btnPickGallery}
                    onPress={pickImageFromGallery}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.pickGalleryText}>Chọn ảnh từ Bộ sưu tập</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Is Available Switch */}
              <View style={styles.switchRowModal}>
                <Text style={styles.inputLabel}>Đang phục vụ (Còn hàng):</Text>
                <Switch
                  value={prodIsAvailable}
                  onValueChange={setProdIsAvailable}
                  trackColor={{ false: '#E0E0E0', true: COLORS.primaryLight }}
                  thumbColor={prodIsAvailable ? COLORS.primary : '#9E9E9E'}
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooterRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsProductModalVisible(false)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                id="btn-save-prod"
                style={[styles.modalSaveBtn, savingProd && styles.btnDisabled]}
                onPress={handleSaveProduct}
                disabled={savingProd}
              >
                {savingProd ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Lưu sản phẩm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL: THÊM / SỬA DANH MỤC ───────────────────────────────────── */}
      <Modal
        visible={isCatModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsCatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
            </Text>

            <Text style={styles.inputLabel}>Tên danh mục (*)</Text>
            <TextInput
              id="input-cat-name"
              style={styles.modalInput}
              placeholder="Ví dụ: Trà sữa, Đá xay..."
              placeholderTextColor={COLORS.textMuted}
              value={catName}
              onChangeText={setCatName}
            />

            <Text style={styles.inputLabel}>Thứ tự hiển thị</Text>
            <TextInput
              id="input-cat-sort"
              style={styles.modalInput}
              placeholder="Ví dụ: 1"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
              value={catSortOrder}
              onChangeText={setCatSortOrder}
            />

            <View style={styles.modalFooterRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsCatModalVisible(false)}>
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                id="btn-save-cat"
                style={[styles.modalSaveBtn, savingCat && styles.btnDisabled]}
                onPress={handleSaveCategory}
                disabled={savingCat}
              >
                {savingCat ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.modalSaveText}>Lưu danh mục</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  header: {
    paddingLeft: 20,
    paddingRight: 50,
    paddingTop: 8,
    paddingBottom: 12,
  },
  backBtn: { marginBottom: 6 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: COLORS.primary },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 22, color: COLORS.textPrimary, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textSecondary },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: COLORS.categoryInactive,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.categoryInactiveText },
  tabTextActive: { fontFamily: 'Nunito_700Bold', color: COLORS.white },

  actionFilterBar: {
    paddingHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  addPrimaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  addPrimaryText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.white },
  searchInput: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  catWrapper: { height: 44, marginBottom: 10 },
  catChipScroll: { paddingHorizontal: 16, alignItems: 'center' },
  catFilterChip: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    backgroundColor: COLORS.white,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catFilterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catFilterText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: COLORS.textSecondary,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  catFilterTextActive: { color: COLORS.white, fontFamily: 'Nunito_700Bold' },

  listContainer: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  itemCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
    gap: 10,
  },
  itemMainRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemImageBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImg: { width: 48, height: 48, borderRadius: 12 },
  itemEmoji: { fontSize: 24 },
  itemInfo: { flex: 1 },
  itemName: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.textPrimary },
  itemCategory: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textSecondary },
  itemPrice: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.primary, marginTop: 2 },

  switchCol: { alignItems: 'center' },
  switchLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: COLORS.primary, marginTop: 2 },
  switchLabelOff: { color: COLORS.textMuted },

  itemActionRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderColor: COLORS.divider,
    paddingTop: 10,
    gap: 10,
  },
  btnEdit: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  btnEditText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.primary },
  btnDelete: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  btnDeleteText: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.danger },

  // Category tab clean layout
  catMainRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catBadgeBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBadgeOrder: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.primary },
  catInfo: { flex: 1 },
  catActionRow: { flexDirection: 'row', gap: 8 },
  btnEditCompact: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  btnDeleteCompact: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },

  // Bank tab styles
  bankCardContent: { paddingHorizontal: 16, paddingBottom: 40 },
  bankSettingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
    gap: 10,
  },
  bankSettingTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: COLORS.textPrimary },
  bankSettingSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  saveBankBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBankText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.white },

  // Image Picker Styles
  imagePickerContainer: { marginBottom: 12 },
  btnPickGallery: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
  },
  pickGalleryEmoji: { fontSize: 20 },
  pickGalleryText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.primary },
  imagePreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: 14,
  },
  imagePreview: { width: 60, height: 60, borderRadius: 10 },
  btnRemoveImage: { backgroundColor: '#FFEBEE', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnRemoveImageText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.danger },

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
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  modalTitle: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: COLORS.textPrimary, marginBottom: 8 },
  inputLabel: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  modalInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  modalCatChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  modalCatChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  modalCatText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: COLORS.textSecondary },
  modalCatTextSelected: { color: COLORS.white, fontFamily: 'Nunito_700Bold' },

  switchRowModal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 8 },

  modalFooterRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: COLORS.background },
  modalCancelText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: COLORS.textSecondary },
  modalSaveBtn: { flex: 2, paddingVertical: 14, alignItems: 'center', borderRadius: 14, backgroundColor: COLORS.primary },
  modalSaveText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.white },
  btnDisabled: { opacity: 0.7 },
});
