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
  retries: number = 2, 
  delay: number = 2000 
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    const status = error?.status || error?.code;
    // 如果是 429 (Too Many Requests) 或 503 (Service Unavailable)，進行重試
    if (retries > 0 && (status === 429 || status === 503 || status === 500)) {
      console.warn(`API Error ${status}, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(operation, retries - 1, delay * 1.5);
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
    if (!apiKey) throw new Error("API Key 未設定，請檢查環境變數。");
    
    const ai = new GoogleGenAI({ apiKey });
    const targetRate = manualRate || 0.25;

    const prompt = `你是一個收據辨識助手。請分析圖片中的日本收據，並嚴格依照以下 JSON 格式回傳報告（僅回傳 JSON，不要有其他廢話）：
    {
      "exchangeRate": ${targetRate},
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "totalJpy": 數字,
      "totalTwd": 數字,
      "items": [
        {
          "category": "精品香氛/伴手禮/美妝保養/藥品保健/食品調味/零食雜貨/服飾配件/3C家電/其他",
          "store": "商店名",
          "name": "中文品名",
          "originalName": "日文原名",
          "priceTwd": 數字,
          "originalPriceJpy": 數字,
          "note": ""
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
            config: {
                temperature: 0.1,
                responseMimeType: "application/json",
                // 為 2.5 系列模型加入思考預算以提升 OCR 解析品質
                thinkingConfig: { thinkingBudget: 4000 }
            }
        });
    });

    const text = response.text || "";
    const cleaned = cleanJsonString(text);
    if (!cleaned) throw new Error("AI 無法識別內容，請重拍或換個角度。");

    const parsed = JSON.parse(cleaned) as ReceiptAnalysis;
    
    // 防禦性修正：確保核心資料完整
    if (!parsed.items || !Array.isArray(parsed.items)) parsed.items = [];
    if (!parsed.totalTwd) {
        parsed.totalTwd = parsed.items.reduce((sum, item) => sum + (item.priceTwd || 0), 0);
    }
    if (!parsed.totalJpy) {
        parsed.totalJpy = parsed.items.reduce((sum, item) => sum + (item.originalPriceJpy || 0), 0);
    }
    parsed.exchangeRate = parsed.exchangeRate || targetRate;
    parsed.date = parsed.date || new Date().toISOString().split('T')[0];

    return parsed;
  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    
    // 針對 429 錯誤提供更友善的訊息
    if (error?.status === 429 || error?.code === 429) {
        throw new Error("API 使用量已達上限 (Quota Exceeded)。請稍後再試，或檢查您的 Google Cloud API 配額設定。");
    }

    if (error instanceof SyntaxError) {
        throw new Error("格式解析錯誤。請嘗試重新拍攝更清晰的照片。");
    }
    throw error;
  }
};

export const generateShoppingReport = async (history: ReceiptAnalysis[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const summary = history.slice(0, 5).map(h => `${h.date}: 消費 NT$${h.totalTwd}`).join('\n');
    const prompt = `基於以下消費紀錄，寫一段親切幽默的分析報告（100字內）：\n${summary}`;
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 2000 }
      }
    });
    return response.text || "無法生成報告";
  } catch (err) {
    return "分析暫時無法使用，請稍後再試。";
  }
};