'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';

import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import MobilePageShell from '@/components/mobile-nav/MobilePageShell';

export default function AlertesPage() {
  const [activeTab, setActiveTab] = useState<'notifications' | 'weather' | 'settings'>('notifications');
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const [showSOSModal, setShowSOSModal] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setNotifications(data ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [user, supabase]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-background">
          <Header />
          <main className="pt-20">
            <section className="bg-dark-bg text-white py-10 px-4">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center"><Icon name="BellIcon" size={22} variant="outline" className="text-primary" /></div><div><p className="text-xs font-mono text-primary/80 tracking-widest uppercase">Alertes & Météo</p><h1 className="text-2xl font-display font-800 tracking-tight">Alertes en Temps Réel</h1></div></div>
              </div>
            </section>
          </main>
          <Footer />
        </div>
      </div>

      {/* MOBILE */}
      <div className="block md:hidden">
        <MobilePageShell>
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '12px' }}>Alertes</h1>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button onClick={() => setActiveTab('notifications')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'notifications' ? '#17402C' : '#F4F1EA', color: activeTab === 'notifications' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Notifications</button>
              <button onClick={() => setActiveTab('weather')} style={{ padding: '8px 14px', borderRadius: '8px', background: activeTab === 'weather' ? '#17402C' : '#F4F1EA', color: activeTab === 'weather' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '12px', cursor: 'pointer' }}>Météo</button>
            </div>
            {activeTab === 'notifications' && (!user ? <p style={{ color: 'rgba(28,38,32,0.5)', textAlign: 'center' }}>Connectez-vous pour voir vos alertes.</p> : <p style={{ color: 'rgba(28,38,32,0.5)' }}>{notifications.length} notification(s)</p>)}
            {activeTab === 'weather' && <p style={{ color: 'rgba(28,38,32,0.5)' }}>Météo à venir.</p>}
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
