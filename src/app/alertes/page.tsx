'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MobilePageShell from '@/components/mobile-nav/MobilePageShell';
import toast from 'react-hot-toast';

const NOTIFICATION_TYPES = [
  { id: 'group_message', label: 'Messages de groupe', description: 'Nouveaux messages dans vos fils de discussions' },
  { id: 'group_invite', label: 'Invitations de groupe', description: 'Invitations à collaborer ou rejoindre un voyage' },
  { id: 'group_task_assigned', label: 'Tâches assignées', description: 'Une tâche vous a été assignée par un organisateur' },
  { id: 'group_expense_added', label: 'Dépenses partagées', description: 'Nouvelle dépense ajoutée impliquant votre part' },
  { id: 'post_liked', label: 'Likes sur posts', description: 'Mentions j\'aime sur vos publications communautaires' },
  { id: 'post_commented', label: 'Commentaires sur posts', description: 'Commentaires reçus sur vos posts communautaires' },
  { id: 'carnet_liked', label: 'Likes sur carnets', description: 'Mentions j\'aime sur vos carnets de route' },
  { id: 'carnet_commented', label: 'Commentaires sur carnets', description: 'Commentaires reçus sur vos récits de voyage' },
  { id: 'new_follower', label: 'Nouveaux abonnés', description: 'Lorsqu\'un voyageur commence à vous suivre' },
];

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function AlertesPage() {
  const [activeTab, setActiveTab] = useState<'notifications' | 'weather' | 'settings'>('notifications');
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  // Preferences & Push states
  const [prefs, setPrefs] = useState<any[]>([]);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [registeringPush, setRegisteringPush] = useState(false);
  const [sosSending, setSosSending] = useState(false);

  // Load user notifications
  const loadNotifications = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setNotifications(data ?? []);
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Impossible de charger les notifications.');
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  // Load user notification preferences
  const loadPrefs = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      const merged = NOTIFICATION_TYPES.map(t => {
        const match = (data || []).find((d: any) => d.notification_type === t.id);
        return {
          type: t.id,
          label: t.label,
          description: t.description,
          in_app_enabled: match ? match.in_app_enabled : true,
          email_enabled: match ? match.email_enabled : true,
          push_enabled: match ? match.push_enabled : true,
        };
      });
      setPrefs(merged);
    } catch (err) {
      console.warn('Error loading preferences:', err);
    }
  }, [user, supabase]);

  // Check Web Push support & subscription status
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
      setPushSupported(true);
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushSubscribed(!!sub);
        });
      });
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadPrefs();
  }, [loadNotifications, loadPrefs]);

  // Subscribe to real-time notification changes
  useEffect(() => {
    if (!user) return;
    const channelName = `alertes-page-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, loadNotifications]);

  // Toggle notification preferences
  const handleTogglePref = async (type: string, field: 'in_app' | 'email' | 'push', value: boolean) => {
    if (!user) return;
    const updated = prefs.map(p => p.type === type ? { ...p, [`${field}_enabled`]: value } : p);
    setPrefs(updated);

    try {
      const match = updated.find(p => p.type === type);
      const { error: upsertError } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          notification_type: type,
          in_app_enabled: match.in_app_enabled,
          email_enabled: match.email_enabled,
          push_enabled: match.push_enabled,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,notification_type' });

      if (upsertError) throw upsertError;
    } catch (err: any) {
      console.error('Error updating preference:', err.message || err);
      toast.error('Erreur lors de la mise à jour des préférences');
      loadPrefs();
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    if (!user) return;
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('read', false);

      if (updateError) throw updateError;
      setNotifications(prev => prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() })));
      toast.success('Toutes les notifications ont été marquées comme lues');
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  // Click on a notification: mark as read and redirect if link exists
  const handleNotifClick = async (n: any) => {
    if (!n.read) {
      try {
        const { error: updateError } = await supabase
          .from('notifications')
          .update({ read: true, read_at: new Date().toISOString() })
          .eq('id', n.id);

        if (updateError) throw updateError;
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true, read_at: new Date().toISOString() } : item));
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }
    if (n.link) {
      router.push(n.link);
    }
  };

  // Register Web Push subscription
  const handlePushToggle = async () => {
    if (!user) return;
    setRegisteringPush(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushSubscribed) {
        // Unsubscribe
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          // Remove from server
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .filter('subscription->>endpoint', 'eq', sub.endpoint);
        }
        setPushSubscribed(false);
        toast.success('Notifications Push désactivées sur cet appareil');
      } else {
        // Request Permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Permission de notification refusée');
          setRegisteringPush(false);
          return;
        }

        // Fetch VAPID key
        const vapidResp = await fetch('/api/notifications/vapid');
        if (!vapidResp.ok) {
          throw new Error('Impossible de charger la configuration push du serveur');
        }
        const { publicKey } = await vapidResp.json();

        // Subscribe browser
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        // Register to server
        const regResp = await fetch('/api/notifications/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription: sub })
        });

        if (!regResp.ok) throw new Error('Enregistrement serveur push échoué');

        setPushSubscribed(true);
        toast.success('Cet appareil est désormais abonné aux notifications Push !');
      }
    } catch (err: any) {
      console.error('Web Push registration error:', err.message || err);
      toast.error(err.message || 'Échec de la configuration push');
    } finally {
      setRegisteringPush(false);
    }
  };

  // Trigger test SOS notification
  const handleTriggerTestSOS = async () => {
    if (!user) return;
    setSosSending(true);
    try {
      const { data: notifId, error: sosError } = await supabase.rpc('notify', {
        p_user_id: user.id,
        p_type: 'sos_alert',
        p_title: '🔴 SOS ALERTE SECURITE TEST',
        p_message: 'Alerte SOS de secours simulée par le configurateur de test.',
        p_actor_id: user.id,
        p_related_type: 'sos',
        p_related_id: null,
        p_link: '/alertes'
      });

      if (sosError) throw sosError;

      // Trigger delivery queue process automatically
      fetch('/api/notifications/process', { method: 'POST' }).catch(() => {});

      toast.success('SOS critique déclenché ! (Vérifiez les logs email/push)');
      loadNotifications();
    } catch (err: any) {
      console.error('SOS Test error:', err.message || err);
      toast.error('Erreur de déclenchement SOS');
    } finally {
      setSosSending(false);
    }
  };

  const renderDesktopTabs = () => (
    <div className="flex border-b border-stone-200 mb-6 gap-6">
      <button 
        onClick={() => setActiveTab('notifications')} 
        className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'notifications' ? 'text-[#17402C]' : 'text-stone-400 hover:text-stone-600'}`}
      >
        Fil d'Alertes
        {activeTab === 'notifications' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#17402C]" />}
      </button>
      <button 
        onClick={() => setActiveTab('weather')} 
        className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'weather' ? 'text-[#17402C]' : 'text-stone-400 hover:text-stone-600'}`}
      >
        Météo & Secours (SOS)
        {activeTab === 'weather' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#17402C]" />}
      </button>
      <button 
        onClick={() => setActiveTab('settings')} 
        className={`pb-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'settings' ? 'text-[#17402C]' : 'text-stone-400 hover:text-stone-600'}`}
      >
        Préférences
        {activeTab === 'settings' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#17402C]" />}
      </button>
    </div>
  );

  const renderMobileTabs = () => (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
      <button onClick={() => setActiveTab('notifications')} style={{ padding: '8px 12px', borderRadius: '8px', background: activeTab === 'notifications' ? '#17402C' : '#F4F1EA', color: activeTab === 'notifications' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Alertes</button>
      <button onClick={() => setActiveTab('weather')} style={{ padding: '8px 12px', borderRadius: '8px', background: activeTab === 'weather' ? '#17402C' : '#F4F1EA', color: activeTab === 'weather' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Météo / SOS</button>
      <button onClick={() => setActiveTab('settings')} style={{ padding: '8px 12px', borderRadius: '8px', background: activeTab === 'settings' ? '#17402C' : '#F4F1EA', color: activeTab === 'settings' ? 'white' : 'rgba(28,38,32,0.6)', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}>Réglages</button>
    </div>
  );

  return (
    <>
      {/* DESKTOP */}
      <div className="hidden md:block">
        <div className="min-h-screen bg-stone-50/50">
          <Header />
          <main className="pt-20">
            <section className="bg-[#17402C] text-white py-12 px-4">
              <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Icon name="BellIcon" size={20} className="text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-stone-300 tracking-widest uppercase">Espace Membre</p>
                    <h1 className="text-2xl font-display font-800 tracking-tight">Notifications & Sécurité</h1>
                  </div>
                </div>
              </div>
            </section>
            
            <div className="max-w-7xl mx-auto px-4 py-8">
              {renderDesktopTabs()}

              {loading && (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-[#17402C] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {error && (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">⚠️</p>
                  <p className="text-muted-foreground text-sm mb-4">{error}</p>
                  <button onClick={() => loadNotifications()} className="px-5 py-2 bg-[#17402C] text-white rounded-full text-xs font-bold hover:bg-[#2D6A4F] transition-colors">Réessayer</button>
                </div>
              )}
              {!loading && !error && !user && (
                <div className="text-center py-12">
                  <p className="text-4xl mb-3">🔒</p>
                  <p className="text-stone-500 text-sm">Veuillez vous connecter pour voir vos alertes.</p>
                </div>
              )}

              {!loading && !error && user && (
                <>
                  {activeTab === 'notifications' && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-stone-500 font-bold">{notifications.length} notification(s)</p>
                        {notifications.some(n => !n.read) && (
                          <button onClick={handleMarkAllRead} className="text-xs text-[#2D6A4F] hover:underline font-bold">
                            Tout marquer comme lu
                          </button>
                        )}
                      </div>

                      {notifications.length === 0 ? (
                        <div className="text-center py-16 bg-white border border-stone-200 rounded-2xl">
                          <p className="text-4xl mb-3">✅</p>
                          <p className="text-xs text-stone-500 font-bold">Aucune alerte pour le moment.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {notifications.map((n: any) => (
                            <div 
                              key={n.id} 
                              onClick={() => handleNotifClick(n)}
                              className={`border rounded-xl p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                                !n.read ? 'bg-[#A3C4A3]/10 border-[#A3C4A3]/30 hover:bg-[#A3C4A3]/15' : 'bg-white border-stone-200 hover:bg-stone-50'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                n.type === 'sos_alert' ? 'bg-rose-100 text-rose-600' : 'bg-[#17402C]/10 text-[#17402C]'
                              }`}>
                                <Icon name={n.type === 'sos_alert' ? 'ExclamationTriangleIcon' : 'BellIcon'} size={14} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-bold text-xs text-[#0B1F17]">{n.title}</h4>
                                  <p className="text-[9px] text-stone-400">{new Date(n.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                <p className="text-xs text-stone-600 mt-0.5">{n.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'weather' && (
                    <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-6">
                      <div>
                        <h3 className="font-display font-700 text-base text-[#0B1F17] mb-1">Météo Montagne</h3>
                        <p className="text-xs text-stone-500">Aucun bulletin météo critique ou alerte avalanche n'est actif pour vos massifs.</p>
                      </div>
                      <hr className="border-stone-100" />
                      <div>
                        <h3 className="font-display font-700 text-base text-rose-700 mb-1">Système SOS & Secours</h3>
                        <p className="text-xs text-stone-500 mb-4">
                          Le système SOS envoie une alerte prioritaire à tous les membres de votre groupe de voyage en ignorant leurs préférences de notification pour leur sécurité.
                        </p>
                        <button 
                          onClick={handleTriggerTestSOS}
                          disabled={sosSending}
                          className="px-5 py-2.5 bg-rose-600 text-white rounded-full text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                        >
                          {sosSending ? 'Déclenchement en cours...' : 'Déclencher un SOS de test'}
                        </button>
                      </div>
                    </div>
                  )}

                  {activeTab === 'settings' && (
                    <div className="space-y-6">
                      {/* Web Push configuration */}
                      {pushSupported && (
                        <div className="bg-white border border-stone-200 rounded-2xl p-6">
                          <h3 className="font-display font-700 text-base text-[#0B1F17] mb-1">Web Push Navigateur</h3>
                          <p className="text-xs text-stone-500 mb-4">Abonnez cet appareil pour recevoir des notifications en temps réel même lorsque l'application est fermée.</p>
                          <button
                            onClick={handlePushToggle}
                            disabled={registeringPush}
                            className={`px-5 py-2.5 rounded-full text-xs font-bold transition-colors ${
                              pushSubscribed 
                                ? 'bg-stone-100 text-stone-700 hover:bg-stone-200' 
                                : 'bg-[#17402C] text-white hover:bg-[#2D6A4F]'
                            }`}
                          >
                            {registeringPush ? 'Action en cours...' : pushSubscribed ? 'Désactiver les Push sur ce navigateur' : 'Autoriser les Push sur ce navigateur'}
                          </button>
                        </div>
                      )}

                      {/* Config table */}
                      <div className="bg-white border border-stone-200 rounded-2xl p-6">
                        <h3 className="font-display font-700 text-base text-[#0B1F17] mb-1">Canaux de Notifications</h3>
                        <p className="text-xs text-stone-500 mb-6">Sélectionnez le support de votre choix pour chaque type d'alerte.</p>
                        
                        <div className="divide-y divide-stone-100">
                          {prefs.map((p) => (
                            <div key={p.type} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div>
                                <h4 className="font-bold text-xs text-[#0B1F17]">{p.label}</h4>
                                <p className="text-[11px] text-stone-500">{p.description}</p>
                              </div>
                              <div className="flex gap-4 items-center">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={p.in_app_enabled} 
                                    onChange={(e) => handleTogglePref(p.type, 'in_app', e.target.checked)}
                                    className="rounded border-stone-300 text-[#2D6A4F] focus:ring-[#2D6A4F] w-3.5 h-3.5"
                                  />
                                  <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">In-App</span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={p.email_enabled} 
                                    disabled={['post_liked', 'carnet_liked', 'new_follower', 'points_earned'].includes(p.type)}
                                    onChange={(e) => handleTogglePref(p.type, 'email', e.target.checked)}
                                    className="rounded border-stone-300 text-[#2D6A4F] focus:ring-[#2D6A4F] w-3.5 h-3.5 disabled:opacity-50"
                                  />
                                  <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">
                                    {['post_liked', 'carnet_liked', 'new_follower', 'points_earned'].includes(p.type) ? 'Digest' : 'Email'}
                                  </span>
                                </label>
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={p.push_enabled} 
                                    onChange={(e) => handleTogglePref(p.type, 'push', e.target.checked)}
                                    className="rounded border-stone-300 text-[#2D6A4F] focus:ring-[#2D6A4F] w-3.5 h-3.5"
                                  />
                                  <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider">Push</span>
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
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
            <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#1C2620', marginBottom: '12px' }}>Alertes & Sécurité</h1>
            {renderMobileTabs()}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', border: '3px solid rgba(23,64,44,0.15)', borderTopColor: '#17402C', animation: 'lkdv-spin 0.8s linear infinite' }} />
                <style jsx>{`
                  @keyframes lkdv-spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            )}
            {error && (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</p>
                <p style={{ fontSize: '13px', color: 'rgba(28,38,32,0.5)', marginBottom: '16px' }}>{error}</p>
                <button onClick={() => loadNotifications()} style={{ padding: '10px 20px', background: '#17402C', color: '#fff', borderRadius: '10px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer' }}>Réessayer</button>
              </div>
            )}
            {!loading && !error && !user && (
              <p style={{ color: 'rgba(28,38,32,0.5)', textAlign: 'center', padding: '40px 0' }}>Connectez-vous pour voir vos alertes.</p>
            )}

            {!loading && !error && user && (
              <>
                {activeTab === 'notifications' && (
                  <div>
                    {notifications.length > 0 && notifications.some(n => !n.read) && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                        <button onClick={handleMarkAllRead} style={{ fontSize: '11px', color: '#2D6A4F', background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>
                          Tout marquer lu
                        </button>
                      </div>
                    )}
                    {notifications.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 0' }}>
                        <p style={{ fontSize: '28px', marginBottom: '8px' }}>✅</p>
                        <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.5)' }}>Aucune notification</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {notifications.map((n: any) => (
                          <div 
                            key={n.id} 
                            onClick={() => handleNotifClick(n)}
                            style={{ 
                              background: !n.read ? 'rgba(163,196,163,0.12)' : '#FBFAF6', 
                              borderRadius: '12px', 
                              border: !n.read ? '1px solid rgba(163,196,163,0.4)' : '1px solid rgba(11,31,23,0.06)', 
                              padding: '12px',
                              cursor: 'pointer'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#1C2620', margin: 0 }}>{n.title}</p>
                              <span style={{ fontSize: '9px', color: 'rgba(28,38,32,0.4)' }}>{new Date(n.created_at).toLocaleDateString('fr-FR')}</span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.7)', margin: 0 }}>{n.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'weather' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: '#FBFAF6', borderRadius: '12px', padding: '16px', border: '1px solid rgba(11,31,23,0.06)' }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#1C2620' }}>Alerte Secours (SOS)</h4>
                      <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.6)', lineHeight: 1.5, marginBottom: '12px' }}>
                        Le système SOS transmettra immédiatement votre position et un message de secours à tous les membres de votre groupe en ignorant leurs préférences.
                      </p>
                      <button 
                        onClick={handleTriggerTestSOS}
                        disabled={sosSending}
                        style={{ padding: '8px 16px', background: '#e11d48', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {sosSending ? 'Envoi...' : 'SOS de test'}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {pushSupported && (
                      <div style={{ background: '#FBFAF6', borderRadius: '12px', padding: '16px', border: '1px solid rgba(11,31,23,0.06)' }}>
                        <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#1C2620' }}>Push Notifications</h4>
                        <p style={{ fontSize: '12px', color: 'rgba(28,38,32,0.6)', lineHeight: 1.5, marginBottom: '12px' }}>Abonnez cet appareil pour ne rater aucune activité importante.</p>
                        <button
                          onClick={handlePushToggle}
                          disabled={registeringPush}
                          style={{ padding: '8px 16px', background: pushSubscribed ? '#E8E4D8' : '#17402C', color: pushSubscribed ? '#1C2620' : '#fff', border: 'none', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                        >
                          {registeringPush ? 'Chargement...' : pushSubscribed ? 'Désactiver sur cet appareil' : 'Activer sur cet appareil'}
                        </button>
                      </div>
                    )}

                    <div style={{ background: '#FBFAF6', borderRadius: '12px', padding: '16px', border: '1px solid rgba(11,31,23,0.06)' }}>
                      <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1C2620' }}>Canaux</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {prefs.map(p => (
                          <div key={p.type} style={{ borderBottom: '1px solid rgba(11,31,23,0.04)', paddingBottom: '12px' }}>
                            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 2px 0', color: '#1C2620' }}>{p.label}</p>
                            <p style={{ fontSize: '10px', color: 'rgba(28,38,32,0.5)', margin: '0 0 8px 0' }}>{p.description}</p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#1C2620' }}>
                                <input type="checkbox" checked={p.in_app_enabled} onChange={(e) => handleTogglePref(p.type, 'in_app', e.target.checked)} /> In-App
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#1C2620', opacity: ['post_liked', 'carnet_liked', 'new_follower', 'points_earned'].includes(p.type) ? 0.6 : 1 }}>
                                <input type="checkbox" checked={p.email_enabled} disabled={['post_liked', 'carnet_liked', 'new_follower', 'points_earned'].includes(p.type)} onChange={(e) => handleTogglePref(p.type, 'email', e.target.checked)} /> Email
                              </label>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#1C2620' }}>
                                <input type="checkbox" checked={p.push_enabled} onChange={(e) => handleTogglePref(p.type, 'push', e.target.checked)} /> Push
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </MobilePageShell>
      </div>
    </>
  );
}
