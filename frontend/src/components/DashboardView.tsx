import { useState } from 'react';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  DollarSign, 
  ArrowRight, 
  ArrowUpRight, 
  ArrowDownRight, 
  Inbox,
  RefreshCw,
  X
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { DashboardStats } from '../types.ts';

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onNavigate: (tab: string) => void;
}

const COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)'
];

export default function DashboardView({ stats, loading, onNavigate }: DashboardViewProps) {
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-500 text-xs font-semibold mt-4">Loading dashboard statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center">
        <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600 font-bold text-sm">No Dashboard Statistics Available</p>
        <p className="text-slate-400 text-xs mt-1">Make sure you have products, variants, and stock movements recorded.</p>
      </div>
    );
  }

  const {
    totalStock,
    totalValue,
    lowStockCount,
    lowStockVariants = [],
    warehouseUtilization = [],
    recentMovements = [],
    brandDistribution = [],
    totalProfit,
    dailyProfit,
    weeklyProfit,
    monthlyProfit,
    bestSellers = [],
    revenueHistory = []
  } = stats;

  return (
    <div className="space-y-6">
      
      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm/50">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">Total Inventory Stock</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1.5">{totalStock.toLocaleString()} <span className="text-xs font-semibold text-slate-400">pairs</span></h3>
            </div>
            <div className="p-2.5 bg-primary/10 text-primary rounded-xl">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-medium">Aggregate items across shops</span>
            <button onClick={() => onNavigate('products')} className="text-primary text-[10px] font-bold hover:underline flex items-center gap-0.5">
              Manage Shoes <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm/50">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">Total Stock Value</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1.5">ETB {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-medium">At current retail values</span>
            <span className="text-emerald-600 text-[10px] font-bold">Estimated asset value</span>
          </div>
        </div>

        <div 
          onClick={() => setIsLowStockModalOpen(true)}
          className={`p-5 border rounded-2xl shadow-sm/50 cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 ${
            lowStockCount > 0 ? 'bg-amber-50/40 border-amber-100 hover:bg-amber-50/70' : 'bg-white border-slate-100 hover:bg-slate-50'
          }`}
          title="Click to see which items are low stock"
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">Low Stock Warnings</p>
              <h3 className={`text-2xl font-extrabold mt-1.5 ${lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{lowStockCount} <span className="text-xs font-semibold text-slate-400">variants</span></h3>
            </div>
            <div className={`p-2.5 rounded-xl ${lowStockCount > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-50 text-slate-400'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-medium">Under alert threshold</span>
            {lowStockCount > 0 ? (
              <span className="text-amber-700 text-[10px] font-black underline decoration-dashed">View low stock items</span>
            ) : (
              <span className="text-emerald-600 text-[10px] font-bold">All levels healthy</span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm/50">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-400 text-[10px] font-bold tracking-wider uppercase">Total Sales Revenue</p>
              <h3 className="text-2xl font-extrabold text-indigo-600 mt-1.5">ETB {(stats.totalRevenue ?? totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
            </div>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
            <span className="text-slate-400 text-[10px] font-medium">Daily: ETB {(stats.dailyRevenue ?? dailyProfit).toLocaleString()}</span>
            <button onClick={() => onNavigate('sales')} className="text-indigo-600 text-[10px] font-bold hover:underline flex items-center gap-0.5">
              Sales Hub <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

      </div>

      {/* CHARTS CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* REVENUE AREA CHART */}
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm/50 lg:col-span-2">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Revenue &amp; Profit Performance</h4>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Historical daily breakdown of financial telemetry</p>
            </div>
          </div>
          <div className="h-64">
            {revenueHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={9} tickLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={9} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    labelStyle={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted-foreground)' }}
                    itemStyle={{ fontSize: '11px', padding: '1px 0', color: 'var(--foreground)' }}
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="var(--chart-1)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="profit" name="Profit" stroke="var(--chart-2)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl">
                <p className="text-slate-400 text-xs font-semibold">No historical sales data available</p>
              </div>
            )}
          </div>
        </div>

        {/* PIE CHART BRAND DISTRIBUTION */}
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm/50 flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Brand Share by Stock</h4>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Proportional breakdown of inventory brands</p>
          </div>
          <div className="h-44 my-2 flex items-center justify-center relative">
            {brandDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={brandDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {brandDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                    itemStyle={{ fontSize: '10px', color: 'var(--foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-slate-400 text-xs font-semibold">No brand data</p>
            )}
          </div>
          <div className="space-y-1.5">
            {brandDistribution.slice(0, 4).map((entry, idx) => (
              <div key={entry.name} className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span>{entry.name}</span>
                </div>
                <span className="text-slate-400 font-bold">{entry.value} pairs</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* LOWER SECTION: CRITICAL RESTOCKS & UTILIZATION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* LOW STOCK ALERTS PANEL */}
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm/50 lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <div>
              <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider text-amber-700 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Low Stock Alerts
              </h4>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">Critical variants requiring automated supplier orders</p>
            </div>
            <button onClick={() => onNavigate('products')} className="text-blue-600 text-[10px] font-bold hover:underline flex items-center gap-0.5">
              All Products <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-72 divide-y divide-slate-100">
            {lowStockVariants.length > 0 ? (
              lowStockVariants.map((item) => (
                <div key={item.id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <p className="font-extrabold text-slate-800">{item.productName} ({item.productBrand})</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">Size {item.size} • {item.color} • SKU: <span className="font-mono text-slate-500">{item.sku}</span></p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-0.5 rounded-full font-black text-[10px] tracking-wider ${
                      item.currentStock === 0 
                        ? 'bg-rose-100 text-rose-700' 
                        : item.currentStock <= 3
                        ? 'bg-amber-100 text-amber-700 font-bold'
                        : 'bg-yellow-50 text-yellow-700'
                    }`}>
                      {item.currentStock === 0 ? 'OUT OF STOCK' : `${item.currentStock} REMAINING`}
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">ETB {item.price.toLocaleString()}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <p className="text-slate-400 text-xs font-semibold">Perfect! All inventory levels are healthy and above threshold.</p>
              </div>
            )}
          </div>
        </div>

        {/* SHOP/WAREHOUSE UTILIZATION */}
        <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm/50 flex flex-col justify-between">
          <div>
            <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Shop Utilization</h4>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Current occupied space vs capacity limit</p>
          </div>
          <div className="space-y-4 my-4 flex-1 flex flex-col justify-center">
            {warehouseUtilization.map((wh) => {
              const percentage = wh.capacity > 0 ? Math.min(100, Math.round((wh.used / wh.capacity) * 100)) : 0;
              return (
                <div key={wh.name} className="space-y-1.5">
                  <div className="flex justify-between text-[11px] font-bold text-slate-700">
                    <span>{wh.name}</span>
                    <span className="text-slate-500">{wh.used} / {wh.capacity} pairs ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentage > 90 ? 'bg-rose-500' : percentage > 75 ? 'bg-amber-500' : 'bg-primary'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <button onClick={() => onNavigate('warehouses')} className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-[10px] tracking-wider uppercase transition-colors">
            Configure Shops
          </button>
        </div>

      </div>

      {/* RECENT MOVEMENTS LOG TABLE */}
      <div className="bg-white p-5 border border-slate-100 rounded-2xl shadow-sm/50">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Recent Stock Movements</h4>
            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Live stock transfer, purchase receipt, and outgoing audit trail</p>
          </div>
          <button onClick={() => onNavigate('movements')} className="text-primary text-[10px] font-bold hover:underline flex items-center gap-0.5">
            Audit Trail <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider">
                <th className="pb-2.5">Date</th>
                <th className="pb-2.5">Variant SKU</th>
                <th className="pb-2.5">Type</th>
                <th className="pb-2.5 text-center">Qty</th>
                <th className="pb-2.5">From</th>
                <th className="pb-2.5">To</th>
                <th className="pb-2.5">Reason / Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 font-medium text-slate-600">
              {recentMovements.slice(0, 5).map((mv) => (
                <tr key={mv.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 text-[10px] text-slate-400 font-bold">{new Date(mv.createdAt).toLocaleDateString()}</td>
                  <td className="py-2.5 font-mono text-slate-500 text-[10px]">{mv.variant?.sku || 'UNKNOWN'}</td>
                  <td className="py-2.5">
                    <span className={`px-2 py-0.5 rounded-md font-extrabold text-[9px] uppercase tracking-wide ${
                      mv.type === 'incoming' ? 'bg-emerald-50 text-emerald-600' :
                      mv.type === 'outgoing' ? 'bg-rose-50 text-rose-600' :
                      mv.type === 'transfer' ? 'bg-primary/10 text-primary' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {mv.type}
                    </span>
                  </td>
                  <td className="py-2.5 text-center font-bold text-slate-800">{mv.quantity}</td>
                  <td className="py-2.5 text-slate-500">{mv.fromWarehouseName || '—'}</td>
                  <td className="py-2.5 text-slate-500">{mv.toWarehouseName || '—'}</td>
                  <td className="py-2.5 text-[11px] truncate max-w-xs">{mv.reason}</td>
                </tr>
              ))}
              {recentMovements.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">No stock movements recorded yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* LOW STOCK ITEMS MODAL */}
      {isLowStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Low Stock Inventory</h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">Variants currently below critical threshold</p>
                </div>
              </div>
              <button 
                onClick={() => setIsLowStockModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 max-h-96 overflow-y-auto divide-y divide-slate-100">
              {lowStockVariants.length > 0 ? (
                lowStockVariants.map((item) => (
                  <div key={item.id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-extrabold text-slate-800">{item.productName}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">
                        Brand: <span className="text-slate-600 font-extrabold">{item.productBrand}</span> • Size: <span className="text-slate-600 font-extrabold">{item.size}</span> • Color: <span className="text-slate-600 font-extrabold">{item.color}</span>
                      </p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">SKU: {item.sku}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      <span className={`px-2.5 py-1 rounded-full font-black text-[9px] tracking-wider ${
                        item.currentStock === 0 
                          ? 'bg-rose-100 text-rose-700 font-black' 
                          : item.currentStock <= 3
                          ? 'bg-amber-100 text-amber-700 font-bold'
                          : 'bg-yellow-50 text-yellow-700 font-semibold'
                      }`}>
                        {item.currentStock === 0 ? 'OUT OF STOCK' : `${item.currentStock} PAIRS LEFT`}
                      </span>
                      <p className="text-[10px] font-extrabold text-slate-500 mt-1.5">ETB {item.price.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center">
                  <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 text-xs font-semibold">Perfect! No items are currently low on stock.</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
              <button 
                onClick={() => setIsLowStockModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-bold text-[10px] tracking-wider uppercase transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  setIsLowStockModalOpen(false);
                  onNavigate('products');
                }}
                className="px-4 py-2 bg-primary hover:bg-primary/95 text-primary-foreground rounded-xl font-bold text-[10px] tracking-wider uppercase transition-colors"
              >
                Manage Inventory
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
