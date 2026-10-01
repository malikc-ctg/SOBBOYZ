'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { SERVICE_TYPE_LABELS, DEFAULT_PRICING, LEAD_SOURCE_LABELS } from '@/types';
import type { Lead, ServiceType, TimeWindow, AddOn } from '@/types';
import Link from 'next/link';
import { CRMPricingModal } from '@/components/admin/leads/CRMPricingModal';

const ADD_ON_OPTIONS: { value: AddOn; label: string }[] = [
  { value: 'inside_fridge', label: 'Inside Fridge' },
  { value: 'inside_oven', label: 'Inside Oven' },
  { value: 'inside_cabinets', label: 'Inside Cabinets' },
  { value: 'baseboards', label: 'Baseboards' },
  { value: 'interior_windows', label: 'Interior Windows' },
];

const LEAD_STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  contacted: 'bg-amber-100 text-amber-700',
  quoted: 'bg-purple-100 text-purple-700',
  converted: 'bg-green-100 text-green-700',
  lost: 'bg-red-100 text-red-700',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // New lead form
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', customer_email: '',
    city: '', service_type: '' as ServiceType | '',
    preferred_date: '', preferred_window: '' as TimeWindow | '',
    home_bedrooms: '', home_bathrooms: '', home_size_sqft: '',
    condition: '', has_pets: false, add_ons: [] as AddOn[],
    notes: '', quoted_price: '', source: 'lsa',
  });

  async function fetchLeads() {
    try {
      const url = statusFilter !== 'all' ? `/api/leads?status=${statusFilter}` : '/api/leads';
      const res = await fetch(url);
      const data = await res.json();
      setLeads(Array.isArray(data) ? data : []);
    } catch { // err removed
      console.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchLeads(); }, [statusFilter]);

  async function handleSubmit() {
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          home_bedrooms: form.home_bedrooms ? parseInt(form.home_bedrooms) : null,
          home_bathrooms: form.home_bathrooms ? parseInt(form.home_bathrooms) : null,
          home_size_sqft: form.home_size_sqft ? parseInt(form.home_size_sqft) : null,
          quoted_price: form.quoted_price ? parseFloat(form.quoted_price) : null,
          service_type: form.service_type || null,
          preferred_window: form.preferred_window || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to create lead');
      toast.success('Lead created');
      setDrawerOpen(false);
      setForm({
        customer_name: '', customer_phone: '', customer_email: '',
        city: '', service_type: '', preferred_date: '', preferred_window: '',
        home_bedrooms: '', home_bathrooms: '', home_size_sqft: '',
        condition: '', has_pets: false, add_ons: [], notes: '', quoted_price: '',
        source: 'lsa',
      });
      fetchLeads();
    } catch {
      toast.error('Failed to create lead');
    }
  }

  // Auto-calculate suggested price
  useEffect(() => {
    if (form.service_type && !form.quoted_price) {
      const base = DEFAULT_PRICING[form.service_type as ServiceType] ?? 0;
      if (base) setForm((f) => ({ ...f, quoted_price: base.toString() }));
    }
  }, [form.service_type]);

  const filtered = leads;

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-muted-foreground text-sm">Manage incoming leads and quotes</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <CRMPricingModal onSuccess={fetchLeads} />
        </div>
      </div>

      {/* Filter chips — scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {['all', 'new', 'contacted', 'quoted', 'converted', 'lost'].map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            className="shrink-0"
            onClick={() => setStatusFilter(s)}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Client / Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quoted</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No leads found</TableCell></TableRow>
              ) : (
                filtered.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="text-xs">{format(new Date(lead.created_at), 'MMM d')}</TableCell>
                    <TableCell className="text-xs">{LEAD_SOURCE_LABELS[lead.source as keyof typeof LEAD_SOURCE_LABELS] || lead.source}</TableCell>
                    <TableCell className="text-sm">
                      {lead.company_name ? (
                        <div>
                          <div className="font-semibold text-foreground leading-tight">{lead.company_name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <span className="text-foreground/85 font-medium">Attn: {lead.customer_name || 'Main Contact'}</span>
                            {lead.contact_title ? ` · ${lead.contact_title}` : ''}
                          </div>
                        </div>
                      ) : (
                        <div className="font-medium">{lead.customer_name ?? '—'}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{lead.customer_phone ?? '—'}</TableCell>
                    <TableCell className="text-xs">{lead.city ?? '—'}</TableCell>
                    <TableCell className="text-xs">{lead.service_type ? SERVICE_TYPE_LABELS[lead.service_type] : '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`border-0 text-xs ${LEAD_STATUS_COLORS[lead.status] ?? ''}`}>
                        {lead.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{lead.quoted_price ? `$${lead.quoted_price}` : '—'}</TableCell>
                    <TableCell>
                      <Link href={`/sobadmin/leads/${lead.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
