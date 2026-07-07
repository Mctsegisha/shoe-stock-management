import { useState, FormEvent } from 'react';
import { 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Trash2, 
  Edit, 
  Layers, 
  Folder, 
  Tag, 
  Sparkles, 
  RefreshCw,
  MoreVertical,
  X,
  Package,
  Barcode
} from 'lucide-react';
import { Product, Brand, Variant } from '../types.ts';

interface ProductsViewProps {
  products: Product[];
  brands: Brand[];
  loading: boolean;
  onRefresh: () => void;
  onCreateProduct: (data: any) => Promise<any>;
  onUpdateProduct: (id: string, data: any) => Promise<any>;
  onDeleteProduct: (id: string) => Promise<any>;
  onCreateVariant: (data: any) => Promise<any>;
  onUpdateVariant: (id: string, data: any) => Promise<any>;
  onDeleteVariant: (id: string) => Promise<any>;
}

export default function ProductsView({
  products,
  brands,
  loading,
  onRefresh,
  onCreateProduct,
  onUpdateProduct,
  onDeleteProduct,
  onCreateVariant,
  onUpdateVariant,
  onDeleteVariant
}: ProductsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');

  // Product Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({
    name: '',
    description: '',
    brandId: '',
    category: 'Casual',
    gender: 'Unisex' as const,
    basePrice: 100
  });

  // Variant Modals
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);
  const [targetProduct, setTargetProduct] = useState<Product | null>(null);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [varForm, setVarForm] = useState({
    size: '',
    color: '',
    sku: '',
    currentStock: 0,
    barcode: '',
    price: 100
  });

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesBrand = selectedBrand === 'all' || p.brandId === selectedBrand;
    const matchesGender = selectedGender === 'all' || p.gender === selectedGender;
    return matchesSearch && matchesBrand && matchesGender;
  });

  const handleOpenProductCreate = () => {
    setEditingProduct(null);
    setProdForm({
      name: '',
      description: '',
      brandId: brands[0]?.id || '',
      category: 'Casual',
      gender: 'Unisex',
      basePrice: 100
    });
    setIsProductModalOpen(true);
  };

  const handleOpenProductEdit = (product: Product) => {
    setEditingProduct(product);
    setProdForm({
      name: product.name,
      description: product.description || '',
      brandId: product.brandId,
      category: product.category || 'Casual',
      gender: product.gender || 'Unisex',
      basePrice: product.basePrice || 100
    });
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await onUpdateProduct(editingProduct.id, prodForm);
      } else {
        await onCreateProduct(prodForm);
      }
      setIsProductModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenVariantCreate = (product: Product) => {
    setTargetProduct(product);
    setEditingVariant(null);
    setVarForm({
      size: '',
      color: '',
      sku: `${product.name.substring(0, 3).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      currentStock: 0,
      barcode: '',
      price: product.basePrice
    });
    setIsVariantModalOpen(true);
  };

  const handleOpenVariantEdit = (product: Product, variant: Variant) => {
    setTargetProduct(product);
    setEditingVariant(variant);
    setVarForm({
      size: variant.size,
      color: variant.color,
      sku: variant.sku,
      currentStock: variant.currentStock,
      barcode: variant.barcode || '',
      price: variant.price
    });
    setIsVariantModalOpen(true);
  };

  const handleVariantSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!targetProduct) return;
    try {
      if (editingVariant) {
        await onUpdateVariant(editingVariant.id, {
          ...varForm,
          productId: targetProduct.id
        });
      } else {
        await onCreateVariant({
          ...varForm,
          productId: targetProduct.id
        });
      }
      setIsVariantModalOpen(false);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProd = async (id: string) => {
    if (confirm('Are you sure you want to delete this product and all its variants?')) {
      await onDeleteProduct(id);
      onRefresh();
    }
  };

  const handleDeleteVar = async (id: string) => {
    if (confirm('Are you sure you want to delete this specific shoe size variant?')) {
      await onDeleteVariant(id);
      onRefresh();
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-4 border border-slate-100 rounded-2xl shadow-sm/50">
        <div className="flex-1 flex flex-col md:flex-row gap-3">
          
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input 
              type="text" 
              placeholder="Search shoe names, designs..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:outline-none focus:border-blue-500 rounded-xl text-xs font-medium"
            />
          </div>

          <div className="flex gap-2.5">
            <select 
              value={selectedBrand} 
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="px-3 py-2 border border-slate-200 focus:outline-none rounded-xl text-xs font-semibold text-slate-600 bg-white"
            >
              <option value="all">All Brands</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            <select 
              value={selectedGender} 
              onChange={(e) => setSelectedGender(e.target.value)}
              className="px-3 py-2 border border-slate-200 focus:outline-none rounded-xl text-xs font-semibold text-slate-600 bg-white"
            >
              <option value="all">All Genders</option>
              <option value="Men">Men</option>
              <option value="Women">Women</option>
              <option value="Unisex">Unisex</option>
              <option value="Kids">Kids</option>
            </select>
          </div>

        </div>

        <div className="flex gap-2">
          <button onClick={onRefresh} className="p-2 border border-slate-100 hover:bg-slate-50 text-slate-500 rounded-xl transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={handleOpenProductCreate} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors">
            <Plus className="w-4 h-4" /> Add Shoe Product
          </button>
        </div>
      </div>

      {/* PRODUCTS DISPLAY LIST */}
      <div className="space-y-6">
        {filteredProducts.map((product) => {
          const productBrand = brands.find(b => b.id === product.brandId);
          return (
            <div key={product.id} className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              
              {/* Product Header */}
              <div className="p-5 border-b border-slate-50 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[9px] font-extrabold rounded tracking-wider uppercase">{productBrand?.name || 'Brand'}</span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-extrabold rounded tracking-wider uppercase">{product.gender}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-extrabold rounded tracking-wider uppercase">{product.category}</span>
                  </div>
                  <h3 className="text-sm font-black text-slate-900 mt-1.5 flex items-center gap-1.5">
                    {product.name}
                    <span className="text-slate-400 font-semibold text-xs">ETB {product.basePrice.toLocaleString()} base</span>
                  </h3>
                  {product.description && (
                    <p className="text-[11px] text-slate-500 font-medium mt-1">{product.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleOpenVariantCreate(product)} className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[10px] font-extrabold shadow-sm flex items-center gap-1 transition-colors">
                    <Plus className="w-3 h-3" /> Size/Variant
                  </button>
                  <button onClick={() => handleOpenProductEdit(product)} className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-lg transition-colors">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteProd(product.id)} className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Variants List / Grid */}
              <div className="p-5">
                {product.variants && product.variants.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {product.variants.map((v) => (
                      <div key={v.id} className="p-3 border border-slate-100 hover:border-slate-200 rounded-xl flex items-center justify-between transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded">Size {v.size}</span>
                            <span className="text-xs font-semibold text-slate-600">{v.color}</span>
                          </div>
                          <p className="text-[9px] font-bold text-slate-400 font-mono mt-1">SKU: {v.sku}</p>
                          {v.barcode && (
                            <p className="text-[9px] text-slate-400 flex items-center gap-0.5 mt-0.5">
                              <Barcode className="w-3 h-3 text-slate-300" /> {v.barcode}
                            </p>
                          )}
                        </div>

                        <div className="text-right flex flex-col items-end">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                            v.currentStock === 0 ? 'bg-rose-100 text-rose-700' :
                            v.currentStock <= 5 ? 'bg-amber-100 text-amber-700' :
                            'bg-emerald-50 text-emerald-700'
                          }`}>
                            {v.currentStock} pairs
                          </span>
                          <p className="text-slate-800 text-xs font-extrabold mt-1">ETB {v.price}</p>
                          <div className="flex gap-1 mt-1.5">
                            <button onClick={() => handleOpenVariantEdit(product, v)} className="text-[9px] font-bold text-blue-600 hover:underline">Edit</button>
                            <span className="text-slate-300 text-[9px]">•</span>
                            <button onClick={() => handleDeleteVar(v.id)} className="text-[9px] font-bold text-rose-600 hover:underline">Delete</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500 text-xs font-semibold">No size variants exist for this shoe</p>
                    <button onClick={() => handleOpenVariantCreate(product)} className="text-blue-600 text-xs font-bold hover:underline mt-1">Add first size now</button>
                  </div>
                )}
              </div>

            </div>
          );
        })}

        {filteredProducts.length === 0 && !loading && (
          <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center shadow-sm/50">
            <Folder className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 font-bold text-sm">No Shoe Products Match Filters</p>
            <p className="text-slate-400 text-xs mt-1">Try resetting search filters or add a new shoe profile.</p>
          </div>
        )}
      </div>

      {/* PRODUCT CREATION/EDIT MODAL */}
      {isProductModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">
                {editingProduct ? 'Edit Shoe Product' : 'Create Shoe Product'}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleProductSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Shoe Model Name</label>
                  <input 
                    type="text" 
                    required
                    value={prodForm.name}
                    onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })}
                    placeholder="e.g. Nike Air Force 1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Brand Partner</label>
                  <select 
                    value={prodForm.brandId}
                    onChange={(e) => setProdForm({ ...prodForm, brandId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white"
                  >
                    {brands.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Base Price (ETB)</label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    value={prodForm.basePrice}
                    onChange={(e) => setProdForm({ ...prodForm, basePrice: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Category</label>
                  <input 
                    type="text" 
                    required
                    value={prodForm.category}
                    onChange={(e) => setProdForm({ ...prodForm, category: e.target.value })}
                    placeholder="e.g. Running, Casual"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Gender Target</label>
                  <select 
                    value={prodForm.gender}
                    onChange={(e) => setProdForm({ ...prodForm, gender: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 bg-white"
                  >
                    <option value="Men">Men</option>
                    <option value="Women">Women</option>
                    <option value="Unisex">Unisex</option>
                    <option value="Kids">Kids</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Product Description</label>
                  <textarea 
                    value={prodForm.description}
                    onChange={(e) => setProdForm({ ...prodForm, description: e.target.value })}
                    placeholder="Brief description of cushioning, style, premium leather..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors">
                  {editingProduct ? 'Save Changes' : 'Create Shoe Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VARIANT CREATION/EDIT MODAL */}
      {isVariantModalOpen && targetProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-100 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800 uppercase tracking-wider">
                  {editingVariant ? 'Edit Variant' : 'Add Size Variant'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{targetProduct.name}</p>
              </div>
              <button onClick={() => setIsVariantModalOpen(false)} className="p-1 hover:bg-slate-200 text-slate-400 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleVariantSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Shoe Size (US/EU)</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. 9, 10, 42"
                    value={varForm.size}
                    onChange={(e) => setVarForm({ ...varForm, size: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Colorway</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Triple Black, Royal"
                    value={varForm.color}
                    onChange={(e) => setVarForm({ ...varForm, color: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">SKU Code</label>
                  <input 
                    type="text" 
                    required
                    value={varForm.sku}
                    onChange={(e) => setVarForm({ ...varForm, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Retail Price (ETB)</label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    value={varForm.price}
                    onChange={(e) => setVarForm({ ...varForm, price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Barcode</label>
                  <input 
                    type="text" 
                    placeholder="EAN/UPC Number"
                    value={varForm.barcode}
                    onChange={(e) => setVarForm({ ...varForm, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Current Stock (Pairs)</label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    value={varForm.currentStock}
                    onChange={(e) => setVarForm({ ...varForm, currentStock: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                  />
                </div>

              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2.5">
                <button type="button" onClick={() => setIsVariantModalOpen(false)} className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors">
                  {editingVariant ? 'Save Variant' : 'Add Size to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
