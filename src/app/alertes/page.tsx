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
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const [showSOSModal, setShowSOSModal] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (fetchError) throw fetchError;
      setNotifications(data ?? []);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Impossible de charger les notifications.');
    } finally { setLoading(false);
    }
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
            <div className="max-w-7xl mx-auto px-4 py-8">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {error && (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">⚠️</p>
                  <p className="text-muted-foreground text-sm mb-4">{error}</p>
                  <button onClick={() => loadNotifications()} className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-600 hover:opacity-90 transition-opacity cursor-pointer">Réessayer</button>
                </div>
              )}
              {!loading && !error && !user && (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">🔔</p>
                  <p className="text-muted-foreground text-sm">Connectez-vous pour voir vos alertes.</p>
                </div>
              )}
              {!loading && !error && user && (
                <div>
                  <p className="text-sm text-muted-foreground mb-4">{notifications.length} notification(s)</p>
                  {notifications.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-4xl mb-3">✅</p>
                      <p className="text-sm">Aucune notification pour le moment.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((n: any) => (
                        <div key={n.id} className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Icon name="BellIcon" size={14} className="text-primary" />
                          </div>
                          <div>
                            <p className="text-sm text-foreground">{n.message || n.content || n.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString('fr-FR')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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
            {activeTab === 'notifications' && (
              loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid rgba(23,64,44,0.15)', borderTopColor: '#17402C', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : error ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</p>
                  <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.5)', marginBottom: '16px' }}>{error}</p>
                  <button onClick={() => loadNotifications()} style={{ padding: '10px 20px', background: '#17402C', color: '#fff', borderRadius: '10px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Réessayer</button>
                </div>
              ) : !user ? (
                <p style={{ color: 'rgba(28,38,32,0.5)', textAlign: 'center', padding: '40px 0' }}>Connectez-vous pour voir vos alertes.</p>
              ) : notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <p style={{ fontSize: '28px', marginBottom: '8px' }}>✅</p>
                  <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.5)' }}>Aucune notification</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.map((n: any) => (
                    <div key={n.id} style={{ background: '#FBFAF6', borderRadius: '12px', border: '1px solid rgba(11,31,23,0.06)', padding: '12px' }}>
                      <p style={{ fontSize: '13px', color: '#1C2620', margin: '0 0 4px 0' }}>{n.message || n.content || n.title}</p>
                      <p style={{ fontSize: '10px', color: 'rgba(28,38,32,0.4)', margin: 0 }}>{new Date(n.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                  ))}
                </div>
              )
            )}
            {activeTab === 'weather' && <p style={{ color: 'rgba(28,38,32,0.5)' }}>Météo à venir.</p>}
          </div>
        </MobilePageShell>
        
      </div>
    </>
  );
}
