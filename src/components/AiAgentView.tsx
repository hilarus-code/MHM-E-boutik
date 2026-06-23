import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, Loader2, Database, Settings, X, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { db } from '../lib/db';
import { formatCurrency } from '../lib/utils';
import Markdown from 'react-markdown';

export default function AiAgentView() {
  const { products, activeSession, cart, refreshProducts } = useApp();
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([
    { role: 'ai', content: 'Bonjour ! Je suis votre agent IA OmniPOS. Comment puis-je vous aider aujourd\'hui ? Je peux analyser vos ventes, vous aider avec l\'inventaire, ou mettre à jour les règles de calcul.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [aiConfig, setAiConfig] = useState({
    provider: localStorage.getItem('ai_provider') || 'gemini',
    apiKey: localStorage.getItem('ai_apiKey') || '',
    baseUrl: localStorage.getItem('ai_baseUrl') || '',
    model: localStorage.getItem('ai_model') || 'gemini-3.5-flash',
  });
  const [availableModels, setAvailableModels] = useState<{id: string, name: string}[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Save to localStorage whenever config changes
    localStorage.setItem('ai_provider', aiConfig.provider);
    localStorage.setItem('ai_apiKey', aiConfig.apiKey);
    localStorage.setItem('ai_baseUrl', aiConfig.baseUrl);
    localStorage.setItem('ai_model', aiConfig.model);
  }, [aiConfig]);

  const fetchModels = async () => {
    if (!aiConfig.apiKey && aiConfig.provider !== 'gemini') return;
    setIsFetchingModels(true);
    try {
      const response = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig)
      });
      if (response.ok) {
        const data = await response.json();
        setAvailableModels(data.models || []);
        if (data.models && data.models.length > 0 && !data.models.find((m: any) => m.id === aiConfig.model)) {
          setAiConfig(prev => ({ ...prev, model: data.models[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingModels(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [aiConfig.provider, aiConfig.apiKey, aiConfig.baseUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Fetch context data
      const stats = {
        productsCount: products.length,
        lowStock: products.filter(p => p.stock <= (p.minStockLevel || 20)).length,
        activeSession: activeSession ? {
          initialCash: activeSession.initialCash,
          status: 'Open'
        } : 'Closed'
      };

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessage,
          context: stats,
          aiConfig: aiConfig
        })
      });

      if (!response.ok) throw new Error('Erreur de communication avec l\'IA');

      const data = await response.json();
      
      let aiMessage = data.text || '';
      
      if (data.functionCalls && data.functionCalls.length > 0) {
        for (const call of data.functionCalls) {
          if (call.name === 'updateProduct') {
            const args = call.args as any;
            const product = products.find(p => p.id === args.id || p.name.toLowerCase().includes(args.id?.toLowerCase()));
            if (product) {
              const updatedProduct = { ...product };
              if (args.retailPrice !== undefined) updatedProduct.retailPrice = args.retailPrice;
              if (args.wholesalePrice !== undefined) updatedProduct.wholesalePrice = args.wholesalePrice;
              if (args.unitsPerWholesale !== undefined) updatedProduct.unitsPerWholesale = args.unitsPerWholesale;
              if (args.minStockLevel !== undefined) updatedProduct.minStockLevel = args.minStockLevel;
              if (args.wholesaleThreshold !== undefined) updatedProduct.wholesaleThreshold = args.wholesaleThreshold;
              if (args.costPrice !== undefined) updatedProduct.costPrice = args.costPrice;
              
              await db.updateProduct(updatedProduct);
              aiMessage += `\n\n✅ Produit mis à jour : **${product.name}**`;
            } else {
               aiMessage += `\n\n❌ Produit non trouvé pour la mise à jour (ID: ${args.id})`;
            }
          } else if (call.name === 'createProduct') {
             const args = call.args as any;
             await db.updateProduct({
               id: crypto.randomUUID(),
               name: args.name,
               category: args.category || 'Toutes',
               retailPrice: args.retailPrice,
               wholesalePrice: args.wholesalePrice,
               wholesaleThreshold: args.wholesaleThreshold || args.unitsPerWholesale || 24,
               unitsPerWholesale: args.unitsPerWholesale || 24,
               minStockLevel: args.minStockLevel || 20,
               stock: args.stock || 0,
               costPrice: args.costPrice || 0,
               format: args.format || ''
             });
             aiMessage += `\n\n✅ Nouveau produit créé : **${args.name}**`;
          }
        }
        
        // Rafraîchir les produits
        refreshProducts();
      }

      setMessages(prev => [...prev, { role: 'ai', content: aiMessage }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'ai', content: `Désolé, une erreur s'est produite: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="p-4 md:p-6 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between z-10">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center mr-4">
            <Sparkles className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Agent IA OmniPOS</h2>
            <p className="text-sm text-slate-500 font-medium hidden md:block">Assistant Autonome & Analyse</p>
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
          title="Paramètres de l'IA"
        >
          <Settings className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex max-w-[90%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-amber-100 ml-3 md:ml-4' : 'bg-indigo-100 mr-3 md:mr-4'}`}>
                {msg.role === 'user' ? <User className="w-4 h-4 md:w-5 md:h-5 text-amber-700" /> : <Bot className="w-4 h-4 md:w-5 md:h-5 text-indigo-700" />}
              </div>
              <div className={`px-4 py-3 md:px-5 md:py-4 rounded-2xl ${
                msg.role === 'user' 
                  ? 'bg-slate-900 text-white rounded-tr-sm' 
                  : 'bg-white border border-slate-200 shadow-sm text-slate-800 rounded-tl-sm'
              }`}>
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm md:text-base">{msg.content}</p>
                ) : (
                  <div className="markdown-body text-sm prose prose-slate">
                    <Markdown>{msg.content}</Markdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex max-w-[80%] flex-row">
              <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-indigo-100 mr-3 md:mr-4 flex items-center justify-center">
                <Bot className="w-4 h-4 md:w-5 md:h-5 text-indigo-700" />
              </div>
              <div className="px-5 py-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-slate-800 rounded-tl-sm flex items-center">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600 mr-2" />
                <span className="text-sm font-medium text-slate-500">L'IA réfléchit...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 md:p-6 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="flex space-x-2 md:space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez une question..."
              className="w-full pl-4 md:pl-6 pr-4 py-3 md:py-4 bg-slate-100 border-transparent rounded-2xl text-slate-900 focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all outline-none font-medium text-sm md:text-base"
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className={`px-4 md:px-8 py-3 md:py-4 rounded-2xl font-bold text-white flex items-center justify-center transition-all ${
              !input.trim() || isLoading
                ? 'bg-slate-300 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-1'
            }`}
          >
            <Send className="w-5 h-5 md:mr-2" />
            <span className="hidden md:inline">Envoyer</span>
          </button>
        </form>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-indigo-600" />
                Configuration de l'IA
              </h2>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 bg-white p-2 rounded-lg shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Fournisseur</label>
                <select 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={aiConfig.provider}
                  onChange={e => setAiConfig({...aiConfig, provider: e.target.value})}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="custom">Fournisseur Custom (OpenAI-compatible)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Clé API
                </label>
                <input 
                  type="password" 
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="sk-..."
                  value={aiConfig.apiKey}
                  onChange={e => setAiConfig({...aiConfig, apiKey: e.target.value})}
                />
                <div className="mt-2 text-xs font-medium flex gap-4">
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 flex items-center hover:underline">
                    Obtenir clé Gemini <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-emerald-600 flex items-center hover:underline">
                    Obtenir clé OpenAI <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                  <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-orange-600 flex items-center hover:underline">
                    Obtenir clé Groq <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </div>

              {aiConfig.provider === 'custom' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Base URL</label>
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="ex: https://api.groq.com/openai/v1"
                    value={aiConfig.baseUrl}
                    onChange={e => setAiConfig({...aiConfig, baseUrl: e.target.value})}
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center justify-between">
                  Modèle
                  {isFetchingModels && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                </label>
                {availableModels.length > 0 ? (
                  <select 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={aiConfig.model}
                    onChange={e => setAiConfig({...aiConfig, model: e.target.value})}
                  >
                    {availableModels.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Nom du modèle (ex: gemini-3.5-flash)"
                    value={aiConfig.model}
                    onChange={e => setAiConfig({...aiConfig, model: e.target.value})}
                  />
                )}
                <p className="text-xs text-slate-500 mt-2 font-medium">
                  Le modèle sera automatiquement mis à jour selon la clé API fournie.
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button 
                onClick={() => setShowSettings(false)}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
              >
                Enregistrer & Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
