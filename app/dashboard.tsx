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

interface HourlyStat {
  hour_of_day: number;
  order_count: number;
  total_revenue: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const { toast, hide, success: toastSuccess } = useToast();
  const [filter, setFilter] = useState<TimeFilter>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Year Selection state for Year view
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1); // 1 - 12

  // Data states
  const [yearlyData, setYearlyData] = useState<MonthBarData[]>([]);
  const [monthlyDayDetails, setMonthlyDayDetails] = useState<DayDetailData[]>([]);
  const [rawOrders, setRawOrders] = useState<OrderExportData[]>([]);

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
  const [hourlyStats, setHourlyStats] = useState<HourlyStat[]>([]);

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
        let query = supabase
          .from('orders')
          .select('*')
          .eq('status', 'paid');

        if (filter === 'today') {
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          query = query.gte('paid_at', startOfDay.toISOString());
        } else if (filter === 'week') {
          const startOfWeek = new Date();
          startOfWeek.setDate(now.getDate() - 7);
          query = query.gte('paid_at', startOfWeek.toISOString());
        } else if (filter === 'month') {
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          query = query.gte('paid_at', startOfMonth.toISOString());
        }

        const { data: paidOrders, error: ordersError } = await query;
        if (ordersError) throw ordersError;

        const orders = paidOrders || [];
        setRawOrders(orders as OrderExportData[]);

        // Calculate totals
        let totalRev = 0;
        let cashRev = 0;
        let transferRev = 0;
        let takeawayRev = 0;
        let dineInRev = 0;
        let takeawayCnt = 0;
        let dineInCnt = 0;

        orders.forEach((o) => {
          const amt = Number(o.total_amount || 0);
          totalRev += amt;

          if (o.payment_method === 'cash') {
            cashRev += amt;
          } else {
            transferRev += amt;
          }

          if (o.order_type === 'takeaway') {
            takeawayRev += amt;
            takeawayCnt += 1;
          } else {
            dineInRev += amt;
            dineInCnt += 1;
          }
        });

        // Growth calculation for Month view
        let prevRev = 0;
        let calculatedGrowth: number | null = null;

        if (filter === 'month') {
          const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

          const { data: prevOrders } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('status', 'paid')
            .gte('paid_at', startOfPrevMonth.toISOString())
            .lt('paid_at', startOfCurrentMonth.toISOString());

          if (prevOrders && prevOrders.length > 0) {
            prevRev = prevOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
            if (prevRev > 0) {
              calculatedGrowth = Math.round(((totalRev - prevRev) / prevRev) * 100 * 10) / 10;
            } else if (totalRev > 0) {
              calculatedGrowth = 100;
            }
          }
        }

        setStats({
          totalRevenue: totalRev,
          totalOrders: orders.length,
          cashRevenue: cashRev,
          transferRevenue: transferRev,
          takeawayRevenue: takeawayRev,
          dineInRevenue: dineInRev,
          takeawayCount: takeawayCnt,
          dineInCount: dineInCnt,
          prevMonthRevenue: prevRev,
          growthPercent: calculatedGrowth,
        });

        // ── TOP SẢN PHẨM BÁN CHẠY ───────────────────────────────────────────
        fetchTopProducts(orders.map((o) => o.id));

        // ── THỐNG KÊ THEO KHUNG GIỜ ──────────────────────────────────────────
        calculateHourlyStats(orders);
      }
    } catch (err: any) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch 12 months RPC + detail RPC for year view
  const fetchYearlyDataAndMonthDetail = async () => {
    try {
      // 1. Call RPC revenue_by_year(target_year)
      const { data: yearRes, error: yearErr } = await supabase.rpc('revenue_by_year', {
        target_year: selectedYear,
      });

      let full12Months: MonthBarData[] = Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        revenue: 0,
        order_count: 0,
      }));

      if (yearRes && yearRes.length > 0) {
        yearRes.forEach((row: any) => {
          const idx = row.month - 1;
          if (idx >= 0 && idx < 12) {
            full12Months[idx].revenue = Number(row.revenue || 0);
            full12Months[idx].order_count = Number(row.order_count || 0);
          }
        });
      }
      setYearlyData(full12Months);

      // 2. Call RPC revenue_detail_by_month(target_year, target_month)
      const { data: monthRes } = await supabase.rpc('revenue_detail_by_month', {
        target_year: selectedYear,
        target_month: selectedMonth,
      });

      if (monthRes) {
        setMonthlyDayDetails(
          monthRes.map((r: any) => ({
            day: r.day,
            revenue: Number(r.revenue || 0),
            order_count: Number(r.order_count || 0),
          }))
        );
      } else {
        setMonthlyDayDetails([]);
      }
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

  const calculateHourlyStats = (orders: any[]) => {
    const hoursArr: HourlyStat[] = Array.from({ length: 24 }, (_, i) => ({
      hour_of_day: i,
      order_count: 0,
      total_revenue: 0,
    }));

    orders.forEach((o) => {
      const paidDate = o.paid_at ? new Date(o.paid_at) : new Date(o.created_at);
      const h = paidDate.getHours();
      hoursArr[h].order_count += 1;
      hoursArr[h].total_revenue += Number(o.total_amount || 0);
    });

    setHourlyStats(hoursArr.filter((h) => h.order_count > 0));
  };

  const formatVND = (amount: number) => amount.toLocaleString('vi-VN') + 'đ';

  const maxYearlyRev = Math.max(...yearlyData.map((d) => d.revenue), 1);
  const maxTopSold = Math.max(...topProducts.map((p) => p.total_sold), 1);

  const getFilterTitle = () => {
    if (filter === 'today') return 'Hôm nay';
    if (filter === 'week') return 'Tuần này';
    if (filter === 'month') return 'Tháng này';
    return `Năm ${selectedYear}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Background Blobs */}
      <View style={styles.blob1} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity id="btn-back-dashboard" onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Quay lại</Text>
          </TouchableOpacity>

          <View style={styles.headerRightBtns}>
            <TouchableOpacity
              id="btn-goto-history"
              style={styles.historyNavBtn}
              onPress={() => router.push('/orders-history' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.historyNavText}>📜 Lịch sử đơn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              id="btn-export-csv"
              style={styles.exportCsvBtn}
              onPress={() => exportRevenueToCsv(rawOrders, getFilterTitle())}
              activeOpacity={0.8}
            >
              <Text style={styles.exportCsvText}>Xuất Excel/CSV</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.title}>📊 Báo cáo doanh thu</Text>
        <Text style={styles.subtitle}>Thống kê kinh doanh Chúc Chúc</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          id="btn-filter-today"
          style={[styles.filterChip, filter === 'today' && styles.filterChipActive]}
          onPress={() => setFilter('today')}
        >
          <Text style={[styles.filterText, filter === 'today' && styles.filterTextActive]}>Hôm nay</Text>
        </TouchableOpacity>
        <TouchableOpacity
          id="btn-filter-week"
          style={[styles.filterChip, filter === 'week' && styles.filterChipActive]}
          onPress={() => setFilter('week')}
        >
          <Text style={[styles.filterText, filter === 'week' && styles.filterTextActive]}>Tuần này</Text>
        </TouchableOpacity>
        <TouchableOpacity
          id="btn-filter-month"
          style={[styles.filterChip, filter === 'month' && styles.filterChipActive]}
          onPress={() => setFilter('month')}
        >
          <Text style={[styles.filterText, filter === 'month' && styles.filterTextActive]}>Tháng này</Text>
        </TouchableOpacity>
        <TouchableOpacity
          id="btn-filter-year"
          style={[styles.filterChip, filter === 'year' && styles.filterChipActive]}
          onPress={() => setFilter('year')}
        >
          <Text style={[styles.filterText, filter === 'year' && styles.filterTextActive]}>Theo năm 📅</Text>
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
          {filter === 'year' ? (
            /* ── CHART VẼ 12 THÁNG TRONG NĂM (YEARLY BAR CHART) ────────────────── */
            <View style={styles.yearChartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>Doanh thu 12 tháng năm {selectedYear}</Text>
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

              {/* 12-Month Bar Chart */}
              <View style={styles.barChartContainer}>
                {yearlyData.map((item) => {
                  const barHeightPct = (item.revenue / maxYearlyRev) * 100;
                  const isSelected = item.month === selectedMonth;

                  return (
                    <TouchableOpacity
                      key={item.month}
                      style={styles.barCol}
                      onPress={() => setSelectedMonth(item.month)}
                    >
                      <Text style={styles.barValueLabel}>
                        {item.revenue > 0 ? `${Math.round(item.revenue / 1000)}k` : ''}
                      </Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { height: `${Math.max(barHeightPct, 4)}%` },
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
                  <Text style={styles.emptyText}>Tháng này chưa có đơn hàng nào.</Text>
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
          ) : (
            /* ── CHẾ ĐỘ XEM NGÀY / TUẦN / THÁNG ────────────────────────────────── */
            <>
              {/* Summary Total Card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryTop}>
                  <View>
                    <Text style={styles.summaryLabel}>TỔNG DOANH THU ({getFilterTitle().toUpperCase()})</Text>
                    <Text style={styles.summaryRevenue}>{formatVND(stats.totalRevenue)}</Text>
                  </View>
                  <View style={styles.orderCountBadge}>
                    <Text style={styles.orderCountNum}>{stats.totalOrders}</Text>
                    <Text style={styles.orderCountLabel}>đơn hàng</Text>
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
                      {stats.growthPercent}% so với tháng trước ({formatVND(stats.prevMonthRevenue)})
                    </Text>
                  </View>
                )}

                <View style={styles.summaryDivider} />

                <View style={styles.avgRow}>
                  <Text style={styles.avgLabel}>Giá trị trung bình / đơn:</Text>
                  <Text style={styles.avgValue}>
                    {stats.totalOrders > 0
                      ? formatVND(Math.round(stats.totalRevenue / stats.totalOrders))
                      : '0đ'}
                  </Text>
                </View>
              </View>

              {/* Payment Methods Split */}
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

              {/* Order Type Split (Takeaway vs Dine-in) */}
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

              {/* Top Selling Products */}
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

              {/* Peak Hours Breakdown */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>⏰ Giờ cao điểm (Theo khung giờ)</Text>
                {hourlyStats.length === 0 ? (
                  <Text style={styles.emptyText}>Chưa có đơn hàng trong khoảng thời gian này.</Text>
                ) : (
                  hourlyStats.map((h) => (
                    <View key={h.hour_of_day} style={styles.hourRow}>
                      <Text style={styles.hourTime}>{h.hour_of_day}:00 - {h.hour_of_day + 1}:00</Text>
                      <Text style={styles.hourOrders}>{h.order_count} đơn</Text>
                      <Text style={styles.hourRev}>{formatVND(h.total_revenue)}</Text>
                    </View>
                  ))
                )}
              </View>
            </>
          )}
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  backBtn: {},
  backText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: COLORS.primary },
  headerRightBtns: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  historyNavBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  historyNavText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.primaryDeep },
  exportCsvBtn: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  exportCsvText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: COLORS.primary },

  title: { fontFamily: 'Nunito_700Bold', fontSize: 24, color: COLORS.textPrimary, marginBottom: 2 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: COLORS.textSecondary },

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
