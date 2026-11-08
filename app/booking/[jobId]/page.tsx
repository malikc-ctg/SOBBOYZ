'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Waves, MapPin, CalendarDays, Clock,
  Star, User, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  SERVICE_TYPE_LABELS, TIME_WINDOW_LABELS,
  CUSTOMER_STATUS_MESSAGES,
} from '@/types';
import type { Job } from '@/types';

export default function BookingStatusPage() {
  const params = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [review, setReview] = useState({
    rating: 0,
    was_on_time: null as boolean | null,
    job_completed_properly: null as boolean | null,
    anything_missed: '',
    would_book_again: null as boolean | null,
    public_comment: '',
  });

  useEffect(() => {
    async function fetchJob() {
      try {
        // Mock job for preview purposes
        const mockJob = {
          id: 'test-job',
          job_number: 'SOB-2026-1042',
          status: 'completed',
          scheduled_date: new Date().toISOString(),
          scheduled_window: 'morning',
          address_line1: '123 Fake Street',
          city: 'Toronto',
          postal_code: 'M5V 2H1',
          service_type: 'deep_clean',
          quoted_price: 280.00,
          deposit_amount: 84.00,
          deposit_paid_at: new Date().toISOString(),
          employee: { full_name: 'Sarah Connor' },
          customer_id: 'cust-123',
          assigned_employee_id: 'cont-123',
        };
        setJob(mockJob as any);
      } catch {}
      setLoading(false);
    }
    fetchJob();
  }, [params.jobId]);

  async function handleSubmitReview() {
    if (!job || review.rating === 0) {
      toast.error('Please select a rating');
      return;
    }
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          customer_id: job.customer_id,
          employee_id: job.assigned_employee_id,
          ...review,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success('Thank you for your review!');
      setReviewSubmitted(true);
    } catch {
      toast.error('Failed to submit review');
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <div className="w-full max-w-lg space-y-4">
        <Skeleton className="h-10 w-48 mx-auto" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  );
  if (!job) return (
    <div className="min-h-screen flex items-center justify-center"><p className="text-red-500">Booking not found</p></div>
  );

  const statusMessage = CUSTOMER_STATUS_MESSAGES[job.status];
  const employee = (job as unknown as Record<string, unknown>).employee as any;
  const employeeFirstName = employee?.full_name?.split(' ')[0] ?? '';
  const showReviewForm = job.status === 'completed' && !reviewSubmitted;
  const showReviewDone = job.status === 'reviewed' || reviewSubmitted;

  // Customize status message with employee name
  let displayMessage = statusMessage ?? '';
  if (job.status === 'assigned' && employeeFirstName) {
    displayMessage = `Your cleaner ${employeeFirstName} has been assigned.`;
  } else if (job.status === 'on_the_way' && employeeFirstName) {
    displayMessage = `${employeeFirstName} is on their way to you now.`;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-blue-600 text-white px-4 py-6">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <img src="/logo.png" alt="Sea of Blue Logo" className="w-64 h-64 object-contain" />
          <div>
            <h1 className="font-bold text-lg">Sea of Blue</h1>
            <p className="text-blue-100 text-sm">Booking Status</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Status */}
        <Card className="border-blue-200 dark:border-blue-800">
          <CardContent className="p-5 text-center">
            <Badge className="mb-3 bg-blue-100 text-blue-700 border-0 text-sm px-3 py-1">
              {job.job_number}
            </Badge>
            <p className="text-lg font-medium mt-2">{displayMessage}</p>
          </CardContent>
        </Card>

        {/* Booking details */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{format(new Date(job.scheduled_date), 'EEEE, MMMM d, yyyy')}</p>
                <p className="text-xs text-muted-foreground">{TIME_WINDOW_LABELS[job.scheduled_window]}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm">{job.address_line1}</p>
                <p className="text-xs text-muted-foreground">{job.city} {job.postal_code}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm">{SERVICE_TYPE_LABELS[job.service_type]}</p>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Quoted Price</span>
              <span className="font-bold">${job.quoted_price}</span>
            </div>
            {job.deposit_amount && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Deposit</span>
                <span>${job.deposit_amount} {job.deposit_paid_at ? '✓ Paid' : '— Pending'}</span>
              </div>
            )}
            {employeeFirstName && ['assigned', 'on_the_way', 'in_progress', 'completed'].includes(job.status) && (
              <>
                <Separator />
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm">Your cleaner: <strong>{employeeFirstName}</strong></p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Review form */}
        {showReviewForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">How did everything go?</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Rating stars */}
              <div>
                <Label>Rating</Label>
                <div className="flex gap-2 mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReview({ ...review, rating: star })}
                      className="p-1 min-h-[48px] min-w-[48px] flex items-center justify-center"
                    >
                      <Star className={`h-8 w-8 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Yes/No questions */}
              <div>
                <Label>Was the cleaner on time?</Label>
                <div className="flex gap-2 mt-2">
                  <Button variant={review.was_on_time === true ? 'default' : 'outline'} size="sm" className="h-10 flex-1" onClick={() => setReview({ ...review, was_on_time: true })}>Yes</Button>
                  <Button variant={review.was_on_time === false ? 'default' : 'outline'} size="sm" className="h-10 flex-1" onClick={() => setReview({ ...review, was_on_time: false })}>No</Button>
                </div>
              </div>
              <div>
                <Label>Was the job completed properly?</Label>
                <div className="flex gap-2 mt-2">
                  <Button variant={review.job_completed_properly === true ? 'default' : 'outline'} size="sm" className="h-10 flex-1" onClick={() => setReview({ ...review, job_completed_properly: true })}>Yes</Button>
                  <Button variant={review.job_completed_properly === false ? 'default' : 'outline'} size="sm" className="h-10 flex-1" onClick={() => setReview({ ...review, job_completed_properly: false })}>No</Button>
                </div>
              </div>
              <div>
                <Label>Would you book again?</Label>
                <div className="flex gap-2 mt-2">
                  <Button variant={review.would_book_again === true ? 'default' : 'outline'} size="sm" className="h-10 flex-1" onClick={() => setReview({ ...review, would_book_again: true })}>Yes</Button>
                  <Button variant={review.would_book_again === false ? 'default' : 'outline'} size="sm" className="h-10 flex-1" onClick={() => setReview({ ...review, would_book_again: false })}>No</Button>
                </div>
              </div>
              <div>
                <Label>Anything missed? (optional)</Label>
                <Textarea value={review.anything_missed} onChange={e => setReview({ ...review, anything_missed: e.target.value })} className="mt-2" />
              </div>
              <div>
                <Label>Your thoughts (optional)</Label>
                <Textarea value={review.public_comment} onChange={e => setReview({ ...review, public_comment: e.target.value })} className="mt-2" />
              </div>
              <Button onClick={handleSubmitReview} className="w-full h-12">Submit Review</Button>
            </CardContent>
          </Card>
        )}

        {/* Review submitted */}
        {showReviewDone && (
          <Card>
            <CardContent className="p-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h2 className="font-bold text-lg">Thank you for your review!</h2>
              <p className="text-sm text-muted-foreground mt-1">We appreciate your feedback.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
