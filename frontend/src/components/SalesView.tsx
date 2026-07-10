import { useState, FormEvent } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Search, 
  Clock, 
  DollarSign, 
  RefreshCw, 
  X,
  Package,
  Building,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';
import { Sale, Variant, Warehouse } from '../types.ts';

interface SalesViewProps {
  sales: Sale[];
  variants: Variant[];
  warehouses: Warehouse[];
  loading: boolean;
  onRefresh: () => void;
  onRecordSale: (data: {
    variantId: string;
    quantity: number;
    sellingPrice: number;
    costPrice?: number;
    warehouseId: string;
  }) => Promise<any>;
}

export default function SalesView({
  sales,
  variants,
  warehouses,
  loading,
  onRefresh,
  onRecordSale
}: SalesViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);

  // Form states
  const [variantId, setVariantId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [sellingPrice, setSellingPrice] = useState(100);

  const selectedVariant = variants.find(v => v.id === variantId);
  const selectedWarehouse = warehouses.find(w => w.id === warehouseId);

  // Profit calculations
  const unitCost = selectedVariant ? selectedVariant.price * 0.6 : 0;
  const unitProfit = selectedVariant ? sellingPrice - unitCost : 0;
  const profitPercentage = selectedVariant && sellingPrice > 0 ? (unitProfit / sellingPrice) * 100 : 0;
  const totalSaleValue = quantity * sellingPrice;
  const totalProfit = quantity * unitProfit;

  const handleOpenCreate = () => {
    setErrorFeedback(null);
    const firstVar = variants[0];
    setVariantId(firstVar?.id || '');
    setWarehouseId(warehouses[0]?.id || '');
    setQuantity(1);
    setSellingPrice(firstVar ? firstVar.price : 100);
    setIsModalOpen(true);
  };

  const handleVariantSelectChange = (vId: string) => {
    setVariantId(vId);
    const v = variants.find(x => x.id === vId);
    if (v) {
      setSellingPrice(v.price);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!variantId || !warehouseId) {
      setErrorFeedback('Please select both a shoe model and warehouse/shop location.');
      return;
    }

    if (selectedVariant && selectedVariant.currentStock < quantity) {
      setErrorFeedback(`Insufficient stock! Only ${selectedVariant.currentStock} pairs available in global inventory.`);
      return;
    }

    setRecording(true);
    setErrorFeedback(null);

    try {
      await onRecordSale({
        variantId,
        quantity,
        sellingPrice,
        costPrice: unitCost,
        warehouseId
      });
      setIsModalOpen(false);
      onRefresh();
    } catch (err: any) {
      // Catch and expose the exact backend error (e.g., Insufficient stock, etc.)
      setErrorFeedback(err.message || 'Failed to record the sale. Please try again.');
    } finally {
      setRecording(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-4 border border-slate-100 rounded-2xl shadow-sm/50">
        <div>
          <h3 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">POS Sales Terminal</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Record customer sales transactions and view pricing details instantly</p>
        </div>

        <div className="flex gap-2">
          <button onClick={onRefresh} className="p-2 border border-slate-100 hover:bg-slate-50 text-slate-500 rounded-xl transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleOpenCreate} className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> Record New Sale
          </button>
        </div>
      </div>

      {/* HISTORICAL SALES LIST */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-50 bg-slate-50/20">
          <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">Historical Transactions Log</h4>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">Audit log of registered Point of Sale (POS) retail receipts</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[9px] tracking-wider bg-slate-50/50">
                <th className="p-4">Sold At</th>
                <th className="p-4">Shoe Model</th>
                <th className="p-4">Size / Color</th>
                <th className="p-4 text-center">Pairs Sold</th>
                <th className="p-4">Unit Price</th>
                <th className="p-4 text-primary font-extrabold">Total Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/30">
                  <td className="p-4 text-[10px] text-slate-400 font-bold">
                    {new Date(sale.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4 font-black text-slate-900">
                    {sale.variant?.productName || 'Shoe Item'}
                  </td>
                  <td className="p-4 text-slate-500">
                    Size {sale.variant?.size || '—'} • {sale.variant?.color || '—'}
                  </td>
                  <td className="p-4 text-center font-extrabold text-slate-800">
                    {sale.quantity}
                  </td>
                  <td className="p-4 font-bold text-slate-700">
                    ETB {sale.sellingPrice.toLocaleString()}
                  </td>
                  <td className="p-4 font-black text-primary">
                    ETB {(sale.quantity * sale.sellingPrice).toLocaleString()}
                  </td>
                </tr>
              ))}

              {sales.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400 font-semibold bg-white">
                    <ShoppingBag className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    No sales receipts recorded yet. Click &quot;Record New Sale&quot; to register a sale.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD SALE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">POS Transaction Terminal</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              
              {/* SHOE VARIANT SELECT */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Package className="w-3.5 h-3.5" /> Select Shoe Size Model
                </label>
                <select 
                  value={variantId}
                  onChange={(e) => handleVariantSelectChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white animate-pulse/10"
                >
                  <option value="" disabled>— Choose Variant —</option>
                  {variants.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.productName} (Sz {v.size} - {v.color}) [Stock: {v.currentStock} pairs available]
                    </option>
                  ))}
                </select>
              </div>

              {/* OUTLET LOCATION SELECT */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" /> Origin Shop/Outlet
                </label>
                <select 
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white"
                >
                  <option value="" disabled>— Select Origin —</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </select>
              </div>

              {/* QUANTITY & SELLING PRICE */}
              <div className="grid grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Pairs Sold</label>
                  <input 
                    type="number" 
                    required
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Selling Price (ETB)</label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

              </div>

              {/* TRANSACTION PRICING SUMMARY CARD */}
              {selectedVariant && (
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2.5">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Transaction Summary</p>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 font-bold">Unit Price</p>
                      <p className="font-extrabold text-slate-700 mt-0.5">ETB {sellingPrice.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 font-bold">Total Price</p>
                      <p className="font-black text-primary mt-0.5 text-sm">ETB {totalSaleValue.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ERROR FEEDBACK BAR */}
              {errorFeedback && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <p className="text-[11px] font-extrabold leading-relaxed">{errorFeedback}</p>
                </div>
              )}

              {/* BUTTONS */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  disabled={recording}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={recording}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 disabled:bg-primary/50 text-primary-foreground rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  {recording ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                  Record Sale
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
