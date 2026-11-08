'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Waves, Clock, CheckCircle2, User, MapPin } from 'lucide-react';
import type { Job } from '@/types';
import { formatJobTimeSlot } from '@/lib/time-utils';

export default function TrackingPage() {
  const params = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const loadTracking = async () => {
      try {
        const { data } = await supabase
          .from('jobs')
          .select('*, employee:employees(full_name)')
          .eq('id', params.jobId)
          .single();

        if (data) setJob(data as any);
      } catch (err) {
        console.error('Failed to load tracking data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadTracking();
    
    // Simple status subscription
    const channel = supabase
      .channel(`job-${params.jobId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `id=eq.${params.jobId}` }, (payload) => {
        setJob(prev => prev ? { ...prev, ...payload.new } : null);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [params.jobId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6 flex flex-col items-center">
        <div className="w-full max-w-md space-y-6 mt-12">
          <Skeleton className="h-12 w-48 mx-auto rounded-xl" />
          <Skeleton className="h-72 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <p className="text-sm text-red-500 font-bold uppercase tracking-widest">Booking not found</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-orange-500',
    confirmed: 'bg-blue-500',
    on_the_way: 'bg-sky-500',
    in_progress: 'bg-emerald-500',
    completed: 'bg-gray-500',
  };

  return (
    <div className="min-h-screen bg-muted/30 p-6 flex flex-col items-center">
      {/* Branding */}
      <div className="flex items-center gap-2 mb-12">
          <img src="/logo.png" alt="Sea of Blue Logo" className="w-64 h-64 object-contain" />
        <span className="font-black text-foreground tracking-tight">Sea of Blue</span>
      </div>

      <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-xl overflow-hidden">
        {/* Status Header */}
        <div className={`p-8 text-white ${statusColors[job.status] || 'bg-blue-600'}`}>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1">Current Status</p>
          <h1 className="text-3xl font-black tracking-tighter">
            {job.status === 'on_the_way' && 'Cleaner is on the way'}
            {job.status === 'in_progress' && 'Cleaning in progress'}
            {job.status === 'completed' && 'Cleaning complete ✨'}
            {(job.status === 'confirmed' || job.status === 'assigned') && 'Booking confirmed'}
            {job.status === 'lead_received' && 'Preparing your clean'}
          </h1>
        </div>

        <div className="p-8 space-y-8">
          {/* Main Info */}
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Service Address</p>
                <p className="text-sm font-bold text-foreground leading-snug">{job.address_line1}</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Scheduled Time</p>
                <p className="text-sm font-bold text-foreground leading-snug">{formatJobTimeSlot(job)}</p>
              </div>
            </div>

            {job.assigned_employee_id && (
              <div className="flex items-start gap-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Your Cleaner</p>
                  <p className="text-sm font-bold text-foreground">{(job as any).employee?.full_name?.split(' ')[0] || 'Malik'}</p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-border">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-bold text-foreground">{job.service_type.replace('_', ' ')}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              We&apos;ll keep this page updated with live status changes. You don&apos;t need to refresh.
            </p>
          </div>
        </div>
      </div>
      
      <p className="mt-8 text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
        Powered by Sea of Blue Operations
      </p>
    </div>
  );
}
