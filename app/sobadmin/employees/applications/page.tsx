'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UserPlus,
  Search,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface ContractorApplication {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  years_experience: string | number;
  has_vehicle: boolean;
  brings_own_supplies: boolean;
  status: string;
  created_at: string;
}

const STATUS_FILTERS = ['All', 'New', 'Under Review', 'Approved', 'Needs More Info', 'Rejected'] as const;

export default function EmployeeApplicationsPage() {
  const [applications, setApplications] = useState<ContractorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  async function loadApplications() {
    setLoading(true);
    try {
      const res = await fetch('/api/sobadmin/employee-applications');
      if (!res.ok) throw new Error('Failed to load applications');
      const data = await res.json();
      setApplications(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Could not load applications');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplications();
  }, []);

  const filtered = useMemo(() => {
    return applications.filter((app) => {
      const matchesStatus =
        statusFilter === 'All' ||
        (app.status || 'New').toLowerCase() === statusFilter.toLowerCase();
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        app.full_name?.toLowerCase().includes(q) ||
        app.email?.toLowerCase().includes(q) ||
        app.phone?.toLowerCase().includes(q) ||
        app.city?.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [applications, statusFilter, search]);

  const counts = useMemo(() => {
    const newCount = applications.filter((a) => !a.status || a.status === 'New').length;
    const reviewCount = applications.filter((a) => a.status === 'Under Review').length;
    const approvedCount = applications.filter((a) => a.status === 'Approved').length;
    return { newCount, reviewCount, approvedCount };
  }, [applications]);

  function getStatusStyle(status: string) {
    switch (status) {
      case 'New':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'Under Review':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'Approved':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'Needs More Info':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Rejected':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  }

  return (
    <div className="space-y-6 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Applicant Pipeline</h1>
          <p className="text-muted-foreground text-sm">
            Vet incoming cleaner applications, verify insurance & supplies, and onboard to roster
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadApplications} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link href="/apply" target="_blank">
            <Button variant="outline" size="sm" className="gap-1.5">
              Public Apply Form
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <Link href="/sobadmin/employees">
            <Button size="sm" className="gap-1.5">
              Active Roster
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Applicants</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{counts.newCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <UserPlus className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Under Review</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{counts.reviewCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-foreground mt-0.5">{counts.approvedCount}</p>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                statusFilter === status
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search name, city, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
      </div>

      {/* Mobile applications cards (< md) */}
      <div className="md:hidden space-y-2.5">
        {loading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3.5 w-full" />
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-3.5 w-28" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center py-10 text-muted-foreground text-sm">No applications match the selected filter.</p>
        ) : (
          filtered.map((app) => (
            <Link key={app.id} href={`/sobadmin/employees/applications/${app.id}`} className="block">
              <Card className="active:bg-muted/50 transition-colors">
                <CardContent className="p-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-foreground truncate">{app.full_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{app.phone} • {app.email}</div>
                    </div>
                    <Badge variant="outline" className={`text-xs shrink-0 ${getStatusStyle(app.status || 'New')}`}>
                      {app.status || 'New'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    <span>{app.city || 'GTA'}</span>
                    <span>•</span>
                    <span>{app.years_experience || '0'} yrs exp</span>
                    <span>•</span>
                    <span>{app.has_vehicle ? 'Vehicle ✓' : 'No Vehicle'}</span>
                    <span>•</span>
                    <span>{app.brings_own_supplies ? 'Supplies ✓' : 'Needs Kit'}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                    <span>Submitted {app.created_at ? format(new Date(app.created_at), 'MMM d, yyyy') : '—'}</span>
                    <span className="font-semibold text-primary flex items-center gap-1">Review <ArrowRight className="h-3 w-3" /></span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>

      {/* Desktop Applications Table (>= md) */}
      <Card className="hidden md:block">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[680px]">
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Vehicle / Supplies</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-48 mt-1.5" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-20 rounded-md ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    No applications match the selected filter.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="font-semibold text-sm text-foreground">{app.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {app.phone} • {app.email}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{app.city || 'GTA'}</TableCell>
                    <TableCell className="text-xs">{app.years_experience || '—'} yrs</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {app.has_vehicle ? 'Vehicle ✓' : 'No Vehicle'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {app.brings_own_supplies ? 'Supplies ✓' : 'Needs Kit'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getStatusStyle(app.status || 'New')}`}>
                        {app.status || 'New'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {app.created_at ? format(new Date(app.created_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/sobadmin/employees/applications/${app.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs gap-1">
                          Review
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
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
