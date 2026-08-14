import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS } from '../constants/colors';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmType?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = 'Xác nhận',
  cancelText = 'Bỏ qua',
  confirmType = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!visible) return null;

  const getConfirmBtnStyle = () => {
    switch (confirmType) {
      case 'primary':
        return { backgroundColor: COLORS.primary, textColor: COLORS.white };
      case 'warning':
        return { backgroundColor: '#F59E0B', textColor: COLORS.white };
      case 'danger':
      default:
        return { backgroundColor: COLORS.danger, textColor: COLORS.white };
    }
  };

  const btnStyle = getConfirmBtnStyle();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity style={styles.card} activeOpacity={1}>
          {/* Header Icon / Title */}
          <View style={styles.header}>
            <View
              style={[
                styles.iconCircle,
                confirmType === 'primary'
                  ? styles.iconPrimary
                  : confirmType === 'warning'
                  ? styles.iconWarning
                  : styles.iconDanger,
              ]}
            >
              <Text style={styles.iconText}>
                {confirmType === 'primary' ? '🔄' : confirmType === 'warning' ? '⚠️' : '🗑️'}
              </Text>
            </View>
            <Text style={styles.title}>{title}</Text>
          </View>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: btnStyle.backgroundColor }]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={[styles.confirmBtnText, { color: btnStyle.textColor }]}>
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconDanger: { backgroundColor: '#FEE2E2' },
  iconWarning: { backgroundColor: '#FEF3C7' },
  iconPrimary: { backgroundColor: COLORS.primaryLight },
  iconText: { fontSize: 28 },

  title: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 18,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  message: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  cancelBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 14,
  },
});
