'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useChat } from '@/lib/hooks/useChat';

interface Notification {
  id: string;
  type: 'expiry' | 'maintenance' | 'weather' | 'trip' | 'promo' | 'community';
  title: string;
  message: string;
  read: boolean;
  urgent: boolean;
  action_label?: string;
  action_href?: string;
  created_at: string;
}

const NOTIF_TYPE_CONFIG = {
  expiry: { icon: 'ClockIcon', color: 'text-red-500', bg: 'bg-red-50 border-red-200', label: 'Expiration' },
  maintenance: { icon: 'WrenchScrewdriverIcon', color: 'text-blue-500', bg: 'bg-blue-50 border-blue-200', label: 'Entretien' },
  weather: { icon: 'CloudIcon', color: 'text-sky-500', bg: 'bg-sky-50 border-sky-200', label: 'Météo' },
  trip: { icon: 'MapPinIcon', color: 'text-primary', bg: 'bg-primary/5 border-primary/20', label: 'Voyage' },
  promo: { icon: 'TagIcon', color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200', label: 'Promo' },
  community: { icon: 'UsersIcon', color: 'text-purple-500', bg: 'bg-purple-50 border-purple-200', label: 'Communauté' },
};

const WEATHER_DATA = [
  { country: 'Népal', code: 'NP', temperature: 18, condition: 'Partiellement nuageux', humidity: 72, windKmh: 15, uvIndex: 8, forecast: [{ day: 'Lun', high: 20, low: 12, icon: '⛅' }, { day: 'Mar', high: 17, low: 10, icon: '🌧️' }, { day: 'Mer', high: 15, low: 9, icon: '⛈️' }, { day: 'Jeu', high: 19, low: 11, icon: '🌤️' }, { day: 'Ven', high: 22, low: 13, icon: '☀️' }], gearAdvice: 'Veste imperméable indispensable. Prévoir couches thermiques pour les nuits en altitude.', travelAlert: 'Mousson active — risque de glissements de terrain sur certains sentiers.' },
  // eslint-disable-next-line no-useless-escape
  { country: 'Islande', code: 'IS', temperature: 8, condition: 'Venteux et pluvieux', humidity: 85, windKmh: 45, uvIndex: 2, forecast: [{ day: 'Lun', high: 9, low: 4, icon: '🌧️' }, { day: 'Mar', high: 7, low: 3, icon: '⛈️' }, { day: 'Mer', high: 11, low: 5, icon: '🌤️' }, { day: 'Jeu', high: 10, low: 4, icon: '⛅' }, { day: 'Ven', high: 8, low: 3, icon: '🌧️' }], gearAdvice: 'Imperméabilisation maximale requise. Vents violents — éviter les randonnées exposées.', travelAlert: "Alerte vent fort — vitesses jusqu\'à 60 km/h prévues mercredi." },
];

export default function AlertesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedWeather, setSelectedWeather] = useState(WEATHER_DATA[0]);
  const [weatherQuery, setWeatherQuery] = useState('');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<'notifications' | 'weather' | 'settings'>('notifications');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ type: 'trip' as Notification['type'], title: '', message: '', urgent: false, action_label: '', action_href: '' });
  const [adding, setAdding] = useState(false);
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const { response: weatherAdvice, isLoading: weatherLoading, sendMessage } = useChat('GEMINI', 'gemini/gemini-2.5-flash', false);

  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const [sendingSOS, setSendingSOS] = useState(false);
  const [sosSuccess, setSOSSuccess] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotifications(data ?? []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  // Seed default notifications for new users
  useEffect(() => {
    if (!user || loading || notifications.length > 0) return;
    const seedNotifications = async () => {
      const defaults = [
        // eslint-disable-next-line no-useless-escape
        { user_id: user.id, type: 'expiry', title: 'Filtre Sawyer — Expiration proche', message: 'Votre filtre à eau Sawyer Squeeze expire dans 45 jours. Pensez à le renouveler.', urgent: true, action_label: "Voir l\'inventaire", action_href: '/inventaire' },
        { user_id: user.id, type: 'weather', title: '⛈️ Alerte météo — Népal', message: 'Mousson active sur votre destination prévue. Risque de perturbations sur les sentiers de haute altitude.', urgent: true, action_label: 'Voir la météo', action_href: '/pays/np' },
        { user_id: user.id, type: 'trip', title: 'Rappel de voyage — Népal dans 12 jours', message: 'Votre départ pour le Népal approche. Vérifiez votre liste de préparation et votre inventaire.', urgent: false, action_label: 'Voir mon kit', action_href: '/jumeau-3d' },
      ];
      await supabase.from('notifications').insert(defaults);
      await loadNotifications();
    };
    seedNotifications();
  }, [user, loading, notifications.length, supabase, loadNotifications]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const deleteNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleAddNotification = async () => {
    if (!user || !addForm.title.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase.from('notifications').insert({
        user_id: user.id,
        type: addForm.type,
        title: addForm.title,
        message: addForm.message,
        urgent: addForm.urgent,
        action_label: addForm.action_label,
        action_href: addForm.action_href,
        read: false,
      }).select().single();
      if (error) throw error;
      setNotifications((prev) => [data, ...prev]);
      setShowAddModal(false);
      setAddForm({ type: 'trip', title: '', message: '', urgent: false, action_label: '', action_href: '' });
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleWeatherQuery = () => {
    if (!weatherQuery.trim()) return;
    sendMessage([
      { role: 'system', content: 'Tu es un assistant météo et équipement de randonnée. Réponds en français de manière concise (3-4 phrases max). Donne des conseils pratiques sur l\'équipement adapté aux conditions météo décrites.' },
      { role: 'user', content: `Conditions météo pour ${weatherQuery}: ${selectedWeather.condition}, ${selectedWeather.temperature}°C, humidité ${selectedWeather.humidity}%, vent ${selectedWeather.windKmh} km/h. Quels équipements sont essentiels ?` },
    ], { temperature: 0.7, max_tokens: 300 });
  };

  const handleEnablePush = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          setPushEnabled(true);
        }
      });
    }
  };

  const handleSendSOS = async () => {
    if (!user) return;
    setSendingSOS(true);
    try {
      // Get geolocation if available
      let lat: number | null = null;
      let lng: number | null = null;
      if ('geolocation' in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
        } catch {
          // Geolocation not available or denied
        }
      }

      await supabase.from('sos_alerts').insert({
        user_id: user.id,
        latitude: lat,
        longitude: lng,
        message: sosMessage || 'Alerte SOS envoyée depuis l\'application',
        status: 'active',
      });

      // Also create a notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'trip',
        title: '🆘 Alerte SOS envoyée',
        message: `Votre alerte SOS a été envoyée${lat ? ` depuis la position ${lat.toFixed(4)}°N, ${lng?.toFixed(4)}°E` : ''}. Les secours ont été notifiés.`,
        urgent: true,
        read: false,
      });

      setSOSSuccess(true);
      setShowSOSModal(false);
      setSosMessage('');
      await loadNotifications();
      setTimeout(() => setSOSSuccess(false), 5000);
    } catch (err: unknown) {
      console.error('SOS error:', err);
    } finally {
      setSendingSOS(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifs = notifications.filter((n) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'unread') return !n.read;
    return n.type === activeFilter;
  });

  const formatDate = (d: string) => {
    const date = new Date(d);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-20">
        <section className="bg-dark-bg text-white py-10 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Icon name="BellIcon" size={22} variant="outline" className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-mono text-primary/80 tracking-widest uppercase">Phase 3 · Alertes & Météo</p>
                  <h1 className="text-2xl font-display font-800 tracking-tight">Alertes & Météo en Temps Réel</h1>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {unreadCount > 0 && (
                  <>
                    <span className="bg-primary text-white text-sm font-bold px-3 py-1 rounded-full">{unreadCount} non lues</span>
                    <button onClick={markAllRead} className="text-xs text-white/60 hover:text-white transition-colors">Tout marquer lu</button>
                  </>
                )}
                <button onClick={() => setShowAddModal(true)} className="btn-primary text-sm py-2">
                  <Icon name="PlusIcon" size={14} />
                  Nouvelle alerte
                </button>
                {user && (
                  <button
                    onClick={() => setShowSOSModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-700 transition-all shadow-lg shadow-red-600/30"
                  >
                    <Icon name="ExclamationTriangleIcon" size={14} variant="solid" />
                    SOS
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex gap-2 mb-6 border-b border-border pb-4">
            {[
              { id: 'notifications', label: 'Notifications', icon: 'BellIcon', count: unreadCount },
              { id: 'weather', label: 'Météo IA', icon: 'CloudIcon' },
              { id: 'settings', label: 'Paramètres', icon: 'CogIcon' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                <Icon name={tab.icon as string} size={16} variant="outline" />
                {tab.label}
                {tab.count ? <span className="bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{tab.count}</span> : null}
              </button>
            ))}
          </div>

          {activeTab === 'notifications' && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Filtrer par type</h3>
                {[
                  { id: 'all', label: 'Toutes', count: notifications.length },
                  { id: 'unread', label: 'Non lues', count: unreadCount },
                  ...Object.entries(NOTIF_TYPE_CONFIG).map(([k, v]) => ({ id: k, label: v.label, count: notifications.filter((n) => n.type === k).length })),
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${activeFilter === filter.id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                  >
                    <span>{filter.label}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeFilter === filter.id ? 'bg-primary/20' : 'bg-muted'}`}>{filter.count}</span>
                  </button>
                ))}
              </div>

              <div className="lg:col-span-3 space-y-3">
                {!user ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Icon name="BellIcon" size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-display font-700 text-foreground mb-1">Connectez-vous</p>
                    <p className="text-sm">Connectez-vous pour voir vos notifications.</p>
                  </div>
                ) : loading ? (
                  <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
                ) : filteredNotifs.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <Icon name="BellSlashIcon" size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="font-display font-700 text-foreground mb-1">Aucune notification</p>
                    <p className="text-sm">Vous êtes à jour !</p>
                  </div>
                ) : (
                  filteredNotifs.map((notif) => {
                    const config = NOTIF_TYPE_CONFIG[notif.type] ?? NOTIF_TYPE_CONFIG.trip;
                    return (
                      <div
                        key={notif.id}
                        className={`p-4 rounded-xl border transition-all cursor-pointer ${notif.read ? 'bg-card border-border opacity-70' : `${config.bg} shadow-sm`}`}
                        onClick={() => markRead(notif.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${notif.read ? 'bg-muted' : 'bg-white'}`}>
                            <Icon name={config.icon as string} size={16} variant="outline" className={config.color} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                  {notif.urgent && <span className="text-[10px] font-700 px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">URGENT</span>}
                                  {!notif.read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                                  <p className="text-sm font-600 text-foreground">{notif.title}</p>
                                </div>
                                <p className="text-xs text-muted-foreground leading-relaxed">{notif.message}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">{formatDate(notif.created_at)}</p>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }} className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 transition-colors flex-shrink-0">
                                <Icon name="XMarkIcon" size={14} />
                              </button>
                            </div>
                            {notif.action_label && notif.action_href && (
                              <Link href={notif.action_href} className="inline-flex items-center gap-1 mt-2 text-xs font-600 text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                                {notif.action_label} <Icon name="ArrowRightIcon" size={10} />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeTab === 'weather' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="flex gap-2 flex-wrap">
                  {WEATHER_DATA.map((w) => (
                    <button key={w.code} onClick={() => setSelectedWeather(w)} className={`px-4 py-2 rounded-xl text-sm font-600 transition-all ${selectedWeather.code === w.code ? 'bg-primary text-white' : 'bg-card border border-border text-foreground hover:border-primary/40'}`}>
                      {w.country}
                    </button>
                  ))}
                </div>
                <div className="topo-card p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-display font-700 text-xl text-foreground">{selectedWeather.country}</h3>
                      <p className="text-muted-foreground text-sm">{selectedWeather.condition}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-display font-800 text-foreground">{selectedWeather.temperature}°C</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[{ label: 'Humidité', value: `${selectedWeather.humidity}%`, icon: 'BeakerIcon' }, { label: 'Vent', value: `${selectedWeather.windKmh} km/h`, icon: 'ArrowPathIcon' }, { label: 'UV', value: `${selectedWeather.uvIndex}/10`, icon: 'SunIcon' }].map((stat) => (
                      <div key={stat.label} className="bg-background rounded-xl p-3 border border-border text-center">
                        <Icon name={stat.icon as string} size={16} variant="outline" className="text-primary mx-auto mb-1" />
                        <p className="font-mono font-700 text-sm text-foreground">{stat.value}</p>
                        <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedWeather.forecast.map((f) => (
                      <div key={f.day} className="flex-shrink-0 bg-background rounded-xl p-3 border border-border text-center min-w-[60px]">
                        <p className="text-[10px] text-muted-foreground font-600 mb-1">{f.day}</p>
                        <p className="text-lg mb-1">{f.icon}</p>
                        <p className="text-xs font-700 text-foreground">{f.high}°</p>
                        <p className="text-[10px] text-muted-foreground">{f.low}°</p>
                      </div>
                    ))}
                  </div>
                  {selectedWeather.travelAlert && (
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                      <Icon name="ExclamationTriangleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{selectedWeather.travelAlert}</p>
                    </div>
                  )}
                </div>
                <div className="topo-card p-5">
                  <h3 className="font-display font-700 text-base mb-3 flex items-center gap-2">
                    <Icon name="SparklesIcon" size={16} className="text-primary" />
                    Conseils équipement IA
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">{selectedWeather.gearAdvice}</p>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder="Posez une question sur l'équipement..."
                      value={weatherQuery}
                      onChange={(e) => setWeatherQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleWeatherQuery()}
                    />
                    <button onClick={handleWeatherQuery} disabled={weatherLoading} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50">
                      {weatherLoading ? '...' : 'Demander'}
                    </button>
                  </div>
                  {weatherAdvice && (
                    <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-xl text-sm text-foreground leading-relaxed">
                      {weatherAdvice}
                    </div>
                  )}
                </div>
              </div>
              <aside className="space-y-4">
                <div className="topo-card p-5">
                  <h3 className="font-display font-700 text-base mb-3">Destinations suivies</h3>
                  {WEATHER_DATA.map((w) => (
                    <button key={w.code} onClick={() => setSelectedWeather(w)} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors text-left mb-2">
                      <div>
                        <p className="text-sm font-600 text-foreground">{w.country}</p>
                        <p className="text-xs text-muted-foreground">{w.condition}</p>
                      </div>
                      <p className="font-mono font-700 text-foreground">{w.temperature}°C</p>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-lg space-y-6">
              <div className="topo-card p-6">
                <h3 className="font-display font-700 text-base mb-4">Notifications push</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-600 text-foreground">Activer les notifications push</p>
                    <p className="text-xs text-muted-foreground">Recevez des alertes en temps réel sur votre appareil</p>
                  </div>
                  <button
                    onClick={handleEnablePush}
                    className={`px-4 py-2 rounded-xl text-sm font-600 transition-all ${pushEnabled ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'btn-primary'}`}
                  >
                    {pushEnabled ? '✓ Activées' : 'Activer'}
                  </button>
                </div>
              </div>
              <div className="topo-card p-6">
                <h3 className="font-display font-700 text-base mb-4">Types d&apos;alertes</h3>
                <div className="space-y-3">
                  {Object.entries(NOTIF_TYPE_CONFIG).map(([key, config]) => (
                    <div key={key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon name={config.icon as string} size={16} variant="outline" className={config.color} />
                        <span className="text-sm text-foreground">{config.label}</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* SOS success banner */}
      {sosSuccess && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-sm font-700">
          <Icon name="CheckCircleIcon" size={18} variant="solid" />
          Alerte SOS envoyée ! Les secours ont été notifiés.
        </div>
      )}

      {/* SOS Modal */}
      {showSOSModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center">
                <Icon name="ExclamationTriangleIcon" size={24} variant="solid" className="text-white" />
              </div>
              <div>
                <h2 className="font-display font-700 text-foreground text-lg">Alerte SOS</h2>
                <p className="text-xs text-red-500 font-medium">Urgence — Envoi immédiat</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-700 font-medium">⚠️ Cette alerte signale une situation d&apos;urgence. Votre position GPS sera partagée si disponible.</p>
            </div>
            <div className="mb-4">
              <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Message (optionnel)</label>
              <textarea
                rows={3}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
                placeholder="Décrivez votre situation d'urgence..."
                value={sosMessage}
                onChange={(e) => setSosMessage(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSOSModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Annuler
              </button>
              <button
                onClick={handleSendSOS}
                disabled={sendingSOS}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sendingSOS ? 'Envoi...' : (
                  <>
                    <Icon name="ExclamationTriangleIcon" size={16} variant="solid" />
                    Envoyer SOS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add notification modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display font-700 text-foreground text-lg">Nouvelle alerte</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Type</label>
                <select className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value as Notification['type'] }))}>
                  {Object.entries(NOTIF_TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Titre</label>
                <input className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" placeholder="Titre de l'alerte" value={addForm.title} onChange={(e) => setAddForm((f) => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1.5">Message</label>
                <textarea rows={3} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" placeholder="Détails de l'alerte..." value={addForm.message} onChange={(e) => setAddForm((f) => ({ ...f, message: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={addForm.urgent} onChange={(e) => setAddForm((f) => ({ ...f, urgent: e.target.checked }))} className="rounded" />
                <span className="text-sm text-foreground">Marquer comme urgent</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddModal(false)} className="flex-1 btn-secondary py-2.5 text-sm justify-center">Annuler</button>
                <button onClick={handleAddNotification} disabled={adding || !addForm.title.trim()} className="flex-1 btn-primary py-2.5 text-sm justify-center disabled:opacity-50">
                  {adding ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

export const dynamic = 'force-dynamic';
