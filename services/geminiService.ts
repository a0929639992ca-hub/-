import { GoogleGenAI } from "@google/genai";
import { ReceiptAnalysis } from "../types";

// 使用使用者要求的 Nano Banana 系列模型
const MODEL_NAME = 'gemini-2.5-flash-image';

const cleanJsonString = (text: string): string => {
  if (!text) return "";
  // 移除可能存在的 Markdown 代碼區塊標記
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0].trim();
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
    // 429: Too Many Requests, 503: Service Unavailable
    if (retries > 0 && (status === 429 || status === 503 || status === 500)) {
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
    if (!apiKey) throw new Error("API Key 未設定");
    
    const ai = new GoogleGenAI({ apiKey });
    const targetRate = manualRate || 0.25;

    const prompt = `你是一個收據辨識助手。請分析圖片中的日本收據，並嚴格依照以下 JSON 格式回傳（僅回傳 JSON 物件）：
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
                temperature: 0.1, // 降低隨機性
                responseMimeType: "application/json"
            }
        });
    });

    const text = response.text || "";
    const cleaned = cleanJsonString(text);
    if (!cleaned) throw new Error("AI 未能產出有效內容");

    const parsed = JSON.parse(cleaned) as ReceiptAnalysis;
    
    // 強制補全核心欄位，避免 UI 崩潰
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
    console.error("Gemini Service Error:", error);
    if (error.message?.includes("JSON")) {
        throw new Error("AI 回傳格式錯誤，請確保收據完整且文字清晰後重拍。");
    }
    throw error;
  }
};

export const generateShoppingReport = async (history: ReceiptAnalysis[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const summary = history.slice(0, 10).map(h => `${h.date}: 消費 NT$${h.totalTwd}`).join('\n');
    const prompt = `基於以下消費紀錄，寫一段親切幽默的分析報告（200字內）：\n${summary}`;
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
    });
    return response.text || "無法生成報告";
  } catch (err) {
    return "分析暫時無法使用";
  }
};