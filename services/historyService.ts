import { ReceiptAnalysis } from "../types";
import { getCurrentUser } from "./authService";

const LOCAL_KEY = 'japan_receipt_history_v1';
const CLOUD_PREFIX = 'japan_receipt_cloud_';

// 取得儲存狀態診斷
export const getStorageStats = () => {
  const user = getCurrentUser();
  const key = user ? `${CLOUD_PREFIX}${user.id}` : LOCAL_KEY;
  const data = localStorage.getItem(key);
  const size = data ? (new Blob([data]).size / 1024).toFixed(2) : '0';
  const count = data ? JSON.parse(data).length : 0;
  
  return {
    key,
    sizeKb: size,
    count,
    mode: user ? '雲端帳號模式' : '本地儲存模式',
    username: user?.name
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

// 取得特定使用者的雲端紀錄
export const getUserCloudHistory = (userId: string): ReceiptAnalysis[] => {
  try {
    const json = localStorage.getItem(`${CLOUD_PREFIX}${userId}`);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    return [];
  }
};

// 核心函式：根據目前登入狀態取得所有紀錄
export const getHistory = (): ReceiptAnalysis[] => {
  const user = getCurrentUser();
  if (user) {
    return getUserCloudHistory(user.id);
  }
  return getLocalHistory();
};

// 核心同步函式：登入時將本地資料遷移至雲端
export const syncLocalToCloud = async (userId: string): Promise<ReceiptAnalysis[]> => {
  console.log(`[Sync] 開始同步本地資料至雲端帳號: ${userId}`);
  
  // 模擬網路延遲
  await new Promise(resolve => setTimeout(resolve, 800));
  
  const localData = getLocalHistory();
  const cloudData = getUserCloudHistory(userId);
  
  // 合併策略：根據 ID 去重，並標註 userId
  const mergedMap = new Map<string, ReceiptAnalysis>();
  
  // 先放雲端資料
  cloudData.forEach(item => {
    if (item.id) mergedMap.set(item.id, item);
  });
  
  // 再放本地資料（若 ID 重複則以雲端為主，或可在這裡做覆蓋策略）
  localData.forEach(item => {
    if (item.id && !mergedMap.has(item.id)) {
      mergedMap.set(item.id, { ...item, userId });
    }
  });
  
  const mergedList = Array.from(mergedMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  
  // 寫入雲端並清空本地
  localStorage.setItem(`${CLOUD_PREFIX}${userId}`, JSON.stringify(mergedList));
  localStorage.removeItem(LOCAL_KEY);
  
  console.log(`[Sync] 同步完成。總計 ${mergedList.length} 筆紀錄。`);
  return mergedList;
};

// 核心函式：儲存明細（自動判斷目標）
export const saveReceiptToHistory = (data: ReceiptAnalysis): ReceiptAnalysis => {
  const user = getCurrentUser();
  const storageKey = user ? `${CLOUD_PREFIX}${user.id}` : LOCAL_KEY;
  
  const history = getHistory();
  
  const newRecord: ReceiptAnalysis = {
    ...data,
    id: data.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    timestamp: Date.now(),
    userId: user?.id // 只要有登入，就標註這筆資料屬於該使用者
  };

  const updatedHistory = [newRecord, ...history];
  localStorage.setItem(storageKey, JSON.stringify(updatedHistory));
  
  console.log(`[Storage] 成功儲存至 ${user ? '雲端' : '本地'}. ID: ${newRecord.id}`);
  return newRecord;
};

// 核心函式：刪除紀錄
export const deleteFromHistory = (id: string): ReceiptAnalysis[] => {
  const user = getCurrentUser();
  const storageKey = user ? `${CLOUD_PREFIX}${user.id}` : LOCAL_KEY;
  
  const history = getHistory();
  const updated = history.filter(item => item.id !== id);
  localStorage.setItem(storageKey, JSON.stringify(updated));
  
  console.log(`[Storage] 已從 ${user ? '雲端' : '本地'} 刪除 ID: ${id}`);
  return updated;
};

// 備份與還原
export const exportHistoryData = (): string => {
  const history = getHistory();
  const backup = {
    version: '1.1',
    exportDate: new Date().toISOString(),
    user: getCurrentUser()?.name || 'anonymous',
    data: history
  };
  return JSON.stringify(backup, null, 2);
};

export const importHistoryData = (jsonString: string): ReceiptAnalysis[] => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data || !Array.isArray(parsed.data)) {
      throw new Error("格式錯誤");
    }
    
    const user = getCurrentUser();
    const storageKey = user ? `${CLOUD_PREFIX}${user.id}` : LOCAL_KEY;
    const currentHistory = getHistory();
    
    const mergedMap = new Map<string, ReceiptAnalysis>();
    [...currentHistory, ...parsed.data].forEach(item => {
      if (item.id) {
          mergedMap.set(item.id, { ...item, userId: user?.id });
      }
    });
    
    const mergedList = Array.from(mergedMap.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    localStorage.setItem(storageKey, JSON.stringify(mergedList));
    
    return mergedList;
  } catch (e) {
    throw new Error("還原失敗");
  }
};