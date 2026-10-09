'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { SERVICE_TYPE_LABELS } from '@/types';
import type { Job, JobStatus } from '@/types';
import { formatJobTimeSlot } from '@/lib/time-utils';
import Link from 'next/link';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
const STATUS_FILTERS: { label: string; filterFn: (j: Job) => boolean }[] = [
  { label: 'All', filterFn: () => true },
  { label: '🔁 Recurring', filterFn: (j) => Boolean(j.recurring_booking_id) },
  { label: 'Needs Dispatch', filterFn: (j) => j.status === 'confirmed' },
  { label: 'In Progress', filterFn: (j) => ['assigned', 'on_the_way', 'in_progress'].includes(j.status) },
  { label: 'Completed', filterFn: (j) => ['completed', 'reviewed', 'paid_out'].includes(j.status) },
  { label: 'Disputed', filterFn: (j) => j.status === 'disputed' },
  { label: 'Cancelled', filterFn: (j) => ['cancelled', 'rescheduled', 'no_show'].includes(j.status) },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(0);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  useEffect(() => {
    async function fetchJobs() {
      setLoading(true);
      try {
        let url = '/api/jobs';
        const params = new URLSearchParams();
        if (dateRange?.from) {
          params.append('start_date', format(dateRange.from, 'yyyy-MM-dd'));
        }
        if (dateRange?.to) {
          params.append('end_date', format(dateRange.to, 'yyyy-MM-dd'));
        }
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();
        console.log('Fetched jobs data:', data);
        if (Array.isArray(data)) {
          setJobs(data);
        } else {
          console.error('API returned non-array:', data);
          setJobs([]);
        }
      } catch (err) {
        console.error('Error fetching jobs:', err);
        setJobs([]);
      } finally {
        setLoading(false);
      }
    }
    fetchJobs();
  }, [dateRange]);

  const filter = STATUS_FILTERS[activeFilter] ?? STATUS_FILTERS[0];
  const filtered = jobs.filter(filter.filterFn);

  return (
    <div className="space-y-5 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} jobs</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DatePickerWithRange date={dateRange} onDateChange={setDateRange} />
          <Link href="/sobadmin/jobs/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-2" />Create Job</Button>
          </Link>
        </div>
      </div>

      {/* Filter chips: scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {STATUS_FILTERS.map((f, i) => (
          <Button
            key={f.label}
            variant={activeFilter === i ? 'default' : 'outline'}
            size="sm"
            className="shrink-0"
            onClick={() => setActiveFilter(i)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow>
                <TableHead>Job #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="hidden md:table-cell">Time Slot</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden lg:table-cell">Address</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quoted</TableHead>
                <TableHead className="hidden md:table-cell">Employee</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No jobs found</TableCell></TableRow>
              ) : (
                filtered.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{job.job_number}</span>
                        {job.recurring_booking_id && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800" title="Recurring Contract Job">
                            🔁 Recur
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(job.scheduled_date), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell font-medium">{formatJobTimeSlot(job)}</TableCell>
                    <TableCell className="text-sm">{(job as any).customer?.full_name ?? '-'}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate hidden lg:table-cell">{job.address_line1}, {job.city}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{SERVICE_TYPE_LABELS[job.service_type]}</TableCell>
                    <TableCell><StatusBadge status={job.status} /></TableCell>
                    <TableCell className="text-xs font-semibold">${job.quoted_price?.toFixed(0) ?? '0'}</TableCell>
                    <TableCell className="text-xs hidden md:table-cell">
                      {(job as any).assigned_employee_ids && (job as any).assigned_employee_ids.length > 1 ? (
                        <span className="inline-flex items-center gap-1 font-medium text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-200" title={`Crew of ${(job as any).assigned_employee_ids.length} cleaners`}>
                          👥 {(job as any).employee?.full_name?.split(' ')[0] || 'Lead'} + {(job as any).assigned_employee_ids.length - 1}
                        </span>
                      ) : (
                        (job as any).employee?.full_name ?? '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/sobadmin/jobs/${job.id}`}>
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
