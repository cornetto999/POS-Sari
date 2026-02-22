import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Users, Receipt, Menu, X, Store, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/pos', label: 'POS', icon: ShoppingCart },
  { path: '/products', label: 'Products', icon: Package },
  { path: '/customers', label: 'Customers & Utang', icon: Users },
  { path: '/transactions', label: 'Transactions', icon: Receipt },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, role, displayName, signOut } = useAuth();

  const roleLabel = role === 'admin' ? 'Admin' : role === 'cashier' ? 'Cashier' : 'User';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground transform transition-transform md:relative md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 p-5 border-b border-sidebar-border">
          <div className="w-10 h-10 rounded-xl bg-sidebar-primary flex items-center justify-center">
            <Store className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold text-sidebar-foreground">Sari-Sari</h1>
            <p className="text-xs text-sidebar-foreground/60">Store POS</p>
          </div>
          <button className="ml-auto md:hidden text-sidebar-foreground/60" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary text-sm font-bold">
              {(displayName || user?.email || 'U')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName || user?.email}</p>
              <p className="text-xs text-sidebar-foreground/50">{roleLabel}</p>
            </div>
            <button onClick={signOut} className="text-sidebar-foreground/50 hover:text-sidebar-foreground" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b bg-card flex items-center px-4 gap-4 shrink-0">
          <button className="md:hidden text-foreground" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {navItems.find(n => n.path === location.pathname)?.label || 'Sari-Sari Store'}
          </h2>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
