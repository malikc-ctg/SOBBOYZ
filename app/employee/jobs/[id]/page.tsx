'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, MapPin, Navigation, Clock, Timer,
  CheckCircle2, User, Sparkles, Bath, BedDouble,
  Phone, Map, AlertTriangle, Route, Zap, Car, MessageSquare, PlusCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { SERVICE_TYPE_LABELS, TIME_WINDOW_LABELS } from '@/types';
import { formatJobTimeSlot } from '@/lib/time-utils';
import type { Job, ChecklistData, JobOffer } from '@/types';
import Link from 'next/link';

import { PhotoUpload } from '@/components/employee/PhotoUpload';
import { SupplyCheck } from '@/components/employee/SupplyCheck';
import { smartFetch } from '@/lib/offline-queue';

function RoomChecklist({ title, items, onItemChange, jobId, existingPhotos = [] }: { title: string, items: Record<string, boolean>, onItemChange: (key: string, checked: boolean) => void, jobId: string, existingPhotos?: any[] }) {
  const hasBefore = existingPhotos.some(p => p.photo_type === 'before' && (!p.room || p.room.toLowerCase() === title.toLowerCase()));
  const hasAfter = existingPhotos.some(p => p.photo_type === 'after' && (!p.room || p.room.toLowerCase() === title.toLowerCase()));

  const [beforeDone, setBeforeDone] = useState(hasBefore);
  const [afterDone, setAfterDone] = useState(hasAfter);

  useEffect(() => {
    if (hasBefore) setBeforeDone(true);
    if (hasAfter) setAfterDone(true);
  }, [hasBefore, hasAfter]);
  
  const allChecked = Object.values(items).every(v => v === true);

  return (
    <Card className="overflow-hidden border-slate-200">
      <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
        <CardTitle className="text-base font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 space-y-0">
        
        {/* Step 1: Before Photo */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${beforeDone ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
            <span className={`text-sm font-semibold ${beforeDone ? 'text-green-700' : 'text-slate-700'}`}>Before Photo</span>
          </div>
          {!beforeDone ? (
            <PhotoUpload category="before" jobId={jobId} room={title} title={`${title} Before`} subtitle="Take a photo before starting" maxPhotos={1} onUploadComplete={() => setBeforeDone(true)} />
          ) : (
            <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4"/> Photo saved</p>
          )}
        </div>

        {/* Step 2: Checklist */}
        <div className={`p-4 border-b border-slate-100 transition-opacity ${!beforeDone ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${allChecked ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
            <span className={`text-sm font-semibold ${allChecked ? 'text-green-700' : 'text-slate-700'}`}>Tasks</span>
          </div>
          <div className="space-y-3">
            {Object.entries(items).map(([key, val]) => (
              <label key={key} className="flex items-center gap-3 py-1 cursor-pointer">
                <Checkbox checked={val} onCheckedChange={(c) => onItemChange(key, !!c)} />
                <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Step 3: After Photo */}
        <div className={`p-4 transition-opacity ${!allChecked ? 'opacity-50 pointer-events-none' : ''}`}>
           <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${afterDone ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
            <span className={`text-sm font-semibold ${afterDone ? 'text-green-700' : 'text-slate-700'}`}>After Photo</span>
          </div>
          {!afterDone ? (
            <PhotoUpload category="after" jobId={jobId} room={title} title={`${title} After`} subtitle="Take a photo when finished" maxPhotos={1} onUploadComplete={() => setAfterDone(true)} />
          ) : (
            <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-4 w-4"/> Photo saved</p>
          )}
        </div>

      </CardContent>
    </Card>
  );
}

// Lazy-load map to avoid SSR issues
const EmployeeJobMap = dynamic(() => import('@/components/employee/EmployeeJobMap'), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-56 rounded-2xl" />,
});

function buildChecklist(bedrooms: number, bathrooms: number, addOns: string[]): ChecklistData {
  return {
    kitchen: { counters: false, sink: false, stovetop: false, exterior_appliances: false, cabinet_fronts: false, floor: false, microwave_exterior: false },
    bathrooms: Array.from({ length: bathrooms }, () => ({ toilet: false, sink: false, shower_tub: false, mirror: false, counter: false, floor: false, garbage: false })),
    bedrooms: Array.from({ length: bedrooms }, () => ({ dust_surfaces: false, vacuum_mop: false, light_tidy: false })),
    living_areas: { dusting: false, floors: false, surfaces: false, garbage: false },
    add_ons: {
      ...(addOns.includes('inside_fridge') ? { inside_fridge: false } : {}),
      ...(addOns.includes('inside_oven') ? { inside_oven: false } : {}),
      ...(addOns.includes('inside_cabinets') ? { inside_cabinets: false } : {}),
      ...(addOns.includes('baseboards') ? { baseboards: false } : {}),
      ...(addOns.includes('interior_windows') ? { interior_windows: false } : {}),
    },
    employee_notes: '',
    scope_changes_noted: '',
    completed_at: '',
  };
}

const STATUS_STEPS = ['assigned', 'on_the_way', 'in_progress', 'completed'];
const STATUS_STEP_LABELS: Record<string, string> = {
  assigned: 'Accepted',
  on_the_way: 'En Route',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export default function EmployeeJobDetailPage() {
  const params = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [pendingOffer, setPendingOffer] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<ChecklistData | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [supplyConfirmed, setSupplyConfirmed] = useState(false);
  const [showSupplyCheck, setShowSupplyCheck] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [extraChargeAmount, setExtraChargeAmount] = useState('');
  const [extraChargeDesc, setExtraChargeDesc] = useState('');

  async function fetchData() {
    try {
      const res = await fetch(`/api/jobs/${params.id}`);
      const data = await res.json();
      if (data && !data.error) {
        setJob(data);
        if (!checklist) {
          setChecklist(buildChecklist(data.home_bedrooms ?? 2, data.home_bathrooms ?? 1, data.add_ons ?? []));
        }
        if (data.status === 'offered') {
          const offersRes = await fetch('/api/offers');
          const offersData = await offersRes.json();
          const myOffer = (offersData || []).find((o: JobOffer) => o.job_id === params.id);
          setPendingOffer(myOffer || null);
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchData(); }, [params.id]);

  async function handleStatusUpdate(newStatus: string) {
    setSubmitting(true);
    try {
      if (newStatus === 'completed' && checklist) {
        const checkRes = await smartFetch(`/api/jobs/${params.id}/checklist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checklist),
        });
        if (!checkRes.ok) throw new Error('Failed to save checklist');
      }

      const res = await smartFetch(`/api/jobs/${params.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed');

      toast.success('Status updated');
      fetchData();
    } catch { toast.error('Failed to update status'); }
    finally { setSubmitting(false); }
  }

  async function handleOfferResponse(action: 'accept' | 'decline') {
    if (!pendingOffer) return;
    setSubmitting(true);
    try {
      const res = await smartFetch(`/api/offers/${pendingOffer.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const error = await res.json();
        if (res.status === 422) toast.error('This job is no longer available');
        else throw new Error(error.error || 'Failed to respond');
      } else {
        toast.success(action === 'accept' ? 'Job accepted!' : 'Offer declined');
      }
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  }

  async function handleAddCharge() {
    if (!extraChargeAmount || !extraChargeDesc) return;
    setSubmitting(true);
    try {
      const res = await smartFetch(`/api/jobs/${params.id}/charges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: extraChargeAmount, description: extraChargeDesc }),
      });
      if (!res.ok) throw new Error('Failed to add charge');
      toast.success('Extra charge added to invoice');
      setExtraChargeAmount('');
      setExtraChargeDesc('');
      fetchData();
    } catch {
      toast.error('Failed to add extra charge');
    } finally {
      setSubmitting(false);
    }
  }

  function countChecked(): { checked: number; total: number } {
    if (!checklist) return { checked: 0, total: 0 };
    let checked = 0, total = 0;
    Object.values(checklist.kitchen).forEach(v => { if (typeof v === 'boolean') { total++; if (v) checked++; } });
    checklist.bathrooms.forEach(b => Object.values(b).forEach(v => { if (typeof v === 'boolean') { total++; if (v) checked++; } }));
    checklist.bedrooms.forEach(b => Object.values(b).forEach(v => { if (typeof v === 'boolean') { total++; if (v) checked++; } }));
    Object.values(checklist.living_areas).forEach(v => { if (typeof v === 'boolean') { total++; if (v) checked++; } });
    Object.values(checklist.add_ons).forEach(v => { if (typeof v === 'boolean') { total++; if (v) checked++; } });
    return { checked, total };
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!job) return <p className="text-red-500 p-4">Job not found</p>;

  const { checked, total } = countChecked();
  const progress = total > 0 ? (checked / total) * 100 : 0;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${job.address_line1}, ${job.city} ${job.postal_code}`)}`;
  const appleMapsUrl = `http://maps.apple.com/?daddr=${encodeURIComponent(`${job.address_line1}, ${job.city} ${job.postal_code}`)}&dirflg=d`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(`${job.address_line1}, ${job.city} ${job.postal_code}`)}&navigate=yes`;

  const stepStatus = job.status === 'accepted' ? 'assigned' : job.status;
  const currentStepIndex = STATUS_STEPS.indexOf(stepStatus);
  const isActive = ['accepted', 'assigned', 'on_the_way', 'in_progress'].includes(job.status);

  const customerProfile = (() => {
    try {
      return JSON.parse((job as any).customer?.notes || '{}');
    } catch {
      return {};
    }
  })();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/employee"><Button variant="ghost" size="sm" className="h-10 w-10 p-0"><ArrowLeft className="h-5 w-5" /></Button></Link>
        <div>
          <h1 className="font-bold">{SERVICE_TYPE_LABELS[job.service_type]}</h1>
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Progress Stepper */}
      {isActive && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-3">Job Progress</p>
          <div className="flex items-center gap-0">
            {STATUS_STEPS.map((step, idx) => {
              const done = idx < currentStepIndex;
              const active = idx === currentStepIndex;
              return (
                <div key={step} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition-all ${
                      done ? 'bg-green-500 border-green-500 text-white' :
                      active ? 'bg-blue-600 border-blue-600 text-white animate-pulse' :
                      'bg-muted border-border text-muted-foreground'
                    }`}>
                      {done ? '✓' : idx + 1}
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-tight whitespace-nowrap ${active ? 'text-blue-600' : done ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {STATUS_STEP_LABELS[step]}
                    </span>
                  </div>
                  {idx < STATUS_STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 rounded-full mb-4 transition-all ${done ? 'bg-green-500' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Offer Action Banner */}
      {job.status === 'offered' && pendingOffer && (
        <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 text-white overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="text-center">
              <p className="font-bold text-amber-100 text-sm">🔔 New Job Offer</p>
              <p className="text-4xl font-black mt-1">
                {job.estimated_duration_minutes
                  ? `${Math.floor(job.estimated_duration_minutes / 60)}h ${job.estimated_duration_minutes % 60 ? `${job.estimated_duration_minutes % 60}m` : ''}`.trim()
                  : 'Approx 2-3 hrs'}
              </p>
              <p className="text-xs text-amber-100 uppercase font-bold tracking-tighter mt-0.5">Approx Hours Required</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm bg-black/10 rounded-xl p-3">
              <div><p className="text-amber-200 text-[10px] font-bold uppercase">Service</p><p className="font-semibold text-sm">{SERVICE_TYPE_LABELS[job.service_type]}</p></div>
              <div><p className="text-amber-200 text-[10px] font-bold uppercase">Time Slot</p><p className="font-semibold text-sm">{formatJobTimeSlot(job)}</p></div>
              <div><p className="text-amber-200 text-[10px] font-bold uppercase">Location</p><p className="font-semibold text-sm">{job.city}, {job.postal_code}</p></div>
              {job.estimated_duration_minutes && (
                <div><p className="text-amber-200 text-[10px] font-bold uppercase">Duration</p><p className="font-semibold text-sm flex items-center gap-1"><Timer className="h-3 w-3" />{Math.floor(job.estimated_duration_minutes / 60)}h {job.estimated_duration_minutes % 60}m</p></div>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleOfferResponse('accept')} className="flex-1 h-12 bg-white text-amber-800 hover:bg-amber-50 font-bold" disabled={submitting}>
                {submitting ? 'Accepting...' : '✓ Accept Job'}
              </Button>
              <Button onClick={() => handleOfferResponse('decline')} variant="outline" className="flex-1 h-12 border-white/30 text-white hover:bg-white/10" disabled={submitting}>
                Decline
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Route Map */}
      {job.latitude && job.longitude && (
        <div className="space-y-2">
          <button
            onClick={() => setShowMap(!showMap)}
            className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Map className="h-3.5 w-3.5" />
            {showMap ? 'Hide Map' : 'Show Route Map'}
          </button>
          {showMap && (
            <EmployeeJobMap
              jobLat={job.latitude}
              jobLng={job.longitude}
              jobAddress={`${job.address_line1}, ${job.city}`}
            />
          )}
        </div>
      )}

      {/* Navigation Buttons (visible when assigned/on the way) */}
      {['assigned', 'on_the_way', 'in_progress'].includes(job.status) && (
        <div className="bg-card border border-border rounded-2xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-2.5">Navigate To Job</p>
          <div className="grid grid-cols-3 gap-2">
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full h-10 text-xs font-bold flex items-center gap-1.5">
                <span>📍</span> Google
              </Button>
            </a>
            <a href={appleMapsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full h-10 text-xs font-bold flex items-center gap-1.5">
                <span>🗺️</span> Apple
              </Button>
            </a>
            <a href={wazeUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full h-10 text-xs font-bold flex items-center gap-1.5">
                <span>🚗</span> Waze
              </Button>
            </a>
          </div>
        </div>
      )}

      {/* Home Profile Alerts */}
      {(customerProfile.has_pets || customerProfile.entry_instructions) && ['assigned', 'accepted', 'on_the_way', 'in_progress'].includes(job.status) && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-orange-900">
            <p className="font-bold">Customer Home Profile Alerts</p>
            <ul className="list-disc pl-4 space-y-1">
              {customerProfile.has_pets && (
                <li><strong>Pets in home:</strong> Please be mindful of animals when opening doors.</li>
              )}
              {customerProfile.entry_instructions && (
                <li><strong>Entry Instructions:</strong> {customerProfile.entry_instructions}</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Job Details Card */}
      <Card className="border-blue-200 dark:border-blue-800 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-100" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">Job Details</span>
        </div>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 dark:bg-blue-900/30 rounded-full p-2"><User className="h-4 w-4 text-blue-600 dark:text-blue-400" /></div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Customer</p>
                <p className="font-semibold text-sm">{(job as any).customer?.full_name ?? 'N/A'}</p>
              </div>
            </div>
            {/* Show phone only if job is in progress or beyond */}
            {['in_progress', 'on_the_way'].includes(job.status) && (job as any).customer?.phone && (
              <div className="flex gap-2">
                <a href={`sms:${(job as any).customer.phone}`}>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/30">
                    <MessageSquare className="h-3.5 w-3.5" /> SMS
                  </Button>
                </a>
                <a href={`tel:${(job as any).customer.phone}`}>
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs text-green-600 border-green-200 hover:bg-green-50 dark:border-green-800 dark:hover:bg-green-900/30">
                    <Phone className="h-3.5 w-3.5" /> Call
                  </Button>
                </a>
              </div>
            )}
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-start gap-3">
            <div className="bg-green-50 dark:bg-green-900/30 rounded-full p-2 mt-0.5"><MapPin className="h-4 w-4 text-green-600 dark:text-green-400" /></div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Address</p>
              {/* Show exact address only after acceptance */}
              {['assigned', 'accepted', 'on_the_way', 'in_progress', 'completed', 'reviewed', 'paid_out'].includes(job.status) ? (
                <>
                  <p className="font-semibold text-sm">{job.address_line1}</p>
                  {job.address_line2 && <p className="text-xs text-muted-foreground">{job.address_line2}</p>}
                  <p className="text-xs text-muted-foreground">{job.city}, {job.postal_code}</p>
                </>
              ) : (
                <p className="text-sm font-medium text-muted-foreground">{job.city}, {job.postal_code} (Accept to reveal exact address)</p>
              )}
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><Clock className="h-3 w-3" /> Time Slot</p><p className="text-sm font-medium">{formatJobTimeSlot(job)}</p></div>
            {job.home_bedrooms != null && <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><BedDouble className="h-3 w-3" /> Beds</p><p className="text-sm font-medium">{job.home_bedrooms}</p></div>}
            {job.home_bathrooms != null && <div className="space-y-1"><p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1"><Bath className="h-3 w-3" /> Baths</p><p className="text-sm font-medium">{job.home_bathrooms}</p></div>}
          </div>

          {/* Scope checklist preview */}
          <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-3">
            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Cleaning Scope</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Kitchen</span>
              {job.home_bathrooms != null && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{job.home_bathrooms} Bathroom{job.home_bathrooms > 1 ? 's' : ''}</span>}
              {job.home_bedrooms != null && <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />{job.home_bedrooms} Bedroom{job.home_bedrooms > 1 ? 's' : ''}</span>}
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Living Areas</span>
              {(job.add_ons || []).map(a => <span key={a} className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{a.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>)}
            </div>
          </div>

          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 flex justify-between items-center">
            <div className="flex items-center gap-2"><Timer className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /><span className="text-sm font-bold text-indigo-800 dark:text-indigo-200">Approx Hours</span></div>
            <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">
              {job.estimated_duration_minutes
                ? `${Math.floor(job.estimated_duration_minutes / 60)}h ${job.estimated_duration_minutes % 60 ? `${job.estimated_duration_minutes % 60}m` : ''}`.trim()
                : '2-3 hrs'}
            </span>
          </div>

          {job.access_instructions && ['assigned', 'on_the_way', 'in_progress'].includes(job.status) && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs">
              <strong className="text-amber-800 dark:text-amber-200">🔑 Access Instructions:</strong>
              <p className="mt-1 text-amber-700 dark:text-amber-300">{job.access_instructions}</p>
            </div>
          )}

          {job.scope_notes && (
            <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-xs">
              <strong className="text-slate-700 dark:text-slate-300">📋 Special Instructions:</strong>
              <p className="mt-1 text-slate-600 dark:text-slate-400">{job.scope_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* On My Way CTA */}
      {['accepted', 'assigned'].includes(job.status) && (
        <div className="relative">
          <div className="absolute inset-0 rounded-xl bg-blue-500 opacity-20 animate-ping" style={{ animationDuration: '2s' }} />
          <Button id="on-my-way-btn" onClick={() => handleStatusUpdate('on_the_way')} className="relative w-full h-16 text-base font-bold bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30" disabled={submitting}>
            <Car className="h-5 w-5 mr-2" />{submitting ? 'Updating...' : "I'm On My Way"}
          </Button>
        </div>
      )}

      {/* Arrived — Supply Check Gate */}
      {job.status === 'on_the_way' && !supplyConfirmed && !showSupplyCheck && (
        <Button onClick={() => setShowSupplyCheck(true)} className="w-full h-14 text-base bg-green-600 hover:bg-green-700" disabled={submitting}>
          <CheckCircle2 className="h-5 w-5 mr-2" />I&apos;ve Arrived
        </Button>
      )}

      {job.status === 'on_the_way' && showSupplyCheck && !supplyConfirmed && (
        <SupplyCheck onConfirmed={() => { setSupplyConfirmed(true); handleStatusUpdate('in_progress'); }} bringsOwnSupplies={true} />
      )}

      {/* Before Photos (now handled per room) */}

      {/* Checklist */}
      {job.status === 'in_progress' && checklist && (
        <>
          <Card><CardContent className="p-4"><div className="flex justify-between text-sm mb-2"><span className="font-medium">Checklist Progress</span><span>{checked} of {total}</span></div><Progress value={progress} className="h-2" /></CardContent></Card>

          <div className="space-y-6">
            <RoomChecklist 
              jobId={job.id} 
              title="Kitchen" 
              existingPhotos={(job as any)?.photos || []}
              items={checklist.kitchen as Record<string, boolean>} 
              onItemChange={(key, val) => setChecklist({ ...checklist, kitchen: { ...checklist.kitchen, [key]: val } })} 
            />

            {checklist.bathrooms.map((bath, i) => (
              <RoomChecklist 
                key={`bath-${i}`} 
                jobId={job.id} 
                title={`Bathroom ${i + 1}`} 
                existingPhotos={(job as any)?.photos || []}
                items={bath as Record<string, boolean>} 
                onItemChange={(key, val) => { const newBaths = [...checklist.bathrooms]; newBaths[i] = { ...newBaths[i], [key]: val }; setChecklist({ ...checklist, bathrooms: newBaths }); }} 
              />
            ))}

            {checklist.bedrooms.map((bed, i) => (
              <RoomChecklist 
                key={`bed-${i}`} 
                jobId={job.id} 
                title={`Bedroom ${i + 1}`} 
                existingPhotos={(job as any)?.photos || []}
                items={bed as Record<string, boolean>} 
                onItemChange={(key, val) => { const newBeds = [...checklist.bedrooms]; newBeds[i] = { ...newBeds[i], [key]: val }; setChecklist({ ...checklist, bedrooms: newBeds }); }} 
              />
            ))}

            <RoomChecklist 
              jobId={job.id} 
              title="Living Areas" 
              existingPhotos={(job as any)?.photos || []}
              items={checklist.living_areas as Record<string, boolean>} 
              onItemChange={(key, val) => setChecklist({ ...checklist, living_areas: { ...checklist.living_areas, [key]: val } })} 
            />
          </div>

          <Card>
            <CardHeader className="bg-amber-50/50 border-b border-amber-100 pb-3">
              <CardTitle className="text-base font-bold text-amber-900 flex items-center gap-2"><PlusCircle className="h-4 w-4 text-amber-600" /> Up-Sells / Extra Charges</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground mb-2">Did the customer ask for an extra service on-site? Add it here to update the invoice.</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={extraChargeDesc} onChange={e => setExtraChargeDesc(e.target.value)} placeholder="e.g. Inside fridge clean" className="mt-1 h-10 min-h-[40px] resize-none" />
                </div>
                <div className="w-24">
                  <Label className="text-xs">Amount ($)</Label>
                  <Textarea value={extraChargeAmount} onChange={e => setExtraChargeAmount(e.target.value)} placeholder="0.00" className="mt-1 h-10 min-h-[40px] resize-none" />
                </div>
              </div>
              <Button onClick={handleAddCharge} disabled={submitting || !extraChargeDesc || !extraChargeAmount} className="w-full mt-2 h-10 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white">
                {submitting ? 'Adding...' : 'Add Charge to Invoice'}
              </Button>
            </CardContent>
          </Card>

          <Card><CardContent className="p-4"><Label>Notes (optional)</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any issues or scope changes..." className="mt-2 min-h-[80px]" /></CardContent></Card>

          <Button onClick={() => handleStatusUpdate('completed')} className="w-full h-14 text-base bg-green-600 hover:bg-green-700" disabled={submitting || progress < 100}>
            <CheckCircle2 className="h-5 w-5 mr-2" />Submit &amp; Complete Job
          </Button>
        </>
      )}

      {/* Completed view */}
      {['completed', 'reviewed', 'paid_out'].includes(job.status) && (
        <div className="space-y-4">
          <Card><CardContent className="p-6 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h2 className="font-bold text-lg">Job Complete</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Approx Hours Spent: {job.estimated_duration_minutes
                ? `${Math.floor(job.estimated_duration_minutes / 60)}h ${job.estimated_duration_minutes % 60 ? `${job.estimated_duration_minutes % 60}m` : ''}`.trim()
                : '2-3 hrs'}
            </p>
          </CardContent></Card>

          {/* Job Photo Evidence gallery */}
          {(job as any).photos && (job as any).photos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span>Job Photo Evidence ({(job as any).photos.length})</span>
                  <Badge variant="outline" className="text-xs">Documented</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(job as any).photos.map((p: any) => (
                    <div key={p.id} className="relative rounded-lg overflow-hidden border bg-muted/20 group aspect-square">
                      <img src={p.file_url} alt={p.caption || 'Job photo'} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${
                          p.photo_type === 'before' ? 'bg-amber-600' : p.photo_type === 'after' ? 'bg-emerald-600' : 'bg-red-600'
                        }`}>
                          {p.photo_type.toUpperCase()}
                        </span>
                      </div>
                      {p.room && (
                        <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1 text-[10px] text-white truncate font-medium">
                          {p.room}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

    </div>
  );
}
