import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Grid3X3, List, Plus, Minus, Trash2, ShoppingCart, Printer, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  category_name?: string;
  cost_price: number;
  selling_price: number;
  stock_qty: number;
  min_stock_level: number;
  image_url?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Customer {
  id: string;
  full_name: string;
}

export default function POS() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentType, setPaymentType] = useState<'cash' | 'utang'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [utangCustomerName, setUtangCustomerName] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const { toast } = useToast();
  const { user, displayName } = useAuth();

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*, categories(name)');
    setProducts((data || []).map(p => ({ ...p, category_name: (p as any).categories?.name || 'Uncategorized', cost_price: Number(p.cost_price), selling_price: Number(p.selling_price) })));
  };

  const fetchCustomers = async () => {
    const { data, error } = await supabase.from('customers').select('id, full_name');
    if (error) {
      toast({
        title: error.status === 403 ? 'No permission to read customers yet.' : error.message,
        variant: 'destructive',
      });
      setCustomers([]);
      return;
    }
    setCustomers(data || []);
  };

  const categories = ['All', ...new Set(products.map(p => p.category_name || ''))];

  const filtered = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = category === 'All' || p.category_name === category;
      return matchSearch && matchCat && p.stock_qty > 0;
    });
  }, [search, category, products]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(c => c.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_qty) {
          toast({ title: 'Not enough stock', variant: 'destructive' });
          return prev;
        }
        return prev.map(c => c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.product.id !== productId) return c;
      const newQty = c.quantity + delta;
      if (newQty <= 0 || newQty > c.product.stock_qty) return c;
      return { ...c, quantity: newQty };
    }));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(c => c.product.id !== productId));

  const subtotal = cart.reduce((sum, c) => sum + c.product.selling_price * c.quantity, 0);
  const change = paymentType === 'cash' ? Math.max(0, Number(cashReceived) - subtotal) : 0;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (paymentType === 'cash' && Number(cashReceived) < subtotal) {
      toast({ title: 'Insufficient cash', variant: 'destructive' }); return;
    }
    if (paymentType === 'utang' && !utangCustomerName.trim()) {
      toast({ title: 'Enter customer name', variant: 'destructive' }); return;
    }

    let customerId: string | null = null;
    const normalizedUtangName = utangCustomerName.trim();
    if (paymentType === 'utang') {
      const existingCustomer = customers.find(
        (c) => c.full_name.trim().toLowerCase() === normalizedUtangName.toLowerCase(),
      );
      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: newCustomerError } = await supabase
          .from('customers')
          .insert({ full_name: normalizedUtangName })
          .select('id, full_name')
          .single();
        if (newCustomerError || !newCustomer) {
          toast({ title: 'Error creating customer', description: newCustomerError?.message, variant: 'destructive' });
          return;
        }
        customerId = newCustomer.id;
        setCustomers((prev) => [...prev, newCustomer]);
      }
    }

    // Create sale
    const { data: sale, error: saleError } = await supabase.from('sales').insert({
      payment_type: paymentType,
      total: subtotal,
      cash_received: paymentType === 'cash' ? Number(cashReceived) : null,
      change_amount: paymentType === 'cash' ? change : null,
      customer_id: paymentType === 'utang' ? customerId : null,
      cashier_id: user!.id,
    }).select().single();

    if (saleError) { toast({ title: 'Error creating sale', description: saleError.message, variant: 'destructive' }); return; }

    // Create sale items
    const items = cart.map(c => ({
      sale_id: sale.id,
      product_id: c.product.id,
      product_name: c.product.name,
      quantity: c.quantity,
      price: c.product.selling_price,
      total: c.product.selling_price * c.quantity,
    }));

    const { error: itemsError } = await supabase.from('sale_items').insert(items);
    if (itemsError) { toast({ title: 'Error saving items', description: itemsError.message, variant: 'destructive' }); return; }

    // If utang, create ledger entry
    if (paymentType === 'utang' && customerId) {
      await supabase.from('utang_ledger').insert({
        customer_id: customerId,
        sale_id: sale.id,
        amount: subtotal,
        type: 'credit',
        note: `POS Sale #${sale.id.slice(0, 8)}`,
        created_by: user!.id,
      });
    }

    setLastSale(sale);
    setShowCheckout(false);
    setShowReceipt(true);
    fetchProducts(); // Refresh stock
  };

  const finishSale = () => {
    toast({ title: 'Sale completed! ✅', description: `₱${subtotal} — ${paymentType === 'cash' ? 'Cash' : 'Utang'}` });
    setCart([]);
    setShowReceipt(false);
    setCashReceived('');
    setUtangCustomerName('');
    setLastSale(null);
  };

  const customerName = utangCustomerName;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-7rem)] animate-slide-in">
      {/* Product picker */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-1">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${category === cat ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}>
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Package className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">No products found. Add products first!</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className="pos-grid-item text-left">
                  <div className="w-full h-20 bg-muted rounded-lg mb-2 flex items-center justify-center">
                    {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-lg" /> : <Package className="w-8 h-8 text-muted-foreground/40" />}
                  </div>
                  <p className="text-sm font-medium text-card-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category_name}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-sm font-bold text-primary">₱{p.selling_price}</p>
                    <span className={`text-xs ${p.stock_qty <= p.min_stock_level ? 'text-destructive' : 'text-muted-foreground'}`}>{p.stock_qty} left</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map(p => (
                <button key={p.id} onClick={() => addToCart(p)} className="w-full flex items-center gap-3 p-3 rounded-lg bg-card border hover:border-primary/40 transition-colors text-left">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category_name}</p>
                  </div>
                  <p className="text-sm font-bold text-primary">₱{p.selling_price}</p>
                  <span className={`text-xs ${p.stock_qty <= p.min_stock_level ? 'text-destructive' : 'text-muted-foreground'}`}>{p.stock_qty}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="w-full lg:w-96 bg-card border rounded-xl flex flex-col shrink-0 max-h-[50vh] lg:max-h-full">
        <div className="p-4 border-b flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          <h3 className="font-display font-semibold text-card-foreground">Cart</h3>
          <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{cart.reduce((s, c) => s + c.quantity, 0)} items</span>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Tap products to add to cart</p>
          ) : cart.map(c => (
            <div key={c.product.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground truncate">{c.product.name}</p>
                <p className="text-xs text-muted-foreground">₱{c.product.selling_price} × {c.quantity}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(c.product.id, -1)} className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80"><Minus className="w-3 h-3" /></button>
                <span className="w-6 text-center text-sm font-medium text-card-foreground">{c.quantity}</span>
                <button onClick={() => updateQty(c.product.id, 1)} className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80"><Plus className="w-3 h-3" /></button>
              </div>
              <p className="text-sm font-bold text-card-foreground w-14 text-right">₱{c.product.selling_price * c.quantity}</p>
              <button onClick={() => removeFromCart(c.product.id)} className="text-destructive/60 hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t space-y-3">
          <div className="flex justify-between text-lg font-display font-bold text-card-foreground">
            <span>Total</span><span>₱{subtotal.toLocaleString()}</span>
          </div>
          <Button className="w-full" size="lg" disabled={cart.length === 0} onClick={() => setShowCheckout(true)}>Checkout</Button>
        </div>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Checkout — ₱{subtotal.toLocaleString()}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Payment Type</label>
              <div className="flex gap-2">
                <button onClick={() => setPaymentType('cash')} className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${paymentType === 'cash' ? 'bg-success text-success-foreground' : 'bg-secondary text-secondary-foreground'}`}>💵 Cash</button>
                <button onClick={() => setPaymentType('utang')} className={`flex-1 py-3 rounded-lg font-medium text-sm transition-colors ${paymentType === 'utang' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'}`}>📝 Utang</button>
              </div>
            </div>

            {paymentType === 'cash' ? (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Cash Received</label>
                <Input type="number" placeholder="Enter amount..." value={cashReceived} onChange={e => setCashReceived(e.target.value)} className="text-lg" />
                {Number(cashReceived) >= subtotal && <p className="text-success font-bold mt-2">Change: ₱{change.toLocaleString()}</p>}
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Customer Name</label>
                <Input
                  list="customer-name-options"
                  value={utangCustomerName}
                  onChange={e => setUtangCustomerName(e.target.value)}
                  placeholder="Type customer name..."
                />
                <datalist id="customer-name-options">
                  {customers.map(c => <option key={c.id} value={c.full_name} />)}
                </datalist>
              </div>
            )}

            <Button onClick={handleCheckout} className="w-full" size="lg">Complete Sale</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="sr-only">
            <DialogTitle>Receipt</DialogTitle>
          </DialogHeader>
          <div className="text-center border-b pb-3 mb-3">
            <h3 className="font-display font-bold text-lg text-foreground">🏪 Sari-Sari Store</h3>
            <p className="text-xs text-muted-foreground">{new Date().toLocaleString('en-PH')}</p>
            <p className="text-xs text-muted-foreground">Cashier: {displayName}</p>
          </div>
          <div className="space-y-1 border-b pb-3 mb-3">
            {cart.map(c => (
              <div key={c.product.id} className="flex justify-between text-sm">
                <span className="text-foreground">{c.product.name} x{c.quantity}</span>
                <span className="font-medium text-foreground">₱{c.product.selling_price * c.quantity}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between font-bold text-foreground"><span>TOTAL</span><span>₱{subtotal.toLocaleString()}</span></div>
            <div className="flex justify-between text-sm text-muted-foreground"><span>Payment</span><span>{paymentType === 'cash' ? 'Cash' : 'Utang'}</span></div>
            {paymentType === 'cash' && (
              <>
                <div className="flex justify-between text-sm text-muted-foreground"><span>Cash</span><span>₱{Number(cashReceived).toLocaleString()}</span></div>
                <div className="flex justify-between text-sm text-success font-medium"><span>Change</span><span>₱{change.toLocaleString()}</span></div>
              </>
            )}
            {paymentType === 'utang' && (
              <div className="flex justify-between text-sm text-destructive font-medium"><span>Charged to</span><span>{customerName}</span></div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={finishSale}>Done</Button>
            <Button className="flex-1" onClick={() => { window.print(); finishSale(); }}><Printer className="w-4 h-4 mr-2" /> Print</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
