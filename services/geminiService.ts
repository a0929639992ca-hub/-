import { GoogleGenAI } from "@google/genai";
import { ReceiptAnalysis } from "../types";

// 使用使用者要求的 Nano Banana 系列模型 (2.5 Flash Image)
const MODEL_NAME = 'gemini-2.5-flash-image';

const cleanJsonString = (text: string): string => {
  if (!text) return "";
  // 優先尋找 Markdown JSON 區塊
  const match = text.match(/```json([\s\S]*?)```/);
  if (match) return match[1].trim();
  
  // 次之尋找第一個 { 和最後一個 } 之間的內容
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    return text.substring(firstBrace, lastBrace + 1).trim();
  }
  
  return text.trim();
};

async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = 3, 
  delay: number = 2000 
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const isRetryable = error?.status === 429 || error?.code === 429 || error?.status === 503;
    if (retries > 0 && isRetryable) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const translateReceipt = async (
    base64Image: string, 
    mimeType: string = 'image/jpeg',
    manualRate?: number
): Promise<ReceiptAnalysis> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key 遺失，請檢查設定。");
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const targetRate = manualRate || 0.25;

    const prompt = `你是一個精通日文與中文的收據分析專家。請分析這張日本收據照片，並產出台灣繁體中文報告。
       
       規則：
       1. 轉換紀年：R6 或 令和6年代表 2024, R7 或 令和7年代表 2025。
       2. 使用匯率：${targetRate}。
       3. 類別限定：[精品香氛, 伴手禮, 美妝保養, 藥品保健, 食品調味, 零食雜貨, 服飾配件, 3C家電, 其他]。
       
       請回傳 JSON 格式，結構如下：
       {
         "exchangeRate": ${targetRate},
         "date": "YYYY-MM-DD",
         "time": "HH:MM",
         "totalJpy": 數字,
         "totalTwd": 數字,
         "items": [
           {
             "category": "類別",
             "store": "商店名",
             "name": "中文品名",
             "originalName": "日文原名",
             "priceTwd": 數字,
             "originalPriceJpy": 數字,
             "note": "備註"
           }
         ]
       }`;

    const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [
                  { inlineData: { mimeType, data: base64Image } }, 
                  { text: prompt }
                ],
            },
        });
    });

    const text = response.text || "";
    const cleaned = cleanJsonString(text);
    if (!cleaned) throw new Error("AI 回覆內容無法解析，請重新拍攝。");

    const parsed = JSON.parse(cleaned) as ReceiptAnalysis;
    
    // 防禦性檢查：確保 items 存在且為陣列
    if (!parsed.items || !Array.isArray(parsed.items)) {
      parsed.items = [];
    }
    
    // 確保數值正確
    parsed.totalTwd = parsed.totalTwd || 0;
    parsed.exchangeRate = parsed.exchangeRate || targetRate;

    return parsed;
  } catch (error: any) {
    console.error("Translation Error:", error);
    throw error;
  }
};

/**
 * 帳號會員專屬：AI 消費分析
 */
export const generateShoppingReport = async (history: ReceiptAnalysis[]): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key 遺失。");
    const ai = new GoogleGenAI({ apiKey: apiKey });

    const summaryData = history.map(h => ({
      date: h.date,
      totalTwd: h.totalTwd,
      categories: h.items?.map(i => i.category) || []
    }));

    const prompt = `
      你是一位專業的日本旅遊消費顧問。以下是使用者的購物紀錄：
      ${JSON.stringify(summaryData)}
      請產出一份約 200 字的「消費性格報告」，包含消費型態、節奏與建議。用台灣繁體中文，親切幽默並多用 Emoji。
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "報告生成失敗。";
  } catch (err) {
    console.error(err);
    return "AI 報告生成失敗，請稍後再試。";
  }
};