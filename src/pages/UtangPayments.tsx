import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface CustomerBalance {
  id: string;
  full_name: string;
  contact_number?: string;
  balance: number;
}

export default function UtangPayments() {
  const [customers, setCustomers] = useState<CustomerBalance[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerBalance | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchBalances();
  }, []);

  const fetchBalances = async () => {
    const { data: custData, error: custError } = await supabase
      .from('customers')
      .select('id, full_name, contact_number')
      .order('full_name');
    if (custError) {
      toast({ title: custError.message, variant: 'destructive' });
      return;
    }

    const { data: utangData, error: utangError } = await supabase
      .from('utang_ledger')
      .select('customer_id, amount, type');
    if (utangError) {
      toast({ title: utangError.message, variant: 'destructive' });
      return;
    }

    const balances: Record<string, number> = {};
    (utangData || []).forEach((row) => {
      if (!balances[row.customer_id]) balances[row.customer_id] = 0;
      balances[row.customer_id] += row.type === 'credit' ? Number(row.amount) : -Number(row.amount);
    });

    const withBalance = (custData || [])
      .map((c) => ({
        ...c,
        balance: Math.max(0, balances[c.id] || 0),
      }))
      .filter((c) => c.balance > 0);

    setCustomers(withBalance);
  };

  const filtered = customers.filter((c) =>
    c.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  const handlePayment = async () => {
    if (!selected) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0 || amount > selected.balance) {
      toast({ title: 'Invalid payment amount', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('utang_ledger').insert({
      customer_id: selected.id,
      amount,
      type: 'payment',
      note: 'Payment received (Utang Payment page)',
      created_by: user?.id,
    });
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: `Payment saved: ₱${amount.toLocaleString()}` });
    setShowPayment(false);
    setPaymentAmount('');
    setSelected(null);
    fetchBalances();
  };

  const totalReceivables = customers.reduce((sum, c) => sum + c.balance, 0);

  return (
    <div className="space-y-4 animate-slide-in">
      <div className="stat-card">
        <p className="text-xs text-muted-foreground">Total Outstanding Utang</p>
        <p className="text-xl font-bold font-display text-destructive">₱{totalReceivables.toLocaleString()}</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card rounded-xl border p-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No customers with outstanding utang.</p>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div>
                <p className="text-sm font-medium text-card-foreground">{c.full_name}</p>
                {c.contact_number && <p className="text-xs text-muted-foreground">{c.contact_number}</p>}
              </div>
              <div className="text-right flex items-center gap-3">
                <p className="text-sm font-bold text-destructive">₱{c.balance.toLocaleString()}</p>
                <Button
                  size="sm"
                  onClick={() => {
                    setSelected(c);
                    setShowPayment(true);
                  }}
                >
                  <DollarSign className="w-4 h-4 mr-1" />
                  Pay
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Record Utang Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Customer: {selected?.full_name}</p>
            <p className="text-sm text-foreground">Balance: <span className="font-bold text-destructive">₱{selected?.balance.toLocaleString()}</span></p>
            <div>
              <label className="text-sm font-medium text-foreground">Amount</label>
              <Input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter payment amount..."
              />
            </div>
            <Button onClick={handlePayment} className="w-full">Save Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
