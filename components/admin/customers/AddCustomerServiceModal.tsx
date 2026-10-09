'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Repeat,
  Calendar,
  MapPin,
  Sparkles,
  Loader2,
  Check,
  Home,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Customer, Zone, Employee, ServiceType, RecurringFrequency, AddOn } from '@/types';
import { SERVICE_TYPE_LABELS, DEFAULT_PRICING } from '@/types';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { TIME_OPTIONS, DURATION_OPTIONS, inferTimeWindow } from '@/lib/time-utils';
import { calculateMonthlyMRR } from '@/lib/recurring-utils';

const DAYS_OF_WEEK = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

const ADD_ONS_LIST: { value: AddOn; label: string; price: number }[] = [
  { value: 'inside_fridge', label: 'Inside Fridge', price: 35 },
  { value: 'inside_oven', label: 'Inside Oven', price: 40 },
  { value: 'inside_cabinets', label: 'Inside Cabinets', price: 45 },
  { value: 'baseboards', label: 'Baseboards', price: 35 },
  { value: 'interior_windows', label: 'Interior Windows', price: 50 },
];

interface AddCustomerServiceModalProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultTab?: 'recurring' | 'one_time';
  initialHomeSpecs?: {
    home_bedrooms?: number | string | null;
    home_bathrooms?: number | string | null;
    has_pets?: boolean | null;
    access_instructions?: string | null;
  };
}

export function AddCustomerServiceModal({
  customer,
  open,
  onOpenChange,
  onSuccess,
  defaultTab = 'recurring',
  initialHomeSpecs,
}: AddCustomerServiceModalProps) {
  const [activeTab, setActiveTab] = useState<'recurring' | 'one_time'>(defaultTab);
  const [submitting, setSubmitting] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // ─── Recurring Form State ───
  const [recService, setRecService] = useState<ServiceType>('standard_clean');
  const [recFrequency, setRecFrequency] = useState<RecurringFrequency>('biweekly');
  const [recDays, setRecDays] = useState<string[]>(['monday']);
  const [recStartDate, setRecStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [recStartTime, setRecStartTime] = useState('09:00');
  const [recDuration, setRecDuration] = useState('180');
  const [recPrice, setRecPrice] = useState('160');
  const [recEmployeeId, setRecEmployeeId] = useState('unassigned');
  const [recZoneId, setRecZoneId] = useState('');
  const [recNotes, setRecNotes] = useState('');

  // ─── One-Time Form State ───
  const [oneService, setOneService] = useState<ServiceType>('standard_clean');
  const [oneDate, setOneDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [oneStartTime, setOneStartTime] = useState('10:00');
  const [oneDuration, setOneDuration] = useState('180');
  const [oneBedrooms, setOneBedrooms] = useState('2');
  const [oneBathrooms, setOneBathrooms] = useState('1');
  const [onePets, setOnePets] = useState(false);
  const [oneAddOns, setOneAddOns] = useState<AddOn[]>([]);
  const [onePrice, setOnePrice] = useState('199');
  const [oneZoneId, setOneZoneId] = useState('');
  const [oneAccessInstructions, setOneAccessInstructions] = useState('');
  const [oneScopeNotes, setOneScopeNotes] = useState('');

  // Address fields common to customer
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('Toronto');
  const [postalCode, setPostalCode] = useState('');

  const handleAddressSelect = (addr: {
    address_line1: string;
    city: string;
    state: string;
    postal_code: string;
  }) => {
    setAddressLine1(addr.address_line1);
    if (addr.city) setCity(addr.city);
    if (addr.postal_code) setPostalCode(addr.postal_code);

    if (addr.city && zones.length > 0) {
      const cityLower = addr.city.toLowerCase();
      const matched = zones.find(
        (z) => z.city?.toLowerCase() === cityLower || z.name?.toLowerCase().includes(cityLower)
      );
      if (matched) {
        setOneZoneId(matched.id);
        setRecZoneId(matched.id);
      }
    }
  };

  // Sync initial customer details when opened
  useEffect(() => {
    if (customer && open) {
      const rawCity = customer.city || '';
      const isStreetInCity = /^\d+|\b(st|street|ave|avenue|rd|road|dr|drive|cres|crescent|blvd|boulevard|way|lane)\b/i.test(rawCity);
      const cleanCity = isStreetInCity || !rawCity ? 'Toronto' : rawCity;

      setAddressLine1(customer.address_line1 || '');
      setCity(cleanCity);
      setPostalCode(customer.postal_code || '');

      // If customer has address but missing postal code, automatically resolve it via Mapbox
      if (customer.address_line1 && !customer.postal_code) {
        const query = encodeURIComponent(`${customer.address_line1} ${cleanCity}`);
        const token =
          process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
          'pk.eyJ1IjoieG1hbGlramMiLCJhIjoiY21xOXdu' +
          'MXpkMDAwNjJ4cG82dmFjZ3M2MSJ9.GWQ64O0FLUxLKQfOr4noBg';
        fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?q=${query}&country=CA&access_token=${token}&session_token=sob-${Date.now()}`)
          .then(r => r.json())
          .then(data => {
            const first = data.suggestions?.[0];
            if (first?.context?.postcode?.name) {
              setPostalCode(first.context.postcode.name);
            }
            if (first?.context?.place?.name && (!cleanCity || cleanCity === 'Toronto')) {
              setCity(first.context.place.name);
            }
          })
          .catch(() => {});
      }

      const zone = customer.zone_id || '';
      setRecZoneId(zone);
      setOneZoneId(zone);

      if (initialHomeSpecs) {
        if (initialHomeSpecs.home_bedrooms) {
          setOneBedrooms(String(initialHomeSpecs.home_bedrooms));
        }
        if (initialHomeSpecs.home_bathrooms) {
          setOneBathrooms(String(initialHomeSpecs.home_bathrooms));
        }
        if (typeof initialHomeSpecs.has_pets === 'boolean') {
          setOnePets(initialHomeSpecs.has_pets);
        }
        if (initialHomeSpecs.access_instructions) {
          setOneAccessInstructions(initialHomeSpecs.access_instructions);
        }
      }

      setActiveTab(defaultTab);
    }
  }, [customer, open, defaultTab, initialHomeSpecs]);

  // Load zones & employees
  useEffect(() => {
    if (open) {
      fetch('/api/zones')
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) {
            setZones(d);
            if (!recZoneId && d.length > 0) setRecZoneId(d[0].id);
            if (!oneZoneId && d.length > 0) setOneZoneId(d[0].id);
          }
        })
        .catch((e) => console.error('Error fetching zones', e));

      fetch('/api/employees')
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d)) {
            setEmployees(d.filter((emp: Employee) => emp.status === 'active'));
          }
        })
        .catch((e) => console.error('Error fetching employees', e));
    }
  }, [open]);

  // Auto-calculate recurring base price based on service type & frequency
  useEffect(() => {
    let base = DEFAULT_PRICING[recService] || 160;
    if (recFrequency === 'weekly') {
      base = Math.round(base * 0.85); // 15% recurring discount
    } else if (recFrequency === 'biweekly') {
      base = Math.round(base * 0.9); // 10% recurring discount
    } else if (recFrequency === 'monthly') {
      base = Math.round(base * 0.95); // 5% recurring discount
    }
    setRecPrice(String(base));
  }, [recService, recFrequency]);

  // Auto-calculate one-time price based on service, scope, add-ons
  useEffect(() => {
    const base = DEFAULT_PRICING[oneService] || 199;
    const beds = parseInt(oneBedrooms, 10) || 2;
    const baths = parseInt(oneBathrooms, 10) || 1;
    const extraBeds = Math.max(0, beds - 2) * 20;
    const extraBaths = Math.max(0, baths - 1) * 15;
    const petFee = onePets ? 20 : 0;
    const addOnsTotal = oneAddOns.reduce((acc, curr) => {
      const match = ADD_ONS_LIST.find((a) => a.value === curr);
      return acc + (match?.price || 30);
    }, 0);

    const calculated = base + extraBeds + extraBaths + petFee + addOnsTotal;
    setOnePrice(String(calculated));
  }, [oneService, oneBedrooms, oneBathrooms, onePets, oneAddOns]);

  // Recurring MRR preview
  const estimatedMRR = useMemo(() => {
    const p = parseFloat(recPrice) || 0;
    return calculateMonthlyMRR(p, recFrequency, recDays);
  }, [recPrice, recFrequency, recDays]);

  const toggleRecDay = (dayId: string) => {
    setRecDays((prev) => {
      if (prev.includes(dayId)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((d) => d !== dayId);
      } else {
        return [...prev, dayId];
      }
    });
  };

  const toggleAddOn = (addon: AddOn) => {
    setOneAddOns((prev) =>
      prev.includes(addon) ? prev.filter((a) => a !== addon) : [...prev, addon]
    );
  };

  // ─── Handle Submit Recurring ───
  async function handleSubmitRecurring() {
    if (!customer) return;
    if (!addressLine1.trim()) {
      toast.error('Please enter the service street address');
      return;
    }
    const finalCity = city.trim() || 'Toronto';
    const finalPostal = postalCode.trim() || 'M5V 2T6';

    if (!recStartDate) {
      toast.error('Please select a start date');
      return;
    }
    if (recDays.length === 0) {
      toast.error('Please select at least one day of the week');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_id: customer.id,
        service_type: recService,
        frequency: recFrequency,
        days_of_week: recDays,
        preferred_day_of_week: recDays[0],
        preferred_start_time: recStartTime,
        estimated_duration_minutes: parseInt(recDuration, 10),
        preferred_employee_id: recEmployeeId === 'unassigned' ? null : recEmployeeId,
        address_line1: addressLine1.trim(),
        city: finalCity,
        postal_code: finalPostal,
        zone_id: recZoneId || customer.zone_id || null,
        quoted_price: parseFloat(recPrice),
        start_date: recStartDate,
        notes: recNotes.trim() || null,
      };

      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create recurring contract');
      }

      toast.success(`Recurring ${SERVICE_TYPE_LABELS[recService]} contract created!`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Error creating recurring contract');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Handle Submit One-Time ───
  async function handleSubmitOneTime() {
    if (!customer) return;
    if (!addressLine1.trim()) {
      toast.error('Please enter the service street address');
      return;
    }
    const finalCity = city.trim() || 'Toronto';
    const finalPostal = postalCode.trim() || 'M5V 2T6';

    if (!oneDate) {
      toast.error('Please select a scheduled date');
      return;
    }
    const zoneToUse = oneZoneId || customer.zone_id || (zones[0]?.id ?? '');
    if (!zoneToUse) {
      toast.error('Please select an operational zone');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer_id: customer.id,
        zone_id: zoneToUse,
        service_type: oneService,
        scheduled_date: oneDate,
        scheduled_start_time: oneStartTime,
        scheduled_window: inferTimeWindow(oneStartTime),
        estimated_duration_minutes: parseInt(oneDuration, 10),
        address_line1: addressLine1.trim(),
        city: finalCity,
        postal_code: finalPostal,
        quoted_price: parseFloat(onePrice),
        home_bedrooms: parseInt(oneBedrooms, 10),
        home_bathrooms: parseInt(oneBathrooms, 10),
        has_pets: onePets,
        add_ons: oneAddOns,
        access_instructions: oneAccessInstructions.trim() || null,
        scope_notes: oneScopeNotes.trim() || null,
      };

      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to schedule job');
      }

      const jobData = await res.json();
      toast.success(`Job ${jobData.job_number || ''} scheduled successfully!`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Error scheduling job');
    } finally {
      setSubmitting(false);
    }
  }

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            <DialogTitle className="text-xl text-white">Add Service for {customer.full_name}</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400">
            {customer.phone || 'No phone'} &bull; {customer.email || 'No email'} &bull; {customer.city || 'Toronto'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full mt-2">
          <TabsList className="grid grid-cols-2 w-full mb-4 bg-slate-950 border border-slate-800">
            <TabsTrigger value="recurring" className="flex items-center gap-2">
              <Repeat className="h-4 w-4" />
              <span>Recurring Contract</span>
              <Badge variant="secondary" className="ml-1 text-[10px] bg-blue-950 text-blue-300 border border-blue-800">MRR</Badge>
            </TabsTrigger>
            <TabsTrigger value="one_time" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>One-Time Job</span>
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════ RECURRING TAB ══════════════════ */}
          <TabsContent value="recurring" className="space-y-4">
            <div className="bg-blue-950/30 border border-blue-900/50 rounded-lg p-3 text-sm flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-300">Subscription & Recurring Clean</p>
                <p className="text-xs text-blue-400">Creates an ongoing contract with auto-scheduled visits.</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-blue-400 block">Est. Monthly MRR</span>
                <span className="text-lg font-extrabold text-blue-300">${estimatedMRR.toFixed(2)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Service Type</Label>
                <Select value={recService} onValueChange={(v) => setRecService(v as ServiceType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard_clean">Standard Clean</SelectItem>
                    <SelectItem value="deep_clean">Deep Clean</SelectItem>
                    <SelectItem value="standard_plus_clean">Standard Plus</SelectItem>
                    <SelectItem value="commercial_cleaning">Commercial Cleaning</SelectItem>
                    <SelectItem value="carpet_clean">Carpet Cleaning</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Cadence / Frequency</Label>
                <Select value={recFrequency} onValueChange={(v) => setRecFrequency(v as RecurringFrequency)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly (every week)</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly (every 2 weeks)</SelectItem>
                    <SelectItem value="monthly">Monthly (every 4 weeks)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Days of Week */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-300">Scheduled Day(s) of Week</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => {
                  const isSelected = recDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleRecDay(day.id)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Schedule details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>First Clean Date</Label>
                <DatePicker value={recStartDate} onChange={setRecStartDate} minDate={new Date()} />
              </div>

              <div className="space-y-1.5">
                <Label>Preferred Time</Label>
                <Select value={recStartTime} onValueChange={setRecStartTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Estimated Duration</Label>
                <Select value={recDuration} onValueChange={setRecDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.slice(0, 10).map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Price & Cleaner assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label>Price per Clean ($ CAD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                  <Input
                    type="number"
                    min="1"
                    step="0.01"
                    className="pl-7"
                    value={recPrice}
                    onChange={(e) => setRecPrice(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Preferred Cleaner (Optional)</Label>
                <Select value={recEmployeeId} onValueChange={setRecEmployeeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-dispatch to pool" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Auto-Dispatch (First available)</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.phone})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Address Review */}
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between font-semibold text-slate-200">
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-blue-400" />
                  <span>Service Location</span>
                </div>
                <span className="text-[10px] font-normal text-slate-400">Address autofill active</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-xs text-slate-300">Address Line 1</Label>
                  <AddressAutocomplete
                    placeholder="Start typing service address..."
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    onAddressSelect={handleAddressSelect}
                    className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">City</Label>
                  <Input
                    placeholder="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Postal Code</Label>
                  <Input
                    placeholder="Postal Code"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs">Contract Notes / Specific Requests</Label>
              <Textarea
                rows={2}
                placeholder="Key lockbox info, customer special preferences, etc."
                value={recNotes}
                onChange={(e) => setRecNotes(e.target.value)}
              />
            </div>

            <DialogFooter className="mt-4 pt-2 border-t border-slate-800">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmitRecurring}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Creating Contract...
                  </>
                ) : (
                  <>
                    <Repeat className="h-4 w-4 mr-1.5" />
                    Create Recurring Contract (${recPrice}/visit)
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ══════════════════ ONE-TIME TAB ══════════════════ */}
          <TabsContent value="one_time" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Service Type</Label>
                <Select value={oneService} onValueChange={(v) => setOneService(v as ServiceType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SERVICE_TYPE_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Operational Zone</Label>
                <Select value={oneZoneId} onValueChange={setOneZoneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.name} ({z.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <DatePicker value={oneDate} onChange={setOneDate} minDate={new Date()} />
              </div>

              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Select value={oneStartTime} onValueChange={setOneStartTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Select value={oneDuration} onValueChange={setOneDuration}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.slice(0, 10).map((d) => (
                      <SelectItem key={d.value} value={String(d.value)}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Home Scope */}
            <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-white text-xs">
                  <Home className="h-3.5 w-3.5 text-blue-400" />
                  <span>Home Scope & Details</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                  <input
                    type="checkbox"
                    checked={onePets}
                    onChange={(e) => setOnePets(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Pets present (+$20)</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Bedrooms</Label>
                  <Select value={oneBedrooms} onValueChange={setOneBedrooms}>
                    <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} Bed{n > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-300">Bathrooms</Label>
                  <Select value={oneBathrooms} onValueChange={setOneBathrooms}>
                    <SelectTrigger className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} Bath{n > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Add-ons */}
              <div className="pt-2 border-t border-slate-800">
                <Label className="text-xs text-slate-300 block mb-1.5">Add-Ons</Label>
                <div className="flex flex-wrap gap-2">
                  {ADD_ONS_LIST.map((addon) => {
                    const isChecked = oneAddOns.includes(addon.value);
                    return (
                      <button
                        key={addon.value}
                        type="button"
                        onClick={() => toggleAddOn(addon.value)}
                        className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-all ${
                          isChecked
                            ? 'bg-blue-950/80 text-blue-300 border-blue-800 font-semibold'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {isChecked && <Check className="h-3 w-3 text-blue-400" />}
                        <span>{addon.label} (+${addon.price})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs text-slate-300">Address Line 1</Label>
                <AddressAutocomplete
                  placeholder="Start typing address..."
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  onAddressSelect={handleAddressSelect}
                  className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">City</Label>
                <Input
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">Postal Code</Label>
                <Input
                  placeholder="Postal Code"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200"
                />
              </div>
            </div>

            {/* Access & Scope Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">Access Instructions</Label>
                <Input
                  placeholder="Keycode, buzzer #, hide-a-key"
                  value={oneAccessInstructions}
                  onChange={(e) => setOneAccessInstructions(e.target.value)}
                  className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-300">Scope Notes / Special Requests</Label>
                <Input
                  placeholder="Focus on kitchen counters, don't touch office"
                  value={oneScopeNotes}
                  onChange={(e) => setOneScopeNotes(e.target.value)}
                  className="h-8 text-xs bg-slate-900 border-slate-800 text-slate-200"
                />
              </div>
            </div>

            {/* Price Quoted */}
            <div className="p-3 bg-blue-950/30 rounded-lg border border-blue-900/50 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-300">Quoted Job Price</p>
                <p className="text-[11px] text-blue-400">Auto-calculated from specs. Editable for discounts.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-blue-400">$</span>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  value={onePrice}
                  onChange={(e) => setOnePrice(e.target.value)}
                  className="w-28 h-8 text-sm font-bold bg-slate-900 border-slate-800 text-blue-300"
                />
              </div>
            </div>

            <DialogFooter className="mt-4 pt-2 border-t border-slate-800">
              <Button variant="outline" type="button" onClick={() => onOpenChange(false)} className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmitOneTime}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Scheduling Job...
                  </>
                ) : (
                  <>
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Schedule & Dispatch Job (${onePrice})
                  </>
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
