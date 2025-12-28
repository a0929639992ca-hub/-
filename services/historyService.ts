import { ReceiptAnalysis } from "../types";
import { getCurrentUser } from "./authService";

const STORAGE_KEYS = {
  CURRENT_LOCAL: 'japan_receipt_history_v1',
  LEGACY_LOCAL: ['japan_receipt_history', 'receipt_history'],
  CLOUD_PREFIX: 'japan_receipt_cloud_',
  VERSION: '1.2'
};

export const getStorageStats = () => {
  const user = getCurrentUser();
  const key = user ? `${STORAGE_KEYS.CLOUD_PREFIX}${user.id}` : STORAGE_KEYS.CURRENT_LOCAL;
  let count = 0;
  try {
    const data = localStorage.getItem(key);
    count = data ? JSON.parse(data).length : 0;
  } catch (e) {
    count = 0;
  }
  
  const size = localStorage.getItem(key) ? (new Blob([localStorage.getItem(key)!]).size / 1024).toFixed(2) : '0';
  
  return {
    key,
    sizeKb: size,
    count,
    mode: user ? '雲端帳號模式' : '本地儲存模式',
    username: user?.name,
    version: STORAGE_KEYS.VERSION
  };
};

export const getHistory = (): ReceiptAnalysis[] => {
  const user = getCurrentUser();
  const storageKey = user ? `${STORAGE_KEYS.CLOUD_PREFIX}${user.id}` : STORAGE_KEYS.CURRENT_LOCAL;
  
  let history: ReceiptAnalysis[] = [];
  try {
    const json = localStorage.getItem(storageKey);
    history = json ? JSON.parse(json) : [];
    if (!Array.isArray(history)) history = [];
  } catch (e) {
    console.error("History Parse Error:", e);
    history = [];
  }

  // 遷移邏輯
  if (!user && history.length === 0) {
    for (const legacyKey of STORAGE_KEYS.LEGACY_LOCAL) {
      try {
        const legacyData = localStorage.getItem(legacyKey);
        if (legacyData) {
          const parsedLegacy = JSON.parse(legacyData);
          if (Array.isArray(parsedLegacy)) {
            history = [...history, ...parsedLegacy];
          }
          localStorage.removeItem(legacyKey);
        }
      } catch (e) {}
    }
    if (history.length > 0) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_LOCAL, JSON.stringify(history));
    }
  }

  return history.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
};

export const syncLocalToCloud = async (userId: string): Promise<ReceiptAnalysis[]> => {
  const localData = getHistory(); // 自動從本地讀取
  const cloudKey = `${STORAGE_KEYS.CLOUD_PREFIX}${userId}`;
  let cloudData: ReceiptAnalysis[] = [];
  try {
    const json = localStorage.getItem(cloudKey);
    cloudData = json ? JSON.parse(json) : [];
  } catch(e) {}
  
  const mergedMap = new Map<string, ReceiptAnalysis>();
  cloudData.forEach(item => { if (item.id) mergedMap.set(item.id, item); });
  localData.forEach(item => { if (item.id && !mergedMap.has(item.id)) mergedMap.set(item.id, { ...item, userId }); });
  
  const mergedList = Array.from(mergedMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  localStorage.setItem(cloudKey, JSON.stringify(mergedList));
  localStorage.removeItem(STORAGE_KEYS.CURRENT_LOCAL);
  
  return mergedList;
};

export const saveReceiptToHistory = (data: ReceiptAnalysis): ReceiptAnalysis => {
  const user = getCurrentUser();
  const storageKey = user ? `${STORAGE_KEYS.CLOUD_PREFIX}${user.id}` : STORAGE_KEYS.CURRENT_LOCAL;
  const history = getHistory();
  
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