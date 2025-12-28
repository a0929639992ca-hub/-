import { ReceiptAnalysis } from "../types";
import { getCurrentUser } from "./authService";

// 定義所有曾經使用的 Key 列表，用於遷移舊資料
const STORAGE_KEYS = {
  CURRENT_LOCAL: 'japan_receipt_history_v1',
  LEGACY_LOCAL: ['japan_receipt_history', 'receipt_history'], // 舊版本 Key
  CLOUD_PREFIX: 'japan_receipt_cloud_',
  VERSION: '1.2'
};

/**
 * 儲存診斷：檢查當前儲存狀態
 */
export const getStorageStats = () => {
  const user = getCurrentUser();
  const key = user ? `${STORAGE_KEYS.CLOUD_PREFIX}${user.id}` : STORAGE_KEYS.CURRENT_LOCAL;
  const data = localStorage.getItem(key);
  const size = data ? (new Blob([data]).size / 1024).toFixed(2) : '0';
  const count = data ? JSON.parse(data).length : 0;
  
  return {
    key,
    sizeKb: size,
    count,
    mode: user ? '雲端帳號模式' : '本地儲存模式',
    username: user?.name,
    version: STORAGE_KEYS.VERSION
  };
};

/**
 * 核心：取得歷史紀錄（含舊資料自動遷移）
 */
export const getHistory = (): ReceiptAnalysis[] => {
  const user = getCurrentUser();
  const storageKey = user ? `${STORAGE_KEYS.CLOUD_PREFIX}${user.id}` : STORAGE_KEYS.CURRENT_LOCAL;
  
  // 1. 嘗試讀取當前 Key
  let historyJson = localStorage.getItem(storageKey);
  let history: ReceiptAnalysis[] = historyJson ? JSON.parse(historyJson) : [];

  // 2. 遷移邏輯：如果當前是本地模式且沒資料，嘗試從舊版 Key 挖資料
  if (!user && history.length === 0) {
    for (const legacyKey of STORAGE_KEYS.LEGACY_LOCAL) {
      const legacyData = localStorage.getItem(legacyKey);
      if (legacyData) {
        console.log(`[Migration] 發現舊版資料於 ${legacyKey}，正在搬移...`);
        const parsedLegacy = JSON.parse(legacyData);
        history = [...history, ...parsedLegacy];
        // 搬移後標記為已遷移（或刪除舊 Key）
        localStorage.removeItem(legacyKey);
      }
    }
    // 如果有挖到舊資料，存入當前 Key
    if (history.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_LOCAL, JSON.stringify(history));
    }
  }

  return history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

/**
 * 同步本地資料到雲端帳號
 */
export const syncLocalToCloud = async (userId: string): Promise<ReceiptAnalysis[]> => {
  const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_LOCAL) || '[]');
  const cloudKey = `${STORAGE_KEYS.CLOUD_PREFIX}${userId}`;
  const cloudData = JSON.parse(localStorage.getItem(cloudKey) || '[]');
  
  const mergedMap = new Map<string, ReceiptAnalysis>();
  
  // 優先保留雲端資料
  cloudData.forEach((item: ReceiptAnalysis) => {
    if (item.id) mergedMap.set(item.id, item);
  });
  
  // 合併本地資料
  localData.forEach((item: ReceiptAnalysis) => {
    if (item.id && !mergedMap.has(item.id)) {
      mergedMap.set(item.id, { ...item, userId });
    }
  });
  
  const mergedList = Array.from(mergedMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  
  // 寫入雲端
  localStorage.setItem(cloudKey, JSON.stringify(mergedList));
  
  // 重要：同步後清空本地，避免資料重複，但可以留一個備份在 Legacy
  localStorage.setItem('japan_receipt_last_sync_backup', JSON.stringify(localData));
  localStorage.removeItem(STORAGE_KEYS.CURRENT_LOCAL);
  
  return mergedList;
};

/**
 * 儲存單筆明細
 */
export const saveReceiptToHistory = (data: ReceiptAnalysis): ReceiptAnalysis => {
  const user = getCurrentUser();
  const storageKey = user ? `${STORAGE_KEYS.CLOUD_PREFIX}${user.id}` : STORAGE_KEYS.CURRENT_LOCAL;
  
  const history = getHistory(); // 這會自動處理遷移
  
  const newRecord: ReceiptAnalysis = {
    ...data,
    id: data.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    timestamp: Date.now(),
    userId: user?.id 
  };

  const updatedHistory = [newRecord, ...history];
  localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
  
  return newRecord;
};

/**
 * 刪除單筆明細
 */
export const deleteFromHistory = (id: string): ReceiptAnalysis[] => {
  const user = getCurrentUser();
  const storageKey = user ? `${STORAGE_KEYS.CLOUD_PREFIX}${user.id}` : STORAGE_KEYS.CURRENT_LOCAL;
  
  const history = getHistory();
  const updated = history.filter(item => item.id !== id);
  localStorage.setItem(storageKey, JSON.stringify(updated));
  
  return updated;
};

export const exportHistoryData = (): string => {
  return JSON.stringify({
    version: STORAGE_KEYS.VERSION,
    data: getHistory(),
    exportDate: new Date().toISOString()
  }, null, 2);
};

export const importHistoryData = (jsonString: string): ReceiptAnalysis[] => {
  try {
    const parsed = JSON.parse(jsonString);
    const dataToImport = Array.isArray(parsed) ? parsed : (parsed.data || []);
    
    const user = getCurrentUser();
    const storageKey = user ? `${STORAGE_KEYS.CLOUD_PREFIX}${user.id}` : STORAGE_KEYS.CURRENT_LOCAL;
    const currentHistory = getHistory();
    
    const mergedMap = new Map<string, ReceiptAnalysis>();
    [...currentHistory, ...dataToImport].forEach(item => {
      if (item.id) mergedMap.set(item.id, { ...item, userId: user?.id });
    });
    
    const mergedList = Array.from(mergedMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    localStorage.setItem(storageKey, JSON.stringify(mergedList));
    
    return mergedList;
  } catch (e) {
    throw new Error("格式錯誤，無法還原");
  }
};