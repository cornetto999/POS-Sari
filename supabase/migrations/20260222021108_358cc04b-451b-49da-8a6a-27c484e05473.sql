
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  cost_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  selling_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  stock_qty INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 5,
  barcode TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Customers
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  contact_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Sales
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('cash', 'utang')),
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  cash_received NUMERIC(10,2),
  change_amount NUMERIC(10,2),
  customer_id UUID REFERENCES public.customers(id),
  cashier_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Sale items
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Utang ledger
CREATE TABLE public.utang_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  sale_id UUID REFERENCES public.sales(id),
  amount NUMERIC(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit', 'payment')),
  note TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.utang_ledger ENABLE ROW LEVEL SECURITY;

-- Stock adjustments
CREATE TABLE public.stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity_change INTEGER NOT NULL,
  reason TEXT,
  adjusted_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Helper functions (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-deduct stock on sale item insert
CREATE OR REPLACE FUNCTION public.deduct_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock_qty = stock_qty - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_sale_item_insert
  AFTER INSERT ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.deduct_stock_on_sale();

-- Update product timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS Policies

-- Profiles: users see own, admin sees all
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System inserts profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles: admin manages, users read own
CREATE POLICY "Read own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manages roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin updates roles" ON public.user_roles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin deletes roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Categories: all authenticated can read, admin can manage
CREATE POLICY "Authenticated read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages categories" ON public.categories FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin updates categories" ON public.categories FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin deletes categories" ON public.categories FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Products: all authenticated can read, admin can manage
CREATE POLICY "Authenticated read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages products" ON public.products FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin updates products" ON public.products FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin deletes products" ON public.products FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Customers: all authenticated can read, admin can manage
CREATE POLICY "Authenticated read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manages customers" ON public.customers FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin updates customers" ON public.customers FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin deletes customers" ON public.customers FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Sales: authenticated can insert, admin+owner can read
CREATE POLICY "Read own or admin sales" ON public.sales FOR SELECT USING (cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (cashier_id = auth.uid());
CREATE POLICY "Admin updates sales" ON public.sales FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin deletes sales" ON public.sales FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Sale items: follow sale access
CREATE POLICY "Read sale items" ON public.sale_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND (sales.cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Insert sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.sales WHERE sales.id = sale_items.sale_id AND (sales.cashier_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);

-- Utang ledger: authenticated can read/insert
CREATE POLICY "Read utang" ON public.utang_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert utang" ON public.utang_ledger FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admin updates utang" ON public.utang_ledger FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin deletes utang" ON public.utang_ledger FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Stock adjustments: authenticated can read/insert
CREATE POLICY "Read stock adjustments" ON public.stock_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert stock adjustments" ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (adjusted_by = auth.uid());
CREATE POLICY "Admin updates stock adj" ON public.stock_adjustments FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin deletes stock adj" ON public.stock_adjustments FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Seed categories
INSERT INTO public.categories (name) VALUES
  ('Beverages'), ('Snacks'), ('Canned Goods'), ('Condiments'),
  ('Personal Care'), ('Household'), ('Frozen'), ('Bread & Bakery'), ('Others');
