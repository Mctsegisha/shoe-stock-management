import { useState, FormEvent } from 'react';
import { 
  Truck, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Plus, 
  Trash2, 
  Edit, 
  RefreshCw,
  X
} from 'lucide-react';
import { Supplier } from '../types.ts';

interface SuppliersViewProps {
  suppliers: Supplier[];
  loading: boolean;
  onRefresh: () => void;
  onCreateSupplier: (data: any) => Promise<any>;
  onUpdateSupplier: (id: string, data: any) => Promise<any>;
  onDeleteSupplier: (id: string) => Promise<any>;
}

export default function SuppliersView({
  suppliers,
  loading,
  onRefresh,
  onCreateSupplier,
  onUpdateSupplier,
  onDeleteSupplier
}: SuppliersViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: ''
  });

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setForm({
      name: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setForm({
      name: s.name,
      contactPerson: s.contactPerson || '',
      email: s.email || '',
      phone: s.phone || '',
      address: s.address || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await onUpdateSupplier(editingSupplier.id, form);
      } else {
        await onCreateSupplier(form);
      }
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    await onDeleteSupplier(id);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-sm/50">
        <div>
          <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Suppliers Hub</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Manage shoe distributors, manufacturer contacts, and logistics partners</p>
        </div>

        <div className="flex gap-2">
          <button onClick={onRefresh} className="p-2 border border-slate-100 hover:bg-slate-50 text-slate-500 rounded-xl transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleOpenCreate} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> Add Supplier
          </button>
        </div>
      </div>

      {/* SUPPLIER CARD GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {suppliers.map((s) => (
          <div key={s.id} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm/50 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-black text-slate-900">{s.name}</h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> POC: {s.contactPerson || 'No specified POC'}
                  </p>
                </div>
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Truck className="w-4.5 h-4.5" />
                </div>
              </div>

              {/* CONTACT DETAILS */}
              <div className="space-y-2 text-xs text-slate-500 font-medium pt-2 border-t border-slate-50">
                {s.email && (
                  <p className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> {s.email}
                  </p>
                )}
                {s.phone && (
                  <p className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> {s.phone}
                  </p>
                )}
                {s.address && (
                  <p className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" /> 
                    <span className="line-clamp-2">{s.address}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-50 flex justify-end gap-1.5">
              <button onClick={() => handleOpenEdit(s)} className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-extrabold flex items-center gap-1 transition-colors">
                <Edit className="w-3.5 h-3.5" /> Edit Profile
              </button>
              <button onClick={() => handleDelete(s.id)} className="px-2.5 py-1.5 hover:bg-rose-50 text-rose-500 rounded-xl text-[10px] font-extrabold flex items-center gap-1 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}

        {suppliers.length === 0 && !loading && (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center col-span-full">
            <Truck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-bold text-sm">No Supplier Records</p>
            <p className="text-slate-400 text-xs mt-1">Create supplier profiles to place structured purchase orders for your shoes variants.</p>
          </div>
        )}
      </div>

      {/* CREATION/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">
                {editingSupplier ? 'Edit Supplier' : 'Register New Supplier'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Supplier / Distributor Company</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Adidas Wholesale Logistics"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Contact Person Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. John Miller"
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Email Address</label>
                  <input 
                    type="email" 
                    required
                    placeholder="e.g. logistics@adidas.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Phone number</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. +251-911-000000"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Warehouse / Office Address</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Bole Road, House 123, Addis Ababa"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm transition-colors">
                  {editingSupplier ? 'Save Supplier' : 'Register Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
