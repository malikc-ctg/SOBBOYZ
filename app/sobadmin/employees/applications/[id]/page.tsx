'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, CheckCircle2, XCircle, Info, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [app, setApp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchApp() {
      try {
        const res = await fetch(`/api/sobadmin/employee-applications/${params.id}`);
        const data = await res.json();
        if (res.ok) {
          setApp(data);
          setStatus(data.status);
          setInternalNotes(data.internal_notes || '');
        } else {
          toast.error(data.error || 'Failed to load application');
        }
      } catch (e) {
        toast.error('Network error');
      } finally {
        setLoading(false);
      }
    }
    fetchApp();
  }, [params.id]);

  const handleSaveReview = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/sobadmin/employee-applications/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, internal_notes: internalNotes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update review');
      }
      toast.success('Review saved successfully');
      // If approved, we could potentially show the "Add Employee" logic here or redirect
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading application details...</div>;
  }

  if (!app) {
    return <div className="p-8 text-center text-red-500">Application not found.</div>;
  }

  const getStatusBadgeVariant = (s: string) => {
    switch(s) {
      case 'New': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Under Review': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'Rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'Needs More Info': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const services = Array.isArray(app.services_offered) ? app.services_offered : JSON.parse(app.services_offered || '[]');
  const weekdays = Array.isArray(app.weekdays_available) ? app.weekdays_available : JSON.parse(app.weekdays_available || '[]');
  const jobTypes = Array.isArray(app.preferred_job_types) ? app.preferred_job_types : JSON.parse(app.preferred_job_types || '[]');

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => router.push('/sobadmin/employees')} className="h-10 w-10 sm:h-8 sm:w-8 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">Application: {app.full_name}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Submitted on {new Date(app.created_at).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={getStatusBadgeVariant(app.status)}>{app.status}</Badge>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Read-only details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-base font-semibold">Applicant Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Full Name</Label>
                <div className="font-medium">{app.full_name}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Business Name</Label>
                <div className="font-medium">{app.business_name || '—'}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <div><a href={`mailto:${app.email}`} className="text-primary hover:underline">{app.email}</a></div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <div><a href={`tel:${app.phone}`} className="text-primary hover:underline">{app.phone}</a></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-base font-semibold">Business Type & Services</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <div className="font-medium">{app.applicant_type}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Experience</Label>
                  <div className="font-medium">{app.years_experience} years</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Team Size</Label>
                  <div className="font-medium">{app.team_size || '—'}</div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Services Offered</Label>
                <div className="flex flex-wrap gap-2">
                  {services.map((s: string) => <Badge key={s} variant="secondary">{s}</Badge>)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-base font-semibold">Area & Availability</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Primary City</Label>
                  <div className="font-medium">{app.primary_city}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Travel Radius</Label>
                  <div className="font-medium">{app.travel_radius || '—'}</div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Service Areas</Label>
                  <div className="whitespace-pre-wrap text-sm">{app.service_areas}</div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Weekdays Available</Label>
                  <div className="flex flex-wrap gap-1">
                    {weekdays.map((d: string) => <Badge key={d} variant="outline" className="text-xs">{d}</Badge>)}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Preferred Jobs</Label>
                  <div className="flex flex-wrap gap-1">
                    {jobTypes.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-base font-semibold">Compliance & Google Profile</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Liability Insurance</Label>
                  <div className="flex items-center gap-2">
                    {app.has_liability_insurance === 'Yes' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    {app.has_liability_insurance} {app.insurance_provider ? `(${app.insurance_provider})` : ''}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Registered Business</Label>
                  <div className="flex items-center gap-2">
                    {app.has_registered_business === 'Yes' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    {app.has_registered_business} {app.business_registration_number ? `(${app.business_registration_number})` : ''}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Allowed to Work in Ontario</Label>
                  <div className="flex items-center gap-2">
                    {app.legally_allowed_to_work_ontario === 'Yes' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    {app.legally_allowed_to_work_ontario}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Google Business Profile</Label>
                  <div className="flex items-center gap-2 font-medium">
                    {app.has_google_business_profile === 'Yes' ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Info className="h-4 w-4 text-amber-500" />}
                    {app.has_google_business_profile}
                  </div>
                </div>
                {app.has_google_business_profile === 'Yes' && (
                  <>
                    {app.google_business_profile_link && (
                      <div>
                        <a href={app.google_business_profile_link} target="_blank" rel="noreferrer" className="text-primary text-sm flex items-center gap-1 hover:underline">
                          View Google Profile <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground block text-xs">Rating</span>
                        {app.google_rating || '—'}
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Reviews</span>
                        {app.google_review_count || '—'}
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-xs">Verified</span>
                        {app.google_business_profile_verified || '—'}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-slate-50/50 border-b">
              <CardTitle className="text-base font-semibold">About the Business</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Description</Label>
                <div className="whitespace-pre-wrap text-sm p-3 bg-slate-50 rounded-lg border">{app.business_description}</div>
              </div>
              {app.reason_for_joining && (
                <div>
                  <Label className="text-xs text-muted-foreground">Reason for Joining</Label>
                  <div className="whitespace-pre-wrap text-sm p-3 bg-slate-50 rounded-lg border">{app.reason_for_joining}</div>
                </div>
              )}
              
              <div className="pt-2">
                <Label className="text-xs text-muted-foreground mb-2 block">Online Presence</Label>
                <div className="flex flex-col gap-1 text-sm">
                  {app.website_url && <a href={app.website_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Website</a>}
                  {app.instagram_url && <a href={app.instagram_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Instagram</a>}
                  {app.facebook_url && <a href={app.facebook_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Facebook</a>}
                  {app.other_profile_url && <a href={app.other_profile_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Other Profile</a>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Review Actions */}
        <div className="md:col-span-1">
          <div className="sticky top-24">
            <Card className="border-primary/20 shadow-sm">
              <CardHeader className="bg-slate-50/50 border-b pb-4">
                <CardTitle className="text-base font-semibold">Internal Review</CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New">New</SelectItem>
                      <SelectItem value="Under Review">Under Review</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Needs More Info">Needs More Info</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Internal Notes</Label>
                  <Textarea 
                    value={internalNotes} 
                    onChange={(e) => setInternalNotes(e.target.value)} 
                    placeholder="Add notes for the team..." 
                    className="min-h-[150px]"
                  />
                </div>

                <Button className="w-full" onClick={handleSaveReview} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Review'}
                </Button>

                {status === 'Approved' && (
                  <div className="pt-4 border-t border-border mt-4">
                    <p className="text-xs text-muted-foreground mb-3 leading-tight">
                      This applicant has been approved. You can now invite them as a employee.
                    </p>
                    <Link href="/sobadmin/employees">
                      <Button variant="outline" className="w-full border-green-200 text-green-700 hover:bg-green-50">
                        Go to Add Employee
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
