'use client';

import React, { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useChat } from '@/lib/hooks/useChat';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function CopilotePage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: 'Bonjour ! Je suis votre copilote d\'expédition IA. Comment puis-je vous aider ?' },
  ]);
  const [activeTab, setActiveTab] = useState<'chat' | 'plan' | 'suggestions'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { response, isLoading, sendMessage } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, response]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    const newMessages = [...messages, { role: 'user' as const, content: msg }];
    setMessages(newMessages);
    const systemPrompt = 'Tu es un copilote d\'expédition expert pour Kit du Voyageur. Réponds en français.';
    await sendMessage([{ role: 'system', content: systemPrompt }, ...newMessages.map(m => ({ role: m.role, content: m.content }))], { max_tokens: 600 });
  };

  useEffect(() => {
    if (response && !isLoading) {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.content === response) return prev;
        return [...prev, { role: 'assistant', content: response }];
      });
    }
  }, [response, isLoading]);

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background text-foreground">
          <Header />
          <section className="pt-20 bg-dark-bg">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
              <h1 className="font-display font-800 text-4xl md:text-5xl text-white tracking-tight mb-3">Votre assistant<br />d&apos;expédition intelligent</h1>
            </div>
          </section>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '8px' }}>Copilote IA</h1>
            <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.6)', marginBottom: '16px' }}>Assistant d&apos;expédition intelligent.</p>
            <div style={{ background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)', marginBottom: '12px', padding: '16px', minHeight: '200px' }}>
              {messages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: msg.role === 'assistant' ? '#17402C' : '#5C8A3A', color: 'white', fontSize: '10px', fontWeight: 700 }}>{msg.role === 'assistant' ? 'IA' : 'M'}</div>
                  <div style={{ background: msg.role === 'assistant' ? '#F4F1EA' : '#17402C', color: msg.role === 'assistant' ? '#1C2620' : 'white', padding: '8px 12px', borderRadius: '12px', fontSize: '13px', maxWidth: '80%' }}>{msg.content}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Posez votre question..." style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(11,31,23,0.06)', fontSize: '13px' }} />
              <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} style={{ padding: '10px 16px', borderRadius: '10px', background: '#17402C', color: 'white', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', opacity: isLoading || !input.trim() ? 0.6 : 1 }}>Envoyer</button>
            </div>
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}