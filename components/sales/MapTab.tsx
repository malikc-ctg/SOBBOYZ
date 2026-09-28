'use client';

import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { salesDB } from '@/lib/sales/db';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Navigation, Shield, Layers, Users } from 'lucide-react';
import { toast } from 'sonner';

interface MapTabProps {
  user: any;
  repName: string;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';

export default function MapTab({ user, repName }: MapTabProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [pinCount, setPinCount] = useState(0);
  const [streetToClaim, setStreetToClaim] = useState('');
  const [claims, setClaims] = useState<any[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;

    if (!MAPBOX_TOKEN) {
      setMapError('Mapbox token not configured. Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to your environment.');
      return;
    }

    if (!mapboxgl.supported()) {
      setMapError('WebGL is not supported on this device/browser.');
      return;
    }

    let map: mapboxgl.Map | null = null;
    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-79.3832, 43.6532], // Toronto default
        zoom: 13,
        attributionControl: false,
      });

      map.on('error', (e) => {
        console.warn('[Sales OS] Mapbox error:', e?.error?.message || e);
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

      map.on('load', async () => {
        mapRef.current = map;
        setMapLoaded(true);

        // Locate user
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
          navigator.geolocation.getCurrentPosition(
            pos => {
              if (!map) return;
              map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15 });
              new mapboxgl.Marker({ color: '#3b82f6' })
                .setLngLat([pos.coords.longitude, pos.coords.latitude])
                .setPopup(new mapboxgl.Popup().setText('You are here'))
                .addTo(map);
            },
            () => {}
          );
        }

        // Add pins from local IndexedDB
        try {
          const props = await salesDB.getAllProperties();
          setPinCount(props.length);

          props.forEach(p => {
            if (!p.lat || !p.lng || !map) return;

            const isSale = p.last_status === 'SALE';
            const isCommercial = p.mode === 'commercial';
            const color = isSale ? '#10b981' : isCommercial ? '#818cf8' : '#64748b';

            const el = document.createElement('div');
            el.className = 'sales-marker';
            el.style.width = isCommercial ? '18px' : '14px';
            el.style.height = isCommercial ? '18px' : '14px';
            el.style.borderRadius = isCommercial ? '4px' : '50%';
            el.style.backgroundColor = color;
            el.style.border = '2px solid white';
            el.style.boxShadow = '0 0 6px rgba(0,0,0,0.5)';

            new mapboxgl.Marker(el)
              .setLngLat([p.lng, p.lat])
              .setPopup(
                new mapboxgl.Popup({ offset: 12 }).setHTML(
                  `<div style="color:#0a0f1d;font-family:sans-serif;padding:4px;">
                    <div style="font-weight:bold;font-size:12px;">${p.address}</div>
                    <div style="font-size:11px;color:#475569;">Status: ${p.last_status}</div>
                  </div>`
                )
              )
              .addTo(map);
          });
        } catch (dbErr) {
          console.warn('[Sales OS] Failed to load local properties on map:', dbErr);
        }
      });
    } catch (err: any) {
      console.error('[Sales OS] Map initialization failed:', err);
      setMapError(err?.message || 'Failed to load map');
    }

    return () => {
      try {
        if (map) {
          map.remove();
        }
      } catch (cleanErr) {
        // Ignore unmount cleanup error
      }
    };
  }, []);

  // Fetch active street claims
  useEffect(() => {
    async function loadClaims() {
      const supabase = createClient();
      const todayStr = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('street_claims')
        .select('*')
        .eq('session_date', todayStr);
      setClaims(data || []);
    }
    loadClaims();
  }, []);

  // Claim Street or Plaza
  const handleClaimTerritory = async () => {
    if (!streetToClaim.trim()) {
      toast.error('Enter street or plaza name to claim');
      return;
    }

    const supabase = createClient();
    const todayStr = new Date().toISOString().split('T')[0];

    const { error } = await supabase.from('street_claims').insert({
      rep_id: user.id,
      rep_name: repName,
      street_name: streetToClaim.trim(),
      session_date: todayStr,
    });

    if (error) {
      toast.error(error.message.includes('unique') ? 'Already claimed today!' : 'Failed to claim');
    } else {
      toast.success(`🛡️ Claimed ${streetToClaim}! Teammates can see your claim.`);
      setStreetToClaim('');
      // Reload claims
      const { data } = await supabase
        .from('street_claims')
        .select('*')
        .eq('session_date', todayStr);
      setClaims(data || []);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-[#0a0f1d]">
      {/* Top Territory Bar */}
      <div className="absolute top-3 left-3 right-3 z-10 bg-[#11192e]/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs font-semibold text-blue-300 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {pinCount} Pins
          </div>
          <div className="px-2.5 py-1 bg-emerald-600/20 border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" /> {claims.length} Active Claims
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Street or Plaza to claim..."
            value={streetToClaim}
            onChange={e => setStreetToClaim(e.target.value)}
            className="bg-[#0a0f1d] border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 w-44"
          />
          <button
            onClick={handleClaimTerritory}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-sm"
          >
            Claim
          </button>
        </div>
      </div>

      {/* Map Container */}
      {mapError ? (
        <div className="w-full flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
          <MapPin className="w-10 h-10 text-slate-600" />
          <div className="text-sm font-semibold text-slate-300">Territory Map Unavailable</div>
          <div className="text-xs text-slate-500 max-w-xs">{mapError}</div>
        </div>
      ) : (
        <div ref={mapContainer} className="w-full flex-1" />
      )}

      {/* Legend Drawer */}
      <div className="bg-[#11192e] border-t border-white/10 px-4 py-2.5 flex items-center justify-around text-[11px] text-slate-300 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> Resi Visit
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400" /> Commercial Plaza
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" /> Won Contract ($)
        </div>
      </div>
    </div>
  );
}
