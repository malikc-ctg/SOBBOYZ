'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { ArrowLeft, ArrowRight, Check, Wand2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { SERVICE_TYPE_LABELS, DEFAULT_PRICING } from '@/types';
import type { Zone, Customer, ServiceType } from '@/types';

const STEPS = ['Customer', 'Service', 'Scope', 'Confirm'];

const ADD_ONS = [
  { value: 'inside_fridge', label: 'Inside Fridge' },
  { value: 'inside_oven', label: 'Inside Oven' },
  { value: 'inside_cabinets', label: 'Inside Cabinets' },
  { value: 'baseboards', label: 'Baseboards' },
  { value: 'interior_windows', label: 'Interior Windows' },
];

const TIME_WINDOWS = [
  { value: 'morning', label: 'Morning (8am–12pm)' },
  { value: 'afternoon', label: 'Afternoon (12pm–4pm)' },
  { value: 'evening', label: 'Evening (4pm–8pm)' },
];

import { TIME_OPTIONS, DURATION_OPTIONS, calculateEndTime, format12Hour, inferTimeWindow } from '@/lib/time-utils';

function NewJobForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get('customer_id');
  const [step, setStep] = useState(0);
  const [zones, setZones] = useState<Zone[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quote, setQuote] = useState<{ final_price: number; surge_reason: string | null } | null>(null);

  const [form, setForm] = useState({
    // Customer
    customer_id: '',
    // Service
    zone_id: '',
    service_type: 'standard_clean' as ServiceType,
    scheduled_date: '',
    scheduled_start_time: '15:00',
    estimated_duration_minutes: 360,
    scheduled_window: 'afternoon',
    // Scope
    home_bedrooms: '2',
    home_bathrooms: '1',
    home_size_sqft: '',
    has_pets: false,
    add_ons: [] as string[],
    access_instructions: '',
    scope_notes: '',
    // Address (pre-filled from customer)
    address_line1: '',
    address_line2: '',
    city: '',
    postal_code: '',
    quoted_price: '',
  });

  const update = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch('/api/zones').then(r => r.json()).then(d => setZones(Array.isArray(d) ? d : []));
    fetch('/api/customers').then(r => r.json()).then(d => setCustomers(Array.isArray(d) ? d : []));
  }, []);

  // Auto-fill address when customer is selected
  useEffect(() => {
    if (form.customer_id) {
      const customer = customers.find(c => c.id === form.customer_id);
      if (customer) {
        setForm(f => ({
          ...f,
          address_line1: customer.address_line1 ?? '',
          city: customer.city ?? '',
          postal_code: customer.postal_code ?? '',
          zone_id: customer.zone_id ?? f.zone_id,
        }));
      }
    }
  }, [form.customer_id, customers]);

  // Preselect customer from query param and advance to Service step
  useEffect(() => {
    if (customerIdParam && customers.length > 0) {
      const match = customers.find(c => c.id === customerIdParam);
      if (match) {
        setForm(f => ({
          ...f,
          customer_id: match.id,
          address_line1: match.address_line1 ?? '',
          city: match.city ?? '',
          postal_code: match.postal_code ?? '',
          zone_id: match.zone_id ?? f.zone_id,
        }));
        setStep(1);
      }
    }
  }, [customerIdParam, customers]);

  // Auto-compute base price when service or scope changes
  useEffect(() => {
    const base = DEFAULT_PRICING[form.service_type as ServiceType] ?? 180;
    const beds = form.home_bedrooms !== '' ? parseInt(form.home_bedrooms) : 2;
    const baths = form.home_bathrooms !== '' ? parseInt(form.home_bathrooms) : 1;
    const addOnCost = form.add_ons.length * 25;
    const sizeMod = Math.max(0, beds - 2) * 20 + Math.max(0, baths - 1) * 15;
    const petMod = form.has_pets ? 15 : 0;
    const suggested = base + sizeMod + addOnCost + petMod;
    setForm(f => ({ ...f, quoted_price: suggested.toFixed(2) }));
    setQuote(null);
  }, [form.service_type, form.home_bedrooms, form.home_bathrooms, form.has_pets, form.add_ons.length]);

  async function fetchQuote() {
    if (!form.zone_id || !form.scheduled_date) {
      toast.error('Select a zone and date first');
      return;
    }
    setQuoting(true);
    try {
      const res = await fetch('/api/pricing/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: form.zone_id,
          service_type: form.service_type,
          scheduled_date: form.scheduled_date,
          scheduled_window: inferTimeWindow(form.scheduled_start_time),
          scheduled_start_time: form.scheduled_start_time,
          estimated_duration_minutes: form.estimated_duration_minutes,
          home_bedrooms: parseInt(form.home_bedrooms),
          home_bathrooms: parseInt(form.home_bathrooms),
          has_pets: form.has_pets,
          add_ons: form.add_ons,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuote(data);
        setForm(f => ({ ...f, quoted_price: data.final_price.toFixed(2) }));
      }
    } catch {
      toast.error('Quote failed');
    } finally {
      setQuoting(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: form.customer_id,
          zone_id: form.zone_id,
          service_type: form.service_type,
          scheduled_date: form.scheduled_date,
          scheduled_start_time: form.scheduled_start_time,
          scheduled_window: inferTimeWindow(form.scheduled_start_time),
          estimated_duration_minutes: form.estimated_duration_minutes,
          address_line1: form.address_line1,
          address_line2: form.address_line2 || null,
          city: form.city,
          postal_code: form.postal_code,
          quoted_price: parseFloat(form.quoted_price),
          home_bedrooms: parseInt(form.home_bedrooms),
          home_bathrooms: parseInt(form.home_bathrooms),
          home_size_sqft: form.home_size_sqft ? parseInt(form.home_size_sqft) : null,
          has_pets: form.has_pets,
          add_ons: form.add_ons,
          access_instructions: form.access_instructions || null,
          scope_notes: form.scope_notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create job');
      }
      const job = await res.json();
      toast.success(`Job ${job.job_number} created! Dispatching offers...`);
      router.push('/sobadmin/jobs');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCustomer = customers.find(c => c.id === form.customer_id);

  const canProceed = [
    !!form.customer_id,
    !!form.zone_id && !!form.scheduled_date && !!form.service_type,
    true,
    !!form.address_line1 && !!form.city && !!form.postal_code && !!form.quoted_price,
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/sobadmin/jobs">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create New Job</h1>
          <p className="text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
              i < step ? 'bg-green-500 text-white' :
              i === step ? 'bg-primary text-primary-foreground' :
              'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 rounded ${i < step ? 'bg-green-500' : 'bg-muted'}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: Customer */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle>Select Customer</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Customer *</Label>
              <Select value={form.customer_id} onValueChange={v => update('customer_id', v)}>
                <SelectTrigger><SelectValue placeholder="Search customers..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name} — {c.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCustomer && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-100 dark:border-blue-900/50 text-sm space-y-1">
                <p className="font-medium">{selectedCustomer.full_name}</p>
                <p className="text-muted-foreground">{selectedCustomer.email} · {selectedCustomer.phone}</p>
                {selectedCustomer.address_line1 && (
                  <p className="text-muted-foreground">{selectedCustomer.address_line1}, {selectedCustomer.city}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Service */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle>Service Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Service Type *</Label>
                <Select value={form.service_type} onValueChange={v => update('service_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Zone *</Label>
                <Select value={form.zone_id} onValueChange={v => update('zone_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                  <SelectContent>
                    {zones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Date *</Label>
                <DatePicker value={form.scheduled_date} onChange={(val) => update('scheduled_date', val)} />
              </div>
              <div>
                <Label>Start Time *</Label>
                <Select value={form.scheduled_start_time} onValueChange={v => update('scheduled_start_time', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Est. Duration</Label>
                <Select value={form.estimated_duration_minutes.toString()} onValueChange={v => update('estimated_duration_minutes', parseInt(v, 10))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map(d => <SelectItem key={d.value} value={d.value.toString()}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm flex items-center justify-between text-blue-900 font-medium">
              <span>Time Slot:</span>
              <span className="font-bold">{format12Hour(form.scheduled_start_time)} → {calculateEndTime(form.scheduled_start_time, form.estimated_duration_minutes)}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Address *</Label>
                <AddressAutocomplete 
                  value={form.address_line1} 
                  onChange={e => update('address_line1', e.target.value)}
                  onAddressSelect={addr => {
                    update('address_line1', addr.address_line1);
                    if (addr.city) update('city', addr.city);
                    if (addr.postal_code) update('postal_code', addr.postal_code);
                  }}
                  placeholder="123 Main St" 
                />
              </div>
              <div>
                <Label>City *</Label>
                <Input value={form.city} onChange={e => update('city', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Postal Code *</Label>
                <Input value={form.postal_code} onChange={e => update('postal_code', e.target.value)} />
              </div>
              <div>
                <Label>Unit / Suite</Label>
                <Input value={form.address_line2} onChange={e => update('address_line2', e.target.value)} placeholder="Optional" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Scope */}
      {step === 2 && (
        <Card>
          <CardHeader><CardTitle>Job Scope</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label>Bedrooms</Label>
                <Input type="number" min="0" max="8" value={form.home_bedrooms} onChange={e => update('home_bedrooms', e.target.value)} />
              </div>
              <div>
                <Label>Bathrooms</Label>
                <Input type="number" min="0" max="6" value={form.home_bathrooms} onChange={e => update('home_bathrooms', e.target.value)} />
              </div>
              <div>
                <Label>Sqft</Label>
                <Input type="number" value={form.home_size_sqft} onChange={e => update('home_size_sqft', e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={form.has_pets} onCheckedChange={c => update('has_pets', !!c)} id="pets" />
              <Label htmlFor="pets">Has Pets</Label>
            </div>
            <div>
              <Label className="mb-2 block">Add-Ons</Label>
              <div className="grid grid-cols-2 gap-2">
                {ADD_ONS.map(a => (
                  <div key={a.value} className="flex items-center gap-2">
                    <Checkbox
                      id={a.value}
                      checked={form.add_ons.includes(a.value)}
                      onCheckedChange={checked => {
                        update('add_ons', checked
                          ? [...form.add_ons, a.value]
                          : form.add_ons.filter(x => x !== a.value));
                      }}
                    />
                    <Label htmlFor={a.value} className="font-normal">{a.label} <span className="text-muted-foreground text-xs">+$25</span></Label>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Access Instructions</Label>
              <Input value={form.access_instructions} onChange={e => update('access_instructions', e.target.value)} placeholder="Lockbox code, building access..." />
            </div>
            <div>
              <Label>Scope Notes</Label>
              <Input value={form.scope_notes} onChange={e => update('scope_notes', e.target.value)} placeholder="Special requests, areas to focus on..." />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm & Price */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle>Review & Confirm</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium">{selectedCustomer?.full_name}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Service</p>
                <p className="font-medium">{SERVICE_TYPE_LABELS[form.service_type]}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="font-medium">{form.scheduled_date}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Zone</p>
                <p className="font-medium">{zones.find(z => z.id === form.zone_id)?.name ?? '—'}</p>
              </div>
              <div className="col-span-2 space-y-0.5">
                <p className="text-xs text-muted-foreground">Address</p>
                <p className="font-medium">{form.address_line1}, {form.city}, {form.postal_code}</p>
              </div>
            </div>
            {form.add_ons.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.add_ons.map(a => (
                  <Badge key={a} variant="secondary" className="text-xs capitalize">{a.replace(/_/g, ' ')}</Badge>
                ))}
              </div>
            )}

            {/* Price */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label>Final Quoted Price ($) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.quoted_price}
                    onChange={e => update('quoted_price', e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={fetchQuote} disabled={quoting} className="shrink-0">
                  {quoting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                  {quoting ? 'Calculating...' : 'Smart Quote'}
                </Button>
              </div>
              {quote?.surge_reason && (
                <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                  ⚡ {quote.surge_reason} — surge pricing applied
                </p>
              )}
              <div className="bg-muted/50 rounded-lg p-3 text-xs space-y-1 text-muted-foreground">
                <p>• After confirming, the system will automatically send job offers to all verified employees in the selected zone.</p>
                <p>• The first employee to accept will be assigned. You can manually assign from the job detail page.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            className="flex-1"
            disabled={!canProceed[step]}
            onClick={() => setStep(s => s + 1)}
          >
            Next: {STEPS[step + 1]} <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            disabled={submitting || !form.quoted_price}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            {submitting ? 'Creating Job...' : 'Create Job & Dispatch'}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function NewJobPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto space-y-6 p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      }
    >
      <NewJobForm />
    </Suspense>
  );
}
