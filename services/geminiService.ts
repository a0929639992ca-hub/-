import { GoogleGenAI } from "@google/genai";
import { ReceiptAnalysis } from "../types";

// Using 'gemini-3-flash-preview' without tools is very fast and efficient.
const MODEL_NAME = 'gemini-3-flash-preview';

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
  retries: number = 3, 
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
 * @param manualRate Optional manual exchange rate. Defaults to 0.25 if not provided.
 * @returns A structured ReceiptAnalysis object.
 */
export const translateReceipt = async (
    base64Image: string, 
    mimeType: string = 'image/jpeg',
    manualRate?: number
): Promise<ReceiptAnalysis> => {
  try {
    // API key must be obtained exclusively from process.env.API_KEY
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("API Key missing.");
      throw new Error("找不到 API Key。請在 Vercel 設定環境變數 'API_KEY'，並務必「重新部署 (Redeploy)」以生效。");
    }

    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    // Use provided rate or default to 0.25
    const targetRate = manualRate || 0.25;

    const prompt = `
      You are an expert accountant and Japan travel shopping assistant.
      
      Task: Analyze this Japanese receipt image and create a structured "Categorized Expense Report".
      
      **STEP 1: METADATA EXTRACTION (HIGHEST PRIORITY)**
      Search the ENTIRE receipt (Header, Footer, and body) for Date and Time.
      
      **Date Search Rules:**
      - Look specifically for these keywords: "日付", "年月日", "Date", "領収日", "利用日".
      - **Era Conversion (CRITICAL)**: 
        - "R6" or "令和6" or "令和6年" -> **2024**
        - "R7" or "令和7" or "令和7年" -> **2025**
        - "R5" or "令和5" -> **2023**
      - Common Formats to scan: 
        - "2024/10/25", "24-10-25"
        - "R6.10.25", "令和6年10月25日"
        - "Oct 25, 2024"
      - **Output**: YYYY-MM-DD format (e.g., "2024-10-25").
      
      **Time Search Rules:**
      - **You MUST identify the transaction time.**
      - Look for patterns like: "14:30", "19:00:00", "09:45", "PM 02:30", "18:45".
      - **Location Hint**: Often located **Right next to the date** OR **At the very bottom** of the receipt (footer).
      - Look for labels: "時刻", "Time", "領収".
      - **Output**: HH:MM format (e.g., "14:30"). 
      
      **STEP 2: ITEM EXTRACTION & CALCULATION**
      - Exchange Rate: FIXED at ${targetRate}.
      - Identify the STORE NAME (often at the very top, large text).
      - List all purchased items.
      - **Translate** item names to Natural Taiwanese Traditional Chinese (道地台灣繁體中文).
      - **Keep** original Japanese names.
      - Calculate prices: JPY * ${targetRate} = TWD (round to integer).
      
      **Categories**: [精品香氛, 伴手禮, 美妝保養, 藥品保健, 食品調味, 零食雜貨, 服飾配件, 3C家電, 其他].
      
      **Output JSON Only**:
      \`\`\`json
      {
        "exchangeRate": ${targetRate},
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
      \`\`\`
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
            // REMOVED googleSearch tool to save quota and force manual rate usage
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
    
    if (error?.status === 429 || error?.message?.includes('429')) {
        throw new Error("目前使用人數過多 (429)，請稍後再試。");
    }
    
    throw error;
  }
};