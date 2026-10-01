'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Trash2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SERVICE_TYPE_LABELS, TIME_WINDOW_LABELS, LEAD_SOURCE_LABELS } from '@/types';
import type { Lead } from '@/types';
import Link from 'next/link';

import { TIME_OPTIONS, DURATION_OPTIONS, calculateEndTime, format12Hour, inferTimeWindow } from '@/lib/time-utils';

export default function LeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [convertOpen, setConvertOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [zones, setZones] = useState<any[]>([]);
  const [convertForm, setConvertForm] = useState({
    zone_id: '',
    scheduled_date: '',
    scheduled_start_time: '15:00',
    estimated_duration_minutes: 360,
    address_line1: '',
    postal_code: '',
    quoted_price: '',
  });

  useEffect(() => {
    async function fetchLead() {
      const res = await fetch(`/api/leads/${params.id}`);
      const data = await res.json();
      setLead(data);
      setConvertForm(f => ({
        ...f,
        scheduled_date: data.preferred_date ?? '',
        scheduled_start_time: data.preferred_start_time ?? '15:00',
        address_line1: data.city ?? '',
        quoted_price: data.quoted_price?.toString() ?? '',
      }));
      setEditForm(data);
      setLoading(false);
    }
    async function fetchZones() {
      const res = await fetch('/api/zones');
      const data = await res.json();
      setZones(Array.isArray(data) ? data : []);
    }
    fetchLead();
    fetchZones();
  }, [params.id]);

  async function handleConvert() {
    try {
      if (!convertForm.zone_id) {
        toast.error('Please select a zone');
        return;
      }
      const windowInferred = inferTimeWindow(convertForm.scheduled_start_time);
      const res = await fetch(`/api/leads/${params.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...convertForm,
          scheduled_window: windowInferred,
          quoted_price: parseFloat(convertForm.quoted_price),
          deposit_amount: parseFloat(convertForm.quoted_price) * 0.3,
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to convert');
      }
      const job = await res.json();
      toast.success('Lead converted successfully');
      router.push('/sobadmin/jobs');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/leads/${params.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete lead');
      }
      toast.success('Lead deleted successfully');
      router.push('/sobadmin/leads');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function updateStatus(status: string) {
    try {
      await fetch(`/api/leads/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setLead(l => l ? { ...l, status: status as any } : l);
      toast.success(`Status updated to ${status}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function handleEditLead() {
    try {
      const res = await fetch(`/api/leads/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) throw new Error('Failed to update lead');
      const updatedLead = await res.json();
      setLead(updatedLead);
      setEditOpen(false);
      toast.success('Lead updated successfully');
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (loading) return <p className="text-muted-foreground">Loading...</p>;
  if (!lead) return <p className="text-red-500">Lead not found</p>;

  const calculatedEndTime = calculateEndTime(convertForm.scheduled_start_time, convertForm.estimated_duration_minutes);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sobadmin/leads"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <h1 className="text-2xl font-bold">
          Lead: {lead.company_name ? `${lead.company_name} (Attn: ${lead.customer_name ?? 'Main Contact'})` : (lead.customer_name ?? 'Unknown')}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Contact Info</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {lead.company_name && (
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Company / Business</span>
                <span className="font-semibold text-primary">{lead.company_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{lead.company_name ? 'Main Contact' : 'Name'}</span>
              <span className="font-medium">
                {lead.customer_name}
                {lead.contact_title ? ` (${lead.contact_title})` : ''}
              </span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{lead.customer_phone}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{lead.customer_email}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Address / City</span><span>{lead.city}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Source</span><span>{LEAD_SOURCE_LABELS[lead.source as keyof typeof LEAD_SOURCE_LABELS] || lead.source}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Job Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span>{lead.service_type ? SERVICE_TYPE_LABELS[lead.service_type] : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{lead.preferred_date ? format(new Date(lead.preferred_date), 'MMM d, yyyy') : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Preferred Time</span><span>{lead.preferred_start_time ? format12Hour(lead.preferred_start_time) : (lead.preferred_window ? TIME_WINDOW_LABELS[lead.preferred_window] : '—')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Square Footage</span><span>{lead.home_size_sqft ? `${lead.home_size_sqft.toLocaleString()} sqft` : '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Bedrooms</span><span>{lead.home_bedrooms ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Bathrooms</span><span>{lead.home_bathrooms ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Condition</span><span className="capitalize">{lead.condition ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pets</span><span>{lead.has_pets ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Quoted Price</span><span className="font-bold">{lead.quoted_price ? `$${lead.quoted_price}` : '—'}</span></div>
          </CardContent>
        </Card>
      </div>

      {lead.notes && (
        <Card>
          <CardHeader><CardTitle>Scope of Work / Quote Breakdown</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm whitespace-pre-wrap font-mono bg-muted/40 p-4 rounded-lg border text-foreground">
              {lead.notes}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Select onValueChange={updateStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Update status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="quoted">Quoted</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>

        <Dialog modal={false} open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Pencil className="h-4 w-4 mr-2" /> Edit</Button>
          </DialogTrigger>
          <DialogContent 
            className="max-h-[90vh] overflow-y-auto sm:max-w-lg w-full bg-slate-900 border border-white/10 text-white dark p-6 shadow-2xl rounded-2xl"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-white text-lg font-bold">Edit Lead</DialogTitle>
              <DialogDescription className="sr-only">
                Edit the contact information and job details for this lead.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 min-w-0">
              <div><Label className="text-white/80">Company / Business Name</Label><Input className="bg-black/40 border-white/10 text-white" value={editForm.company_name || ''} onChange={e => setEditForm({ ...editForm, company_name: e.target.value })} placeholder="e.g. John's Roofing" /></div>
              <div><Label className="text-white/80">Main Contact Person</Label><Input className="bg-black/40 border-white/10 text-white" value={editForm.customer_name || ''} onChange={e => setEditForm({ ...editForm, customer_name: e.target.value })} placeholder="e.g. Mark" /></div>
              <div><Label className="text-white/80">Contact Title / Role</Label><Input className="bg-black/40 border-white/10 text-white" value={editForm.contact_title || ''} onChange={e => setEditForm({ ...editForm, contact_title: e.target.value })} placeholder="e.g. Site Supervisor, PM, Owner" /></div>
              <div><Label className="text-white/80">Phone</Label><Input className="bg-black/40 border-white/10 text-white" value={editForm.customer_phone || ''} onChange={e => setEditForm({ ...editForm, customer_phone: e.target.value })} /></div>
              <div><Label className="text-white/80">Email</Label><Input className="bg-black/40 border-white/10 text-white" value={editForm.customer_email || ''} onChange={e => setEditForm({ ...editForm, customer_email: e.target.value })} /></div>
              <div><Label className="text-white/80">City / Address</Label><Input className="bg-black/40 border-white/10 text-white" value={editForm.city || ''} onChange={e => setEditForm({ ...editForm, city: e.target.value })} /></div>
              <div>
                <Label className="text-white/80">Service Type</Label>
                <Select value={editForm.service_type || ''} onValueChange={v => setEditForm({ ...editForm, service_type: v as any })}>
                  <SelectTrigger className="w-full bg-black/40 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    {Object.entries(SERVICE_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val} className="text-white hover:bg-white/10">{label as string}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-white/80">Quoted Price</Label><Input className="bg-black/40 border-white/10 text-white" type="number" value={editForm.quoted_price || ''} onChange={e => setEditForm({ ...editForm, quoted_price: e.target.value ? parseFloat(e.target.value) : undefined })} /></div>
              <Button onClick={handleEditLead} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-11 rounded-xl shadow-lg mt-2">Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button variant="destructive" onClick={handleDelete}>
          <Trash2 className="h-4 w-4 mr-2" /> Delete
        </Button>

        {lead.status !== 'converted' && (
          <Dialog modal={false} open={convertOpen} onOpenChange={setConvertOpen}>
            <DialogTrigger asChild>
              <Button><ArrowRight className="h-4 w-4 mr-2" />Convert to Job</Button>
            </DialogTrigger>
            <DialogContent 
              className="sm:max-w-lg w-full bg-slate-900 border border-white/10 text-white dark p-6 shadow-2xl rounded-2xl"
              onInteractOutside={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle className="text-white text-lg font-bold">Convert Lead to Job</DialogTitle>
                <DialogDescription className="sr-only">
                  Fill out the details below to convert this lead into a scheduled job.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 min-w-0">
                <div><Label className="text-white/80">Zone</Label>
                  <Select value={convertForm.zone_id} onValueChange={(v) => setConvertForm({ ...convertForm, zone_id: v })}>
                    <SelectTrigger className="w-full bg-black/40 border-white/10 text-white"><SelectValue placeholder="Select zone" /></SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white max-w-[calc(100vw-2rem)] sm:max-w-md">{zones.map(z => <SelectItem key={z.id} value={z.id} className="text-white hover:bg-white/10">{z.name} ({z.city})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-white/80">Scheduled Date</Label><DatePicker value={convertForm.scheduled_date} onChange={(val) => setConvertForm({ ...convertForm, scheduled_date: val })} className="bg-black/40 border-white/10 text-white" /></div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/80">Start Time</Label>
                    <Select value={convertForm.scheduled_start_time} onValueChange={v => setConvertForm({ ...convertForm, scheduled_start_time: v })}>
                      <SelectTrigger className="w-full bg-black/40 border-white/10 text-white"><SelectValue placeholder="Select start time" /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {TIME_OPTIONS.map(t => (
                          <SelectItem key={t.value} value={t.value} className="text-white hover:bg-white/10">{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-white/80">Est. Duration</Label>
                    <Select value={convertForm.estimated_duration_minutes.toString()} onValueChange={v => setConvertForm({ ...convertForm, estimated_duration_minutes: parseInt(v, 10) })}>
                      <SelectTrigger className="w-full bg-black/40 border-white/10 text-white"><SelectValue placeholder="Select duration" /></SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10 text-white">
                        {DURATION_OPTIONS.map(d => (
                          <SelectItem key={d.value} value={d.value.toString()} className="text-white hover:bg-white/10">{d.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/25 rounded-xl text-sm flex items-center justify-between text-blue-300 font-medium">
                  <span>Job Schedule Window:</span>
                  <span className="font-bold text-white">{format12Hour(convertForm.scheduled_start_time)} → {calculatedEndTime}</span>
                </div>

                <div>
                  <Label className="text-white/80">Address</Label>
                  <AddressAutocomplete 
                    theme="dark"
                    className="bg-black/40 border-white/10 text-white"
                    value={convertForm.address_line1} 
                    onChange={e => setConvertForm({ ...convertForm, address_line1: e.target.value })} 
                    onAddressSelect={addr => setConvertForm(f => ({ ...f, address_line1: addr.address_line1, postal_code: addr.postal_code || f.postal_code }))} 
                  />
                </div>
                <div><Label className="text-white/80">Postal Code</Label><Input className="bg-black/40 border-white/10 text-white" value={convertForm.postal_code} onChange={e => setConvertForm({ ...convertForm, postal_code: e.target.value })} /></div>
                <div><Label className="text-white/80">Quoted Price</Label><Input className="bg-black/40 border-white/10 text-white" type="number" value={convertForm.quoted_price} onChange={e => setConvertForm({ ...convertForm, quoted_price: e.target.value })} /></div>
                <Button onClick={handleConvert} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold h-11 rounded-xl shadow-lg mt-2">Convert & Create Job</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
