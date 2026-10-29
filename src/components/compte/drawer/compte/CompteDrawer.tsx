'use client';

import React, { useEffect, useState } from 'react';
import {
  Archive,
  Bell,
  Grid2x2,
  Package,
  Receipt,
  Server,
  Settings,
  Share2,
  ShoppingBag,
  Truck,
  UserPen,
  Users,
  XCircle,
} from 'lucide-react';
import { DrawerShell, DrawerSkeleton, type DrawerSecondaryItem, type DrawerTab } from '../shell/DrawerShell';
import { DrawerAuthRequired } from '../shell/DrawerAuthRequired';
import { useAuth } from '@/contexts/AuthContext';
import { OrdersPane } from './OrdersPane';
import { NotificationsPane } from './NotificationsPane';
import { SettingsPane } from './SettingsPane';
import { EditProfilePane } from './EditProfilePane';
import { SharePane } from './SharePane';

const ORDER_FILTERS: DrawerSecondaryItem[] = [
  { id: 'all', label: 'Toutes', icon: <Grid2x2 size={15} aria-hidden="true" /> },
  { id: 'active', label: 'En cours', icon: <Truck size={15} aria-hidden="true" /> },
  { id: 'past', label: 'Passées', icon: <Archive size={15} aria-hidden="true" /> },
  { id: 'cancelled', label: 'Annulées', icon: <XCircle size={15} aria-hidden="true" /> },
];

const NOTIFICATION_FILTERS: DrawerSecondaryItem[] = [
  { id: 'all', label: 'Tout', icon: <Bell size={15} aria-hidden="true" /> },
  { id: 'social', label: 'Social', icon: <Users size={15} aria-hidden="true" /> },
  { id: 'loans', label: 'Prêts', icon: <Package size={15} aria-hidden="true" /> },
  { id: 'orders', label: 'Commandes', icon: <ShoppingBag size={15} aria-hidden="true" /> },
  { id: 'system', label: 'Système', icon: <Server size={15} aria-hidden="true" /> },
];

export function CompteDrawer({ initialTab = 0 }: { initialTab?: number }) {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState(Math.max(0, Math.min(initialTab, 4)));

  // Le drawer Compte contient des formulaires longs (profil, réglages, partage) :
  // on lui donne une hauteur utile sans toucher aux autres feuilles du runtime.
  useEffect(() => {
    const sheet = document.getElementById('sheet');
    if (!sheet) return;
    const wrapper = sheet.parentElement as HTMLElement | null;
    const previousSheet = sheet.style.height;
    const previousWrapper = wrapper?.style.height ?? '';
    const height = 'min(76dvh, 720px)';
    sheet.style.height = height;
    // Le wrapper `.sw-wrap` porte l'overflow hidden et la hauteur du détent :
    // sans lui, la feuille est visuellement coupée à l'ancienne hauteur.
    if (wrapper) wrapper.style.height = height;
    return () => {
      sheet.style.height = previousSheet;
      if (wrapper) wrapper.style.height = previousWrapper;
    };
  }, []);
  const [orderFilter, setOrderFilter] = useState(0);
  const [notificationFilter, setNotificationFilter] = useState(0);

  const tabs: DrawerTab[] = [
    {
      id: 'orders',
      label: 'Commandes',
      icon: <Receipt size={18} aria-hidden="true" />,
      render: () => <OrdersPane filter={orderFilter} />,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell size={18} aria-hidden="true" />,
      render: () => <NotificationsPane filter={notificationFilter} />,
    },
    {
      id: 'settings',
      label: 'Paramètres',
      icon: <Settings size={18} aria-hidden="true" />,
      render: () => <SettingsPane />,
    },
    {
      id: 'profile',
      label: 'Modifier le profil',
      icon: <UserPen size={18} aria-hidden="true" />,
      render: () => <EditProfilePane />,
    },
    {
      id: 'share',
      label: 'Partager',
      icon: <Share2 size={18} aria-hidden="true" />,
      render: () => <SharePane />,
    },
  ];

  const secondary =
    tab === 0
      ? {
          items: ORDER_FILTERS,
          active: orderFilter,
          onChange: setOrderFilter,
          label: 'Filtres des commandes',
        }
      : tab === 1
        ? {
            items: NOTIFICATION_FILTERS,
            active: notificationFilter,
            onChange: setNotificationFilter,
            label: 'Filtres des notifications',
          }
        : undefined;

  if (authLoading) {
    return (
      <div className="lkdv-drawer-shell">
        <DrawerSkeleton />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="lkdv-drawer-shell">
        <DrawerAuthRequired
          title="Connecte-toi pour accéder à ton compte"
        />
      </div>
    );
  }

  return (
    <div className="lkdv-compte-root">
      <DrawerShell
        tabs={tabs}
        activeIndex={tab}
        onIndexChange={setTab}
        secondary={secondary}
      />
      <style dangerouslySetInnerHTML={{ __html: COMPTE_CSS }} />
    </div>
  );
}

export const COMPTE_CSS = `
.lkdv-compte-root{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;width:100%!important;}
.lkdv-compte-pane{display:flex!important;flex-direction:column!important;gap:10px!important;padding:4px 0 20px!important;}
.lkdv-compte-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;height:34px!important;padding:0 13px!important;border:0!important;border-radius:999px!important;font:600 12px var(--sf)!important;cursor:pointer!important;text-decoration:none!important;white-space:nowrap!important;transition:transform .18s ease,opacity .18s ease!important;}
.lkdv-compte-btn:active{transform:scale(.97)!important;}
.lkdv-compte-btn:disabled{opacity:.45!important;cursor:default!important;}
.lkdv-compte-btn.primary{background:#17402C!important;color:#fff!important;box-shadow:0 4px 14px rgba(23,64,44,.2)!important;}
.lkdv-compte-btn.ghost{background:rgba(255,255,255,.62)!important;color:var(--label)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;}
.lkdv-compte-link{display:inline-flex!important;align-items:center!important;gap:2px!important;border:0!important;background:none!important;padding:0!important;font:600 11px var(--sf)!important;color:#3D7A52!important;cursor:pointer!important;}
.lkdv-compte-count{display:flex!important;flex-direction:column!important;gap:1px!important;padding:0 2px!important;}
.lkdv-compte-count b{font:600 13px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-count span{font:500 10.5px var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-orders{display:flex!important;flex-direction:column!important;gap:8px!important;}
.lkdv-compte-order{display:flex!important;flex-direction:column!important;gap:9px!important;padding:12px!important;border-radius:18px!important;background:rgba(255,255,255,.55)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08),0 8px 22px rgba(23,43,36,.05)!important;}
.lkdv-compte-order>header{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:8px!important;}
.lkdv-compte-order>header b{display:block!important;font:650 13px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-order>header small{font:500 10.5px var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-order-status{display:inline-flex!important;align-items:center!important;height:22px!important;padding:0 9px!important;border-radius:999px!important;font:600 10px var(--sf)!important;background:rgba(23,64,44,.08)!important;color:#17402C!important;}
.lkdv-compte-order-status.delivered{background:rgba(61,122,82,.14)!important;color:#2C5E3E!important;}
.lkdv-compte-order-status.shipped{background:rgba(58,110,150,.13)!important;color:#2F5C7D!important;}
.lkdv-compte-order-status.cancelled{background:rgba(179,58,44,.1)!important;color:#9C2F22!important;}
.lkdv-compte-order-cancel{margin:0!important;font:500 11.5px/1.4 var(--sf)!important;color:#9C2F22!important;}
.lkdv-compte-stepper{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:2px!important;padding:2px 0!important;}
.lkdv-compte-stepper span{display:flex!important;flex-direction:column!important;align-items:center!important;gap:4px!important;flex:1!important;position:relative!important;min-width:0!important;}
.lkdv-compte-stepper span::before{content:""!important;position:absolute!important;top:4px!important;left:-50%!important;width:100%!important;height:2px!important;background:rgba(23,43,36,.1)!important;}
.lkdv-compte-stepper span:first-child::before{display:none!important;}
.lkdv-compte-stepper span.done::before{background:#3D7A52!important;}
.lkdv-compte-stepper i{width:9px!important;height:9px!important;border-radius:50%!important;background:rgba(23,43,36,.14)!important;position:relative!important;z-index:1!important;box-shadow:0 0 0 3px rgba(255,255,255,.7)!important;}
.lkdv-compte-stepper span.done i{background:#3D7A52!important;}
.lkdv-compte-stepper span[data-current="true"] i{box-shadow:0 0 0 3px rgba(61,122,82,.2)!important;}
.lkdv-compte-stepper small{font:500 8.5px/1.1 var(--sf)!important;color:var(--label3)!important;text-align:center!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;max-width:100%!important;}
.lkdv-compte-stepper span.done small{color:#2C5E3E!important;font-weight:600!important;}
.lkdv-compte-order-items{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:5px!important;}
.lkdv-compte-order-items li{display:grid!important;grid-template-columns:30px minmax(0,1fr) auto!important;align-items:center!important;gap:8px!important;font:500 12px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-order-items li.muted{display:block!important;color:var(--label3)!important;}
.lkdv-compte-order-thumb{width:30px!important;height:30px!important;border-radius:9px!important;display:grid!important;place-items:center!important;background:rgba(23,64,44,.07)!important;color:#17402C!important;}
.lkdv-compte-order-items small{font:500 10.5px var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-order-total{display:flex!important;align-items:center!important;justify-content:space-between!important;padding-top:2px!important;font:500 11px var(--sf)!important;color:var(--label2)!important;}
.lkdv-compte-order-total b{font:650 15px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-order-actions{display:flex!important;gap:5px!important;flex-wrap:wrap!important;}
.lkdv-compte-order-detail{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin:0!important;padding:9px 0 0!important;border-top:1px solid rgba(23,43,36,.07)!important;}
.lkdv-compte-order-detail div{display:flex!important;flex-direction:column!important;gap:1px!important;}
.lkdv-compte-order-detail dt{font:600 9.5px var(--sf)!important;color:var(--label3)!important;text-transform:uppercase!important;letter-spacing:.04em!important;}
.lkdv-compte-order-detail dd{margin:0!important;font:500 11.5px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-notif-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:0 2px!important;}
.lkdv-compte-notif-head b{display:block!important;font:600 13px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-notif-head span{display:block!important;font:500 10.5px var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-notif-group{display:flex!important;flex-direction:column!important;gap:5px!important;}
.lkdv-compte-notif-group h3{margin:2px 2px 0!important;font:600 10px var(--sf)!important;color:var(--label3)!important;text-transform:uppercase!important;letter-spacing:.06em!important;}
.lkdv-compte-notif-group ul{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:4px!important;}
.lkdv-compte-notif-group li{display:grid!important;grid-template-columns:34px minmax(0,1fr) 8px!important;align-items:center!important;gap:8px!important;padding:8px 9px!important;border-radius:14px!important;background:rgba(255,255,255,.44)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(23,43,36,.06)!important;}
.lkdv-compte-notif-group li.unread{background:rgba(255,255,255,.68)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.09)!important;}
.lkdv-compte-notif-avatar{width:34px!important;height:34px!important;border-radius:50%!important;overflow:hidden!important;display:grid!important;place-items:center!important;background:linear-gradient(155deg,#fff,#DDEBD8)!important;color:#17402C!important;font:700 11px var(--sf)!important;}
.lkdv-compte-notif-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;}
.lkdv-compte-notif-body{display:flex!important;flex-direction:column!important;gap:1px!important;min-width:0!important;border:0!important;background:none!important;padding:0!important;text-align:left!important;cursor:pointer!important;font-family:var(--sf)!important;}
.lkdv-compte-notif-title{display:flex!important;align-items:baseline!important;gap:6px!important;min-width:0!important;}
.lkdv-compte-notif-title b{font:600 12px var(--sf)!important;color:var(--label)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.lkdv-compte-notif-title small{font:500 9.5px var(--sf)!important;color:var(--label3)!important;flex:none!important;margin-left:auto!important;}
.lkdv-compte-notif-msg{font:400 11px/1.35 var(--sf)!important;color:var(--label2)!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important;}
.lkdv-compte-notif-tag{align-self:flex-start!important;margin-top:2px!important;font:600 8.5px var(--sf)!important;color:var(--label3)!important;text-transform:uppercase!important;letter-spacing:.05em!important;}
.lkdv-compte-notif-dot{width:7px!important;height:7px!important;border-radius:50%!important;background:#3D7A52!important;box-shadow:0 0 0 2px rgba(61,122,82,.15)!important;}
.lkdv-compte-settings-head{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:8px!important;padding:0 2px!important;}
.lkdv-compte-settings-head b{display:block!important;font:650 14px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-settings-head span{display:block!important;font:400 11px var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-inline-status{display:inline-flex!important;align-items:center!important;gap:4px!important;margin:0!important;padding:6px 10px!important;border-radius:10px!important;background:rgba(61,122,82,.1)!important;color:#2C5E3E!important;font:600 11px var(--sf)!important;}
.lkdv-compte-inline-status.error{background:rgba(179,58,44,.1)!important;color:#9C2F22!important;}
.lkdv-compte-setting-card{display:flex!important;flex-direction:column!important;gap:8px!important;padding:12px!important;border-radius:18px!important;background:rgba(255,255,255,.52)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-compte-setting-head{display:grid!important;grid-template-columns:34px minmax(0,1fr) auto!important;align-items:center!important;gap:9px!important;}
.lkdv-compte-setting-ico{width:34px!important;height:34px!important;border-radius:11px!important;display:grid!important;place-items:center!important;background:rgba(23,64,44,.07)!important;color:#17402C!important;}
.lkdv-compte-setting-head b{display:block!important;font:600 12.5px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-setting-head small{display:block!important;font:500 10.5px var(--sf)!important;color:var(--label2)!important;}
.lkdv-compte-setting-card>p{margin:0!important;font:400 11.5px/1.45 var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-switch{width:42px!important;height:25px!important;border:0!important;border-radius:999px!important;background:rgba(23,43,36,.14)!important;padding:2px!important;cursor:pointer!important;transition:background .22s ease!important;flex:none!important;}
.lkdv-compte-switch i{display:block!important;width:21px!important;height:21px!important;border-radius:50%!important;background:#fff!important;box-shadow:0 1px 4px rgba(0,0,0,.18)!important;transition:transform .22s cubic-bezier(.32,.72,0,1)!important;}
.lkdv-compte-switch.on{background:#3D7A52!important;}
.lkdv-compte-switch.on i{transform:translateX(17px)!important;}
.lkdv-compte-prefs{display:flex!important;gap:5px!important;flex-wrap:wrap!important;}
.lkdv-compte-pref{display:inline-flex!important;align-items:center!important;gap:4px!important;height:27px!important;padding:0 9px!important;border:0!important;border-radius:999px!important;background:rgba(23,43,36,.05)!important;color:var(--label3)!important;font:600 10.5px var(--sf)!important;cursor:pointer!important;}
.lkdv-compte-pref i{width:6px!important;height:6px!important;border-radius:50%!important;background:rgba(23,43,36,.18)!important;}
.lkdv-compte-pref.on{background:rgba(61,122,82,.14)!important;color:#2C5E3E!important;}
.lkdv-compte-pref.on i{background:#3D7A52!important;}
.lkdv-compte-segment{display:flex!important;gap:4px!important;padding:2px!important;border-radius:999px!important;background:rgba(23,43,36,.05)!important;align-self:flex-start!important;}
.lkdv-compte-segment button{display:inline-flex!important;align-items:center!important;gap:4px!important;height:25px!important;padding:0 10px!important;border:0!important;border-radius:999px!important;background:none!important;color:var(--label3)!important;font:600 10.5px var(--sf)!important;cursor:pointer!important;}
.lkdv-compte-segment button.on{background:rgba(255,255,255,.9)!important;color:var(--label)!important;box-shadow:0 1px 4px rgba(23,43,36,.1)!important;}
.lkdv-compte-security-badge{display:inline-flex!important;align-items:center!important;gap:4px!important;height:22px!important;padding:0 8px!important;border-radius:999px!important;background:rgba(185,138,46,.14)!important;color:#7d5c14!important;font:600 9.5px var(--sf)!important;}
.lkdv-compte-security-badge.on{background:rgba(61,122,82,.14)!important;color:#2C5E3E!important;}
.lkdv-compte-security-actions{display:flex!important;gap:6px!important;flex-wrap:wrap!important;}
.lkdv-compte-btn.danger{background:rgba(179,58,44,.12)!important;color:#9C2F22!important;box-shadow:inset 0 0 0 .5px rgba(179,58,44,.25)!important;}
.lkdv-compte-edit-preview{display:grid!important;grid-template-columns:52px minmax(0,1fr) auto!important;align-items:center!important;gap:10px!important;padding:11px 12px!important;border-radius:18px!important;background:linear-gradient(135deg,rgba(255,255,255,.7),rgba(255,255,255,.42))!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-compte-edit-avatar{width:52px!important;height:52px!important;border-radius:50%!important;overflow:hidden!important;display:grid!important;place-items:center!important;background:linear-gradient(155deg,#fff,#DDEBD8)!important;color:#17402C!important;font:700 16px var(--sf)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;}
.lkdv-compte-edit-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;}
.lkdv-compte-edit-preview b{display:block!important;font:650 14px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-edit-preview small{display:block!important;font:500 11px var(--sf)!important;color:var(--label2)!important;}
.lkdv-compte-edit-preview span{display:block!important;font:500 10.5px var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-ring{position:relative!important;width:46px!important;height:46px!important;display:grid!important;place-items:center!important;}
.lkdv-compte-ring svg{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;}
.lkdv-compte-ring b{font:650 9.5px var(--sf)!important;color:#2C5E3E!important;}
.lkdv-compte-suggestions{display:flex!important;flex-direction:column!important;gap:5px!important;padding:10px 12px!important;border-radius:16px!important;background:rgba(232,192,104,.12)!important;box-shadow:inset 0 0 0 .5px rgba(185,138,46,.16)!important;}
.lkdv-compte-suggestions>b{display:inline-flex!important;align-items:center!important;gap:5px!important;font:600 11.5px var(--sf)!important;color:#7d5c14!important;}
.lkdv-compte-suggestions ul{list-style:none!important;margin:0!important;padding:0!important;display:flex!important;flex-direction:column!important;gap:2px!important;}
.lkdv-compte-suggestions li{font:500 11px var(--sf)!important;color:#8a6418!important;}
.lkdv-compte-suggestions li::before{content:"· "!important;}
.lkdv-compte-form{display:flex!important;flex-direction:column!important;gap:10px!important;padding:12px!important;border-radius:18px!important;background:rgba(255,255,255,.52)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.08)!important;}
.lkdv-compte-form label{display:flex!important;flex-direction:column!important;gap:4px!important;}
.lkdv-compte-form label>span{font:600 10px var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.05em!important;}
.lkdv-compte-form input,.lkdv-compte-form textarea,.lkdv-compte-form select{width:100%!important;box-sizing:border-box!important;border:0!important;border-radius:11px!important;background:rgba(255,255,255,.7)!important;padding:9px 11px!important;font:500 12.5px/1.4 var(--sf)!important;color:var(--label)!important;outline:none!important;box-shadow:inset 0 0 0 .5px rgba(23,43,36,.12)!important;resize:vertical!important;}
.lkdv-compte-prefix{display:flex!important;align-items:center!important;gap:2px!important;border-radius:11px!important;background:rgba(255,255,255,.7)!important;padding:0 9px!important;box-shadow:inset 0 0 0 .5px rgba(23,43,36,.12)!important;}
.lkdv-compte-prefix>span{font:600 12px var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-prefix input{background:none!important;box-shadow:none!important;padding:9px 0!important;}
.lkdv-compte-links{display:flex!important;flex-direction:column!important;gap:6px!important;padding-top:2px!important;}
.lkdv-compte-links-head{display:flex!important;align-items:center!important;justify-content:space-between!important;}
.lkdv-compte-links-head>span{font:600 10px var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.05em!important;}
.lkdv-compte-link-row{display:grid!important;grid-template-columns:88px minmax(0,1fr) 26px!important;gap:5px!important;align-items:center!important;}
.lkdv-compte-link-remove{width:26px!important;height:26px!important;border:0!important;border-radius:50%!important;background:none!important;color:var(--label3)!important;display:grid!important;place-items:center!important;cursor:pointer!important;}
.lkdv-compte-empty-line{display:flex!important;align-items:center!important;gap:5px!important;margin:0!important;font:500 11px var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-savebar{position:sticky!important;bottom:0!important;z-index:4!important;display:flex!important;justify-content:flex-end!important;gap:6px!important;padding:8px 0 2px!important;background:linear-gradient(180deg,rgba(248,250,245,0),rgba(248,250,245,.92) 40%)!important;}
.lkdv-compte-note{display:flex!important;align-items:flex-start!important;gap:5px!important;margin:0!important;font:400 10.5px/1.4 var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-share{position:relative!important;}
.lkdv-compte-share-card{position:relative!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;align-items:center!important;gap:12px!important;padding:18px 14px 14px!important;border-radius:24px!important;background:linear-gradient(160deg,rgba(255,255,255,.82),rgba(244,248,240,.6))!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1),0 14px 36px rgba(23,43,36,.1)!important;}
.lkdv-compte-share-glow{position:absolute!important;width:220px!important;height:220px!important;border-radius:50%!important;background:radial-gradient(circle,rgba(160,205,170,.4),rgba(160,205,170,0) 70%)!important;top:-90px!important;right:-70px!important;pointer-events:none!important;}
.lkdv-compte-share-head{position:relative!important;display:flex!important;align-items:center!important;gap:10px!important;width:100%!important;}
.lkdv-compte-share-avatar{width:48px!important;height:48px!important;border-radius:50%!important;overflow:hidden!important;display:grid!important;place-items:center!important;background:linear-gradient(155deg,#fff,#DDEBD8)!important;color:#17402C!important;font:700 15px var(--sf)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.12)!important;}
.lkdv-compte-share-avatar img{width:100%!important;height:100%!important;object-fit:cover!important;}
.lkdv-compte-share-head b{display:block!important;font:650 16px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-share-head small{display:block!important;font:500 11.5px var(--sf)!important;color:var(--label2)!important;}
.lkdv-compte-share-head span{display:block!important;font:500 10.5px var(--sf)!important;color:var(--label3)!important;}
.lkdv-compte-share-qr{position:relative!important;display:grid!important;place-items:center!important;padding:9px!important;border-radius:20px!important;background:rgba(255,255,255,.86)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.1)!important;}
.lkdv-compte-share-qr img{display:block!important;border-radius:10px!important;width:176px!important;height:176px!important;}
.lkdv-compte-share-seal{position:absolute!important;display:grid!important;place-items:center!important;width:32px!important;height:32px!important;border-radius:50%!important;background:#17402C!important;color:#fff!important;box-shadow:0 0 0 4px #fff!important;}
.lkdv-compte-share-url{margin:0!important;font:500 10.5px var(--sf)!important;color:var(--label2)!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;}
.lkdv-compte-share-actions{display:flex!important;gap:6px!important;flex-wrap:wrap!important;justify-content:center!important;}
.lkdv-compte-share-stats{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;}
.lkdv-compte-share-stats>div{display:flex!important;flex-direction:column!important;gap:2px!important;padding:9px!important;border-radius:14px!important;background:rgba(255,255,255,.52)!important;box-shadow:inset 0 1px 0 #fff,0 0 0 .5px rgba(23,43,36,.07)!important;text-align:center!important;}
.lkdv-compte-share-stats small{font:500 9.5px var(--sf)!important;color:var(--label2)!important;text-transform:uppercase!important;letter-spacing:.04em!important;}
.lkdv-compte-share-stats b{font:650 16px var(--sf)!important;color:var(--label)!important;}
.lkdv-compte-share-note{display:flex!important;flex-direction:column!important;gap:4px!important;padding:11px 12px!important;border-radius:16px!important;background:rgba(61,122,82,.07)!important;box-shadow:inset 0 0 0 .5px rgba(61,122,82,.16)!important;}
.lkdv-compte-share-note b{display:inline-flex!important;align-items:center!important;gap:5px!important;font:600 11.5px var(--sf)!important;color:#2C5E3E!important;}
.lkdv-compte-share-note p{margin:0!important;font:400 11px/1.45 var(--sf)!important;color:var(--label2)!important;}
.lkdv-compte-empty-ico{color:var(--label3)!important;}
/* Harmonisation : boutons plus petits et plus légers, images en grand, pilules icône. */
.lkdv-compte-btn{height:32px!important;padding:0 12px!important;font:600 11.5px var(--sf)!important;}
.lkdv-compte-btn.primary{box-shadow:0 4px 12px rgba(23,64,44,.22)!important;}
.lkdv-compte-btn.ghost{background:linear-gradient(180deg,rgba(255,255,255,.78),rgba(255,255,255,.5))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 0 0 .5px rgba(23,43,36,.14),0 3px 10px rgba(23,43,36,.08)!important;color:#17402C!important;}
.lkdv-compte-share-actions{justify-content:center!important;}
.lkdv-compte-share-note{flex-direction:row!important;align-items:center!important;gap:6px!important;margin:0!important;padding:8px 11px!important;font:500 11px var(--sf)!important;color:#2C5E3E!important;}
.lkdv-compte-order-actions{justify-content:flex-end!important;gap:8px!important;}
.lkdv-compte-edit-hero{position:relative!important;display:flex!important;flex-direction:column!important;justify-content:flex-end!important;border-radius:20px!important;overflow:hidden!important;}
.lkdv-compte-edit-hero.has-cover{min-height:178px!important;}
.lkdv-compte-edit-cover{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;}
.lkdv-compte-edit-hero.has-cover .lkdv-compte-edit-preview{position:relative!important;margin:8px!important;background:linear-gradient(180deg,rgba(255,255,255,.74),rgba(255,255,255,.52))!important;-webkit-backdrop-filter:blur(16px) saturate(1.6)!important;backdrop-filter:blur(16px) saturate(1.6)!important;}
.lkdv-compte-edit-hero-tools{position:absolute!important;top:8px!important;right:8px!important;z-index:2!important;display:flex!important;gap:6px!important;}
.lkdv-compte-edit-hero:not(.has-cover) .lkdv-compte-edit-hero-tools{position:static!important;order:2!important;justify-content:flex-end!important;margin-top:6px!important;}
.lkdv-compte-edit-avatar{position:relative!important;overflow:visible!important;}
.lkdv-compte-edit-avatar img{border-radius:50%!important;}
.lkdv-compte-photo-pill{cursor:pointer!important;}
.lkdv-compte-photo-pill input{position:absolute!important;inset:0!important;opacity:0!important;cursor:pointer!important;}
.lkdv-compte-photo-pill[data-disabled]{opacity:.45!important;pointer-events:none!important;}
.lkdv-compte-photo-pill.is-small{position:absolute!important;right:-8px!important;bottom:-6px!important;width:28px!important;min-width:28px!important;height:24px!important;}
.lkdv-compte-photo-pill.is-small svg{width:13px!important;height:13px!important;}
.lkdv-compte-edit-avatar-clear{position:absolute!important;left:8px!important;top:8px!important;z-index:2!important;}
.lkdv-compte-savebar{gap:8px!important;}
.lkdv-compte-setting-head .lkdv-compte-setting-pill{margin-left:auto!important;}
@media (max-width:380px){.lkdv-compte-order-detail{grid-template-columns:1fr!important;}.lkdv-compte-link-row{grid-template-columns:74px minmax(0,1fr) 24px!important;}.lkdv-compte-share-qr img{width:156px!important;height:156px!important;}}
@media (prefers-reduced-motion:reduce){.lkdv-compte-switch,.lkdv-compte-switch i,.lkdv-compte-btn{transition:none!important;}}
`;

export default CompteDrawer;
