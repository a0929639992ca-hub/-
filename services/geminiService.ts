import { GoogleGenAI, Type } from "@google/genai";
import { ReceiptAnalysis } from "../types";

const MODEL_NAME = 'gemini-3-flash-preview';

/**
 * Clean potential markdown code blocks from the response text.
 * Sometimes Gemini wraps JSON in ```json ... ```
 */
const cleanJsonString = (text: string): string => {
  if (!text) return "";
  // Remove ```json at start and ``` at end, and trim whitespace
  return text.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
};

/**
 * Analyzes a Japanese receipt to generate a categorized expense report in TWD.
 * @param base64Image The base64 encoded string of the image (without prefix).
 * @param mimeType The mime type of the image (e.g., 'image/jpeg').
 * @returns A structured ReceiptAnalysis object.
 */
export const translateReceipt = async (base64Image: string, mimeType: string = 'image/jpeg'): Promise<ReceiptAnalysis> => {
  try {
    // API key must be obtained exclusively from process.env.API_KEY
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("API Key missing.");
      throw new Error("找不到 API Key。請在 Vercel 設定環境變數 'API_KEY'，並務必「重新部署 (Redeploy)」以生效。");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });

    const prompt = `
      You are an expert accountant and Japan travel shopping assistant specifically for Taiwanese travelers.
      
      Task: Analyze this Japanese receipt image and create a structured "Categorized Expense Report".
      
      Rules for Extraction & Calculation:
      1. **Date & Time**: 
         - Identify the transaction date (YYYY-MM-DD).
         - Identify the transaction time (HH:MM) if visible on the receipt.
         - Estimate the JPY to TWD exchange rate for that date (e.g., approx 0.21~0.23). If unsure, use 0.22.
      2. **Categories**: Sort items into categories: [精品香氛, 伴手禮, 美妝保養, 藥品保健, 食品調味, 零食雜貨, 服飾配件, 3C家電, 其他].
      3. **Price Logic**:
         - Extract the *actual paid amount* per item.
         - If Tax-Free (免稅), use the tax-free price.
         - If discounted (e.g., 10% OFF), calculate the final price.
         - Convert the final JPY amount to TWD (round to nearest integer).
      4. **Multi-pack Logic**: If an item is a set (e.g., "3 items for ¥1000" or quantity > 1), calculate the *average cost per unit* in TWD and note it in the 'note' field.
      5. **Translation (CRITICAL)**: 
         - **field: name**: Translate the product name into **Natural Taiwanese Mandarin (道地台灣繁體中文)**.
           - **STRICTLY** use Taiwanese vocabulary. 
           - Examples: Use '洗面乳' (not 洗面奶), '優格' (not 酸奶), '洋芋片' (not 土豆片), '行動電源' (not 充電寶), '螢幕' (not 屏幕), '衛衣/大學T' (not 衛衣), '原子筆' (not 圓珠筆).
           - For famous products, use their Taiwan market name (e.g., '合利他命', 'Wakamoto', '膠原蛋白粉').
         - **field: originalName**: Keep the EXACT Japanese product name text as seen on the receipt.
      
      Output JSON Schema:
      Return a JSON object with:
      - exchangeRate: number (the rate used)
      - date: string (YYYY-MM-DD)
      - time: string (HH:MM, or empty string if not found)
      - totalTwd: number (sum of all items in TWD)
      - items: Array of objects:
        - category: string
        - store: string (Store name detected from top of receipt)
        - name: string (Taiwanese Mandarin translation)
        - originalName: string (Exact Japanese text from receipt)
        - priceTwd: number (Final calculated price in TWD)
        - originalPriceJpy: number (Original JPY price found on receipt)
        - note: string (Include details like "Tax-Free", "10% Off", "Avg NT$XX/ea", etc.)
    `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 }, // Disable thinking for faster response
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exchangeRate: { type: Type.NUMBER },
            date: { type: Type.STRING },
            time: { type: Type.STRING },
            totalTwd: { type: Type.NUMBER },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  store: { type: Type.STRING },
                  name: { type: Type.STRING },
                  originalName: { type: Type.STRING },
                  priceTwd: { type: Type.NUMBER },
                  originalPriceJpy: { type: Type.NUMBER },
                  note: { type: Type.STRING },
                },
                required: ["category", "store", "name", "originalName", "priceTwd", "originalPriceJpy", "note"]
              }
            }
          },
          required: ["exchangeRate", "date", "totalTwd", "items"]
        },
      }
    });

    const text = cleanJsonString(response.text || "");
    
    if (!text) {
      throw new Error("AI 回應為空，請重試");
    }

    try {
      return JSON.parse(text) as ReceiptAnalysis;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Text received:", text);
      throw new Error("無法解析收據資料，請確保照片清晰並重試。");
    }

  } catch (error) {
    console.error("Gemini Service Error:", error);
    // Re-throw the specific error message so the UI can show it
    throw error;
  }
};