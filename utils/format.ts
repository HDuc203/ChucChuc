// Centralized price and number formatting for Chúc Chúc Coffee
// Always formats thousand separators with dot (.) e.g. 25.000đ, 100.000đ, 1.500.500đ

export const formatVND = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '0đ';
  const num = Math.round(Number(amount));
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
};

export const formatNumberDot = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(Number(amount))) return '0';
  const num = Math.round(Number(amount));
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const formatNumberInput = (val: string): string => {
  const raw = val.replace(/\D/g, '');
  if (!raw) return '';
  const num = parseInt(raw, 10);
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const parseNumberInput = (val: string): number => {
  const raw = val.replace(/\D/g, '');
  return parseInt(raw, 10) || 0;
};
