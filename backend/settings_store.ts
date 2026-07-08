/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

export interface Location {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  type: 'store' | 'warehouse';
}

export interface SettingsData {
  businessProfile: {
    shopName: string;
    logoUrl: string;
    address: string;
    phone: string;
    email: string;
    currency: string;
    numberFormat: string;
    dateFormat: string;
  };
  inventoryRules: {
    globalThreshold: number;
    perProductOverride: boolean;
    skuPrefix: string;
    skuIncrementPattern: string;
    minSize: number;
    maxSize: number;
    colors: string[];
    reorderPointsToggle: boolean;
  };
  usersPermissions: {
    roles: {
      name: string;
      permissions: string[];
    }[];
    invites: {
      id: string;
      emailOrPhone: string;
      role: string;
      invitedAt: string;
    }[];
    activityLogToggle: boolean;
  };
  categoriesAttributes: {
    categories: string[];
    customAttributes: {
      id: string;
      name: string;
      type: 'text' | 'number' | 'select';
      options?: string[];
    }[];
  };
  pricingTax: {
    defaultMarkup: number;
    vatRate: number;
    taxInclusive: boolean;
    maxDiscount: number;
  };
  notifications: {
    inApp: boolean;
    email: boolean;
    telegram: boolean;
    summaryToggle: boolean;
    summaryDeliveryTime: string;
    telegramToken: string;
    telegramChatId: string;
  };
  integrations: {
    chapaPublicKey: string;
    chapaSecretKey: string;
    chapaMode: 'test' | 'live';
    telegramBotStatus: 'disconnected' | 'connected';
    webhookUrl: string;
  };
  dataBackup: {
    lastBackupTimestamp: string;
  };
  security: {
    minPasswordLength: number;
    requireSpecialChar: boolean;
    sessionTimeout: '15min' | '30min' | '1hr' | 'never';
    admin2FA: boolean;
  };
}

const SETTINGS_FILE = path.join(process.cwd(), 'backend/data/general_settings.json');
const BACKUP_DIR = path.join(process.cwd(), 'backend/data/backups');

const ensureDirs = () => {
  const settingsDir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
};

const DEFAULT_SETTINGS: SettingsData = {
  businessProfile: {
    shopName: 'ShoeTracker Premium',
    logoUrl: '',
    address: 'Bole Road, Addis Ababa, Ethiopia',
    phone: '+251911223344',
    email: 'info@shoetracker.com',
    currency: 'ETB',
    numberFormat: '1,234.56',
    dateFormat: 'MM/DD/YYYY'
  },
  inventoryRules: {
    globalThreshold: 10,
    perProductOverride: false,
    skuPrefix: 'SHOE',
    skuIncrementPattern: '0000',
    minSize: 36,
    maxSize: 46,
    colors: ['Black', 'White', 'Red', 'Blue', 'Grey', 'Green'],
    reorderPointsToggle: true
  },
  usersPermissions: {
    roles: [
      { name: 'Admin', permissions: ['view_cost_price', 'edit_stock', 'delete_products', 'view_reports', 'manage_users'] },
      { name: 'Manager', permissions: ['view_cost_price', 'edit_stock', 'view_reports'] },
      { name: 'Sales Staff', permissions: ['view_reports'] },
      { name: 'Warehouse Staff', permissions: ['edit_stock'] }
    ],
    invites: [],
    activityLogToggle: true
  },
  categoriesAttributes: {
    categories: ['Sneakers', 'Formal', 'Sandals', 'Kids', 'Running', 'Casual'],
    customAttributes: [
      { id: '1', name: 'material', type: 'text' },
      { id: '2', name: 'season', type: 'text' },
      { id: '3', name: 'gender', type: 'select', options: ['Men', 'Women', 'Unisex'] }
    ]
  },
  pricingTax: {
    defaultMarkup: 30,
    vatRate: 15,
    taxInclusive: true,
    maxDiscount: 10
  },
  notifications: {
    inApp: true,
    email: true,
    telegram: false,
    summaryToggle: true,
    summaryDeliveryTime: '08:00',
    telegramToken: '',
    telegramChatId: ''
  },
  integrations: {
    chapaPublicKey: '',
    chapaSecretKey: '',
    chapaMode: 'test',
    telegramBotStatus: 'disconnected',
    webhookUrl: ''
  },
  dataBackup: {
    lastBackupTimestamp: 'Never'
  },
  security: {
    minPasswordLength: 8,
    requireSpecialChar: true,
    sessionTimeout: '1hr',
    admin2FA: false
  }
};

export function getGeneralSettings(): SettingsData {
  ensureDirs();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      // Merge with defaults to ensure all keys exist
      return {
        businessProfile: { ...DEFAULT_SETTINGS.businessProfile, ...parsed.businessProfile },
        inventoryRules: { ...DEFAULT_SETTINGS.inventoryRules, ...parsed.inventoryRules },
        usersPermissions: { ...DEFAULT_SETTINGS.usersPermissions, ...parsed.usersPermissions },
        categoriesAttributes: { ...DEFAULT_SETTINGS.categoriesAttributes, ...parsed.categoriesAttributes },
        pricingTax: { ...DEFAULT_SETTINGS.pricingTax, ...parsed.pricingTax },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...parsed.notifications },
        integrations: { ...DEFAULT_SETTINGS.integrations, ...parsed.integrations },
        dataBackup: { ...DEFAULT_SETTINGS.dataBackup, ...parsed.dataBackup },
        security: { ...DEFAULT_SETTINGS.security, ...parsed.security }
      };
    }
  } catch (error) {
    console.error('Error reading general settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveGeneralSettings(section: keyof SettingsData, data: any): SettingsData {
  ensureDirs();
  const current = getGeneralSettings();
  
  // Update section
  (current as any)[section] = { ...(current as any)[section], ...data };
  
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(current, null, 2), 'utf-8');
    
    // If it's inventoryRules or notifications, we should also keep the notifications threshold sync'd!
    if (section === 'inventoryRules') {
      const notifFile = path.join(process.cwd(), 'backend/data/notification_settings.json');
      if (fs.existsSync(notifFile)) {
        try {
          const content = fs.readFileSync(notifFile, 'utf-8');
          const parsed = JSON.parse(content);
          parsed.threshold = current.inventoryRules.globalThreshold;
          fs.writeFileSync(notifFile, JSON.stringify(parsed, null, 2), 'utf-8');
        } catch (e) {
          console.error('Error syncing to notifications file', e);
        }
      }
    }
  } catch (error) {
    console.error('Error saving general settings:', error);
  }
  return current;
}

export function triggerBackup(fullDbDump: any): { success: boolean; timestamp: string; filename: string } {
  ensureDirs();
  const timestamp = new Date().toISOString();
  const safeTimestamp = timestamp.replace(/[:.]/g, '-');
  const filename = `backup_${safeTimestamp}.json`;
  const backupPath = path.join(BACKUP_DIR, filename);
  
  try {
    fs.writeFileSync(backupPath, JSON.stringify(fullDbDump, null, 2), 'utf-8');
    
    // Update settings with last backup time
    const current = getGeneralSettings();
    current.dataBackup.lastBackupTimestamp = new Date(timestamp).toLocaleString();
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(current, null, 2), 'utf-8');
    
    return { success: true, timestamp: current.dataBackup.lastBackupTimestamp, filename };
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

export function listBackups(): { filename: string; date: string; size: number }[] {
  ensureDirs();
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    return files
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .map(f => {
        const filePath = path.join(BACKUP_DIR, f);
        const stats = fs.statSync(filePath);
        // Extract date from filename: backup_YYYY-MM-DDTHH-MM-SS-MSZ.json
        const dateStr = f.replace('backup_', '').replace('.json', '').replace(/-/g, ':');
        let parsedDate = '';
        try {
          parsedDate = new Date(stats.mtime).toLocaleString();
        } catch (e) {
          parsedDate = stats.mtime.toISOString();
        }
        return {
          filename: f,
          date: parsedDate,
          size: stats.size
        };
      })
      .sort((a, b) => b.filename.localeCompare(a.filename));
  } catch (error) {
    console.error('Error listing backups:', error);
    return [];
  }
}

export function loadBackupContent(filename: string): any {
  const filePath = path.join(BACKUP_DIR, filename);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }
  throw new Error(`Backup file ${filename} not found`);
}
