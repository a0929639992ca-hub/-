import { ReceiptAnalysis } from "../types";

const LOCAL_KEY = 'japan_receipt_history_v1';
const CLOUD_PREFIX = 'japan_receipt_cloud_';

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

// 核心同步函式：將本地資料推送到雲端
export const syncLocalToCloud = async (userId: string): Promise<ReceiptAnalysis[]> => {
  return new Promise((resolve) => {
    // 模擬網路傳輸延遲
    setTimeout(() => {
      const localData = getLocalHistory();
      const cloudData = getUserCloudHistory(userId);
      
      // 合併資料（根據 ID 去重）
      const mergedMap = new Map<string, ReceiptAnalysis>();
      [...cloudData, ...localData].forEach(item => {
        if (item.id) mergedMap.set(item.id, { ...item, userId });
      });
      
      const mergedList = Array.from(mergedMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      // 儲存回雲端空間
      localStorage.setItem(`${CLOUD_PREFIX}${userId}`, JSON.stringify(mergedList));
      // 同步後清空本地匿名資料（或保留，此處選擇清空以模擬雲端轉移）
      localStorage.removeItem(LOCAL_KEY);
      
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
  return updated;
};