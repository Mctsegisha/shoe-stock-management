import { useState, FormEvent } from 'react';
import { 
  ArrowLeftRight, 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Download, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers, 
  FileText,
  RefreshCw,
  X,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import { Movement, Variant, Warehouse, MovementType } from '../types.ts';

interface MovementsViewProps {
  movements: Movement[];
  variants: Variant[];
  warehouses: Warehouse[];
  loading: boolean;
  onRefresh: () => void;
  onCreateMovement: (data: any) => Promise<any>;
}

export default function MovementsView({
  movements,
  variants,
  warehouses,
  loading,
  onRefresh,
  onCreateMovement
}: MovementsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');

  // Direct adjustments/transfer modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    variantId: '',
    fromWarehouseId: '',
    toWarehouseId: '',
    quantity: 1,
    type: MovementType.INCOMING,
    reason: '',
    createdBy: 'Administrator'
  });

  const filteredMovements = movements.filter(m => {
    const skuString = m.variant?.sku?.toLowerCase() || '';
    const nameString = m.variant?.productName?.toLowerCase() || '';
    const matchesSearch = skuString.includes(searchTerm.toLowerCase()) || nameString.includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || m.type === selectedType;
    const matchesWarehouse = selectedWarehouse === 'all' || 
                             m.fromWarehouseId === selectedWarehouse || 
                             m.toWarehouseId === selectedWarehouse;
    return matchesSearch && matchesType && matchesWarehouse;
  });

  const handleOpenCreate = () => {
    setForm({
      variantId: variants[0]?.id || '',
      fromWarehouseId: '',
      toWarehouseId: warehouses[0]?.id || '',
      quantity: 1,
      type: MovementType.INCOMING,
      reason: '',
      createdBy: 'Administrator'
    });
    setIsModalOpen(true);
  };

  const handleTypeChange = (type: MovementType) => {
    let fromWH = '';
    let toWH = '';

    if (type === MovementType.INCOMING) {
      toWH = warehouses[0]?.id || '';
    } else if (type === MovementType.OUTGOING) {
      fromWH = warehouses[0]?.id || '';
    } else if (type === MovementType.TRANSFER) {
      fromWH = warehouses[0]?.id || '';
      toWH = warehouses[1]?.id || warehouses[0]?.id || '';
    } else { // ADJUSTMENT
      fromWH = warehouses[0]?.id || '';
    }

    setForm({
      ...form,
      type,
      fromWarehouseId: fromWH,
      toWarehouseId: toWH
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        variantId: form.variantId,
        quantity: form.quantity,
        type: form.type,
        reason: form.reason || 'Manual Adjustment',
        createdBy: form.createdBy,
        fromWarehouseId: form.fromWarehouseId || null,
        toWarehouseId: form.toWarehouseId || null
      };

      await onCreateMovement(payload);
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* CONTROLS HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 border border-slate-100 rounded-2xl shadow-sm/50">
        <div className="flex-1 flex flex-col md:flex-row gap-3">
          
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input 
              type="text" 
              placeholder="Search by SKU, product name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:outline-none focus:border-blue-500 rounded-xl text-xs font-medium"
            />
          </div>

          <div className="flex gap-2.5">
            <select 
              value={selectedType} 
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 border border-slate-200 focus:outline-none rounded-xl text-xs font-semibold text-slate-600 bg-white"
            >
              <option value="all">All Types</option>
              <option value="incoming">Incoming Restock</option>
              <option value="outgoing">Outgoing Sale</option>
              <option value="transfer">Inter-Shop Transfer</option>
              <option value="adjustment">Direct Adjustment</option>
            </select>

            <select 
              value={selectedWarehouse} 
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="px-3 py-2 border border-slate-200 focus:outline-none rounded-xl text-xs font-semibold text-slate-600 bg-white"
            >
              <option value="all">All Locations</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

        </div>

        <div className="flex gap-2">
          <button onClick={onRefresh} className="p-2 border border-slate-100 hover:bg-slate-50 text-slate-500 rounded-xl transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleOpenCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> Move Stock / Adjust
          </button>
        </div>
      </div>

      {/* MOVEMENTS LOG TABLE */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-50 bg-slate-50/20">
          <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Historical Audit Ledger</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Read-only system logging record of shoe stock movements</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider bg-slate-50/50">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Shoe Model</th>
                <th className="p-4">SKU / Size</th>
                <th className="p-4">Action</th>
                <th className="p-4 text-center">Quantity</th>
                <th className="p-4">Origin Store</th>
                <th className="p-4">Destination Store</th>
                <th className="p-4">Authorized By</th>
                <th className="p-4">Log Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
              {filteredMovements.map((mv) => (
                <tr key={mv.id} className="hover:bg-slate-50/30">
                  <td className="p-4 text-[10px] text-slate-400 font-bold">
                    {new Date(mv.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4 font-extrabold text-slate-800">
                    {mv.variant?.productName || 'Shoe Item'}
                  </td>
                  <td className="p-4">
                    <span className="font-mono text-slate-500 text-[10px] block">{mv.variant?.sku || '—'}</span>
                    <span className="text-[10px] font-bold text-slate-400">Size: {mv.variant?.size || '—'} • {mv.variant?.color || '—'}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full font-extrabold text-[9px] uppercase tracking-wide inline-flex items-center gap-1 ${
                      mv.type === 'incoming' ? 'bg-emerald-100 text-emerald-800' :
                      mv.type === 'outgoing' ? 'bg-rose-100 text-rose-800' :
                      mv.type === 'transfer' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {mv.type === 'incoming' && <ArrowDownRight className="w-2.5 h-2.5" />}
                      {mv.type === 'outgoing' && <ArrowUpRight className="w-2.5 h-2.5" />}
                      {mv.type === 'transfer' && <ArrowLeftRight className="w-2.5 h-2.5" />}
                      {mv.type}
                    </span>
                  </td>
                  <td className="p-4 text-center font-black text-slate-800">
                    {mv.type === 'outgoing' ? `-${mv.quantity}` : `+${mv.quantity}`}
                  </td>
                  <td className="p-4 text-slate-500">{mv.fromWarehouseName || '—'}</td>
                  <td className="p-4 text-slate-500">{mv.toWarehouseName || '—'}</td>
                  <td className="p-4 text-slate-500 font-bold text-[10px]">{mv.createdBy}</td>
                  <td className="p-4 text-[11px] truncate max-w-xs text-slate-500">{mv.reason}</td>
                </tr>
              ))}
              
              {filteredMovements.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-400 font-semibold bg-white">
                    <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    No logged stock movements found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* STOCK MOVEMENT ADJUSTMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Record Stock Movement</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Movement Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { type: MovementType.INCOMING, label: 'Incoming' },
                    { type: MovementType.OUTGOING, label: 'Outgoing' },
                    { type: MovementType.TRANSFER, label: 'Transfer' },
                    { type: MovementType.ADJUSTMENT, label: 'Adjust' }
                  ].map((btn) => (
                    <button
                      key={btn.type}
                      type="button"
                      onClick={() => handleTypeChange(btn.type)}
                      className={`py-2 px-1 border text-[10px] font-bold rounded-lg transition-colors text-center ${
                        form.type === btn.type
                          ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Target Shoe / SKU</label>
                <select 
                  value={form.variantId}
                  onChange={(e) => setForm({ ...form, variantId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white"
                >
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.productName} (Size {v.size} - {v.color}) [SKU: {v.sku}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    {form.type === MovementType.TRANSFER ? 'Origin Store' : 'Source Location (Optional)'}
                  </label>
                  <select 
                    value={form.fromWarehouseId}
                    onChange={(e) => setForm({ ...form, fromWarehouseId: e.target.value })}
                    disabled={form.type === MovementType.INCOMING}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">— None —</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                    {form.type === MovementType.TRANSFER ? 'Destination Store' : 'Target Location (Optional)'}
                  </label>
                  <select 
                    value={form.toWarehouseId}
                    onChange={(e) => setForm({ ...form, toWarehouseId: e.target.value })}
                    disabled={form.type === MovementType.OUTGOING}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="">— None —</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Quantity (Pairs)</label>
                  <input 
                    type="number" 
                    required
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Reason for Movement / Adjustment</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Supplier stock, periodic manual counts, damage loss"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors">
                  Execute Stock Operation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
