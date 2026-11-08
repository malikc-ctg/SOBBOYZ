'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DatePicker } from '@/components/ui/date-picker';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import type { Zone } from '@/types';
import { toast } from 'sonner';

const POSTING_FEE_RATE = 0.05;
const COMMISSION_RATE = 0.25;

const SERVICE_TYPES = [
  { value: 'standard_clean', label: 'Standard Clean' },
  { value: 'deep_clean', label: 'Deep Clean' },
  { value: 'move_out_clean', label: 'Move-Out Clean' },
  { value: 'move_in_clean', label: 'Move-In Clean' },
];

const WINDOWS = [
  { value: 'morning', label: 'Morning (8am–12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm–4pm)' },
  { value: 'evening', label: 'Evening (4pm–8pm)' },
];

export default function PartnerBookPage() {
  const router = useRouter();
  const [zones, setZones] = useState<Zone[]>([]);
  const [quote, setQuote] = useState<{ final_price: number; surge_reason: string | null } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    address_line1: '', city: '', postal_code: '',
    service_type: 'standard_clean', scheduled_date: '',
    scheduled_window: 'morning', zone_id: '',
    home_bedrooms: '2', home_bathrooms: '1',
    has_pets: false, add_ons: [] as string[],
    access_instructions: '', partner_reference: '',
  });

  useEffect(() => {
    fetch('/api/zones').then(r => r.json()).then(d => setZones(Array.isArray(d) ? d : []));
  }, []);

  async function fetchQuote() {
    if (!form.zone_id || !form.scheduled_date) {
      toast.error('Select a zone and date to get a quote');
      return;
    }
    const res = await fetch('/api/pricing/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: form.zone_id,
        service_type: form.service_type,
        scheduled_date: form.scheduled_date,
        scheduled_window: form.scheduled_window,
        home_bedrooms: parseInt(form.home_bedrooms),
        home_bathrooms: parseInt(form.home_bathrooms),
        has_pets: form.has_pets,
        add_ons: form.add_ons,
      }),
    });
    if (res.ok) setQuote(await res.json());
    else toast.error('Failed to get quote');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) { toast.error('Get a price quote first'); return; }
    setSubmitting(true);
    try {
      // Get partner ID from session — use /me endpoint
      const meRes = await fetch('/api/partners/me');
      if (!meRes.ok) throw new Error('Could not identify your partner account');
      const me = await meRes.json();

      const res = await fetch(`/api/partners/${me.id}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quoted_price: quote.final_price }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Booking failed');
      toast.success('Job booked successfully!');
      router.push(`/partner/jobs?booked=${data.id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const update = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // Computed financials from quote
  const basePrice = quote?.final_price ?? 0;
  const postingFee = Math.round(basePrice * POSTING_FEE_RATE * 100) / 100;
  const totalCharged = basePrice + postingFee;
  const commissionEarned = Math.round(basePrice * COMMISSION_RATE * 100) / 100;
  const netCost = totalCharged - commissionEarned;

  // Tomorrow min date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Book a Job</h1>
        <p className="text-sm text-muted-foreground mt-1">Submit a cleaning job and earn your 25% commission when complete.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Location */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Location</h2>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Street Address *</label>
            <AddressAutocomplete 
              required 
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" 
              value={form.address_line1} 
              onChange={e => update('address_line1', e.target.value)}
              onAddressSelect={addr => {
                update('address_line1', addr.address_line1);
                if (addr.city) update('city', addr.city);
                if (addr.postal_code) update('postal_code', addr.postal_code);
              }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">City *</label>
              <input required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.city} onChange={e => update('city', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Postal Code *</label>
              <input required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.postal_code} onChange={e => update('postal_code', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Service */}
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Service</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Service Type</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.service_type} onChange={e => update('service_type', e.target.value)}>
                {SERVICE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Zone</label>
              <select required className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.zone_id} onChange={e => update('zone_id', e.target.value)}>
                <option value="">Select zone…</option>
                {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Date *</label>
              <DatePicker
                minDate={minDate}
                value={form.scheduled_date}
                onChange={(val) => update('scheduled_date', val)}
                className="w-full border-border rounded-lg bg-background h-[38px]"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Window</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.scheduled_window} onChange={e => update('scheduled_window', e.target.value)}>
                {WINDOWS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Bedrooms</label>
              <input type="number" min="1" max="8" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.home_bedrooms} onChange={e => update('home_bedrooms', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Bathrooms</label>
              <input type="number" min="1" max="6" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.home_bathrooms} onChange={e => update('home_bathrooms', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Pets</label>
              <select className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.has_pets ? 'yes' : 'no'} onChange={e => update('has_pets', e.target.value === 'yes')}>
                <option value="no">No pets</option>
                <option value="yes">Has pets</option>
              </select>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Details</h2>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Access Instructions</label>
            <textarea rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none" value={form.access_instructions} onChange={e => update('access_instructions', e.target.value)} placeholder="Lockbox code, key location, gate code…" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Your Reference # (optional)</label>
            <input className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" value={form.partner_reference} onChange={e => update('partner_reference', e.target.value)} placeholder="MLS-1234 or client name" />
          </div>
        </div>

        {/* Quote Button */}
        <button
          type="button"
          onClick={fetchQuote}
          className="w-full py-2.5 border border-primary text-primary rounded-lg text-sm font-medium hover:bg-primary/5 transition-colors"
        >
          Get Price Quote
        </button>

        {/* Financial Breakdown */}
        {quote && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3">
              <p className="text-white font-semibold text-sm">Price Breakdown</p>
              {quote.surge_reason && (
                <p className="text-blue-100 text-xs mt-0.5">⚡ {quote.surge_reason}</p>
              )}
            </div>
            <div className="divide-y divide-border">
              <div className="flex justify-between px-5 py-3 text-sm">
                <span className="text-muted-foreground">Base Service Price</span>
                <span className="font-medium">${basePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-5 py-3 text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  Platform Posting Fee
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">5%</span>
                </span>
                <span className="font-medium text-amber-600">+${postingFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-5 py-3 text-sm font-semibold border-t-2 border-border">
                <span>Total You Pay</span>
                <span className="text-lg">${totalCharged.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-5 py-3.5 text-sm bg-green-50 dark:bg-green-950/30">
                <span className="text-green-800 dark:text-green-300 font-medium flex items-center gap-1">
                  Your Commission Earned
                  <span className="text-xs bg-green-200 text-green-800 px-1.5 py-0.5 rounded font-semibold">25%</span>
                </span>
                <span className="text-green-700 dark:text-green-400 font-bold text-base">+${commissionEarned.toFixed(2)}</span>
              </div>
              <div className="flex justify-between px-5 py-3 text-sm bg-muted/30">
                <span className="text-muted-foreground">Your Net Cost After Commission</span>
                <span className="font-bold">${netCost.toFixed(2)}</span>
              </div>
            </div>
            <div className="px-5 py-3 bg-blue-50 dark:bg-blue-950/30 text-xs text-blue-700 dark:text-blue-300">
              Commission is credited to your account when the job is completed and reviewed. Invoiced monthly.
            </div>
          </div>
        )}

        {quote && (
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Booking…' : 'Confirm Booking'}
          </button>
        )}
      </form>
    </div>
  );
}
