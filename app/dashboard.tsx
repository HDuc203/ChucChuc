import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { COLORS } from '../constants/colors';
import { exportRevenueToCsv, OrderExportData } from '../lib/exportCsv';
import { formatVND } from '../utils/format';
import Toast from '../components/Toast';
import { useToast } from '../hooks/useToast';

const { width } = Dimensions.get('window');

type TimeFilter = 'today' | 'week' | 'month' | 'year';

interface RevenueStats {
  totalRevenue: number;
  totalOrders: number;
  cashRevenue: number;
  transferRevenue: number;
  takeawayRevenue: number;
  dineInRevenue: number;
  takeawayCount: number;
  dineInCount: number;
  prevMonthRevenue: number;
  growthPercent: number | null;
}

interface MonthBarData {
  month: number;
  revenue: number;
  expense: number;
  profit: number;
  order_count: number;
}

interface DayDetailData {
  day: number;
  revenue: number;
  order_count: number;
}

interface TopProduct {
  id: string;
  name: string;
  total_sold: number;
  total_revenue: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { toast, hide, success: toastSuccess } = useToast();
  const [filter, setFilter] = useState<TimeFilter>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Chart Mode Toggle: 'revenue' | 'profit' | 'expense'
  const [chartMode, setChartMode] = useState<'revenue' | 'profit' | 'expense'>('revenue');

  // Year Selection state for Year view
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1 - 12

  // Data states
  const [yearlyData, setYearlyData] = useState<MonthBarData[]>([]);
  const [monthlyDayDetails, setMonthlyDayDetails] = useState<DayDetailData[]>([]);
  const [rawOrders, setRawOrders] = useState<OrderExportData[]>([]);
  const [totalExpense, setTotalExpense] = useState<number>(0);

  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    totalOrders: 0,
    cashRevenue: 0,
    transferRevenue: 0,
    takeawayRevenue: 0,
    dineInRevenue: 0,
    takeawayCount: 0,
    dineInCount: 0,
    prevMonthRevenue: 0,
    growthPercent: null,
  });

  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  useEffect(() => {
    fetchReportData();
  }, [filter, selectedYear, selectedMonth]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchReportData();
    setRefreshing(false);
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const now = new Date();

      if (filter === 'year') {
        // ── BIỂU ĐỒ NĂM (YEARLY BAR CHART) ─────────────────────────────────
        await fetchYearlyDataAndMonthDetail();
      } else {
        // ── THỐNG KÊ NGÀY / TUẦN / THÁNG ────────────────────────────────────
        let totalRev = 0;
        let cashRev = 0;
        let transferRev = 0;
        let takeawayRev = 0;
        let dineInRev = 0;
        let takeawayCnt = 0;
        let dineInCnt = 0;
        let totalOrdersCount = 0;
        let totalExp = 0;

        let query = supabase
          .from('orders')
          .select('*')
          .eq('status', 'paid');

        let startDateStr = '';
        let endDateStr = now.toISOString().split('T')[0];

        if (filter === 'today') {
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          query = query.gte('paid_at', startOfDay.toISOString());
          startDateStr = now.toISOString().split('T')[0];
          endDateStr = startDateStr;
        } else if (filter === 'week') {
          // Tính từ Thứ 2 đầu tuần hiện tại (00:00:00) đến hiện tại -> Mỗi Thứ 2 sẽ tự động reset
          const dayOfWeek = now.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
          const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - distanceToMonday, 0, 0, 0, 0);
          query = query.gte('paid_at', startOfWeek.toISOString());
          startDateStr = startOfWeek.toISOString().split('T')[0];
        } else if (filter === 'month') {
          // Tính từ ngày 1 đầu tháng hiện tại (00:00:00) đến hiện tại -> Ngày 1 hàng tháng sẽ tự động reset
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
          query = query.gte('paid_at', startOfMonth.toISOString());
          startDateStr = startOfMonth.toISOString().split('T')[0];
        }

        const { data: paidOrders } = await query;
        const orders = paidOrders || [];
        setRawOrders(orders as OrderExportData[]);

        const { data: summaryRows } = await supabase
          .from('daily_summaries')
          .select('*')
          .gte('day', startDateStr)
          .lte('day', endDateStr);

        if (summaryRows && summaryRows.length > 0 && filter !== 'today') {
          // Use permanent aggregated daily summaries
          summaryRows.forEach((row) => {
            totalRev += Number(row.total_revenue || 0);
            totalOrdersCount += Number(row.total_orders || 0);
            cashRev += Number(row.cash_revenue || 0);
            transferRev += Number(row.transfer_revenue || 0);
            takeawayRev += Number(row.takeaway_revenue || 0);
            dineInRev += Number(row.dine_in_revenue || 0);
            totalExp += Number(row.total_expense || 0);
          });
        } else {
          // Compute directly from orders list
          orders.forEach((o) => {
            const amt = Number(o.total_amount || 0);
            totalRev += amt;
            if (o.payment_method === 'cash') cashRev += amt;
            else transferRev += amt;
            if (o.order_type === 'takeaway') {
              takeawayRev += amt;
              takeawayCnt += 1;
            } else {
              dineInRev += amt;
              dineInCnt += 1;
            }
          });
          totalOrdersCount = orders.length;

          // Fetch expenses directly
          let expQuery = supabase.from('expenses').select('amount, expense_date');
          if (filter === 'today') {
            expQuery = expQuery.gte('expense_date', startDateStr);
          } else if (filter === 'week') {
            expQuery = expQuery.gte('expense_date', startDateStr);
          } else if (filter === 'month') {
            expQuery = expQuery.gte('expense_date', startDateStr);
          }
          const { data: expData } = await expQuery;
          totalExp = (expData || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
        }

        // Growth calculation for Month view (pull from permanent daily_summaries or orders)
        let prevRev = 0;
        let calculatedGrowth: number | null = null;

        if (filter === 'month') {
          const startOfPrevMonthStr = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
          const endOfPrevMonthStr = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

          const { data: prevSummaries } = await supabase
            .from('daily_summaries')
            .select('total_revenue')
            .gte('day', startOfPrevMonthStr)
            .lte('day', endOfPrevMonthStr);

          if (prevSummaries && prevSummaries.length > 0) {
            prevRev = prevSummaries.reduce((sum, r) => sum + Number(r.total_revenue || 0), 0);
          } else {
            const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const { data: prevOrders } = await supabase
              .from('orders')
              .select('total_amount')
              .eq('status', 'paid')
              .gte('paid_at', startOfPrevMonth.toISOString())
              .lt('paid_at', startOfCurrentMonth.toISOString());

            if (prevOrders && prevOrders.length > 0) {
              prevRev = prevOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
            }
          }

          if (prevRev > 0) {
            calculatedGrowth = Math.round(((totalRev - prevRev) / prevRev) * 100 * 10) / 10;
          } else if (totalRev > 0) {
            calculatedGrowth = 100;
          }
        }

        setTotalExpense(totalExp);
        setStats({
          totalRevenue: totalRev,
          totalOrders: totalOrdersCount,
          cashRevenue: cashRev,
          transferRevenue: transferRev,
          takeawayRevenue: takeawayRev,
          dineInRevenue: dineInRev,
          takeawayCount: takeawayCnt,
          dineInCount: dineInCnt,
          prevMonthRevenue: prevRev,
          growthPercent: calculatedGrowth,
        });

        // ── TOP SẢN PHẨM BÁN CHẠY (từ các đơn còn lưu) ──────────────────────
        fetchTopProducts(orders.map((o) => o.id));
      }
    } catch (err: any) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch 12 months data + detail for year view
  const fetchYearlyDataAndMonthDetail = async () => {
    try {
      const startOfYearStr = `${selectedYear}-01-01T00:00:00`;
      const endOfYearStr = `${selectedYear}-12-31T23:59:59`;
      const startOfYearDateOnly = `${selectedYear}-01-01`;
      const endOfYearDateOnly = `${selectedYear}-12-31`;

      // 1. Fetch all orders, daily summaries, and expenses for this year in parallel
      const [ordersRes, summariesRes, expRes] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .eq('status', 'paid')
          .gte('paid_at', startOfYearStr)
          .lte('paid_at', endOfYearStr),
        supabase
          .from('daily_summaries')
          .select('*')
          .gte('day', startOfYearDateOnly)
          .lte('day', endOfYearDateOnly),
        supabase
          .from('expenses')
          .select('*')
          .gte('expense_date', startOfYearDateOnly)
          .lte('expense_date', endOfYearDateOnly),
      ]);

      const paidOrders = ordersRes.data || [];
      const summaries = summariesRes.data || [];
      const expensesList = expRes.data || [];

      setRawOrders(paidOrders as OrderExportData[]);

      // Initialize 12 months array
      const full12Months: MonthBarData[] = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        revenue: 0,
        expense: 0,
        profit: 0,
        order_count: 0,
      }));

      // Group expenses by month
      const expMap: Record<number, number> = {};
      let yearlyTotalExpSum = 0;
      expensesList.forEach((e) => {
        const m = new Date(e.expense_date).getMonth() + 1;
        const amt = Number(e.amount || 0);
        expMap[m] = (expMap[m] || 0) + amt;
        yearlyTotalExpSum += amt;
      });

      // Group daily revenue and order counts (merge daily_summaries and live orders)
      const dayMap: Record<string, { revenue: number; order_count: number }> = {};

      // 1. Populate from daily_summaries first
      summaries.forEach((s) => {
        dayMap[s.day] = {
          revenue: Number(s.total_revenue || 0),
          order_count: Number(s.total_orders || 0),
        };
      });

      // 2. Add or overlay orders from orders table for days not yet in daily_summaries
      paidOrders.forEach((o) => {
        if (!o.paid_at) return;
        const dStr = o.paid_at.split('T')[0];
        if (!dayMap[dStr]) {
          dayMap[dStr] = { revenue: 0, order_count: 0 };
        }
        if (!summaries.some((s) => s.day === dStr)) {
          dayMap[dStr].revenue += Number(o.total_amount || 0);
          dayMap[dStr].order_count += 1;
        }
      });

      let yearlyCashRev = 0;
      let yearlyTransferRev = 0;
      let yearlyTakeawayRev = 0;
      let yearlyDineInRev = 0;
      let yearlyTakeawayCount = 0;
      let yearlyDineInCount = 0;

      paidOrders.forEach((o) => {
        const amt = Number(o.total_amount || 0);
        if (o.payment_method === 'cash') yearlyCashRev += amt;
        else yearlyTransferRev += amt;
        if (o.order_type === 'takeaway') {
          yearlyTakeawayRev += amt;
          yearlyTakeawayCount += 1;
        } else {
          yearlyDineInRev += amt;
          yearlyDineInCount += 1;
        }
      });

      // Distribute into 12 months
      Object.keys(dayMap).forEach((dStr) => {
        const d = new Date(dStr);
        if (d.getFullYear() === selectedYear) {
          const m = d.getMonth() + 1;
          const idx = m - 1;
          if (idx >= 0 && idx < 12) {
            full12Months[idx].revenue += dayMap[dStr].revenue;
            full12Months[idx].order_count += dayMap[dStr].order_count;
          }
        }
      });

      let yearlyTotalRevSum = 0;
      let yearlyTotalOrdersCount = 0;

      full12Months.forEach((m) => {
        const exp = expMap[m.month] || 0;
        m.expense = exp;
        m.profit = m.revenue - exp;
        yearlyTotalRevSum += m.revenue;
        yearlyTotalOrdersCount += m.order_count;
      });

      setTotalExpense(yearlyTotalExpSum);
      setYearlyData(full12Months);

      setStats({
        totalRevenue: yearlyTotalRevSum,
        totalOrders: yearlyTotalOrdersCount,
        cashRevenue: yearlyCashRev,
        transferRevenue: yearlyTransferRev,
        takeawayRevenue: yearlyTakeawayRev,
        dineInRevenue: yearlyDineInRev,
        takeawayCount: yearlyTakeawayCount,
        dineInCount: yearlyDineInCount,
        prevMonthRevenue: 0,
        growthPercent: null,
      });

      // 3. Compute daily details for selectedMonth (e.g. Month 8)
      const daysInSelectedMonth: Record<number, { revenue: number; order_count: number }> = {};
      Object.keys(dayMap).forEach((dStr) => {
        const d = new Date(dStr);
        if (d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth) {
          const dayNum = d.getDate();
          daysInSelectedMonth[dayNum] = dayMap[dStr];
        }
      });

      const dayDetailsList = Object.keys(daysInSelectedMonth)
        .map((dayStr) => ({
          day: Number(dayStr),
          revenue: daysInSelectedMonth[Number(dayStr)].revenue,
          order_count: daysInSelectedMonth[Number(dayStr)].order_count,
        }))
        .sort((a, b) => a.day - b.day);

      setMonthlyDayDetails(dayDetailsList);

      // Top products for the year
      fetchTopProducts(paidOrders.map((o) => o.id));
    } catch (err) {
      console.error('Yearly analytics error:', err);
    }
  };

  const fetchTopProducts = async (orderIds: string[]) => {
    if (orderIds.length === 0) {
      setTopProducts([]);
      return;
    }

    try {
      const { data: items, error } = await supabase
        .from('order_items')
        .select('product_id, quantity, unit_price, products(name)')
        .in('order_id', orderIds);

      if (error) throw error;

      const productMap: Record<string, TopProduct> = {};

      (items || []).forEach((item: any) => {
        const pId = item.product_id;
        const name = item.products?.name || 'Món khác';
        const qty = Number(item.quantity || 0);
        const price = Number(item.unit_price || 0);

        if (!productMap[pId]) {
          productMap[pId] = {
            id: pId,
            name: name,
            total_sold: 0,
            total_revenue: 0,
          };
        }
        productMap[pId].total_sold += qty;
        productMap[pId].total_revenue += qty * price;
      });

      const sortedList = Object.values(productMap)
        .sort((a, b) => b.total_sold - a.total_sold)
        .slice(0, 5);

      setTopProducts(sortedList);
    } catch (err) {
      console.error('Error fetching top products:', err);
    }
  };

  const formatVND = (amount: number) => amount.toLocaleString('vi-VN') + 'đ';

  const maxYearlyRev = Math.max(...yearlyData.map((d) => d.revenue), 1);
  const maxTopSold = Math.max(...topProducts.map((p) => p.total_sold), 1);

  const getFilterTitle = () => {
    if (filter === 'today') return 'Theo ngày';
    if (filter === 'week') return 'Theo tuần';
    if (filter === 'month') return 'Theo tháng';
    return `Năm ${selectedYear}`;
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
      {/* Background Blobs */}
      <View style={styles.blob1} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity id="btn-back-dashboard" onPress={handleBack} style={styles.backBtn}>
            <Text style={styles.backText}>← Quay lại</Text>
          </TouchableOpacity>

          <TouchableOpacity
            id="btn-export-csv"
            style={styles.exportCsvBtn}
            onPress={() => exportRevenueToCsv(rawOrders, getFilterTitle())}
            activeOpacity={0.8}
          >
            <Text style={styles.exportCsvText}>📥 Xuất Excel</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>📊 Báo cáo doanh thu & Lợi nhuận</Text>
        <Text style={styles.subtitle}>Thống kê kinh doanh Chúc Chúc</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          id="btn-filter-today"
          style={[styles.filterChip, filter === 'today' && styles.filterChipActive]}
          onPress={() => setFilter('today')}
        >
          <Text style={[styles.filterText, filter === 'today' && styles.filterTextActive]}>Theo ngày</Text>
        </TouchableOpacity>
        <TouchableOpacity
          id="btn-filter-week"
          style={[styles.filterChip, filter === 'week' && styles.filterChipActive]}
          onPress={() => setFilter('week')}
        >
          <Text style={[styles.filterText, filter === 'week' && styles.filterTextActive]}>Theo tuần</Text>
        </TouchableOpacity>
        <TouchableOpacity
          id="btn-filter-month"
          style={[styles.filterChip, filter === 'month' && styles.filterChipActive]}
          onPress={() => setFilter('month')}
        >
          <Text style={[styles.filterText, filter === 'month' && styles.filterTextActive]}>Theo tháng</Text>
        </TouchableOpacity>
        <TouchableOpacity
          id="btn-filter-year"
          style={[styles.filterChip, filter === 'year' && styles.filterChipActive]}
          onPress={() => setFilter('year')}
        >
          <Text style={[styles.filterText, filter === 'year' && styles.filterTextActive]}>Theo năm</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
          {/* 1. Summary Total Card with Revenue, Expenses & Profit Breakdown */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>BÁO CÁO KINH DOANH ({getFilterTitle().toUpperCase()})</Text>

            <View style={styles.profitBreakdownBox}>
              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>Doanh thu:</Text>
                <Text style={styles.profitRevValue}>{formatVND(stats.totalRevenue)}</Text>
              </View>

              <View style={styles.profitRow}>
                <Text style={styles.profitLabel}>Chi phí:</Text>
                <Text style={styles.profitExpValue}>- {formatVND(totalExpense)}</Text>
              </View>

              <View style={styles.profitDivider} />

              <View style={styles.profitRow}>
                <Text style={styles.profitTotalLabel}>Lợi nhuận thực tế:</Text>
                <View style={styles.profitBadgeWrap}>
                  <Text
                    style={[
                      styles.profitTotalValue,
                      stats.totalRevenue - totalExpense >= 0 ? styles.textProfit : styles.textLoss,
                    ]}
                  >
                    {formatVND(stats.totalRevenue - totalExpense)}
                  </Text>
                  <Text style={styles.profitBadgeEmoji}>
                    {stats.totalRevenue - totalExpense >= 0 ? ' 🟢' : ' 🔴'}
                  </Text>
                </View>
              </View>
            </View>

            {/* MoM Growth badge (only in Month view) */}
            {filter === 'month' && stats.growthPercent !== null && (
              <View
                style={[
                  styles.growthBadge,
                  stats.growthPercent >= 0 ? styles.growthBadgeUp : styles.growthBadgeDown,
                ]}
              >
                <Text
                  style={[
                    styles.growthText,
                    stats.growthPercent >= 0 ? styles.growthTextUp : styles.growthTextDown,
                  ]}
                >
                  {stats.growthPercent >= 0 ? '▲ +' : '▼ '}
                  {stats.growthPercent}% doanh thu so với tháng trước ({formatVND(stats.prevMonthRevenue)})
                </Text>
              </View>
            )}
          </View>

          {/* 2. Dedicated Full-width Order Count Card */}
          <View style={styles.orderStatCard}>
            <View style={styles.orderStatLeft}>
              <View style={styles.orderStatIconBox}>
                <Text style={styles.orderStatEmoji}>🧾</Text>
              </View>
              <View>
                <Text style={styles.orderStatTitle}>Tổng số đơn hàng</Text>
                <Text style={styles.orderStatSub}>Đơn đã hoàn thành ({getFilterTitle()})</Text>
              </View>
            </View>
            <View style={styles.orderStatRight}>
              <Text style={styles.orderStatNumber}>{stats.totalOrders}</Text>
              <Text style={styles.orderStatUnit}>đơn hàng</Text>
            </View>
          </View>

          {/* 2. 12-Month Bar Chart & Month Drilldown (Only in Year filter) */}
          {filter === 'year' && (
            <View style={styles.yearChartCard}>
              <View style={styles.chartHeader}>
                <View>
                  <Text style={styles.chartTitle}>Phân tích 12 tháng năm {selectedYear}</Text>
                  <Text style={styles.chartSubTitle}>Chạm vào cột tháng để xem chi tiết</Text>
                </View>

                <View style={styles.yearPickerRow}>
                  <TouchableOpacity
                    style={styles.yearPickBtn}
                    onPress={() => setSelectedYear((y) => y - 1)}
                  >
                    <Text style={styles.yearPickBtnText}>◀</Text>
                  </TouchableOpacity>
                  <Text style={styles.yearPickLabel}>{selectedYear}</Text>
                  <TouchableOpacity
                    style={styles.yearPickBtn}
                    onPress={() => setSelectedYear((y) => y + 1)}
                  >
                    <Text style={styles.yearPickBtnText}>▶</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Chart Mode Toggle */}
              <View style={styles.chartModeRow}>
                <TouchableOpacity
                  style={[styles.chartModeBtn, chartMode === 'revenue' && styles.chartModeBtnActiveRev]}
                  onPress={() => setChartMode('revenue')}
                >
                  <Text style={[styles.chartModeText, chartMode === 'revenue' && styles.chartModeTextActive]}>
                    📊 Doanh thu
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chartModeBtn, chartMode === 'profit' && styles.chartModeBtnActiveProf]}
                  onPress={() => setChartMode('profit')}
                >
                  <Text style={[styles.chartModeText, chartMode === 'profit' && styles.chartModeTextActive]}>
                    📈 Lợi nhuận
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.chartModeBtn, chartMode === 'expense' && styles.chartModeBtnActiveExp]}
                  onPress={() => setChartMode('expense')}
                >
                  <Text style={[styles.chartModeText, chartMode === 'expense' && styles.chartModeTextActive]}>
                    💸 Chi phí
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 12-Month Bar Chart */}
              <View style={styles.barChartContainer}>
                {yearlyData.map((item) => {
                  const val = chartMode === 'revenue' ? item.revenue : chartMode === 'profit' ? Math.max(item.profit, 0) : item.expense;
                  const maxVal = Math.max(...yearlyData.map((d) => chartMode === 'revenue' ? d.revenue : chartMode === 'profit' ? Math.max(d.profit, 0) : d.expense), 1);
                  const barHeightPct = (val / maxVal) * 100;
                  const isSelected = item.month === selectedMonth;

                  const barFillBg = chartMode === 'profit' ? '#10B981' : chartMode === 'expense' ? '#EF4444' : COLORS.primary;

                  return (
                    <TouchableOpacity
                      key={item.month}
                      style={styles.barCol}
                      onPress={() => setSelectedMonth(item.month)}
                    >
                      <Text style={styles.barValueLabel}>
                        {val > 0 ? `${Math.round(val / 1000)}k` : ''}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${Math.max(barHeightPct, 4)}%`, backgroundColor: barFillBg },
                            isSelected && styles.barFillSelected,
                          ]}
                        />
                      </View>
                      <Text style={[styles.barMonthLabel, isSelected && styles.barMonthLabelSelected]}>
                        T{item.month}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Drill-down panel for selected month */}
              <View style={styles.monthDetailCard}>
                <Text style={styles.monthDetailTitle}>
                  📅 Chi tiết từng ngày trong Tháng {selectedMonth}/{selectedYear}
                </Text>
                {monthlyDayDetails.length === 0 ? (
                  <Text style={styles.emptyText}>Tháng {selectedMonth} chưa có đơn hàng nào.</Text>
                ) : (
                  <View style={styles.dayGrid}>
                    {monthlyDayDetails.map((dayItem) => (
                      <View key={dayItem.day} style={styles.dayChip}>
                        <Text style={styles.dayChipTitle}>Ngày {dayItem.day}</Text>
                        <Text style={styles.dayChipRev}>{formatVND(dayItem.revenue)}</Text>
                        <Text style={styles.dayChipCnt}>{dayItem.order_count} đơn</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* 3. Payment Methods Split (All Filters) */}
          <View style={styles.splitRow}>
            <View style={[styles.splitCard, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.splitEmoji}>💵</Text>
              <Text style={styles.splitTitle}>Tiền mặt</Text>
              <Text style={styles.splitAmount}>{formatVND(stats.cashRevenue)}</Text>
              <Text style={styles.splitPct}>
                {stats.totalRevenue > 0
                  ? `${Math.round((stats.cashRevenue / stats.totalRevenue) * 100)}%`
                  : '0%'}
              </Text>
            </View>

            <View style={[styles.splitCard, { backgroundColor: '#F3E5F5' }]}>
              <Text style={styles.splitEmoji}>📲</Text>
              <Text style={styles.splitTitle}>Chuyển khoản / QR</Text>
              <Text style={styles.splitAmount}>{formatVND(stats.transferRevenue)}</Text>
              <Text style={styles.splitPct}>
                {stats.totalRevenue > 0
                  ? `${Math.round((stats.transferRevenue / stats.totalRevenue) * 100)}%`
                  : '0%'}
              </Text>
            </View>
          </View>

          {/* 4. Order Type Split (Takeaway vs Dine-in - All Filters) */}
          <View style={styles.splitRow}>
            <View style={[styles.splitCard, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.splitEmoji}>🛍️</Text>
              <Text style={styles.splitTitle}>Mang về</Text>
              <Text style={styles.splitAmount}>{formatVND(stats.takeawayRevenue)}</Text>
              <Text style={styles.splitPct}>{stats.takeawayCount} đơn hàng</Text>
            </View>

            <View style={[styles.splitCard, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.splitEmoji}>🪑</Text>
              <Text style={styles.splitTitle}>Tại bàn</Text>
              <Text style={styles.splitAmount}>{formatVND(stats.dineInRevenue)}</Text>
              <Text style={styles.splitPct}>{stats.dineInCount} đơn hàng</Text>
            </View>
          </View>

          {/* 5. Top Selling Products (All Filters) */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>🔥 Top món bán chạy nhất</Text>
            {topProducts.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có dữ liệu bán hàng trong kỳ này.</Text>
            ) : (
              topProducts.map((p, idx) => {
                const widthPct = (p.total_sold / maxTopSold) * 100;
                return (
                  <View key={p.id} style={styles.topProdRow}>
                    <Text style={styles.topRank}>#{idx + 1}</Text>
                    <View style={styles.topInfo}>
                      <View style={styles.topTitleRow}>
                        <Text style={styles.topName}>{p.name}</Text>
                        <Text style={styles.topSold}>{p.total_sold} món</Text>
                      </View>
                      <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${widthPct}%` }]} />
                          </View>
                          <Text style={styles.topRev}>{formatVND(p.total_revenue)}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
        </ScrollView>
      )}
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
    backgroundColor: '#FAF7F0',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1.5,
    borderColor: 'rgba(197, 160, 89, 0.35)',
    shadowColor: 'rgba(35, 70, 53, 0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 14,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
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
  exportCsvBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(197, 160, 89, 0.4)',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  exportCsvText: { fontFamily: 'Nunito_700Bold', fontSize: 12.5, color: '#234635' },

  title: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: '#234635', letterSpacing: 0.3, marginBottom: 3 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: '#657E70' },

  chartSubTitle: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textMuted },
  chartModeRow: { flexDirection: 'row', gap: 8, marginVertical: 10 },
  chartModeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  chartModeBtnActiveRev: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
  chartModeBtnActiveProf: { backgroundColor: '#DCFCE7', borderColor: '#10B981' },
  chartModeBtnActiveExp: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  chartModeText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textSecondary },
  chartModeTextActive: { fontFamily: 'Nunito_700Bold', color: COLORS.textPrimary },

  profitBreakdownBox: { marginTop: 10, gap: 4 },
  profitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profitLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, color: COLORS.textSecondary },
  profitRevValue: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.primaryDeep },
  profitExpValue: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.danger },
  profitDivider: { height: 1, backgroundColor: COLORS.divider, marginVertical: 4 },
  profitTotalLabel: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.textPrimary },
  profitBadgeWrap: { flexDirection: 'row', alignItems: 'center' },
  profitTotalValue: { fontFamily: 'Nunito_700Bold', fontSize: 18 },
  profitBadgeEmoji: { fontSize: 14 },
  textProfit: { color: '#16A34A' },
  textLoss: { color: '#DC2626' },

  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: COLORS.categoryInactive,
    alignItems: 'center',
  },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.categoryInactiveText },
  filterTextActive: { fontFamily: 'Nunito_700Bold', color: COLORS.white },

  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 14 },

  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  summaryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  summaryLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textSecondary, letterSpacing: 0.5 },
  summaryRevenue: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: COLORS.primary, marginTop: 4 },
  orderCountBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  orderCountNum: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: COLORS.primary },
  orderCountLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: COLORS.primary },

  growthBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  growthBadgeUp: { backgroundColor: '#E8F5E9' },
  growthBadgeDown: { backgroundColor: '#FFEBEE' },
  growthText: { fontFamily: 'Nunito_700Bold', fontSize: 12 },
  growthTextUp: { color: COLORS.primary },
  growthTextDown: { color: COLORS.danger },

  orderStatCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(62, 124, 93, 0.15)',
  },
  orderStatLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orderStatIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8E8DF',
  },
  orderStatEmoji: {
    fontSize: 22,
  },
  orderStatTitle: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  orderStatSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.textMuted,
  },
  orderStatRight: {
    alignItems: 'flex-end',
  },
  orderStatNumber: {
    fontFamily: 'Nunito_700Bold',
    fontSize: 22,
    color: COLORS.primaryDeep,
  },
  orderStatUnit: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  summaryDivider: { height: 1, backgroundColor: COLORS.divider, marginVertical: 14 },
  avgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avgLabel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textSecondary },
  avgValue: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.textPrimary },

  splitRow: { flexDirection: 'row', gap: 12 },
  splitCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
  },
  splitEmoji: { fontSize: 24, marginBottom: 4 },
  splitTitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 13, color: COLORS.textPrimary },
  splitAmount: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.textPrimary, marginVertical: 2 },
  splitPct: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textSecondary },

  sectionCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
    gap: 12,
  },
  sectionTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.textPrimary },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textMuted, fontStyle: 'italic' },

  topProdRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topRank: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: COLORS.primary, width: 24 },
  topInfo: { flex: 1 },
  topTitleRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  topName: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, color: COLORS.textPrimary },
  topSold: { fontFamily: 'Inter_500Medium', fontSize: 12, color: COLORS.textSecondary },
  progressTrack: { height: 8, backgroundColor: COLORS.background, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  topRev: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.primary, marginTop: 2, textAlign: 'right' },

  hourRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: COLORS.divider,
  },
  hourTime: { fontFamily: 'Inter_500Medium', fontSize: 13, color: COLORS.textPrimary },
  hourOrders: { fontFamily: 'Inter_400Regular', fontSize: 12, color: COLORS.textSecondary },
  hourRev: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: COLORS.primary },

  // Yearly chart styles
  yearChartCard: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 6,
    gap: 16,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chartTitle: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: COLORS.textPrimary },
  yearPickerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  yearPickBtn: { padding: 4 },
  yearPickBtnText: { color: COLORS.primary, fontSize: 12 },
  yearPickLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.textPrimary },

  barChartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 180,
    paddingTop: 20,
    gap: 4,
  },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValueLabel: { fontFamily: 'Inter_400Regular', fontSize: 9, color: COLORS.textMuted, marginBottom: 2 },
  barTrack: { width: 14, height: 120, backgroundColor: COLORS.background, borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: COLORS.primaryLight, borderRadius: 7 },
  barFillSelected: { backgroundColor: COLORS.primary },
  barMonthLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  barMonthLabelSelected: { fontFamily: 'Nunito_700Bold', color: COLORS.primary },

  monthDetailCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  monthDetailTitle: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: COLORS.textPrimary },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    width: (width - 80) / 3,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  dayChipTitle: { fontFamily: 'Inter_500Medium', fontSize: 11, color: COLORS.textSecondary },
  dayChipRev: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.primary, marginVertical: 2 },
  dayChipCnt: { fontFamily: 'Inter_400Regular', fontSize: 10, color: COLORS.textMuted },
});
