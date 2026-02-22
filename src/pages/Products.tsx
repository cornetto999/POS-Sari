import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Edit, Trash2, Package, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  category_id: string | null;
  category_name?: string;
  cost_price: number;
  selling_price: number;
  stock_qty: number;
  min_stock_level: number;
  barcode?: string;
  image_url?: string;
}

interface Category {
  id: string;
  name: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pendingEditProduct, setPendingEditProduct] = useState<Product | null>(null);
  const [imageError, setImageError] = useState('');
  const { toast } = useToast();
  const { role } = useAuth();

  const [form, setForm] = useState({ name: '', category_id: '', costPrice: '', sellingPrice: '', stockQty: '', minStockLevel: '5', barcode: '', imageUrl: '' });

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*, categories(name)').order('name');
    if (error) {
      toast({ title: error.status === 403 ? 'Access denied to products. Please sign in again.' : error.message, variant: 'destructive' });
      return;
    }
    setProducts((data || []).map(p => ({ ...p, category_name: (p as any).categories?.name || 'Uncategorized', cost_price: Number(p.cost_price), selling_price: Number(p.selling_price) })));
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data || []);
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const isAdmin = role === 'admin';

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', category_id: categories[0]?.id || '', costPrice: '', sellingPrice: '', stockQty: '', minStockLevel: '5', barcode: '', imageUrl: '' });
    setImageError('');
    setShowForm(true);
  };

  const openAddWithPin = () => {
    if (pinUnlocked) {
      openAdd();
      return;
    }
    setPendingEditProduct(null);
    setPinInput('');
    setPinError('');
    setShowPinDialog(true);
  };

  const openEditWithPin = (p: Product) => {
    if (pinUnlocked) {
      openEdit(p);
      return;
    }
    setPendingEditProduct(p);
    setPinInput('');
    setPinError('');
    setShowPinDialog(true);
  };

  const handleVerifyPin = async () => {
    const { data, error } = await supabase.rpc('verify_my_product_pin', { _pin: pinInput });
    if (error) {
      setPinError(error.message);
      return;
    }
    if (!data) {
      setPinError('Incorrect PIN');
      return;
    }
    setPinUnlocked(true);
    setShowPinDialog(false);
    if (pendingEditProduct) {
      openEdit(pendingEditProduct);
      setPendingEditProduct(null);
    } else {
      openAdd();
    }
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      category_id: p.category_id || '',
      costPrice: String(p.cost_price),
      sellingPrice: String(p.selling_price),
      stockQty: String(p.stock_qty),
      minStockLevel: String(p.min_stock_level),
      barcode: p.barcode || '',
      imageUrl: p.image_url || '',
    });
    setImageError('');
    setShowForm(true);
  };

  const handleImageFileChange = (file: File | null) => {
    if (!file) {
      setForm((f) => ({ ...f, imageUrl: '' }));
      setImageError('');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError('Image too large. Max size is 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setForm((f) => ({ ...f, imageUrl: result }));
      setImageError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.name || !form.costPrice || !form.sellingPrice || !form.stockQty) {
      toast({ title: 'Fill all required fields', variant: 'destructive' }); return;
    }
    const payload = {
      name: form.name,
      category_id: form.category_id || null,
      cost_price: Number(form.costPrice),
      selling_price: Number(form.sellingPrice),
      stock_qty: Number(form.stockQty),
      min_stock_level: Number(form.minStockLevel),
      barcode: form.barcode || null,
      image_url: form.imageUrl || null,
    };

    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) {
        const denied = error.code === '42501' || error.status === 403;
        toast({ title: denied ? 'You do not have permission to update products.' : error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Product updated ✅' });
    } else {
      const { error } = await supabase.from('products').insert(payload);
      if (error) {
        const denied = error.code === '42501' || error.status === 403;
        toast({ title: denied ? 'You do not have permission to add products.' : error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Product added ✅' });
    }
    setShowForm(false);
    fetchProducts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      const denied = error.code === '42501' || error.status === 403;
      toast({ title: denied ? 'You do not have permission to delete products.' : error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Product deleted' });
    fetchProducts();
  };

  return (
    <div className="space-y-4 animate-slide-in">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <>
          <Button onClick={openAddWithPin} className="hidden md:inline-flex">
            <Plus className="w-4 h-4 mr-2" /> Add Product
          </Button>
          <Button
            onClick={openAddWithPin}
            size="icon"
            className="md:hidden"
            aria-label="Add Product"
            title="Add Product"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Product</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Category</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Cost</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Price</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Stock</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No products yet. Add your first product!</td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="w-8 h-8 rounded-lg object-cover shrink-0 border"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center shrink-0">
                          <Package className="w-4 h-4 text-muted-foreground/40" />
                        </div>
                      )}
                      <span className="font-medium text-card-foreground">{p.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{p.category_name}</td>
                  <td className="p-3 text-right text-muted-foreground">₱{p.cost_price}</td>
                  <td className="p-3 text-right font-medium text-card-foreground">₱{p.selling_price}</td>
                  <td className="p-3 text-right">
                    <span className={`font-medium ${p.stock_qty <= p.min_stock_level ? 'text-destructive' : 'text-card-foreground'}`}>{p.stock_qty}</span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1">
                        <button onClick={() => openEditWithPin(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"><Edit className="w-4 h-4" /></button>
                        {isAdmin && (
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">{editing ? 'Edit Product' : 'Add Product'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground">Product Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Category</label>
              <select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} className="w-full h-10 rounded-lg border bg-background px-3 text-sm text-foreground">
                <option value="">None</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-foreground">Cost Price *</label><Input type="number" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} /></div>
              <div><label className="text-sm font-medium text-foreground">Selling Price *</label><Input type="number" value={form.sellingPrice} onChange={e => setForm(f => ({ ...f, sellingPrice: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium text-foreground">Stock Qty *</label><Input type="number" value={form.stockQty} onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))} /></div>
              <div><label className="text-sm font-medium text-foreground">Min Stock</label><Input type="number" value={form.minStockLevel} onChange={e => setForm(f => ({ ...f, minStockLevel: e.target.value }))} /></div>
            </div>
            <div><label className="text-sm font-medium text-foreground">Barcode (optional)</label><Input value={form.barcode} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} /></div>
            <div>
              <label className="text-sm font-medium text-foreground">Product Image (optional)</label>
              <Input type="file" accept="image/*" onChange={e => handleImageFileChange(e.target.files?.[0] || null)} />
              {imageError && <p className="text-sm text-destructive mt-1">{imageError}</p>}
            </div>
            {form.imageUrl && (
              <div className="border rounded-lg p-2">
                <img
                  src={form.imageUrl}
                  alt="Preview"
                  className="w-16 h-16 object-cover rounded-md"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            <Button onClick={handleSave} className="w-full">{editing ? 'Update Product' : 'Add Product'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showPinDialog}
        onOpenChange={(open) => {
          setShowPinDialog(open);
          if (!open) {
            setPendingEditProduct(null);
            setPinError('');
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Enter Product PIN</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              type="password"
              value={pinInput}
              onChange={e => setPinInput(e.target.value)}
              placeholder="Enter PIN"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerifyPin();
              }}
            />
            {pinError && <p className="text-sm text-destructive">{pinError}</p>}
            <Button onClick={handleVerifyPin} className="w-full">Unlock Product Access</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
