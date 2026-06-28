import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { Pool } from "pg";
import crypto from "crypto";
import dotenv from 'dotenv';
dotenv.config();

let dbConnectionString = process.env.DATABASE_URL;
if (dbConnectionString && dbConnectionString.startsWith('//')) {
  dbConnectionString = 'postgresql:' + dbConnectionString;
}

const pool = new Pool({
  connectionString: dbConnectionString,
  ssl: dbConnectionString ? { rejectUnauthorized: false } : undefined
});

const app = express();
app.use(express.json());

  // Endpoint to send email notifications for session events
  app.post("/api/notify-session", async (req, res) => {
    try {
      const { action, sessionData } = req.body;
      const adminEmail = process.env.ADMIN_EMAIL;
      const resendApiKey = process.env.RESEND_API_KEY;

      console.log(`[Notification] Action: ${action}`);
      console.log(`[Notification] Data:`, sessionData);

      if (!adminEmail || !resendApiKey) {
        console.log("[Notification] Simulateur: E-mail non envoyé car ADMIN_EMAIL ou RESEND_API_KEY est manquant dans .env");
        return res.json({ success: true, simulated: true, message: "E-mail simulé (clés manquantes)" });
      }

      // If we had the resend SDK installed:
      // const { Resend } = require('resend');
      // const resend = new Resend(resendApiKey);
      // await resend.emails.send({
      //   from: 'MHM E-boutique <onboarding@resend.dev>',
      //   to: adminEmail,
      //   subject: action === 'OPEN' ? 'Ouverture de Caisse' : 'Fermeture de Caisse',
      //   html: `<p>Détails de la session :</p><pre>${JSON.stringify(sessionData, null, 2)}</pre>`
      // });

      res.json({ success: true, simulated: false });
    } catch (err) {
      console.error("[Notification] Erreur:", err);
      res.status(500).json({ error: "Erreur lors de l'envoi de la notification" });
    }
  });

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
        Tu es un agent IA autonome intégré à un système de gestion de Point de Vente (MHM E-boutique).
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

  // --- Real-time Central DB Sync Endpoints ---

  // Authentication middleware to secure the database API for the external WhatsApp agent
  const authenticate = (req: any, res: any, next: any) => {
    const token = process.env.API_ACCESS_TOKEN;
    if (!token) {
      // If no token is configured, allow access (defaults to unsecured)
      return next();
    }
    
    // Check Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.split(' ')[1];
      if (bearerToken === token) {
        return next();
      }
    }
    
    // Check ?api_key=<token> or ?token=<token> query parameter
    const queryToken = req.query.api_key || req.query.token;
    if (queryToken === token) {
      return next();
    }
    
    // Allow seamless access to standard frontend/browser requests from the same origin
    const fetchSite = req.headers['sec-fetch-site'];
    const referer = req.headers['referer'];
    const host = req.headers['host'] || '';
    if (fetchSite === 'same-origin' || (referer && referer.includes(host))) {
      return next();
    }
    
    return res.status(401).json({
      error: "Accès refusé. Clé API invalide ou manquante dans l'en-tête (Authorization: Bearer <token>) ou le paramètre d'URL (?api_key=<token>)."
    });
  };

  app.use("/api/db", authenticate);

  // Check connection status
  app.get("/api/db/status", async (req, res) => {
    res.json({ configured: !!dbConnectionString });
  });

  // Get products
  app.get("/api/db/products", async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
      const products = result.rows.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        retailPrice: Number(p.retail_price),
        wholesalePrice: Number(p.wholesale_price),
        wholesaleThreshold: p.wholesale_threshold,
        unitsPerWholesale: p.units_per_wholesale || 24,
        minStockLevel: p.min_stock_level || 20,
        stock: p.stock,
        costPrice: Number(p.cost_price),
        format: p.format
      }));
      res.json(products);
    } catch (err: any) {
      console.error("GET products error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Create/Update Product
  app.post("/api/db/products", async (req, res) => {
    try {
      const p = req.body;
      const productId = p.id || crypto.randomUUID();
      await pool.query(`
        INSERT INTO products (id, name, category, retail_price, wholesale_price, wholesale_threshold, units_per_wholesale, min_stock_level, stock, cost_price, format)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          retail_price = EXCLUDED.retail_price,
          wholesale_price = EXCLUDED.wholesale_price,
          wholesale_threshold = EXCLUDED.wholesale_threshold,
          units_per_wholesale = EXCLUDED.units_per_wholesale,
          min_stock_level = EXCLUDED.min_stock_level,
          stock = EXCLUDED.stock,
          cost_price = EXCLUDED.cost_price,
          format = EXCLUDED.format
      `, [
        productId, p.name, p.category, p.retailPrice, p.wholesalePrice, p.wholesaleThreshold,
        p.unitsPerWholesale, p.minStockLevel, p.stock, p.costPrice, p.format
      ]);
      res.json({ success: true, id: productId });
    } catch (err: any) {
      console.error("POST products error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get Active Session
  app.get("/api/db/sessions/active", async (req, res) => {
    try {
      const sessionRes = await pool.query("SELECT * FROM sessions WHERE status = 'OPEN' LIMIT 1");
      if (sessionRes.rows.length === 0) {
        return res.json(null);
      }
      const s = sessionRes.rows[0];
      const expensesRes = await pool.query("SELECT * FROM expenses WHERE session_id = $1 ORDER BY timestamp ASC", [s.id]);
      res.json({
        id: s.id,
        startTime: new Date(s.start_time).getTime(),
        endTime: s.end_time ? new Date(s.end_time).getTime() : null,
        initialCash: Number(s.initial_cash),
        expectedFinalCash: s.expected_final_cash ? Number(s.expected_final_cash) : null,
        actualFinalCash: s.actual_final_cash ? Number(s.actual_final_cash) : null,
        status: s.status,
        expenses: expensesRes.rows.map(e => ({
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          timestamp: new Date(e.timestamp).getTime()
        }))
      });
    } catch (err: any) {
      console.error("GET active session error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get All Sessions
  app.get("/api/db/sessions", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT s.*, 
               COALESCE(
                 (SELECT json_agg(e.* ORDER BY e.timestamp ASC) FROM expenses e WHERE e.session_id = s.id), 
                 '[]'::json
               ) as expenses
        FROM sessions s
        ORDER BY s.start_time DESC
      `);
      res.json(result.rows.map(s => ({
        id: s.id,
        startTime: new Date(s.start_time).getTime(),
        endTime: s.end_time ? new Date(s.end_time).getTime() : null,
        initialCash: Number(s.initial_cash),
        expectedFinalCash: s.expected_final_cash ? Number(s.expected_final_cash) : null,
        actualFinalCash: s.actual_final_cash ? Number(s.actual_final_cash) : null,
        status: s.status,
        expenses: (s.expenses || []).map((e: any) => ({
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          timestamp: new Date(e.timestamp).getTime()
        }))
      })));
    } catch (err: any) {
      console.error("GET sessions error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update Session Generic
  app.post("/api/db/sessions/update", async (req, res) => {
    try {
      const session = req.body;
      await pool.query(`
        UPDATE sessions SET
          start_time = $2,
          end_time = $3,
          initial_cash = $4,
          expected_final_cash = $5,
          actual_final_cash = $6,
          status = $7
        WHERE id = $1
      `, [
        session.id, 
        new Date(session.startTime).toISOString(), 
        session.endTime ? new Date(session.endTime).toISOString() : null,
        session.initialCash,
        session.expectedFinalCash,
        session.actualFinalCash,
        session.status
      ]);
      res.json({ success: true });
    } catch (err: any) {
      console.error("POST session update error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Open Session
  app.post("/api/db/sessions/open", async (req, res) => {
    try {
      const { initialCash, id } = req.body;
      const sessionId = id || crypto.randomUUID();
      const result = await pool.query(`
        INSERT INTO sessions (id, start_time, initial_cash, status)
        VALUES ($1, NOW(), $2, 'OPEN')
        RETURNING *
      `, [sessionId, initialCash]);
      const s = result.rows[0];
      res.json({
        id: s.id,
        startTime: new Date(s.start_time).getTime(),
        endTime: null,
        initialCash: Number(s.initial_cash),
        expectedFinalCash: null,
        actualFinalCash: null,
        status: s.status,
        expenses: []
      });
    } catch (err: any) {
      console.error("POST open session error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Close Session
  app.post("/api/db/sessions/close", async (req, res) => {
    try {
      const { id, actualFinalCash } = req.body;
      const sessionRes = await pool.query("SELECT * FROM sessions WHERE id = $1", [id]);
      if (sessionRes.rows.length === 0) {
        return res.status(404).json({ error: "Session non trouvée" });
      }
      const session = sessionRes.rows[0];
      const txsRes = await pool.query("SELECT total_amount FROM transactions WHERE session_id = $1", [id]);
      const totalSales = txsRes.rows.reduce((sum, r) => sum + Number(r.total_amount), 0);
      const expensesRes = await pool.query("SELECT amount FROM expenses WHERE session_id = $1", [id]);
      const totalExpenses = expensesRes.rows.reduce((sum, r) => sum + Number(r.amount), 0);
      const expectedFinalCash = Number(session.initial_cash) + totalSales - totalExpenses;
      const updateRes = await pool.query(`
        UPDATE sessions SET
          end_time = NOW(),
          expected_final_cash = $2,
          actual_final_cash = $3,
          status = 'CLOSED'
        WHERE id = $1
        RETURNING *
      `, [id, expectedFinalCash, actualFinalCash]);
      const s = updateRes.rows[0];
      res.json({
        id: s.id,
        startTime: new Date(s.start_time).getTime(),
        endTime: new Date(s.end_time).getTime(),
        initialCash: Number(s.initial_cash),
        expectedFinalCash: Number(s.expected_final_cash),
        actualFinalCash: Number(s.actual_final_cash),
        status: s.status,
        expenses: expensesRes.rows.map(e => ({
          id: e.id,
          description: e.description,
          amount: Number(e.amount),
          timestamp: new Date(e.timestamp).getTime()
        }))
      });
    } catch (err: any) {
      console.error("POST close session error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Add Expense
  app.post("/api/db/sessions/expenses", async (req, res) => {
    try {
      const { sessionId, description, amount, id } = req.body;
      const expenseId = id || crypto.randomUUID();
      await pool.query(`
        INSERT INTO expenses (id, session_id, description, amount, timestamp)
        VALUES ($1, $2, $3, $4, NOW())
      `, [expenseId, sessionId, description, amount]);
      res.json({ success: true, id: expenseId });
    } catch (err: any) {
      console.error("POST expense error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Save Transaction
  app.post("/api/db/transactions", async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tx = req.body;
      const txId = tx.id || crypto.randomUUID();
      await client.query(`
        INSERT INTO transactions (id, session_id, timestamp, total_amount, total_profit, amount_tendered, "change", payment_method)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'CASH')
      `, [
        txId, tx.sessionId, new Date(tx.timestamp).toISOString(), tx.totalAmount, tx.totalProfit, tx.amountTendered, tx.change
      ]);
      for (const item of tx.items) {
        const itemId = crypto.randomUUID();
        await client.query(`
          INSERT INTO transaction_items (id, transaction_id, product_id, name, quantity, unit_price, total_price, cost_price, is_wholesale, units_per_wholesale)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          itemId, txId, item.productId, item.name, item.quantity, item.unitPrice, item.totalPrice, item.costPrice, item.isWholesale, item.unitsPerWholesale
        ]);
        const unitsToDeduct = item.isWholesale ? (item.quantity * (item.unitsPerWholesale || 24)) : item.quantity;
        await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [unitsToDeduct, item.productId]);
      }
      await client.query('COMMIT');
      res.json({ success: true, id: txId });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error("POST transaction error:", err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  // Get All Transactions
  app.get("/api/db/transactions", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT t.*,
               COALESCE(
                 (SELECT json_agg(ti.*) FROM transaction_items ti WHERE ti.transaction_id = t.id),
                 '[]'::json
               ) as items
        FROM transactions t
        ORDER BY t.timestamp DESC
      `);
      res.json(result.rows.map(t => ({
        id: t.id,
        sessionId: t.session_id,
        timestamp: new Date(t.timestamp).getTime(),
        totalAmount: Number(t.total_amount),
        totalProfit: Number(t.total_profit),
        amountTendered: Number(t.amount_tendered),
        change: Number(t.change),
        items: (t.items || []).map((i: any) => ({
          productId: i.product_id,
          name: i.name,
          quantity: i.quantity,
          unitPrice: Number(i.unit_price),
          totalPrice: Number(i.total_price),
          costPrice: Number(i.cost_price),
          isWholesale: i.is_wholesale,
          unitsPerWholesale: i.units_per_wholesale
        }))
      })));
    } catch (err: any) {
      console.error("GET transactions error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Save Credit
  app.post("/api/db/credits", async (req, res) => {
    try {
      const c = req.body;
      const creditId = c.id || crypto.randomUUID();
      await pool.query(`
        INSERT INTO credits (id, client_name, total_amount, paid_amount, remaining_amount, timestamp, due_date, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          client_name = EXCLUDED.client_name,
          total_amount = EXCLUDED.total_amount,
          paid_amount = EXCLUDED.paid_amount,
          remaining_amount = EXCLUDED.remaining_amount,
          due_date = EXCLUDED.due_date,
          status = EXCLUDED.status
      `, [
        creditId, c.clientName, c.totalAmount, c.paidAmount, c.remainingAmount, 
        new Date(c.timestamp).toISOString(), c.dueDate ? new Date(c.dueDate).toISOString() : null, c.status
      ]);
      res.json({ success: true, id: creditId });
    } catch (err: any) {
      console.error("POST credits error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get Credits
  app.get("/api/db/credits", async (req, res) => {
    try {
      const result = await pool.query('SELECT * FROM credits ORDER BY timestamp DESC');
      res.json(result.rows.map(c => ({
        id: c.id,
        clientName: c.client_name,
        totalAmount: Number(c.total_amount),
        paidAmount: Number(c.paid_amount),
        remainingAmount: Number(c.remaining_amount),
        timestamp: new Date(c.timestamp).getTime(),
        dueDate: c.due_date ? new Date(c.due_date).getTime() : undefined,
        status: c.status
      })));
    } catch (err: any) {
      console.error("GET credits error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Pay Credit
  app.post("/api/db/credits/pay", async (req, res) => {
    try {
      const { creditId, additionalPayment } = req.body;
      const creditRes = await pool.query('SELECT * FROM credits WHERE id = $1', [creditId]);
      if (creditRes.rows.length === 0) {
        return res.status(404).json({ error: "Crédit non trouvé" });
      }
      const credit = creditRes.rows[0];
      const paidAmount = Number(credit.paid_amount) + additionalPayment;
      const remainingAmount = Number(credit.total_amount) - paidAmount;
      const status = remainingAmount <= 0 ? 'PAID' : 'PENDING';
      
      await pool.query(`
        UPDATE credits SET
          paid_amount = $2,
          remaining_amount = $3,
          status = $4
        WHERE id = $1
      `, [creditId, paidAmount, Math.max(0, remainingAmount), status]);
      res.json({ success: true });
    } catch (err: any) {
      console.error("POST credit pay error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  async function init() {
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

    if (!process.env.VERCEL) {
      const PORT = 3000;
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  }

  init();

  export default app;
