'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin, Briefcase, CalendarDays,
  Clock, CheckCircle2, ChevronRight, Timer, Package, Key, Info,
  Loader2
} from 'lucide-react';
import { SERVICE_TYPE_LABELS } from '@/types';
import { formatJobTimeSlot } from '@/lib/time-utils';
import type { Job } from '@/types';
import Link from 'next/link';
import { format } from 'date-fns';

import { toast } from 'sonner';
import { TIME_WINDOW_LABELS } from '@/types';

export default function EmployeeJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    try {
      const [jobsRes, offersRes] = await Promise.all([
        fetch('/api/jobs'),
        fetch('/api/offers')
      ]);

      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(Array.isArray(data) ? data : []);
      }
      if (offersRes.ok) {
        const offersData = await offersRes.json();
        setOffers(Array.isArray(offersData) ? offersData : []);
      }
    } catch (err) {
      console.error('Failed to load jobs/offers', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  async function handleOfferResponse(offerId: string, action: 'accept' | 'decline') {
    setRespondingOfferId(offerId);
    try {
      const res = await fetch(`/api/offers/${offerId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to ${action} offer`);
      }
      if (action === 'accept') {
        toast.success('Job offer accepted! Added to your upcoming jobs.');
      } else {
        toast.info('Job offer declined.');
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRespondingOfferId(null);
    }
  }

  const upcomingJobs = jobs.filter(j => ['assigned', 'accepted', 'on_the_way', 'in_progress'].includes(j.status));
  const completedJobs = jobs.filter(j => ['completed', 'reviewed', 'paid_out', 'disputed'].includes(j.status));

  if (loading) {
    return <div className="h-[50vh]" />;
  }

  function renderJobCard(job: Job) {
    return (
      <Link key={job.id} href={`/employee/jobs/${job.id}`}>
        <Card className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors cursor-pointer overflow-hidden border border-border shadow-sm group">
          <div className="bg-slate-50/50 dark:bg-slate-900/20 px-4 py-3 flex items-center justify-between border-b border-border">
            <div className="flex flex-col">
              <span className="font-bold text-sm text-foreground">{SERVICE_TYPE_LABELS[job.service_type]}</span>
              <span className="text-[10px] text-muted-foreground font-semibold mt-0.5">{format(new Date(job.scheduled_date + 'T12:00:00'), 'EEEE, MMM d, yyyy')}</span>
            </div>
            <StatusBadge status={job.status} />
          </div>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-full">
                <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{job.address_line1}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{job.city}, {job.postal_code}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50/50 dark:bg-slate-900/20 rounded-lg p-2.5 border border-border/50">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{formatJobTimeSlot(job)}</span>
              </div>
              <div className="flex items-center gap-1.5 justify-end text-indigo-600 dark:text-indigo-400">
                <Timer className="h-3.5 w-3.5" />
                <span className="font-semibold">
                  {job.estimated_duration_minutes
                    ? `${Math.floor(job.estimated_duration_minutes / 60)}h ${job.estimated_duration_minutes % 60 ? `${job.estimated_duration_minutes % 60}m` : ''} est.`
                    : '~2-3h approx'}
                </span>
              </div>
            </div>
            
            <div className="pt-2 flex items-center justify-between border-t border-border/50">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Briefcase className="h-3 w-3" /> Job ID: {job.job_number}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors" />
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight drop-shadow-sm">My Jobs</h1>
        <p className="text-xs text-muted-foreground mt-1">View and manage all your assigned and completed jobs.</p>
      </div>

      <Tabs defaultValue={offers.length > 0 ? "offers" : "upcoming"} className="w-full">
        <TabsList className={`grid w-full ${offers.length > 0 ? 'grid-cols-3' : 'grid-cols-2'} mb-4`}>
          {offers.length > 0 && (
            <TabsTrigger value="offers" className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Offers ({offers.length})
            </TabsTrigger>
          )}
          <TabsTrigger value="upcoming" className="text-xs font-bold uppercase tracking-wider">Upcoming ({upcomingJobs.length})</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs font-bold uppercase tracking-wider">Completed ({completedJobs.length})</TabsTrigger>
        </TabsList>
        
        {offers.length > 0 && (
          <TabsContent value="offers" className="space-y-4">
            {offers.map(offer => {
              const job = offer.job;
              if (!job) return null;
              const isResponding = respondingOfferId === offer.id;
              return (
                <Card key={offer.id} className="border-2 border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 shadow-sm overflow-hidden">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{SERVICE_TYPE_LABELS[job.service_type as keyof typeof SERVICE_TYPE_LABELS] || job.service_type}</span>
                          <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">New Offer</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                          {format(new Date(job.scheduled_date + 'T12:00:00'), 'EEEE, MMM d, yyyy')} · {TIME_WINDOW_LABELS[job.scheduled_window as keyof typeof TIME_WINDOW_LABELS] || job.scheduled_window}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 block">
                          Est. ${(offer.estimated_pay || (offer.estimated_duration_hours * 25)).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          ~{(offer.estimated_duration_hours || 3).toFixed(1)} hrs
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/60 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                      <MapPin className="h-4 w-4 text-amber-600 shrink-0" />
                      <span className="truncate">{job.address_line1}, {job.city}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        onClick={() => handleOfferResponse(offer.id, 'accept')}
                        disabled={isResponding}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-sm"
                      >
                        {isResponding ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                        Accept Job
                      </Button>
                      <Button
                        onClick={() => handleOfferResponse(offer.id, 'decline')}
                        disabled={isResponding}
                        variant="outline"
                        className="flex-1 border-slate-300 text-slate-700 dark:text-slate-300 font-semibold text-xs h-9 hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        )}
        
        <TabsContent value="upcoming" className="space-y-4">
          {upcomingJobs.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-border">
              <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-bold text-sm text-foreground">No upcoming jobs</h3>
              <p className="text-xs text-muted-foreground mt-1">Accept offers on the dashboard to fill your schedule.</p>
            </div>
          ) : (
            upcomingJobs.map(renderJobCard)
          )}
        </TabsContent>
        
        <TabsContent value="completed" className="space-y-4">
          {completedJobs.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-border">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <h3 className="font-bold text-sm text-foreground">No completed jobs yet</h3>
              <p className="text-xs text-muted-foreground mt-1">Your completed jobs will appear here.</p>
            </div>
          ) : (
            completedJobs.map(renderJobCard)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
