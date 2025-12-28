import { GoogleGenAI } from "@google/genai";
import { ReceiptAnalysis } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

const cleanJsonString = (text: string): string => {
  if (!text) return "";
  const match = text.match(/```json([\s\S]*?)```/);
  if (match) return match[1].trim();
  return text.replace(/^```/g, "").replace(/```$/g, "").trim();
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
    if (!apiKey) throw new Error("API Key missing.");
    const ai = new GoogleGenAI({ apiKey: apiKey });
    const targetRate = manualRate || 0.25;

    const prompt = `分析此日本收據，產出台灣繁體中文報告。
       Era Conversion: R6/令和6=2024, R7/令和7=2025.
       匯率: ${targetRate}. 
       類別: [精品香氛, 伴手禮, 美妝保養, 藥品保健, 食品調味, 零食雜貨, 服飾配件, 3C家電, 其他].
       請輸出 JSON 格式包含: exchangeRate, date, time, totalJpy, totalTwd, items.`;

    const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
            model: MODEL_NAME,
            contents: {
                parts: [{ inlineData: { mimeType, data: base64Image } }, { text: prompt }],
            },
        });
    });

    return JSON.parse(cleanJsonString(response.text || "")) as ReceiptAnalysis;
  } catch (error: any) {
    throw error;
  }
};

/**
 * 帳號會員專屬：AI 全方位消費分析
 */
export const generateShoppingReport = async (history: ReceiptAnalysis[]): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing.");
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // 簡化資料以減少 Token 消耗
    const summaryData = history.map(h => ({
      date: h.date,
      totalTwd: h.totalTwd,
      categories: h.items.map(i => i.category)
    }));

    const prompt = `
      你是一位專業的日本旅遊消費顧問。以下是使用者本次旅行的購物紀錄 JSON：
      ${JSON.stringify(summaryData)}
      
      請根據這些數據產出一份「日本消費性格報告」，必須包含：
      1. **消費型態分析**：他是哪種購物者？(例如：美妝控、吃貨、精品買手)
      2. **消費節奏分析**：他在旅行的哪一階段花最多錢？
      3. **專業建議**：根據他的購物習慣，下次去日本可以注意什麼？(例如：某類商品在哪些店更便宜)
      
      請用台灣繁體中文撰寫，語氣親切、專業且幽默，並多使用 Emoji。
      字數約 250 字左右。
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });

    return response.text || "無法生成報告，請檢查網路連接。";
  } catch (err) {
    console.error(err);
    return "AI 報告生成失敗，請稍後再試。";
  }
};