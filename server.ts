import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from 'dotenv';
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Endpoint to list available models for a given API key and provider
  app.post("/api/ai/models", async (req, res) => {
    try {
      const { provider, apiKey, baseUrl } = req.body;
      let models = [];

      if (!apiKey && provider !== 'gemini') {
        return res.json({ models: [] });
      }

      if (provider === 'gemini') {
        const ai = new GoogleGenAI({
          apiKey: apiKey || process.env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        // Simplification: returns common models since the SDK doesn't always expose models.list cleanly
        models = [
          { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
          { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
          { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' }
        ];
      } else if (provider === 'openai' || provider === 'custom') {
        const fetchUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/models` : 'https://api.openai.com/v1/models';
        const response = await fetch(fetchUrl, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.data && Array.isArray(data.data)) {
            models = data.data.map((m: any) => ({ id: m.id, name: m.id }));
          }
        }
      }

      res.json({ models });
    } catch (error: any) {
      console.error("Erreur lors de la récupération des modèles:", error);
      res.status(500).json({ error: error.message || "Failed to fetch models" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { prompt, context, functionResponses, aiConfig } = req.body;
      
      const systemInstruction = `
        Tu es un agent IA autonome intégré à un système de gestion de Point de Vente (OmniPOS).
        Tu peux lire les données, suggérer des créations, des mises à jour, et aider l'utilisateur à comprendre et modifier les règles de calcul (ex: seuil de gros, quantité par carton, seuil d'alerte).
        Tu as accès à des outils pour interagir directement avec la base de données de l'application (qui s'exécute côté client).
        
        Si l'utilisateur te demande de créer ou de modifier un produit, utilise les outils à ta disposition.
        Si l'utilisateur veut ajuster les règles de calcul (par exemple, "pour les bières, le carton passe de 24 à 12 unités", ou "ajuste la marge sur les boissons"), utilise l'outil \`updateProduct\` pour appliquer ces modifications.
        
        Contexte actuel de l'application :
        ${JSON.stringify(context, null, 2)}
      `;

      const createProductFunction = {
        name: "createProduct",
        description: "Crée un nouveau produit dans l'inventaire.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Nom du produit" },
            category: { type: Type.STRING, description: "Catégorie du produit" },
            retailPrice: { type: Type.NUMBER, description: "Prix de détail" },
            wholesalePrice: { type: Type.NUMBER, description: "Prix de gros" },
            wholesaleThreshold: { type: Type.NUMBER, description: "Quantité minimale pour prix de gros" },
            unitsPerWholesale: { type: Type.NUMBER, description: "Nombre d'unités par carton" },
            minStockLevel: { type: Type.NUMBER, description: "Seuil d'alerte de stock minimal" },
            costPrice: { type: Type.NUMBER, description: "Prix d'achat" },
            stock: { type: Type.NUMBER, description: "Stock initial" },
            format: { type: Type.STRING, description: "Format du produit (ex: 33cl, 50cl)" }
          },
          required: ["name", "category", "retailPrice", "wholesalePrice", "costPrice", "stock"]
        }
      };

      const updateProductFunction = {
        name: "updateProduct",
        description: "Met à jour un produit existant dans l'inventaire (notamment pour modifier les règles de calcul).",
        parameters: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING, description: "ID du produit à modifier" },
            retailPrice: { type: Type.NUMBER, description: "Nouveau prix de détail (optionnel)" },
            wholesalePrice: { type: Type.NUMBER, description: "Nouveau prix de gros (optionnel)" },
            unitsPerWholesale: { type: Type.NUMBER, description: "Nouveau nombre d'unités par carton (optionnel)" },
            minStockLevel: { type: Type.NUMBER, description: "Nouveau seuil d'alerte de stock (optionnel)" },
            wholesaleThreshold: { type: Type.NUMBER, description: "Nouvelle quantité minimale pour gros (optionnel)" },
            costPrice: { type: Type.NUMBER, description: "Nouveau prix d'achat (optionnel)" }
          },
          required: ["id"]
        }
      };

      const provider = aiConfig?.provider || 'gemini';
      const apiKey = aiConfig?.apiKey || process.env.GEMINI_API_KEY;
      const modelName = aiConfig?.model || "gemini-3.5-flash";

      if (provider === 'gemini') {
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const contents = [];
        if (prompt) contents.push(prompt);
        if (functionResponses) contents.push(functionResponses);

        const response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
          config: {
            systemInstruction: systemInstruction,
            tools: [{ functionDeclarations: [createProductFunction, updateProductFunction] }]
          }
        });

        if (response.functionCalls && response.functionCalls.length > 0) {
          res.json({ functionCalls: response.functionCalls, text: response.text });
          return;
        }

        res.json({ text: response.text });
      } else {
        // OpenAI format fallback for OpenAI, Groq, custom...
        const baseUrl = aiConfig?.baseUrl || 'https://api.openai.com/v1';
        
        // Convert schema to OpenAI format
        const tools = [
          { type: 'function', function: createProductFunction },
          { type: 'function', function: updateProductFunction }
        ];

        const payload = {
          model: modelName,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: prompt || (functionResponses ? JSON.stringify(functionResponses) : "") }
          ],
          tools: tools,
          tool_choice: "auto"
        };

        const fetchResponse = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!fetchResponse.ok) {
          const errText = await fetchResponse.text();
          throw new Error(`Erreur API Externe: ${fetchResponse.status} ${errText}`);
        }

        const data = await fetchResponse.json();
        const message = data.choices[0].message;

        if (message.tool_calls && message.tool_calls.length > 0) {
          const functionCalls = message.tool_calls.map((tc: any) => ({
            name: tc.function.name,
            args: JSON.parse(tc.function.arguments)
          }));
          res.json({ functionCalls, text: message.content || "Exécution des outils..." });
          return;
        }

        res.json({ text: message.content });
      }
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message || "Failed to generate AI response" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
