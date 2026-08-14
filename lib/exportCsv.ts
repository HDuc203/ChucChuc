import { Alert, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export interface OrderExportData {
  id: string;
  created_at: string;
  paid_at?: string;
  order_type: string;
  payment_method?: string;
  total_amount: number;
  status: string;
}

export const exportRevenueToCsv = async (
  orders: OrderExportData[],
  periodTitle: string = 'Doanh_Thu'
) => {
  try {
    if (!orders || orders.length === 0) {
      Alert.alert('Không có dữ liệu', 'Không có đơn hàng nào trong khoảng thời gian này để xuất báo cáo.');
      return;
    }

    // UTF-8 BOM so Excel opens Vietnamese characters seamlessly
    let csvContent = '\uFEFFMã đơn,Ngày thanh toán,Loại đơn,Phương thức,Tổng tiền (VND),Trạng thái\n';

    orders.forEach((o) => {
      const dateStr = o.paid_at
        ? new Date(o.paid_at).toLocaleString('vi-VN')
        : new Date(o.created_at).toLocaleString('vi-VN');
      const typeStr = o.order_type === 'takeaway' ? 'Mang về' : 'Tại bàn';
      let payStr = 'Tiền mặt';
      if (o.payment_method === 'transfer') payStr = 'Chuyển khoản';
      if (o.payment_method === 'qr') payStr = 'Mã QR';

      const shortId = o.id.substring(0, 8);
      const amount = o.total_amount || 0;
      const statusStr = o.status === 'paid' ? 'Đã thanh toán' : o.status;

      csvContent += `"${shortId}","${dateStr}","${typeStr}","${payStr}",${amount},"${statusStr}"\n`;
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `BaoCao_ChucChuc_${periodTitle}_${timestamp}.csv`;

    if (Platform.OS === 'web') {
      // WEB DOWNLOAD IMPLEMENTATION (HTML5 Blob)
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // MOBILE NATIVE IMPLEMENTATION (iOS / Android)
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Xuất Báo Cáo Doanh Thu Chúc Chúc (${periodTitle})`,
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Đã tạo file báo cáo', `File đã lưu tại: ${fileUri}`);
      }
    }
  } catch (err: any) {
    console.error('Export CSV error:', err);
    Alert.alert('Lỗi xuất báo cáo', err?.message || 'Không thể tạo file báo cáo Excel/CSV.');
  }
};
