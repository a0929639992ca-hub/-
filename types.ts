export interface ReceiptItem {
  category: string;      // 類別 (e.g. 藥妝, 食品)
  store: string;         // 商店/品牌
  name: string;          // 中文品名
  originalName: string;  // 日文原名
  priceTwd: number;      // 台幣單價
  originalPriceJpy: number; // 日幣原價
  note: string;          // 備註
}

export interface ReceiptAnalysis {
  id?: string;           // 唯一識別碼
  userId?: string;       // 關聯的使用者 ID
  timestamp?: number;    // 建立時間
  exchangeRate: number;  // 匯率
  sourceUrl?: string;    // 匯率來源連結
  date: string;          // 日期
  time?: string;         // 購物時間
  totalTwd: number;      // 總台幣
  totalJpy?: number;     // 總日幣
  items: ReceiptItem[];  // 商品列表
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export enum AppState {
  IDLE = 'IDLE',
  CAPTURING = 'CAPTURING',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  HISTORY = 'HISTORY',
  STATS = 'STATS',
  AUTH = 'AUTH', // 新增登入狀態
  ERROR = 'ERROR'
}