import { GoogleGenAI } from "@google/genai";
import { ReceiptAnalysis } from "../types";

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
         - **CRITICAL**: Identify the transaction time (HH:MM). Look for patterns like "14:30", "19:00".
      2. **Exchange Rate (SEARCH REQUIRED)**:
         - **STEP 1**: Identify the transaction date from the receipt.
         - **STEP 2**: Use the **Google Search tool** to find the specific "Bank of Taiwan JPY to TWD Cash Selling Rate" (台灣銀行 日幣 現金賣出 匯率) for that date.
         - **STEP 3**: Use the found rate for the 'exchangeRate' field. 
         - If the date is today or very recent and specific data isn't available yet, find the most recent closing rate.
         - If search fails completely, fallback to 0.22.
      3. **Categories**: Sort items into categories: [精品香氛, 伴手禮, 美妝保養, 藥品保健, 食品調味, 零食雜貨, 服飾配件, 3C家電, 其他].
      4. **Price Logic**:
         - Extract the **Total Payment Amount** in JPY (Sum of all items including tax/discounts).
         - Extract the *actual paid amount* per item.
         - Convert the final JPY amounts to TWD using the searched exchange rate (round to nearest integer).
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
        tools: [{ googleSearch: {} }], // Enable Google Search for exchange rates
        thinkingConfig: { thinkingBudget: 0 },
      }
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

    // Extract grounding URL if available (to attribute the exchange rate source)
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webChunk = chunks.find(c => c.web?.uri);
    if (webChunk && webChunk.web?.uri) {
        result.sourceUrl = webChunk.web.uri;
    }

    return result;

  } catch (error) {
    console.error("Gemini Service Error:", error);
    throw error;
  }
};