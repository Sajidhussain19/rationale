import { GoogleGenAI, type Part } from "@google/genai";

let _ai: GoogleGenAI | null = null;

/**
 * Gemini client.
 * - If GEMINI_API_KEY is set -> Gemini Developer API.
 * - Otherwise -> Gemini on Vertex AI using the Cloud Run service account (no keys).
 */
export function ai(): GoogleGenAI {
  if (_ai) return _ai;
  const apiKey = process.env.GEMINI_API_KEY;
  _ai = apiKey
    ? new GoogleGenAI({ apiKey })
    : new GoogleGenAI({
        vertexai: true,
        project: process.env.GOOGLE_CLOUD_PROJECT,
        location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
      });
  return _ai;
}

export const MODEL =
  process.env.GEMINI_MODEL || (process.env.GEMINI_API_KEY ? "gemini-flash-latest" : "gemini-2.5-flash");

export async function generateJSON<T>(
  parts: Part[],
  responseSchema: Record<string, unknown>,
  systemInstruction: string,
): Promise<T> {
  const res = await ai().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.2,
    },
  });
  const text = res.text ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("Gemini returned non-JSON output");
  }
}
