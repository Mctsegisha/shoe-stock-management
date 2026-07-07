/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

export interface NotificationSettings {
  threshold: number;
  adminEmail: string;
  enableAutoEmail: boolean;
  emailMethod: 'sandbox' | 'smtp';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
}

export interface EmailLog {
  id: string;
  date: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'Simulated' | 'Delivered' | 'Failed';
  errorMessage?: string;
  lowStockItemsCount: number;
}

const SETTINGS_FILE = path.join(process.cwd(), 'backend/data/notification_settings.json');
const LOGS_FILE = path.join(process.cwd(), 'backend/data/email_logs.json');

// Ensure data directory exists
const ensureDataDir = () => {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const DEFAULT_SETTINGS: NotificationSettings = {
  threshold: 10,
  adminEmail: 'tsegabbekele@gmail.com',
  enableAutoEmail: true,
  emailMethod: 'sandbox',
  smtpHost: 'smtp.gmail.com',
  smtpPort: 465,
  smtpUser: '',
  smtpPass: '',
  smtpFrom: 'alerts@shoetracker.com',
};

export function getNotificationSettings(): NotificationSettings {
  ensureDataDir();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
    }
  } catch (error) {
    console.error('Error reading notification settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveNotificationSettings(settings: Partial<NotificationSettings>): NotificationSettings {
  ensureDataDir();
  const current = getNotificationSettings();
  const updated = { ...current, ...settings };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving notification settings:', error);
  }
  return updated;
}

export function getEmailLogs(): EmailLog[] {
  ensureDataDir();
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const content = fs.readFileSync(LOGS_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error reading email logs:', error);
  }
  return [];
}

export function saveEmailLogs(logs: EmailLog[]) {
  ensureDataDir();
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving email logs:', error);
  }
}

// In-memory throttling for auto-emails (limit to once every 30 seconds to prevent double-fires on batch operations)
let lastAutoEmailTime = 0;
const AUTO_EMAIL_THROTTLE_MS = 30000;

export async function sendLowStockEmailSummary(
  variantsList: any[],
  isForced: boolean = false
): Promise<{ success: boolean; log?: EmailLog; error?: string }> {
  const settings = getNotificationSettings();
  
  // Filter variants below threshold
  const lowStockItems = variantsList.filter((v: any) => {
    const stock = parseInt(v.currentStock ?? v.current_stock ?? 0);
    return stock < settings.threshold;
  });

  // Skip sending if there are no low stock items, unless it was triggered manually (isForced)
  if (lowStockItems.length === 0 && !isForced) {
    return { success: true };
  }

  // If automated email is disabled and this is not forced, skip
  if (!settings.enableAutoEmail && !isForced) {
    return { success: true };
  }

  // Throttle automatic emails
  if (!isForced) {
    const now = Date.now();
    if (now - lastAutoEmailTime < AUTO_EMAIL_THROTTLE_MS) {
      console.log('✉️ Automated low stock email throttled to prevent spam.');
      return { success: true };
    }
    lastAutoEmailTime = now;
  }

  const dateStr = new Date().toLocaleString();
  const subject = `[ShoeTracker] ${lowStockItems.length > 0 ? `⚠️ Critical Low Stock Alert: ${lowStockItems.length} items` : '✅ Inventory Status Report'}`;
  
  // Compile a beautiful responsive HTML email
  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Stock Alert Summary</title>
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f8fafc;
          margin: 0;
          padding: 0;
          color: #334155;
          -webkit-font-smoothing: antialiased;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }
        .header {
          background-color: ${lowStockItems.length > 0 ? '#b91c1c' : '#047857'};
          padding: 32px 24px;
          text-align: center;
          color: #ffffff;
        }
        .header h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .header p {
          margin: 8px 0 0 0;
          font-size: 13px;
          opacity: 0.9;
          font-weight: 500;
        }
        .content {
          padding: 32px 24px;
        }
        .summary-banner {
          background-color: ${lowStockItems.length > 0 ? '#fef2f2' : '#f0fdf4'};
          border: 1px solid ${lowStockItems.length > 0 ? '#fecaca' : '#bbf7d0'};
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 24px;
          font-size: 13px;
          font-weight: 600;
          color: ${lowStockItems.length > 0 ? '#991b1b' : '#166534'};
          display: flex;
          align-items: center;
        }
        .table-wrapper {
          overflow-x: auto;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          margin-bottom: 24px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 13px;
        }
        th {
          background-color: #f1f5f9;
          color: #475569;
          font-weight: 700;
          padding: 12px 14px;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 0.5px;
        }
        td {
          padding: 14px;
          border-top: 1px solid #e2e8f0;
        }
        .item-title {
          font-weight: 700;
          color: #1e293b;
          margin: 0;
        }
        .item-sub {
          font-size: 11px;
          color: #64748b;
          margin: 2px 0 0 0;
        }
        .badge {
          display: inline-block;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 6px;
        }
        .badge-critical {
          background-color: #fee2e2;
          color: #ef4444;
        }
        .badge-warning {
          background-color: #fef3c7;
          color: #d97706;
        }
        .stock-value {
          font-family: 'Courier New', Courier, monospace;
          font-weight: 700;
          font-size: 14px;
        }
        .stock-red {
          color: #ef4444;
        }
        .footer {
          background-color: #f8fafc;
          padding: 24px;
          text-align: center;
          font-size: 11px;
          color: #64748b;
          border-top: 1px solid #e2e8f0;
        }
        .footer p {
          margin: 4px 0;
        }
        .footer a {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 600;
        }
        .btn {
          display: inline-block;
          background-color: #0f172a;
          color: #ffffff !important;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 700;
          font-size: 13px;
          text-decoration: none;
          margin-top: 16px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>INVENTORY ALERTS</h1>
          <p>Automated Stock Report &bull; ${dateStr}</p>
        </div>
        
        <div class="content">
          <div class="summary-banner">
            ${lowStockItems.length > 0 
              ? `🚨 NOTICE: There are currently ${lowStockItems.length} shoe variant(s) below the critical stock threshold of ${settings.threshold} pairs.`
              : `✅ ALL CLEAR: All shoe styles are in healthy supply (above critical threshold of ${settings.threshold} pairs).`
            }
          </div>
          
          ${lowStockItems.length > 0 ? `
            <h3 style="margin: 0 0 12px 0; font-size: 14px; color: #1e293b; font-weight: 700;">Variants Requiring Attention:</h3>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Shoe Model</th>
                    <th>Color / Size</th>
                    <th style="text-align: center;">Stock</th>
                    <th style="text-align: right;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${lowStockItems.map((item: any) => {
                    const stockVal = parseInt(item.currentStock ?? item.current_stock ?? 0);
                    const brandName = item.variant?.productBrand ?? item.productBrand ?? item.brandName ?? item.brand ?? 'Shoe';
                    const productName = item.variant?.productName ?? item.productName ?? item.name ?? 'Style';
                    const sku = item.sku ?? item.sku_code ?? 'N/A';
                    const size = item.size ?? 'N/A';
                    const color = item.color ?? 'N/A';
                    
                    const isCritical = stockVal <= 2;
                    const badgeClass = isCritical ? 'badge-critical' : 'badge-warning';
                    const statusText = isCritical ? 'CRITICAL' : 'LOW STOCK';

                    return `
                      <tr>
                        <td>
                          <p class="item-title">${brandName} ${productName}</p>
                          <p class="item-sub">SKU: ${sku}</p>
                        </td>
                        <td>
                          <p class="item-title">${color}</p>
                          <p class="item-sub">Size ${size}</p>
                        </td>
                        <td style="text-align: center;" class="stock-value ${stockVal <= 5 ? 'stock-red' : ''}">
                          ${stockVal}
                        </td>
                        <td style="text-align: right;">
                          <span class="badge ${badgeClass}">${statusText}</span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 16px 0;">
              All shoe models and sizes are currently well-stocked. No replenishment orders are required at this time.
            </p>
          `}
          
          <div style="text-align: center;">
            <a href="http://localhost:3000" class="btn" target="_blank">Open ShoeTracker Dashboard</a>
          </div>
        </div>
        
        <div class="footer">
          <p>This is an automated notification generated by your <b>ShoeTracker Stock Management System</b>.</p>
          <p>Configured Threshold: <b>${settings.threshold} pairs</b> | Administrator: <a href="mailto:${settings.adminEmail}">${settings.adminEmail}</a></p>
          <p>&copy; 2026 ShoeTracker Team. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  let status: 'Simulated' | 'Delivered' | 'Failed' = 'Simulated';
  let errMsg: string | undefined;

  // If method is SMTP and host/user/pass are provided, attempt real delivery!
  if (settings.emailMethod === 'smtp' && settings.smtpHost && settings.smtpUser && settings.smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: Number(settings.smtpPort || 465),
        secure: Number(settings.smtpPort) === 465,
        auth: {
          user: settings.smtpUser,
          pass: settings.smtpPass,
        },
      });

      await transporter.sendMail({
        from: settings.smtpFrom || `"ShoeTracker Alerts" <${settings.smtpUser}>`,
        to: settings.adminEmail,
        subject: subject,
        html: htmlBody,
      });

      status = 'Delivered';
      console.log(`📧 Successfully sent real stock notification email to ${settings.adminEmail}`);
    } catch (e: any) {
      status = 'Failed';
      errMsg = e.message || 'Unknown SMTP error';
      console.error(`❌ Failed to send SMTP email:`, e);
    }
  } else {
    console.log(`✉️ Simulated automated low stock email compiled for ${settings.adminEmail} (Sandbox Mode)`);
  }

  // Create log item
  const newLog: EmailLog = {
    id: `email-${Math.random().toString().slice(2, 9)}-2026`,
    date: new Date().toISOString(),
    recipient: settings.adminEmail,
    subject: subject,
    body: htmlBody,
    status,
    errorMessage: errMsg,
    lowStockItemsCount: lowStockItems.length,
  };

  // Prepend to email logs
  const logs = getEmailLogs();
  logs.unshift(newLog);
  saveEmailLogs(logs.slice(0, 100)); // Keep last 100 logs

  return { 
    success: status !== 'Failed', 
    log: newLog, 
    error: errMsg 
  };
}
