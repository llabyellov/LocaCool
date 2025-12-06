import { GoogleGenAI, Type } from "@google/genai";
import { Transaction } from '../types';

const apiKey = process.env.API_KEY || '';

// Initialize the client strictly as per guidelines
// Note: In a real production app, we would handle the missing key more gracefully in the UI.
const ai = new GoogleGenAI({ apiKey });

export const analyzeFinancials = async (transactions: Transaction[]): Promise<{ title: string; content: string } | null> => {
  if (!apiKey) {
    console.warn("API Key is missing for Gemini Service");
    return {
      title: "Clé API manquante",
      content: "Veuillez configurer votre clé API pour obtenir des analyses intelligentes."
    };
  }

  if (transactions.length === 0) {
    return {
      title: "Pas assez de données",
      content: "Ajoutez des transactions pour que je puisse analyser vos performances financières."
    };
  }

  // Prepare data for the model - keep it concise to save tokens
  const dataSummary = JSON.stringify(transactions.map(t => ({
    d: t.date,
    a: t.amount,
    c: t.category,
    t: t.type,
    desc: t.description
  })));

  const prompt = `
    Tu es un expert en gestion financière pour locations saisonnières (Airbnb, gîtes).
    Voici les transactions récentes (format JSON simplifié):
    ${dataSummary}

    Analyse ces données et fournis une réponse structurée en français.
    Concentre-toi sur :
    1. La santé financière actuelle (Cash flow).
    2. Les postes de dépenses les plus lourds.
    3. Des conseils concrets pour optimiser la rentabilité.

    Reste concis, professionnel et encourageant.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            content: { type: Type.STRING },
          },
          required: ["title", "content"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    
    return JSON.parse(text);

  } catch (error) {
    console.error("Error calling Gemini:", error);
    return {
      title: "Erreur d'analyse",
      content: "Je n'ai pas pu analyser vos données pour le moment. Veuillez réessayer plus tard."
    };
  }
};
