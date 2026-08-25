import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import ReactMarkdown from 'react-markdown';
import { Loader2, Send, MessageSquare, Plus, ChevronLeft } from 'lucide-react';

const AGENT_NAME = 'predittivita_agent';

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {message.content ? (
          isUser ? <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                 : <div className="text-sm prose prose-sm max-w-none"><ReactMarkdown>{message.content}</ReactMarkdown></div>
        ) : (
          <span className="text-xs text-muted-foreground italic">Elaborazione…</span>
        )}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-1 space-y-1">
            {message.tool_calls.map((tc, i) => (
              <div key={i} className="text-[10px] opacity-70 flex items-center gap-1">
                <Loader2 className="w-2.5 h-2.5" /> {tc.name || 'tool'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PredittivitaAgent() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const list = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(list || []);
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Subscribe to active conversation
  useEffect(() => {
    if (!activeId) return;
    const unsubscribe = base44.agents.subscribeToConversation(activeId, (data) => {
      setMessages(data.messages || []);
      setSending(false);
    });
    return () => unsubscribe();
  }, [activeId]);

  // Load full conversation on select
  useEffect(() => {
    if (!activeId) { setActiveConv(null); setMessages([]); return; }
    (async () => {
      try {
        const conv = await base44.agents.getConversation(activeId);
        setActiveConv(conv);
        setMessages(conv.messages || []);
      } catch (e) { /* ignore */ }
    })();
  }, [activeId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const newConversation = async () => {
    try {
      const conv = await base44.agents.createConversation({ agent_name: AGENT_NAME, metadata: { name: 'Nuova analisi', description: 'Pianificazione predittiva' } });
      setConversations(prev => [conv, ...prev]);
      setActiveId(conv.id);
    } catch (e) { /* ignore */ }
  };

  const send = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      const conv = activeConv || await base44.agents.getConversation(activeId);
      await base44.agents.addMessage(conv, { role: 'user', content: text });
    } catch (e) { setSending(false); }
  };

  if (loading) {
    return <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin inline" /></div>;
  }

  // Conversation list view
  if (!activeId) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold">Assistente Predittività</h2>
          <button onClick={newConversation} className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent">
            <Plus className="w-4 h-4" /> Nuova conversazione
          </button>
        </div>
        <p className="text-sm text-muted-foreground">Interroga l'agente sullo stato di Tecnogum e Irigom, viaggi stimati della settimana, anticipo/ritardo e target raccoglitori primaria.</p>
        <div className="space-y-2">
          {conversations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Nessuna conversazione. Avviane una nuova.
            </div>
          )}
          {conversations.map(c => (
            <button key={c.id} onClick={() => setActiveId(c.id)} className="w-full text-left border rounded-lg p-3 hover:bg-accent flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{c.metadata?.name || 'Conversazione'}</p>
                <p className="text-xs text-muted-foreground">{new Date(c.created_date || c.updated_date || Date.now()).toLocaleString('it-IT')}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Chat view
  return (
    <div className="space-y-3 flex flex-col h-[70vh]">
      <div className="flex items-center gap-2 border-b pb-2">
        <button onClick={() => setActiveId(null)} className="p-1 rounded hover:bg-accent"><ChevronLeft className="w-4 h-4" /></button>
        <h2 className="font-heading font-semibold text-sm flex-1">{activeConv?.metadata?.name || 'Conversazione'}</h2>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 border rounded-lg p-3 bg-background">
        {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Scrivi un messaggio all'assistente predittività…</p>}
        {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
        {sending && <div className="flex justify-start"><div className="bg-muted rounded-lg px-3 py-2"><Loader2 className="w-4 h-4 animate-spin" /></div></div>}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Es: come andiamo questa settimana? quanti viaggi servono per Irigom?"
          className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={send} disabled={!input.trim() || sending} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50">
          <Send className="w-4 h-4" /> Invia
        </button>
      </div>
    </div>
  );
}