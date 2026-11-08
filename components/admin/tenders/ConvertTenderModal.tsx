'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FileCheck2,
  Loader2,
  Sparkles,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SERVICE_TYPE_LABELS } from '@/types';
import type { ServiceType } from '@/types';
import {
  TIME_OPTIONS,
  DURATION_OPTIONS,
  calculateEndTime,
  format12Hour,
  inferTimeWindow,
} from '@/lib/time-utils';

interface ConvertTenderModalProps {
  tender: any | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (job: any) => void;
}

export function ConvertTenderModal({
  tender,
  isOpen,
  onClose,
  onSuccess,
}: ConvertTenderModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [zones, setZones] = useState<any[]>([]);

  const meta = tender?.tender_meta || {};
  const initialAddress =
    meta.jobsite_address ||
    meta.address ||
    tender?.address ||
    tender?.address_line1 ||
    tender?.city ||
    '';
  const initialDate = tender?.bid_due_date
    ? String(tender.bid_due_date).split('T')[0]
    : '';
  const initialPrice = tender?.quoted_price ? String(tender.quoted_price) : '';

  const initialDuration = (() => {
    const hours = Number(meta.labor_reconciliation?.estimated_hours);
    if (hours > 0) {
      return Math.min(720, Math.max(60, Math.round(hours * 60)));
    }
    return 360; // 6 hours default for commercial/post-con
  })();

  const [form, setForm] = useState({
    zone_id: '',
    service_type: (tender?.service_type || 'post_construction_clean') as ServiceType,
    scheduled_date: initialDate,
    scheduled_start_time: '08:00',
    estimated_duration_minutes: initialDuration,
    address_line1: initialAddress,
    postal_code: meta.postal_code || tender?.postal_code || '',
    quoted_price: initialPrice,
    deposit_amount: initialPrice ? String(Math.round(Number(initialPrice) * 0.3 * 100) / 100) : '0',
    scope_notes: '',
  });

  // Fetch zones on open
  useEffect(() => {
    if (!isOpen) return;
    async function fetchZones() {
      try {
        const res = await fetch('/api/zones');
        const data = await res.json();
        if (Array.isArray(data)) {
          setZones(data);
          // If no zone is selected yet, try to match by city
          if (data.length > 0) {
            const cityMatch = data.find(
              (z: any) =>
                z.city?.toLowerCase() === tender?.city?.toLowerCase() ||
                z.name?.toLowerCase().includes(tender?.city?.toLowerCase() || '')
            );
            setForm((f) => ({
              ...f,
              zone_id: f.zone_id || cityMatch?.id || data[0].id,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load zones:', err);
      }
    }
    fetchZones();
  }, [isOpen, tender?.city]);

  // Sync form when tender changes
  useEffect(() => {
    if (tender) {
      const tenderMeta = tender.tender_meta || {};
      const addr =
        tenderMeta.jobsite_address ||
        tenderMeta.address ||
        tender.address ||
        tender.address_line1 ||
        tender.city ||
        '';
      const d = tender.bid_due_date ? String(tender.bid_due_date).split('T')[0] : '';
      const p = tender.quoted_price ? String(tender.quoted_price) : '';

      const hours = Number(tenderMeta.labor_reconciliation?.estimated_hours);
      const dur = hours > 0 ? Math.min(720, Math.max(60, Math.round(hours * 60))) : 360;

      const pName = tender.project_name || tender.condition || 'Commercial Project';
      const sSummary = tender.scope_summary || tenderMeta.scope_summary || '';
      const notes = [
        `Project: ${pName}`,
        `GC / Client: ${tender.company_name || 'Commercial Client'} (Attn: ${tender.customer_name || 'Estimator'})`,
        sSummary ? `Scope: ${sSummary}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      setForm((f) => ({
        ...f,
        service_type: (tender.service_type || 'post_construction_clean') as ServiceType,
        scheduled_date: f.scheduled_date || d,
        scheduled_start_time: '08:00',
        estimated_duration_minutes: dur,
        address_line1: addr,
        postal_code: tenderMeta.postal_code || tender.postal_code || '',
        quoted_price: p,
        deposit_amount: p ? String(Math.round(Number(p) * 0.3 * 100) / 100) : '0',
        scope_notes: notes,
      }));
    }
  }, [tender]);

  if (!tender) return null;

  const calculatedEndTime = calculateEndTime(
    form.scheduled_start_time,
    form.estimated_duration_minutes
  );

  async function handleConvertAndCreateJob(e: React.FormEvent) {
    e.preventDefault();
    if (!tender) return;

    if (!form.zone_id && zones.length > 0) {
      toast.error('Please select an operational zone');
      return;
    }

    if (!form.scheduled_date) {
      toast.error('Please choose a scheduled job date');
      return;
    }

    setSubmitting(true);
    try {
      const priceNum = form.quoted_price ? parseFloat(form.quoted_price) : 0;
      const depositNum = form.deposit_amount ? parseFloat(form.deposit_amount) : 0;
      const windowInferred = inferTimeWindow(form.scheduled_start_time);

      const res = await fetch(`/api/leads/${tender.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: form.zone_id,
          service_type: form.service_type,
          scheduled_date: form.scheduled_date,
          scheduled_start_time: form.scheduled_start_time,
          scheduled_window: windowInferred,
          estimated_duration_minutes: form.estimated_duration_minutes,
          address_line1: form.address_line1,
          postal_code: form.postal_code,
          quoted_price: priceNum,
          deposit_amount: depositNum,
          scope_notes: form.scope_notes,
          home_size_sqft: tender.sqft ? Number(tender.sqft) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to convert tender to job');
      }

      toast.success(
        `Job #${data.job_number || 'created'} scheduled successfully from awarded tender!`
      );
      onSuccess?.(data);
      onClose();
    } catch (err: any) {
      console.error('Error creating job from tender:', err);
      toast.error(err.message || 'Failed to convert tender to job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-white/10 text-white dark p-6 shadow-2xl rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-white text-lg font-bold">
                Convert Awarded Tender to Job
              </DialogTitle>
              <DialogDescription className="text-white/60 text-xs">
                Creates an active job in the dispatch queue &amp; customer profile for{' '}
                <span className="text-white font-medium">{tender.project_name || 'Tender'}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleConvertAndCreateJob} className="space-y-4 pt-2">
          {/* Target Project Summary Header Card */}
          <div className="p-3.5 bg-slate-950/70 border border-white/10 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-white/60 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                {tender.company_name}
              </span>
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                Awarded Tender
              </Badge>
            </div>
            <div className="font-semibold text-white text-sm">
              {tender.project_name || 'Commercial Tender'}
            </div>
            <div className="text-white/60 flex items-center gap-2 flex-wrap">
              <span>Attn: {tender.customer_name || 'Estimator'}</span>
              {tender.customer_phone && <span>· {tender.customer_phone}</span>}
              {tender.customer_email && <span>· {tender.customer_email}</span>}
            </div>
          </div>

          {/* Operational Zone */}
          <div>
            <Label className="text-white/80 text-xs font-semibold">Operational Zone *</Label>
            <Select
              value={form.zone_id}
              onValueChange={(val) => setForm({ ...form, zone_id: val })}
            >
              <SelectTrigger className="w-full bg-black/40 border-white/10 text-white h-10 mt-1">
                <SelectValue placeholder="Select operating zone" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white max-h-60">
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id} className="text-white hover:bg-white/10">
                    {z.name} ({z.city})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Service Type */}
          <div>
            <Label className="text-white/80 text-xs font-semibold">Service Type</Label>
            <Select
              value={form.service_type}
              onValueChange={(val) => setForm({ ...form, service_type: val as ServiceType })}
            >
              <SelectTrigger className="w-full bg-black/40 border-white/10 text-white h-10 mt-1">
                <SelectValue placeholder="Select service type" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-white/10 text-white">
                {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key} className="text-white hover:bg-white/10">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Schedule Date & Start Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-white/80 text-xs font-semibold">Scheduled Date *</Label>
              <div className="mt-1">
                <DatePicker
                  value={form.scheduled_date}
                  onChange={(d) => setForm({ ...form, scheduled_date: d })}
                  className="bg-black/40 border-white/10 text-white w-full"
                />
              </div>
            </div>

            <div>
              <Label className="text-white/80 text-xs font-semibold">Start Time</Label>
              <Select
                value={form.scheduled_start_time}
                onValueChange={(val) => setForm({ ...form, scheduled_start_time: val })}
              >
                <SelectTrigger className="w-full bg-black/40 border-white/10 text-white h-10 mt-1">
                  <SelectValue placeholder="Select start time" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white max-h-60">
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-white hover:bg-white/10">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration & Time Window Card */}
          <div className="space-y-2">
            <div>
              <Label className="text-white/80 text-xs font-semibold">Estimated Duration</Label>
              <Select
                value={form.estimated_duration_minutes.toString()}
                onValueChange={(val) =>
                  setForm({ ...form, estimated_duration_minutes: parseInt(val, 10) })
                }
              >
                <SelectTrigger className="w-full bg-black/40 border-white/10 text-white h-10 mt-1">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white max-h-60">
                  {DURATION_OPTIONS.map((d) => (
                    <SelectItem
                      key={d.value}
                      value={d.value.toString()}
                      className="text-white hover:bg-white/10"
                    >
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-blue-500/10 border border-blue-500/25 rounded-xl text-xs flex items-center justify-between text-blue-300 font-medium">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Job Schedule Window:
              </span>
              <span className="font-bold text-white text-sm">
                {format12Hour(form.scheduled_start_time)} → {calculatedEndTime}
              </span>
            </div>
          </div>

          {/* Site Address */}
          <div>
            <Label className="text-white/80 text-xs font-semibold">Jobsite Address *</Label>
            <div className="mt-1">
              <AddressAutocomplete
                theme="dark"
                className="bg-black/40 border-white/10 text-white"
                value={form.address_line1}
                onChange={(e) => setForm({ ...form, address_line1: e.target.value })}
                onAddressSelect={(addr) =>
                  setForm((f) => ({
                    ...f,
                    address_line1: addr.address_line1,
                    postal_code: addr.postal_code || f.postal_code,
                  }))
                }
              />
            </div>
          </div>

          {/* Postal Code & Quoted Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-white/80 text-xs font-semibold">Postal Code</Label>
              <Input
                className="bg-black/40 border-white/10 text-white mt-1 h-10"
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                placeholder="e.g. M5V 2T6"
              />
            </div>

            <div>
              <Label className="text-white/80 text-xs font-semibold">Quoted Price ($)</Label>
              <Input
                type="number"
                step="0.01"
                className="bg-black/40 border-white/10 text-white mt-1 h-10 font-bold"
                value={form.quoted_price}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = parseFloat(val);
                  setForm({
                    ...form,
                    quoted_price: val,
                    deposit_amount: !isNaN(num) ? String(Math.round(num * 0.3 * 100) / 100) : form.deposit_amount,
                  });
                }}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Scope Notes */}
          <div>
            <Label className="text-white/80 text-xs font-semibold">Scope of Work &amp; Dispatch Notes</Label>
            <Textarea
              className="bg-black/40 border-white/10 text-white mt-1 min-h-[85px] text-xs leading-relaxed"
              value={form.scope_notes}
              onChange={(e) => setForm({ ...form, scope_notes: e.target.value })}
              placeholder="Scope details for assigned cleaners & dispatch..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="text-xs h-10 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-10 text-xs px-5 shadow-lg gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Job...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Convert &amp; Create Job
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
