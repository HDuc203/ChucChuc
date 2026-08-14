import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { COLORS } from '../constants/colors';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastConfig {
  message: string;
  type: ToastType;
  visible: boolean;
}

interface ToastProps extends ToastConfig {
  onHide: () => void;
}

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warning: '⚠️',
};

const BG_COLORS: Record<ToastType, string> = {
  success: COLORS.successLight,
  error: COLORS.dangerLight,
  info: COLORS.infoLight,
  warning: COLORS.warningLight,
};

const BORDER_COLORS: Record<ToastType, string> = {
  success: COLORS.primary,
  error: COLORS.danger,
  info: COLORS.info,
  warning: COLORS.warning,
};

const TEXT_COLORS: Record<ToastType, string> = {
  success: COLORS.primaryDeep,
  error: '#B71C1C',
  info: '#1A5276',
  warning: '#7D5A0A',
};

export default function Toast({ message, type, visible, onHide }: ToastProps) {
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 100,
            duration: 250,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => onHide());
      }, 2500);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(100);
      opacity.setValue(0);
    }
  }, [visible, message]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: BG_COLORS[type],
          borderLeftColor: BORDER_COLORS[type],
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <Text style={styles.icon}>{ICONS[type]}</Text>
      <Text style={[styles.message, { color: TEXT_COLORS[type] }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  icon: {
    fontSize: 18,
  },
  message: {
    flex: 1,
    fontFamily: 'Nunito_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
  },
});
