'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Map as LeafletMap, Marker } from 'leaflet';

interface Listing {
  id: string;
  name: string;
  type: string;
  subtype: string;
  location?: string;
  altitude: number;
  capacity: number;
  heatingType: string;
  price: number;
  rating: number;
  reviewCount: number;
  lat: number;
  lng: number;
  image: string;
  alt: string;
}

interface ExplorerSplitMapProps {
  listings: Listing[];
  selectedId: string | null;
  onMarkerClick: (listing: Listing) => void;
  center?: [number, number];
  zoom?: number;
}

const OSM_TILE = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

export default function ExplorerSplitMap({
  listings,
  selectedId,
  onMarkerClick,
  center = [45.38, 5.87],
  zoom = 10,
}: ExplorerSplitMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());

  // Build price marker icon
  const buildIcon = useCallback(
    (listing: Listing, isSelected: boolean, L: typeof import('leaflet')) => {
      const bg = isSelected ? '#1C2620' : 'white';
      const color = isSelected ? 'white' : '#1C2620';
      const border = isSelected ? '#1C2620' : '#1C2620';
      const shadow = isSelected ? '0 2px 8px rgba(28,38,32,0.4)' : '0 2px 6px rgba(0,0,0,0.15)';

      return L.divIcon({
        html: `<div style="
          background:${bg};
          color:${color};
          border:1.5px solid ${border};
          border-radius:20px;
          padding:4px 8px;
          font-size:11px;
          font-weight:700;
          font-family:'DM Sans',sans-serif;
          white-space:nowrap;
          box-shadow:${shadow};
          cursor:pointer;
          transition:all 0.15s;
        ">${listing.price}€</div>`,
        className: '',
        iconSize: undefined,
        iconAnchor: [20, 14],
      });
    },
    []
  );

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(containerRef.current!, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer(OSM_TILE.url, {
        attribution: OSM_TILE.attribution,
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      // Add markers
      listings.forEach((listing) => {
        const icon = buildIcon(listing, listing.id === selectedId, L);
        const marker = L.marker([listing.lat, listing.lng], { icon });
        marker.on('click', () => onMarkerClick(listing));
        marker.addTo(map);
        markersRef.current.set(listing.id, marker);
      });
    });

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch { /* ignore */ }
        mapRef.current = null;
        markersRef.current.clear();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when selectedId changes
  useEffect(() => {
    if (!mapRef.current || typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      listings.forEach((listing) => {
        const marker = markersRef.current.get(listing.id);
        if (marker) {
          const icon = buildIcon(listing, listing.id === selectedId, L);
          marker.setIcon(icon);
        }
      });

      // Pan to selected
      if (selectedId) {
        const listing = listings.find((l) => l.id === selectedId);
        if (listing && mapRef.current) {
          mapRef.current.panTo([listing.lat, listing.lng], { animate: true, duration: 0.5 });
        }
      }
    });
  }, [selectedId, listings, buildIcon]);

  return (
    <div ref={containerRef} className="w-full h-full" />
  );
}
