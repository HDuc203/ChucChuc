import { create } from 'zustand';
import { CartItem, OrderType, Product, Table } from '../types';

interface CartState {
  // Order context
  orderType: OrderType;
  selectedTable: Table | null;
  activeOrderId: string | null; // ID of existing open order in DB (for dine_in)

  // Cart items
  items: CartItem[];

  // Computed
  totalItems: number;
  totalAmount: number;

  // Actions
  setOrderType: (type: OrderType) => void;
  setTable: (table: Table | null) => void;
  setActiveOrder: (orderId: string | null, table: Table | null, items: CartItem[]) => void;
  addItem: (product: Product, note?: string) => void;
  removeItem: (productId: string, note?: string) => void;
  removeItemByIndex: (index: number) => void;
  updateQuantity: (productId: string, quantity: number, note?: string) => void;
  updateQuantityByIndex: (index: number, quantity: number) => void;
  updateNote: (productId: string, note: string, oldNote?: string) => void;
  updateNoteByIndex: (index: number, note: string) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  orderType: null,
  selectedTable: null,
  activeOrderId: null,
  items: [],
  totalItems: 0,
  totalAmount: 0,

  setOrderType: (type) =>
    set({ orderType: type, selectedTable: null, activeOrderId: null, items: [], totalItems: 0, totalAmount: 0 }),

  setTable: (table) =>
    set({ selectedTable: table }),

  setActiveOrder: (orderId, table, existingItems) => {
    set({
      orderType: 'dine_in',
      selectedTable: table,
      activeOrderId: orderId,
      items: existingItems,
      totalItems: existingItems.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: existingItems.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    });
  },

  // 1. ADD ITEM: Merge if product.id AND note are identical; separate row if note differs!
  addItem: (product, note = '') => {
    const items = get().items;
    const trimmedNote = (note || '').trim();
    const existingIndex = items.findIndex(
      (i) => i.product.id === product.id && (i.note || '').trim() === trimmedNote
    );

    let newItems: CartItem[];
    if (existingIndex >= 0) {
      newItems = items.map((item, idx) =>
        idx === existingIndex
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    } else {
      newItems = [...items, { product, quantity: 1, note: trimmedNote }];
    }

    set({
      items: newItems,
      totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: newItems.reduce(
        (sum, i) => sum + i.product.price * i.quantity,
        0
      ),
    });
  },

  removeItem: (productId, note) => {
    const trimmedNote = note !== undefined ? note.trim() : null;
    const newItems = get().items.filter((i) => {
      if (i.product.id !== productId) return true;
      if (trimmedNote !== null) {
        return (i.note || '').trim() !== trimmedNote;
      }
      return false;
    });
    set({
      items: newItems,
      totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: newItems.reduce(
        (sum, i) => sum + i.product.price * i.quantity,
        0
      ),
    });
  },

  removeItemByIndex: (index: number) => {
    const newItems = get().items.filter((_, idx) => idx !== index);
    set({
      items: newItems,
      totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: newItems.reduce(
        (sum, i) => sum + i.product.price * i.quantity,
        0
      ),
    });
  },

  // 2. MINIMUM QUANTITY IS 1: If quantity <= 0, remove item completely
  updateQuantity: (productId, quantity, note) => {
    if (quantity <= 0) {
      get().removeItem(productId, note);
      return;
    }
    const trimmedNote = note !== undefined ? note.trim() : null;
    let updated = false;
    const newItems = get().items.map((i) => {
      if (!updated && i.product.id === productId && (trimmedNote === null || (i.note || '').trim() === trimmedNote)) {
        updated = true;
        return { ...i, quantity };
      }
      return i;
    });
    set({
      items: newItems,
      totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: newItems.reduce(
        (sum, i) => sum + i.product.price * i.quantity,
        0
      ),
    });
  },

  updateQuantityByIndex: (index: number, quantity: number) => {
    if (quantity <= 0) {
      get().removeItemByIndex(index);
      return;
    }
    const newItems = get().items.map((i, idx) =>
      idx === index ? { ...i, quantity } : i
    );
    set({
      items: newItems,
      totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: newItems.reduce(
        (sum, i) => sum + i.product.price * i.quantity,
        0
      ),
    });
  },

  updateNote: (productId, note, oldNote) => {
    const trimmedOld = oldNote !== undefined ? oldNote.trim() : null;
    let updated = false;
    set({
      items: get().items.map((i) => {
        if (!updated && i.product.id === productId && (trimmedOld === null || (i.note || '').trim() === trimmedOld)) {
          updated = true;
          return { ...i, note };
        }
        return i;
      }),
    });
  },

  updateNoteByIndex: (index: number, note: string) => {
    set({
      items: get().items.map((i, idx) => (idx === index ? { ...i, note } : i)),
    });
  },

  clearCart: () =>
    set({ items: [], totalItems: 0, totalAmount: 0, orderType: null, selectedTable: null, activeOrderId: null }),
}));
