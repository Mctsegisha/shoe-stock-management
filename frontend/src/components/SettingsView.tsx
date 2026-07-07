import { useState, useEffect, FormEvent } from 'react';
import { 
  Database, 
  Settings, 
  Mail, 
  Bell, 
  AlertTriangle, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Server,
  Key,
  Clock,
  Send,
  Eye,
  History
} from 'lucide-react';

interface SettingsViewProps {
  dbStatus: {
    postgresConnected: boolean;
    dbError: string | null;
    mode: string;
    configDocUrl?: string;
  } | null;
  loading: boolean;
  onReconnect: () => Promise<void>;
}

interface NotificationSettings {
  threshold: number;
  adminEmail: string;
  enableAutoEmail: boolean;
  emailMethod: 'sandbox' | 'smtp';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
}

interface EmailLog {
  id: string;
  date: string;
  recipient: string;
  subject: string;
  status: 'Simulated' | 'Delivered' | 'Failed';
  errorMessage?: string;
  lowStockItemsCount: number;
}

export default function SettingsView({ dbStatus, loading, onReconnect }: SettingsViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'database' | 'notifications'>('database');
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    threshold: 10,
    adminEmail: '',
    enableAutoEmail: true,
    emailMethod: 'sandbox',
    smtpHost: '',
    smtpPort: 465,
    smtpUser: '',
    smtpPass: '',
    smtpFrom: ''
  });
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    fetchNotificationSettings();
    fetchEmailLogs();
  }, []);

  const fetchNotificationSettings = async () => {
    try {
      const res = await fetch('/api/notifications/settings');
      const data = await res.json();
      if (data.success && data.data) {
        setNotifSettings(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch notification settings', err);
    }
  };

  const fetchEmailLogs = async () => {
    try {
      const res = await fetch('/api/notifications/logs');
      const data = await res.json();
      if (data.success && data.data) {
        setEmailLogs(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch email logs', err);
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setNotifLoading(true);
    try {
      const res = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifSettings)
      });
      const data = await res.json();
      if (data.success && data.data) {
        setNotifSettings(data.data);
        alert('Notification settings updated successfully!');
      } else {
        alert('Failed to save settings: ' + data.error);
      }
    } catch (err: any) {
      alert('Error updating settings: ' + err.message);
    } finally {
      setNotifLoading(false);
    }
  };

  const handleTriggerTest = async () => {
    setNotifLoading(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/notifications/trigger', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.data) {
        setTestResult({
          success: data.data.sent,
          message: data.data.message + '. ' + (data.data.log || '')
        });
        fetchEmailLogs();
      } else {
        setTestResult({ success: false, message: data.error || 'Trigger failed' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setNotifLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* TABS SELECTOR */}
      <div className="flex border-b border-slate-100 bg-white p-2 rounded-2xl border gap-1">
        <button 
          onClick={() => setActiveSubTab('database')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeSubTab === 'database' 
              ? 'bg-blue-50 text-blue-700' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Database className="w-4 h-4" /> Database Connectivity
        </button>
        <button 
          onClick={() => setActiveSubTab('notifications')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeSubTab === 'notifications' 
              ? 'bg-blue-50 text-blue-700' 
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Bell className="w-4 h-4" /> Stock Alerts &amp; Notifications
        </button>
      </div>

      {/* DATABASE SETTINGS */}
      {activeSubTab === 'database' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* DB DIAGNOSTICS CARD */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm/50 lg:col-span-2 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider">Database Diagnostics</h4>
                <p className="text-[11px] text-slate-400 font-medium mt-1">Live status, drivers, and schema initializers of your application</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                dbStatus?.postgresConnected ? 'bg-emerald-50 text-emerald-700 animate-pulse' : 'bg-amber-50 text-amber-700'
              }`}>
                {dbStatus?.postgresConnected ? 'PostgreSQL Active' : 'Demo Mode (In-Memory)'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Data Backend Driver</p>
                <p className="font-extrabold text-xs text-slate-800 mt-1 flex items-center gap-1.5">
                  <Server className="w-4 h-4 text-blue-500" />
                  {dbStatus?.postgresConnected ? 'Supabase cloud client' : 'NodeJS Local Storage Engine'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Storage Longevity</p>
                <p className="font-extrabold text-xs text-slate-800 mt-1">
                  {dbStatus?.postgresConnected ? 'Durable persistent storage' : 'Volatile (Wipes on server restart)'}
                </p>
              </div>
            </div>

            {dbStatus?.dbError && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-extrabold text-rose-800 uppercase tracking-wide">Connection Exception</p>
                  <p className="text-[11px] text-rose-600 font-medium mt-1 font-mono">{dbStatus.dbError}</p>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[10px] text-slate-400 font-bold max-w-sm">
                If credentials or connection URLs were recently added to the workspace, trigger a server reconnect.
              </div>
              <button 
                onClick={onReconnect}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 text-white disabled:text-slate-400 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Reconnect Database
              </button>
            </div>
          </div>

          {/* CREDENTIALS HOW TO CARD */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm/50 space-y-4">
            <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Persistent Setup</h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              By default, the application runs inside a local NodeJS sandbox memory DB. To attach a real, durable relational database:
            </p>
            <ol className="list-decimal list-inside text-[11px] text-slate-500 font-medium space-y-2.5 pl-1.5">
              <li>Open the <span className="font-extrabold text-slate-700">Settings</span> menu at the top-right of AI Studio.</li>
              <li>Provide a <span className="font-mono bg-slate-50 text-blue-600 px-1 py-0.5 border rounded">DATABASE_URL</span> environment secret representing a Supabase or other postgres connection.</li>
              <li>Click <span className="font-extrabold text-blue-600">Reconnect Database</span> on this page.</li>
            </ol>
            <p className="text-[11px] text-slate-400 font-bold leading-relaxed pt-2">
              The platform will automatically provision, structure tables, and seed stock telemetry.
            </p>
          </div>

        </div>
      )}

      {/* NOTIFICATIONS SETTINGS */}
      {activeSubTab === 'notifications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
          
          {/* NOTIFICATION SETTINGS FORM */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm/50 lg:col-span-2">
            <h4 className="font-extrabold text-sm text-slate-900 uppercase tracking-wider mb-1">Automated Stock Alerts</h4>
            <p className="text-[11px] text-slate-400 font-medium mb-6">Receive email alerts whenever variant stocks drop beneath critical thresholds</p>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Stock threshold
                  </label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    value={notifSettings.threshold}
                    onChange={(e) => setNotifSettings({ ...notifSettings, threshold: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[9px] text-slate-400 font-bold">Trigger alerts when stock drops strictly below this number</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-blue-500" /> Admin Email Recipient
                  </label>
                  <input 
                    type="email" 
                    required
                    value={notifSettings.adminEmail}
                    onChange={(e) => setNotifSettings({ ...notifSettings, adminEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[9px] text-slate-400 font-bold">Destination address for daily summary and instant warnings</p>
                </div>

              </div>

              {/* TOGGLE */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-black text-slate-800">Enable Automated Alerts</h5>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Send daily automatic checklists on sales and restocks</p>
                </div>
                <input 
                  type="checkbox"
                  checked={notifSettings.enableAutoEmail}
                  onChange={(e) => setNotifSettings({ ...notifSettings, enableAutoEmail: e.target.checked })}
                  className="w-4.5 h-4.5 text-blue-600 focus:ring-blue-500 rounded border-slate-300"
                />
              </div>

              {/* METHOD */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Alert Delivery Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNotifSettings({ ...notifSettings, emailMethod: 'sandbox' })}
                    className={`py-2 px-3 border text-xs font-bold rounded-xl text-center ${
                      notifSettings.emailMethod === 'sandbox'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm/10'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Simulated Email Logs (Safe Sandbox)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotifSettings({ ...notifSettings, emailMethod: 'smtp' })}
                    className={`py-2 px-3 border text-xs font-bold rounded-xl text-center ${
                      notifSettings.emailMethod === 'smtp'
                        ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm/10'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    Live Mail Gateway (Custom SMTP)
                  </button>
                </div>
              </div>

              {/* SMTP CONFIG FIELDS */}
              {notifSettings.emailMethod === 'smtp' && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-150">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">SMTP Host</label>
                    <input 
                      type="text" 
                      value={notifSettings.smtpHost || ''}
                      onChange={(e) => setNotifSettings({ ...notifSettings, smtpHost: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">SMTP Port</label>
                    <input 
                      type="number" 
                      value={notifSettings.smtpPort || 465}
                      onChange={(e) => setNotifSettings({ ...notifSettings, smtpPort: parseInt(e.target.value) })}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Sender Email (From)</label>
                    <input 
                      type="text" 
                      value={notifSettings.smtpFrom || ''}
                      onChange={(e) => setNotifSettings({ ...notifSettings, smtpFrom: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">SMTP User</label>
                    <input 
                      type="text" 
                      value={notifSettings.smtpUser || ''}
                      onChange={(e) => setNotifSettings({ ...notifSettings, smtpUser: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Key className="w-3 h-3 text-slate-400" /> SMTP Password
                    </label>
                    <input 
                      type="password" 
                      value={notifSettings.smtpPass || ''}
                      onChange={(e) => setNotifSettings({ ...notifSettings, smtpPass: e.target.value })}
                      placeholder="Custom SMTP Gateway Secret Key"
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs font-medium bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={handleTriggerTest}
                  disabled={notifLoading}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" /> Test Notification Check
                </button>
                <button 
                  type="submit" 
                  disabled={notifLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  Save Settings
                </button>
              </div>

            </form>

            {/* TEST NOTIFICATION RESULTS FEEDBACK */}
            {testResult && (
              <div className={`mt-5 p-4 border rounded-xl flex items-start gap-2.5 ${
                testResult.success ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                {testResult.success ? <Check className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                <div>
                  <h5 className="text-xs font-black uppercase tracking-wide">Manual Test Trigger Executed</h5>
                  <p className="text-[11px] font-medium mt-1 leading-relaxed">{testResult.message}</p>
                </div>
              </div>
            )}

          </div>

          {/* HISTORICAL EMAIL NOTIFICATION LOGS */}
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm/50 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-slate-400" />
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Alert Logs &amp; Mail Dispatch</h4>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">History logs of sent automated thresholds alert emails</p>

              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto pr-1">
                {emailLogs.map((log) => (
                  <div key={log.id} className="py-3 text-xs space-y-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(log.date).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 rounded font-extrabold uppercase ${
                        log.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' :
                        log.status === 'Simulated' ? 'bg-blue-50 text-blue-700' :
                        'bg-rose-50 text-rose-700'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                    <p className="font-extrabold text-slate-800 truncate">{log.subject}</p>
                    <p className="text-[10px] font-bold text-slate-500">To: {log.recipient}</p>
                    <p className="text-[10px] text-slate-400">Low Stock Count: <span className="font-bold text-amber-600">{log.lowStockItemsCount} items</span></p>
                  </div>
                ))}

                {emailLogs.length === 0 && (
                  <div className="py-12 text-center text-slate-400 font-semibold">
                    No alert emails sent out yet.
                  </div>
                )}
              </div>
            </div>
            
            <button onClick={fetchEmailLogs} className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-[10px] tracking-wider uppercase transition-colors mt-4">
              Refresh History Log
            </button>
          </div>

        </div>
      )}

    </div>
  );
}
