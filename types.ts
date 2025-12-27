export interface ReceiptItem {
  category: string;      // 類別 (e.g. 藥妝, 食品)
  store: string;         // 商店/品牌
  name: string;          // 中文品名
  originalName: string;  // 日文原名 (Added)
  priceTwd: number;      // 台幣單價
  originalPriceJpy: number; // 日幣原價
  note: string;          // 備註 (折扣, 平均成本等)
}

export interface ReceiptAnalysis {
  id?: string;           // 唯一識別碼 (儲存用)
  timestamp?: number;    // 建立時間 (儲存用)
  exchangeRate: number;  // 匯率
  sourceUrl?: string;    // 匯率來源連結 (Added)
  date: string;          // 日期
  time?: string;         // 購物時間 (e.g. 14:30)
  totalTwd: number;      // 總台幣
  totalJpy?: number;     // 總日幣 (Added, optional for backward compatibility)
  items: ReceiptItem[];  // 商品列表
}

export enum AppState {
  IDLE = 'IDLE',
  CAPTURING = 'CAPTURING',
  ANALYZING = 'ANALYZING',
  RESULT = 'RESULT',
  HISTORY = 'HISTORY',
  ERROR = 'ERROR'
}