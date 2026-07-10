import pg from 'pg';
import { MovementType, OrderStatus } from '../../frontend/src/types.ts';

// Connection details
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export let isPostgresConnected = false;
export let dbError: string | null = null;
export let dbInstance: any = null;

// Mock Data definitions
export const mockData = {
  brands: [
    { id: 'b1', name: 'Nike', logoUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop', description: 'Just Do It' },
    { id: 'b2', name: 'Adidas', logoUrl: 'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?w=80&h=80&fit=crop', description: 'Impossible Is Nothing' },
    { id: 'b3', name: 'Puma', logoUrl: 'https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=80&h=80&fit=crop', description: 'Forever Faster' }
  ],
  products: [
    { id: 'p1', name: 'Air Max 90', description: 'Classic silhouette with max air cushioning', brandId: 'b1', category: 'Running', gender: 'Unisex', basePrice: 120, createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), updatedAt: new Date().toISOString() },
    { id: 'p2', name: 'Ultraboost 22', description: 'High-performance running shoes with responsive boost midsole', brandId: 'b2', category: 'Running', gender: 'Men', basePrice: 180, createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000).toISOString(), updatedAt: new Date().toISOString() },
    { id: 'p3', name: 'Classic Suede', description: 'The timeless Puma Suede sneaker', brandId: 'b3', category: 'Casual', gender: 'Unisex', basePrice: 80, createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(), updatedAt: new Date().toISOString() }
  ],
  variants: [
    { id: 'v1', productId: 'p1', size: '9', color: 'Triple Black', sku: 'NK-AM90-BLK-9', currentStock: 15, barcode: '190283012391', price: 120, createdAt: new Date().toISOString() },
    { id: 'v2', productId: 'p1', size: '10', color: 'White/Red', sku: 'NK-AM90-WHRD-10', currentStock: 4, barcode: '190283012392', price: 125, createdAt: new Date().toISOString() },
    { id: 'v3', productId: 'p2', size: '9.5', color: 'Cloud White', sku: 'AD-UB22-WHT-9.5', currentStock: 8, barcode: '400129381023', price: 180, createdAt: new Date().toISOString() },
    { id: 'v4', productId: 'p2', size: '11', color: 'Core Black', sku: 'AD-UB22-BLK-11', currentStock: 2, barcode: '400129381024', price: 180, createdAt: new Date().toISOString() },
    { id: 'v5', productId: 'p3', size: '8', color: 'Navy Blue', sku: 'PM-SUE-NVY-8', currentStock: 25, barcode: '300182739102', price: 80, createdAt: new Date().toISOString() }
  ],
  warehouses: [
    { id: 'w1', name: 'Main Distribution Center', code: 'WH-MAIN', location: 'Addis Ababa', capacity: 1000, createdAt: new Date().toISOString() },
    { id: 'w2', name: 'Bole Boutique Shop', code: 'WH-BOLE', location: 'Bole, Addis Ababa', capacity: 200, createdAt: new Date().toISOString() }
  ],
  suppliers: [
    { id: 's1', name: 'Global Footwear Distributors', contactPerson: 'John Doe', email: 'orders@globalfootwear.com', phone: '+1-555-0199', address: '123 Logistics Way, New York, NY', createdAt: new Date().toISOString() },
    { id: 's2', name: 'Apex Sports Supplies', contactPerson: 'Jane Smith', email: 'sales@apexsports.com', phone: '+1-555-0188', address: '456 Athletic Blvd, Boston, MA', createdAt: new Date().toISOString() }
  ],
  movements: [] as any[],
  orders: [] as any[],
  orderItems: [] as any[],
  sales: [] as any[],
  users: [
    { id: 'usr1', name: 'Business Owner', email: 'owner@shoetracker.com', password: 'owner123', role: 'Admin' },
    { id: 'usr2', name: 'Sales Associate', email: 'sales@shoetracker.com', password: 'sales123', role: 'Sales Staff' }
  ]
};

// Fill initial movements and sales to make Dashboard look active and fully functional
mockData.movements = [
  { id: 'm1', variantId: 'v1', fromWarehouseId: null, toWarehouseId: 'w1', quantity: 20, type: MovementType.INCOMING, reason: 'Initial Supplier Restock', createdBy: 'Admin', createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() },
  { id: 'm2', variantId: 'v2', fromWarehouseId: null, toWarehouseId: 'w1', quantity: 10, type: MovementType.INCOMING, reason: 'Initial Supplier Restock', createdBy: 'Admin', createdAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() },
  { id: 'm3', variantId: 'v1', fromWarehouseId: 'w1', toWarehouseId: 'w2', quantity: 5, type: MovementType.TRANSFER, reason: 'Shop Allocation', createdBy: 'Admin', createdAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() },
  { id: 'm4', variantId: 'v2', fromWarehouseId: 'w1', toWarehouseId: 'w2', quantity: 6, type: MovementType.TRANSFER, reason: 'Shop Allocation', createdBy: 'Admin', createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() }
];

mockData.sales = [
  { id: 'sl1', variantId: 'v1', quantity: 2, sellingPrice: 120, costPrice: 72, profit: 96, createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
  { id: 'sl2', variantId: 'v2', quantity: 2, sellingPrice: 125, costPrice: 75, profit: 100, createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
];

mockData.orders = [
  { id: 'o1', supplierId: 's1', orderNumber: 'PO-10001', status: OrderStatus.RECEIVED, totalCost: 2400, createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(), updatedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() }
];

mockData.orderItems = [
  { id: 'oi1', orderId: 'o1', variantId: 'v1', quantity: 20, unitCost: 72 },
  { id: 'oi2', orderId: 'o1', variantId: 'v2', quantity: 10, unitCost: 75 }
];

// Active memory DB state
export const inMemoryDb = JSON.parse(JSON.stringify(mockData));

export async function initializeDatabase() {
  if (DATABASE_URL) {
    console.log('Connecting to PostgreSQL Database...');
    const pool = new pg.Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
    });

    try {
      // Test connection
      await pool.query('SELECT NOW()');
      console.log('Successfully connected to PostgreSQL!');
      isPostgresConnected = true;
      dbError = null;

      // Define standard DDL to create tables automatically
      await pool.query(`
        CREATE TABLE IF NOT EXISTS brands (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          logo_url TEXT,
          description TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS products (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          brand_id VARCHAR(255) REFERENCES brands(id) ON DELETE SET NULL,
          category VARCHAR(255) DEFAULT 'Casual',
          gender VARCHAR(255) DEFAULT 'Unisex',
          base_price DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS variants (
          id VARCHAR(255) PRIMARY KEY,
          product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
          size VARCHAR(50) NOT NULL,
          color VARCHAR(255) NOT NULL,
          sku VARCHAR(255) UNIQUE NOT NULL,
          current_stock INT NOT NULL DEFAULT 0,
          barcode VARCHAR(255),
          price DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS warehouses (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(255) UNIQUE NOT NULL,
          location TEXT,
          capacity INT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS suppliers (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          contact_person VARCHAR(255),
          email VARCHAR(255),
          phone VARCHAR(255),
          address TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS movements (
          id VARCHAR(255) PRIMARY KEY,
          variant_id VARCHAR(255) REFERENCES variants(id) ON DELETE CASCADE,
          from_warehouse_id VARCHAR(255) REFERENCES warehouses(id) ON DELETE SET NULL,
          to_warehouse_id VARCHAR(255) REFERENCES warehouses(id) ON DELETE SET NULL,
          quantity INT NOT NULL,
          type VARCHAR(50) NOT NULL,
          reason TEXT,
          created_by VARCHAR(255),
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS sales (
          id VARCHAR(255) PRIMARY KEY,
          variant_id VARCHAR(255) REFERENCES variants(id) ON DELETE CASCADE,
          quantity INT NOT NULL,
          selling_price DECIMAL(10, 2) NOT NULL,
          cost_price DECIMAL(10, 2) NOT NULL,
          profit DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(255) PRIMARY KEY,
          supplier_id VARCHAR(255) REFERENCES suppliers(id) ON DELETE SET NULL,
          order_number VARCHAR(255) UNIQUE NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'pending',
          total_cost DECIMAL(10, 2) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS order_items (
          id VARCHAR(255) PRIMARY KEY,
          order_id VARCHAR(255) REFERENCES orders(id) ON DELETE CASCADE,
          variant_id VARCHAR(255) REFERENCES variants(id) ON DELETE SET NULL,
          quantity INT NOT NULL,
          unit_cost DECIMAL(10, 2) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Seed database if empty
      const brandCount = await pool.query('SELECT COUNT(*) FROM brands');
      if (parseInt(brandCount.rows[0].count) === 0) {
        console.log('Seeding database with default shoes stock data...');
        for (const b of mockData.brands) {
          await pool.query('INSERT INTO brands (id, name, logo_url, description) VALUES ($1, $2, $3, $4)', [b.id, b.name, b.logoUrl, b.description]);
        }
        for (const p of mockData.products) {
          await pool.query('INSERT INTO products (id, name, description, brand_id, category, gender, base_price) VALUES ($1, $2, $3, $4, $5, $6, $7)', [p.id, p.name, p.description, p.brandId, p.category, p.gender, p.basePrice]);
        }
        for (const v of mockData.variants) {
          await pool.query('INSERT INTO variants (id, product_id, size, color, sku, current_stock, barcode, price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [v.id, v.productId, v.size, v.color, v.sku, v.currentStock, v.barcode, v.price]);
        }
        for (const w of mockData.warehouses) {
          await pool.query('INSERT INTO warehouses (id, name, code, location, capacity) VALUES ($1, $2, $3, $4, $5)', [w.id, w.name, w.code, w.location, w.capacity]);
        }
        for (const s of mockData.suppliers) {
          await pool.query('INSERT INTO suppliers (id, name, contact_person, email, phone, address) VALUES ($1, $2, $3, $4, $5, $6)', [s.id, s.name, s.contactPerson, s.email, s.phone, s.address]);
        }
        for (const m of mockData.movements) {
          await pool.query('INSERT INTO movements (id, variant_id, from_warehouse_id, to_warehouse_id, quantity, type, reason, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [m.id, m.variantId, m.fromWarehouseId, m.toWarehouseId, m.quantity, m.type, m.reason, m.createdBy, m.createdAt]);
        }
        for (const sl of mockData.sales) {
          await pool.query('INSERT INTO sales (id, variant_id, quantity, selling_price, cost_price, profit, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [sl.id, sl.variantId, sl.quantity, sl.sellingPrice, sl.costPrice, sl.profit, sl.createdAt]);
        }
        for (const o of mockData.orders) {
          await pool.query('INSERT INTO orders (id, supplier_id, order_number, status, total_cost, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)', [o.id, o.supplierId, o.orderNumber, o.status, o.totalCost, o.createdAt, o.updatedAt]);
        }
        for (const oi of mockData.orderItems) {
          await pool.query('INSERT INTO order_items (id, order_id, variant_id, quantity, unit_cost) VALUES ($1, $2, $3, $4, $5)', [oi.id, oi.orderId, oi.variantId, oi.quantity, oi.unitCost]);
        }
        console.log('PostgreSQL database seeded successfully!');
      }

      // Independently seed users table if it's empty
      const userCountRes = await pool.query('SELECT COUNT(*) FROM users');
      if (parseInt(userCountRes.rows[0].count) === 0) {
        console.log('Seeding users table...');
        for (const u of mockData.users) {
          await pool.query('INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5)', [u.id, u.name, u.email, u.password, u.role]);
        }
        console.log('PostgreSQL users table seeded successfully!');
      }

      dbInstance = {
        session: {
          client: pool
        }
      };

    } catch (err: any) {
      console.error('Failed to initialize PostgreSQL. Falling back to Demo Mode. Error:', err.message);
      isPostgresConnected = false;
      dbError = err.message;
      dbInstance = null;
    }
  } else {
    console.log('No DATABASE_URL found. Running in Local Memory Demo Mode.');
    isPostgresConnected = false;
    dbInstance = null;
  }
}
