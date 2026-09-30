'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { 
  Briefcase, Radio, AlertCircle, 
  Search, MapPin, Clock, 
  ArrowRight, CheckCircle2,
  TrendingUp, Calendar, Globe, Map, List,
  Plus, UserCheck, Sparkles, Phone, Mail, ExternalLink,
  ChevronRight
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isThisWeek } from 'date-fns';
import Link from 'next/link';
import type { Job, Employee, Zone, Lead } from '@/types';
import { SERVICE_TYPE_LABELS, JOB_STATUS_LABELS } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CRMPricingModal } from '@/components/admin/leads/CRMPricingModal';

const DispatchMap = dynamic(() => import('./DispatchMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[calc(100vh-64px)] bg-black/90 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/40 text-xs">Initializing dispatch map...</p>
      </div>
    </div>
  ),
});

type TimeframeFilter = 'today' | 'tomorrow' | 'week' | 'unassigned' | 'all';

export function AdminDashboard() {
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isClient, setIsClient] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');
  
  const supabase = createClient();
  const supabaseRef = useRef(supabase);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadData = async () => {
    try {
      const [jobsRes, employeesRes, zonesRes, leadsRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch('/api/employees'),
        fetch('/api/zones'),
        fetch('/api/leads'),
      ]);

      if (jobsRes.ok) {
        const jobsData = await jobsRes.json();
        setAllJobs(Array.isArray(jobsData) ? jobsData : []);
      }

      if (employeesRes.ok) {
        const employeesData = await employeesRes.json();
        setEmployees(Array.isArray(employeesData) ? employeesData : []);
      }

      if (zonesRes.ok) {
        const zonesData = await zonesRes.json();
        setZones(Array.isArray(zonesData) ? zonesData : []);
      }

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(Array.isArray(leadsData) ? leadsData : []);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Realtime subscription for live job updates
  useEffect(() => {
    const channel = supabaseRef.current
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload: any) => {
        const newRecord = payload.new as Job;
        const eventType = payload.eventType;
        
        setAllJobs(prev => {
          const filtered = prev.filter(j => j.id !== newRecord.id);
          if (eventType === 'DELETE') return filtered;
          return [newRecord, ...filtered];
        });
      })
      .subscribe();

    return () => { supabaseRef.current.removeChannel(channel); };
  }, []);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Breakdown jobs by timeframe
  const todayJobs = useMemo(() => allJobs.filter(j => j.scheduled_date === todayStr), [allJobs, todayStr]);
  const activeNowJobs = useMemo(() => allJobs.filter(j => ['on_the_way', 'in_progress'].includes(j.status)), [allJobs]);
  const unassignedJobs = useMemo(() => allJobs.filter(j => ['confirmed', 'lead_received', 'quoted'].includes(j.status) && !j.assigned_employee_id), [allJobs]);
  const newLeads = useMemo(() => leads.filter(l => l.status === 'new'), [leads]);

  // Filter jobs based on selected timeframe
  const timeframeFilteredJobs = useMemo(() => {
    switch (timeframe) {
      case 'today':
        return todayJobs;
      case 'tomorrow': {
        const tmrw = new Date();
        tmrw.setDate(tmrw.getDate() + 1);
        const tmrwStr = format(tmrw, 'yyyy-MM-dd');
        return allJobs.filter(j => j.scheduled_date === tmrwStr);
      }
      case 'week': {
        return allJobs.filter(j => {
          try {
            return isThisWeek(parseISO(j.scheduled_date), { weekStartsOn: 1 });
          } catch {
            return false;
          }
        });
      }
      case 'unassigned':
        return unassignedJobs;
      case 'all':
      default:
        return allJobs;
    }
  }, [timeframe, allJobs, todayJobs, unassignedJobs]);

  const displayedJobs = useMemo(() => {
    return timeframeFilteredJobs.filter(j => 
      j.customer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.address_line1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.job_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      j.service_type?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [timeframeFilteredJobs, searchQuery]);

  // Calculate revenue for currently visible jobs
  const periodRevenue = useMemo(() => {
    return displayedJobs.reduce((acc, j) => acc + (j.quoted_price || 0), 0);
  }, [displayedJobs]);

  const metrics = [
    { 
      label: 'Needs Dispatch', 
      value: unassignedJobs.length, 
      sub: unassignedJobs.length > 0 ? 'Requires Cleaner Assignment' : 'All jobs staffed',
      icon: AlertCircle, 
      color: unassignedJobs.length > 0 ? 'orange' : 'green',
      onClick: () => setTimeframe('unassigned'),
    },
    { 
      label: 'Active Operations', 
      value: activeNowJobs.length, 
      sub: `${activeNowJobs.length} cleaners on site/transit`,
      icon: Radio, 
      color: 'blue',
      onClick: () => setView('map'),
    },
    { 
      label: 'New Inbound Leads', 
      value: newLeads.length, 
      sub: `${leads.length} total leads received`,
      icon: Sparkles, 
      color: 'purple',
      href: '/sobadmin/leads',
    },
    { 
      label: 'Visible Revenue', 
      value: `$${periodRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`, 
      sub: `${displayedJobs.length} jobs in view`,
      icon: TrendingUp, 
      color: 'green',
    },
  ];

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8 max-w-7xl mx-auto w-full">
        {/* Header Skeleton */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-48" />
          </div>
          <div className="flex items-center gap-3">
             <Skeleton className="h-10 w-32 rounded-xl" />
             <div className="space-y-2 text-right hidden sm:block">
               <Skeleton className="h-4 w-32 ml-auto" />
               <Skeleton className="h-3 w-24 ml-auto" />
             </div>
          </div>
        </div>
        
        {/* Metrics Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-48 rounded-xl" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'map') {
    return (
      <div className="relative">
        <DispatchMap onBack={() => setView('list')} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 md:space-y-6 lg:space-y-8 max-w-7xl mx-auto min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Operations Command</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">Dashboard</h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          <CRMPricingModal onSuccess={loadData} />

          <Link href="/sobadmin/jobs/new">
            <Button size="sm" className="h-9 px-3 text-xs font-semibold gap-1.5 shadow-xs">
              <Plus className="h-4 w-4" />
              New Job
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setView('map')}
            className="h-9 px-3 text-xs font-semibold gap-1.5"
          >
            <Map className="h-3.5 w-3.5" />
            Live Map
          </Button>

          <div className="pl-2 border-l border-border hidden lg:block text-right">
            <p className="text-xs font-semibold text-foreground">
              {isClient ? format(new Date(), 'EEE, MMM do, yyyy') : '...'}
            </p>
            <p className="text-[10px] text-muted-foreground">Auto-refresh active</p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {metrics.map((m) => {
          const content = (
            <div 
              key={m.label} 
              onClick={m.onClick}
              className={`bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs transition-all ${
                m.onClick || m.href ? 'hover:border-primary/50 hover:shadow-sm cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center
                  ${m.color === 'blue' ? 'bg-blue-500/10 text-blue-600' : ''}
                  ${m.color === 'green' ? 'bg-emerald-500/10 text-emerald-600' : ''}
                  ${m.color === 'orange' ? 'bg-amber-500/10 text-amber-600' : ''}
                  ${m.color === 'purple' ? 'bg-purple-500/10 text-purple-600' : ''}
                `}>
                  <m.icon className="h-4 w-4" />
                </div>
                {(m.onClick || m.href) && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="text-xl md:text-2xl font-bold tracking-tight text-foreground">{m.value}</p>
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{m.label}</p>
                <p className="text-[10px] text-muted-foreground/80 truncate">{m.sub}</p>
              </div>
            </div>
          );

          if (m.href) {
            return (
              <Link key={m.label} href={m.href} className="block">
                {content}
              </Link>
            );
          }
          return content;
        })}
      </div>

      {/* Mobile Quick-Links Row — shows sidebar content as tappable chips on phones */}
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden -mx-4 px-4 scrollbar-none">
        <button
          onClick={() => setView('map')}
          className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold hover:border-primary/50 transition-colors"
        >
          <Map className="h-3.5 w-3.5 text-blue-600" />
          Live Map
        </button>
        <a href="/sobadmin/leads" className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold hover:border-primary/50 transition-colors">
          <Sparkles className="h-3.5 w-3.5 text-purple-600" />
          Leads
        </a>
        <a href="/sobadmin/employees" className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold hover:border-primary/50 transition-colors">
          <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
          Employees
        </a>
        <a href="/sobadmin/finance" className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold hover:border-primary/50 transition-colors">
          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
          Finance
        </a>
      </div>

      {/* Main Grid: Operational Jobs Feed + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Main Job List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Timeframe Chips — horizontally scrollable on mobile */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/50 overflow-x-auto scrollbar-none -mx-1 px-1">
              <button
                type="button"
                onClick={() => setTimeframe('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  timeframe === 'all'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({allJobs.length})
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('today')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  timeframe === 'today'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Today ({todayJobs.length})
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  timeframe === 'week'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                This Week
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('unassigned')}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
                  timeframe === 'unassigned'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-amber-600 hover:bg-amber-500/10'
                }`}
              >
                Unassigned ({unassignedJobs.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input 
                type="text"
                placeholder="Search customer, address..."
                className="w-full pl-8 pr-3 py-1.5 bg-background border border-input rounded-xl text-xs focus:outline-none focus:ring-2 ring-primary/20"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Job Cards */}
          <div className="space-y-3">
            {displayedJobs.length > 0 ? (
              displayedJobs.map((job) => {
                const isUnassigned = !job.assigned_employee_id;
                return (
                  <Link 
                    key={job.id} 
                    href={`/sobadmin/jobs/${job.id}`}
                    className="block group"
                  >
                    <div className="bg-card border border-border rounded-2xl p-4 md:p-5 hover:border-primary/50 hover:shadow-md transition-all shadow-xs">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex gap-3 md:gap-4 min-w-0">
                          {/* Map Pin / Status Icon */}
                          <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${
                            isUnassigned 
                              ? 'bg-amber-500/10 text-amber-600' 
                              : job.status === 'completed' || job.status === 'paid_out'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-primary/10 text-primary'
                          }`}>
                            <MapPin className="h-5 w-5" />
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-foreground text-sm md:text-base group-hover:text-primary transition-colors truncate">
                                {job.customer?.full_name || 'Customer'}
                              </h3>
                              <span className="text-xs font-mono text-muted-foreground">
                                {job.job_number}
                              </span>
                              <Badge variant="outline" className={`text-[10px] uppercase font-bold py-0 h-5 ${
                                job.status === 'in_progress' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                job.status === 'on_the_way' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                                job.status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' :
                                job.status === 'confirmed' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                'bg-slate-100 text-slate-800 border-slate-300'
                              }`}>
                                {JOB_STATUS_LABELS[job.status] || job.status.replace('_', ' ')}
                              </Badge>

                              {isUnassigned ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold">
                                  ⚠️ Needs Dispatch
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-muted text-[10px] font-medium">
                                  Cleaner: {job.employee?.full_name || 'Assigned'}
                                </Badge>
                              )}
                            </div>

                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {job.address_line1}, {job.city}
                            </p>

                            <div className="flex items-center gap-3 md:gap-4 mt-2 flex-wrap text-xs text-muted-foreground">
                              <div className="flex items-center gap-1 font-medium text-foreground">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                {job.scheduled_date}
                              </div>

                              <div className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{job.scheduled_start_time || job.scheduled_window || 'Morning'}</span>
                                {job.estimated_duration_minutes && (
                                  <span className="text-[10px]">({Math.round(job.estimated_duration_minutes / 60)}h)</span>
                                )}
                              </div>

                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                <span>{SERVICE_TYPE_LABELS[job.service_type] || job.service_type?.replace(/_/g, ' ')}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Price & Action Arrow */}
                        <div className="flex items-center gap-2 md:gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-sm md:text-base font-bold text-foreground">
                              ${job.quoted_price?.toFixed(0) || '0'}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider hidden sm:block">
                              Quoted
                            </p>
                          </div>
                          <div className="p-2 rounded-full bg-muted/60 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })
            ) : (
              <div className="py-12 text-center bg-card border border-dashed border-border rounded-3xl space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  No jobs found matching the selected filter ({timeframe}).
                </p>
                <div className="flex justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setTimeframe('all')}>
                    View All {allJobs.length} Jobs
                  </Button>
                  <Link href="/sobadmin/jobs/new">
                    <Button size="sm">
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Book a Job
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar: Inbound Leads + Active Cleaners + Zones — desktop only; mobile uses quick-links row above */}
        <div className="hidden lg:block space-y-6">
          {/* Recent Inbound Leads Widget */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Recent Inbound Leads
              </h3>
              <Link href="/sobadmin/leads" className="text-xs font-semibold text-primary hover:underline flex items-center">
                View All ({leads.length})
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {leads.slice(0, 3).map((lead) => (
                <Link 
                  key={lead.id} 
                  href={`/sobadmin/leads/${lead.id}`}
                  className="block p-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors border border-border/40"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground truncate">{lead.customer_name}</p>
                    <Badge variant="outline" className="text-[9px] py-0 h-4 uppercase">
                      {lead.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {lead.service_type?.replace(/_/g, ' ') || 'General Clean'} • {lead.city || 'GTA'}
                  </p>
                  {lead.quoted_price && (
                    <p className="text-[11px] font-bold text-foreground mt-1">
                      ${lead.quoted_price}
                    </p>
                  )}
                </Link>
              ))}
              {leads.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 text-center">No leads currently in queue.</p>
              )}
            </div>
          </div>

          {/* Active Cleaners Panel */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                Active Cleaners ({employees.length})
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="space-y-3">
              {employees.slice(0, 5).map((c) => (
                <Link
                  key={c.id}
                  href={`/sobadmin/employees/${c.id}`}
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {c.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{c.full_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        ${(c as any).hourly_wage ? `${(c as any).hourly_wage}/hr` : '$25/hr'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    Available
                  </Badge>
                </Link>
              ))}

              <Link href="/sobadmin/employees" className="block pt-1">
                <Button variant="ghost" size="sm" className="w-full text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
                  View All Employees
                </Button>
              </Link>
            </div>
          </div>

          {/* Regional Coverage */}
          <div className="bg-card border border-border rounded-3xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-600" />
                Service Zones
              </h3>
              <Link href="/sobadmin/zones" className="text-xs font-semibold text-primary hover:underline">
                Manage
              </Link>
            </div>

            <div className="space-y-2">
              {zones.slice(0, 5).map((z) => (
                <div key={z.id} className="flex items-center justify-between text-xs py-1">
                  <span className="font-medium text-foreground truncate">{z.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono uppercase">{z.city}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
