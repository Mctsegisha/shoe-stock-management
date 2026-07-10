/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';
import { 
  initializeDatabase, 
  isPostgresConnected, 
  dbInstance, 
  dbError, 
  inMemoryDb,
  mockData
} from './db/db.ts';
import { MovementType, OrderStatus } from '../frontend/src/types.ts';
import {
  getNotificationSettings,
  saveNotificationSettings,
  getEmailLogs,
  sendLowStockEmailSummary
} from './notifications.ts';
import {
  getGeneralSettings,
  saveGeneralSettings,
  triggerBackup,
  listBackups,
  loadBackupContent
} from './settings_store.ts';

// ESM compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

// Helper to generate 100% standard-compliant UUID v4 (safe for Postgres UUID and VARCHAR)
function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

function isUuid(id: any): boolean {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

function cleanUuid(id: any): string | null {
  if (!id) return null;
  if (isUuid(id)) return id;
  return null;
}

function cleanUuidWithFallback(id: any, fallback: string = '00000000-0000-0000-0000-000000000000'): string {
  if (isUuid(id)) return id;
  return fallback;
}

// Initialize database in the background
initializeDatabase().catch(err => {
  console.error('Database initialization error:', err);
});

// Helper: Response generator
const sendSuccess = (res: express.Response, data: any) => {
  res.json({ success: true, data });
};

const sendError = (res: express.Response, error: string, status = 500) => {
  res.status(status).json({ success: false, error });
};

// ==========================================
// 1. STATUS & RE-INIT ENDPOINT
// ==========================================
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    postgresConnected: isPostgresConnected,
    dbError: dbError,
    mode: isPostgresConnected ? 'PostgreSQL (Supabase)' : 'Local Memory Demo Mode',
    configDocUrl: 'https://supabase.com'
  });
});

app.post('/api/status/reconnect', async (req, res) => {
  await initializeDatabase();
  res.json({
    success: true,
    postgresConnected: isPostgresConnected,
    dbError: dbError,
    mode: isPostgresConnected ? 'PostgreSQL (Supabase)' : 'Local Memory Demo Mode'
  });
});

// ==========================================
// 1.5. AUTHENTICATION & ROLE-BASED LOGIN
// ==========================================
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return sendError(res, 'Email and password are required', 400);
  }

  let user: any = null;
  if (isPostgresConnected && dbInstance) {
    const pool = dbInstance.session.client;
    try {
      const userRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND password = $2', [email, password]);
      if (userRes.rows.length > 0) {
        const row = userRes.rows[0];
        user = { id: row.id, name: row.name, email: row.email, role: row.role };
      }
    } catch (e: any) {
      console.error('Database login query error:', e);
    }
  } 
  
  // Fallback to inMemoryDb or if Postgres query failed/yielded nothing
  if (!user) {
    const found = inMemoryDb.users.find((u: any) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (found) {
      user = { id: found.id, name: found.name, email: found.email, role: found.role };
    }
  }

  if (!user) {
    return sendError(res, 'Invalid email or password', 401);
  }

  const settings = getGeneralSettings();
  const roleObj = settings.usersPermissions?.roles?.find((r: any) => r.name === user.role);
  const permissions = roleObj ? roleObj.permissions : [];

  sendSuccess(res, { user, permissions });
});

app.get('/api/auth/me', async (req, res) => {
  const userId = req.headers['x-user-id'] as string;
  if (!userId) {
    return sendError(res, 'Not authenticated', 401);
  }
  
  let user: any = null;
  if (isPostgresConnected && dbInstance) {
    const pool = dbInstance.session.client;
    try {
      const userRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length > 0) {
        const row = userRes.rows[0];
        user = { id: row.id, name: row.name, email: row.email, role: row.role };
      }
    } catch (e: any) {
      console.error('Database user check error:', e);
    }
  }
  
  if (!user) {
    const found = inMemoryDb.users.find((u: any) => u.id === userId);
    if (found) {
      user = { id: found.id, name: found.name, email: found.email, role: found.role };
    }
  }

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  const settings = getGeneralSettings();
  const roleObj = settings.usersPermissions?.roles?.find((r: any) => r.name === user.role);
  const permissions = roleObj ? roleObj.permissions : [];

  sendSuccess(res, { user, permissions });
});

// ==========================================
// 1.6. TEAM USER MANAGEMENT
// ==========================================
app.get('/api/users', async (req, res) => {
  try {
    const requestingUserId = req.headers['x-user-id'] as string;
    let requestingUser: any = null;
    if (isPostgresConnected && dbInstance) {
      const userRes = await dbInstance.session.client.query('SELECT * FROM users WHERE id = $1', [requestingUserId]);
      if (userRes.rows.length > 0) requestingUser = userRes.rows[0];
    } else {
      requestingUser = inMemoryDb.users.find((u: any) => u.id === requestingUserId);
    }

    if (!requestingUser || requestingUser.role !== 'Admin') {
      return sendError(res, 'Unauthorized. Only business owner/admin can manage users.', 403);
    }

    let allUsers: any[] = [];
    if (isPostgresConnected && dbInstance) {
      const result = await dbInstance.session.client.query('SELECT id, name, email, role, created_at FROM users ORDER BY name ASC');
      allUsers = result.rows;
    } else {
      allUsers = inMemoryDb.users.map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
    }
    sendSuccess(res, allUsers);
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const requestingUserId = req.headers['x-user-id'] as string;
    let requestingUser: any = null;
    if (isPostgresConnected && dbInstance) {
      const userRes = await dbInstance.session.client.query('SELECT * FROM users WHERE id = $1', [requestingUserId]);
      if (userRes.rows.length > 0) requestingUser = userRes.rows[0];
    } else {
      requestingUser = inMemoryDb.users.find((u: any) => u.id === requestingUserId);
    }

    if (!requestingUser || requestingUser.role !== 'Admin') {
      return sendError(res, 'Unauthorized. Only business owner/admin can manage users.', 403);
    }

    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return sendError(res, 'All fields (name, email, password, role) are required', 400);
    }

    let existingUser = false;
    if (isPostgresConnected && dbInstance) {
      const checkRes = await dbInstance.session.client.query('SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)', [email]);
      existingUser = checkRes.rows.length > 0;
    } else {
      existingUser = inMemoryDb.users.some((u: any) => u.email.toLowerCase() === email.toLowerCase());
    }

    if (existingUser) {
      return sendError(res, 'User with this email already exists', 400);
    }

    const id = generateId();
    let newUser: any = null;
    if (isPostgresConnected && dbInstance) {
      const q = 'INSERT INTO users (id, name, email, password, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, created_at';
      const result = await dbInstance.session.client.query(q, [id, name, email, password, role]);
      newUser = result.rows[0];
    } else {
      newUser = { id, name, email, password, role };
      inMemoryDb.users.push(newUser);
    }

    sendSuccess(res, { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const requestingUserId = req.headers['x-user-id'] as string;
    let requestingUser: any = null;
    if (isPostgresConnected && dbInstance) {
      const userRes = await dbInstance.session.client.query('SELECT * FROM users WHERE id = $1', [requestingUserId]);
      if (userRes.rows.length > 0) requestingUser = userRes.rows[0];
    } else {
      requestingUser = inMemoryDb.users.find((u: any) => u.id === requestingUserId);
    }

    if (!requestingUser || requestingUser.role !== 'Admin') {
      return sendError(res, 'Unauthorized. Only business owner/admin can manage users.', 403);
    }

    const targetUserId = req.params.id;
    if (targetUserId === requestingUserId) {
      return sendError(res, 'Cannot delete yourself', 400);
    }

    if (isPostgresConnected && dbInstance) {
      await dbInstance.session.client.query('DELETE FROM users WHERE id = $1', [targetUserId]);
    } else {
      inMemoryDb.users = inMemoryDb.users.filter((u: any) => u.id !== targetUserId);
    }

    sendSuccess(res, { message: 'User deleted successfully' });
  } catch (err: any) {
    sendError(res, err.message);
  }
});

// ==========================================
// 2. DASHBOARD STATS
// ==========================================
app.get('/api/stats', async (req, res) => {
  try {
    const settings = getNotificationSettings();
    if (isPostgresConnected && dbInstance) {
      // 1. Live Postgres Queries
      const pool = dbInstance.session.client; // pg pool reference

      const stockRes = await pool.query('SELECT SUM(current_stock) as total_stock, SUM(current_stock * price) as total_value FROM variants');
      const lowStockRes = await pool.query('SELECT COUNT(*) as low_stock_count FROM variants WHERE current_stock < $1', [settings.threshold]);
      
      const lowStockVariantsRes = await pool.query(`
        SELECT v.*, p.name as product_name, b.name as brand_name
        FROM variants v
        JOIN products p ON v.product_id = p.id
        JOIN brands b ON p.brand_id = b.id
        WHERE v.current_stock < $1
        ORDER BY v.current_stock ASC, v.sku ASC
      `, [settings.threshold]);

      const lowStockVariants = lowStockVariantsRes.rows.map((vr: any) => ({
        id: vr.id,
        productId: vr.product_id,
        size: vr.size,
        color: vr.color,
        sku: vr.sku,
        currentStock: vr.current_stock,
        barcode: vr.barcode,
        price: parseFloat(vr.price),
        createdAt: vr.created_at,
        productName: vr.product_name,
        productBrand: vr.brand_name
      }));

      const whRes = await pool.query(`
        SELECT w.id, w.name, w.capacity, COALESCE(SUM(v.current_stock), 0) as used
        FROM warehouses w
        LEFT JOIN movements m ON m.to_warehouse_id = w.id OR m.from_warehouse_id = w.id
        LEFT JOIN variants v ON m.variant_id = v.id
        GROUP BY w.id, w.name, w.capacity
      `);

      const movementsRes = await pool.query(`
        SELECT m.*, v.size, v.color, v.sku, p.name as product_name, b.name as brand_name
        FROM movements m
        JOIN variants v ON m.variant_id = v.id
        JOIN products p ON v.product_id = p.id
        JOIN brands b ON p.brand_id = b.id
        ORDER BY m.created_at DESC
        LIMIT 10
      `);

      const brandRes = await pool.query(`
        SELECT b.name, COALESCE(SUM(v.current_stock), 0) as value
        FROM brands b
        LEFT JOIN products p ON p.brand_id = b.id
        LEFT JOIN variants v ON v.product_id = p.id
        GROUP BY b.id, b.name
      `);

      const totalStock = parseInt(stockRes.rows[0].total_stock) || 0;
      const totalValue = parseFloat(stockRes.rows[0].total_value) || 0;
      const lowStockCount = parseInt(lowStockRes.rows[0].low_stock_count) || 0;

      // Map recent movements
      const recentMovements = movementsRes.rows.map((row: any) => ({
        id: row.id,
        variantId: row.variant_id,
        fromWarehouseId: row.from_warehouse_id,
        toWarehouseId: row.to_warehouse_id,
        quantity: row.quantity,
        type: row.type,
        reason: row.reason,
        createdBy: row.created_by,
        createdAt: row.created_at,
        variant: {
          id: row.variant_id,
          size: row.size,
          color: row.color,
          sku: row.sku,
          productName: row.product_name,
          productBrand: row.brand_name
        }
      }));

      // Map Warehouse Utilization
      const warehouseUtilization = whRes.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        capacity: row.capacity,
        used: Math.min(row.capacity, Math.round(Math.random() * 200 + 40)) // Dynamic simulated utilization for stats dashboard
      }));

      const brandDistribution = brandRes.rows.map((row: any) => ({
        name: row.name,
        value: parseInt(row.value) || 0
      }));

      // Profit & Revenue-related queries for stats in Postgres
      const salesStatsRes = await pool.query(`
        SELECT 
          COALESCE(SUM(quantity * selling_price), 0) as total_revenue,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN quantity * selling_price ELSE 0 END), 0) as daily_revenue,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN quantity * selling_price ELSE 0 END), 0) as weekly_revenue,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN quantity * selling_price ELSE 0 END), 0) as monthly_revenue,
          COALESCE(SUM(profit), 0) as total_profit,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '1 day' THEN profit ELSE 0 END), 0) as daily_profit,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN profit ELSE 0 END), 0) as weekly_profit,
          COALESCE(SUM(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN profit ELSE 0 END), 0) as monthly_profit
        FROM sales
      `);

      const totalRevenue = parseFloat(salesStatsRes.rows[0].total_revenue) || 0;
      const dailyRevenue = parseFloat(salesStatsRes.rows[0].daily_revenue) || 0;
      const weeklyRevenue = parseFloat(salesStatsRes.rows[0].weekly_revenue) || 0;
      const monthlyRevenue = parseFloat(salesStatsRes.rows[0].monthly_revenue) || 0;

      const totalProfit = parseFloat(salesStatsRes.rows[0].total_profit) || 0;
      const dailyProfit = parseFloat(salesStatsRes.rows[0].daily_profit) || 0;
      const weeklyProfit = parseFloat(salesStatsRes.rows[0].weekly_profit) || 0;
      const monthlyProfit = parseFloat(salesStatsRes.rows[0].monthly_profit) || 0;

      const bestSellersRes = await pool.query(`
        SELECT p.name, b.name as brand, SUM(s.quantity) as quantity, SUM(s.quantity * s.selling_price) as revenue, SUM(s.profit) as profit
        FROM sales s
        JOIN variants v ON s.variant_id = v.id
        JOIN products p ON v.product_id = p.id
        JOIN brands b ON p.brand_id = b.id
        GROUP BY p.id, p.name, b.name
        ORDER BY quantity DESC
        LIMIT 5
      `);

      const revenueHistoryRes = await pool.query(`
        SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, SUM(quantity * selling_price) as revenue, SUM(profit) as profit
        FROM sales
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY date
        ORDER BY date ASC
      `);



      const bestSellers = bestSellersRes.rows.map((row: any) => ({
        name: row.name,
        brand: row.brand,
        quantity: parseInt(row.quantity) || 0,
        revenue: parseFloat(row.revenue) || 0,
        profit: parseFloat(row.profit) || 0
      }));

      // Pre-fill last 14 days with 0s to make charts smooth
      const historyMap: Record<string, { date: string; revenue: number; profit: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 3600 * 1000);
        const dStr = d.toISOString().substring(0, 10);
        historyMap[dStr] = { date: dStr, revenue: 0, profit: 0 };
      }

      revenueHistoryRes.rows.forEach((row: any) => {
        const dateStr = row.date;
        historyMap[dateStr] = {
          date: dateStr,
          revenue: parseFloat(row.revenue) || 0,
          profit: parseFloat(row.profit) || 0
        };
      });

      const revenueHistory = Object.values(historyMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      sendSuccess(res, {
        totalStock,
        totalValue,
        lowStockCount,
        lowStockVariants,
        warehouseUtilization,
        recentMovements,
        brandDistribution,
        totalRevenue,
        dailyRevenue,
        weeklyRevenue,
        monthlyRevenue,
        totalProfit,
        dailyProfit,
        weeklyProfit,
        monthlyProfit,
        bestSellers,
        revenueHistory
      });

    } else {
      // 2. In-Memory Mock Queries
      const totalStock = inMemoryDb.variants.reduce((acc, v) => acc + v.currentStock, 0);
      const totalValue = inMemoryDb.variants.reduce((acc, v) => acc + (v.currentStock * v.price), 0);
      const lowStockCount = inMemoryDb.variants.filter(v => v.currentStock < settings.threshold).length;

      const lowStockVariants = inMemoryDb.variants
        .filter(v => v.currentStock < settings.threshold)
        .map(v => {
          const product = inMemoryDb.products.find(p => p.id === v.productId);
          const brand = product ? inMemoryDb.brands.find(b => b.id === product.brandId) : null;
          return {
            ...v,
            productName: product?.name,
            productBrand: brand?.name
          };
        })
        .sort((a, b) => a.currentStock - b.currentStock);

      // Warehouse utilization mockup
      const warehouseUtilization = inMemoryDb.warehouses.map(wh => {
        // Calculate stock allocated to this warehouse from movements
        const used = inMemoryDb.movements.reduce((acc, mv) => {
          if (mv.toWarehouseId === wh.id) return acc + mv.quantity;
          if (mv.fromWarehouseId === wh.id) return acc - mv.quantity;
          return acc;
        }, 0);
        return {
          id: wh.id,
          name: wh.name,
          capacity: wh.capacity,
          used: Math.max(0, used)
        };
      });

      // Recent movements details
      const recentMovements = inMemoryDb.movements
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(mv => {
          const variant = inMemoryDb.variants.find(v => v.id === mv.variantId);
          const product = variant ? inMemoryDb.products.find(p => p.id === variant.productId) : null;
          const brand = product ? inMemoryDb.brands.find(b => b.id === product.brandId) : null;

          return {
            ...mv,
            variant: variant ? {
              ...variant,
              productName: product?.name,
              productBrand: brand?.name
            } : undefined
          };
        });

      // Brand distribution
      const brandDistribution = inMemoryDb.brands.map(b => {
        const value = inMemoryDb.products
          .filter(p => p.brandId === b.id)
          .reduce((sum, p) => {
            const prodVariants = inMemoryDb.variants.filter(v => v.productId === p.id);
            return sum + prodVariants.reduce((s, v) => s + v.currentStock, 0);
          }, 0);

        return { name: b.name, value };
      });

      // Compute in-memory revenue and profit statistics
      const totalRevenue = inMemoryDb.sales.reduce((sum, s) => sum + (s.quantity * s.sellingPrice), 0);
      const totalProfit = inMemoryDb.sales.reduce((sum, s) => sum + Number(s.profit), 0);
      const nowMs = Date.now();

      const dailyRevenue = inMemoryDb.sales
        .filter(s => nowMs - new Date(s.createdAt).getTime() <= 24 * 3600 * 1000)
        .reduce((sum, s) => sum + (s.quantity * s.sellingPrice), 0);
      const dailyProfit = inMemoryDb.sales
        .filter(s => nowMs - new Date(s.createdAt).getTime() <= 24 * 3600 * 1000)
        .reduce((sum, s) => sum + Number(s.profit), 0);

      const weeklyRevenue = inMemoryDb.sales
        .filter(s => nowMs - new Date(s.createdAt).getTime() <= 7 * 24 * 3600 * 1000)
        .reduce((sum, s) => sum + (s.quantity * s.sellingPrice), 0);
      const weeklyProfit = inMemoryDb.sales
        .filter(s => nowMs - new Date(s.createdAt).getTime() <= 7 * 24 * 3600 * 1000)
        .reduce((sum, s) => sum + Number(s.profit), 0);

      const monthlyRevenue = inMemoryDb.sales
        .filter(s => nowMs - new Date(s.createdAt).getTime() <= 30 * 24 * 3600 * 1000)
        .reduce((sum, s) => sum + (s.quantity * s.sellingPrice), 0);
      const monthlyProfit = inMemoryDb.sales
        .filter(s => nowMs - new Date(s.createdAt).getTime() <= 30 * 24 * 3600 * 1000)
        .reduce((sum, s) => sum + Number(s.profit), 0);

      // Best sellers in-memory
      const groups: Record<string, { name: string; brand: string; quantity: number; revenue: number; profit: number }> = {};
      inMemoryDb.sales.forEach(s => {
        const variant = inMemoryDb.variants.find(v => v.id === s.variantId);
        if (!variant) return;
        const product = inMemoryDb.products.find(p => p.id === variant.productId);
        if (!product) return;
        const brand = product ? inMemoryDb.brands.find(b => b.id === product.brandId) : null;
        
        const key = product.id;
        if (!groups[key]) {
          groups[key] = {
            name: product.name,
            brand: brand ? brand.name : 'Unknown',
            quantity: 0,
            revenue: 0,
            profit: 0
          };
        }
        groups[key].quantity += s.quantity;
        groups[key].revenue += s.quantity * s.sellingPrice;
        groups[key].profit += s.profit;
      });
      const bestSellers = Object.values(groups)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Chronological history map for charts
      const historyMap: Record<string, { date: string; revenue: number; profit: number }> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 3600 * 1000);
        const dStr = d.toISOString().substring(0, 10);
        historyMap[dStr] = { date: dStr, revenue: 0, profit: 0 };
      }

      inMemoryDb.sales.forEach(s => {
        const dateStr = s.createdAt.substring(0, 10); // "YYYY-MM-DD"
        if (!historyMap[dateStr]) {
          historyMap[dateStr] = { date: dateStr, revenue: 0, profit: 0 };
        }
        historyMap[dateStr].revenue += s.quantity * s.sellingPrice;
        historyMap[dateStr].profit += s.profit;
      });
      const revenueHistory = Object.values(historyMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      sendSuccess(res, {
        totalStock,
        totalValue,
        lowStockCount,
        lowStockVariants,
        warehouseUtilization,
        recentMovements,
        brandDistribution,
        totalRevenue,
        dailyRevenue,
        weeklyRevenue,
        monthlyRevenue,
        totalProfit,
        dailyProfit,
        weeklyProfit,
        monthlyProfit,
        bestSellers,
        revenueHistory
      });
    }
  } catch (error: any) {
    sendError(res, error?.message || 'Failed to fetch dashboard stats');
  }
});

// ==========================================
// 3. BRANDS CRUD
// ==========================================
app.get('/api/brands', async (req, res) => {
  try {
    if (isPostgresConnected && dbInstance) {
      const result = await dbInstance.session.client.query('SELECT * FROM brands ORDER BY name ASC');
      sendSuccess(res, result.rows);
    } else {
      sendSuccess(res, inMemoryDb.brands);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/brands', async (req, res) => {
  const { name, logoUrl, description } = req.body;
  if (!name) return sendError(res, 'Brand name is required', 400);

  try {
    const id = generateId();
    if (isPostgresConnected && dbInstance) {
      const q = 'INSERT INTO brands (id, name, logo_url, description) VALUES ($1, $2, $3, $4) RETURNING *';
      const result = await dbInstance.session.client.query(q, [id, name, logoUrl || null, description || null]);
      sendSuccess(res, result.rows[0]);
    } else {
      const newBrand = { id, name, logoUrl, description };
      inMemoryDb.brands.push(newBrand);
      sendSuccess(res, newBrand);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

// ==========================================
// 4. PRODUCTS CRUD
// ==========================================
app.get('/api/products', async (req, res) => {
  try {
    if (isPostgresConnected && dbInstance) {
      const q = `
        SELECT p.*, b.name as brand_name, b.logo_url as brand_logo
        FROM products p
        JOIN brands b ON p.brand_id = b.id
        ORDER BY p.created_at DESC
      `;
      const result = await dbInstance.session.client.query(q);
      
      // For each product, fetch its variants
      const productsList = [];
      for (const row of result.rows) {
        const vResult = await dbInstance.session.client.query(
          'SELECT * FROM variants WHERE product_id = $1 ORDER BY size ASC',
          [row.id]
        );
        productsList.push({
          id: row.id,
          name: row.name,
          description: row.description,
          brandId: row.brand_id,
          category: row.category,
          gender: row.gender,
          basePrice: parseFloat(row.base_price),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          brand: {
            id: row.brand_id,
            name: row.brand_name,
            logoUrl: row.brand_logo
          },
          variants: vResult.rows.map((vr: any) => ({
            id: vr.id,
            productId: vr.product_id,
            size: vr.size,
            color: vr.color,
            sku: vr.sku,
            currentStock: vr.current_stock,
            barcode: vr.barcode,
            price: parseFloat(vr.price),
            createdAt: vr.created_at
          }))
        });
      }
      sendSuccess(res, productsList);
    } else {
      const productsList = inMemoryDb.products.map(p => {
        const brand = inMemoryDb.brands.find(b => b.id === p.brandId);
        const variants = inMemoryDb.variants.filter(v => v.productId === p.id);
        return {
          ...p,
          brand,
          variants
        };
      });
      sendSuccess(res, productsList);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/products', async (req, res) => {
  const { name, description, brandId, category, gender, basePrice } = req.body;
  if (!name || !brandId || !basePrice) {
    return sendError(res, 'Name, brandId, and basePrice are required', 400);
  }

  if (!isUuid(brandId)) {
    return sendError(res, 'Invalid brand ID format. Please refresh your browser.', 400);
  }

  try {
    const id = generateId();
    if (isPostgresConnected && dbInstance) {
      const q = `
        INSERT INTO products (id, name, description, brand_id, category, gender, base_price)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const result = await dbInstance.session.client.query(q, [
        id, name, description || '', brandId, category || 'Sneaker', gender || 'Unisex', basePrice
      ]);
      const row = result.rows[0];
      const mappedProduct = {
        id: row.id,
        name: row.name,
        description: row.description,
        brandId: row.brand_id,
        category: row.category,
        gender: row.gender,
        basePrice: parseFloat(row.base_price),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        brand: null,
        variants: []
      };
      sendSuccess(res, mappedProduct);
    } else {
      const newProduct = {
        id,
        name,
        description: description || '',
        brandId,
        category: category || 'Sneaker',
        gender: gender || 'Unisex',
        basePrice: parseFloat(basePrice),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      inMemoryDb.products.push(newProduct);
      sendSuccess(res, newProduct);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.put('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, brandId, category, gender, basePrice } = req.body;

  if (!isUuid(id)) {
    return sendError(res, 'Invalid product ID format. Please refresh your browser.', 400);
  }
  if (brandId && !isUuid(brandId)) {
    return sendError(res, 'Invalid brand ID format. Please refresh your browser.', 400);
  }

  try {
    if (isPostgresConnected && dbInstance) {
      const q = `
        UPDATE products 
        SET name = $1, description = $2, brand_id = $3, category = $4, gender = $5, base_price = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING *
      `;
      const result = await dbInstance.session.client.query(q, [
        name, description, brandId, category, gender, basePrice, id
      ]);
      if (result.rows.length === 0) return sendError(res, 'Product not found', 404);
      const row = result.rows[0];
      const mappedProduct = {
        id: row.id,
        name: row.name,
        description: row.description,
        brandId: row.brand_id,
        category: row.category,
        gender: row.gender,
        basePrice: parseFloat(row.base_price),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
      sendSuccess(res, mappedProduct);
    } else {
      const idx = inMemoryDb.products.findIndex(p => p.id === id);
      if (idx === -1) return sendError(res, 'Product not found', 404);

      inMemoryDb.products[idx] = {
        ...inMemoryDb.products[idx],
        name,
        description,
        brandId,
        category,
        gender,
        basePrice: parseFloat(basePrice),
        updatedAt: new Date().toISOString()
      };
      sendSuccess(res, inMemoryDb.products[idx]);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return sendError(res, 'Invalid product ID format. Please refresh your browser.', 400);
  }
  try {
    if (isPostgresConnected && dbInstance) {
      const result = await dbInstance.session.client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return sendError(res, 'Product not found', 404);
      sendSuccess(res, { message: 'Product deleted' });
    } else {
      const idx = inMemoryDb.products.findIndex(p => p.id === id);
      if (idx === -1) return sendError(res, 'Product not found', 404);
      inMemoryDb.products.splice(idx, 1);
      // Cascade delete variants
      inMemoryDb.variants = inMemoryDb.variants.filter(v => v.productId !== id);
      sendSuccess(res, { message: 'Product and associated variants deleted' });
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

// ==========================================
// 5. VARIANTS CRUD
// ==========================================
app.get('/api/variants', async (req, res) => {
  try {
    if (isPostgresConnected && dbInstance) {
      const q = `
        SELECT v.*, p.name as product_name, b.name as brand_name
        FROM variants v
        JOIN products p ON v.product_id = p.id
        JOIN brands b ON p.brand_id = b.id
        ORDER BY v.sku ASC
      `;
      const result = await dbInstance.session.client.query(q);
      const variantsList = result.rows.map((vr: any) => ({
        id: vr.id,
        productId: vr.product_id,
        size: vr.size,
        color: vr.color,
        sku: vr.sku,
        currentStock: vr.current_stock,
        barcode: vr.barcode,
        price: parseFloat(vr.price),
        createdAt: vr.created_at,
        productName: vr.product_name,
        productBrand: vr.brand_name
      }));
      sendSuccess(res, variantsList);
    } else {
      const variantsList = inMemoryDb.variants.map(v => {
        const product = inMemoryDb.products.find(p => p.id === v.productId);
        const brand = product ? inMemoryDb.brands.find(b => b.id === product.brandId) : null;
        return {
          ...v,
          productName: product?.name,
          productBrand: brand?.name
        };
      });
      sendSuccess(res, variantsList);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/variants', async (req, res) => {
  const { productId, size, color, sku, barcode, price, currentStock } = req.body;
  if (!productId || !size || !color || !sku || !price) {
    return sendError(res, 'productId, size, color, sku, and price are required', 400);
  }

  if (!isUuid(productId)) {
    return sendError(res, 'Invalid product ID format. Please refresh your browser.', 400);
  }

  try {
    const id = generateId();
    const initialStock = parseInt(currentStock) || 0;
    if (isPostgresConnected && dbInstance) {
      const q = `
        INSERT INTO variants (id, product_id, size, color, sku, barcode, price, current_stock)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      const result = await dbInstance.session.client.query(q, [
        id, productId, size, color, sku, barcode || null, price, initialStock
      ]);
      const row = result.rows[0];
      const mappedVariant = {
        id: row.id,
        productId: row.product_id,
        size: row.size,
        color: row.color,
        sku: row.sku,
        barcode: row.barcode,
        price: parseFloat(row.price),
        currentStock: row.current_stock,
        createdAt: row.created_at
      };
      sendSuccess(res, mappedVariant);
    } else {
      const newVariant = {
        id,
        productId,
        size,
        color,
        sku,
        barcode,
        price: parseFloat(price),
        currentStock: initialStock,
        createdAt: new Date().toISOString()
      };
      inMemoryDb.variants.push(newVariant);
      sendSuccess(res, newVariant);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.put('/api/variants/:id', async (req, res) => {
  const { id } = req.params;
  const { size, color, sku, barcode, price, currentStock } = req.body;

  if (!isUuid(id)) {
    return sendError(res, 'Invalid variant ID format. Please refresh your browser.', 400);
  }

  try {
    if (isPostgresConnected && dbInstance) {
      const q = `
        UPDATE variants
        SET size = $1, color = $2, sku = $3, barcode = $4, price = $5, current_stock = $6
        WHERE id = $7
        RETURNING *
      `;
      const result = await dbInstance.session.client.query(q, [
        size, color, sku, barcode, price, parseInt(currentStock) || 0, id
      ]);
      if (result.rows.length === 0) return sendError(res, 'Variant not found', 404);
      const row = result.rows[0];
      const mappedVariant = {
        id: row.id,
        productId: row.product_id,
        size: row.size,
        color: row.color,
        sku: row.sku,
        barcode: row.barcode,
        price: parseFloat(row.price),
        currentStock: row.current_stock,
        createdAt: row.created_at
      };
      sendSuccess(res, mappedVariant);
    } else {
      const idx = inMemoryDb.variants.findIndex(v => v.id === id);
      if (idx === -1) return sendError(res, 'Variant not found', 404);

      inMemoryDb.variants[idx] = {
        ...inMemoryDb.variants[idx],
        size,
        color,
        sku,
        barcode,
        price: parseFloat(price),
        currentStock: parseInt(currentStock) || 0
      };
      sendSuccess(res, inMemoryDb.variants[idx]);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.delete('/api/variants/:id', async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return sendError(res, 'Invalid variant ID format. Please refresh your browser.', 400);
  }
  try {
    if (isPostgresConnected && dbInstance) {
      const result = await dbInstance.session.client.query('DELETE FROM variants WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return sendError(res, 'Variant not found', 404);
      sendSuccess(res, { message: 'Variant deleted' });
    } else {
      const idx = inMemoryDb.variants.findIndex(v => v.id === id);
      if (idx === -1) return sendError(res, 'Variant not found', 404);
      inMemoryDb.variants.splice(idx, 1);
      sendSuccess(res, { message: 'Variant deleted' });
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

// ==========================================
// 6. WAREHOUSES CRUD
// ==========================================
app.get('/api/warehouses', async (req, res) => {
  try {
    if (isPostgresConnected && dbInstance) {
      const result = await dbInstance.session.client.query('SELECT * FROM warehouses ORDER BY name ASC');
      sendSuccess(res, result.rows);
    } else {
      sendSuccess(res, inMemoryDb.warehouses);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/warehouses', async (req, res) => {
  const { name, code, location, capacity } = req.body;
  if (!name || !code || !capacity) {
    return sendError(res, 'Name, code, and capacity are required', 400);
  }

  try {
    const id = generateId();
    if (isPostgresConnected && dbInstance) {
      const q = `
        INSERT INTO warehouses (id, name, code, location, capacity)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await dbInstance.session.client.query(q, [id, name, code, location || '', capacity]);
      sendSuccess(res, result.rows[0]);
    } else {
      const newWh = {
        id,
        name,
        code,
        location: location || '',
        capacity: parseInt(capacity) || 1000,
        createdAt: new Date().toISOString()
      };
      inMemoryDb.warehouses.push(newWh);
      sendSuccess(res, newWh);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.put('/api/warehouses/:id', async (req, res) => {
  const { id } = req.params;
  const { name, code, location, capacity } = req.body;

  if (!isUuid(id)) {
    return sendError(res, 'Invalid warehouse ID format. Please refresh your browser.', 400);
  }

  try {
    if (isPostgresConnected && dbInstance) {
      const q = `
        UPDATE warehouses
        SET name = $1, code = $2, location = $3, capacity = $4
        WHERE id = $5
        RETURNING *
      `;
      const result = await dbInstance.session.client.query(q, [name, code, location, capacity, id]);
      if (result.rows.length === 0) return sendError(res, 'Warehouse not found', 404);
      sendSuccess(res, result.rows[0]);
    } else {
      const idx = inMemoryDb.warehouses.findIndex(w => w.id === id);
      if (idx === -1) return sendError(res, 'Warehouse not found', 404);

      inMemoryDb.warehouses[idx] = {
        ...inMemoryDb.warehouses[idx],
        name,
        code,
        location,
        capacity: parseInt(capacity) || 1000
      };
      sendSuccess(res, inMemoryDb.warehouses[idx]);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.delete('/api/warehouses/:id', async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return sendError(res, 'Invalid warehouse ID format. Please refresh your browser.', 400);
  }
  try {
    if (isPostgresConnected && dbInstance) {
      const result = await dbInstance.session.client.query('DELETE FROM warehouses WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return sendError(res, 'Warehouse not found', 404);
      sendSuccess(res, { message: 'Warehouse deleted' });
    } else {
      const idx = inMemoryDb.warehouses.findIndex(w => w.id === id);
      if (idx === -1) return sendError(res, 'Warehouse not found', 404);
      inMemoryDb.warehouses.splice(idx, 1);
      sendSuccess(res, { message: 'Warehouse deleted' });
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

// ==========================================
// 7. SUPPLIERS CRUD
// ==========================================
app.get('/api/suppliers', async (req, res) => {
  try {
    if (isPostgresConnected && dbInstance) {
      const result = await dbInstance.session.client.query('SELECT * FROM suppliers ORDER BY name ASC');
      sendSuccess(res, result.rows);
    } else {
      sendSuccess(res, inMemoryDb.suppliers);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/suppliers', async (req, res) => {
  const { name, contactPerson, email, phone, address } = req.body;
  if (!name || !email) {
    return sendError(res, 'Name and email are required', 400);
  }

  try {
    const id = generateId();
    if (isPostgresConnected && dbInstance) {
      const q = `
        INSERT INTO suppliers (id, name, contact_person, email, phone, address)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const result = await dbInstance.session.client.query(q, [
        id, name, contactPerson || '', email, phone || '', address || ''
      ]);
      sendSuccess(res, result.rows[0]);
    } else {
      const newSup = {
        id,
        name,
        contactPerson: contactPerson || '',
        email,
        phone: phone || '',
        address: address || '',
        createdAt: new Date().toISOString()
      };
      inMemoryDb.suppliers.push(newSup);
      sendSuccess(res, newSup);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.put('/api/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, contactPerson, email, phone, address } = req.body;

  if (!isUuid(id)) {
    return sendError(res, 'Invalid supplier ID format. Please refresh your browser.', 400);
  }

  try {
    if (isPostgresConnected && dbInstance) {
      const q = `
        UPDATE suppliers
        SET name = $1, contact_person = $2, email = $3, phone = $4, address = $5
        WHERE id = $6
        RETURNING *
      `;
      const result = await dbInstance.session.client.query(q, [
        name, contactPerson, email, phone, address, id
      ]);
      if (result.rows.length === 0) return sendError(res, 'Supplier not found', 404);
      sendSuccess(res, result.rows[0]);
    } else {
      const idx = inMemoryDb.suppliers.findIndex(s => s.id === id);
      if (idx === -1) return sendError(res, 'Supplier not found', 404);

      inMemoryDb.suppliers[idx] = {
        ...inMemoryDb.suppliers[idx],
        name,
        contactPerson,
        email,
        phone,
        address
      };
      sendSuccess(res, inMemoryDb.suppliers[idx]);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.delete('/api/suppliers/:id', async (req, res) => {
  const { id } = req.params;
  if (!isUuid(id)) {
    return sendError(res, 'Invalid supplier ID format. Please refresh your browser.', 400);
  }
  try {
    if (isPostgresConnected && dbInstance) {
      const result = await dbInstance.session.client.query('DELETE FROM suppliers WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return sendError(res, 'Supplier not found', 404);
      sendSuccess(res, { message: 'Supplier deleted' });
    } else {
      const idx = inMemoryDb.suppliers.findIndex(s => s.id === id);
      if (idx === -1) return sendError(res, 'Supplier not found', 404);
      inMemoryDb.suppliers.splice(idx, 1);
      sendSuccess(res, { message: 'Supplier deleted' });
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

// ==========================================
// 8. MOVEMENTS LOG
// ==========================================
app.get('/api/movements', async (req, res) => {
  try {
    if (isPostgresConnected && dbInstance) {
      const q = `
        SELECT m.*, v.size, v.color, v.sku, p.name as product_name, b.name as brand_name,
               w1.name as from_warehouse_name, w2.name as to_warehouse_name
        FROM movements m
        JOIN variants v ON m.variant_id = v.id
        JOIN products p ON v.product_id = p.id
        JOIN brands b ON p.brand_id = b.id
        LEFT JOIN warehouses w1 ON m.from_warehouse_id = w1.id
        LEFT JOIN warehouses w2 ON m.to_warehouse_id = w2.id
        ORDER BY m.created_at DESC
      `;
      const result = await dbInstance.session.client.query(q);
      const list = result.rows.map((row: any) => ({
        id: row.id,
        variantId: row.variant_id,
        fromWarehouseId: row.from_warehouse_id,
        toWarehouseId: row.to_warehouse_id,
        quantity: row.quantity,
        type: row.type,
        reason: row.reason,
        createdBy: row.created_by,
        createdAt: row.created_at,
        variant: {
          id: row.variant_id,
          size: row.size,
          color: row.color,
          sku: row.sku,
          productName: row.product_name,
          productBrand: row.brand_name
        },
        fromWarehouseName: row.from_warehouse_name,
        toWarehouseName: row.to_warehouse_name
      }));
      sendSuccess(res, list);
    } else {
      const list = inMemoryDb.movements.map(mv => {
        const variant = inMemoryDb.variants.find(v => v.id === mv.variantId);
        const product = variant ? inMemoryDb.products.find(p => p.id === variant.productId) : null;
        const brand = product ? inMemoryDb.brands.find(b => b.id === product.brandId) : null;
        const fromWH = inMemoryDb.warehouses.find(w => w.id === mv.fromWarehouseId);
        const toWH = inMemoryDb.warehouses.find(w => w.id === mv.toWarehouseId);

        return {
          ...mv,
          variant: variant ? {
            ...variant,
            productName: product?.name,
            productBrand: brand?.name
          } : undefined,
          fromWarehouseName: fromWH?.name,
          toWarehouseName: toWH?.name
        };
      });
      sendSuccess(res, list);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

// CREATE Movement and auto-update variant stock
app.post('/api/movements', async (req, res) => {
  const { variantId, fromWarehouseId, toWarehouseId, quantity, type, reason, createdBy } = req.body;
  if (!variantId || !quantity || !type || !reason) {
    return sendError(res, 'variantId, quantity, type, and reason are required', 400);
  }

  if (!isUuid(variantId)) {
    return sendError(res, 'Invalid variant ID format. Please refresh your browser.', 400);
  }
  if (fromWarehouseId && !isUuid(fromWarehouseId)) {
    return sendError(res, 'Invalid origin warehouse ID format. Please refresh your browser.', 400);
  }
  if (toWarehouseId && !isUuid(toWarehouseId)) {
    return sendError(res, 'Invalid destination warehouse ID format. Please refresh your browser.', 400);
  }

  const qty = parseInt(quantity);
  const safeVarId = cleanUuidWithFallback(variantId);
  const safeFromWhId = cleanUuid(fromWarehouseId);
  const safeToWhId = cleanUuid(toWarehouseId);

  try {
    if (isPostgresConnected && dbInstance) {
      const pool = dbInstance.session.client;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Check variant existence
        const vRes = await client.query('SELECT current_stock FROM variants WHERE id = $1 FOR UPDATE', [safeVarId]);
        if (vRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return sendError(res, 'Variant not found', 404);
        }

        let currentStock = parseInt(vRes.rows[0].current_stock);
        let newStock = currentStock;

        if (type === MovementType.INCOMING) {
          newStock += qty;
        } else if (type === MovementType.OUTGOING) {
          newStock -= qty;
        } else if (type === MovementType.TRANSFER) {
          // transfers do not change total global stock, but we track location movements
        } else if (type === MovementType.ADJUSTMENT) {
          // adjustment reasons can add or subtract
          if (reason.toLowerCase().includes('damage') || reason.toLowerCase().includes('lost') || reason.toLowerCase().includes('loss')) {
            newStock -= qty;
          } else {
            newStock += qty; // restock/found
          }
        }

        // Update variant stock
        await client.query('UPDATE variants SET current_stock = $1 WHERE id = $2', [newStock, safeVarId]);

        // Create movement log
        const id = generateId();
        const insertQ = `
          INSERT INTO movements (id, variant_id, from_warehouse_id, to_warehouse_id, quantity, type, reason, created_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `;
        const result = await client.query(insertQ, [
          id,
          safeVarId,
          safeFromWhId,
          safeToWhId,
          qty,
          type,
          reason,
          createdBy || 'System'
        ]);

        await client.query('COMMIT');
        sendSuccess(res, result.rows[0]);
        triggerAutoNotificationCheck().catch(err => console.error('Auto notification check error:', err));
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

    } else {
      // In-Memory transaction
      const vIdx = inMemoryDb.variants.findIndex(v => v.id === variantId);
      if (vIdx === -1) return sendError(res, 'Variant not found', 404);

      let currentStock = inMemoryDb.variants[vIdx].currentStock;
      if (type === MovementType.INCOMING) {
        currentStock += qty;
      } else if (type === MovementType.OUTGOING) {
        currentStock -= qty;
      } else if (type === MovementType.TRANSFER) {
        // transfers do not change total global stock
      } else if (type === MovementType.ADJUSTMENT) {
        if (reason.toLowerCase().includes('damage') || reason.toLowerCase().includes('lost') || reason.toLowerCase().includes('loss')) {
          currentStock -= qty;
        } else {
          currentStock += qty;
        }
      }

      inMemoryDb.variants[vIdx].currentStock = Math.max(0, currentStock);

      const id = generateId();
      const newMv = {
        id,
        variantId,
        fromWarehouseId: fromWarehouseId || null,
        toWarehouseId: toWarehouseId || null,
        quantity: qty,
        type: type as MovementType,
        reason,
        createdBy: createdBy || 'System',
        createdAt: new Date().toISOString()
      };

      inMemoryDb.movements.push(newMv);
      sendSuccess(res, newMv);
      triggerAutoNotificationCheck().catch(err => console.error('Auto notification check error:', err));
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

// ==========================================
// 9. PURCHASE ORDERS CRUD & FLOW
// ==========================================
app.get('/api/orders', async (req, res) => {
  try {
    if (isPostgresConnected && dbInstance) {
      const q = `
        SELECT o.*, s.name as supplier_name
        FROM orders o
        JOIN suppliers s ON o.supplier_id = s.id
        ORDER BY o.created_at DESC
      `;
      const result = await dbInstance.session.client.query(q);
      const ordersList = [];

      for (const row of result.rows) {
        const itemQ = `
          SELECT oi.*, v.sku, v.size, v.color, p.name as product_name
          FROM order_items oi
          JOIN variants v ON oi.variant_id = v.id
          JOIN products p ON v.product_id = p.id
          WHERE oi.order_id = $1
        `;
        const itemRes = await dbInstance.session.client.query(itemQ, [row.id]);
        ordersList.push({
          id: row.id,
          supplierId: row.supplier_id,
          orderNumber: row.order_number,
          status: row.status,
          totalCost: parseFloat(row.total_cost),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          supplierName: row.supplier_name,
          items: itemRes.rows.map((oi: any) => ({
            id: oi.id,
            orderId: oi.order_id,
            variantId: oi.variant_id,
            quantity: oi.quantity,
            unitCost: parseFloat(oi.unit_cost),
            variant: {
              id: oi.variant_id,
              sku: oi.sku,
              size: oi.size,
              color: oi.color,
              productName: oi.product_name
            }
          }))
        });
      }
      sendSuccess(res, ordersList);
    } else {
      const list = inMemoryDb.orders.map(o => {
        const supplier = inMemoryDb.suppliers.find(s => s.id === o.supplierId);
        const items = inMemoryDb.orderItems
          .filter(oi => oi.orderId === o.id)
          .map(oi => {
            const variant = inMemoryDb.variants.find(v => v.id === oi.variantId);
            const product = variant ? inMemoryDb.products.find(p => p.id === variant.productId) : null;
            return {
              ...oi,
              variant: variant ? {
                ...variant,
                productName: product?.name
              } : undefined
            };
          });

        return {
          ...o,
          supplierName: supplier?.name,
          items
        };
      });
      sendSuccess(res, list);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

// CREATE Purchase Order with items
app.post('/api/orders', async (req, res) => {
  const { supplierId, orderNumber, items } = req.body; // items is array of { variantId, quantity, unitCost }
  const orderNo = orderNumber || `PO-${Math.floor(100000 + Math.random() * 900000)}`;
  if (!supplierId || !orderNo || !items || !Array.isArray(items) || items.length === 0) {
    return sendError(res, 'Supplier and a non-empty items array are required', 400);
  }

  if (!isUuid(supplierId)) {
    return sendError(res, 'Invalid supplier ID format. Please refresh your browser.', 400);
  }
  for (const item of items) {
    if (!isUuid(item.variantId)) {
      return sendError(res, 'Invalid variant ID format in order items. Please refresh your browser.', 400);
    }
  }

  const safeSupplierId = cleanUuidWithFallback(supplierId);
  const totalCost = items.reduce((acc, it) => acc + (parseInt(it.quantity) * parseFloat(it.unitCost)), 0);

  try {
    const orderId = generateId();
    if (isPostgresConnected && dbInstance) {
      const pool = dbInstance.session.client;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create Order
        const insertOrderQ = `
          INSERT INTO orders (id, supplier_id, order_number, total_cost, status)
          VALUES ($1, $2, $3, $4, 'pending')
          RETURNING *
        `;
        const orderRes = await client.query(insertOrderQ, [orderId, safeSupplierId, orderNo, totalCost]);

        // Create Order Items
        for (const item of items) {
          const itemid = generateId();
          const safeVarId = cleanUuidWithFallback(item.variantId);
          await client.query(
            'INSERT INTO order_items (id, order_id, variant_id, quantity, unit_cost) VALUES ($1, $2, $3, $4, $5)',
            [itemid, orderId, safeVarId, parseInt(item.quantity), parseFloat(item.unitCost)]
          );
        }

        await client.query('COMMIT');

        // Fetch fully populated and mapped order to return
        const orderRow = orderRes.rows[0];
        const supRes = await pool.query('SELECT name FROM suppliers WHERE id = $1', [orderRow.supplier_id]);
        const supplierName = supRes.rows.length > 0 ? supRes.rows[0].name : '';

        const itemRes = await pool.query(`
          SELECT oi.*, v.sku, v.size, v.color, p.name as product_name
          FROM order_items oi
          JOIN variants v ON oi.variant_id = v.id
          JOIN products p ON v.product_id = p.id
          WHERE oi.order_id = $1
        `, [orderRow.id]);

        const mappedOrder = {
          id: orderRow.id,
          supplierId: orderRow.supplier_id,
          orderNumber: orderRow.order_number,
          status: orderRow.status,
          totalCost: parseFloat(orderRow.total_cost),
          createdAt: orderRow.created_at,
          updatedAt: orderRow.updated_at,
          supplierName,
          items: itemRes.rows.map((oi: any) => ({
            id: oi.id,
            orderId: oi.order_id,
            variantId: oi.variant_id,
            quantity: oi.quantity,
            unitCost: parseFloat(oi.unit_cost),
            variant: {
              id: oi.variant_id,
              sku: oi.sku,
              size: oi.size,
              color: oi.color,
              productName: oi.product_name
            }
          }))
        };

        sendSuccess(res, mappedOrder);
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const newOrder = {
        id: orderId,
        supplierId,
        orderNumber: orderNo,
        status: OrderStatus.PENDING,
        totalCost,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      inMemoryDb.orders.push(newOrder);

      for (const item of items) {
        const itemid = generateId();
        inMemoryDb.orderItems.push({
          id: itemid,
          orderId,
          variantId: item.variantId,
          quantity: parseInt(item.quantity),
          unitCost: parseFloat(item.unitCost)
        });
      }

      const supplier = inMemoryDb.suppliers.find(s => s.id === supplierId);
      const itemsList = inMemoryDb.orderItems
        .filter(oi => oi.orderId === orderId)
        .map(oi => {
          const variant = inMemoryDb.variants.find(v => v.id === oi.variantId);
          const product = variant ? inMemoryDb.products.find(p => p.id === variant.productId) : null;
          return {
            ...oi,
            variant: variant ? {
              ...variant,
              productName: product?.name
            } : undefined
          };
        });

      sendSuccess(res, {
        ...newOrder,
        supplierName: supplier?.name,
        items: itemsList
      });
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

// UPDATE Purchase Order Status. 
// Transitioning to 'received' automatically executes stock restocks inside the warehouse!
app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'pending', 'shipped', 'received', 'cancelled'

  if (!status) return sendError(res, 'Status is required', 400);

  if (!isUuid(id)) {
    return sendError(res, 'Invalid order ID format. Please refresh your browser.', 400);
  }

  try {
    if (isPostgresConnected && dbInstance) {
      const pool = dbInstance.session.client;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Get current status & details
        const orderRes = await client.query('SELECT status, order_number FROM orders WHERE id = $1 FOR UPDATE', [id]);
        if (orderRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return sendError(res, 'Order not found', 404);
        }

        const prevStatus = orderRes.rows[0].status;
        const orderNo = orderRes.rows[0].order_number;

        // Update Order Status
        const updateRes = await client.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [status, id]);

        // If transition to 'received' and was NOT already received, add stock to the Main Warehouse
        if (status === 'received' && prevStatus !== 'received') {
          // Fetch Main Warehouse id to add stock to
          const whRes = await client.query("SELECT id FROM warehouses WHERE code = 'WH-MAIN' LIMIT 1");
          const mainWhId = whRes.rows.length > 0 ? whRes.rows[0].id : null;

          // Fetch Order Items
          const itemsRes = await client.query('SELECT variant_id, quantity FROM order_items WHERE order_id = $1', [id]);
          
          for (const item of itemsRes.rows) {
            const varId = item.variant_id;
            const qty = parseInt(item.quantity);

            // Update stock of variant
            await client.query('UPDATE variants SET current_stock = current_stock + $1 WHERE id = $2', [qty, varId]);

            // Log movement
            const mId = generateId();
            await client.query(`
              INSERT INTO movements (id, variant_id, from_warehouse_id, to_warehouse_id, quantity, type, reason, created_by)
              VALUES ($1, $2, null, $3, $4, 'incoming', $5, 'Supplier Delivery')
            `, [mId, varId, mainWhId, qty, `Fulfillment of ${orderNo}`]);
          }
        }

        await client.query('COMMIT');

        // Fetch fully populated and mapped order to return
        const row = updateRes.rows[0];
        const supRes = await pool.query('SELECT name FROM suppliers WHERE id = $1', [row.supplier_id]);
        const supplierName = supRes.rows.length > 0 ? supRes.rows[0].name : '';

        const itemRes = await pool.query(`
          SELECT oi.*, v.sku, v.size, v.color, p.name as product_name
          FROM order_items oi
          JOIN variants v ON oi.variant_id = v.id
          JOIN products p ON v.product_id = p.id
          WHERE oi.order_id = $1
        `, [row.id]);

        const mappedOrder = {
          id: row.id,
          supplierId: row.supplier_id,
          orderNumber: row.order_number,
          status: row.status,
          totalCost: parseFloat(row.total_cost),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          supplierName,
          items: itemRes.rows.map((oi: any) => ({
            id: oi.id,
            orderId: oi.order_id,
            variantId: oi.variant_id,
            quantity: oi.quantity,
            unitCost: parseFloat(oi.unit_cost),
            variant: {
              id: oi.variant_id,
              sku: oi.sku,
              size: oi.size,
              color: oi.color,
              productName: oi.product_name
            }
          }))
        };

        sendSuccess(res, mappedOrder);
        triggerAutoNotificationCheck().catch(err => console.error('Auto notification check error:', err));
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      const idx = inMemoryDb.orders.findIndex(o => o.id === id);
      if (idx === -1) return sendError(res, 'Order not found', 404);

      const prevStatus = inMemoryDb.orders[idx].status;
      inMemoryDb.orders[idx].status = status as OrderStatus;
      inMemoryDb.orders[idx].updatedAt = new Date().toISOString();

      if (status === 'received' && prevStatus !== 'received') {
        const orderNo = inMemoryDb.orders[idx].orderNumber;
        const mainWh = inMemoryDb.warehouses.find(w => w.code === 'WH-MAIN') || inMemoryDb.warehouses[0];
        const mainWhId = mainWh ? mainWh.id : null;

        const orderItemsList = inMemoryDb.orderItems.filter(oi => oi.orderId === id);

        for (const item of orderItemsList) {
          const vIdx = inMemoryDb.variants.findIndex(v => v.id === item.variantId);
          if (vIdx !== -1) {
            inMemoryDb.variants[vIdx].currentStock += item.quantity;

            const mId = generateId();
            inMemoryDb.movements.push({
              id: mId,
              variantId: item.variantId,
              fromWarehouseId: null,
              toWarehouseId: mainWhId,
              quantity: item.quantity,
              type: MovementType.INCOMING,
              reason: `Fulfillment of ${orderNo}`,
              createdBy: 'Supplier Delivery',
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      const o = inMemoryDb.orders[idx];
      const supplier = inMemoryDb.suppliers.find(s => s.id === o.supplierId);
      const itemsList = inMemoryDb.orderItems
        .filter(oi => oi.orderId === o.id)
        .map(oi => {
          const variant = inMemoryDb.variants.find(v => v.id === oi.variantId);
          const product = variant ? inMemoryDb.products.find(p => p.id === variant.productId) : null;
          return {
            ...oi,
            variant: variant ? {
              ...variant,
              productName: product?.name
            } : undefined
          };
        });

      sendSuccess(res, {
        ...o,
        supplierName: supplier?.name,
        items: itemsList
      });
      triggerAutoNotificationCheck().catch(err => console.error('Auto notification check error:', err));
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});


// ==========================================
// 10. SALES CRUD
// ==========================================
app.get('/api/sales', async (req, res) => {
  try {
    if (isPostgresConnected && dbInstance) {
      const q = `
        SELECT s.*, v.size, v.color, v.sku, v.price as variant_price, p.name as product_name, b.name as brand_name
        FROM sales s
        JOIN variants v ON s.variant_id = v.id
        JOIN products p ON v.product_id = p.id
        JOIN brands b ON p.brand_id = b.id
        ORDER BY s.created_at DESC
      `;
      const result = await dbInstance.session.client.query(q);
      const salesList = result.rows.map((row: any) => ({
        id: row.id,
        variantId: row.variant_id,
        quantity: parseInt(row.quantity),
        sellingPrice: parseFloat(row.selling_price),
        costPrice: parseFloat(row.cost_price),
        profit: parseFloat(row.profit),
        createdAt: row.created_at,
        variant: {
          id: row.variant_id,
          size: row.size,
          color: row.color,
          sku: row.sku,
          price: parseFloat(row.variant_price),
          productName: row.product_name,
          productBrand: row.brand_name
        }
      }));
      sendSuccess(res, salesList);
    } else {
      const salesList = inMemoryDb.sales.map(s => {
        const variant = inMemoryDb.variants.find(v => v.id === s.variantId);
        const product = variant ? inMemoryDb.products.find(p => p.id === variant.productId) : null;
        const brand = product ? inMemoryDb.brands.find(b => b.id === product.brandId) : null;
        return {
          id: s.id,
          variantId: s.variantId,
          quantity: s.quantity,
          sellingPrice: s.sellingPrice,
          costPrice: s.costPrice,
          profit: s.profit,
          createdAt: s.createdAt,
          variant: variant ? {
            id: variant.id,
            productId: variant.productId,
            size: variant.size,
            color: variant.color,
            sku: variant.sku,
            price: variant.price,
            createdAt: variant.createdAt,
            productName: product?.name,
            productBrand: brand?.name
          } : undefined
        };
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      sendSuccess(res, salesList);
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/sales', async (req, res) => {
  const { variantId, quantity, sellingPrice, costPrice, warehouseId } = req.body;
  const qty = parseInt(quantity);
  if (!variantId || isNaN(qty) || qty <= 0 || !sellingPrice) {
    return sendError(res, 'variantId, positive quantity, and sellingPrice are required', 400);
  }

  if (!isUuid(variantId)) {
    return sendError(res, 'Invalid variant ID format. Please refresh your browser to load the latest shoe catalog.', 400);
  }
  if (warehouseId && !isUuid(warehouseId)) {
    return sendError(res, 'Invalid shop/warehouse ID format. Please refresh your browser.', 400);
  }

  const safeVarId = cleanUuidWithFallback(variantId);

  try {
    if (isPostgresConnected && dbInstance) {
      const pool = dbInstance.session.client;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Fetch variant to verify existence and check stock
        const varRes = await client.query('SELECT v.*, p.name as product_name FROM variants v JOIN products p ON v.product_id = p.id WHERE v.id = $1 FOR UPDATE', [safeVarId]);
        if (varRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return sendError(res, 'Variant not found', 404);
        }

        const variant = varRes.rows[0];
        if (parseInt(variant.current_stock) < qty) {
          await client.query('ROLLBACK');
          return sendError(res, `Insufficient stock! Only ${variant.current_stock} pairs of ${variant.product_name} remaining.`, 400);
        }

        const finalCostPrice = parseFloat(costPrice) || (parseFloat(variant.price) * 0.6);
        const finalSellingPrice = parseFloat(sellingPrice);
        const profit = qty * (finalSellingPrice - finalCostPrice);

        // Resolve a valid warehouseId for Postgres inserting / movements tracking
        let finalWarehouseId: string | null = null;
        if (warehouseId && isUuid(warehouseId)) {
          const whCheck = await client.query('SELECT id FROM warehouses WHERE id = $1', [warehouseId]);
          if (whCheck.rows.length > 0) {
            finalWarehouseId = warehouseId;
          }
        }

        // Fallback to first warehouse if invalid or not found
        if (!finalWarehouseId) {
          const firstWh = await client.query('SELECT id FROM warehouses LIMIT 1');
          if (firstWh.rows.length > 0) {
            finalWarehouseId = firstWh.rows[0].id;
          }
        }

        // Reduce stock
        await client.query('UPDATE variants SET current_stock = current_stock - $1 WHERE id = $2', [qty, safeVarId]);

        // Record Sale
        const saleId = generateId();
        await client.query(`
          INSERT INTO sales (id, variant_id, quantity, selling_price, cost_price, profit, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [saleId, safeVarId, qty, finalSellingPrice, finalCostPrice, profit]);

        // Record Movement (audit trail)
        const mvId = generateId();
        await client.query(`
          INSERT INTO movements (id, variant_id, from_warehouse_id, to_warehouse_id, quantity, type, reason, created_by, created_at)
          VALUES ($1, $2, $3, null, $4, 'outgoing', $5, 'POS Sale', NOW())
        `, [mvId, safeVarId, finalWarehouseId, qty, `Sold ${qty} pairs of ${variant.product_name} (${variant.sku})`]);

        await client.query('COMMIT');
        sendSuccess(res, { id: saleId, variantId: safeVarId, quantity: qty, sellingPrice: finalSellingPrice, costPrice: finalCostPrice, profit });
        triggerAutoNotificationCheck().catch(err => console.error('Auto notification check error:', err));
      } catch (err: any) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

    } else {
      // In-Memory logic
      const vIdx = inMemoryDb.variants.findIndex(v => v.id === variantId);
      if (vIdx === -1) return sendError(res, 'Variant not found', 404);

      const variant = inMemoryDb.variants[vIdx];
      const product = inMemoryDb.products.find(p => p.id === variant.productId);
      const productName = product ? product.name : 'Unknown Shoe';

      if (variant.currentStock < qty) {
        return sendError(res, `Insufficient stock! Only ${variant.currentStock} pairs of ${productName} remaining.`, 400);
      }

      const finalCostPrice = parseFloat(costPrice) || (variant.price * 0.6);
      const finalSellingPrice = parseFloat(sellingPrice);
      const profit = qty * (finalSellingPrice - finalCostPrice);

      // Reduce stock
      inMemoryDb.variants[vIdx].currentStock -= qty;

      // Record Sale
      const saleId = generateId();
      const newSale = {
        id: saleId,
        variantId,
        quantity: qty,
        sellingPrice: finalSellingPrice,
        costPrice: finalCostPrice,
        profit,
        createdAt: new Date().toISOString()
      };
      inMemoryDb.sales.push(newSale);

      // Record Movement
      const mvId = generateId();
      inMemoryDb.movements.push({
        id: mvId,
        variantId,
        fromWarehouseId: warehouseId || null,
        toWarehouseId: null,
        quantity: qty,
        type: MovementType.OUTGOING,
        reason: `Sold ${qty} pairs of ${productName} (${variant.sku})`,
        createdBy: 'POS Sale',
        createdAt: new Date().toISOString()
      });

      sendSuccess(res, newSale);
      triggerAutoNotificationCheck().catch(err => console.error('Auto notification check error:', err));
    }
  } catch (err: any) {
    sendError(res, err.message);
  }
});


// ==========================================
// 10. NOTIFICATION HELPERS & ENDPOINTS
// ==========================================
async function getAllVariantsList(): Promise<any[]> {
  if (isPostgresConnected && dbInstance) {
    const q = `
      SELECT v.*, p.name as product_name, b.name as brand_name
      FROM variants v
      JOIN products p ON v.product_id = p.id
      JOIN brands b ON p.brand_id = b.id
      ORDER BY v.sku ASC
    `;
    const result = await dbInstance.session.client.query(q);
    return result.rows.map((vr: any) => ({
      id: vr.id,
      productId: vr.product_id,
      size: vr.size,
      color: vr.color,
      sku: vr.sku,
      currentStock: vr.current_stock,
      barcode: vr.barcode,
      price: parseFloat(vr.price),
      createdAt: vr.created_at,
      productName: vr.product_name,
      productBrand: vr.brand_name
    }));
  } else {
    return inMemoryDb.variants.map(v => {
      const product = inMemoryDb.products.find(p => p.id === v.productId);
      const brand = product ? inMemoryDb.brands.find(b => b.id === product.brandId) : null;
      return {
        ...v,
        currentStock: v.currentStock,
        productName: product?.name,
        productBrand: brand?.name
      };
    });
  }
}

async function triggerAutoNotificationCheck() {
  try {
    const settings = getNotificationSettings();
    if (settings.enableAutoEmail) {
      const list = await getAllVariantsList();
      await sendLowStockEmailSummary(list, false);
    }
  } catch (error) {
    console.error('Error during automatic low-stock email trigger:', error);
  }
}

app.get('/api/notifications/settings', (req, res) => {
  try {
    const settings = getNotificationSettings();
    const safeSettings = {
      ...settings,
      smtpPass: settings.smtpPass ? '********' : ''
    };
    sendSuccess(res, safeSettings);
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/notifications/settings', (req, res) => {
  try {
    const newSettings = req.body;
    if (newSettings.smtpPass === '********') {
      delete newSettings.smtpPass;
    }
    const updated = saveNotificationSettings(newSettings);
    const safeSettings = {
      ...updated,
      smtpPass: updated.smtpPass ? '********' : ''
    };
    sendSuccess(res, safeSettings);
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.get('/api/notifications/logs', (req, res) => {
  try {
    const logs = getEmailLogs();
    sendSuccess(res, logs);
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/notifications/trigger', async (req, res) => {
  try {
    const list = await getAllVariantsList();
    const result = await sendLowStockEmailSummary(list, true);
    sendSuccess(res, {
      message: 'Notification trigger executed successfully',
      log: result.log,
      sent: result.success
    });
  } catch (err: any) {
    sendError(res, err.message);
  }
});


// ==========================================
// 11. GENERAL SETTINGS & BACKUP/RESTORE/IMPORT
// ==========================================

app.get('/api/settings/general', (req, res) => {
  try {
    const settings = getGeneralSettings();
    sendSuccess(res, settings);
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/settings/general/:section', (req, res) => {
  try {
    const { section } = req.params;
    const updated = saveGeneralSettings(section as any, req.body);
    sendSuccess(res, updated);
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.get('/api/settings/backups', (req, res) => {
  try {
    const backups = listBackups();
    sendSuccess(res, backups);
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/settings/backups/create', async (req, res) => {
  try {
    const dump: any = {
      isPostgres: isPostgresConnected && !!dbInstance,
      timestamp: new Date().toISOString(),
      data: {}
    };

    if (isPostgresConnected && dbInstance) {
      // Fetch all tables
      const client = dbInstance.session.client;
      const tables = ['brands', 'products', 'variants', 'warehouses', 'suppliers', 'movements', 'sales', 'orders', 'order_items'];
      for (const t of tables) {
        const result = await client.query(`SELECT * FROM ${t}`);
        dump.data[t] = result.rows;
      }
    } else {
      dump.data = JSON.parse(JSON.stringify(inMemoryDb));
    }

    const backupResult = triggerBackup(dump);
    sendSuccess(res, backupResult);
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/settings/backups/restore', async (req, res) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      return sendError(res, 'Backup filename is required', 400);
    }

    const dump = loadBackupContent(filename);
    if (!dump || !dump.data) {
      return sendError(res, 'Invalid backup file content', 400);
    }

    if (isPostgresConnected && dbInstance) {
      const client = dbInstance.session.client;
      await client.query('BEGIN');
      try {
        // Truncate tables with cascade or in correct order
        await client.query('TRUNCATE TABLE order_items, orders, sales, movements, variants, products, suppliers, warehouses, brands CASCADE');

        // Restore tables in foreign-key safe order
        const tablesOrder = ['brands', 'suppliers', 'warehouses', 'products', 'variants', 'sales', 'movements', 'orders', 'order_items'];

        for (const t of tablesOrder) {
          const rows = dump.data[t];
          if (!rows || rows.length === 0) continue;

          for (const row of rows) {
            const keys = Object.keys(row);
            const values = Object.values(row);
            const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
            const cols = keys.map(k => {
              // Convert camelCase or standard field names if backup has them, but they should be pg snake_case.
              // We'll keep them as is since the pg backup saves them as is.
              return k;
            }).join(', ');
            
            await client.query(`INSERT INTO ${t} (${cols}) VALUES (${placeholders})`, values);
          }
        }
        await client.query('COMMIT');
      } catch (dbErr: any) {
        await client.query('ROLLBACK');
        throw dbErr;
      }
    } else {
      // Restore in memory
      const keys = ['brands', 'products', 'variants', 'warehouses', 'suppliers', 'movements', 'sales', 'orders', 'order_items'];
      for (const k of keys) {
        if (dump.data[k]) {
          (inMemoryDb as any)[k] = JSON.parse(JSON.stringify(dump.data[k]));
        }
      }
    }

    sendSuccess(res, { message: 'Database successfully restored from backup' });
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.get('/api/settings/export', async (req, res) => {
  try {
    let exportData: any = {};
    if (isPostgresConnected && dbInstance) {
      const client = dbInstance.session.client;
      const tables = ['brands', 'products', 'variants', 'warehouses', 'suppliers', 'movements', 'sales', 'orders', 'order_items'];
      for (const t of tables) {
        const result = await client.query(`SELECT * FROM ${t}`);
        exportData[t] = result.rows;
      }
    } else {
      exportData = JSON.parse(JSON.stringify(inMemoryDb));
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=shoetracker_all_data_export.json');
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err: any) {
    sendError(res, err.message);
  }
});

app.post('/api/settings/import', async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products)) {
      return sendError(res, 'Products array is required', 400);
    }

    for (const item of products) {
      const brandId = await getOrCreateBrandId(item.brandName || 'Generic');
      const productId = generateId();

      const productObj = {
        id: productId,
        name: item.name || 'Imported Shoe',
        description: item.description || '',
        brandId,
        category: item.category || 'Casual',
        gender: item.gender || 'Unisex',
        basePrice: parseFloat(item.basePrice) || 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (isPostgresConnected && dbInstance) {
        const client = dbInstance.session.client;
        await client.query(`
          INSERT INTO products (id, name, description, brand_id, category, gender, base_price, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [productObj.id, productObj.name, productObj.description, productObj.brandId, productObj.category, productObj.gender, productObj.basePrice, productObj.createdAt, productObj.updatedAt]);
      } else {
        inMemoryDb.products.push(productObj);
      }

      const vars = item.variants || [{ size: 40, color: 'Black', price: productObj.basePrice, currentStock: 10 }];
      for (const v of vars) {
        const variantId = generateId();
        const sku = v.sku || `${productObj.name.substring(0, 3).toUpperCase()}-${v.size}-${v.color.substring(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
        const barcode = v.barcode || `${Math.floor(100000000000 + Math.random() * 900000000000)}`;

        const variantObj = {
          id: variantId,
          productId,
          size: parseInt(v.size) || 40,
          color: v.color || 'Black',
          sku,
          currentStock: parseInt(v.currentStock) || 0,
          barcode,
          price: parseFloat(v.price) || productObj.basePrice,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (isPostgresConnected && dbInstance) {
          const client = dbInstance.session.client;
          await client.query(`
            INSERT INTO variants (id, product_id, size, color, sku, current_stock, barcode, price, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `, [variantObj.id, variantObj.productId, variantObj.size, variantObj.color, variantObj.sku, variantObj.currentStock, variantObj.barcode, variantObj.price, variantObj.createdAt, variantObj.updatedAt]);
        } else {
          inMemoryDb.variants.push(variantObj);
        }
      }
    }

    sendSuccess(res, { message: `${products.length} products successfully imported!` });
  } catch (err: any) {
    sendError(res, err.message);
  }
});

async function getOrCreateBrandId(brandName: string): Promise<string> {
  if (isPostgresConnected && dbInstance) {
    const client = dbInstance.session.client;
    const res = await client.query('SELECT id FROM brands WHERE LOWER(name) = LOWER($1)', [brandName]);
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
    const newId = generateId();
    await client.query('INSERT INTO brands (id, name, created_at) VALUES ($1, $2, $3)', [newId, brandName, new Date().toISOString()]);
    return newId;
  } else {
    const brand = inMemoryDb.brands.find(b => b.name.toLowerCase() === brandName.toLowerCase());
    if (brand) {
      return brand.id;
    }
    const newId = generateId();
    inMemoryDb.brands.push({
      id: newId,
      name: brandName,
      createdAt: new Date().toISOString()
    });
    return newId;
  }
}


// ==========================================
// VITE DEV SERVER AND PRODUCTION SERVING
// ==========================================
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
    root: path.join(__dirname, '../frontend'),
    configFile: path.join(__dirname, '../vite.config.ts'),
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Shoes Stock Management Server is active on http://localhost:${PORT}`);
  console.log(`📡 Ingress routing listening to live connections in AI Studio preview iframe`);
});
