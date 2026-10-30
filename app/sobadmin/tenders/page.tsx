'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  Users,
  Plus,
  Search,
  Copy,
  Check,
  Mail,
  Phone,
  Globe,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';
import { SERVICE_TYPE_LABELS } from '@/types';
import type { ServiceType } from '@/types';
import { CRMPricingModal } from '@/components/admin/leads/CRMPricingModal';

const CHECKLIST_LABELS: Record<string, string> = {
  coi: 'COI Insurance',
  wsib: 'WSIB Clearance',
  profile: 'Capability One-Pager',
  references: 'Trade References',
  portal: 'Portal Registration',
};

const APPROVAL_STATUS_META: Record<
  string,
  { label: string; badgeClass: string }
> = {
  pending_submission: {
    label: 'Pre-Qual Pending',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  submitted: {
    label: 'Package Submitted',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  approved: {
    label: 'Approved Vendor',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
};

const BID_STATUS_META: Record<string, { label: string; badgeClass: string }> = {
  itb_received: {
    label: 'ITB Received / Pricing',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  site_visit: {
    label: 'Site Visit / Walkthrough',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  bid_submitted: {
    label: 'Bid Submitted',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  awarded: {
    label: 'Awarded / Won',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  not_awarded: {
    label: 'Not Awarded',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  },
};

const SECTOR_LABELS: Record<string, string> = {
  post_construction: 'Post-Construction',
  franchise_owners: 'Franchise Owners',
  commercial_office: 'Commercial Offices',
  property_management: 'Property Management',
  industrial_warehouse: 'Industrial & Warehouses',
  medical_healthcare: 'Medical & Healthcare',
  retail_hospitality: 'Retail & Hospitality',
};

function renderDueBadge(dateStr: string | null) {
  if (!dateStr) return <span className="text-muted-foreground text-xs">No deadline set</span>;
  try {
    const d = parseISO(dateStr);
    const diff = differenceInCalendarDays(d, new Date());
    const formatted = format(d, 'MMM d, yyyy');
    if (diff < 0) {
      return (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="bg-rose-500/15 text-rose-300 border-rose-500/30 text-[11px]">
            Past Due ({Math.abs(diff)}d ago)
          </Badge>
          <span className="text-xs text-muted-foreground">{formatted}</span>
        </div>
      );
    }
    if (diff === 0) {
      return (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] font-bold">
            Due Today
          </Badge>
          <span className="text-xs text-muted-foreground">{formatted}</span>
        </div>
      );
    }
    if (diff <= 5) {
      return (
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[11px]">
            Due in {diff}d
          </Badge>
          <span className="text-xs text-muted-foreground">{formatted}</span>
        </div>
      );
    }
    return <span className="text-xs font-medium">{formatted}</span>;
  } catch {
    return <span className="text-xs">{dateStr}</span>;
  }
}

export default function VendorListsAndTendersPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [tenders, setTenders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'companies' | 'tenders'>('companies');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // New Tender Modal State
  const [tenderModalOpen, setTenderModalOpen] = useState(false);
  const [submittingTender, setSubmittingTender] = useState(false);
  const [tenderForm, setTenderForm] = useState({
    company_name: '',
    customer_name: '',
    contact_title: '',
    customer_phone: '',
    customer_email: '',
    city: 'GTA',
    service_type: 'post_construction_clean' as ServiceType,
    project_name: '',
    bid_due_date: '',
    bid_status: 'itb_received',
    portal_url: '',
    sqft: '',
    quoted_price: '',
    scope_summary: '',
  });

  async function fetchVendorAndTenders() {
    setLoading(true);
    try {
      const res = await fetch('/api/sales/vendor-list');
      const data = await res.json();
      if (data.success) {
        setCompanies(Array.isArray(data.companies) ? data.companies : []);
        setTenders(Array.isArray(data.tenders) ? data.tenders : []);
      }
    } catch (err) {
      console.error('Failed to load vendor lists & tenders:', err);
      toast.error('Failed to load Vendor Lists & Tenders');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchVendorAndTenders();
  }, []);

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleExpandCompany = (companyKey: string) => {
    setExpandedCompanies((prev) => ({
      ...prev,
      [companyKey]: !prev[companyKey],
    }));
  };

  const handleToggleChecklistItem = async (company: any, itemId: string) => {
    const currentCompleted: string[] = Array.isArray(company.completed_items)
      ? company.completed_items
      : [];
    const nextCompleted = currentCompleted.includes(itemId)
      ? currentCompleted.filter((i) => i !== itemId)
      : [...currentCompleted, itemId];

    // Optimistic update
    setCompanies((prev) =>
      prev.map((c) =>
        c.company_key === company.company_key
          ? { ...c, completed_items: nextCompleted }
          : c
      )
    );

    try {
      const res = await fetch('/api/sales/vendor-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_key: company.company_key,
          completed_items: nextCompleted,
        }),
      });
      if (!res.ok) throw new Error('Failed to update checklist');
    } catch {
      toast.error('Failed to save checklist update');
      fetchVendorAndTenders();
    }
  };

  const handleUpdateApprovalStatus = async (companyKey: string, newStatus: string) => {
    setCompanies((prev) =>
      prev.map((c) =>
        c.company_key === companyKey ? { ...c, approval_status: newStatus } : c
      )
    );

    try {
      const res = await fetch('/api/sales/vendor-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_key: companyKey,
          approval_status: newStatus,
        }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      toast.success('Vendor approval status updated');
    } catch {
      toast.error('Failed to update status');
      fetchVendorAndTenders();
    }
  };

  const handleRestoreToOutbound = async (company: any) => {
    try {
      const res = await fetch('/api/sales/vendor-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restore_to_outbound',
          company_key: company.company_key,
        }),
      });
      if (!res.ok) throw new Error('Failed to restore company');
      toast.success(
        `Restored ${company.company_name} (${company.contacts_count} contacts) back to Outbound B2B Phone OS`
      );
      setCompanies((prev) => prev.filter((c) => c.company_key !== company.company_key));
    } catch {
      toast.error('Failed to restore company');
    }
  };

  const openNewTenderForCompany = (company?: any) => {
    if (company) {
      const primary = company.primary_contact || company.contacts?.[0] || {};
      setTenderForm({
        company_name: company.company_name || '',
        customer_name: primary.name || '',
        contact_title: primary.position || 'Estimator',
        customer_phone: primary.phone || '',
        customer_email: company.procurement_email || primary.email || '',
        city: company.city || 'GTA',
        service_type: (company.service_type as ServiceType) || 'post_construction_clean',
        project_name: '',
        bid_due_date: company.next_tender_date || '',
        bid_status: 'itb_received',
        portal_url: company.portal_url || '',
        sqft: '',
        quoted_price: '',
        scope_summary: '',
      });
    } else {
      setTenderForm({
        company_name: '',
        customer_name: '',
        contact_title: '',
        customer_phone: '',
        customer_email: '',
        city: 'GTA',
        service_type: 'post_construction_clean',
        project_name: '',
        bid_due_date: '',
        bid_status: 'itb_received',
        portal_url: '',
        sqft: '',
        quoted_price: '',
        scope_summary: '',
      });
    }
    setTenderModalOpen(true);
  };

  const handleCreateTenderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingTender) return;
    setSubmittingTender(true);
    try {
      const res = await fetch('/api/sales/vendor-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_tender',
          ...tenderForm,
        }),
      });
      if (!res.ok) throw new Error('Failed to create tender');
      toast.success('Commercial Bid / Tender logged');
      setTenderModalOpen(false);
      setActiveTab('tenders');
      fetchVendorAndTenders();
    } catch {
      toast.error('Failed to create tender');
    } finally {
      setSubmittingTender(false);
    }
  };

  const handleUpdateTenderStatus = async (tenderId: string, newBidStatus: string) => {
    setTenders((prev) =>
      prev.map((t) => (t.id === tenderId ? { ...t, bid_status: newBidStatus } : t))
    );
    try {
      const res = await fetch('/api/sales/vendor-list', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tender_id: tenderId,
          bid_status: newBidStatus,
        }),
      });
      if (!res.ok) throw new Error('Failed to update tender');
      toast.success('Tender status updated');
    } catch {
      toast.error('Failed to update tender');
      fetchVendorAndTenders();
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      if (statusFilter !== 'all' && c.approval_status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inCompany = (c.company_name || '').toLowerCase().includes(q);
        const inContacts = (c.contacts || []).some(
          (col: any) =>
            (col.name || '').toLowerCase().includes(q) ||
            (col.email || '').toLowerCase().includes(q) ||
            (col.phone || '').toLowerCase().includes(q)
        );
        return inCompany || inContacts;
      }
      return true;
    });
  }, [companies, statusFilter, searchQuery]);

  const filteredTenders = useMemo(() => {
    return tenders.filter((t) => {
      if (statusFilter !== 'all' && t.bid_status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          (t.company_name || '').toLowerCase().includes(q) ||
          (t.project_name || '').toLowerCase().includes(q) ||
          (t.customer_name || '').toLowerCase().includes(q) ||
          (t.city || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tenders, statusFilter, searchQuery]);

  const totalBundledContacts = useMemo(
    () => companies.reduce((acc, c) => acc + (c.contacts_count || 0), 0),
    [companies]
  );

  const approvedCount = useMemo(
    () => companies.filter((c) => c.approval_status === 'approved').length,
    [companies]
  );

  const pendingPreQualCount = useMemo(
    () => companies.filter((c) => c.approval_status === 'pending_submission').length,
    [companies]
  );

  const openTendersValue = useMemo(
    () =>
      tenders
        .filter((t) => t.bid_status !== 'not_awarded')
        .reduce((acc, t) => acc + (Number(t.quoted_price) || 0), 0),
    [tenders]
  );

  return (
    <div className="space-y-5 min-w-0">
      {/* Inbound CRM Section Switcher Strip */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3 overflow-x-auto">
        <Link href="/sobadmin/leads">
          <Button variant="ghost" size="sm" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Standard Inbound Leads
          </Button>
        </Link>
        <Link href="/sobadmin/tenders">
          <Button variant="default" size="sm" className="text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white">
            <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
            Vendor Lists &amp; Commercial Tenders
          </Button>
        </Link>
        <Link href="/sobadmin/customers">
          <Button variant="ghost" size="sm" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
            Customer Accounts CRM
          </Button>
        </Link>
      </div>

      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Vendor Lists &amp; Commercial Tenders
            </h1>
            <Badge
              variant="outline"
              className="text-xs font-semibold px-2 py-0.5 border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
            >
              Inbound CRM
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Rolled-up B2B companies requiring subcontractor pre-qualification (COI, WSIB, BuildingConnected) and live project invitations to bid (ITBs)
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            size="sm"
            onClick={() => openNewTenderForCompany()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Log New Tender / Bid
          </Button>
          <CRMPricingModal onSuccess={fetchVendorAndTenders} />
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Vendor List Companies</p>
              <p className="text-2xl font-extrabold mt-0.5">{companies.length}</p>
              <p className="text-[11px] text-indigo-400 mt-0.5">
                {totalBundledContacts} bundled estimator/PM contacts
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pre-Qual To Submit</p>
              <p className="text-2xl font-extrabold text-amber-400 mt-0.5">{pendingPreQualCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Awaiting COI / WSIB / Portal
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Approved Vendor Lists</p>
              <p className="text-2xl font-extrabold text-emerald-400 mt-0.5">{approvedCount}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Ready for incoming ITBs
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-border/60">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Active Bids &amp; Tenders</p>
              <p className="text-2xl font-extrabold text-cyan-400 mt-0.5">{tenders.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                ${openTendersValue.toLocaleString()} active bid pipeline
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Toggle + Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'companies' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setActiveTab('companies');
              setStatusFilter('all');
            }}
            className="gap-1.5 text-xs font-bold"
          >
            <Building2 className="w-3.5 h-3.5" />
            Vendor List Companies ({companies.length})
          </Button>
          <Button
            variant={activeTab === 'tenders' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setActiveTab('tenders');
              setStatusFilter('all');
            }}
            className="gap-1.5 text-xs font-bold"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Project Bids &amp; Tenders ({tenders.length})
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search company, estimator, project..."
              className="pl-8 h-8 text-xs"
            />
          </div>

          {activeTab === 'companies' ? (
            <div className="flex items-center gap-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'pending_submission', label: 'Pending' },
                { key: 'submitted', label: 'Submitted' },
                { key: 'approved', label: 'Approved' },
              ].map((f) => (
                <Button
                  key={f.key}
                  variant={statusFilter === f.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'itb_received', label: 'ITB / Pricing' },
                { key: 'bid_submitted', label: 'Submitted' },
                { key: 'awarded', label: 'Awarded' },
              ].map((f) => (
                <Button
                  key={f.key}
                  variant={statusFilter === f.key ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: ROLLED-UP VENDOR LIST COMPANIES */}
      {activeTab === 'companies' && (
        <div className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                Loading Vendor List accounts...
              </CardContent>
            </Card>
          ) : filteredCompanies.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center space-y-2">
                <Building2 className="w-8 h-8 text-muted-foreground mx-auto" />
                <div className="text-sm font-semibold">No Vendor List companies found</div>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  When calling in <strong>B2B Phone Sales OS</strong>, log the{' '}
                  <strong>Vendor List / Bids &amp; Tenders</strong> outcome on any contact to roll the
                  entire company and all of its colleagues into this workspace.
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredCompanies.map((company) => {
              const isExpanded = Boolean(expandedCompanies[company.company_key]);
              const statusMeta =
                APPROVAL_STATUS_META[company.approval_status] ||
                APPROVAL_STATUS_META.pending_submission;
              const checklist: string[] = Array.isArray(company.checklist)
                ? company.checklist
                : ['coi', 'wsib', 'profile'];
              const completed: string[] = Array.isArray(company.completed_items)
                ? company.completed_items
                : [];

              return (
                <Card
                  key={company.company_key}
                  className="border-border/70 bg-card/80 overflow-hidden"
                >
                  <CardContent className="p-4 sm:p-5 space-y-4">
                    {/* Top Row: Company Identity + Status + Actions */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base sm:text-lg font-extrabold tracking-tight">
                            {company.company_name}
                          </h3>
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {SECTOR_LABELS[company.sector] || 'Commercial'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {company.city}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          {company.primary_contact && (
                            <span>
                              Primary Contact:{' '}
                              <strong className="text-foreground">
                                {company.primary_contact.name}
                              </strong>{' '}
                              ({company.primary_contact.position})
                            </span>
                          )}
                          {company.procurement_email && (
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  company.procurement_email,
                                  `email-${company.company_key}`
                                )
                              }
                              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-mono"
                            >
                              <Mail className="w-3 h-3" />
                              <span>{company.procurement_email}</span>
                              {copiedKey === `email-${company.company_key}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-70" />
                              )}
                            </button>
                          )}
                          {company.portal_url && (
                            <span className="inline-flex items-center gap-1 text-sky-400">
                              <Globe className="w-3 h-3" />
                              <span>Portal: {company.portal_url}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right Controls */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <select
                          value={company.approval_status}
                          onChange={(e) =>
                            handleUpdateApprovalStatus(
                              company.company_key,
                              e.target.value
                            )
                          }
                          className="h-8 rounded-lg bg-background border border-border px-2.5 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                        >
                          <option value="pending_submission">Pre-Qual Pending</option>
                          <option value="submitted">Package Submitted</option>
                          <option value="approved">Approved Vendor</option>
                        </select>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openNewTenderForCompany(company)}
                          className="h-8 text-xs font-bold border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/15 gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Log Tender / ITB
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleExpandCompany(company.company_key)}
                          className="h-8 text-xs font-bold gap-1.5"
                        >
                          <Users className="w-3.5 h-3.5 text-indigo-400" />
                          <span>
                            {company.contacts_count}{' '}
                            {company.contacts_count === 1 ? 'Contact' : 'Contacts'}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Pre-Qual Checklist Strip */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                          Pre-Qual Checklist:
                        </span>
                        {checklist.map((itemId) => {
                          const isDone = completed.includes(itemId);
                          return (
                            <button
                              key={itemId}
                              type="button"
                              onClick={() => handleToggleChecklistItem(company, itemId)}
                              className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition flex items-center gap-1.5 ${
                                isDone
                                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                  : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
                              }`}
                              title="Click to toggle sent/completed"
                            >
                              {isDone ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <span className="w-3 h-3 rounded-sm border border-muted-foreground/50 inline-block" />
                              )}
                              <span>{CHECKLIST_LABELS[itemId] || itemId}</span>
                            </button>
                          );
                        })}
                      </div>

                      {company.vendor_notes && (
                        <p className="text-xs text-muted-foreground italic max-w-xl truncate">
                          &ldquo;{company.vendor_notes}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Expandable Bundled Colleague Roster (All Leads from this Company) */}
                    {isExpanded && (
                      <div className="pt-3 border-t border-border/60 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            All Bundled Decision Makers &amp; Estimators at {company.company_name} (
                            {company.contacts_count})
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRestoreToOutbound(company)}
                            className="h-7 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                            title="Move all contacts from this company back to the Outbound cold-call board"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Return Company to Outbound Board
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {(company.contacts || []).map((col: any) => (
                            <div
                              key={col.id}
                              className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                                col.is_primary
                                  ? 'bg-indigo-950/25 border-indigo-500/40'
                                  : 'bg-background/60 border-border/70'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="font-bold text-foreground truncate flex items-center gap-1.5">
                                    <span>{col.name}</span>
                                    {col.is_primary && (
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] px-1.5 py-0 border-indigo-500/40 text-indigo-300"
                                      >
                                        Primary
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground truncate">
                                    {col.position}
                                  </div>
                                </div>
                                <Link href={`/sobadmin/leads/${col.id}`}>
                                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]">
                                    View
                                  </Button>
                                </Link>
                              </div>

                              <div className="space-y-1 font-mono text-[11px] pt-1">
                                {col.phone && (
                                  <div className="flex items-center justify-between text-foreground/90">
                                    <span className="flex items-center gap-1.5 truncate">
                                      <Phone className="w-3 h-3 text-indigo-400 shrink-0" />
                                      {col.phone}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(col.phone, `phone-${col.id}`)}
                                      className="text-muted-foreground hover:text-foreground p-0.5"
                                    >
                                      {copiedKey === `phone-${col.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                )}
                                {col.email && (
                                  <div className="flex items-center justify-between text-muted-foreground font-sans">
                                    <span className="flex items-center gap-1.5 truncate">
                                      <Mail className="w-3 h-3 shrink-0" />
                                      {col.email}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(col.email, `cemail-${col.id}`)}
                                      className="text-muted-foreground hover:text-foreground p-0.5"
                                    >
                                      {copiedKey === `cemail-${col.id}` ? (
                                        <Check className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE PROJECT BIDS & TENDERS */}
      {activeTab === 'tenders' && (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-[750px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Project / Tender</TableHead>
                  <TableHead>GC / Company &amp; Estimator</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Bid Due Date</TableHead>
                  <TableHead>Bid Status</TableHead>
                  <TableHead>Bid Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Loading commercial tenders...
                    </TableCell>
                  </TableRow>
                ) : filteredTenders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No active project bids or tenders yet. Click &ldquo;Log New Tender / Bid&rdquo; when an Invitation to Bid (ITB) arrives.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenders.map((tender) => {
                    const statusMeta =
                      BID_STATUS_META[tender.bid_status] || BID_STATUS_META.itb_received;
                    return (
                      <TableRow key={tender.id}>
                        <TableCell>
                          <div className="font-bold text-sm text-foreground">
                            {tender.project_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {tender.city}
                            {tender.sqft ? ` · ${Number(tender.sqft).toLocaleString()} sq ft` : ''}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm">{tender.company_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {tender.customer_name}
                            {tender.customer_email ? ` · ${tender.customer_email}` : ''}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {SERVICE_TYPE_LABELS[tender.service_type as ServiceType] ||
                            tender.service_type}
                        </TableCell>
                        <TableCell>{renderDueBadge(tender.bid_due_date)}</TableCell>
                        <TableCell>
                          <select
                            value={tender.bid_status}
                            onChange={(e) =>
                              handleUpdateTenderStatus(tender.id, e.target.value)
                            }
                            className={`h-7 rounded-md border px-2 text-xs font-semibold bg-background ${statusMeta.badgeClass}`}
                          >
                            <option value="itb_received">ITB Received / Pricing</option>
                            <option value="site_visit">Site Visit / Walkthrough</option>
                            <option value="bid_submitted">Bid Submitted</option>
                            <option value="awarded">Awarded / Won</option>
                            <option value="not_awarded">Not Awarded</option>
                          </select>
                        </TableCell>
                        <TableCell className="text-sm font-bold">
                          {tender.quoted_price
                            ? `$${Number(tender.quoted_price).toLocaleString()}`
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/sobadmin/leads/${tender.id}`}>
                            <Button variant="ghost" size="sm" className="text-xs">
                              Open Bid
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* LOG NEW COMMERCIAL TENDER / BID MODAL */}
      <Dialog open={tenderModalOpen} onOpenChange={setTenderModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Commercial Bid / Tender (ITB)</DialogTitle>
            <DialogDescription>
              Record an incoming Invitation to Bid, RFP, or tender package from a GC or Property Manager.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTenderSubmit} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">GC / Company Name *</Label>
                <Input
                  required
                  value={tenderForm.company_name}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, company_name: e.target.value }))
                  }
                  placeholder="e.g. EllisDon / PCL"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Project / Tender Name *</Label>
                <Input
                  required
                  value={tenderForm.project_name}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, project_name: e.target.value }))
                  }
                  placeholder="e.g. Square One Retail Fit-Out"
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Estimator / Contact</Label>
                <Input
                  value={tenderForm.customer_name}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, customer_name: e.target.value }))
                  }
                  placeholder="Estimator Name"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Estimator Email</Label>
                <Input
                  type="email"
                  value={tenderForm.customer_email}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, customer_email: e.target.value }))
                  }
                  placeholder="estimating@company.com"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Phone</Label>
                <Input
                  value={tenderForm.customer_phone}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, customer_phone: e.target.value }))
                  }
                  placeholder="(416) 555-0199"
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Bid Closing / Due Date</Label>
                <Input
                  type="date"
                  value={tenderForm.bid_due_date}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, bid_due_date: e.target.value }))
                  }
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Est. Square Footage</Label>
                <Input
                  type="number"
                  value={tenderForm.sqft}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, sqft: e.target.value }))
                  }
                  placeholder="e.g. 12000"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Bid Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={tenderForm.quoted_price}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, quoted_price: e.target.value }))
                  }
                  placeholder="e.g. 4800"
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">City</Label>
                <Input
                  value={tenderForm.city}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, city: e.target.value }))
                  }
                  placeholder="Mississauga"
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Bid Status</Label>
                <select
                  value={tenderForm.bid_status}
                  onChange={(e) =>
                    setTenderForm((f) => ({ ...f, bid_status: e.target.value }))
                  }
                  className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2.5 text-xs"
                >
                  <option value="itb_received">ITB Received / Pricing</option>
                  <option value="site_visit">Site Visit / Walkthrough</option>
                  <option value="bid_submitted">Bid Submitted</option>
                  <option value="awarded">Awarded / Won</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Scope &amp; Tender Notes</Label>
              <Textarea
                rows={2}
                value={tenderForm.scope_summary}
                onChange={(e) =>
                  setTenderForm((f) => ({ ...f, scope_summary: e.target.value }))
                }
                placeholder="Drawings received via BuildingConnected — rough + final clean + interior glass..."
                className="mt-1 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setTenderModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingTender}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
              >
                {submittingTender ? 'Saving...' : 'Save Tender'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
