'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import {
  Repeat,
  Calendar,
  DollarSign,
  UserCheck,
  Zap,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Trash2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import type { RecurringBooking, Customer, Employee, ServiceType, RecurringFrequency } from '@/types';
import { SERVICE_TYPE_LABELS } from '@/types';
import {
  calculateMonthlyMRR,
  formatRecurrenceSchedule,
  DAY_LABELS,
  DAY_NAMES,
} from '@/lib/recurring-utils';
import { TIME_OPTIONS, DURATION_OPTIONS, format12Hour } from '@/lib/time-utils';

const DAYS_LIST: { id: string; label: string }[] = [
  { id: 'monday', label: 'Mon' },
  { id: 'tuesday', label: 'Tue' },
  { id: 'wednesday', label: 'Wed' },
  { id: 'thursday', label: 'Thu' },
  { id: 'friday', label: 'Fri' },
  { id: 'saturday', label: 'Sat' },
  { id: 'sunday', label: 'Sun' },
];

export default function RecurringPage() {
  const [bookings, setBookings] = useState<RecurringBooking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'paused' | 'weekly' | 'biweekly' | 'monthly'>('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [formCustomer, setFormCustomer] = useState('');
  const [formService, setFormService] = useState<ServiceType>('standard_clean');
  const [formFrequency, setFormFrequency] = useState<RecurringFrequency>('weekly');
  const [formDays, setFormDays] = useState<string[]>(['monday', 'wednesday', 'friday']);
  const [formTime, setFormTime] = useState('18:00');
  const [formDuration, setFormDuration] = useState('180');
  const [formPrice, setFormPrice] = useState('225');
  const [formEmployee, setFormEmployee] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('Toronto');
  const [formPostal, setFormPostal] = useState('M5V 2T6');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [recRes, custRes, empRes] = await Promise.all([
        fetch('/api/recurring'),
        fetch('/api/customers'),
        fetch('/api/employees'),
      ]);

      if (recRes.ok) {
        const d = await recRes.json();
        setBookings(Array.isArray(d) ? d : []);
      }
      if (custRes.ok) {
        const d = await custRes.json();
        setCustomers(Array.isArray(d) ? d : []);
      }
      if (empRes.ok) {
        const d = await empRes.json();
        setEmployees(Array.isArray(d) ? d : []);
      }
    } catch (err) {
      console.error('Failed to load recurring data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // When customer is selected, prefill address
  const handleSelectCustomer = (custId: string) => {
    setFormCustomer(custId);
    const found = customers.find((c) => c.id === custId);
    if (found) {
      if (found.address_line1) setFormAddress(found.address_line1);
      if (found.city) setFormCity(found.city);
      if (found.postal_code) setFormPostal(found.postal_code);
    }
  };

  // Toggle Day Selection
  const toggleDay = (dayId: string) => {
    setFormDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  };

  // Computed MRR preview in modal
  const previewMRR = useMemo(() => {
    return calculateMonthlyMRR(Number(formPrice) || 0, formFrequency, formDays);
  }, [formPrice, formFrequency, formDays]);

  // Handle Create Recurring Booking
  const handleCreateAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formAddress || !formPrice) {
      toast.error('Address and price are required');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/recurring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: formCustomer || null,
          service_type: formService,
          frequency: formFrequency,
          days_of_week: formDays,
          preferred_start_time: formTime,
          estimated_duration_minutes: Number(formDuration),
          preferred_employee_id: formEmployee || null,
          address_line1: formAddress,
          city: formCity,
          postal_code: formPostal,
          quoted_price: Number(formPrice),
          notes: formNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create agreement');
      }

      toast.success('Recurring service agreement created!');
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Pause/Active status
  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch(`/api/recurring/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentActive }),
      });

      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === id ? { ...b, is_active: !currentActive } : b))
        );
        toast.success(!currentActive ? 'Agreement activated' : 'Agreement paused');
      }
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  // Generate 14-day upcoming jobs
  const handleGenerateJobs = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/recurring/generate-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lookahead_days: 14 }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.count > 0) {
          toast.success(`Generated ${data.count} upcoming recurring job${data.count > 1 ? 's' : ''} on the calendar!`);
        } else {
          toast.info('All recurring jobs for the next 14 days are already generated.');
        }
        loadData();
      } else {
        throw new Error(data.error || 'Failed to generate jobs');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Delete Agreement
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to terminate this recurring agreement?')) return;
    try {
      const res = await fetch(`/api/recurring/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBookings((prev) => prev.filter((b) => b.id !== id));
        toast.success('Agreement deleted');
      }
    } catch (err: any) {
      toast.error('Failed to delete agreement');
    }
  };

  // Metrics
  const activeCount = useMemo(() => bookings.filter((b) => b.is_active).length, [bookings]);
  const totalMRR = useMemo(
    () =>
      bookings
        .filter((b) => b.is_active)
        .reduce((sum, b) => sum + (b.monthly_amount || calculateMonthlyMRR(b.quoted_price, b.frequency, b.days_of_week || [])), 0),
    [bookings]
  );

  // Filtered List
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Tab filter
      if (filterTab === 'active' && !b.is_active) return false;
      if (filterTab === 'paused' && b.is_active) return false;
      if (filterTab === 'weekly' && b.frequency !== 'weekly') return false;
      if (filterTab === 'biweekly' && b.frequency !== 'biweekly') return false;
      if (filterTab === 'monthly' && b.frequency !== 'monthly') return false;

      // Search filter
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        b.customer?.full_name?.toLowerCase().includes(q) ||
        b.address_line1.toLowerCase().includes(q) ||
        b.service_type.toLowerCase().includes(q) ||
        b.employee?.full_name?.toLowerCase().includes(q)
      );
    });
  }, [bookings, filterTab, searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider mb-1">
            <Repeat className="h-4 w-4" />
            <span>Recurring Contracts & MRR Engine</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
            Recurring Services
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateJobs}
            disabled={generating}
            className="gap-1.5 text-xs font-bold"
          >
            <Zap className={`h-4 w-4 text-amber-500 ${generating ? 'animate-spin' : ''}`} />
            {generating ? 'Generating Jobs...' : '⚡ Generate Next 14 Days'}
          </Button>

          <Dialog open={modalOpen} onOpenChange={setModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs font-bold shadow-xs">
                <Plus className="h-4 w-4" />
                New Recurring Agreement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Recurring Service Agreement</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleCreateAgreement} className="space-y-4 pt-2">
                {/* Customer Selection */}
                <div className="space-y-1">
                  <Label className="text-xs">Select Customer / Client</Label>
                  <Select value={formCustomer} onValueChange={handleSelectCustomer}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Select Customer or Enter Address Below" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.full_name} ({c.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service Type & Price */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Service Type</Label>
                    <Select value={formService} onValueChange={(v) => setFormService(v as ServiceType)}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(SERVICE_TYPE_LABELS).map(([k, label]) => (
                          <SelectItem key={k} value={k} className="text-xs">
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Rate per Clean ($ CAD)</Label>
                    <Input
                      type="number"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="text-xs h-9 font-bold"
                      placeholder="e.g. 225"
                      required
                    />
                  </div>
                </div>

                {/* Recurrence Frequency */}
                <div className="space-y-1">
                  <Label className="text-xs">Recurrence Frequency</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['weekly', 'biweekly', 'monthly'] as RecurringFrequency[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFormFrequency(f)}
                        className={`py-2 px-3 rounded-lg border text-xs font-bold capitalize transition-all ${
                          formFrequency === f
                            ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                            : 'bg-card text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {f === 'biweekly' ? 'Bi-Weekly' : f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Days of Week Selection */}
                <div className="space-y-2">
                  <Label className="text-xs">Service Days (Multiple days for commercial/regular cleans)</Label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DAYS_LIST.map((day) => {
                      const selected = formDays.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => toggleDay(day.id)}
                          className={`w-10 h-8 rounded-lg text-xs font-bold border transition-all ${
                            selected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-card text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Start Time & Duration */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Scheduled Arrival Time</Label>
                    <Select value={formTime} onValueChange={setFormTime}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value} className="text-xs">
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Estimated Duration</Label>
                    <Select value={formDuration} onValueChange={setFormDuration}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DURATION_OPTIONS.map((d) => (
                          <SelectItem key={d.value} value={d.value.toString()} className="text-xs">
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preferred Cleaner */}
                <div className="space-y-1">
                  <Label className="text-xs">Assigned Primary Cleaner</Label>
                  <Select value={formEmployee} onValueChange={setFormEmployee}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Auto-dispatch / Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" className="text-xs text-muted-foreground">
                        Unassigned (Dispatch Queue)
                      </SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id} className="text-xs">
                          {e.full_name} (${(e as any).hourly_wage || 25}/hr)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Location Fields */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Street Address</Label>
                    <AddressAutocomplete
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      onAddressSelect={(addr) => {
                        setFormAddress(addr.address_line1);
                        if (addr.city) setFormCity(addr.city);
                        if (addr.postal_code) setFormPostal(addr.postal_code);
                      }}
                      className="text-xs h-9 bg-white"
                      placeholder="Start typing address..."
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">City</Label>
                    <Input
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      className="text-xs h-9"
                      placeholder="Toronto"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Postal Code</Label>
                    <Input
                      value={formPostal}
                      onChange={(e) => setFormPostal(e.target.value)}
                      className="text-xs h-9"
                      placeholder="M5V 2T6"
                      required
                    />
                  </div>
                </div>

                {/* Scope & Notes */}
                <div className="space-y-1">
                  <Label className="text-xs">Scope of Work & Access Codes</Label>
                  <Input
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="text-xs h-9"
                    placeholder="Gate code #4412, trash in alley, keycard with security"
                  />
                </div>

                {/* MRR Preview Card */}
                <div className="p-3 bg-muted/40 border rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Computed Monthly MRR:</span>
                    <span className="font-extrabold text-foreground text-sm">
                      ${previewMRR.toLocaleString()} / month
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {formDays.length > 0 ? `${formDays.length} visits/week` : formFrequency}
                  </Badge>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={submitting}>
                    {submitting ? 'Creating...' : 'Save Recurring Agreement'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
              MRR
            </Badge>
          </div>
          <p className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            ${totalMRR.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Monthly Recurring Revenue
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            {activeCount}
          </p>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Active Recurring Contracts
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            {bookings.length}
          </p>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Total Enrolled Agreements
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            {bookings.filter((b) => b.is_active && b.next_job_date).length}
          </p>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Scheduled Next Runs
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/50 overflow-x-auto w-full sm:w-auto">
          {(['all', 'active', 'paused', 'weekly', 'biweekly', 'monthly'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition-all ${
                filterTab === tab
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'all' ? `All (${bookings.length})` : tab}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search client, address, cleaner..."
            className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded-xl text-xs focus:outline-none focus:ring-2 ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Recurring Contracts Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-muted-foreground uppercase font-bold text-[10px] border-b">
              <tr>
                <th className="px-4 py-3">Client & Location</th>
                <th className="px-4 py-3">Service</th>
                <th className="px-4 py-3">Schedule & Time</th>
                <th className="px-4 py-3">Cleaner</th>
                <th className="px-4 py-3">Per Clean</th>
                <th className="px-4 py-3">Monthly MRR</th>
                <th className="px-4 py-3">Next Run</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBookings.map((b) => {
                const scheduleSummary = formatRecurrenceSchedule(
                  b.frequency,
                  b.days_of_week || [],
                  b.preferred_day_of_week,
                  b.preferred_start_time || '09:00'
                );

                const mrr = b.monthly_amount || calculateMonthlyMRR(b.quoted_price, b.frequency, b.days_of_week || []);

                return (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    {/* Client & Address */}
                    <td className="px-4 py-3">
                      <p className="font-bold text-foreground text-xs">
                        {b.customer?.full_name || 'Commercial Facility'}
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {b.address_line1}, {b.city}
                      </p>
                    </td>

                    {/* Service */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        {SERVICE_TYPE_LABELS[b.service_type] || b.service_type?.replace(/_/g, ' ')}
                      </Badge>
                    </td>

                    {/* Schedule */}
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground block">{scheduleSummary}</span>
                      {b.estimated_duration_minutes && (
                        <span className="text-[10px] text-muted-foreground">
                          {Math.round(b.estimated_duration_minutes / 60)} hrs / visit
                        </span>
                      )}
                    </td>

                    {/* Cleaner */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {b.employee ? (
                        <div className="flex items-center gap-1.5 font-medium">
                          <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center">
                            {b.employee.full_name?.slice(0, 1)}
                          </div>
                          <span>{b.employee.full_name}</span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-200">
                          Unassigned
                        </Badge>
                      )}
                    </td>

                    {/* Price per clean */}
                    <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">
                      ${b.quoted_price}
                    </td>

                    {/* Monthly MRR */}
                    <td className="px-4 py-3 font-extrabold text-emerald-600 whitespace-nowrap">
                      ${mrr.toLocaleString()}
                    </td>

                    {/* Next Run */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {b.next_job_date ? (
                        <div className="flex items-center gap-1 font-mono text-xs text-foreground">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{b.next_job_date}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>

                    {/* Active Switch */}
                    <td className="px-4 py-3">
                      <Switch
                        checked={b.is_active}
                        onCheckedChange={() => handleToggleActive(b.id, b.is_active)}
                      />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(b.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {filteredBookings.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    No recurring service agreements found. Click &quot;New Recurring Agreement&quot; to set up your first recurring contract.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
