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
import { ArrowLeft, ArrowRight, Trash2, Pencil, FileText, ExternalLink, Calendar, Clock, DollarSign, Boxes, Wrench, ShieldCheck, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
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
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
        <Link href="/sobadmin/leads" className="shrink-0">
          <Button variant="ghost" size="sm" className="h-10 md:h-8">
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold truncate">
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

      {lead.notes && (() => {
        let parsedNotes: any = null;
        if (typeof lead.notes === 'string') {
          const trimmed = lead.notes.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              parsedNotes = JSON.parse(trimmed);
            } catch {
              parsedNotes = null;
            }
          }
        } else if (typeof lead.notes === 'object' && lead.notes !== null) {
          parsedNotes = lead.notes;
        }

        if (!parsedNotes) {
          return (
            <Card>
              <CardHeader><CardTitle>Scope of Work / Quote Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="text-sm whitespace-pre-wrap font-sans bg-muted/40 p-4 rounded-lg border text-foreground leading-relaxed">
                  {lead.notes}
                </div>
              </CardContent>
            </Card>
          );
        }

        const meta = parsedNotes.tender_meta || parsedNotes;
        const labor = meta.labor_reconciliation || parsedNotes.labor_reconciliation || null;
        const supplies = Array.isArray(meta.supply_reconciliation)
          ? meta.supply_reconciliation
          : Array.isArray(parsedNotes.supply_reconciliation)
          ? parsedNotes.supply_reconciliation
          : [];
        const phases = Array.isArray(meta.phases)
          ? meta.phases
          : Array.isArray(parsedNotes.phases)
          ? parsedNotes.phases
          : [];
        const specialtyScopes = Array.isArray(meta.specialty_scopes)
          ? meta.specialty_scopes
          : Array.isArray(parsedNotes.specialty_scopes)
          ? parsedNotes.specialty_scopes
          : [];
        const equipmentNeeded = Array.isArray(meta.equipment_needed)
          ? meta.equipment_needed
          : Array.isArray(parsedNotes.equipment_needed)
          ? parsedNotes.equipment_needed
          : [];
        const gcProvided = Array.isArray(meta.gc_provided)
          ? meta.gc_provided
          : Array.isArray(parsedNotes.gc_provided)
          ? parsedNotes.gc_provided
          : [];

        const scopeSummary =
          meta.scope_summary ||
          parsedNotes.scope_summary ||
          (typeof parsedNotes.notes === 'string' ? parsedNotes.notes : null);

        const docUrl = meta.document_url || meta.pdf_public_url || meta.pdf_url;
        const docName = meta.file_name || 'Bid Proposal Document';

        return (
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3 flex-wrap gap-2 border-b">
              <div>
                <CardTitle className="text-lg font-bold">Scope of Work &amp; Quote Breakdown</CardTitle>
                {meta.project_name && (
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.project_name}</p>
                )}
              </div>
              {docUrl && (
                <a
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600/20 text-xs font-semibold"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>View Attached {meta.document_type?.toUpperCase() || 'Proposal'}</span>
                  <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              )}
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Primary Scope Summary */}
              {scopeSummary && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scope Summary</span>
                  <div className="text-sm bg-muted/40 p-4 rounded-xl border leading-relaxed text-foreground whitespace-pre-wrap">
                    {scopeSummary}
                  </div>
                </div>
              )}

              {/* Cleaning Phases & Specialty Scopes */}
              {(phases.length > 0 || specialtyScopes.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {phases.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-card border space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        Cleaning Phases ({phases.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {phases.map((ph: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="bg-indigo-500/10 text-indigo-300 border-indigo-500/30 text-xs">
                            {ph}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {specialtyScopes.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-card border space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Specialty Scopes ({specialtyScopes.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {specialtyScopes.map((scope: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/30 text-xs">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Labor Plan & Wages */}
              {labor && (
                <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/30 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-sm text-foreground">Labor &amp; Margin Plan</span>
                    </div>
                    {labor.active_cleaner_pool && (
                      <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px]">
                        Reconciled with {labor.active_cleaner_pool} Fleet Cleaners
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="p-2.5 rounded-lg bg-background/60 border">
                      <span className="text-muted-foreground text-[11px] block">Est. Labor Hours</span>
                      <p className="font-bold text-sm mt-0.5">{labor.estimated_hours ? `${labor.estimated_hours} hrs` : '—'}</p>
                      {labor.recommended_crew_size && (
                        <span className="text-[10px] text-muted-foreground">{labor.recommended_crew_size} cleaners ({labor.estimated_shifts || 1} shifts)</span>
                      )}
                    </div>
                    <div className="p-2.5 rounded-lg bg-background/60 border">
                      <span className="text-muted-foreground text-[11px] block">Avg Cleaner Wage</span>
                      <p className="font-bold text-sm mt-0.5">{labor.avg_cleaner_wage ? `$${Number(labor.avg_cleaner_wage).toFixed(2)}/hr` : '—'}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background/60 border">
                      <span className="text-muted-foreground text-[11px] block">Est. Payroll Cost</span>
                      <p className="font-bold text-sm mt-0.5">{labor.total_labor_cost ? `$${Number(labor.total_labor_cost).toLocaleString()}` : '—'}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-background/60 border">
                      <span className="text-muted-foreground text-[11px] block">Est. Gross Profit</span>
                      <p className="font-bold text-emerald-400 text-sm mt-0.5">
                        {labor.projected_gross_profit ? `$${Number(labor.projected_gross_profit).toLocaleString()}` : '—'}
                        {labor.gross_margin_percentage != null && (
                          <span className="text-xs font-normal ml-1 text-muted-foreground">({labor.gross_margin_percentage}%)</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Supplies Required & Inventory */}
              {supplies.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                      Required Supplies &amp; Equipment ({supplies.length})
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {supplies.filter((s: any) => s.in_stock || s.is_in_stock).length} of {supplies.length} in stock
                    </span>
                  </div>
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/40 border-b text-muted-foreground font-semibold">
                        <tr>
                          <th className="p-2.5">Item Name</th>
                          <th className="p-2.5">Qty Needed</th>
                          <th className="p-2.5">Inventory Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {supplies.map((item: any, idx: number) => {
                          const inStock = item.in_stock || item.is_in_stock;
                          return (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="p-2.5 font-medium text-foreground">
                                {item.item_name}
                                {item.matched_item_name && item.matched_item_name !== item.item_name && (
                                  <span className="text-[10px] text-muted-foreground block">Matched: {item.matched_item_name}</span>
                                )}
                              </td>
                              <td className="p-2.5 text-muted-foreground">
                                {item.quantity_needed || item.quantity || 1} {item.unit || 'units'}
                              </td>
                              <td className="p-2.5">
                                {inStock ? (
                                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                    In Stock {item.quantity_on_hand != null ? `(${item.quantity_on_hand})` : ''}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                                    Order Needed
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Equipment Needed & Site Requirements */}
              {(equipmentNeeded.length > 0 || gcProvided.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {equipmentNeeded.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-card border space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-cyan-400" />
                        Equipment Required
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {equipmentNeeded.map((eq: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="bg-muted text-xs">
                            {eq}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {gcProvided.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-card border space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        GC / Client Provided on Site
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {gcProvided.map((gc: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20 text-xs">
                            {gc}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Additional Bid Terms / Notes */}
              {(meta.bid_notes || parsedNotes.bid_notes) && (
                <div className="p-3.5 rounded-xl bg-muted/20 border space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bid Notes &amp; Payment Terms</span>
                  <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {meta.bid_notes || parsedNotes.bid_notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

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
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
