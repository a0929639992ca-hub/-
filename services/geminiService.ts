import { GoogleGenAI } from "@google/genai";
import { ReceiptAnalysis } from "../types";

// User requested "Gemini Nano Banana", which maps to 'gemini-2.5-flash-image'
const MODEL_NAME = 'gemini-2.5-flash-image';

/**
 * Robustly extracts JSON from the model response.
 * Handles cases where the model includes text before/after the JSON block.
 */
const cleanJsonString = (text: string): string => {
  if (!text) return "";
  
  // Try to find a JSON code block first
  const match = text.match(/```json([\s\S]*?)```/);
  if (match) {
    return match[1].trim();
  }
  
  // Fallback: Remove markdown code block syntax if present without "json" tag
  return text.replace(/^```/g, "").replace(/```$/g, "").trim();
};

/**
 * Helper function to retry an async operation with exponential backoff.
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = 2, // Reduced retries to avoid long waits on hard limits
  delay: number = 2000
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check for 429 (Resource Exhausted) or 503 (Service Unavailable)
    const isRetryable = 
      error?.status === 429 || 
      error?.code === 429 || 
      (error?.message && error.message.includes('429')) ||
      error?.status === 503;

    if (retries > 0 && isRetryable) {
      console.warn(`API Limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

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
      1. **Date & Time (CRITICAL)**: 
         - Identify the transaction date (YYYY-MM-DD).
         - **EXTREMELY IMPORTANT**: You MUST identify the transaction time (HH:MM). 
           - Scan the entire receipt (top, bottom, near date) for patterns like "14:30", "19:00", "09:45", "PM 02:30".
      2. **Exchange Rate**:
         - Since you cannot browse the web, **ESTIMATE** the "Bank of Taiwan JPY to TWD Cash Selling Rate" based on the transaction date.
         - Rule of thumb: 
           - 2023-2024 average: 0.21 - 0.22
           - 2025: Estimate around 0.215 unless you see date-specific evidence on the receipt.
         - Use this rate to calculate TWD prices.
      3. **Categories**: Sort items into categories: [精品香氛, 伴手禮, 美妝保養, 藥品保健, 食品調味, 零食雜貨, 服飾配件, 3C家電, 其他].
      4. **Price Logic**:
         - Extract the **Total Payment Amount** in JPY (Sum of all items including tax/discounts).
         - Extract the *actual paid amount* per item.
         - Convert the final JPY amounts to TWD using your estimated rate (round to nearest integer).
      5. **Translation (CRITICAL)**: 
         - **field: name**: Translate the product name into **Natural Taiwanese Mandarin (道地台灣繁體中文)**.
           - Examples: '洗面乳', '優格', '洋芋片', '行動電源'.
         - **field: originalName**: Keep the EXACT Japanese product name text.
      
      Output Format:
      - You must output **ONLY** a valid JSON object inside a \`\`\`json code block.
      - Do not include any other conversational text outside the JSON block.
      
      JSON Schema:
      {
        "exchangeRate": number,
        "date": "YYYY-MM-DD",
        "time": "HH:MM",
        "totalJpy": number,
        "totalTwd": number,
        "items": [
          {
            "category": "string",
            "store": "string",
            "name": "string",
            "originalName": "string",
            "priceTwd": number,
            "originalPriceJpy": number,
            "note": "string"
          }
        ]
      }
    `;

    // Wrap the API call in the retry helper
    const response = await retryWithBackoff(async () => {
        return await ai.models.generateContent({
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
            // Note: 'gemini-2.5-flash-image' does not support tools (Google Search).
        });
    });

    const text = cleanJsonString(response.text || "");
    
    if (!text) {
      throw new Error("AI 回應為空，請重試");
    }

    let result: ReceiptAnalysis;
    try {
      result = JSON.parse(text) as ReceiptAnalysis;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Text received:", text);
      throw new Error("無法解析收據資料，請確保照片清晰並重試。");
    }

    return result;

  } catch (error: any) {
    console.error("Gemini Service Error:", error);
    
    // Provide a more user-friendly error message for quotas
    if (error?.status === 429 || error?.message?.includes('429')) {
        throw new Error("目前使用人數過多 (429)，系統已降低解析度以節省流量。請稍後再試。");
    }
    
    throw error;
  }
};