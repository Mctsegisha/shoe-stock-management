import { useState, useEffect, FormEvent } from 'react';
import { 
  Building, Sliders, Users, Tags, Coins, Bell, Link, Database, Lock,
  Plus, Trash2, RefreshCw, AlertTriangle, Download, Upload, Check, AlertCircle, Save
} from 'lucide-react';
import { UserSession } from '../types.ts';

interface SettingsViewProps {
  dbStatus: {
    postgresConnected: boolean;
    dbError: string | null;
    mode: string;
    configDocUrl?: string;
  } | null;
  loading: boolean;
  onReconnect: () => Promise<void>;
  triggerToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  session?: UserSession | null;
  currentTheme?: 'light' | 'dark';
  onThemeToggle?: (theme: 'light' | 'dark') => void;
}

type TabType = 'profile' | 'inventory' | 'users' | 'categories' | 'pricing' | 'notifications' | 'integrations' | 'backup' | 'security';

export default function SettingsView({ 
  dbStatus, 
  loading: dbLoading, 
  onReconnect, 
  triggerToast, 
  session,
  currentTheme = 'light',
  onThemeToggle
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [saving, setSaving] = useState(false);
  
  // Settings State
  const [profile, setProfile] = useState({ shopName: '', logoUrl: '', address: '', phone: '', email: '', currency: 'ETB', numberFormat: '1,234.56', dateFormat: 'MM/DD/YYYY' });
  const [inventory, setInventory] = useState({ globalThreshold: 10, perProductOverride: false, skuPrefix: 'SHOE', skuIncrementPattern: '0000', minSize: 36, maxSize: 46, colors: [] as string[], reorderPointsToggle: true });
  const [users, setUsers] = useState({ roles: [] as { name: string; permissions: string[] }[], invites: [] as { id: string; emailOrPhone: string; role: string; invitedAt: string }[], activityLogToggle: true });
  const [categories, setCategories] = useState({ categories: [] as string[], customAttributes: [] as { id: string; name: string; type: 'text' | 'number' | 'select'; options?: string[] }[] });
  const [pricing, setPricing] = useState({ defaultMarkup: 30, vatRate: 15, taxInclusive: true, maxDiscount: 10 });
  const [notifications, setNotifications] = useState({ inApp: true, email: true, telegram: false, summaryToggle: true, summaryDeliveryTime: '08:00', telegramToken: '', telegramChatId: '' });
  const [integrations, setIntegrations] = useState({ chapaPublicKey: '', chapaSecretKey: '', chapaMode: 'test' as 'test'|'live', telegramBotStatus: 'disconnected' as 'connected'|'disconnected', webhookUrl: '' });
  const [backup, setBackup] = useState({ lastBackupTimestamp: 'Never' });
  const [security, setSecurity] = useState({ minPasswordLength: 8, requireSpecialChar: true, sessionTimeout: '1hr' as any, admin2FA: false });

  // Connected database assets & side elements
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [backupsList, setBackupsList] = useState<any[]>([]);
  
  // Real platform users list for owner's direct registration & management
  const [registeredUsers, setRegisteredUsers] = useState<any[]>([]);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', password: '', role: 'Sales Staff' });
  const [addingUser, setAddingUser] = useState(false);
  
  // UI Helpers
  const [newColor, setNewColor] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Sales Staff');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; desc: string; action: () => void } | null>(null);

  // Import / Upload State
  const [importText, setImportText] = useState('');
  const [importColumns, setImportColumns] = useState({ name: 0, price: 1, stock: 2, brand: 3, size: 4, color: 5 });
  const [importPreview, setImportPreview] = useState<any[]>([]);

  // Locations management inside Business Profile
  const [newLocation, setNewLocation] = useState({ name: '', code: '', address: '', phone: '', type: 'store' });

  // Errors validation
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSettings();
    fetchLocations();
    fetchSuppliers();
    fetchBackups();
    if (session?.user?.id) {
      fetchUsers();
    }
  }, [session]);

  const fetchUsers = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.user?.id) {
        headers['x-user-id'] = session.user.id;
      }
      const r = await fetch('/api/users', { headers });
      const contentType = r.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await r.text();
        const cleanText = text.substring(0, 100).replace(/<[^>]*>/g, '').trim();
        throw new Error(`Non-JSON response (${r.status}): ${cleanText || 'HTML Page'}`);
      }
      const d = await r.json();
      if (d.success) {
        setRegisteredUsers(d.data || []);
      } else {
        console.error('Failed to fetch users:', d.error);
      }
    } catch (e: any) {
      console.error('Error fetching registered users', e);
      triggerToast?.(`Error loading users: ${e.message}`, 'error');
    }
  };

  const handleAddNewUser = async (e: FormEvent) => {
    e.preventDefault();
    if (!newUserForm.name || !newUserForm.email || !newUserForm.password || !newUserForm.role) {
      triggerToast?.('Please fill in all user details', 'error');
      return;
    }
    setAddingUser(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.user?.id) {
        headers['x-user-id'] = session.user.id;
      }
      const r = await fetch('/api/users', {
        method: 'POST',
        headers,
        body: JSON.stringify(newUserForm)
      });
      const contentType = r.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await r.text();
        const cleanText = text.substring(0, 100).replace(/<[^>]*>/g, '').trim();
        throw new Error(`Non-JSON response (${r.status}): ${cleanText || 'HTML Page'}`);
      }
      const d = await r.json();
      if (d.success) {
        triggerToast?.('New user registered successfully', 'success');
        setNewUserForm({ name: '', email: '', password: '', role: 'Sales Staff' });
        fetchUsers();
      } else {
        triggerToast?.(d.error || 'Failed to add user', 'error');
      }
    } catch (err: any) {
      triggerToast?.(err.message, 'error');
    } finally {
      setAddingUser(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === session?.user?.id) {
      triggerToast?.('You cannot delete your own session user account', 'error');
      return;
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.user?.id) {
        headers['x-user-id'] = session.user.id;
      }
      const r = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers
      });
      const contentType = r.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await r.text();
        const cleanText = text.substring(0, 100).replace(/<[^>]*>/g, '').trim();
        throw new Error(`Non-JSON response (${r.status}): ${cleanText || 'HTML Page'}`);
      }
      const d = await r.json();
      if (d.success) {
        triggerToast?.('User deleted from platform', 'success');
        fetchUsers();
      } else {
        triggerToast?.(d.error || 'Failed to delete user', 'error');
      }
    } catch (err: any) {
      triggerToast?.(err.message, 'error');
    }
  };

  const fetchSettings = async () => {
    try {
      const r = await fetch('/api/settings/general');
      const res = await r.json();
      if (res.success && res.data) {
        const d = res.data;
        if (d.businessProfile) setProfile(d.businessProfile);
        if (d.inventoryRules) setInventory(d.inventoryRules);
        if (d.usersPermissions) setUsers(d.usersPermissions);
        if (d.categoriesAttributes) setCategories(d.categoriesAttributes);
        if (d.pricingTax) setPricing(d.pricingTax);
        if (d.notifications) setNotifications(d.notifications);
        if (d.integrations) setIntegrations(d.integrations);
        if (d.dataBackup) setBackup(d.dataBackup);
        if (d.security) setSecurity(d.security);
      }
    } catch (e) {
      console.error('Error fetching settings', e);
    }
  };

  const fetchLocations = async () => {
    try {
      const r = await fetch('/api/warehouses');
      const d = await r.json();
      if (d.success) setWarehouses(d.data || []);
    } catch (e) {
      console.error('Error fetching warehouses', e);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const r = await fetch('/api/suppliers');
      const d = await r.json();
      if (d.success) setSuppliers(d.data || []);
    } catch (e) {
      console.error('Error fetching suppliers', e);
    }
  };

  const fetchBackups = async () => {
    try {
      const r = await fetch('/api/settings/backups');
      const d = await r.json();
      if (d.success) setBackupsList(d.data || []);
    } catch (e) {
      console.error('Error fetching backups', e);
    }
  };

  const handleSaveSection = async (section: TabType, payload: any) => {
    // Basic validations
    const errors: Record<string, string> = {};
    if (section === 'pricing') {
      if (payload.vatRate < 0 || payload.vatRate > 100) errors.vatRate = 'VAT Rate must be between 0 and 100%';
      if (payload.maxDiscount < 0 || payload.maxDiscount > 100) errors.maxDiscount = 'Max discount must be between 0 and 100%';
      if (payload.defaultMarkup < 0) errors.defaultMarkup = 'Default markup must be positive';
    }
    if (section === 'inventory') {
      if (payload.globalThreshold < 0) errors.globalThreshold = 'Low-stock threshold must be a positive integer';
      if (payload.minSize > payload.maxSize) errors.sizeRange = 'Min size cannot exceed Max size';
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      triggerToast?.('Please resolve validation errors before saving', 'error');
      return;
    }

    setSaving(true);
    setValidationErrors({});
    try {
      const r = await fetch(`/api/settings/general/${section}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const res = await r.json();
      if (res.success) {
        triggerToast?.(`${section.charAt(0).toUpperCase() + section.slice(1)} settings updated successfully`, 'success');
        fetchSettings();
      } else {
        triggerToast?.(res.error || 'Failed to save settings', 'error');
      }
    } catch (e: any) {
      triggerToast?.(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Locations / Warehouses triggers
  const handleAddLocation = async () => {
    if (!newLocation.name || !newLocation.code) {
      triggerToast?.('Name and Code are required', 'error');
      return;
    }
    try {
      const r = await fetch('/api/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLocation)
      });
      const res = await r.json();
      if (res.success) {
        triggerToast?.('Location created successfully', 'success');
        setNewLocation({ name: '', code: '', address: '', phone: '', type: 'store' });
        fetchLocations();
      } else {
        triggerToast?.(res.error || 'Failed to create location', 'error');
      }
    } catch (e: any) {
      triggerToast?.(e.message, 'error');
    }
  };

  const handleDeleteLocation = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Location?',
      desc: 'Are you sure you want to delete this warehouse/store location? This may affect stock movements.',
      action: async () => {
        try {
          const r = await fetch(`/api/warehouses/${id}`, { method: 'DELETE' });
          const res = await r.json();
          if (res.success) {
            triggerToast?.('Location deleted successfully', 'success');
            fetchLocations();
          } else {
            triggerToast?.(res.error, 'error');
          }
        } catch (e: any) {
          triggerToast?.(e.message, 'error');
        }
        setConfirmModal(null);
      }
    });
  };

  // Brands / Suppliers
  const handleAddBrand = async () => {
    if (!newBrand) return;
    try {
      const r = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newBrand, contactPerson: 'Manager', email: 'brand@example.com', phone: '' })
      });
      const res = await r.json();
      if (res.success) {
        triggerToast?.('Supplier/Brand registered', 'success');
        setNewBrand('');
        fetchSuppliers();
      }
    } catch (e: any) {
      triggerToast?.(e.message, 'error');
    }
  };

  const handleDeleteSupplier = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Remove Supplier Profile?',
      desc: 'This will delete the selected supplier profile permanently.',
      action: async () => {
        try {
          const r = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
          const res = await r.json();
          if (res.success) {
            triggerToast?.('Supplier profile removed', 'success');
            fetchSuppliers();
          }
        } catch (e: any) {
          triggerToast?.(e.message, 'error');
        }
        setConfirmModal(null);
      }
    });
  };

  // Invites
  const handleSendInvite = () => {
    if (!inviteEmail) return;
    const list = [...users.invites, { id: Math.random().toString(), emailOrPhone: inviteEmail, role: inviteRole, invitedAt: new Date().toLocaleDateString() }];
    const updated = { ...users, invites: list };
    setUsers(updated);
    handleSaveSection('users', updated);
    setInviteEmail('');
  };

  const handleCancelInvite = (id: string) => {
    const list = users.invites.filter(inv => inv.id !== id);
    const updated = { ...users, invites: list };
    setUsers(updated);
    handleSaveSection('users', updated);
  };

  // Backups triggers
  const handleTriggerBackup = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/settings/backups/create', { method: 'POST' });
      const res = await r.json();
      if (res.success) {
        triggerToast?.('Backup snapshot compiled successfully!', 'success');
        fetchBackups();
        fetchSettings();
      }
    } catch (e: any) {
      triggerToast?.(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreBackup = (filename: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Dangerous Operation: Restore Backup?',
      desc: `Are you absolutely sure you want to restore the snapshot ${filename}? This will wipe ALL current products, variants, warehouses, suppliers, sales, and orders and replace them with the backup dataset. This cannot be undone.`,
      action: async () => {
        try {
          const r = await fetch('/api/settings/backups/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
          });
          const res = await r.json();
          if (res.success) {
            triggerToast?.('Database snapshot successfully restored!', 'success');
            setTimeout(() => window.location.reload(), 1500);
          } else {
            triggerToast?.(res.error, 'error');
          }
        } catch (e: any) {
          triggerToast?.(e.message, 'error');
        }
        setConfirmModal(null);
      }
    });
  };

  // File parsing / product import
  const handleParseImport = (text: string) => {
    setImportText(text);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const preview: any[] = [];
    lines.forEach((line) => {
      const cols = line.split(/[,;\t]/).map(c => c.trim());
      if (cols.length > 1) {
        preview.push({
          name: cols[importColumns.name] || 'N/A',
          price: parseFloat(cols[importColumns.price]) || 0,
          stock: parseInt(cols[importColumns.stock]) || 0,
          brandName: cols[importColumns.brand] || 'Imported Brand',
          size: parseInt(cols[importColumns.size]) || 40,
          color: cols[importColumns.color] || 'Black'
        });
      }
    });
    setImportPreview(preview);
  };

  const handleExecuteImport = async () => {
    if (importPreview.length === 0) return;
    setSaving(true);
    try {
      // Map back to endpoint model
      const products = importPreview.map(item => ({
        name: item.name,
        description: 'Bulk imported product',
        brandName: item.brandName,
        category: 'Imported',
        gender: 'Unisex',
        basePrice: item.price,
        variants: [
          {
            size: item.size,
            color: item.color,
            price: item.price,
            currentStock: item.stock
          }
        ]
      }));

      const r = await fetch('/api/settings/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products })
      });
      const res = await r.json();
      if (res.success) {
        triggerToast?.(`${importPreview.length} products imported successfully`, 'success');
        setImportText('');
        setImportPreview([]);
      } else {
        triggerToast?.(res.error, 'error');
      }
    } catch (e: any) {
      triggerToast?.(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Left sidebar tab metadata
  const TABS = [
    { id: 'profile', label: 'Business Profile', icon: Building, desc: 'Shop details, locations & formats' },
    { id: 'inventory', label: 'Inventory Rules', icon: Sliders, desc: 'Thresholds, sizes & SKUs' },
    { id: 'users', label: 'Users & Permissions', icon: Users, desc: 'Roles, matrix & email invites' },
    { id: 'categories', label: 'Categories & Customs', icon: Tags, desc: 'Product types & dynamic attributes' },
    { id: 'pricing', label: 'Pricing & Tax', icon: Coins, desc: 'Default markup, tax, & cap rates' },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'In-app, SMTP & Telegram alerts' },
    { id: 'integrations', label: 'Integrations', icon: Link, desc: 'Chapa gateway, bots & webhooks' },
    { id: 'backup', label: 'Data & Backup', icon: Database, desc: 'CSV export, spreadsheet imports & snapshots' },
    { id: 'security', label: 'Security', icon: Lock, desc: 'Passwords, active timeouts & admin 2FA' }
  ] as const;

  return (
    <div className="flex flex-col md:flex-row gap-6 bg-slate-50/50 rounded-3xl p-2 md:p-4 border border-slate-100 min-h-[700px] animate-in fade-in duration-200">
      
      {/* SIDEBAR TABS */}
      <div className="w-full md:w-80 shrink-0 bg-white rounded-2xl border border-slate-100 p-3 flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-3.5 py-3 text-left rounded-xl transition-all shrink-0 md:shrink ${
                isActive 
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary-foreground' : 'text-slate-400'}`} />
              <div className="hidden md:block">
                <p className="text-xs font-black tracking-wide">{tab.label}</p>
                <p className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-primary-foreground/80' : 'text-slate-400'}`}>{tab.desc}</p>
              </div>
              <span className="md:hidden text-xs font-bold px-1">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* CONTENT PANEL */}
      <div className="flex-1 bg-card text-foreground rounded-2xl border border-border p-5 md:p-8 shadow-sm transition-colors duration-200">
        
        {/* TAB 1: BUSINESS PROFILE */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-foreground">Business Profile &amp; Preferences</h3>
              <p className="text-xs text-muted-foreground font-semibold mt-1">Configure your corporate branding, currency display format, operating nodes, and visual interface theme</p>
            </div>

            {/* THEME TOGGLE SWITCH */}
            <div className="bg-muted/40 border border-border rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors duration-200">
              <div>
                <h4 className="text-sm font-black text-foreground">Visual Appearance</h4>
                <p className="text-xs text-muted-foreground font-semibold mt-0.5">Toggle between Light and Dark interface themes for your session</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-black transition-colors ${currentTheme === 'light' ? 'text-primary font-extrabold' : 'text-muted-foreground'}`}>Light Mode</span>
                <button
                  onClick={() => onThemeToggle?.(currentTheme === 'light' ? 'dark' : 'light')}
                  className={`relative inline-flex h-6.5 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
                    currentTheme === 'dark' ? 'bg-primary' : 'bg-muted-foreground/30'
                  }`}
                  role="switch"
                  aria-checked={currentTheme === 'dark'}
                  aria-label="Toggle dark mode"
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      currentTheme === 'dark' ? 'translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className={`text-xs font-black transition-colors ${currentTheme === 'dark' ? 'text-primary font-extrabold' : 'text-muted-foreground'}`}>Dark Mode</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Shop Name</label>
                <input 
                  type="text" 
                  value={profile.shopName}
                  onChange={e => setProfile({ ...profile, shopName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Logo URL</label>
                <input 
                  type="text" 
                  placeholder="https://example.com/logo.png"
                  value={profile.logoUrl}
                  onChange={e => setProfile({ ...profile, logoUrl: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Business Address</label>
                <input 
                  type="text" 
                  value={profile.address}
                  onChange={e => setProfile({ ...profile, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Hotline Phone</label>
                <input 
                  type="text" 
                  value={profile.phone}
                  onChange={e => setProfile({ ...profile, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold transition-all"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Support Email Address</label>
                <input 
                  type="email" 
                  value={profile.email}
                  onChange={e => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Default Currency</label>
                <select 
                  value={profile.currency}
                  onChange={e => setProfile({ ...profile, currency: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold transition-all"
                >
                  <option value="ETB">ETB (Ethiopian Birr)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Date Representation</label>
                <select 
                  value={profile.dateFormat}
                  onChange={e => setProfile({ ...profile, dateFormat: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold transition-all"
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 07/15/2026)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 15/07/2026)</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-07-15)</option>
                </select>
              </div>
            </div>

            <button
              onClick={() => handleSaveSection('profile', profile)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save Business Profile
            </button>

            {/* LOCATION SUPPORT MANAGER */}
            <div className="pt-6 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Store &amp; Warehouse Location Nodes</h4>
              <p className="text-[11px] text-slate-400 font-semibold mb-4">Add, view, or remove physical points to maintain stock location-based movements</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <input 
                  type="text" placeholder="Location Name (e.g. Bole Store)" 
                  value={newLocation.name} onChange={e => setNewLocation({ ...newLocation, name: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                />
                <input 
                  type="text" placeholder="Code (e.g. BOLE-01)" 
                  value={newLocation.code} onChange={e => setNewLocation({ ...newLocation, code: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                />
                <select 
                  value={newLocation.type} onChange={e => setNewLocation({ ...newLocation, type: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="store">Retail Storefront</option>
                  <option value="warehouse">Main Warehouse Depot</option>
                </select>
                <input 
                  type="text" placeholder="Full Address" 
                  value={newLocation.address} onChange={e => setNewLocation({ ...newLocation, address: e.target.value })}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold md:col-span-2"
                />
                <button 
                  onClick={handleAddLocation}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
                >
                  Create Location Node
                </button>
              </div>

              <div className="divide-y divide-slate-100 border rounded-xl overflow-hidden bg-slate-50/50">
                {warehouses.map((w) => (
                  <div key={w.id} className="p-3 flex items-center justify-between text-xs font-semibold hover:bg-white transition-colors">
                    <div>
                      <span className="font-extrabold text-slate-800">{w.name}</span>
                      <span className="ml-2 bg-slate-100 text-slate-600 text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider">{w.code}</span>
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">{w.address || 'No address added'}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteLocation(w.id)}
                      className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-2 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INVENTORY RULES */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-950">Inventory &amp; SKU Settings</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">Specify global thresholds, size ranges, automatic SKU policies, and product metrics</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  Global Low-Stock Alert Level
                </label>
                <input 
                  type="number" 
                  value={inventory.globalThreshold}
                  onChange={e => setInventory({ ...inventory, globalThreshold: parseInt(e.target.value) || 0 })}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary ${
                    validationErrors.globalThreshold ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                  }`}
                />
                {validationErrors.globalThreshold ? (
                  <p className="text-[10px] text-rose-500 font-extrabold">{validationErrors.globalThreshold}</p>
                ) : (
                  <p className="text-[10px] text-slate-400 font-semibold">Generates notifications when a shoe size count falls strictly beneath this value</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">SKU Serialization Prefix</label>
                <input 
                  type="text" 
                  value={inventory.skuPrefix}
                  onChange={e => setInventory({ ...inventory, skuPrefix: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-black text-slate-800">Per-Product Override Threshold</h5>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Allow custom individual settings inside each product profile page</p>
                </div>
                <input 
                  type="checkbox"
                  checked={inventory.perProductOverride}
                  onChange={e => setInventory({ ...inventory, perProductOverride: e.target.checked })}
                  className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded border-slate-300"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-black text-slate-800">AI Reorder Point Recommendations</h5>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Toggle calculated suggestions on Dashboard restock indicators</p>
                </div>
                <input 
                  type="checkbox"
                  checked={inventory.reorderPointsToggle}
                  onChange={e => setInventory({ ...inventory, reorderPointsToggle: e.target.checked })}
                  className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded border-slate-300"
                />
              </div>

              {/* SIZE RANGE CONFIG */}
              <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 md:col-span-2 space-y-3">
                <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">Footwear Size Matrix Coverage</h5>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-[9px] font-extrabold text-slate-400 uppercase">Minimum Size (EU)</label>
                    <input 
                      type="number" 
                      value={inventory.minSize} 
                      onChange={e => setInventory({ ...inventory, minSize: parseInt(e.target.value) || 36 })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] font-extrabold text-slate-400 uppercase">Maximum Size (EU)</label>
                    <input 
                      type="number" 
                      value={inventory.maxSize} 
                      onChange={e => setInventory({ ...inventory, maxSize: parseInt(e.target.value) || 46 })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                    />
                  </div>
                </div>
                {validationErrors.sizeRange && (
                  <p className="text-[10px] text-rose-500 font-extrabold">{validationErrors.sizeRange}</p>
                )}
              </div>

              {/* COLOR PALETTE BUILDER */}
              <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 md:col-span-2 space-y-3">
                <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">Brand Color Palette Options</h5>
                <div className="flex flex-wrap gap-1.5">
                  {inventory.colors?.map((col) => (
                    <span key={col} className="inline-flex items-center gap-1.5 bg-white border px-2.5 py-1 rounded-full text-xs font-bold text-slate-700">
                      {col}
                      <button 
                        onClick={() => setInventory({ ...inventory, colors: inventory.colors.filter(c => c !== col) })}
                        className="text-slate-400 hover:text-slate-700 text-[10px] font-black"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Type new color (e.g. Navy Blue)" 
                    value={newColor}
                    onChange={e => setNewColor(e.target.value)}
                    className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                  <button 
                    onClick={() => {
                      if (!newColor || inventory.colors.includes(newColor)) return;
                      setInventory({ ...inventory, colors: [...inventory.colors, newColor] });
                      setNewColor('');
                    }}
                    className="px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleSaveSection('inventory', inventory)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save Inventory Rules
            </button>
          </div>
        )}

        {/* TAB 3: USERS & PERMISSIONS */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-950">Staff &amp; Role Permissions</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">Manage platform authorization, roles, active user registrations, and view audit toggles</p>
            </div>

            {/* ROLE PERMISSIONS MATRIX */}
            <div className="border border-slate-100 rounded-xl overflow-hidden bg-white">
              <div className="bg-slate-50 p-3 border-b border-slate-100">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">System Permission Matrix</h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b bg-slate-100/50">
                      <th className="p-3 font-extrabold text-slate-700">Capabilities</th>
                      {users.roles?.map(r => (
                        <th key={r.name} className="p-3 font-extrabold text-slate-700 text-center">{r.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {[
                      { key: 'view_cost_price', label: 'View Cost & Buying Price' },
                      { key: 'edit_stock', label: 'Modify Stock / Restocks' },
                      { key: 'delete_products', label: 'Purge / Delete Items' },
                      { key: 'view_reports', label: 'Access Financial Summaries' },
                      { key: 'manage_users', label: 'Admin Settings Access' }
                    ].map(perm => (
                      <tr key={perm.key} className="hover:bg-slate-50/50">
                        <td className="p-3 text-slate-800 font-bold">{perm.label}</td>
                        {users.roles?.map(r => {
                          const hasPerm = r.permissions.includes(perm.key);
                          return (
                            <td key={r.name} className="p-3 text-center">
                              <input 
                                type="checkbox"
                                checked={hasPerm}
                                onChange={(e) => {
                                  const list = e.target.checked 
                                    ? [...r.permissions, perm.key]
                                    : r.permissions.filter(p => p !== perm.key);
                                  const updatedRoles = users.roles.map(ur => ur.name === r.name ? { ...ur, permissions: list } : ur);
                                  setUsers({ ...users, roles: updatedRoles });
                                }}
                                className="w-4.5 h-4.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button
              onClick={() => handleSaveSection('users', users)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save Permissions Matrix
            </button>

            {/* DIRECT USER REGISTRATION (ADD USER IN SETTINGS) */}
            <div className="pt-6 border-t border-slate-100 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Add User Form */}
              <div className="lg:col-span-1 space-y-4 bg-white p-4 border border-slate-100 rounded-xl shadow-sm">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Register New User</h4>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Create registered credentials for active system staff directly</p>
                </div>

                <form onSubmit={handleAddNewUser} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. John Doe"
                      value={newUserForm.name}
                      onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                    <input 
                      type="email" 
                      placeholder="name@shoetracker.com"
                      value={newUserForm.email}
                      onChange={e => setNewUserForm({ ...newUserForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Password</label>
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      value={newUserForm.password}
                      onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Role Type</label>
                    <select 
                      value={newUserForm.role}
                      onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Admin">Admin (Owner)</option>
                      <option value="Manager">Manager</option>
                      <option value="Sales Staff">Sales Staff</option>
                      <option value="Warehouse Staff">Warehouse Staff</option>
                    </select>
                  </div>

                  <button 
                    type="submit"
                    disabled={addingUser}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {addingUser ? 'Registering...' : 'Register User'}
                  </button>
                </form>
              </div>

              {/* Registered Users List */}
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Registered Team Users</h4>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Currently registered accounts on the database</p>
                </div>

                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="p-3 font-extrabold text-slate-700">Name</th>
                        <th className="p-3 font-extrabold text-slate-700">Email</th>
                        <th className="p-3 font-extrabold text-slate-700">Role</th>
                        <th className="p-3 font-extrabold text-slate-700 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {registeredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-slate-400 font-semibold">
                            Loading registered users...
                          </td>
                        </tr>
                      ) : (
                        registeredUsers.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-bold text-slate-800">{u.name}</td>
                            <td className="p-3 text-slate-500">{u.email}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                u.role === 'Admin' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                                u.role === 'Manager' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                u.role === 'Sales Staff' ? 'bg-green-50 text-green-700 border border-green-100' :
                                'bg-slate-50 text-slate-700 border border-slate-100'
                              }`}>
                                {u.role === 'Admin' ? 'Owner (Admin)' : u.role}
                              </span>
                            </td>
                            <td className="p-3 text-right">
                              {u.id === session?.user?.id ? (
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2">You</span>
                              ) : (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-rose-600 hover:text-rose-800 hover:underline text-xs font-bold"
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CATEGORIES & ATTRIBUTES */}
        {activeTab === 'categories' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-950">Categories &amp; Attributes</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">Configure product groups, registered shoe brands, and dynamic schema descriptors</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CATEGORIES CRUD */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Product Categories</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" placeholder="Sneakers, Sandals..." 
                    value={newCategory} onChange={e => setNewCategory(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                  <button 
                    onClick={() => {
                      if (!newCategory || categories.categories.includes(newCategory)) return;
                      const list = [...categories.categories, newCategory];
                      setCategories({ ...categories, categories: list });
                      setNewCategory('');
                    }}
                    className="px-3 bg-slate-900 text-white rounded-lg text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
                <div className="divide-y divide-slate-100 border rounded-xl max-h-48 overflow-y-auto bg-slate-50/50">
                  {categories.categories?.map(cat => (
                    <div key={cat} className="p-2.5 flex items-center justify-between text-xs font-semibold hover:bg-white transition-colors">
                      <span className="text-slate-800">{cat}</span>
                      <button 
                        onClick={() => {
                          setConfirmModal({
                            isOpen: true,
                            title: 'Delete Category?',
                            desc: `Wipe the category "${cat}" from configuration?`,
                            action: () => {
                              const list = categories.categories.filter(c => c !== cat);
                              setCategories({ ...categories, categories: list });
                              setConfirmModal(null);
                            }
                          });
                        }}
                        className="text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SUPPLIERS / BRANDS MANAGER */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Brands &amp; Suppliers</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" placeholder="Nike, Adidas, Puma..." 
                    value={newBrand} onChange={e => setNewBrand(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
                  />
                  <button 
                    onClick={handleAddBrand}
                    className="px-3 bg-slate-900 text-white rounded-lg text-xs font-bold"
                  >
                    Add
                  </button>
                </div>
                <div className="divide-y divide-slate-100 border rounded-xl max-h-48 overflow-y-auto bg-slate-50/50">
                  {suppliers.map(sup => (
                    <div key={sup.id} className="p-2.5 flex items-center justify-between text-xs font-semibold hover:bg-white transition-colors">
                      <span className="text-slate-800">{sup.name}</span>
                      <button 
                        onClick={() => handleDeleteSupplier(sup.id)}
                        className="text-rose-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* DYNAMIC ATTRIBUTES BUILDER */}
              <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Dynamic Product Custom Attributes</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {categories.customAttributes?.map(attr => (
                    <div key={attr.id} className="p-3 bg-slate-50 rounded-xl border flex items-center justify-between text-xs font-semibold">
                      <div>
                        <p className="text-slate-800 font-extrabold capitalize">{attr.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold capitalize">Type: {attr.type}</p>
                      </div>
                      <button 
                        onClick={() => {
                          const list = categories.customAttributes.filter(a => a.id !== attr.id);
                          setCategories({ ...categories, customAttributes: list });
                        }}
                        className="text-rose-500 p-1 hover:bg-rose-50 rounded-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => {
                      const name = prompt('Enter custom attribute name (e.g. material, collection, season):');
                      if (!name) return;
                      const type = prompt('Enter attribute type (text, number, select):', 'text');
                      if (type !== 'text' && type !== 'number' && type !== 'select') return;
                      const newAttr = { id: Math.random().toString(), name, type: type as any };
                      setCategories({ ...categories, customAttributes: [...categories.customAttributes, newAttr] });
                    }}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-dashed rounded-xl flex items-center justify-center gap-1.5 text-xs font-black text-slate-500 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add dynamic field schema
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => handleSaveSection('categories', categories)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save Categories &amp; Customs
            </button>
          </div>
        )}

        {/* TAB 5: PRICING & TAX */}
        {activeTab === 'pricing' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-950">Pricing &amp; Tax Policy</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">Specify defaults for margin calculation, tax rates, VAT setups, and discount boundaries</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Default Retail Markup %</label>
                <input 
                  type="number" 
                  value={pricing.defaultMarkup}
                  onChange={e => setPricing({ ...pricing, defaultMarkup: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary ${
                    validationErrors.defaultMarkup ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                  }`}
                />
                {validationErrors.defaultMarkup ? (
                  <p className="text-[10px] text-rose-500 font-extrabold">{validationErrors.defaultMarkup}</p>
                ) : (
                  <p className="text-[10px] text-slate-400 font-semibold">Pre-populates selling price: Selling Price = Cost Price * (1 + markup%)</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">VAT / Government Tax rate %</label>
                <input 
                  type="number" 
                  value={pricing.vatRate}
                  onChange={e => setPricing({ ...pricing, vatRate: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary ${
                    validationErrors.vatRate ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                  }`}
                />
                {validationErrors.vatRate && (
                  <p className="text-[10px] text-rose-500 font-extrabold">{validationErrors.vatRate}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Staff Limit Cap Discount %</label>
                <input 
                  type="number" 
                  value={pricing.maxDiscount}
                  onChange={e => setPricing({ ...pricing, maxDiscount: parseFloat(e.target.value) || 0 })}
                  className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary ${
                    validationErrors.maxDiscount ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200'
                  }`}
                />
                {validationErrors.maxDiscount ? (
                  <p className="text-[10px] text-rose-500 font-extrabold">{validationErrors.maxDiscount}</p>
                ) : (
                  <p className="text-[10px] text-slate-400 font-semibold">Maximum discount rate counter staff can apply without manager overrides</p>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-black text-slate-800">Tax-Inclusive Price Entry</h5>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Show prices with dynamic VAT already added in billing and orders</p>
                </div>
                <input 
                  type="checkbox"
                  checked={pricing.taxInclusive}
                  onChange={e => setPricing({ ...pricing, taxInclusive: e.target.checked })}
                  className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded border-slate-300"
                />
              </div>
            </div>

            <button
              onClick={() => handleSaveSection('pricing', pricing)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save Pricing &amp; Tax Settings
            </button>
          </div>
        )}

        {/* TAB 6: NOTIFICATIONS */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-950">Automated Alert Channels</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">Configure live low-stock alerts, weekly summary reports, and chat delivery channels</p>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Notification Delivery Channels</h4>
              
              <div className="space-y-3">
                {[
                  { key: 'inApp', label: 'In-App Alerts', desc: 'Notify via top header badge indicator on POS and movements screens' },
                  { key: 'email', label: 'Admin Email Reports', desc: 'Dispatch daily digest containing stock logs and low inventories' },
                  { key: 'telegram', label: 'Telegram Direct Bot Alerts', desc: 'Broadcast to designated group instantly when inventory is critical' }
                ].map(channel => (
                  <div key={channel.key} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-black text-slate-800">{channel.label}</h5>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">{channel.desc}</p>
                    </div>
                    <input 
                      type="checkbox"
                      checked={(notifications as any)[channel.key]}
                      onChange={e => setNotifications({ ...notifications, [channel.key]: e.target.checked })}
                      className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded border-slate-300"
                    />
                  </div>
                ))}
              </div>

              {notifications.telegram && (
                <div className="p-4 bg-slate-50 rounded-xl border grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Telegram Bot Token</label>
                    <input 
                      type="text" 
                      placeholder="123456:ABC-DEF" 
                      value={notifications.telegramToken}
                      onChange={e => setNotifications({ ...notifications, telegramToken: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs font-semibold bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Telegram Group Chat ID</label>
                    <input 
                      type="text" 
                      placeholder="-100123456789" 
                      value={notifications.telegramChatId}
                      onChange={e => setNotifications({ ...notifications, telegramChatId: e.target.value })}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs font-semibold bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h5 className="text-xs font-black text-slate-800">Auto Daily Summary Digest</h5>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Collect and deliver daily metrics to administrator email</p>
                </div>
                <div className="flex items-center gap-3">
                  <input 
                    type="time" 
                    value={notifications.summaryDeliveryTime}
                    onChange={e => setNotifications({ ...notifications, summaryDeliveryTime: e.target.value })}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                  />
                  <input 
                    type="checkbox"
                    checked={notifications.summaryToggle}
                    onChange={e => setNotifications({ ...notifications, summaryToggle: e.target.checked })}
                    className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded border-slate-300"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => handleSaveSection('notifications', notifications)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save Notification Channels
            </button>
          </div>
        )}

        {/* TAB 7: INTEGRATIONS */}
        {activeTab === 'integrations' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-950">Third-Party Integrations</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">Connect payments gateway API credentials, chat bots, and external data webhooks</p>
            </div>

            {/* CHAPA GATEWAY */}
            <div className="p-5 border rounded-2xl bg-slate-50/50 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Chapa Payment Gateway</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Enable online mobile checkouts and instant POS receipts</p>
                </div>
                <select 
                  value={integrations.chapaMode}
                  onChange={e => setIntegrations({ ...integrations, chapaMode: e.target.value as any })}
                  className="px-3 py-1 bg-white border rounded-lg text-xs font-extrabold"
                >
                  <option value="test">Test Sandbox Mode</option>
                  <option value="live">Production Live Mode</option>
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Chapa Public Key</label>
                  <input 
                    type="text" 
                    value={integrations.chapaPublicKey}
                    onChange={e => setIntegrations({ ...integrations, chapaPublicKey: e.target.value })}
                    placeholder="CHAPAPUBK_TEST-..."
                    className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Chapa Secret Key</label>
                  <input 
                    type="password" 
                    value={integrations.chapaSecretKey}
                    onChange={e => setIntegrations({ ...integrations, chapaSecretKey: e.target.value })}
                    placeholder="CHAPASECKEY_TEST-..."
                    className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-white"
                  />
                </div>
              </div>
            </div>

            {/* TELEGRAM BOT STATUS */}
            <div className="p-4 bg-slate-50 rounded-xl border flex items-center justify-between">
              <div>
                <h5 className="text-xs font-black text-slate-800">Telegram Bot connection status</h5>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5 flex items-center gap-1">
                  Status: 
                  <span className={`font-black uppercase text-[9px] ${
                    integrations.telegramBotStatus === 'connected' ? 'text-emerald-600' : 'text-slate-500'
                  }`}>
                    {integrations.telegramBotStatus}
                  </span>
                </p>
              </div>
              <button
                onClick={() => {
                  setIntegrations({ ...integrations, telegramBotStatus: 'connected' });
                  triggerToast?.('Telegram bot connected successfully!', 'success');
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold"
              >
                Reconnect Bot
              </button>
            </div>

            {/* WEBHOOK URL */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Webhook Delivery Endpoint (Optional)</label>
              <input 
                type="text" 
                placeholder="https://yourdomain.com/api/webhooks"
                value={integrations.webhookUrl}
                onChange={e => setIntegrations({ ...integrations, webhookUrl: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold"
              />
              <p className="text-[10px] text-slate-400 font-semibold">Sends direct automated JSON payload on stock changes</p>
            </div>

            <button
              onClick={() => handleSaveSection('integrations', integrations)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save Integrations
            </button>
          </div>
        )}

        {/* TAB 8: DATA & BACKUP */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-950">Data Recovery &amp; Bulk Import</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">Export full datasets, upload product spreadsheets with custom column maps, and manage database snapshots</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* SNAPSHOT UTILITIES */}
              <div className="p-5 border rounded-2xl bg-slate-50/50 space-y-4">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Database Snapshots</h4>
                <div className="text-xs font-semibold">
                  <p className="text-slate-400">Last backup timestamp:</p>
                  <p className="text-slate-800 font-extrabold mt-0.5">{backup.lastBackupTimestamp}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleTriggerBackup}
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Trigger Backup Snapshot
                  </button>
                  <a 
                    href="/api/settings/export" 
                    className="px-4 py-2 bg-white border text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 hover:bg-slate-50 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Export JSON Data
                  </a>
                </div>
              </div>

              {/* LIST OF PAST BACKUPS */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Snapshot History</h4>
                <div className="divide-y divide-slate-100 border rounded-xl max-h-36 overflow-y-auto bg-white text-xs">
                  {backupsList.map(bk => (
                    <div key={bk.filename} className="p-2.5 flex items-center justify-between font-semibold">
                      <div>
                        <p className="text-slate-800 truncate max-w-[200px]">{bk.filename}</p>
                        <p className="text-[10px] text-slate-400 font-medium">Size: {(bk.size / 1024).toFixed(1)} KB • {bk.date}</p>
                      </div>
                      <button 
                        onClick={() => handleRestoreBackup(bk.filename)}
                        className="text-rose-600 hover:text-rose-800 text-[11px] font-black"
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                  {backupsList.length === 0 && (
                    <p className="text-center text-slate-400 font-semibold p-4">No backups saved yet.</p>
                  )}
                </div>
              </div>

              {/* BULK IMPORT PRODUCTS */}
              <div className="md:col-span-2 pt-6 border-t border-slate-100 space-y-4">
                <div>
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Spreadsheet Bulk Product Importer</h4>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Paste CSV text formatted products or comma delimited lines to compile variants bulk</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">CSV Data Content (Comma separated, headerless)</label>
                  <textarea 
                    rows={4} 
                    placeholder="e.g. Air Max 90, 120, 15, Nike, 42, Black&#10;Ultraboost 22, 180, 20, Adidas, 43, White"
                    value={importText}
                    onChange={e => handleParseImport(e.target.value)}
                    className="w-full p-3 bg-slate-50 border rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                {/* COLUMN MAPPING SELECTOR */}
                {importPreview.length > 0 && (
                  <div className="p-4 border rounded-xl bg-slate-50/50 space-y-3">
                    <h5 className="text-xs font-black text-slate-800 uppercase tracking-wide">Column Mapping Settings</h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      {[
                        { key: 'name', label: 'Name col idx' },
                        { key: 'price', label: 'Price col idx' },
                        { key: 'stock', label: 'Stock col idx' },
                        { key: 'brand', label: 'Brand col idx' },
                        { key: 'size', label: 'Size col idx' },
                        { key: 'color', label: 'Color col idx' }
                      ].map(mapItem => (
                        <div key={mapItem.key}>
                          <label className="text-[9px] text-slate-400 font-bold block mb-1">{mapItem.label}</label>
                          <input 
                            type="number" min={0} 
                            value={(importColumns as any)[mapItem.key]}
                            onChange={e => {
                              const updatedCols = { ...importColumns, [mapItem.key]: parseInt(e.target.value) || 0 };
                              setImportColumns(updatedCols);
                              // re-parse preview
                              handleParseImport(importText);
                            }}
                            className="w-full px-2 py-1 border rounded-md text-xs font-bold"
                          />
                        </div>
                      ))}
                    </div>

                    {/* PREVIEW TABLE */}
                    <div className="overflow-x-auto border rounded-lg bg-white mt-3">
                      <table className="w-full text-left text-[11px] font-semibold text-slate-600 border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b">
                            <th className="p-2 font-bold">Product Name</th>
                            <th className="p-2 font-bold">Brand</th>
                            <th className="p-2 font-bold">Price (ETB)</th>
                            <th className="p-2 font-bold">Stock</th>
                            <th className="p-2 font-bold">Size</th>
                            <th className="p-2 font-bold">Color</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {importPreview.slice(0, 5).map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="p-2 text-slate-800 font-bold">{p.name}</td>
                              <td className="p-2">{p.brandName}</td>
                              <td className="p-2 font-bold text-slate-800">{p.price}</td>
                              <td className="p-2 font-bold text-slate-800">{p.stock} pairs</td>
                              <td className="p-2">{p.size}</td>
                              <td className="p-2">{p.color}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importPreview.length > 5 && (
                      <p className="text-[10px] text-slate-400 font-bold">+ {importPreview.length - 5} more lines parsed</p>
                    )}

                    <button 
                      onClick={handleExecuteImport}
                      disabled={saving}
                      className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-black"
                    >
                      Execute Import to Database
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 9: SECURITY */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-950">Security Policy</h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">Configure staff password guidelines, terminal inactivity logouts, and MFA mandates</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Minimum Password Length</label>
                <select 
                  value={security.minPasswordLength}
                  onChange={e => setSecurity({ ...security, minPasswordLength: parseInt(e.target.value) || 8 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold transition-all"
                >
                  <option value={6}>6 Characters</option>
                  <option value={8}>8 Characters (Recommended)</option>
                  <option value={10}>10 Characters</option>
                  <option value={12}>12 Characters (High Security)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Session Timeout Duration</label>
                <select 
                  value={security.sessionTimeout}
                  onChange={e => setSecurity({ ...security, sessionTimeout: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-xs font-bold transition-all"
                >
                  <option value="15min">15 Minutes</option>
                  <option value="30min">30 Minutes</option>
                  <option value="1hr">1 Hour</option>
                  <option value="never">Never Log Out</option>
                </select>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-black text-slate-800">Enforce Special Character</h5>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Require at least one symbol (!, @, #, $, %) inside passwords</p>
                </div>
                <input 
                  type="checkbox"
                  checked={security.requireSpecialChar}
                  onChange={e => setSecurity({ ...security, requireSpecialChar: e.target.checked })}
                  className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded border-slate-300"
                />
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-black text-slate-800">Two-Factor Auth (2FA) for Admin</h5>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Prompt Authenticator OTP login checks on principal users</p>
                </div>
                <input 
                  type="checkbox"
                  checked={security.admin2FA}
                  onChange={e => setSecurity({ ...security, admin2FA: e.target.checked })}
                  className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded border-slate-300"
                />
              </div>
            </div>

            <button
              onClick={() => handleSaveSection('security', security)}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Save className="w-3.5 h-3.5" /> Save Security Policy
            </button>
          </div>
        )}

      </div>

      {/* CONFIRMATION DIALOG MODAL */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">{confirmModal.title}</h4>
                <p className="text-xs font-medium text-slate-500 mt-2 leading-relaxed">{confirmModal.desc}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 mt-6 pt-4 border-t">
              <button 
                onClick={() => setConfirmModal(null)}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-bold transition-colors"
              >
                No, Cancel
              </button>
              <button 
                onClick={confirmModal.action}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-colors"
              >
                Yes, Execute
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
