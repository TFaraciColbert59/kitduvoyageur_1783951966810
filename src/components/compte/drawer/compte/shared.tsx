'use client';

import React from 'react';
import {
  Bell,
  Heart,
  MessageCircle,
  Package,
  ShieldCheck,
  ShoppingBag,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import type { NotificationGroup } from '@/features/compte/server/compte';

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `http_${response.status}`);
  }
  return (await response.json()) as T;
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatOrderDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function timeAgo(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

export const NOTIFICATION_GROUP_LABEL: Record<NotificationGroup, string> = {
  social: 'Social',
  loans: 'Prêts',
  orders: 'Commandes',
  system: 'Système',
};

export function notificationIcon(type: string): React.ReactNode {
  const value = type.toLowerCase();
  if (value.includes('follow')) return <UserPlus size={15} aria-hidden="true" />;
  if (value.includes('like')) return <Heart size={15} aria-hidden="true" />;
  if (value.includes('comment') || value.includes('message')) return <MessageCircle size={15} aria-hidden="true" />;
  if (value.includes('group')) return <Users size={15} aria-hidden="true" />;
  if (value.includes('order') || value.includes('commande')) return <ShoppingBag size={15} aria-hidden="true" />;
  if (value.includes('loan') || value.includes('pret')) return <Package size={15} aria-hidden="true" />;
  if (value.includes('materiel') || value.includes('gear')) return <Wrench size={15} aria-hidden="true" />;
  if (value.includes('sos')) return <ShieldCheck size={15} aria-hidden="true" />;
  return <Bell size={15} aria-hidden="true" />;
}
