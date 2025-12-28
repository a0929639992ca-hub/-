import { ReceiptAnalysis } from "../types";

const LOCAL_KEY = 'japan_receipt_history_v1';
const CLOUD_PREFIX = 'japan_receipt_cloud_';

// 取得儲存狀態診斷
export const getStorageStats = (userId?: string) => {
  const key = userId ? `${CLOUD_PREFIX}${userId}` : LOCAL_KEY;
  const data = localStorage.getItem(key);
  const size = data ? (new Blob([data]).size / 1024).toFixed(2) : '0';
  const count = data ? JSON.parse(data).length : 0;
  
  return {
    key,
    sizeKb: size,
    count,
    mode: userId ? '雲端帳號模式' : '本地儲存模式'
  };
};

// 取得目前的本地（匿名）紀錄
export const getLocalHistory = (): ReceiptAnalysis[] => {
  try {
    const json = localStorage.getItem(LOCAL_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    return [];
  }
};

// 取得使用者的雲端紀錄
export const getUserCloudHistory = (userId: string): ReceiptAnalysis[] => {
  try {
    const json = localStorage.getItem(`${CLOUD_PREFIX}${userId}`);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    return [];
  }
};

// 備份資料成 JSON 字串
export const exportHistoryData = (userId?: string): string => {
  const history = getHistory(userId);
  const backup = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    data: history
  };
  return JSON.stringify(backup, null, 2);
};

// 從 JSON 還原資料
export const importHistoryData = (jsonString: string, userId?: string): ReceiptAnalysis[] => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data || !Array.isArray(parsed.data)) {
      throw new Error("無效的備份檔案格式");
    }
    
    const storageKey = userId ? `${CLOUD_PREFIX}${userId}` : LOCAL_KEY;
    const currentHistory = getHistory(userId);
    
    // 合併策略：根據 ID 去重，以新匯入的為主
    const mergedMap = new Map<string, ReceiptAnalysis>();
    [...currentHistory, ...parsed.data].forEach(item => {
      if (item.id) mergedMap.set(item.id, item);
    });
    
    const mergedList = Array.from(mergedMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    localStorage.setItem(storageKey, JSON.stringify(mergedList));
    
    return mergedList;
  } catch (e) {
    console.error("Import error:", e);
    throw new Error("無法解析備份檔案");
  }
};

// 核心同步函式
export const syncLocalToCloud = async (userId: string): Promise<ReceiptAnalysis[]> => {
  console.log(`[Sync] Starting sync for user: ${userId}`);
  return new Promise((resolve) => {
    setTimeout(() => {
      const localData = getLocalHistory();
      const cloudData = getUserCloudHistory(userId);
      
      const mergedMap = new Map<string, ReceiptAnalysis>();
      [...cloudData, ...localData].forEach(item => {
        if (item.id) mergedMap.set(item.id, { ...item, userId });
      });
      
      const mergedList = Array.from(mergedMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      localStorage.setItem(`${CLOUD_PREFIX}${userId}`, JSON.stringify(mergedList));
      localStorage.removeItem(LOCAL_KEY);
      
      console.log(`[Sync] Completed. Total records: ${mergedList.length}`);
      resolve(mergedList);
    }, 1500);
  });
};

export const saveReceiptToHistory = (data: ReceiptAnalysis): ReceiptAnalysis => {
  const userId = data.userId;
  const storageKey = userId ? `${CLOUD_PREFIX}${userId}` : LOCAL_KEY;
  
  const history = userId ? getUserCloudHistory(userId) : getLocalHistory();
  
  const newRecord: ReceiptAnalysis = {
    ...data,
    id: data.id || Date.now().toString(),
    timestamp: Date.now()
  };

  const updatedHistory = [newRecord, ...history];
  localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
  
  console.log(`[Storage] Saved to ${storageKey}. Item ID: ${newRecord.id}`);
  return newRecord;
};

export const getHistory = (userId?: string): ReceiptAnalysis[] => {
  if (userId) return getUserCloudHistory(userId);
  return getLocalHistory();
};

export const deleteFromHistory = (id: string, userId?: string): ReceiptAnalysis[] => {
  const storageKey = userId ? `${CLOUD_PREFIX}${userId}` : LOCAL_KEY;
  const history = userId ? getUserCloudHistory(userId) : getLocalHistory();
  const updated = history.filter(item => item.id !== id);
  localStorage.setItem(storageKey, JSON.stringify(updated));
  console.log(`[Storage] Deleted ID: ${id} from ${storageKey}`);
  return updated;
};