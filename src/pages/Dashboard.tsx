import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, ShoppingCart, Users, Package, AlertTriangle, DollarSign } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ todayTotal: 0, allTotal: 0, totalProfit: 0, totalReceivables: 0, productCount: 0, lowStockCount: 0 });
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const today = new Date().toISOString().split('T')[0];

    const [salesRes, productsRes, customersRes, saleItemsRes] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('products').select('*'),
      supabase.from('customers').select('*'),
      supabase.from('sale_items').select('*, products(cost_price)'),
    ]);

    const sales = salesRes.data || [];
    const products = productsRes.data || [];
    const saleItems = saleItemsRes.data || [];

    const todayTotal = sales.filter(s => s.created_at?.startsWith(today)).reduce((sum, s) => sum + Number(s.total), 0);
    const allTotal = sales.reduce((sum, s) => sum + Number(s.total), 0);
    const totalProfit = saleItems.reduce((sum, si) => {
      const cost = Number((si as any).products?.cost_price || 0);
      return sum + (Number(si.price) - cost) * si.quantity;
    }, 0);

    // Calculate total receivables from utang ledger
    const { data: utangData } = await supabase.from('utang_ledger').select('amount, type');
    const totalReceivables = (utangData || []).reduce((sum, u) => {
      return sum + (u.type === 'credit' ? Number(u.amount) : -Number(u.amount));
    }, 0);

    const lowStock = products.filter(p => p.stock_qty <= p.min_stock_level);

    setStats({ todayTotal, allTotal, totalProfit: Math.max(0, totalProfit), totalReceivables: Math.max(0, totalReceivables), productCount: products.length, lowStockCount: lowStock.length });
    setRecentSales(sales.slice(0, 5));
    setLowStockProducts(lowStock);
  };

  const statCards = [
    { label: "Today's Sales", value: `₱${stats.todayTotal.toLocaleString()}`, icon: ShoppingCart, color: 'text-primary' },
    { label: 'Total Sales', value: `₱${stats.allTotal.toLocaleString()}`, icon: TrendingUp, color: 'text-success' },
    { label: 'Est. Profit', value: `₱${stats.totalProfit.toLocaleString()}`, icon: DollarSign, color: 'text-accent' },
    { label: 'Total Utang', value: `₱${stats.totalReceivables.toLocaleString()}`, icon: Users, color: 'text-destructive' },
    { label: 'Products', value: stats.productCount.toString(), icon: Package, color: 'text-info' },
    { label: 'Low Stock', value: stats.lowStockCount.toString(), icon: AlertTriangle, color: 'text-warning' },
  ];

  return (
    <div className="space-y-6 animate-slide-in">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Magandang Araw! 👋</h1>
        <p className="text-muted-foreground text-sm">Here's your store overview for today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(stat => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-xl font-bold font-display text-card-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-display font-semibold text-card-foreground mb-4">Recent Sales</h3>
          <div className="space-y-3">
            {recentSales.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No sales yet. Start selling!</p>
            ) : recentSales.map(sale => (
              <div key={sale.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-card-foreground">Sale #{sale.id.slice(0, 8)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-card-foreground">₱{Number(sale.total).toLocaleString()}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sale.payment_type === 'cash' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {sale.payment_type === 'cash' ? 'Cash' : 'Utang'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border p-5">
          <h3 className="font-display font-semibold text-card-foreground mb-4">⚠️ Low Stock Alerts</h3>
          {lowStockProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">All products are well-stocked!</p>
          ) : (
            <div className="space-y-3">
              {lowStockProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{p.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-destructive">{p.stock_qty} left</p>
                    <p className="text-xs text-muted-foreground">Min: {p.min_stock_level}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
