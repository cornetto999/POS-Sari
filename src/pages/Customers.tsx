import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, User, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  full_name: string;
  contact_number?: string;
  notes?: string;
  totalBalance: number;
}

interface UtangRecord {
  id: string;
  amount: number;
  type: string;
  note?: string;
  created_at: string;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [utangRecords, setUtangRecords] = useState<UtangRecord[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const { toast } = useToast();
  const { user, role } = useAuth();
  const [form, setForm] = useState({ fullName: '', contactNumber: '', notes: '' });

  useEffect(() => { fetchCustomers(); }, []);

  const fetchCustomers = async () => {
    const { data: custData } = await supabase.from('customers').select('*').order('full_name');
    const { data: utangData } = await supabase.from('utang_ledger').select('customer_id, amount, type');

    const balances: Record<string, number> = {};
    (utangData || []).forEach(u => {
      const id = u.customer_id;
      if (!balances[id]) balances[id] = 0;
      balances[id] += u.type === 'credit' ? Number(u.amount) : -Number(u.amount);
    });

    setCustomers((custData || []).map(c => ({ ...c, totalBalance: Math.max(0, balances[c.id] || 0) })));
  };

  const fetchUtang = async (customerId: string) => {
    const { data } = await supabase.from('utang_ledger').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
    setUtangRecords(data || []);
  };

  const selectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    fetchUtang(c.id);
  };

  const filtered = customers.filter(c => c.full_name.toLowerCase().includes(search.toLowerCase()));
  const totalReceivables = customers.reduce((s, c) => s + c.totalBalance, 0);
  const isAdmin = role === 'admin';

  const handleAddCustomer = async () => {
    if (!form.fullName) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('customers').insert({ full_name: form.fullName, contact_number: form.contactNumber || null, notes: form.notes || null });
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    setShowForm(false);
    setForm({ fullName: '', contactNumber: '', notes: '' });
    toast({ title: 'Customer added ✅' });
    fetchCustomers();
  };

  const handlePayment = async () => {
    const amount = Number(paymentAmount);
    if (!selectedCustomer || amount <= 0 || amount > selectedCustomer.totalBalance) {
      toast({ title: 'Invalid payment amount', variant: 'destructive' }); return;
    }
    const { error } = await supabase.from('utang_ledger').insert({
      customer_id: selectedCustomer.id,
      amount,
      type: 'payment',
      note: 'Payment received',
      created_by: user!.id,
    });
    if (error) { toast({ title: error.message, variant: 'destructive' }); return; }
    setShowPayment(false);
    setPaymentAmount('');
    toast({ title: `₱${amount} payment recorded ✅` });
    fetchCustomers();
    fetchUtang(selectedCustomer.id);
    setSelectedCustomer(prev => prev ? { ...prev, totalBalance: prev.totalBalance - amount } : null);
  };

  return (
    <div className="space-y-4 animate-slide-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="stat-card flex-1 min-w-[150px]">
          <p className="text-xs text-muted-foreground">Total Receivables</p>
          <p className="text-xl font-bold font-display text-destructive">₱{totalReceivables.toLocaleString()}</p>
        </div>
        <div className="stat-card flex-1 min-w-[150px]">
          <p className="text-xs text-muted-foreground">Customers</p>
          <p className="text-xl font-bold font-display text-card-foreground">{customers.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {isAdmin && (
          <Button onClick={() => { setForm({ fullName: '', contactNumber: '', notes: '' }); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Add Customer
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border p-4 space-y-2">
          <h3 className="font-display font-semibold text-card-foreground mb-3">Customers</h3>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No customers yet</p>
          ) : filtered.map(c => (
            <button key={c.id} onClick={() => selectCustomer(c)} className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${selectedCustomer?.id === c.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'}`}>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">{c.full_name}</p>
                {c.contact_number && <p className="text-xs text-muted-foreground">{c.contact_number}</p>}
              </div>
              <p className={`text-sm font-bold ${c.totalBalance > 0 ? 'text-destructive' : 'text-success'}`}>₱{c.totalBalance.toLocaleString()}</p>
            </button>
          ))}
        </div>

        <div className="bg-card rounded-xl border p-4">
          {selectedCustomer ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-semibold text-card-foreground">{selectedCustomer.full_name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedCustomer.contact_number || 'No contact'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="text-xl font-bold font-display text-destructive">₱{selectedCustomer.totalBalance.toLocaleString()}</p>
                </div>
              </div>
              {selectedCustomer.totalBalance > 0 && (
                <Button variant="outline" className="w-full mb-4" onClick={() => setShowPayment(true)}>
                  <DollarSign className="w-4 h-4 mr-2" /> Record Payment
                </Button>
              )}
              <h4 className="text-sm font-medium text-card-foreground mb-2">Transaction History</h4>
              <div className="space-y-2 max-h-64 overflow-auto">
                {utangRecords.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
                ) : utangRecords.map(u => (
                  <div key={u.id} className="flex justify-between items-center p-2 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm text-card-foreground">{u.note || (u.type === 'credit' ? 'Credit' : 'Payment')}</p>
                      <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString('en-PH')}</p>
                    </div>
                    <p className={`text-sm font-bold ${u.type === 'credit' ? 'text-destructive' : 'text-success'}`}>
                      {u.type === 'credit' ? '+' : '-'}₱{Number(u.amount).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <User className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">Select a customer to view details</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm font-medium text-foreground">Full Name *</label><Input value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-foreground">Contact Number</label><Input value={form.contactNumber} onChange={e => setForm(f => ({ ...f, contactNumber: e.target.value }))} /></div>
            <div><label className="text-sm font-medium text-foreground">Notes</label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <Button onClick={handleAddCustomer} className="w-full">Add Customer</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Record Payment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Customer: {selectedCustomer?.full_name}</p>
            <p className="text-sm text-foreground">Balance: <span className="font-bold text-destructive">₱{selectedCustomer?.totalBalance}</span></p>
            <div><label className="text-sm font-medium text-foreground">Amount</label><Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="Enter payment amount..." /></div>
            <Button onClick={handlePayment} className="w-full">Record Payment</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
