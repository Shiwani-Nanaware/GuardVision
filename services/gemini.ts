
import { GoogleGenAI, Type } from "@google/genai";
import { Detection } from "../types";

const MODEL_NAME = 'gemini-3-pro-preview';

export const analyzeImageForPII = async (base64Image: string): Promise<Detection[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `
    Analyze this image and detect all instances of Personally Identifiable Information (PII) or sensitive content.
    Look for:
    - Faces
    - Names
    - Phone numbers
    - Email addresses
    - Physical addresses
    - Credit card numbers
    - Driver's licenses or ID cards
    - Signatures
    - Confidential stamps or markings
    - Passwords or sensitive text
    
    Return a JSON array of objects. Each object must contain:
    - "label": A short descriptive name for the detected PII (e.g., "Face", "Credit Card", "Phone Number").
    - "confidence": A float between 0 and 1.
    - "box_2d": An array [ymin, xmin, ymax, xmax] normalized from 0 to 1000.
    
    Be precise with the bounding boxes.
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              box_2d: {
                type: Type.ARRAY,
                items: { type: Type.NUMBER },
                minItems: 4,
                maxItems: 4
              }
            },
            required: ["label", "confidence", "box_2d"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI model.");

    const rawDetections = JSON.parse(text);
    return rawDetections.map((d: any, index: number) => ({
      ...d,
      id: `det-${index}-${Date.now()}`,
      selected: true // Default to selected for redaction
    }));
  } catch (error) {
    console.error("AI Analysis failed:", error);
    throw error;
  }
};
