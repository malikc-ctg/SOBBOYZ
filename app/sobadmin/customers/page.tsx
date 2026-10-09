'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Customer } from '@/types';
import Link from 'next/link';
import { deleteCustomerAction } from './actions';
import { toast } from 'sonner';
import {
  Search,
  UserCheck,
  Plus,
  Repeat,
  Building2,
  Home,
  AlertTriangle,
  CreditCard,
  DollarSign,
  Calendar,
  Clock,
  Sparkles,
  Phone,
  Mail,
  Edit2,
  Trash2,
  ExternalLink,
  PawPrint,
} from 'lucide-react';
import { AddCustomerServiceModal } from '@/components/admin/customers/AddCustomerServiceModal';
import { CustomerFormModal } from '@/components/admin/customers/CustomerFormModal';

type TabKey = 'all' | 'residential' | 'commercial' | 'recurring' | 'at_risk' | 'balances';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');

  // Modal States
  const [serviceCustomer, setServiceCustomer] = useState<Customer | null>(null);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [createCustomerType, setCreateCustomerType] = useState<'residential' | 'commercial'>('residential');

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch('/api/customers');
      const data = await res.json();
      setCustomers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load customers', e);
      toast.error('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Unique list of cities for quick filtering
  const cities = useMemo(() => {
    const set = new Set<string>();
    customers.forEach((c) => {
      if (c.city && c.city.trim() && !c.city.toLowerCase().startsWith('no-') && !c.city.match(/^\d/)) {
        set.add(c.city.trim());
      }
    });
    return Array.from(set).sort();
  }, [customers]);

  // Deduplication safeguard
  const deduplicatedCustomers = useMemo(() => {
    const seen = new Set<string>();
    return customers.filter((c) => {
      const email = (c.email || '').toLowerCase().trim();
      const isPlaceholder = email.startsWith('no-email-');
      const phoneDigits = (c.phone || '').replace(/\D/g, '');

      let key = `id:${c.id}`;
      if (!isPlaceholder && email) {
        key = `email:${email}`;
      } else if (phoneDigits.length >= 10) {
        key = `phone:${phoneDigits.slice(-10)}`;
      }

      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [customers]);

  // Metrics computation for stat cards
  const stats = useMemo(() => {
    const total = deduplicatedCustomers.length;
    const commercial = deduplicatedCustomers.filter((c) => c.customer_type === 'commercial' || Boolean(c.company_name));
    const residential = deduplicatedCustomers.filter((c) => c.customer_type !== 'commercial' && !c.company_name);
    const recurring = deduplicatedCustomers.filter((c) => c.has_recurring);
    const totalMrr = recurring.reduce((acc, c) => acc + (Number(c.mrr_amount) || 0), 0);

    const now = new Date();
    const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const atRisk = deduplicatedCustomers.filter((c) => {
      if (c.has_recurring) return false;
      if (!c.last_clean_date) return false;
      return new Date(c.last_clean_date) < fortyFiveDaysAgo;
    });

    const withBalance = deduplicatedCustomers.filter((c) => (Number(c.open_balance) || 0) > 0);

    return {
      total,
      commercialCount: commercial.length,
      residentialCount: residential.length,
      recurringCount: recurring.length,
      totalMrr: Math.round(totalMrr),
      atRiskCount: atRisk.length,
      withBalanceCount: withBalance.length,
    };
  }, [deduplicatedCustomers]);

  // Filtered by Search, City, and Tab
  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    const now = new Date();
    const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

    return deduplicatedCustomers.filter((c) => {
      const isCommercial = c.customer_type === 'commercial' || Boolean(c.company_name);

      // Tab Filter
      if (activeTab === 'residential' && isCommercial) return false;
      if (activeTab === 'commercial' && !isCommercial) return false;
      if (activeTab === 'recurring' && !c.has_recurring) return false;
      if (activeTab === 'at_risk') {
        if (c.has_recurring) return false;
        if (!c.last_clean_date || new Date(c.last_clean_date) >= fortyFiveDaysAgo) return false;
      }
      if (activeTab === 'balances' && (Number(c.open_balance) || 0) <= 0) return false;

      // City Filter
      if (cityFilter !== 'all' && c.city?.toLowerCase() !== cityFilter.toLowerCase()) {
        return false;
      }

      // Search Query
      if (!q) return true;
      return (
        c.full_name?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.commercial_facility_type?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.accounts_payable_name?.toLowerCase().includes(q)
      );
    });
  }, [deduplicatedCustomers, activeTab, cityFilter, search]);

  async function handleDelete(id: string, name: string) {
    if (
      !confirm(
        `Are you sure you want to completely delete ${name}? This action cannot be undone and will also remove their associated customer account.`
      )
    ) {
      return;
    }

    setDeletingId(id);
    const result = await deleteCustomerAction(id);

    if (result.success) {
      toast.success('Customer deleted successfully');
      setCustomers(customers.filter((c) => c.id !== id));
    } else {
      toast.error(result.error || 'Failed to delete customer');
    }
    setDeletingId(null);
  }

  function handleOpenCreate(type: 'residential' | 'commercial') {
    setEditingCustomer(null);
    setCreateCustomerType(type);
    setFormModalOpen(true);
  }

  function handleOpenEdit(customer: Customer) {
    setEditingCustomer(customer);
    setFormModalOpen(true);
  }

  return (
    <div className="space-y-5 min-w-0">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Customers</h1>
            <Badge variant="outline" className="text-xs font-semibold px-2 py-0.5 border-slate-700 bg-slate-800/80 text-slate-300">
              Enterprise CRM
            </Badge>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            {stats.total} total · {stats.residentialCount} Residential · {stats.commercialCount} Commercial
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenCreate('residential')}
            className="text-blue-400 border-blue-800/80 bg-blue-950/30 hover:bg-blue-900/50 hover:text-blue-200 h-9 font-semibold"
          >
            <Home className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">+ </span>Residential
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenCreate('commercial')}
            className="bg-purple-600 hover:bg-purple-500 text-white shadow-sm h-9 font-semibold"
          >
            <Building2 className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">+ </span>Commercial
          </Button>
        </div>
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card
          onClick={() => setActiveTab('all')}
          className={`cursor-pointer transition-all bg-slate-900/80 border-slate-800 hover:border-slate-700 ${
            activeTab === 'all' ? 'border-slate-500 bg-slate-800/90 ring-1 ring-slate-500 shadow-lg' : ''
          }`}
        >
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
              <span>All Accounts</span>
              <UserCheck className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <p className="text-2xl font-black text-white">{stats.total}</p>
            <p className="text-[11px] text-slate-400">Active client directory</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab('residential')}
          className={`cursor-pointer transition-all bg-slate-900/80 border-slate-800 hover:border-blue-800 ${
            activeTab === 'residential' ? 'border-blue-500 bg-blue-950/50 ring-1 ring-blue-500 shadow-lg' : ''
          }`}
        >
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-blue-400 text-xs font-medium">
              <span>Residential</span>
              <Home className="h-3.5 w-3.5 text-blue-400" />
            </div>
            <p className="text-2xl font-black text-blue-400">{stats.residentialCount}</p>
            <p className="text-[11px] text-blue-300/80">Homes & Condos</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab('commercial')}
          className={`cursor-pointer transition-all bg-slate-900/80 border-slate-800 hover:border-purple-800 ${
            activeTab === 'commercial' ? 'border-purple-500 bg-purple-950/50 ring-1 ring-purple-500 shadow-lg' : ''
          }`}
        >
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-purple-400 text-xs font-medium">
              <span>Commercial</span>
              <Building2 className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <p className="text-2xl font-black text-purple-400">{stats.commercialCount}</p>
            <p className="text-[11px] text-purple-300/80">Corporate & Clinics</p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab('recurring')}
          className={`cursor-pointer transition-all bg-slate-900/80 border-slate-800 hover:border-emerald-800 ${
            activeTab === 'recurring' ? 'border-emerald-500 bg-emerald-950/50 ring-1 ring-emerald-500 shadow-lg' : ''
          }`}
        >
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
              <span>Recurring VIPs</span>
              <Repeat className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400">{stats.recurringCount}</p>
            <p className="text-[11px] text-emerald-300/80">
              {stats.totalMrr > 0 ? `$${stats.totalMrr.toLocaleString()}/mo MRR` : 'Contracts'}
            </p>
          </CardContent>
        </Card>

        <Card
          onClick={() => setActiveTab('at_risk')}
          className={`cursor-pointer transition-all bg-slate-900/80 border-slate-800 hover:border-amber-800 ${
            activeTab === 'at_risk' ? 'border-amber-500 bg-amber-950/50 ring-1 ring-amber-500 shadow-lg' : ''
          }`}
        >
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
              <span>At-Risk / Inactive</span>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-400">{stats.atRiskCount}</p>
            <p className="text-[11px] text-amber-300/80">&gt;45 days no clean</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
          <Button
            variant={activeTab === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('all')}
            className={`h-8 text-xs whitespace-nowrap font-semibold ${
              activeTab === 'all'
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            All Accounts ({stats.total})
          </Button>

          <Button
            variant={activeTab === 'residential' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('residential')}
            className={`h-8 text-xs whitespace-nowrap font-semibold ${
              activeTab === 'residential'
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Home className="h-3.5 w-3.5 mr-1" />
            Residential ({stats.residentialCount})
          </Button>

          <Button
            variant={activeTab === 'commercial' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('commercial')}
            className={`h-8 text-xs whitespace-nowrap font-semibold ${
              activeTab === 'commercial'
                ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Building2 className="h-3.5 w-3.5 mr-1" />
            Commercial ({stats.commercialCount})
          </Button>

          <Button
            variant={activeTab === 'recurring' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('recurring')}
            className={`h-8 text-xs whitespace-nowrap font-semibold ${
              activeTab === 'recurring'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Repeat className="h-3.5 w-3.5 mr-1" />
            Recurring MRR ({stats.recurringCount})
          </Button>

          <Button
            variant={activeTab === 'at_risk' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('at_risk')}
            className={`h-8 text-xs whitespace-nowrap font-semibold ${
              activeTab === 'at_risk'
                ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'
                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            At-Risk ({stats.atRiskCount})
          </Button>

          {stats.withBalanceCount > 0 && (
            <Button
              variant={activeTab === 'balances' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('balances')}
              className={`h-8 text-xs whitespace-nowrap font-semibold ${
                activeTab === 'balances'
                  ? 'bg-red-600 hover:bg-red-500 text-white border-red-500'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <CreditCard className="h-3.5 w-3.5 mr-1" />
              Balances Due ({stats.withBalanceCount})
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {cities.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="h-9 px-2.5 text-xs rounded-lg border border-slate-700 bg-slate-900 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Cities ({cities.length})</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search by name, company, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-xs bg-slate-900 border-slate-700 text-slate-200 placeholder:text-slate-500 focus-visible:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Main Customers Table */}
      <Card className="bg-slate-900/90 border-slate-800 shadow-xl rounded-xl">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow className="bg-slate-950 border-b border-slate-800 hover:bg-slate-950">
                <TableHead className="w-[280px] text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5">Customer / Account</TableHead>
                <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5">Type & Specs</TableHead>
                <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5">Contact & Address</TableHead>
                <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5">Contract / Frequency</TableHead>
                <TableHead className="text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5">Activity & Value</TableHead>
                <TableHead className="text-right text-slate-300 font-bold text-xs uppercase tracking-wider py-3.5">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                      <span className="text-xs">Loading customer directory...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                    <div className="space-y-2">
                      <UserCheck className="h-8 w-8 text-slate-600 mx-auto" />
                      <p className="text-sm font-semibold text-slate-200">No matching accounts found</p>
                      <p className="text-xs text-slate-400">
                        {search
                          ? `No results matching "${search}" in this category`
                          : 'No accounts present in this tab.'}
                      </p>
                      <div className="pt-2 flex items-center justify-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCreate('residential')}
                          className="text-blue-400 border-blue-800 hover:bg-blue-950/60 text-xs"
                        >
                          + New Residential
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleOpenCreate('commercial')}
                          className="bg-purple-600 hover:bg-purple-500 text-white text-xs"
                        >
                          + New Commercial
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCustomers.map((c) => {
                  const isCommercial = c.customer_type === 'commercial' || Boolean(c.company_name);

                  return (
                    <TableRow key={c.id} className="border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors">
                      {/* Column 1: Customer / Account */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/sobadmin/customers/${c.id}`}
                              className="font-bold text-sm text-white hover:text-blue-400 transition-colors flex items-center gap-1.5"
                            >
                              {isCommercial ? (
                                <>
                                  <Building2 className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                                  <span>{c.company_name || c.full_name}</span>
                                </>
                              ) : (
                                <>
                                  <Home className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                  <span>{c.full_name}</span>
                                </>
                              )}
                            </Link>
                          </div>

                          {isCommercial && c.company_name && (
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <span>Attn:</span>
                              <strong className="text-slate-200 font-medium">{c.full_name}</strong>
                              {c.accounts_payable_name && (
                                <span className="text-[10px] text-slate-400">
                                  (AP: {c.accounts_payable_name})
                                </span>
                              )}
                            </p>
                          )}

                          <div className="flex items-center gap-1.5 pt-0.5">
                            <span className="font-mono text-[10px] text-slate-400">
                              #{c.id.substring(0, 8)}
                            </span>
                            {c.referral_code && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-blue-800 text-blue-300 font-mono bg-blue-950/60">
                                {c.referral_code}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Column 2: Type & Specs */}
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {isCommercial ? (
                            <div>
                              <Badge className="bg-purple-950/80 hover:bg-purple-900/80 text-purple-300 border border-purple-800 text-[10px] capitalize font-medium">
                                Commercial
                              </Badge>
                              <div className="text-[11px] text-slate-300 mt-1 capitalize font-medium">
                                {c.commercial_facility_type?.replace(/_/g, ' ') || 'Office / Facility'}
                                {c.square_footage ? ` • ${c.square_footage.toLocaleString()} sq ft` : ''}
                              </div>
                              {c.billing_terms && c.billing_terms !== 'due_on_receipt' && (
                                <Badge variant="outline" className="text-[9px] mt-0.5 border-purple-800 text-purple-300 bg-purple-950/50 uppercase">
                                  {c.billing_terms.replace(/_/g, ' ')}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <div>
                              <Badge className="bg-blue-950/80 hover:bg-blue-900/80 text-blue-300 border border-blue-800 text-[10px] font-medium">
                                Residential
                              </Badge>
                              <div className="text-[11px] text-slate-300 mt-1 flex items-center gap-1.5 font-medium">
                                <span>
                                  {c.home_bedrooms ?? 3} Bed / {c.home_bathrooms ?? 2} Bath
                                </span>
                                {c.pet_details && (
                                  <span title={`Pets: ${c.pet_details}`} className="text-amber-400">
                                    <PawPrint className="h-3 w-3 inline" />
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Column 3: Contact & Address */}
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{c.phone || '—'}</span>
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-300">
                            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[160px]">
                              {c.email?.startsWith('no-email-') ? (
                                <span className="italic text-slate-500">No email</span>
                              ) : (
                                c.email
                              )}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-300 flex items-center gap-1 font-medium">
                            <span>{c.city ?? '—'}</span>
                            {c.zone && (
                              <Badge variant="outline" className="text-[9px] py-0 px-1 border-slate-700 bg-slate-800 text-slate-300">
                                {c.zone.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Column 4: Contract / Frequency */}
                      <TableCell>
                        <div className="space-y-1 text-xs">
                          {c.has_recurring ? (
                            <div>
                              <Badge className="bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[10px] font-medium flex items-center gap-1 w-fit">
                                <Repeat className="h-2.5 w-2.5" />
                                Active Subscriber
                              </Badge>
                              {c.mrr_amount && c.mrr_amount > 0 && (
                                <p className="text-xs font-bold text-emerald-400 mt-1">
                                  ${c.mrr_amount.toFixed(0)}
                                  <span className="text-[10px] font-normal text-slate-400">/mo MRR</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">
                              One-time / As needed
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Column 5: Activity & Value */}
                      <TableCell>
                        <div className="space-y-0.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400 text-[11px]">Completed:</span>
                            <span className="font-semibold text-white">{c.jobs_count ?? 0} jobs</span>
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-400 text-[11px]">Spend:</span>
                            <span className="font-bold text-emerald-400">
                              ${(c.lifetime_spend || 0).toLocaleString()}
                            </span>
                          </div>

                          {c.last_clean_date && (
                            <div className="text-[10px] text-slate-400 pt-0.5">
                              Last: {new Date(c.last_clean_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Column 6: Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-400 border-blue-800 bg-blue-950/40 hover:bg-blue-900/60 hover:text-blue-200 h-7 text-xs px-2 font-medium"
                            onClick={() => {
                              setServiceCustomer(c);
                              setServiceModalOpen(true);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Service
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
                            onClick={() => handleOpenEdit(c)}
                            title="Edit Customer Profile"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>

                          <Link href={`/sobadmin/customers/${c.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 text-xs px-2 font-medium text-slate-300 hover:text-white hover:bg-slate-800">
                              View
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </Link>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-500 hover:text-red-400 hover:bg-red-950/40"
                            onClick={() => handleDelete(c.id, isCommercial ? c.company_name || c.full_name : c.full_name)}
                            disabled={deletingId === c.id}
                            title="Delete Customer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add / Edit Customer Form Modal */}
      <CustomerFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        customer={editingCustomer}
        defaultType={createCustomerType}
        onSuccess={() => {
          fetchCustomers();
        }}
      />

      {/* Add Service Modal */}
      <AddCustomerServiceModal
        customer={serviceCustomer}
        open={serviceModalOpen}
        onOpenChange={setServiceModalOpen}
        defaultTab="recurring"
        onSuccess={fetchCustomers}
      />
    </div>
  );
}
