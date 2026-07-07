/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Brand {
  id: string;
  name: string;
  logoUrl?: string;
  description?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  brandId: string;
  category: string;
  gender: 'Men' | 'Women' | 'Unisex' | 'Kids';
  basePrice: number;
  createdAt: string;
  updatedAt: string;
  brand?: Brand;
  variants?: Variant[];
}

export interface Variant {
  id: string;
  productId: string;
  size: string; // e.g. "9", "10", "42"
  color: string; // e.g. "Triple Black", "White/Red"
  sku: string;
  currentStock: number;
  barcode?: string;
  price: number; // variant price might differ from base price
  createdAt: string;
  productName?: string;
  productBrand?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string; // e.g. "WH-EAST", "WH-WEST"
  location: string;
  capacity: number;
  createdAt: string;
  currentStock?: number; // aggregated from movements or variants
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

export enum MovementType {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  TRANSFER = 'transfer',
  ADJUSTMENT = 'adjustment'
}

export interface Movement {
  id: string;
  variantId: string;
  fromWarehouseId: string | null;
  toWarehouseId: string | null;
  quantity: number;
  type: MovementType;
  reason: string; // e.g., "Supplier Restock", "Customer Sale", "Stock Damage"
  createdBy: string;
  createdAt: string;
  variant?: Variant;
  fromWarehouseName?: string;
  toWarehouseName?: string;
}

export enum OrderStatus {
  PENDING = 'pending',
  SHIPPED = 'shipped',
  RECEIVED = 'received',
  CANCELLED = 'cancelled'
}

export interface OrderItem {
  id: string;
  orderId: string;
  variantId: string;
  quantity: number;
  unitCost: number;
  variant?: Variant;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  orderNumber: string;
  status: OrderStatus;
  totalCost: number;
  createdAt: string;
  updatedAt: string;
  supplierName?: string;
  items?: OrderItem[];
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Dashboard statistics interface
export interface DashboardStats {
  totalStock: number;
  totalValue: number;
  lowStockCount: number;
  lowStockVariants?: {
    id: string;
    productId: string;
    size: string;
    color: string;
    sku: string;
    currentStock: number;
    barcode?: string;
    price: number;
    productName?: string;
    productBrand?: string;
  }[];
  warehouseUtilization: { name: string; capacity: number; used: number }[];
  recentMovements: Movement[];
  brandDistribution: { name: string; value: number }[];
  totalProfit: number;
  dailyProfit: number;
  weeklyProfit: number;
  monthlyProfit: number;
  bestSellers: { name: string; brand: string; quantity: number; revenue: number; profit: number }[];
  revenueHistory: { date: string; revenue: number; profit: number }[];
}

export interface Sale {
  id: string;
  variantId: string;
  quantity: number;
  sellingPrice: number;
  costPrice: number;
  profit: number;
  createdAt: string;
  variant?: Variant;
}

