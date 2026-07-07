import { useState, FormEvent } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Check, 
  RefreshCw, 
  Clock, 
  Package, 
  DollarSign, 
  X, 
  ChevronRight,
  User,
  ShoppingBag,
  MoreVertical
} from 'lucide-react';
import { PurchaseOrder, Supplier, Variant, OrderStatus, OrderItem } from '../types.ts';

interface OrdersViewProps {
  orders: PurchaseOrder[];
  suppliers: Supplier[];
  variants: Variant[];
  loading: boolean;
  onRefresh: () => void;
  onCreateOrder: (data: any) => Promise<any>;
  onUpdateOrderStatus: (id: string, status: OrderStatus) => Promise<any>;
}

export default function OrdersView({
  orders,
  suppliers,
  variants,
  loading,
  onRefresh,
  onCreateOrder,
  onUpdateOrderStatus
}: OrdersViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  // New purchase order form
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState<{ variantId: string; quantity: number; unitCost: number }[]>([
    { variantId: '', quantity: 10, unitCost: 100 }
  ]);

  const handleOpenCreate = () => {
    setSupplierId(suppliers[0]?.id || '');
    setItems([{ variantId: variants[0]?.id || '', quantity: 10, unitCost: 100 }]);
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    setItems([...items, { variantId: variants[0]?.id || '', quantity: 10, unitCost: 100 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, key: 'variantId' | 'quantity' | 'unitCost', value: any) => {
    const list = [...items];
    list[index] = { ...list[index], [key]: value };
    setItems(list);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        supplierId,
        items: items.map(it => ({
          variantId: it.variantId,
          quantity: it.quantity,
          unitCost: it.unitCost
        }))
      };
      await onCreateOrder(payload);
      setIsModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (id: string, status: OrderStatus) => {
    if (confirm(`Change this purchase order status to ${status.toUpperCase()}?`)) {
      await onUpdateOrderStatus(id, status);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER CONTROLS */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-sm/50">
        <div>
          <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Purchase Orders</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Order size stock directly from manufacturer supplier partners</p>
        </div>

        <div className="flex gap-2">
          <button onClick={onRefresh} className="p-2 border border-slate-100 hover:bg-slate-50 text-slate-500 rounded-xl transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleOpenCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> Create Purchase Order
          </button>
        </div>
      </div>

      {/* DISP LAY COLUMNS AND DETAILS PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* ORDERS LIST */}
        <div className="lg:col-span-2 space-y-4 max-h-[700px] overflow-y-auto pr-1">
          {orders.map((o) => {
            const supplier = suppliers.find(s => s.id === o.supplierId);
            return (
              <div 
                key={o.id} 
                onClick={() => setSelectedOrder(o)}
                className={`p-4 border rounded-2xl shadow-sm/50 hover:shadow-sm cursor-pointer transition-all ${
                  selectedOrder?.id === o.id ? 'bg-blue-50/20 border-blue-400' : 'bg-white border-slate-100'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded tracking-wider uppercase font-mono">{o.orderNumber}</span>
                    <h4 className="text-xs font-black text-slate-900 mt-2">{o.supplierName || supplier?.name || 'Supplier'}</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">Placed: {new Date(o.createdAt).toLocaleDateString()}</p>
                  </div>

                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full font-extrabold text-[9px] tracking-wider uppercase inline-flex items-center gap-1 ${
                      o.status === OrderStatus.RECEIVED ? 'bg-emerald-100 text-emerald-800' :
                      o.status === OrderStatus.SHIPPED ? 'bg-blue-100 text-blue-800' :
                      o.status === OrderStatus.CANCELLED ? 'bg-rose-100 text-rose-800' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      <Clock className="w-2.5 h-2.5" />
                      {o.status}
                    </span>
                    <p className="text-slate-900 text-xs font-black mt-2.5">ETB {o.totalCost.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-400">
                  <span>Contains {(o.items || []).reduce((acc, it) => acc + it.quantity, 0)} pairs</span>
                  <button className="text-blue-600 flex items-center hover:underline">View Spec <ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}

          {orders.length === 0 && !loading && (
            <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm/50">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600 font-bold text-sm">No Purchase Orders Placed</p>
              <p className="text-slate-400 text-xs mt-1">Click &quot;Create Purchase Order&quot; to restock your shoe variants from wholesale suppliers.</p>
            </div>
          )}
        </div>

        {/* ORDER DETAILS PANEL */}
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm/50 self-start">
          {selectedOrder ? (
            <div className="space-y-5">
              <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Spec Details</span>
                  <h3 className="font-extrabold text-sm text-slate-900 mt-1">{selectedOrder.orderNumber}</h3>
                </div>
                <span className={`px-2 py-0.5 rounded-md font-black text-[9px] uppercase tracking-wider ${
                  selectedOrder.status === OrderStatus.RECEIVED ? 'bg-emerald-50 text-emerald-700' :
                  selectedOrder.status === OrderStatus.SHIPPED ? 'bg-blue-50 text-blue-700' :
                  selectedOrder.status === OrderStatus.CANCELLED ? 'bg-rose-50 text-rose-700' :
                  'bg-slate-50 text-slate-600'
                }`}>
                  {selectedOrder.status}
                </span>
              </div>

              {/* ACTION STATS */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Total Value</p>
                  <p className="font-extrabold text-xs text-slate-800 mt-0.5">ETB {selectedOrder.totalCost.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Items Ordered</p>
                  <p className="font-extrabold text-xs text-slate-800 mt-0.5">{(selectedOrder.items || []).reduce((sum, i) => sum + i.quantity, 0)} pairs</p>
                </div>
              </div>

              {/* ITEMS IN THE SPEC */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Size Items Ordered</p>
                <div className="divide-y divide-slate-100 overflow-y-auto max-h-56 pr-1">
                  {(selectedOrder.items || []).map((it) => (
                    <div key={it.id} className="py-2 flex justify-between items-center text-xs">
                      <div>
                        <p className="font-extrabold text-slate-800">{it.variant?.productName || 'Shoe Item'}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">Size {it.variant?.size} • {it.variant?.color} • SKU: {it.variant?.sku}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-800">{it.quantity} pairs</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">ETB {it.unitCost} ea</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ACTION CONTROLS */}
              {selectedOrder.status !== OrderStatus.RECEIVED && selectedOrder.status !== OrderStatus.CANCELLED && (
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                  {selectedOrder.status === OrderStatus.PENDING && (
                    <button 
                      onClick={() => handleUpdateStatus(selectedOrder.id, OrderStatus.SHIPPED)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                    >
                      Mark as Shipped
                    </button>
                  )}
                  {selectedOrder.status === OrderStatus.SHIPPED && (
                    <button 
                      onClick={() => handleUpdateStatus(selectedOrder.id, OrderStatus.RECEIVED)}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
                    >
                      Receive Stock into Warehouse
                    </button>
                  )}
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, OrderStatus.CANCELLED)}
                    className="w-full py-2 border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl text-xs font-bold transition-colors"
                  >
                    Cancel Order
                  </button>
                </div>
              )}

            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 font-semibold">
              <ShoppingBag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              Select a purchase order from the list to view specifications or perform logistics operations.
            </div>
          )}
        </div>

      </div>

      {/* CREATE PURCHASE ORDER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">Draft Purchase Order</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Select Partner Supplier</label>
                <select 
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.contactPerson})</option>
                  ))}
                </select>
              </div>

              {/* ORDER ITEMS LIST */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Shoe Size Items to Order</label>
                  <button type="button" onClick={handleAddItem} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-0.5">
                    <Plus className="w-3.5 h-3.5" /> Add Shoe Variant
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-3 border border-slate-100 bg-slate-50/20 rounded-xl space-y-2 relative">
                      {items.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => handleRemoveItem(idx)}
                          className="absolute right-2 top-2 p-1 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1 space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Shoe SKU</label>
                          <select 
                            value={item.variantId}
                            onChange={(e) => handleItemChange(idx, 'variantId', e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-[10px] font-semibold text-slate-600 bg-white"
                          >
                            {variants.map(v => (
                              <option key={v.id} value={v.id}>{v.productName} (Sz {v.size} {v.color.substring(0, 8)})</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Qty (Pairs)</label>
                          <input 
                            type="number" 
                            required
                            min={1}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value))}
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-[10px] font-medium"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[8px] font-black text-slate-400 uppercase tracking-wider">Unit Cost (ETB)</label>
                          <input 
                            type="number" 
                            required
                            min={1}
                            value={item.unitCost}
                            onChange={(e) => handleItemChange(idx, 'unitCost', parseFloat(e.target.value))}
                            className="w-full px-2 py-1 border border-slate-200 rounded-lg text-[10px] font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors">
                  Place Order with Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
