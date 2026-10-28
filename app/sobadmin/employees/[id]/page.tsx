'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Star, ShieldCheck, ShieldX, ShieldAlert,
  FileText, ExternalLink, CheckCircle2, XCircle, Clock, Camera, User, Pencil, DollarSign
} from 'lucide-react';
import type { Employee } from '@/types';
import Link from 'next/link';
import { toast } from 'sonner';

export default function EmployeeDetailPage() {
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  
  // Wage State
  const [wageDialogOpen, setWageDialogOpen] = useState(false);
  const [wageInput, setWageInput] = useState('25.00');
  const [savingWage, setSavingWage] = useState(false);

  // Profile Photo State
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoStatus, setPhotoStatus] = useState<'verified' | 'rejected' | 'pending' | null>(null);
  const [photoRejectionReason, setPhotoRejectionReason] = useState<string | null>(null);
  const [photoVerifiedAt, setPhotoVerifiedAt] = useState<string | null>(null);
  const [isVerifyingPhoto, setIsVerifyingPhoto] = useState(false);
  const [photoRejectionNote, setPhotoRejectionNote] = useState('');
  const [showPhotoRejectInput, setShowPhotoRejectInput] = useState(false);

  const [hqAddress, setHqAddress] = useState<string | null>(null);
  const [maxRadius, setMaxRadius] = useState<number | null>(null);

  async function fetchEmployee() {
    const res = await fetch('/api/employees');
    const data = await res.json();
    const found = (Array.isArray(data) ? data : []).find((c: Employee) => c.id === params.id);
    if (found) {
      setEmployee(found);
      try {
        const notes = found.notes ? JSON.parse(found.notes) : {};
        let wage = 25.0;
        if (notes.hourly_wage) wage = Number(notes.hourly_wage);
        else if ((found as any).hourly_wage) wage = Number((found as any).hourly_wage);
        setWageInput(wage.toFixed(2));

        setPhotoUrl(notes.profile_photo_url ?? null);
        setPhotoStatus(notes.profile_photo_status ?? null);
        setPhotoRejectionReason(notes.profile_photo_rejection_reason ?? null);
        setPhotoVerifiedAt(notes.profile_photo_verified_at ?? null);
        setHqAddress(notes.hq_address ?? null);
        setMaxRadius(notes.max_radius ?? null);
      } catch {
        setPhotoUrl(null);
        setPhotoStatus(null);
        setPhotoRejectionReason(null);
        setPhotoVerifiedAt(null);
        setHqAddress(null);
        setMaxRadius(null);
      }
    }
  }

  useEffect(() => { fetchEmployee(); }, [params.id]);

  async function handleUpdateWage() {
    const wageNum = parseFloat(wageInput);
    if (isNaN(wageNum) || wageNum <= 0) {
      toast.error('Please enter a valid hourly wage');
      return;
    }
    setSavingWage(true);
    try {
      const res = await fetch(`/api/employees/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hourly_wage: wageNum }),
      });
      if (!res.ok) throw new Error('Failed to update wage');
      toast.success(`Hourly wage updated to $${wageNum.toFixed(2)}/hr`);
      setWageDialogOpen(false);
      fetchEmployee();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update wage');
    } finally {
      setSavingWage(false);
    }
  }



  async function handleVerifyPhoto() {
    setIsVerifyingPhoto(true);
    try {
      const res = await fetch(`/api/employees/${params.id}/verify-photo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify' }),
      });
      if (!res.ok) throw new Error('Failed to verify photo');
      toast.success('Profile photo verified!');
      fetchEmployee();
    } catch {
      toast.error('Failed to verify profile photo');
    } finally {
      setIsVerifyingPhoto(false);
    }
  }

  async function handleRejectPhoto() {
    if (!photoRejectionNote.trim()) {
      toast.error('Please enter a reason for rejection');
      return;
    }
    setIsVerifyingPhoto(true);
    try {
      const res = await fetch(`/api/employees/${params.id}/verify-photo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', admin_notes: photoRejectionNote }),
      });
      if (!res.ok) throw new Error('Failed to reject photo');
      toast.success('Profile photo rejected.');
      setShowPhotoRejectInput(false);
      setPhotoRejectionNote('');
      fetchEmployee();
    } catch {
      toast.error('Failed to reject profile photo');
    } finally {
      setIsVerifyingPhoto(false);
    }
  }

  if (!employee) return <div className="py-20" />;

  const currentWage = Number((() => { 
    try { return JSON.parse(employee.notes || '{}').hourly_wage; } catch { return 25; } 
  })() || (employee as any).hourly_wage || 25);

  const hasPhoto = !!photoUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sobadmin/employees"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        <div>
          <h1 className="text-2xl font-bold">{employee.full_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={`capitalize ${employee.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{employee.status}</Badge>
            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold">
              ${currentWage.toFixed(2)}/hr
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setWageInput(currentWage.toFixed(2)); setWageDialogOpen(true); }}
              className="h-6 px-2 text-xs flex items-center gap-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <Pencil className="h-3 w-3" /> Edit Wage
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact */}
        <Card>
          <CardHeader><CardTitle>Contact</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{employee.email}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{employee.phone}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">HQ Address</span><span className="text-right max-w-[200px] truncate" title={hqAddress || '—'}>{hqAddress || '—'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Operating Radius</span><span>{maxRadius ? `${maxRadius} km` : '—'}</span></div>
            <div className="flex justify-between pt-2 border-t"><span className="text-muted-foreground">Primary Zone</span><span>{(employee as any).zone?.name ?? '—'}</span></div>
            <div className="space-y-2">
              <span className="text-muted-foreground block">Additional Zones</span>
              <div className="flex flex-wrap gap-1">
                {(employee as any).employee_zones?.length > 0 ? (
                  (employee as any).employee_zones.map((cz: any) => (
                    <Badge key={cz.zone.id} variant="secondary" className="text-[10px]">{cz.zone.name}</Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bio */}
        <Card>
          <CardHeader><CardTitle>Cleaner Bio</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="relative">
                {hasPhoto ? (
                  <img
                    src={photoUrl!}
                    alt={employee.full_name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-primary/20 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-2 border-dashed border-slate-300">
                    <User className="w-8 h-8 text-slate-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{employee.full_name}</span>
                  <Badge variant="outline" className={`text-[10px] ${photoStatus === 'verified' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                    {photoStatus === 'verified' ? 'Photo Verified' : 'Photo Pending'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Joined {new Date(employee.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Public Customer Bio</p>
              <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                &ldquo;{(() => { try { return JSON.parse(employee.notes || '{}').bio || 'Dedicated professional cleaner committed to making your home sparkle.'; } catch { return 'Dedicated professional cleaner committed to making your home sparkle.'; } })()}&rdquo;
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Performance */}
        <Card>
          <CardHeader><CardTitle>Performance</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between items-center"><span className="text-muted-foreground">Score</span><span className="flex items-center gap-1"><Star className="h-4 w-4 text-amber-500" /><span className="font-bold text-lg">{employee.score}</span>/5.00</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Hourly Wage</span>
              <button
                onClick={() => { setWageInput(currentWage.toFixed(2)); setWageDialogOpen(true); }}
                className="group flex items-center gap-1 font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 text-xs transition-colors"
                title="Click to edit wage"
              >
                ${currentWage.toFixed(2)}/hr
                <Pencil className="h-3 w-3 opacity-60 group-hover:opacity-100" />
              </button>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Max Jobs/Day</span><span>{employee.max_jobs_per_day}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Own Supplies</span><span>{employee.brings_own_supplies ? 'Yes' : 'No'}</span></div>
          </CardContent>
        </Card>
        {/* Compliance */}
        <Card>
          <CardHeader><CardTitle>Compliance</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Background Check</span><span>{employee.background_check_cleared ? '✓ Cleared' : '✗ Pending'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Insurance</span><span className="text-emerald-600 font-medium flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Company Covered</span></div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Compensation & Hourly Wage Card ── */}
        <Card className="border-2 border-indigo-100 dark:border-indigo-950/50 bg-indigo-50/20 dark:bg-indigo-950/10">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-indigo-600" /> Compensation & Hourly Wage
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setWageInput(currentWage.toFixed(2)); setWageDialogOpen(true); }}
                className="h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit Wage
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tight text-indigo-900 dark:text-indigo-100">
                ${currentWage.toFixed(2)}
              </span>
              <span className="text-sm font-medium text-muted-foreground">/ hour base rate</span>
            </div>

            <div className="grid grid-cols-3 gap-3 p-3 bg-background rounded-lg border border-border text-center">
              <div>
                <p className="text-[11px] text-muted-foreground">3h Job (Est)</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">${(currentWage * 3).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">4h Job (Est)</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">${(currentWage * 4).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">8h Day (Est)</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">${(currentWage * 8).toFixed(2)}</p>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Commercial Insurance Active</span>
              </div>
              <p className="text-emerald-700 dark:text-emerald-400 text-[11px] leading-relaxed">
                Cleaners are direct employees covered under Sea of Blue&apos;s corporate commercial general liability insurance. Personal contractor insurance verification is not required.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Profile Photo Verification Card ── */}
        <Card className={`border-2 ${
          photoStatus === 'verified'
            ? 'border-green-200 bg-green-50/40 dark:bg-green-950/20'
            : photoStatus === 'rejected'
            ? 'border-red-200 bg-red-50/40 dark:bg-red-950/20'
            : hasPhoto
            ? 'border-amber-200 bg-amber-50/40 dark:bg-amber-950/20'
            : 'border-dashed border-muted-foreground/30'
        }`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {photoStatus === 'verified' ? (
                  <><ShieldCheck className="h-5 w-5 text-green-600" /> Profile Photo Verification</>
                ) : photoStatus === 'rejected' ? (
                  <><ShieldX className="h-5 w-5 text-red-600" /> Profile Photo Verification</>
                ) : hasPhoto ? (
                  <><ShieldAlert className="h-5 w-5 text-amber-600" /> Profile Photo Verification</>
                ) : (
                  <><ShieldAlert className="h-5 w-5 text-muted-foreground" /> Profile Photo Verification</>
                )}
              </CardTitle>
              <div>
                {photoStatus === 'verified' && (
                  <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Verified
                  </Badge>
                )}
                {photoStatus === 'rejected' && (
                  <Badge className="bg-red-100 text-red-700 border-red-200 flex items-center gap-1">
                    <XCircle className="h-3 w-3" /> Rejected
                  </Badge>
                )}
                {!photoStatus && hasPhoto && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Pending Review
                  </Badge>
                )}
                {!hasPhoto && !photoStatus && (
                  <Badge variant="outline" className="text-muted-foreground">No Photo</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Uploaded document */}
            {photoUrl ? (
              <div className="flex items-center gap-4 p-3 bg-background rounded-lg border border-border">
                <div className="w-16 h-16 rounded-full overflow-hidden shrink-0 border border-border bg-muted relative">
                  <img src={photoUrl} alt="Profile Photo" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Profile Photo</p>
                  <a
                    href={photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0 mt-1"
                  >
                    View Full Size <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Camera className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No profile photo uploaded yet</p>
              </div>
            )}

            {/* Rejection reason */}
            {photoStatus === 'rejected' && photoRejectionReason && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                <p className="text-xs font-medium text-red-700 mb-1">Rejection Reason</p>
                <p className="text-red-600">{photoRejectionReason}</p>
              </div>
            )}

            {/* Admin verified info */}
            {photoStatus === 'verified' && photoVerifiedAt && (
              <p className="text-xs text-green-700">
                ✓ Verified on {new Date(photoVerifiedAt).toLocaleDateString()}
              </p>
            )}

            {/* Action buttons — only show when file exists and not yet verified */}
            {hasPhoto && photoStatus !== 'verified' && (
              <div className="space-y-3 pt-2 border-t border-border">
                {!showPhotoRejectInput ? (
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={handleVerifyPhoto}
                      disabled={isVerifyingPhoto}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {isVerifyingPhoto ? 'Verifying...' : 'Verify Photo'}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setShowPhotoRejectInput(true)}
                      disabled={isVerifyingPhoto}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground font-medium">Rejection Reason *</label>
                    <textarea
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background resize-none"
                      rows={2}
                      placeholder="e.g. Not a clear picture of your face, has filters..."
                      value={photoRejectionNote}
                      onChange={e => setPhotoRejectionNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={handleRejectPhoto}
                        disabled={isVerifyingPhoto}
                      >
                        {isVerifyingPhoto ? 'Rejecting...' : 'Confirm Rejection'}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => { setShowPhotoRejectInput(false); setPhotoRejectionNote(''); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Wage Dialog */}
      <Dialog open={wageDialogOpen} onOpenChange={setWageDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-indigo-600" />
              Edit Hourly Wage
            </DialogTitle>
            <DialogDescription>
              Update base hourly pay rate for <span className="font-semibold text-foreground">{employee.full_name}</span>. This rate determines estimated pay during job dispatch.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Hourly Wage ($/hr)</Label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-muted-foreground font-semibold">$</span>
                <Input
                  type="number"
                  step="0.50"
                  min="15"
                  className="pl-7 text-base font-semibold"
                  placeholder="25.00"
                  value={wageInput}
                  onChange={e => setWageInput(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-slate-800 dark:text-slate-200">Estimated Job Pay Breakdown:</p>
              <div className="flex justify-between">
                <span>Standard 3-hour clean:</span>
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  ${((parseFloat(wageInput) || 0) * 3).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Full 8-hour workday:</span>
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  ${((parseFloat(wageInput) || 0) * 8).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWageDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateWage} disabled={savingWage} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {savingWage ? 'Saving...' : 'Save Wage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
