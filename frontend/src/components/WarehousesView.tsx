import { useState, FormEvent } from 'react';
import { 
  Building, 
  MapPin, 
  Plus, 
  Trash2, 
  Edit, 
  Layers, 
  RefreshCw,
  X
} from 'lucide-react';
import { Warehouse } from '../types.ts';

interface WarehousesViewProps {
  warehouses: Warehouse[];
  loading: boolean;
  onRefresh: () => void;
  onCreateWarehouse: (data: any) => Promise<any>;
  onUpdateWarehouse: (id: string, data: any) => Promise<any>;
  onDeleteWarehouse: (id: string) => Promise<any>;
}

export default function WarehousesView({
  warehouses,
  loading,
  onRefresh,
  onCreateWarehouse,
  onUpdateWarehouse,
  onDeleteWarehouse
}: WarehousesViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    location: '',
    capacity: 1000
  });

  const handleOpenCreate = () => {
    setEditingWarehouse(null);
    setForm({
      name: '',
      code: '',
      location: '',
      capacity: 500
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (w: Warehouse) => {
    setEditingWarehouse(w);
    setForm({
      name: w.name,
      code: w.code,
      location: w.location || '',
      capacity: w.capacity
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingWarehouse) {
        await onUpdateWarehouse(editingWarehouse.id, form);
      } else {
        await onCreateWarehouse(form);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    await onDeleteWarehouse(id);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-sm/50">
        <div>
          <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Shops &amp; Outlets</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Configure branch stores, main warehouses, and retail outlet facilities</p>
        </div>

        <div className="flex gap-2">
          <button onClick={onRefresh} className="p-2 border border-slate-100 hover:bg-slate-50 text-slate-500 rounded-xl transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleOpenCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> Add Outlet Shop
          </button>
        </div>
      </div>

      {/* GRID DISPLAY */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {warehouses.map((w) => {
          const used = w.currentStock || 0;
          const percentage = w.capacity > 0 ? Math.min(100, Math.round((used / w.capacity) * 100)) : 0;
          return (
            <div key={w.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm/50 hover:shadow-sm transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-extrabold rounded tracking-wider uppercase font-mono">{w.code}</span>
                    <h4 className="text-sm font-black text-slate-900 mt-2">{w.name}</h4>
                  </div>
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Building className="w-4 h-4" />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {w.location || 'Location Not Specified'}
                </p>

                {/* CAPACITY STATS */}
                <div className="mt-5 space-y-1.5">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>Stock Capacity Utilization</span>
                    <span className="font-extrabold text-slate-700">{used} / {w.capacity} pairs ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        percentage > 90 ? 'bg-rose-500' : percentage > 75 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-50 flex justify-end gap-1.5">
                <button onClick={() => handleOpenEdit(w)} className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-extrabold flex items-center gap-1 transition-colors">
                  <Edit className="w-3.5 h-3.5" /> Edit Shop
                </button>
                <button onClick={() => handleDelete(w.id)} className="px-2.5 py-1.5 hover:bg-rose-50 text-rose-500 rounded-xl text-[10px] font-extrabold flex items-center gap-1 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>

            </div>
          );
        })}

        {warehouses.length === 0 && !loading && (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center col-span-full">
            <Building className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-bold text-sm">No Configured Shops / Warehouses</p>
            <p className="text-slate-400 text-xs mt-1">Add your first main branch store or retail shop outlet to manage stock allocations.</p>
          </div>
        )}
      </div>

      {/* CREATION/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">
                {editingWarehouse ? 'Edit Shop Profile' : 'Configure New Shop'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Store / Outlet Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Bole Road Retail Shop"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Unique Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. WH-BOLE"
                    disabled={!!editingWarehouse}
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Stock Capacity (Pairs Limit)</label>
                  <input 
                    type="number" 
                    required
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Physical Address / Location</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Addis Ababa, Bole District"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors">
                  {editingWarehouse ? 'Save Shop Profile' : 'Configure Outlet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
