'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { createClient } from '@/lib/supabase/client';
import {
  Search, RefreshCw, Radio, Briefcase,
  DollarSign, Zap, AlertTriangle, CheckCircle,
  Users, Home, GitBranch, Map, List,
  TrendingUp, TrendingDown, Minus, ChevronRight, ChevronLeft, ChevronDown,
  Flame, Layers, Clock, Cloud, CloudRain, CloudSnow,
  CloudLightning, Sun, Wind, X, Navigation, UserCheck, Car, Sparkles, Phone,
  MapPin, ExternalLink, Building2,
} from 'lucide-react';

// ─── Color Config ──────────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  lead_received: '#f97316', quoted: '#fb923c',
  confirmed: '#3b82f6',    offered: '#3b82f6',
  assigned: '#eab308',     on_the_way: '#8b5cf6',
  in_progress: '#8b5cf6',  completed: '#22c55e',
  disputed: '#ef4444',     refunded: '#ef4444',
  cancelled: '#6b7280',    default: '#94a3b8',
};

const STATUS_LABELS: Record<string, string> = {
  lead_received: 'Lead', quoted: 'Quoted', confirmed: 'Confirmed',
  offered: 'Offered', assigned: 'Assigned', on_the_way: 'En Route',
  in_progress: 'In Progress', completed: 'Completed',
  disputed: 'Disputed', refunded: 'Refunded', cancelled: 'Cancelled',
};

const COVERAGE_COLORS: Record<string, string> = {
  high: '#22c55e', medium: '#eab308', low: '#ef4444', idle: '#475569',
};

const MAP_STYLES = {
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
};

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ZoneMetric {
  zone_id: string;
  name: string;
  city: string;
  total_jobs_today: number;
  active_jobs: number;
  completed_jobs: number;
  total_revenue: number;
  active_revenue: number;
  avg_ticket?: number;
  total_employees: number;
  online_employees: number;
  assigned_jobs: number;
  coverage_status: 'high' | 'medium' | 'low' | 'idle';
  in_house_employees: number;
  independent_employees: number;
  in_house_jobs_today: number;
  employee_jobs_today: number;
  dominance_mode: 'in_house' | 'employee' | 'mixed' | 'none';
  jobs_preview?: {
    id: string;
    job_number: string;
    service_type: string;
    status: string;
    address_line1: string;
    price: number;
  }[];
}

export type MapPreset = 'operations' | 'sales' | 'hybrid';

interface FilterState {
  status: string;
  shift: 'all' | 'morning' | 'afternoon' | 'night';
  search: string;
  showJobs: boolean;
  showEmployees: boolean;
  showHQs: boolean;
  showZones: boolean;
  showLines: boolean;
  showHeatmap: boolean;
  // Territory & Sales Layer Toggles
  showKnocks: boolean;
  showSalesHeatmap: boolean;
  showCommercialOpps: boolean;
}

interface MapData {
  jobs: any[];
  employeeLocations: any[];
  employeeHQs: any[];
  zoneMetrics: ZoneMetric[];
  assignmentLines: any[];
}

interface WeatherData {
  temperature: number;
  apparentTemperature: number;
  precipitation: number;
  humidity: number;
  windSpeed: number;
  condition: {
    label: string;
    icon: string;
    impact: 'normal' | 'caution' | 'severe';
    alertMessage?: string;
  };
}

interface Props {
  onBack?: () => void;
  initialPreset?: MapPreset;
}

// ─── Keyframes & Mapbox Overrides ──────────────────────────────────────────────
const STYLES_INJECTION = `
.mapboxgl-marker {
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  will-change: transform !important;
}
.mapboxgl-popup {
  z-index: 50 !important;
}
.mapboxgl-popup-content {
  background: #090d16 !important;
  color: #fff !important;
  border: 1px solid rgba(255,255,255,0.15) !important;
  border-radius: 8px !important;
  box-shadow: 0 10px 25px rgba(0,0,0,0.8) !important;
  padding: 0 !important;
}
.mapboxgl-popup-tip {
  border-top-color: #090d16 !important;
  border-bottom-color: #090d16 !important;
}
@keyframes sonarWave {
  0% { transform: scale(0.85); opacity: 0.8; }
  50% { transform: scale(1.6); opacity: 0.3; }
  100% { transform: scale(2.4); opacity: 0; }
}
@keyframes pulseGlow {
  0%, 100% { box-shadow: 0 0 8px rgba(34,197,94,0.6); }
  50% { box-shadow: 0 0 20px rgba(34,197,94,0.95); }
}
@keyframes alertPulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 6px #ef4444; }
  50% { transform: scale(1.15); box-shadow: 0 0 16px #ef4444; }
}
`;

// ─── Marker Factories (Properly Anchored for Mapbox) ───────────────────────────
function mkEmployeeMarker(cleaner: any) {
  const root = document.createElement('div');
  root.style.cssText = 'pointer-events:auto;cursor:pointer;display:flex;align-items:center;justify-content:center;';

  const container = document.createElement('div');
  container.style.cssText = 'position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center;';

  // Double concentric radar ripples for that alive command center feel
  const ring1 = document.createElement('div');
  ring1.style.cssText = 'position:absolute;inset:-6px;border-radius:50%;border:1.5px solid #22c55e;opacity:0.6;animation:sonarWave 2.4s cubic-bezier(0,0.2,0.8,1) infinite;pointer-events:none;';
  container.appendChild(ring1);

  const ring2 = document.createElement('div');
  ring2.style.cssText = 'position:absolute;inset:-6px;border-radius:50%;border:1px solid #10b981;opacity:0.35;animation:sonarWave 2.4s cubic-bezier(0,0.2,0.8,1) 1.2s infinite;pointer-events:none;';
  container.appendChild(ring2);

  const inner = document.createElement('div');
  inner.style.cssText = 'position:relative;z-index:2;width:28px;height:28px;background:#09090b;border:2.5px solid #22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(34,197,94,0.6);transition:transform .15s ease;font-size:12px;';
  inner.innerText = '👤';
  container.appendChild(inner);

  root.appendChild(container);
  root.addEventListener('mouseenter', () => { inner.style.transform = 'scale(1.25)'; });
  root.addEventListener('mouseleave', () => { inner.style.transform = 'scale(1)'; });
  return root;
}

function mkHQMarker() {
  const root = document.createElement('div');
  root.style.cssText = 'pointer-events:auto;cursor:pointer;display:flex;align-items:center;justify-content:center;';

  const inner = document.createElement('div');
  inner.style.cssText = 'width:30px;height:30px;background:#1e3a8a;border:2.5px solid rgba(255,255,255,.95);border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.7);transition:transform .15s ease;font-size:14px;';
  inner.innerText = '🏠';
  root.appendChild(inner);

  root.addEventListener('mouseenter', () => { inner.style.transform = 'scale(1.25)'; });
  root.addEventListener('mouseleave', () => { inner.style.transform = 'scale(1)'; });
  return root;
}

// ─── Weather Icon Helper ───────────────────────────────────────────────────────
function WeatherIcon({ icon, className = 'h-4 w-4' }: { icon: string; className?: string }) {
  switch (icon) {
    case 'sun': return <Sun className={`${className} text-amber-400`} />;
    case 'cloud-rain': return <CloudRain className={`${className} text-blue-400`} />;
    case 'cloud-snow': return <CloudSnow className={`${className} text-cyan-200`} />;
    case 'cloud-lightning': return <CloudLightning className={`${className} text-yellow-300`} />;
    case 'cloud-fog': return <Wind className={`${className} text-slate-300`} />;
    default: return <Cloud className={`${className} text-slate-300`} />;
  }
}

// ─── Quick Assign Slide-Over Drawer ────────────────────────────────────────────
function QuickAssignDrawer({
  job,
  onClose,
  onAssigned,
}: {
  job: any | null;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [assignedSuccess, setAssignedSuccess] = useState(false);

  useEffect(() => {
    if (!job) {
      setSuggestions([]);
      setError(null);
      setAssignedSuccess(false);
      return;
    }
    setLoading(true);
    setError(null);
    setAssignedSuccess(false);

    fetch(`/api/jobs/${job.id}/dispatch`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d?.suggestions)) {
          setSuggestions(d.suggestions);
        } else {
          setSuggestions([]);
        }
      })
      .catch(err => {
        console.error('Failed to load dispatch suggestions:', err);
        setError('Could not load cleaner suggestions.');
        setSuggestions([]);
      })
      .finally(() => setLoading(false));
  }, [job]);

  if (!job) return null;

  const handleDirectAssign = async (employeeId: string) => {
    setAssigningId(employeeId);
    try {
      const res = await fetch(`/api/jobs/${job.id}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'direct_assign',
          employee_id: employeeId,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to assign cleaner');
      }
      setAssignedSuccess(true);
      setTimeout(() => {
        onAssigned();
        onClose();
      }, 1400);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div className="absolute top-14 left-3 z-30 w-80 max-h-[calc(100vh-140px)] flex flex-col bg-black/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-200">
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-white/10 flex items-start justify-between bg-white/[0.03]">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">
              {job.job_number || 'JOB'}
            </span>
            <span
              className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full text-white"
              style={{ background: STATUS_COLORS[job.status] || '#64748b' }}
            >
              {STATUS_LABELS[job.status] || job.status}
            </span>
          </div>
          <h3 className="text-white font-black text-sm mt-1 truncate max-w-[210px]">
            {job.customer?.full_name || 'Client'}
          </h3>
          <p className="text-white/40 text-[11px] truncate">{job.address_line1}, {job.city}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Pricing & Window Strip */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-white/[0.02] border-b border-white/5 text-center">
        <div className="bg-white/5 rounded-lg p-1.5">
          <span className="text-white/40 text-[9px] uppercase font-bold block">Rate / Quote</span>
          <span className="text-emerald-400 font-black text-sm">
            ${(job.final_price || job.quoted_price || 0).toFixed(0)}
          </span>
        </div>
        <div className="bg-white/5 rounded-lg p-1.5">
          <span className="text-white/40 text-[9px] uppercase font-bold block">Window</span>
          <span className="text-white/80 font-bold text-xs truncate block">
            {job.scheduled_window || 'Standard'}
          </span>
        </div>
      </div>

      {/* Status Notice or Success */}
      {assignedSuccess ? (
        <div className="p-4 flex flex-col items-center justify-center gap-2 bg-emerald-500/15 text-center border-b border-emerald-500/30">
          <CheckCircle className="h-6 w-6 text-emerald-400 animate-bounce" />
          <p className="text-emerald-300 font-bold text-xs">Technician Assigned Successfully!</p>
          <p className="text-white/40 text-[10px]">Updating map telemetry...</p>
        </div>
      ) : null}

      {error ? (
        <div className="p-2.5 mx-3 mt-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Dispatch Suggestions List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-none">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase font-black tracking-widest text-white/40">
            Closest Available Crew
          </span>
          <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Smart Match
          </span>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-white/30 text-xs">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-400" />
            <span>Calculating optimal drive times...</span>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-6 text-center text-white/30 text-xs">
            No recommended cleaners currently online.
          </div>
        ) : (
          suggestions.slice(0, 5).map((sugg: any, idx: number) => {
            if (!sugg) return null;
            const empId = sugg.employee?.id || sugg.employee_id || sugg.id;
            if (!empId) return null;
            const empName = sugg.employee?.full_name || sugg.full_name || 'Staff Member';
            const empTier = sugg.employee?.tier || sugg.tier || (sugg.score ? `${Math.round(sugg.score)} Score` : 'Staff');
            const empPhone = sugg.employee?.phone || sugg.phone;
            const driveMin = sugg.drive_minutes ? Math.round(sugg.drive_minutes) : (sugg.drive_time_minutes ? Math.round(sugg.drive_time_minutes) : null);
            const isAssigning = assigningId === empId;

            return (
              <div
                key={empId || idx}
                className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all flex items-center justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white truncate">{empName}</span>
                    <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-white/10 text-white/60">
                      {empTier}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/40 mt-0.5">
                    {driveMin ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                        <Car className="h-2.5 w-2.5" /> ~{driveMin} min away
                      </span>
                    ) : (
                      <span>In Zone</span>
                    )}
                    {empPhone && (
                      <a href={`tel:${empPhone}`} className="hover:text-blue-400 flex items-center gap-0.5">
                        <Phone className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>

                <button
                  disabled={isAssigning || assignedSuccess}
                  onClick={() => handleDirectAssign(empId)}
                  className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 text-white text-[10px] font-black uppercase tracking-wider transition-colors flex items-center gap-1 shrink-0 shadow-md"
                >
                  {isAssigning ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <>
                      <Zap className="h-3 w-3" />
                      <span>Assign</span>
                    </>
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* External Details Link */}
      <div className="p-2.5 border-t border-white/10 bg-white/[0.02] text-center">
        <a
          href={`/sobadmin/jobs/${job.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center justify-center gap-1"
        >
          <span>Open Full Job Management</span>
          <ChevronRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

// ─── Quick Sale / Canvass Intelligence Slide-Over Drawer ───────────────────────
function QuickSaleDrawer({
  sale,
  onClose,
}: {
  sale: any | null;
  onClose: () => void;
}) {
  if (!sale) return null;
  const isSale = sale.status === 'SALE';
  const isCommercial = sale.kind === 'COMMERCIAL_OPP' || sale.mode === 'commercial';
  const price = sale.price || sale.deal_value || sale.expected_mrr;

  return (
    <div className="absolute top-14 left-3 z-30 w-84 max-h-[calc(100vh-140px)] flex flex-col bg-black/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-200">
      {/* Drawer Header */}
      <div className="p-3.5 border-b border-white/10 flex items-start justify-between bg-white/[0.03]">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                isSale
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : isCommercial
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
              }`}
            >
              {sale.status_label || (isSale ? 'Won Sale' : isCommercial ? 'Commercial Opp' : 'Canvass Knock')}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-white/70 font-semibold">
              Rep: {sale.rep_name || 'Teammate'}
            </span>
          </div>
          <h3 className="text-white font-black text-sm mt-1 truncate max-w-[220px]">
            {sale.homeowner_name || sale.company_name || sale.dm_name || sale.address || 'Field Property'}
          </h3>
          <p className="text-white/40 text-[11px] truncate">{sale.address}</p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Value & Status Strip */}
      <div className="grid grid-cols-2 gap-2 p-3 bg-white/[0.02] border-b border-white/5 text-center">
        <div className="bg-white/5 rounded-lg p-2">
          <span className="text-white/40 text-[9px] uppercase font-bold block">
            {isCommercial ? 'Expected MRR' : isSale ? 'Sale Value' : 'Outcome'}
          </span>
          <span className={`font-black text-sm ${price ? 'text-emerald-400' : 'text-white/60'}`}>
            {price ? `$${Number(price).toFixed(2)} CAD` : sale.status_label || 'Logged'}
          </span>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <span className="text-white/40 text-[9px] uppercase font-bold block">Status</span>
          <span
            className={`font-black text-xs uppercase px-2 py-0.5 rounded-md inline-block mt-0.5 ${
              sale.job_status === 'COMPLETED'
                ? 'bg-emerald-500/20 text-emerald-400'
                : sale.job_status === 'CANCELLED'
                ? 'bg-red-500/20 text-red-400'
                : 'bg-blue-500/20 text-blue-300'
            }`}
          >
            {sale.job_status || (isSale ? 'Completed' : 'Recorded')}
          </span>
        </div>
      </div>

      {/* Details list */}
      <div className="p-3 space-y-2.5 overflow-y-auto text-xs text-white/80">
        {sale.homeowner_name && (
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-white/40 font-medium">Homeowner</span>
            <span className="text-white font-bold">{sale.homeowner_name}</span>
          </div>
        )}
        {sale.company_name && (
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-white/40 font-medium">Company</span>
            <span className="text-white font-bold">{sale.company_name}</span>
          </div>
        )}
        {sale.dm_name && (
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-white/40 font-medium">Decision Maker</span>
            <span className="text-white font-bold">{sale.dm_name}</span>
          </div>
        )}
        {(sale.phone || sale.dm_phone) && (sale.phone !== '0' || sale.dm_phone) && (
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-white/40 font-medium">Phone</span>
            <a href={`tel:${sale.phone || sale.dm_phone}`} className="text-blue-400 font-bold hover:underline">
              {sale.phone || sale.dm_phone}
            </a>
          </div>
        )}
        {sale.service_date && (
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-white/40 font-medium">Service Date</span>
            <span className="text-emerald-300 font-bold">{sale.service_date}</span>
          </div>
        )}
        {sale.walkthrough_date && (
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-white/40 font-medium">Walkthrough Date</span>
            <span className="text-purple-300 font-bold">{sale.walkthrough_date}</span>
          </div>
        )}
        {sale.payment_method && (
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-white/40 font-medium">Payment Method</span>
            <span className="text-white/70">{sale.payment_method}</span>
          </div>
        )}
        {sale.timestamp && (
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-white/40 font-medium">Logged At</span>
            <span className="text-white/50 text-[11px]">
              {new Date(sale.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
        )}
        {sale.mode && (
          <div className="flex items-center justify-between py-1 border-b border-white/5">
            <span className="text-white/40 font-medium">Mode</span>
            <span className="text-white/70 uppercase text-[10px] font-bold">{sale.mode}</span>
          </div>
        )}
        {(sale.convo_status || sale.objection_type) && (
          <div className="p-2 rounded-lg bg-white/5 border border-white/5 text-[11px]">
            <span className="text-white/40 font-semibold block mb-0.5">Conversation Intel</span>
            <span className="text-blue-300 font-medium">
              {sale.convo_status} {sale.objection_type ? `· ${sale.objection_type}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 bg-white/[0.02] flex items-center gap-2">
        {(sale.phone || sale.dm_phone) && (sale.phone !== '0' || sale.dm_phone) && (
          <a
            href={`tel:${sale.phone || sale.dm_phone}`}
            className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs text-center transition-colors flex items-center justify-center gap-1.5"
          >
            <Phone className="h-3.5 w-3.5" />
            <span>Call Contact</span>
          </a>
        )}
        <button
          onClick={() => {
            navigator.clipboard.writeText(sale.address || '');
          }}
          className="flex-1 py-1.5 px-3 bg-white/10 hover:bg-white/15 text-white/80 font-bold rounded-lg text-xs text-center transition-colors"
        >
          Copy Address
        </button>
      </div>
    </div>
  );
}

// ─── Zone Sidebar ──────────────────────────────────────────────────────────────
function ZoneSidebar({
  zones,
  selectedZoneName,
  onSelectZone,
  onSelectJob,
  collapsed,
  onToggleCollapse,
}: {
  zones: ZoneMetric[];
  selectedZoneName: string | null;
  onSelectZone: (name: string) => void;
  onSelectJob?: (job: any) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const [showIdleZones, setShowIdleZones] = useState(false);
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);

  // Active zones (has jobs or online crew or alerts), ranked by revenue descending, then jobs descending
  const activeZones = useMemo(() => {
    return zones
      .filter(z => z.total_jobs_today > 0 || z.online_employees > 0 || z.coverage_status !== 'idle')
      .sort((a, b) => b.total_revenue - a.total_revenue || b.total_jobs_today - a.total_jobs_today);
  }, [zones]);

  // Standby zones (0 jobs today)
  const idleZones = useMemo(() => {
    return zones
      .filter(z => z.total_jobs_today === 0 && z.online_employees === 0 && z.coverage_status === 'idle')
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [zones]);

  const totalRevenue = zones.reduce((s, z) => s + z.total_revenue, 0);
  const totalJobs = zones.reduce((s, z) => s + z.total_jobs_today, 0);
  const lowCoverage = zones.filter(z => z.coverage_status === 'low' && z.active_jobs > 0).length;

  return (
    <div
      className="absolute top-0 right-0 z-20 h-full flex flex-col bg-black/95 backdrop-blur-2xl border-l border-white/10 transition-all duration-300 shadow-2xl"
      style={{ width: collapsed ? '44px' : '320px' }}
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggleCollapse}
        className="absolute -left-3.5 top-16 z-30 w-7 h-7 bg-black/90 border border-white/15 rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors shadow-md"
        title={collapsed ? 'Expand Zone Intel' : 'Collapse Sidebar'}
      >
        {collapsed ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
      </button>

      {collapsed ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 cursor-pointer" onClick={onToggleCollapse}>
          <span className="text-white/40 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
            Zone Intelligence
          </span>
          <div className="flex flex-col items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-mono text-white/40">{activeZones.length}z</span>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="px-3.5 py-3 border-b border-white/10 shrink-0 flex items-center justify-between bg-white/[0.02]">
            <div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-blue-400" />
                <p className="text-white font-black text-sm tracking-tight">Zone Intelligence</p>
              </div>
              <p className="text-white/40 text-[10px] mt-0.5">Live regional revenue & dispatch capacity</p>
            </div>
            <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </div>
          </div>

          {/* KPI Summary Banner */}
          <div className="grid grid-cols-3 border-b border-white/10 shrink-0 bg-white/[0.01]">
            {[
              { label: 'Tracked Rev', value: `$${totalRevenue.toFixed(0)}`, color: 'text-green-400' },
              { label: 'Total Jobs', value: totalJobs, color: 'text-blue-400' },
              { label: 'Alerts', value: lowCoverage, color: lowCoverage > 0 ? 'text-red-400' : 'text-slate-500' },
            ].map(s => (
              <div key={s.label} className="py-2.5 px-2 text-center border-r border-white/10 last:border-0">
                <p className={`font-black text-sm tracking-tight ${s.color}`}>{s.value}</p>
                <p className="text-white/35 text-[9px] uppercase font-bold tracking-wider mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Zone list container */}
          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
            {/* Section Header: Active Hubs */}
            <div className="px-3 py-2 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-white/50">
                Active Operations Hubs ({activeZones.length})
              </span>
              <span className="text-[9px] text-white/30">Ranked by Revenue</span>
            </div>

            {activeZones.length === 0 ? (
              <div className="p-6 text-center text-white/40 text-xs">
                No active jobs in the selected timeframe.
              </div>
            ) : (
              activeZones.map(zone => {
                const isSelected = selectedZoneName === zone.name;
                const isExpanded = expandedZoneId === zone.zone_id;
                const cc = COVERAGE_COLORS[zone.coverage_status];
                const CoverageIcon = zone.coverage_status === 'high' ? TrendingUp
                  : zone.coverage_status === 'low' ? TrendingDown
                  : zone.coverage_status === 'medium' ? Minus : Minus;

                return (
                  <div
                    key={zone.zone_id}
                    className={`border-b border-white/5 transition-all ${isSelected ? 'bg-blue-950/30 border-blue-500/30' : 'hover:bg-white/[0.03]'}`}
                  >
                    {/* Zone Header Button */}
                    <button
                      onClick={() => {
                        onSelectZone(zone.name);
                        setExpandedZoneId(prev => prev === zone.zone_id ? null : zone.zone_id);
                      }}
                      className="w-full text-left p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-white text-xs font-bold leading-tight truncate">{zone.name}</p>
                            {zone.city && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 text-white/40 font-mono">
                                {zone.city}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Coverage Status Badge */}
                        <div className="flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-white/5" style={{ color: cc }}>
                          <CoverageIcon className="h-2.5 w-2.5" />
                          <span className="text-[8px] font-black uppercase tracking-wider">{zone.coverage_status}</span>
                        </div>
                      </div>

                      {/* Key stats row */}
                      <div className="grid grid-cols-4 gap-1">
                        <div className="bg-white/5 rounded px-1.5 py-1 text-center">
                          <p className="text-xs font-black text-blue-400">{zone.total_jobs_today}</p>
                          <p className="text-white/30 text-[8px] uppercase font-bold">Jobs</p>
                        </div>
                        <div className="bg-white/5 rounded px-1.5 py-1 text-center">
                          <p className="text-xs font-black text-green-400">
                            ${zone.total_revenue >= 1000 ? (zone.total_revenue / 1000).toFixed(1) + 'k' : zone.total_revenue.toFixed(0)}
                          </p>
                          <p className="text-white/30 text-[8px] uppercase font-bold">Revenue</p>
                        </div>
                        <div className="bg-white/5 rounded px-1.5 py-1 text-center">
                          <p className="text-xs font-black text-purple-400">{zone.active_jobs}</p>
                          <p className="text-white/30 text-[8px] uppercase font-bold">En Route</p>
                        </div>
                        <div className="bg-white/5 rounded px-1.5 py-1 text-center">
                          <p className="text-xs font-black text-emerald-400">{zone.online_employees}</p>
                          <p className="text-white/30 text-[8px] uppercase font-bold">Online</p>
                        </div>
                      </div>

                      {/* Dominance indicator tag */}
                      {zone.dominance_mode !== 'none' && (
                        <div className="flex items-center justify-between pt-0.5">
                          {zone.dominance_mode === 'in_house' && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/25 text-[8px] font-bold text-blue-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                              <span>SOB In-House Team ({zone.in_house_employees})</span>
                            </div>
                          )}
                          {zone.dominance_mode === 'employee' && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/25 text-[8px] font-bold text-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <span>Contractor Network ({zone.independent_employees})</span>
                            </div>
                          )}
                          {zone.dominance_mode === 'mixed' && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/25 text-[8px] font-bold text-purple-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                              <span>Mixed Staff ({zone.in_house_employees} Staff / {zone.independent_employees} Cont)</span>
                            </div>
                          )}

                          <span className="text-[9px] text-white/30 flex items-center gap-0.5 font-bold">
                            {isExpanded ? 'Hide Intel' : 'View Jobs'}
                            <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </span>
                        </div>
                      )}

                      {zone.coverage_status === 'low' && zone.active_jobs > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/15 border border-red-500/30 text-red-300 text-[9px] font-medium">
                          <AlertTriangle className="h-2.5 w-2.5 text-red-400 shrink-0" />
                          <span>Dispatch Alert: {zone.active_jobs} jobs pending with {zone.online_employees} online technician{zone.online_employees === 1 ? '' : 's'}.</span>
                        </div>
                      )}
                    </button>

                    {/* Expanded Detail Tray with Real Job Previews */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 bg-black/40 border-t border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-[9px] text-white/40 pb-1">
                          <span>Avg Ticket: <strong className="text-white">${zone.avg_ticket || 0} CAD</strong></span>
                          <span>Assigned: <strong className="text-white">{zone.assigned_jobs}/{zone.total_jobs_today}</strong></span>
                        </div>

                        {zone.jobs_preview && zone.jobs_preview.length > 0 ? (
                          <div className="space-y-1.5">
                            <p className="text-[8px] font-black uppercase tracking-wider text-white/40">Zone Job Queue</p>
                            {zone.jobs_preview.map((pj) => {
                              const stColor = STATUS_COLORS[pj.status] || '#94a3b8';
                              return (
                                <div
                                  key={pj.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectJob) onSelectJob(pj);
                                  }}
                                  className="flex items-center justify-between p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 cursor-pointer transition-colors"
                                >
                                  <div className="min-w-0 flex-1 pr-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-blue-400">#{pj.job_number}</span>
                                      <span
                                        className="text-[8px] font-bold px-1.5 py-0.2 rounded uppercase"
                                        style={{ background: `${stColor}20`, color: stColor, border: `1px solid ${stColor}40` }}
                                      >
                                        {(pj.status || '').replace(/_/g, ' ')}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-white/70 truncate mt-0.5">{pj.address_line1 || 'Address'}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-xs font-black text-green-400">
                                      ${Number(pj.price || 0).toFixed(0)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-white/30 italic py-1">No active job preview records.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Section Header: Standby / Idle Zones */}
            {idleZones.length > 0 && (
              <div className="border-t border-white/10 mt-1">
                <button
                  onClick={() => setShowIdleZones(p => !p)}
                  className="w-full px-3 py-2 bg-white/[0.02] hover:bg-white/[0.05] flex items-center justify-between text-left transition-colors"
                >
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/40">
                    Standby Coverage Footprint ({idleZones.length})
                  </span>
                  <ChevronDown className={`h-3 w-3 text-white/40 transition-transform ${showIdleZones ? 'rotate-180' : ''}`} />
                </button>

                {showIdleZones && (
                  <div className="divide-y divide-white/5 bg-black/20">
                    {idleZones.map(iz => (
                      <button
                        key={iz.zone_id}
                        onClick={() => onSelectZone(iz.name)}
                        className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
                      >
                        <div>
                          <p className="text-white/70 text-xs font-medium">{iz.name}</p>
                          <p className="text-white/25 text-[9px]">{iz.city || 'GTA'}</p>
                        </div>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-white/30">
                          Standby
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="px-3 py-2.5 border-t border-white/10 shrink-0 space-y-1.5 bg-white/[0.01]">
            <p className="text-[9px] text-white/30 font-black uppercase tracking-widest">Coverage Health Indicator</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { color: COVERAGE_COLORS.high, label: 'High — Covered' },
                { color: COVERAGE_COLORS.medium, label: 'Med — Adequate' },
                { color: COVERAGE_COLORS.low, label: 'Low — Understaffed' },
                { color: COVERAGE_COLORS.idle, label: 'Idle — Standby' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2, flexShrink: 0 }} />
                  <span className="text-white/40 text-[9px] truncate">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function DispatchMap({ onBack, initialPreset = 'operations' }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const initialFrameDone = useRef(false);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hoverPopupRef = useRef<mapboxgl.Popup | null>(null);
  const locMarkersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const hqMarkersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const directionsCacheRef = useRef<{ [key: string]: number[][] }>({});

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapToken, setMapToken] = useState('');
  const [currentStyle, setCurrentStyle] = useState<'dark' | 'satellite'>('dark');
  const [mapData, setMapData] = useState<MapData>({
    jobs: [], employeeLocations: [], employeeHQs: [], zoneMetrics: [], assignmentLines: [],
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [selectedZoneName, setSelectedZoneName] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [selectedSale, setSelectedSale] = useState<any | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Preset State: 'operations' | 'sales' | 'hybrid'
  const [preset, setPreset] = useState<MapPreset>(initialPreset);
  const [salesSummary, setSalesSummary] = useState({ totalKnocks: 3982, totalSales: 141, totalOpps: 1 });
  const [salesFilter, setSalesFilter] = useState<'all' | 'SALE' | 'CONVO' | 'NO_ANSWER'>('all');

  // Weather telemetry
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Filter state initialized cleanly based on preset
  const isInitialSales = initialPreset === 'sales';
  const isInitialHybrid = initialPreset === 'hybrid';
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    shift: 'all',
    search: '',
    showJobs: !isInitialSales,
    showEmployees: !isInitialSales,
    showHQs: !isInitialSales,
    showZones: true,
    showLines: !isInitialSales,
    showHeatmap: false,
    showKnocks: isInitialSales || isInitialHybrid,
    showSalesHeatmap: false,
    showCommercialOpps: isInitialSales || isInitialHybrid,
  });

  const handleSetPreset = (newPreset: MapPreset) => {
    setPreset(newPreset);
    if (newPreset === 'sales') {
      setFilters(f => ({
        ...f,
        showJobs: false,
        showEmployees: false,
        showHQs: false,
        showLines: false,
        showHeatmap: false,
        showKnocks: true,
        showCommercialOpps: true,
        showSalesHeatmap: false,
        showZones: true,
      }));
    } else if (newPreset === 'operations') {
      setFilters(f => ({
        ...f,
        showJobs: true,
        showEmployees: true,
        showHQs: true,
        showLines: true,
        showHeatmap: false,
        showKnocks: false,
        showCommercialOpps: false,
        showSalesHeatmap: false,
        showZones: true,
      }));
    } else if (newPreset === 'hybrid') {
      setFilters(f => ({
        ...f,
        showJobs: true,
        showEmployees: true,
        showHQs: false,
        showLines: true,
        showHeatmap: false,
        showKnocks: true,
        showCommercialOpps: true,
        showSalesHeatmap: false,
        showZones: true,
      }));
    }
  };

  const supabase = createClient();
  const [selectedDate, setSelectedDate] = useState<string>('all');

  // ── Fetch Weather ────────────────────────────────────────────────────────────
  const fetchWeather = useCallback(async () => {
    try {
      const res = await fetch('/api/operations/weather?lat=43.6532&lng=-79.3832');
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const iv = setInterval(fetchWeather, 300000); // 5 mins
    return () => clearInterval(iv);
  }, [fetchWeather]);

  // ── Data Fetch ───────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/operations/map-data?date=${selectedDate}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setMapData(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Map data error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  useEffect(() => {
    const ch = supabase
      .channel('dispatch-map-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_locations' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData, supabase]);

  // ── Map token ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(cfg => {
      if (cfg.mapboxToken) setMapToken(cfg.mapboxToken);
    }).catch(() => {});
  }, []);

  // ── Fetch Sales Telemetry / Summary ──────────────────────────────────────────
  useEffect(() => {
    fetch('/api/operations/sales-geojson')
      .then(r => r.json())
      .then(data => {
        if (data?.summary) {
          setSalesSummary({
            totalKnocks: data.summary.total_knocks || 3982,
            totalSales: 141,
            totalOpps: data.summary.commercial_opps || 1,
          });
        }
      })
      .catch(() => {});
  }, []);

  // ── Register Sources and Layers ──────────────────────────────────────────────
  const setupLayers = useCallback((map: mapboxgl.Map) => {
    // 1. Zone polygons
    if (!map.getSource('zones-source')) {
      map.addSource('zones-source', { type: 'geojson', data: '/api/operations/zones-geojson' });
      map.addLayer({
        id: 'zones-fill', type: 'fill', source: 'zones-source',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.08 }
      });
      map.addLayer({
        id: 'zones-outline', type: 'line', source: 'zones-source',
        paint: { 'line-color': '#3b82f6', 'line-width': 1.8, 'line-opacity': 0.65 }
      });
      map.addLayer({
        id: 'zones-labels', type: 'symbol', source: 'zones-source',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-max-width': 10,
          'text-anchor': 'center'
        },
        paint: {
          'text-color': '#f8fafc',
          'text-halo-color': '#020617',
          'text-halo-width': 2.5
        },
      });

      // Double-click on zone polygon triggers Zone Focus & reveals activity dots
      map.on('dblclick', 'zones-fill', (e) => {
        e.preventDefault();
        const name = e.features?.[0]?.properties?.name;
        if (name) window.dispatchEvent(new CustomEvent('zone-map-dblclick', { detail: { name } }));
      });
      // Clicking empty canvas outside zones clears zone focus
      map.on('click', (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ['zones-fill', 'jobs-circle', 'sales-knocks-circle', 'commercial-opps-circle'] });
        if (!features.length) {
          window.dispatchEvent(new CustomEvent('zone-map-clear'));
        }
      });
      map.on('mouseenter', 'zones-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'zones-fill', () => { map.getCanvas().style.cursor = ''; });
    }

    // 2. Heatmap Layer
    if (!map.getSource('jobs-heatmap')) {
      map.addSource('jobs-heatmap', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'jobs-heat',
        type: 'heatmap',
        source: 'jobs-heatmap',
        maxzoom: 15,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 3],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(59,130,246,0.6)',
            0.4, 'rgba(6,182,212,0.8)',
            0.6, 'rgba(34,197,94,0.85)',
            0.8, 'rgba(234,179,8,0.9)',
            1, 'rgba(239,68,68,0.95)'
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 9, 24, 14, 40],
          'heatmap-opacity': 0.85,
        }
      });
    }

    // 3. Assignment Lines (Road Navigation Paths)
    if (!map.getSource('assignment-lines')) {
      map.addSource('assignment-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
      map.addLayer({
        id: 'assignment-lines-base',
        type: 'line',
        source: 'assignment-lines',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.8,
        },
      });
      map.addLayer({
        id: 'assignment-lines-flow',
        type: 'line',
        source: 'assignment-lines',
        paint: {
          'line-color': '#ffffff',
          'line-width': 1.5,
          'line-dasharray': [2, 4],
          'line-opacity': 0.9,
        },
      });
    }

    // 4. Jobs Hardware-Accelerated WebGL Layer (Rock-Solid Geographic Anchor)
    if (!map.getSource('jobs-source')) {
      map.addSource('jobs-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Outer glow for en-route and at-risk jobs
      map.addLayer({
        id: 'jobs-radar-glow',
        type: 'circle',
        source: 'jobs-source',
        filter: ['any', ['==', ['get', 'isAtRisk'], true], ['==', ['get', 'isEnRoute'], true]],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 8, 10, 13, 14, 18, 18, 24],
          'circle-color': [
            'case',
            ['==', ['get', 'isAtRisk'], true], '#ef4444',
            '#8b5cf6'
          ],
          'circle-opacity': 0.45,
          'circle-blur': 0.45,
        }
      });

      // Primary Job Circle Marker (Locked to GPS coords via WebGL)
      map.addLayer({
        id: 'jobs-circle',
        type: 'circle',
        source: 'jobs-source',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 4.5, 10, 7, 14, 9.5, 18, 14],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': [
            'case',
            ['==', ['get', 'isAtRisk'], true], 2.5,
            1.5
          ],
          'circle-stroke-color': [
            'case',
            ['==', ['get', 'isAtRisk'], true], '#fca5a5',
            '#ffffff'
          ],
          'circle-opacity': 0.98,
        }
      });

      // Job number labels at closer zoom
      map.addLayer({
        id: 'jobs-labels',
        type: 'symbol',
        source: 'jobs-source',
        minzoom: 13.5,
        layout: {
          'text-field': ['get', 'job_number'],
          'text-size': 10,
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
        },
        paint: {
          'text-color': '#f8fafc',
          'text-halo-color': '#020617',
          'text-halo-width': 2,
        }
      });

      // Hover popup logic for jobs
      map.on('mouseenter', 'jobs-circle', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const feat = e.features?.[0];
        if (!feat) return;
        const p = feat.properties as any;
        const coordinates = (feat.geometry as any).coordinates.slice();

        const popupHtml = `
          <div style="font-family:system-ui,sans-serif;padding:6px;min-width:210px;background:#090d16;color:#fff;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:11px;font-weight:800;color:#60a5fa;letter-spacing:0.5px;">#${p.job_number}</span>
              <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:${p.color}25;border:1px solid ${p.color}60;color:${p.color};text-transform:uppercase;">${p.status_label}</span>
            </div>
            <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#f8fafc;line-height:1.2;">${p.address_line1 || 'Address'}</p>
            <p style="font-size:10px;color:#94a3b8;margin:0 0 6px;">${p.city || ''} ${p.postal_code || ''}</p>
            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;margin-top:4px;">
              <span style="font-size:12px;font-weight:800;color:#22c55e;">$${Number(p.price).toFixed(2)} CAD</span>
              <span style="font-size:10px;color:#cbd5e1;font-weight:600;">${p.customer_name || 'Customer'}</span>
            </div>
            ${p.employee_name ? `<p style="font-size:10px;color:#38bdf8;margin:6px 0 0;font-weight:600;">👤 Assigned: ${p.employee_name}</p>` : '<p style="font-size:9px;color:#f59e0b;margin:4px 0 0;font-weight:700;">⚠ Unassigned</p>'}
          </div>
        `;

        if (!hoverPopupRef.current) {
          hoverPopupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: false, maxWidth: '280px' });
        }
        hoverPopupRef.current
          .setLngLat(coordinates as [number, number])
          .setHTML(popupHtml)
          .addTo(map);
      });

      map.on('mouseleave', 'jobs-circle', () => {
        map.getCanvas().style.cursor = '';
        if (hoverPopupRef.current) hoverPopupRef.current.remove();
      });

      map.on('click', 'jobs-circle', (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const id = feat.properties?.id;
        window.dispatchEvent(new CustomEvent('job-map-select', { detail: { id } }));
      });
    }

    // 5. Sales Knocks & Canvassing Layer (Vector WebGL points for 3,982+ knocks)
    if (!map.getSource('sales-knocks-source')) {
      map.addSource('sales-knocks-source', {
        type: 'geojson',
        data: '/api/operations/sales-geojson',
      });

      // Canvassing Heatmap
      map.addLayer({
        id: 'sales-heat',
        type: 'heatmap',
        source: 'sales-knocks-source',
        maxzoom: 15,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'weight'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 12, 2.5],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.2, 'rgba(99,102,241,0.5)',
            0.4, 'rgba(59,130,246,0.7)',
            0.6, 'rgba(16,185,129,0.85)',
            0.8, 'rgba(245,158,11,0.9)',
            1, 'rgba(239,68,68,0.95)'
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 4, 9, 20, 14, 35],
          'heatmap-opacity': 0.8,
        },
      });

      // Sales Knock Points (Color-coded outcome pins)
      map.addLayer({
        id: 'sales-knocks-circle',
        type: 'circle',
        source: 'sales-knocks-source',
        filter: ['==', ['get', 'kind'], 'KNOCK'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 3.5, 11, 5, 14, 7.5, 17, 12],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95,
        },
      });

      // Commercial Opportunities (Distinct glowing circle / marker)
      map.addLayer({
        id: 'commercial-opps-circle',
        type: 'circle',
        source: 'sales-knocks-source',
        filter: ['==', ['get', 'kind'], 'COMMERCIAL_OPP'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5.5, 11, 8.5, 14, 12.5, 17, 16],
          'circle-color': '#c084fc',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 1,
        },
      });

      // Hover popup logic for sales knocks
      map.on('mouseenter', 'sales-knocks-circle', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const feat = e.features?.[0];
        if (!feat) return;
        const p = feat.properties as any;
        const coordinates = (feat.geometry as any).coordinates.slice();

        const popupHtml = `
          <div style="font-family:system-ui,sans-serif;padding:8px;min-width:220px;background:#090d16;color:#fff;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:${p.color}25;border:1px solid ${p.color}60;color:${p.color};text-transform:uppercase;">${p.status_label || p.status}</span>
              <span style="font-size:10px;color:#94a3b8;font-weight:600;">Rep: ${p.rep_name || 'Teammate'}</span>
            </div>
            <p style="font-weight:800;font-size:13px;margin:2px 0 2px;color:#f8fafc;line-height:1.2;">${p.address || 'Knocked Property'}</p>
            ${p.homeowner_name ? `<p style="font-size:11px;color:#cbd5e1;margin:1px 0 4px;font-weight:600;">👤 ${p.homeowner_name}</p>` : ''}
            
            ${p.price ? `
              <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;margin-top:4px;">
                <span style="font-size:13px;font-weight:900;color:#22c55e;">$${Number(p.price).toFixed(2)} CAD</span>
                <span style="font-size:9px;font-weight:800;padding:1px 5px;border-radius:3px;background:${p.job_status === 'COMPLETED' ? '#22c55e20' : '#ef444420'};color:${p.job_status === 'COMPLETED' ? '#4ade80' : '#f87171'};text-transform:uppercase;">${p.job_status || 'WON'}</span>
              </div>
            ` : ''}

            ${p.convo_status ? `<p style="font-size:10px;color:#38bdf8;margin:4px 0 0;">${p.convo_status} ${p.objection_type ? '· ' + p.objection_type : ''}</p>` : ''}
            <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:4px;margin-top:6px;font-size:9px;color:#64748b;display:flex;justify-content:space-between;align-items:center;">
              <span>${p.service_date ? 'Service: ' + p.service_date : (p.timestamp ? new Date(p.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '')}</span>
              <span style="color:#38bdf8;font-weight:700;">Inspect ↗</span>
            </div>
          </div>
        `;

        if (!hoverPopupRef.current) {
          hoverPopupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: false, maxWidth: '280px' });
        }
        hoverPopupRef.current.setLngLat(coordinates as [number, number]).setHTML(popupHtml).addTo(map);
      });

      map.on('mouseleave', 'sales-knocks-circle', () => {
        map.getCanvas().style.cursor = '';
        if (hoverPopupRef.current) hoverPopupRef.current.remove();
      });

      map.on('click', 'sales-knocks-circle', (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const p = feat.properties as any;
        window.dispatchEvent(new CustomEvent('sale-map-select', { detail: { data: p } }));
      });

      map.on('mouseenter', 'commercial-opps-circle', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const feat = e.features?.[0];
        if (!feat) return;
        const p = feat.properties as any;
        const coordinates = (feat.geometry as any).coordinates.slice();

        const popupHtml = `
          <div style="font-family:system-ui,sans-serif;padding:8px;min-width:230px;background:#090d16;color:#fff;border-radius:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:9px;font-weight:800;padding:2px 6px;border-radius:4px;background:#a855f725;border:1px solid #a855f760;color:#c084fc;text-transform:uppercase;">COMMERCIAL B2B</span>
              <span style="font-size:10px;font-weight:700;color:#22c55e;">${p.expected_mrr ? '$' + Number(p.expected_mrr) + '/mo' : 'Lead'}</span>
            </div>
            <p style="font-weight:800;font-size:14px;margin:2px 0 2px;color:#f8fafc;line-height:1.2;">${p.company_name || 'Plaza / Storefront'}</p>
            <p style="font-size:10px;color:#94a3b8;margin:0 0 4px;">${p.address || ''}</p>
            ${p.dm_name ? `<p style="font-size:10px;color:#cbd5e1;margin:2px 0 0;">👤 Contact: <strong style="color:#fff;">${p.dm_name}</strong> ${p.dm_phone ? '(' + p.dm_phone + ')' : ''}</p>` : ''}
            ${p.walkthrough_date ? `<p style="font-size:10px;color:#38bdf8;margin:2px 0 0;">📅 Walkthrough: ${p.walkthrough_date}</p>` : ''}
            <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:4px;margin-top:6px;font-size:9px;color:#64748b;display:flex;justify-content:space-between;align-items:center;">
              <span>B2B Pipeline</span>
              <span style="color:#a855f7;font-weight:700;">Inspect ↗</span>
            </div>
          </div>
        `;

        if (!hoverPopupRef.current) {
          hoverPopupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: false, maxWidth: '280px' });
        }
        hoverPopupRef.current.setLngLat(coordinates as [number, number]).setHTML(popupHtml).addTo(map);
      });

      map.on('mouseleave', 'commercial-opps-circle', () => {
        map.getCanvas().style.cursor = '';
        if (hoverPopupRef.current) hoverPopupRef.current.remove();
      });

      map.on('click', 'commercial-opps-circle', (e) => {
        const feat = e.features?.[0];
        if (!feat) return;
        const p = feat.properties as any;
        window.dispatchEvent(new CustomEvent('sale-map-select', { detail: { data: p } }));
      });
    }
  }, []);

  // ── Map Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !mapToken) return;
    mapboxgl.accessToken = mapToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[currentStyle],
      center: [-79.3832, 43.6532],
      zoom: 9.5,
      doubleClickZoom: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new mapboxgl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    mapRef.current = map;

    map.on('load', () => {
      setupLayers(map);
      map.resize();
      setMapLoaded(true);
    });

    map.on('style.load', () => {
      setupLayers(map);
      map.resize();
    });

    resizeObserverRef.current = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    if (mapContainerRef.current) {
      resizeObserverRef.current.observe(mapContainerRef.current);
    }

    return () => {
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, [mapToken, setupLayers]);

  // ── Style switcher ───────────────────────────────────────────────────────────
  const handleToggleStyle = () => {
    const map = mapRef.current;
    if (!map) return;
    const nextStyle = currentStyle === 'dark' ? 'satellite' : 'dark';
    setCurrentStyle(nextStyle);
    map.setStyle(MAP_STYLES[nextStyle]);
  };

  // ── Fly to zone when selected ────────────────────────────────────────────────
  const handleSelectZone = useCallback((name: string) => {
    setSelectedZoneName(prev => prev === name ? null : name);
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const features = map.querySourceFeatures('zones-source', { filter: ['==', ['get', 'name'], name] });
    if (features.length > 0) {
      const coords: number[][] = [];
      const collectCoords = (geom: any) => {
        if (geom.type === 'Polygon') geom.coordinates[0].forEach((c: number[]) => coords.push(c));
        else if (geom.type === 'MultiPolygon') geom.coordinates.forEach((p: number[][][]) => p[0].forEach((c: number[]) => coords.push(c)));
      };
      features.forEach(f => collectCoords(f.geometry));
      if (coords.length > 0) {
        const bounds = coords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new mapboxgl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number])
        );
        map.fitBounds(bounds, { padding: { top: 70, bottom: 90, left: 50, right: sidebarCollapsed ? 60 : 300 }, maxZoom: 13, duration: 800 });
      }
    }
  }, [mapLoaded, sidebarCollapsed]);

  // ── Zone map double-click & clear handlers ──────────────────────────────────
  useEffect(() => {
    const handleDblClick = (e: Event) => {
      const name = (e as CustomEvent).detail?.name;
      if (name) handleSelectZone(name);
    };
    const handleClear = () => {
      setSelectedZoneName(null);
      setSelectedJob(null);
      setSelectedSale(null);
    };
    window.addEventListener('zone-map-dblclick', handleDblClick);
    window.addEventListener('zone-map-clear', handleClear);
    return () => {
      window.removeEventListener('zone-map-dblclick', handleDblClick);
      window.removeEventListener('zone-map-clear', handleClear);
    };
  }, [handleSelectZone]);

  // Escape key deselects zone focus and closes slide-over drawers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedZoneName(null);
        setSelectedJob(null);
        setSelectedSale(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── Highlight Zone Outline on Selection ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (map.getLayer('zones-outline') && map.getLayer('zones-fill')) {
      if (selectedZoneName) {
        map.setPaintProperty('zones-outline', 'line-color', [
          'case',
          ['==', ['get', 'name'], selectedZoneName],
          '#38bdf8', // electric cyan glow for active zone
          '#1e3a8a', // dim dark navy for other zones
        ]);
        map.setPaintProperty('zones-outline', 'line-width', [
          'case',
          ['==', ['get', 'name'], selectedZoneName],
          4, // thick glowing boundary
          1,
        ]);
        map.setPaintProperty('zones-outline', 'line-opacity', [
          'case',
          ['==', ['get', 'name'], selectedZoneName],
          1.0,
          0.18, // dim other zones
        ]);
        map.setPaintProperty('zones-fill', 'fill-opacity', [
          'case',
          ['==', ['get', 'name'], selectedZoneName],
          0.26, // illuminated active zone
          0.02, // dim other zones
        ]);
      } else {
        map.setPaintProperty('zones-outline', 'line-color', '#3b82f6');
        map.setPaintProperty('zones-outline', 'line-width', 1.8);
        map.setPaintProperty('zones-outline', 'line-opacity', 0.65);
        map.setPaintProperty('zones-fill', 'fill-opacity', 0.08);
      }
    }
  }, [selectedZoneName, mapLoaded]);

  // ── Shift Matcher ────────────────────────────────────────────────────────────
  const matchesShift = useCallback((job: any, shift: string) => {
    if (shift === 'all') return true;
    const win = (job.scheduled_window || '').toLowerCase();
    if (shift === 'morning') return win.includes('morning') || win.includes('am') || /0?[789]|1[01]/.test(win);
    if (shift === 'afternoon') return win.includes('afternoon') || win.includes('pm') || /1[23456]/.test(win);
    if (shift === 'night') return win.includes('evening') || win.includes('night') || /1[789]|2[0123]/.test(win);
    return true;
  }, []);

  // ── Filtered Datasets ────────────────────────────────────────────────────────
  const filteredJobs = useMemo(() => {
    return mapData.jobs.filter(job => {
      if (filters.status !== 'all' && job.status !== filters.status) return false;
      if (!matchesShift(job, filters.shift)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        return job.address_line1?.toLowerCase().includes(q) ||
          job.customer?.full_name?.toLowerCase().includes(q) ||
          job.job_number?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [mapData.jobs, filters, matchesShift]);

  const filteredEmployees = useMemo(() => {
    return mapData.employeeLocations.filter(loc =>
      !filters.search || loc.employee?.full_name?.toLowerCase().includes(filters.search.toLowerCase())
    );
  }, [mapData.employeeLocations, filters.search]);

  // ── Active Zone Jobs (Only populated when a zone is double-clicked / selected) ─
  const activeZoneJobs = useMemo(() => {
    if (!selectedZoneName) return [];
    const selectedZone = mapData.zoneMetrics.find(z => z.name === selectedZoneName);
    const selectedZoneId = selectedZone?.zone_id;
    return filteredJobs.filter(j => {
      if (selectedZoneId && j.zone_id === selectedZoneId) return true;
      if (selectedZone && j.city?.toLowerCase() === selectedZone.city?.toLowerCase()) return true;
      return false;
    });
  }, [filteredJobs, selectedZoneName, mapData.zoneMetrics]);

  // ── Update Heatmap Source (Only active for focused zone) ─────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('jobs-heatmap') as mapboxgl.GeoJSONSource;
    if (!src) return;

    if (map.getLayer('jobs-heat')) {
      map.setLayoutProperty('jobs-heat', 'visibility', filters.showHeatmap && selectedZoneName ? 'visible' : 'none');
    }

    if (!filters.showHeatmap || !selectedZoneName) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const features = activeZoneJobs
      .filter(j => j.latitude && j.longitude)
      .map(j => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [j.longitude, j.latitude] },
        properties: { weight: j.status === 'on_the_way' || j.status === 'in_progress' ? 1 : 0.6 },
      }));

    src.setData({ type: 'FeatureCollection', features });
  }, [mapLoaded, activeZoneJobs, filters.showHeatmap, selectedZoneName]);

  // ── Sync Jobs to Mapbox WebGL GeoJSON Layer (Revealed ONLY on Zone Focus) ────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('jobs-source') as mapboxgl.GeoJSONSource;
    if (!src) return;

    // Do NOT display any dots until a zone is selected / double-clicked
    if (!filters.showJobs || !selectedZoneName) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const features = activeZoneJobs
      .filter(j => j.latitude && j.longitude)
      .map(j => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [j.longitude, j.latitude]
        },
        properties: {
          id: j.id,
          job_number: j.job_number || 'JOB',
          status: j.status || 'default',
          color: STATUS_COLORS[j.status] || '#94a3b8',
          status_label: STATUS_LABELS[j.status] || j.status || 'Job',
          address_line1: j.address_line1 || '',
          city: j.city || '',
          postal_code: j.postal_code || '',
          customer_name: j.customer?.full_name || '',
          price: Number(j.final_price) || Number(j.quoted_price) || 0,
          employee_name: j.employee?.full_name || '',
          isAtRisk: j.status === 'confirmed' && !j.employee,
          isEnRoute: j.status === 'on_the_way',
        }
      }));

    src.setData({ type: 'FeatureCollection', features });
  }, [mapLoaded, activeZoneJobs, filters.showJobs, selectedZoneName]);

  // ── Listen for Job & Sale Click from Mapbox WebGL Layer ───────────────────
  useEffect(() => {
    const handleJobSelect = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      const job = mapData.jobs.find(j => j.id === id);
      if (job) {
        setSelectedSale(null);
        setSelectedJob(job);
      }
    };
    const handleSaleSelect = (e: Event) => {
      const data = (e as CustomEvent).detail?.data;
      if (data) {
        setSelectedJob(null);
        setSelectedSale(data);
      }
    };
    window.addEventListener('job-map-select', handleJobSelect);
    window.addEventListener('sale-map-select', handleSaleSelect);
    return () => {
      window.removeEventListener('job-map-select', handleJobSelect);
      window.removeEventListener('sale-map-select', handleSaleSelect);
    };
  }, [mapData.jobs]);

  // ── Sync Sales Layers Visibility & Filters ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (map.getLayer('sales-knocks-circle')) {
      const vis = filters.showKnocks ? 'visible' : 'none';
      map.setLayoutProperty('sales-knocks-circle', 'visibility', vis);

      if (salesFilter !== 'all') {
        map.setFilter('sales-knocks-circle', [
          'all',
          ['==', ['get', 'kind'], 'KNOCK'],
          ['==', ['get', 'status'], salesFilter],
        ]);
      } else {
        map.setFilter('sales-knocks-circle', ['==', ['get', 'kind'], 'KNOCK']);
      }
    }

    if (map.getLayer('commercial-opps-circle')) {
      const vis = filters.showCommercialOpps ? 'visible' : 'none';
      map.setLayoutProperty('commercial-opps-circle', 'visibility', vis);
    }

    if (map.getLayer('sales-heat')) {
      const vis = filters.showSalesHeatmap ? 'visible' : 'none';
      map.setLayoutProperty('sales-heat', 'visibility', vis);
    }
  }, [mapLoaded, filters.showKnocks, filters.showCommercialOpps, filters.showSalesHeatmap, salesFilter]);

  // ── Road Routing via Directions API ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('assignment-lines') as mapboxgl.GeoJSONSource;
    if (!src) return;

    const vis = filters.showLines ? 'visible' : 'none';
    if (map.getLayer('assignment-lines-base')) map.setLayoutProperty('assignment-lines-base', 'visibility', vis);
    if (map.getLayer('assignment-lines-flow')) map.setLayoutProperty('assignment-lines-flow', 'visibility', vis);

    if (!filters.showLines || !selectedZoneName || mapData.assignmentLines.length === 0) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    let isMounted = true;

    async function buildRoutes() {
      const features: any[] = [];

      for (const line of mapData.assignmentLines) {
        const cacheKey = `${line.from[0]},${line.from[1]}_${line.to[0]},${line.to[1]}`;
        let coords = directionsCacheRef.current[cacheKey];

        if (!coords) {
          try {
            const res = await fetch(
              `/api/operations/directions?start_lng=${line.from[0]}&start_lat=${line.from[1]}&end_lng=${line.to[0]}&end_lat=${line.to[1]}`
            );
            if (res.ok) {
              const d = await res.json();
              if (d.routes?.[0]?.geometry?.coordinates) {
                coords = d.routes[0].geometry.coordinates;
                directionsCacheRef.current[cacheKey] = coords;
              }
            }
          } catch {
            // fallback to straight line
          }
        }

        features.push({
          type: 'Feature',
          properties: { color: line.job_status === 'on_the_way' ? '#8b5cf6' : '#eab308' },
          geometry: {
            type: 'LineString',
            coordinates: coords || [line.from, line.to],
          },
        });
      }

      if (isMounted && mapRef.current?.getSource('assignment-lines')) {
        src.setData({ type: 'FeatureCollection', features });
      }
    }

    buildRoutes();

    return () => { isMounted = false; };
  }, [mapLoaded, mapData.assignmentLines, filters.showLines]);

  // ── Choropleth ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !mapData.zoneMetrics.length || !map.getLayer('zones-fill')) return;
    const matchExpr: any[] = ['match', ['get', 'zone_id']];
    const seen = new Set();
    mapData.zoneMetrics.forEach(zm => {
      if (!seen.has(zm.zone_id)) {
        seen.add(zm.zone_id);
        matchExpr.push(zm.zone_id, COVERAGE_COLORS[zm.coverage_status]);
      }
    });
    matchExpr.push('#3b82f6');
    map.setPaintProperty('zones-fill', 'fill-color', matchExpr as any);
    map.setPaintProperty('zones-fill', 'fill-opacity', 0.12);
    map.setPaintProperty('zones-outline', 'line-color', matchExpr as any);
  }, [mapLoaded, mapData.zoneMetrics]);

  // ── Live Technician & HQ Base Station Markers ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const { employeeHQs } = mapData;

    // Employees (Live GPS Units) - only show when zone is focused
    if (!filters.showEmployees || !selectedZoneName) {
      Object.keys(locMarkersRef.current).forEach(id => {
        locMarkersRef.current[id].remove();
        delete locMarkersRef.current[id];
      });
    } else {
      const selectedZone = mapData.zoneMetrics.find(z => z.name === selectedZoneName);
      const zoneEmployees = (filteredEmployees || []).filter((loc: any) => {
        if (!selectedZone) return true;
        return loc.employee?.zone_id === selectedZone.zone_id || !loc.employee?.zone_id;
      });
      const locIds = new Set(zoneEmployees.map((l: any) => l?.id).filter(Boolean));
      Object.keys(locMarkersRef.current).forEach(id => {
        if (!locIds.has(id)) {
          locMarkersRef.current[id].remove();
          delete locMarkersRef.current[id];
        }
      });

      zoneEmployees.forEach((loc: any) => {
        if (!loc || !loc.id || !loc.longitude || !loc.latitude) return;
        const c = loc.employee;
        const popupHtml = `<div style="font-family:system-ui,sans-serif;padding:6px;min-width:200px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <div style="width:7px;height:7px;background:#22c55e;border-radius:50%;box-shadow:0 0 6px #22c55e;"></div>
            <span style="font-size:10px;color:#22c55e;font-weight:800;">LIVE TELEMETRY</span>
          </div>
          <p style="font-weight:800;font-size:13px;margin:0 0 2px;color:#fff;">${c?.full_name ?? 'Technician'}</p>
          <p style="font-size:10px;color:#94a3b8;margin:0 0 6px;text-transform:capitalize;">${c?.tier ?? 'Pro'} Tier</p>
          ${c?.phone ? `<p style="font-size:10px;color:#cbd5e1;margin:0 0 6px;">📞 <a href="tel:${c.phone}" style="color:#60a5fa">${c.phone}</a></p>` : ''}
          <a href="/sobadmin/employees/${c?.id}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#60a5fa;text-decoration:none;font-weight:700;">View Profile ↗</a>
        </div>`;

        if (!locMarkersRef.current[loc.id]) {
          locMarkersRef.current[loc.id] = new mapboxgl.Marker({ element: mkEmployeeMarker(c) })
            .setLngLat([loc.longitude, loc.latitude])
            .setPopup(new mapboxgl.Popup({ offset: 18, closeButton: true, maxWidth: '240px' }).setHTML(popupHtml))
            .addTo(map);
        } else {
          locMarkersRef.current[loc.id].setLngLat([loc.longitude, loc.latitude]);
        }
      });
    }

    // HQs (Base Stations) - only show when zone is focused
    if (!filters.showHQs || !selectedZoneName) {
      Object.keys(hqMarkersRef.current).forEach(id => {
        hqMarkersRef.current[id].remove();
        delete hqMarkersRef.current[id];
      });
    } else {
      const selectedZone = mapData.zoneMetrics.find(z => z.name === selectedZoneName);
      const zoneHQs = (employeeHQs || []).filter((h: any) => {
        if (!selectedZone) return true;
        return h.zone_id === selectedZone.zone_id;
      });
      const hqIds = new Set(zoneHQs.map((h: any) => h?.id).filter(Boolean));
      Object.keys(hqMarkersRef.current).forEach(id => {
        if (!hqIds.has(id)) {
          hqMarkersRef.current[id].remove();
          delete hqMarkersRef.current[id];
        }
      });

      zoneHQs.forEach((hq: any) => {
        if (!hq || !hq.id || !hq.longitude || !hq.latitude) return;
        const popupHtml = `<div style="font-family:system-ui,sans-serif;padding:6px;min-width:200px;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <div style="width:7px;height:7px;background:#1d4ed8;border-radius:2px;"></div>
            <span style="font-size:10px;color:#93c5fd;font-weight:800;">BASE STATION</span>
          </div>
          <p style="font-weight:800;font-size:13px;margin:0 0 6px;color:#fff;">${hq.full_name || 'Base Station'}</p>
          <a href="/sobadmin/employees/${hq.id}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#60a5fa;text-decoration:none;font-weight:700;">View Profile ↗</a>
        </div>`;

        if (!hqMarkersRef.current[hq.id]) {
          hqMarkersRef.current[hq.id] = new mapboxgl.Marker({ element: mkHQMarker() })
            .setLngLat([hq.longitude, hq.latitude])
            .setPopup(new mapboxgl.Popup({ offset: 18, closeButton: true, maxWidth: '240px' }).setHTML(popupHtml))
            .addTo(map);
        } else {
          hqMarkersRef.current[hq.id].setLngLat([hq.longitude, hq.latitude]);
        }
      });
    }

    // Auto-frame initial
    if (!initialFrameDone.current && filteredJobs.length > 0) {
      const allCoords: [number, number][] = [
        ...(filteredJobs || []).filter((j: any) => j && j.longitude && j.latitude).map((j: any) => [j.longitude, j.latitude] as [number, number]),
        ...(filteredEmployees || []).filter((l: any) => l && l.longitude && l.latitude).map((l: any) => [l.longitude, l.latitude] as [number, number]),
      ];
      if (allCoords.length >= 2) {
        const bounds = allCoords.reduce((b, c) => b.extend(c), new mapboxgl.LngLatBounds(allCoords[0], allCoords[0]));
        map.fitBounds(bounds, { padding: { top: 80, bottom: 100, left: 50, right: sidebarCollapsed ? 60 : 300 }, maxZoom: 14, duration: 800 });
        initialFrameDone.current = true;
      }
    }
  }, [mapLoaded, filteredJobs, filteredEmployees, mapData.employeeHQs, filters.showEmployees, filters.showHQs, sidebarCollapsed]);

  // ── Derived Metrics ──────────────────────────────────────────────────────────
  const metrics = {
    jobsToday: filteredJobs.length,
    revenueToday: filteredJobs.reduce((s, j) => s + (Number(j.final_price) || Number(j.quoted_price) || 0), 0),
    employeesOnline: mapData.employeeLocations.length,
    active: filteredJobs.filter(j => ['on_the_way', 'in_progress'].includes(j.status)).length,
    completed: filteredJobs.filter(j => j.status === 'completed').length,
    issues: filteredJobs.filter(j => ['disputed', 'refunded'].includes(j.status)).length,
  };

  const statusGroups = [
    { key: 'all', label: 'All', color: '#94a3b8' },
    { key: 'confirmed', label: 'Confirmed', color: STATUS_COLORS.confirmed },
    { key: 'on_the_way', label: 'En Route', color: STATUS_COLORS.on_the_way },
    { key: 'in_progress', label: 'In Progress', color: STATUS_COLORS.in_progress },
    { key: 'completed', label: 'Done', color: STATUS_COLORS.completed },
    { key: 'disputed', label: 'Issues', color: STATUS_COLORS.disputed },
  ];

  const shiftGroups = [
    { key: 'all' as const, label: 'All Shifts' },
    { key: 'morning' as const, label: 'Morning (7a-12p)' },
    { key: 'afternoon' as const, label: 'Afternoon (12p-5p)' },
    { key: 'night' as const, label: 'Night (5p-12a)' },
  ];

  const currentLayerToggles = useMemo(() => {
    if (preset === 'sales') {
      return [
        { key: 'showKnocks' as const, label: 'Knocks', icon: MapPin },
        { key: 'showCommercialOpps' as const, label: 'Plazas', icon: Building2 },
        { key: 'showSalesHeatmap' as const, label: 'Canvass Heat', icon: Flame },
        { key: 'showZones' as const, label: 'Zones', icon: Map },
      ];
    }
    if (preset === 'hybrid') {
      return [
        { key: 'showJobs' as const, label: 'Jobs', icon: Briefcase },
        { key: 'showEmployees' as const, label: 'Live', icon: Radio },
        { key: 'showKnocks' as const, label: 'Knocks', icon: MapPin },
        { key: 'showCommercialOpps' as const, label: 'Plazas', icon: Building2 },
        { key: 'showLines' as const, label: 'Routes', icon: GitBranch },
        { key: 'showZones' as const, label: 'Zones', icon: Map },
      ];
    }
    return [
      { key: 'showJobs' as const, label: 'Jobs', icon: Briefcase },
      { key: 'showEmployees' as const, label: 'Live', icon: Radio },
      { key: 'showHQs' as const, label: 'HQs', icon: Home },
      { key: 'showLines' as const, label: 'Routes', icon: GitBranch },
      { key: 'showHeatmap' as const, label: 'Heatmap', icon: Flame },
      { key: 'showZones' as const, label: 'Zones', icon: Map },
    ];
  }, [preset]);

  const sidebarWidth = sidebarCollapsed ? 44 : 320;

  return (
    <div className="relative w-full h-[calc(100vh-64px)] bg-black overflow-hidden font-sans select-none">
      <style>{STYLES_INJECTION}</style>

      {/* Map canvas */}
      <div
        ref={mapContainerRef}
        className="absolute top-0 left-0 bottom-0 transition-all duration-300"
        style={{ right: `${sidebarWidth}px` }}
      />

      {/* ── Top Unified Command HUD (Structured 2-Row Clean Layout) ───────────── */}
      <div
        className="absolute top-0 left-0 z-20 flex flex-col gap-2 p-2.5 bg-black/95 backdrop-blur-2xl border-b border-white/10 transition-all duration-300 shadow-xl"
        style={{ right: `${sidebarWidth}px` }}
      >
        {/* Row 1: Nav, Presets, Scope, Weather Pill, Layer Controls */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Dashboard Back */}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/8 hover:bg-white/15 border border-white/10 rounded-lg text-white/80 hover:text-white text-[11px] font-bold transition-all shrink-0 shadow-sm"
            >
              <List className="h-3.5 w-3.5 text-blue-400" />
              <span>Back</span>
            </button>

            <div className="w-px h-5 bg-white/10 shrink-0" />

            {/* Preset Mode Switcher */}
            <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => handleSetPreset('operations')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  preset === 'operations'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Briefcase className="h-3 w-3" />
                <span>Operations</span>
              </button>
              <button
                onClick={() => handleSetPreset('sales')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  preset === 'sales'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <MapPin className="h-3 w-3" />
                <span>Sales Territory</span>
              </button>
              <button
                onClick={() => handleSetPreset('hybrid')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                  preset === 'hybrid'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Layers className="h-3 w-3" />
                <span>Hybrid</span>
              </button>
            </div>

            <div className="w-px h-5 bg-white/10 shrink-0" />

            {/* Date Scope Controls (Operations / Hybrid) or Sales Mode Chip (Sales) */}
            {preset !== 'sales' ? (
              <>
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5 shrink-0">
                  <button
                    onClick={() => setSelectedDate('all')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                      selectedDate === 'all'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    All Footprint ({mapData.jobs.length})
                  </button>
                  <button
                    onClick={() => {
                      if (selectedDate === 'all') {
                        setSelectedDate(new Date().toISOString().split('T')[0]);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                      selectedDate !== 'all'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    By Date
                  </button>
                </div>

                {selectedDate !== 'all' && (
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-white/6 border border-white/10 rounded-lg text-xs text-white px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500/50 [color-scheme:dark]"
                  />
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-emerald-300 text-[10px] font-bold shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Residential & Commercial B2B Field Intel</span>
                <span className="text-white/30 hidden md:inline">· 3,794 Pins</span>
              </div>
            )}

            {/* Weather Telemetry Pill (Integrated directly into HUD, no overlaps) */}
            {weather && (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white shrink-0">
                <WeatherIcon icon={weather.condition.icon} className="h-3.5 w-3.5 shrink-0" />
                <span className="font-bold text-xs">{weather.temperature}°C</span>
                <span className="text-white/40 text-[10px] hidden sm:inline">· {weather.condition.label}</span>
                <span className="text-white/30 text-[9px] hidden md:inline">Wind {weather.windSpeed} km/h</span>
                {weather.condition.impact !== 'normal' && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold flex items-center gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" /> Delay Caution
                  </span>
                )}
              </div>
            )}

            {/* Zone Focus Status Chip */}
            {selectedZoneName ? (
              <div className="flex items-center gap-2 px-2.5 py-1 bg-blue-500/20 border border-blue-400/40 rounded-lg text-xs text-blue-200 font-bold shrink-0 shadow-md animate-in fade-in zoom-in-95 duration-150">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping shrink-0" />
                <span>Zone: <strong className="text-white font-extrabold">{selectedZoneName}</strong> ({activeZoneJobs.length} active)</span>
                <button
                  onClick={() => setSelectedZoneName(null)}
                  className="ml-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white text-[9px] font-black uppercase transition-colors flex items-center gap-1"
                  title="Exit zone focus (Esc)"
                >
                  <X className="h-3 w-3" />
                  <span>Exit</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-white/40 text-[10px] font-medium shrink-0">
                <Sparkles className="h-3 w-3 text-blue-400/80 shrink-0" />
                <span className="hidden sm:inline">Double-click any zone to highlight & reveal activity</span>
                <span className="sm:hidden">Double-click zone</span>
              </div>
            )}
          </div>

          {/* Right Tools: Layers, Sat/Dark, Refresh */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Dynamic Layer & Mode Toggles */}
            <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 shrink-0">
              {currentLayerToggles.map(lt => (
                <button
                  key={lt.key}
                  onClick={() => setFilters(f => ({ ...f, [lt.key]: !f[lt.key] }))}
                  title={lt.label}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                    filters[lt.key]
                      ? (lt.key === 'showHeatmap' || lt.key === 'showSalesHeatmap'
                          ? 'bg-orange-600 text-white'
                          : lt.key === 'showCommercialOpps'
                          ? 'bg-purple-600 text-white'
                          : lt.key === 'showKnocks'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-blue-600/85 text-white')
                      : 'text-white/35 hover:text-white/60'
                  }`}
                >
                  <lt.icon className="h-3 w-3" />
                  <span className="hidden lg:inline">{lt.label}</span>
                </button>
              ))}
            </div>

            {/* Dark / Satellite Switcher */}
            <button
              onClick={handleToggleStyle}
              className="flex items-center gap-1 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white text-[10px] font-bold transition-colors shrink-0"
              title="Toggle Satellite Imagery"
            >
              <Layers className="h-3 w-3" />
              <span className="uppercase">{currentStyle === 'dark' ? 'Sat' : 'Dark'}</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => { setLoading(true); fetchData(); fetchWeather(); }}
              className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/40 hover:text-white transition-colors shrink-0"
              title="Refresh All Telemetry"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Preset-Aware Filters & Controls */}
        {preset === 'sales' ? (
          <div className="flex items-center gap-2 flex-wrap w-full">
            {/* Rep Scope Indicator */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-xs text-white/70 shrink-0">
              <Users className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[11px] font-semibold text-white/50">Field Reps:</span>
              <span className="text-[11px] font-bold text-white">Malik · Ayaan · Raahim</span>
            </div>

            {/* Sales Outcome Filters */}
            <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg px-1.5 py-0.5 shrink-0 overflow-x-auto">
              <span className="text-[9px] font-black uppercase text-white/35 mr-1 tracking-wider">Filter:</span>
              {[
                { key: 'all' as const, label: `All Knocks (${salesSummary.totalKnocks})`, color: '#64748b' },
                { key: 'SALE' as const, label: 'Won Sales (141)', color: '#10b981' },
                { key: 'CONVO' as const, label: 'Convos & Leads', color: '#3b82f6' },
                { key: 'NO_ANSWER' as const, label: 'No Answer', color: '#64748b' },
              ].map(sg => (
                <button
                  key={sg.key}
                  onClick={() => setSalesFilter(sg.key)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all ${
                    salesFilter === sg.key ? 'text-white shadow-sm' : 'text-white/30 hover:text-white/60'
                  }`}
                  style={salesFilter === sg.key ? { background: sg.color } : {}}
                >
                  {sg.label}
                </button>
              ))}
            </div>

            {/* Commercial Plazas Quick Toggle */}
            <button
              onClick={() => setFilters(f => ({ ...f, showCommercialOpps: !f.showCommercialOpps }))}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                filters.showCommercialOpps
                  ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 shadow-sm'
                  : 'bg-white/5 text-white/40 border-white/10 hover:text-white/70'
              }`}
            >
              <Building2 className="h-3 w-3 text-purple-400" />
              <span>Commercial Plazas ({salesSummary.totalOpps})</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="relative min-w-[160px] flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/35 pointer-events-none" />
              <input
                type="text"
                placeholder="Search jobs, customers, crew, addresses..."
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full pl-8 pr-3 py-1 bg-white/6 border border-white/10 rounded-lg text-xs text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg px-1 py-0.5 shrink-0 overflow-x-auto">
              {statusGroups.map(sg => (
                <button
                  key={sg.key}
                  onClick={() => setFilters(f => ({ ...f, status: sg.key }))}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-all ${filters.status === sg.key ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
                  style={filters.status === sg.key ? { background: sg.color } : {}}
                >
                  {sg.label}
                </button>
              ))}
            </div>

            {/* Shift Time Scrubber */}
            <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-lg p-0.5 shrink-0">
              <Clock className="h-3 w-3 text-white/35 ml-1 mr-0.5" />
              {shiftGroups.map(sg => (
                <button
                  key={sg.key}
                  onClick={() => setFilters(f => ({ ...f, shift: sg.key }))}
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all ${filters.shift === sg.key ? 'bg-blue-600 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                >
                  {sg.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Quick Assign Slide-Over Drawer ───────────────────────────────────── */}
      <QuickAssignDrawer
        job={selectedJob}
        onClose={() => setSelectedJob(null)}
        onAssigned={() => {
          fetchData();
        }}
      />

      {/* ── Quick Sale / Canvass Intelligence Slide-Over Drawer ──────────────── */}
      <QuickSaleDrawer
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
      />

      {/* ── Bottom Metrics Strip & Telemetry Ticker ──────────────────────────── */}
      <div
        className="absolute bottom-8 left-3 z-20 flex items-center gap-2 overflow-x-auto scrollbar-none transition-all duration-300"
        style={{ right: `${sidebarWidth + 12}px` }}
      >
        {preset === 'sales' ? (
          [
            { label: 'Total Knocks', value: salesSummary.totalKnocks.toLocaleString(), icon: MapPin, color: 'text-blue-400' },
            { label: 'Residential Won', value: `${salesSummary.totalSales} Homes`, icon: DollarSign, color: 'text-emerald-400' },
            { label: 'Commercial B2B', value: `${salesSummary.totalOpps} Plazas`, icon: Building2, color: 'text-purple-400' },
            { label: 'Active Reps', value: '3 Reps', icon: Users, color: 'text-amber-400' },
            { label: 'Coverage Grid', value: '3,794 Pins', icon: Map, color: 'text-cyan-400' },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-2 bg-black/85 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shrink-0 shadow-lg">
              <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
              <div>
                <p className="text-white font-black text-sm leading-none">{m.value}</p>
                <p className="text-white/35 text-[9px] font-bold uppercase tracking-wider mt-0.5">{m.label}</p>
              </div>
            </div>
          ))
        ) : preset === 'hybrid' ? (
          [
            { label: 'Jobs Today', value: metrics.jobsToday, icon: Briefcase, color: 'text-blue-400' },
            { label: 'Ops Revenue', value: `$${metrics.revenueToday.toFixed(0)}`, icon: DollarSign, color: 'text-green-400' },
            { label: 'Live Units', value: metrics.employeesOnline, icon: Radio, color: 'text-emerald-400' },
            { label: 'Total Knocks', value: salesSummary.totalKnocks.toLocaleString(), icon: MapPin, color: 'text-blue-400' },
            { label: 'Sales Won', value: `${salesSummary.totalSales} Homes`, icon: CheckCircle, color: 'text-emerald-400' },
            { label: 'B2B Plazas', value: salesSummary.totalOpps, icon: Building2, color: 'text-purple-400' },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-2 bg-black/85 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shrink-0 shadow-lg">
              <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
              <div>
                <p className="text-white font-black text-sm leading-none">{m.value}</p>
                <p className="text-white/35 text-[9px] font-bold uppercase tracking-wider mt-0.5">{m.label}</p>
              </div>
            </div>
          ))
        ) : (
          [
            { label: 'Jobs Today', value: metrics.jobsToday, icon: Briefcase, color: 'text-blue-400' },
            { label: 'Revenue', value: `$${metrics.revenueToday.toFixed(0)}`, icon: DollarSign, color: 'text-green-400' },
            { label: 'Live Units', value: metrics.employeesOnline, icon: Radio, color: 'text-emerald-400' },
            { label: 'En Route', value: metrics.active, icon: Zap, color: 'text-purple-400' },
            { label: 'Completed', value: metrics.completed, icon: CheckCircle, color: 'text-green-400' },
            { label: 'Issues', value: metrics.issues, icon: AlertTriangle, color: 'text-red-400' },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-2 bg-black/85 backdrop-blur-xl border border-white/10 rounded-xl px-3 py-2 shrink-0 shadow-lg">
              <m.icon className={`h-3.5 w-3.5 ${m.color}`} />
              <div>
                <p className="text-white font-black text-sm leading-none">{m.value}</p>
                <p className="text-white/35 text-[9px] font-bold uppercase tracking-wider mt-0.5">{m.label}</p>
              </div>
            </div>
          ))
        )}

        {/* Ambient Telemetry Ticker */}
        <div className="hidden lg:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white/50 shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <span>
            {preset === 'sales'
              ? `Sales Territory: ${salesSummary.totalKnocks.toLocaleString()} logged properties across GTA (Malik, Ayaan, Raahim)`
              : preset === 'hybrid'
              ? `Unified Operations: ${mapData.jobs.length} jobs & ${salesSummary.totalKnocks.toLocaleString()} knocks synchronized`
              : `Grid active: ${mapData.jobs.length} total operations tracked across GTA`}
          </span>
        </div>
      </div>

      {/* Telemetry Timestamp */}
      <div className="absolute bottom-2 left-3 z-20 text-white/25 text-[10px] flex items-center gap-2">
        <span>Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        <span>•</span>
        <span>Auto-sync 30s</span>
        <span>•</span>
        <span className="text-emerald-400/70">GPS Telemetry Online</span>
      </div>

      {/* ── Zone Intelligence Sidebar ────────────────────────────────────────── */}
      <ZoneSidebar
        zones={mapData.zoneMetrics}
        selectedZoneName={selectedZoneName}
        onSelectZone={handleSelectZone}
        onSelectJob={setSelectedJob}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(p => !p)}
      />
    </div>
  );
}
