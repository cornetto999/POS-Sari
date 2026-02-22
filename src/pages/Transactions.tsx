import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Search, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Sale {
  id: string;
  payment_type: string;
  total: number;
  cash_received?: number;
  change_amount?: number;
  customer_id?: string;
  cashier_id: string;
  created_at: string;
}

interface SaleItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
}

export default function Transactions() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState<'all' | 'cash' | 'utang'>('all');
  const [selected, setSelected] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);

  useEffect(() => { fetchSales(); }, []);

  const fetchSales = async () => {
    const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false });
    setSales((data || []).map(s => ({ ...s, total: Number(s.total), cash_received: s.cash_received ? Number(s.cash_received) : undefined, change_amount: s.change_amount ? Number(s.change_amount) : undefined })));
  };

  const viewSale = async (sale: Sale) => {
    setSelected(sale);
    const { data } = await supabase.from('sale_items').select('*').eq('sale_id', sale.id);
    setSaleItems((data || []).map(si => ({ ...si, price: Number(si.price), total: Number(si.total) })));
  };

  const filtered = sales.filter(s => {
    const matchPayment = filterPayment === 'all' || s.payment_type === filterPayment;
    return matchPayment;
  });

  return (
    <div className="space-y-4 animate-slide-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search transactions..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1">
          {(['all', 'cash', 'utang'] as const).map(type => (
            <button key={type} onClick={() => setFilterPayment(type)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${filterPayment === type ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Date</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Total</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Payment</th>
                <th className="text-right p-3 font-medium text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No transactions yet</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-card-foreground">{new Date(s.created_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-3 text-right font-bold text-card-foreground">₱{s.total.toLocaleString()}</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.payment_type === 'cash' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                      {s.payment_type === 'cash' ? 'Cash' : 'Utang'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button onClick={() => viewSale(s)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"><Eye className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Sale Details</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleString('en-PH')}</p>
              <div className="space-y-1 border-b pb-3">
                {saleItems.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-foreground">{item.product_name} x{item.quantity}</span>
                    <span className="font-medium text-foreground">₱{item.total}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold text-foreground"><span>Total</span><span>₱{selected.total}</span></div>
              <div className="flex justify-between text-sm text-muted-foreground"><span>Payment</span><span className="capitalize">{selected.payment_type}</span></div>
              {selected.payment_type === 'cash' && selected.cash_received && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground"><span>Cash</span><span>₱{selected.cash_received}</span></div>
                  <div className="flex justify-between text-sm text-success"><span>Change</span><span>₱{selected.change_amount}</span></div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
