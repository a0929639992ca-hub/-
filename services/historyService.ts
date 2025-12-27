import { ReceiptAnalysis } from "../types";

const STORAGE_KEY = 'japan_receipt_history_v1';

export const saveReceiptToHistory = (data: ReceiptAnalysis): ReceiptAnalysis => {
  const history = getHistory();
  
  // Create a new record with ID and Timestamp
  const newRecord: ReceiptAnalysis = {
    ...data,
    id: Date.now().toString(), // Simple ID generation
    timestamp: Date.now()
  };

  // Add to beginning of array
  const updatedHistory = [newRecord, ...history];
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
  } catch (e) {
    console.error("Storage quota exceeded", e);
    // If quota exceeded, remove last 5 items and try again
    if (updatedHistory.length > 5) {
        const trimmed = updatedHistory.slice(0, updatedHistory.length - 5);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    }
  }
  
  return newRecord;
};

export const getHistory = (): ReceiptAnalysis[] => {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error("Failed to read history", e);
    return [];
  }
};

export const deleteFromHistory = (id: string): ReceiptAnalysis[] => {
  const history = getHistory();
  const updated = history.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};