'use client';

import React, { useState, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import { useChat } from '@/lib/hooks/useChat';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import { Button, Card } from '@/components/ui';
import { useActiveTrip } from '@/features/trips/context/ActiveTripContext';

export default function CopilotePage() {
  const { activeTrip } = useActiveTrip();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    {
      role: 'assistant',
      content: activeTrip
        ? `Bonjour ! Je suis votre copilote IA pour votre expédition « ${activeTrip.title} ». Comment puis-je vous guider ?`
        : "Bonjour ! Je suis votre copilote d'expédition IA. Comment puis-je vous aider ?",
    },
  ]);
  const [activeTab, setActiveTab] = useState<'chat' | 'plan' | 'suggestions'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { response, isLoading, sendMessage } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, response]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput('');
    const newMessages: { role: 'user' | 'assistant'; content: string }[] = [...messages, { role: 'user', content: msg }];
    setMessages(newMessages);
    const tripContext = activeTrip ? ` Le voyageur prépare l'expédition : "${activeTrip.title}".` : '';
    const systemPrompt = `Tu es un copilote d'expédition expert pour Kit du Voyageur.${tripContext} Garde-fous : pas de conseil médical ou de sécurité en montagne présenté comme certain, renvoi vers les sources officielles et le 112 en cas de danger. Réponds en français.`;
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
          <div className="p-[var(--space-4)]">
            <h1 className="mb-[var(--space-2)] text-[length:var(--lkv-text-title-sm)] font-extrabold text-[color:var(--lkv-primary)]">Copilote IA</h1>
            <p className="mb-[var(--space-4)] text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-muted)]">Assistant d&apos;expédition intelligent.</p>
            <Card variant="standard" className="mb-[var(--space-3)] min-h-[200px] p-[var(--space-4)]" aria-live="polite">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`mb-[10px] flex gap-[var(--space-2)] ${
                    msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  <div
                    aria-hidden="true"
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-[color:var(--lkv-text-primary)] ${
                      msg.role === 'assistant'
                        ? 'bg-[color:var(--btn-tint)] border border-[color:var(--btn-glass-border)] backdrop-blur-[var(--btn-blur)] saturate-[var(--btn-saturate)] lkv-rim-btn'
                        : 'bg-[color:var(--lkv-secondary)]'
                    }`}
                  >
                    {msg.role === 'assistant' ? 'IA' : 'M'}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-[var(--lkv-radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--lkv-text-caption-1)] ${
                      msg.role === 'assistant'
                        ? 'bg-[color:var(--glass-bg-medium)] border border-[color:var(--glass-border)] backdrop-blur-[var(--glass-blur-sm)] saturate-[var(--glass-sat)] lkv-rim-inset text-[color:var(--lkv-primary)]'
                        : 'bg-[color:var(--btn-tint)]  text-[color:var(--lkv-text-primary)]'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </Card>
            <div className="flex gap-[var(--space-2)]">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Posez votre question..."
                aria-label="Votre question au copilote"
                className="min-h-[var(--lkv-touch-min)] flex-1 rounded-[var(--lkv-radius-sm)] border border-[color:var(--lkv-field-border)] bg-[color:var(--lkv-field-bg)] px-[14px] py-2.5 text-[length:var(--lkv-text-caption-1)] text-[color:var(--lkv-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--lkv-focus-ring)]"
              />
              <Button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                loading={isLoading}
                className="shrink-0"
              >
                Envoyer
              </Button>
            </div>
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}