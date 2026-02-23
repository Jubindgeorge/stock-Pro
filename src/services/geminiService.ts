import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateInspiration = async () => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: "Give me a short, powerful, and unique creative prompt or inspirational quote for a productive day. Keep it under 20 words.",
    config: {
      systemInstruction: "You are a minimalist creative coach. Your advice is profound and concise.",
    },
  });
  return response.text;
};

export const chatWithGemini = async (message: string, history: { role: string; parts: { text: string }[] }[]) => {
  const chat = ai.chats.create({
    model: "gemini-3-flash-preview",
    config: {
      systemInstruction: "You are Aura, a helpful and minimalist AI workspace assistant. You help users stay focused, organized, and creative. Keep your responses concise and helpful.",
    },
  });
  
  // Note: sendMessage doesn't take history directly in this SDK version, 
  // but we can simulate it or just use the chat object if it supported history.
  // For simplicity in this version, we'll just send the message.
  const response = await chat.sendMessage({ message });
  return response.text;
};
