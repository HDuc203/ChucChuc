import { useState, useCallback } from 'react';
import { ToastType } from '../components/Toast';

interface ToastState {
  message: string;
  type: ToastType;
  visible: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState>({
    message: '',
    type: 'success',
    visible: false,
  });

  const show = useCallback((message: string, type: ToastType = 'success') => {
    setToast({ message, type, visible: false });
    // Small delay to allow re-mount animation if toast was already visible
    setTimeout(() => {
      setToast({ message, type, visible: true });
    }, 50);
  }, []);

  const hide = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  const success = useCallback((message: string) => show(message, 'success'), [show]);
  const error = useCallback((message: string) => show(message, 'error'), [show]);
  const info = useCallback((message: string) => show(message, 'info'), [show]);
  const warning = useCallback((message: string) => show(message, 'warning'), [show]);

  return { toast, hide, show, success, error, info, warning };
}
