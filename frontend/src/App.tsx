/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  BarChart2, 
  Package, 
  Warehouse as WarehouseIcon, 
  Building2, 
  Sliders, 
  FileText, 
  Settings as SettingsIcon,
  Database,
  ArrowRight,
  TrendingUp,
  Boxes,
  RefreshCw,
  AlertCircle,
  ShoppingCart,
  LogOut
} from 'lucide-react';

import DashboardView from './components/DashboardView.tsx';
import ProductsView from './components/ProductsView.tsx';
import MovementsView from './components/MovementsView.tsx';
import WarehousesView from './components/WarehousesView.tsx';
import SuppliersView from './components/SuppliersView.tsx';
import OrdersView from './components/OrdersView.tsx';
import SettingsView from './components/SettingsView.tsx';
import SalesView from './components/SalesView.tsx';
import LoginView from './components/LoginView.tsx';

import { 
  Product, 
  Variant, 
  Brand, 
  Warehouse, 
  Supplier, 
  Movement, 
  PurchaseOrder, 
  DashboardStats,
  OrderStatus,
  Sale,
  UserSession
} from './types.ts';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('shoetracker_theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('shoetracker_theme', theme);
  }, [theme]);

  const [session, setSession] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem('shoetracker_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [dbStatus, setDbStatus] = useState<{
    postgresConnected: boolean;
    dbError: string | null;
    mode: string;
    configDocUrl?: string;
  } | null>(null);

  // Core Datasets
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);

  // Loading States
  const [statsLoading, setStatsLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Global Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const authedFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    } as any;
    if (session?.user?.id) {
      headers['x-user-id'] = session.user.id;
    }
    return fetch(url, {
      ...options,
      headers
    });
  };

  // ------------------------------------------
  // API FETCH FUNCTIONS
  // ------------------------------------------
  
  const fetchDbStatus = async () => {
    try {
      const res = await authedFetch('/api/status');
      const data = await res.json();
      if (data.success) {
        setDbStatus({
          postgresConnected: data.postgresConnected,
          dbError: data.dbError,
          mode: data.mode,
          configDocUrl: data.configDocUrl
        });
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await authedFetch('/api/stats');
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await authedFetch('/api/products');
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const res = await authedFetch('/api/brands');
      const data = await res.json();
      if (data.success) {
        setBrands(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchVariants = async () => {
    try {
      const res = await authedFetch('/api/variants');
      const data = await res.json();
      if (data.success) {
        setVariants(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWarehouses = async () => {
    setWarehousesLoading(true);
    try {
      const res = await authedFetch('/api/warehouses');
      const data = await res.json();
      if (data.success) {
        setWarehouses(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWarehousesLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    setSuppliersLoading(true);
    try {
      const res = await authedFetch('/api/suppliers');
      const data = await res.json();
      if (data.success) {
        setSuppliers(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSuppliersLoading(false);
    }
  };

  const fetchMovements = async () => {
    setMovementsLoading(true);
    try {
      const res = await authedFetch('/api/movements');
      const data = await res.json();
      if (data.success) {
        setMovements(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMovementsLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await authedFetch('/api/orders');
      const data = await res.json();
      if (data.success) {
        setOrders(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchSales = async () => {
    setSalesLoading(true);
    try {
      const res = await authedFetch('/api/sales');
      const data = await res.json();
      if (data.success) {
        setSales(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSalesLoading(false);
    }
  };

  // Initial Sync on load
  useEffect(() => {
    const runInitialFetches = async () => {
      await fetchDbStatus();
      await Promise.all([
        fetchStats(),
        fetchBrands(),
        fetchProducts(),
        fetchVariants(),
        fetchWarehouses(),
        fetchSuppliers(),
        fetchMovements(),
        fetchOrders(),
        fetchSales()
      ]);
    };
    runInitialFetches();
  }, []);

  // Trigger global data refresh
  const handleDataRefresh = async () => {
    await fetchDbStatus();
    await Promise.all([
      fetchStats(),
      fetchBrands(),
      fetchProducts(),
      fetchVariants(),
      fetchWarehouses(),
      fetchSuppliers(),
      fetchMovements(),
      fetchOrders(),
      fetchSales()
    ]);
    triggerToast('All operational stocks and audit trails synchronized!', 'success');
  };

  // ------------------------------------------
  // DATABASE ACTIONS
  // ------------------------------------------
  
  const handleDatabaseReconnect = async () => {
    setActionLoading(true);
    try {
      const res = await authedFetch('/api/status/reconnect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await handleDataRefresh();
        if (data.postgresConnected) {
          triggerToast('Successfully initialized connection to Supabase PostgreSQL!', 'success');
        } else {
          triggerToast('Running in Memory SandboxFallback.', 'info');
        }
      }
    } catch (err) {
      triggerToast('Database sync test failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ------------------------------------------
  // API MUTATION POST TRIGGERS
  // ------------------------------------------

  const handleCreateProduct = async (payload: any) => {
    try {
      const res = await authedFetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`Shoe "${payload.name}" cataloged!`, 'success');
        return data.data;
      } else {
        triggerToast(data.error || 'Failed to catalog shoe', 'error');
      }
    } catch (err) {
      triggerToast('Network error during product creation', 'error');
    }
  };

  const handleUpdateProduct = async (id: string, payload: any) => {
    try {
      const res = await authedFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`Updated product details.`, 'success');
        return data.data;
      }
    } catch (err) {
      triggerToast('Failed to update product', 'error');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const res = await authedFetch(`/api/products/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        triggerToast('Product deleted from catalog', 'success');
      }
    } catch (err) {
      triggerToast('Failed to delete product', 'error');
    }
  };

  const handleCreateVariant = async (payload: any) => {
    try {
      const res = await authedFetch('/api/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`Size SKU "${payload.sku}" generated successfully!`, 'success');
        return data.data;
      }
    } catch (err) {
      triggerToast('Failed to generate variant SKU', 'error');
    }
  };

  const handleUpdateVariant = async (id: string, payload: any) => {
    try {
      const res = await authedFetch(`/api/variants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('Variant metadata updated.', 'success');
        return data.data;
      }
    } catch (err) {
      triggerToast('Failed to update variant', 'error');
    }
  };

  const handleDeleteVariant = async (id: string) => {
    try {
      const res = await authedFetch(`/api/variants/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        triggerToast('Variant SKU deleted.', 'success');
      }
    } catch (err) {
      triggerToast('Failed to delete variant', 'error');
    }
  };

  const handleCreateWarehouse = async (payload: any) => {
    try {
      const res = await authedFetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`Warehouse "${payload.name}" mapped!`, 'success');
        return data.data;
      }
    } catch (err) {
      triggerToast('Failed to map warehouse', 'error');
    }
  };

  const handleUpdateWarehouse = async (id: string, payload: any) => {
    try {
      const res = await authedFetch(`/api/warehouses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('Facility information updated.', 'success');
        return data.data;
      }
    } catch (err) {
      triggerToast('Failed to update warehouse', 'error');
    }
  };

  const handleDeleteWarehouse = async (id: string) => {
    try {
      const res = await authedFetch(`/api/warehouses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        triggerToast('Facility deleted.', 'success');
      }
    } catch (err) {
      triggerToast('Failed to delete warehouse', 'error');
    }
  };

  const handleCreateSupplier = async (payload: any) => {
    try {
      const res = await authedFetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`Supplier "${payload.name}" registered!`, 'success');
        return data.data;
      }
    } catch (err) {
      triggerToast('Failed to register supplier', 'error');
    }
  };

  const handleUpdateSupplier = async (id: string, payload: any) => {
    try {
      const res = await authedFetch(`/api/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('Supplier directory updated.', 'success');
        return data.data;
      }
    } catch (err) {
      triggerToast('Failed to update supplier details', 'error');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      const res = await authedFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        triggerToast('Supplier profile removed.', 'success');
      }
    } catch (err) {
      triggerToast('Failed to delete supplier', 'error');
    }
  };

  const handleCreateMovement = async (payload: any) => {
    try {
      const res = await authedFetch('/api/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerToast('Stock movement registered successfully. Core metrics updated!', 'success');
        return data.data;
      }
    } catch (err) {
      triggerToast('Failed to log stock change', 'error');
    }
  };

  const handleCreateOrder = async (payload: any) => {
    try {
      const res = await authedFetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`Restock order "${payload.orderNumber}" created!`, 'success');
        return data.data;
      }
    } catch (err) {
      triggerToast('Failed to authorize purchase order', 'error');
    }
  };

  const handleUpdateOrderStatus = async (id: string, status: OrderStatus) => {
    try {
      const res = await authedFetch(`/api/orders/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        triggerToast(`Order marked as ${status.toUpperCase()}!`, 'success');
        return data.data;
      }
    } catch (err) {
      triggerToast('Failed to update order status', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('shoetracker_session');
    setSession(null);
    triggerToast('Logged out successfully', 'info');
  };

  const getPermittedTabs = () => {
    if (!session) return [];
    
    const role = session.user.role;
    if (role === 'Admin') {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
        { id: 'products', label: 'Shoes & Sizes', icon: Package },
        { id: 'movements', label: 'Stock Movements', icon: Sliders },
        { id: 'warehouses', label: 'Shops', icon: WarehouseIcon },
        { id: 'suppliers', label: 'Suppliers', icon: Building2 },
        { id: 'orders', label: 'Supplier Orders', icon: FileText },
        { id: 'sales', label: 'Sales & Profit', icon: ShoppingCart },
        { id: 'settings', label: 'Settings', icon: SettingsIcon },
      ];
    } else {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
        { id: 'products', label: 'Shoes & Sizes', icon: Package },
        { id: 'movements', label: 'Stock Movements', icon: Sliders },
        { id: 'sales', label: 'Sales & Profit', icon: ShoppingCart },
      ];
    }
  };

  // Nav helper
  const handleTabChange = (tab: string) => {
    const permitted = getPermittedTabs().map(t => t.id);
    if (!permitted.includes(tab)) {
      setActiveTab('dashboard');
      return;
    }
    setActiveTab(tab);
    // Refresh targeted tab data context
    if (tab === 'dashboard') fetchStats();
    if (tab === 'products') { fetchProducts(); fetchBrands(); }
    if (tab === 'movements') { fetchMovements(); fetchVariants(); fetchWarehouses(); }
    if (tab === 'warehouses') fetchWarehouses();
    if (tab === 'suppliers') fetchSuppliers();
    if (tab === 'orders') { fetchOrders(); fetchSuppliers(); fetchVariants(); }
    if (tab === 'sales') { fetchSales(); fetchVariants(); fetchWarehouses(); }
    if (tab === 'settings') fetchDbStatus();
  };

  if (!session) {
    return (
      <LoginView 
        onLoginSuccess={(sess) => {
          setSession(sess);
          localStorage.setItem('shoetracker_session', JSON.stringify(sess));
        }} 
        triggerToast={triggerToast} 
      />
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans transition-colors duration-200">
      
      {/* SIDEBAR NAVIGATION PANEL */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col justify-between border-r border-sidebar-border shrink-0 transition-colors duration-200">
        <div>
          {/* Logo Branding */}
          <div className="p-5 border-b border-sidebar-border flex items-center space-x-3.5 bg-sidebar/50">
            <div className="w-9 h-9 bg-primary text-primary-foreground rounded-xl flex items-center justify-center font-black text-base shadow-sm">
              👟
            </div>
            <div>
              <h1 className="font-extrabold text-sm tracking-tight text-sidebar-foreground leading-tight">ShoeTracker</h1>
              <p className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase mt-0.5">Stock Platform</p>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="py-4 space-y-0.5">
            {getPermittedTabs().map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full flex items-center space-x-3 px-6 py-3 border-r-3 text-xs font-semibold tracking-wide transition-all text-left cursor-pointer ${
                    isSelected 
                      ? 'bg-sidebar-accent text-primary border-primary' 
                      : 'border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                  }`}
                >
                  <Icon className={`w-4.5 h-4.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile card & Log Out */}
        <div className="p-4 border-t border-sidebar-border bg-sidebar/50 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 truncate">
            <div className="w-8 h-8 bg-primary/10 border border-primary/20 text-primary rounded-lg flex items-center justify-center font-black text-xs shrink-0">
              {session?.user?.name?.charAt(0) || 'U'}
            </div>
            <div className="truncate">
              <p className="text-[11px] font-black text-sidebar-foreground leading-tight truncate">{session?.user?.name || 'User'}</p>
              <p className="text-[9px] text-muted-foreground font-bold tracking-wider uppercase mt-0.5">{session?.user?.role || 'Guest'}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>


      </aside>

      {/* WORKSPACE AREA */}
      <main className="flex-1 flex flex-col min-w-0 bg-background text-foreground">
        
        {/* Top Header Row */}
        <header className="h-16 bg-card border-b border-border px-6 flex justify-between items-center shrink-0 transition-colors duration-200">
          <div>
            <h2 className="text-base font-extrabold text-foreground uppercase tracking-wider">
              {activeTab === 'dashboard' ? 'Dashboard Overview' :
               activeTab === 'products' ? 'Shoes & Sizes' :
               activeTab === 'movements' ? 'Stock Movements' :
               activeTab === 'warehouses' ? 'Shop Locations' :
               activeTab === 'suppliers' ? 'Shoe Suppliers' :
               activeTab === 'orders' ? 'Supplier Orders' :
               activeTab === 'sales' ? 'Sales & Profit' :
               'Settings'}
            </h2>
          </div>

          {/* Quick Info & Telemetry */}
          <div className="flex items-center space-x-4">
            {!dbStatus?.postgresConnected && (
              <span 
                onClick={() => handleTabChange('settings')}
                className="text-[10px] bg-amber-500/10 text-amber-500 font-bold px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
              >
                <AlertCircle className="w-3.5 h-3.5" /> Connect Supabase Database
              </span>
            )}
            
            <button 
              onClick={handleDataRefresh}
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-border hover:bg-muted text-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sync Data
            </button>
          </div>
        </header>

        {/* View Content Port */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* Active View Router */}
          {activeTab === 'dashboard' && (
            <DashboardView 
              stats={stats} 
              loading={statsLoading} 
              onNavigate={handleTabChange}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView 
              products={products}
              brands={brands}
              loading={productsLoading}
              onRefresh={handleDataRefresh}
              onCreateProduct={handleCreateProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
              onCreateVariant={handleCreateVariant}
              onUpdateVariant={handleUpdateVariant}
              onDeleteVariant={handleDeleteVariant}
              userPermissions={session?.permissions || []}
            />
          )}

          {activeTab === 'movements' && (
            <MovementsView 
              movements={movements}
              variants={variants}
              warehouses={warehouses}
              loading={movementsLoading}
              onRefresh={handleDataRefresh}
              onCreateMovement={handleCreateMovement}
            />
          )}

          {activeTab === 'warehouses' && (
            <WarehousesView 
              warehouses={warehouses}
              loading={warehousesLoading}
              onRefresh={handleDataRefresh}
              onCreateWarehouse={handleCreateWarehouse}
              onUpdateWarehouse={handleUpdateWarehouse}
              onDeleteWarehouse={handleDeleteWarehouse}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersView 
              suppliers={suppliers}
              loading={suppliersLoading}
              onRefresh={handleDataRefresh}
              onCreateSupplier={handleCreateSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView 
              orders={orders}
              suppliers={suppliers}
              variants={variants}
              loading={ordersLoading}
              onRefresh={handleDataRefresh}
              onCreateOrder={handleCreateOrder}
              onUpdateOrderStatus={handleUpdateOrderStatus}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView 
              dbStatus={dbStatus}
              loading={actionLoading}
              onReconnect={handleDatabaseReconnect}
              triggerToast={triggerToast}
              session={session}
              currentTheme={theme}
              onThemeToggle={setTheme}
            />
          )}

          {activeTab === 'sales' && (
            <SalesView 
              sales={sales}
              variants={variants}
              warehouses={warehouses}
              loading={salesLoading}
              onRefresh={fetchSales}
              onRecordSale={async (sData) => {
                const response = await authedFetch('/api/sales', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(sData)
                });
                const data = await response.json();
                if (!data.success) {
                  throw new Error(data.error || 'Failed to record the sale.');
                }
                triggerToast('Sale recorded successfully!', 'success');
                // Automatically update dashboard states
                fetchStats();
                return data.data;
              }}
            />
          )}

        </div>
      </main>

      {/* ==============================================
          GLOBAL TOAST NOTIFICATION 
         ============================================== */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2.5 p-4 rounded-xl shadow-lg border animate-slide-in-up bg-slate-900 border-slate-800 text-white max-w-sm">
          <div className="shrink-0 text-base">
            {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
          </div>
          <p className="text-xs font-semibold leading-relaxed">{toast.message}</p>
        </div>
      )}

    </div>
  );
}
