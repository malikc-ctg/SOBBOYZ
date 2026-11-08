'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  Eye,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  MapPin,
  Calendar,
  Download,
  Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';
import { SERVICE_TYPE_LABELS } from '@/types';

interface PhotoEvidenceTabProps {
  employees?: any[];
}

export function PhotoEvidenceTab({ employees = [] }: PhotoEvidenceTabProps) {
  const [photos, setPhotos] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    before: 0,
    after: 0,
    issues: 0,
    checklist: 0,
    today: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [activeType, setActiveType] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');

  // Inspection Modal
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);

  const fetchPhotos = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (activeType !== 'all') params.append('photo_type', activeType);
      if (selectedEmployeeId !== 'all') params.append('employee_id', selectedEmployeeId);
      if (search) params.append('search', search);

      const res = await fetch(`/api/audit-logs/photos?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load photo audit logs');
      const data = await res.json();
      setPhotos(data.photos || []);
      setSummary(data.summary || {});
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Could not load photo evidence');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeType, selectedEmployeeId, search]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  function handleInspect(photo: any) {
    setSelectedPhoto(photo);
    setInspectModalOpen(true);
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'before':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3 w-3" /> Before Clean
          </Badge>
        );
      case 'after':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> After Clean
          </Badge>
        );
      case 'problem':
      case 'damage':
      case 'issue':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Pre-Existing Issue
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-semibold capitalize">
            {type}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Photos */}
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Photo Evidence
              </p>
              <h3 className="text-2xl font-black tracking-tight mt-1 text-foreground">
                {summary.total}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Timestamped job verification records
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Camera className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Before Photos */}
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Before Photos
              </p>
              <h3 className="text-2xl font-black tracking-tight mt-1 text-foreground">
                {summary.before}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Baseline condition proof
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* After Photos */}
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                After Photos
              </p>
              <h3 className="text-2xl font-black tracking-tight mt-1 text-foreground">
                {summary.after}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Quality delivery verification
              </p>
            </div>
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Issues & Disputes Protection */}
        <Card className="bg-card border shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Flagged Issues & Damage
              </p>
              <h3 className={`text-2xl font-black tracking-tight mt-1 ${summary.issues > 0 ? 'text-red-600' : 'text-foreground'}`}>
                {summary.issues}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Dispute defense documentation
              </p>
            </div>
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${summary.issues > 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-muted text-muted-foreground'}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <Card className="border shadow-sm">
        <div className="p-4 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* Category Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground mr-1">Filter:</span>
              {[
                { id: 'all', label: 'All Evidence' },
                { id: 'before', label: 'Before Clean' },
                { id: 'after', label: 'After Clean' },
                { id: 'issues', label: 'Issues & Damage' },
                { id: 'checklist', label: 'Checklists' },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeType === tab.id ? 'default' : 'outline'}
                  size="sm"
                  className="h-8 text-xs font-medium"
                  onClick={() => setActiveType(tab.id)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => fetchPhotos(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by Job # (e.g. SOB-2026-0022), cleaner, room, or note..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Cleaner Filter */}
            {employees.length > 0 && (
              <div className="w-48">
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All Cleaners" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Cleaners ({employees.length})</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Gallery Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full rounded-none" />
              <CardContent className="p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : photos.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground border-dashed">
          <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-3">
            <div className="h-14 w-14 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <Camera className="h-7 w-7" />
            </div>
            <h3 className="font-bold text-lg text-foreground">No Photo Evidence Logged Yet</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When cleaners take before & after photos, document room checklist steps, or report pre-existing damage during jobs, the photos and exact immutable timestamps will be logged here for extra dispute protection.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {photos.map((photo) => {
            const job = photo.job || {};
            const emp = photo.employee || {};
            const uploadedDate = photo.uploaded_at ? new Date(photo.uploaded_at) : new Date();

            return (
              <Card
                key={photo.id}
                className="group overflow-hidden border bg-card hover:shadow-md transition-all duration-200 flex flex-col"
              >
                {/* Photo Image Container */}
                <div
                  className="relative aspect-video w-full bg-slate-950 overflow-hidden cursor-pointer"
                  onClick={() => handleInspect(photo)}
                >
                  <img
                    src={photo.file_url}
                    alt={photo.caption || 'Job photo'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {/* Top Badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 shadow-sm">
                    {getTypeBadge(photo.photo_type)}
                  </div>

                  {/* Room Tag if present */}
                  {photo.room && (
                    <div className="absolute top-2 right-2">
                      <span className="bg-black/60 backdrop-blur-md text-white text-[10px] px-2 py-0.5 rounded font-medium">
                        {photo.room}
                      </span>
                    </div>
                  )}

                  {/* Hover Inspect Icon */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold gap-1 shadow">
                      <Eye className="h-3.5 w-3.5" /> Inspect High-Res
                    </Button>
                  </div>
                </div>

                {/* Card Content & Metadata */}
                <CardContent className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Timestamp Banner with Security Icon */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pb-2 border-b">
                      <div className="flex items-center gap-1 text-foreground font-semibold">
                        <Clock className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span>{format(uploadedDate, 'MMM d, yyyy · h:mm:ss a')}</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 flex items-center gap-0.5" title="Verified immutable timestamp">
                        <ShieldCheck className="h-3 w-3" /> Logged
                      </span>
                    </div>

                    {/* Job Details */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between">
                        <Link
                          href={`/sobadmin/jobs/${photo.job_id}`}
                          className="font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          {job.job_number || 'Job #'}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                        {job.service_type && (
                          <span className="text-[10px] text-muted-foreground">
                            {SERVICE_TYPE_LABELS[job.service_type as keyof typeof SERVICE_TYPE_LABELS] || job.service_type}
                          </span>
                        )}
                      </div>

                      {job.address_line1 && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {job.address_line1}, {job.city}
                        </p>
                      )}
                    </div>

                    {/* Caption / Note */}
                    {photo.caption && (
                      <p className="text-xs text-foreground bg-muted/40 p-2 rounded mt-2 border text-muted-foreground leading-relaxed line-clamp-2">
                        {photo.caption}
                      </p>
                    )}
                  </div>

                  {/* Staff Info Footer */}
                  <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 truncate">
                      <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {emp.full_name ? emp.full_name.charAt(0).toUpperCase() : '?'}
                      </div>
                      <span className="truncate font-medium text-foreground text-[11px]">
                        {emp.full_name || 'Assigned Cleaner'}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => handleInspect(photo)}
                    >
                      Inspect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* High-Resolution Inspection Modal */}
      <Dialog open={inspectModalOpen} onOpenChange={setInspectModalOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-card">
            <div className="flex items-center justify-between pr-6">
              <div>
                <DialogTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Audit Photo Evidence & Timestamps
                </DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Permanent record for job quality and dispute defense
                </DialogDescription>
              </div>
              {selectedPhoto && getTypeBadge(selectedPhoto.photo_type)}
            </div>
          </DialogHeader>

          {selectedPhoto && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Full Image Preview */}
              <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-black flex items-center justify-center border shadow-inner">
                <img
                  src={selectedPhoto.file_url}
                  alt={selectedPhoto.caption || 'Job audit photo'}
                  className="max-h-[500px] w-auto object-contain"
                />
              </div>

              {/* Comprehensive Evidence Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Timestamp & Integrity Info */}
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                  <p className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                    Timestamp &amp; Security Record
                  </p>
                  <div className="space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Local Timestamp:</span>
                      <span className="font-semibold text-foreground">
                        {format(new Date(selectedPhoto.uploaded_at), 'MMMM d, yyyy h:mm:ss a')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ISO UTC String:</span>
                      <span className="text-muted-foreground">{selectedPhoto.uploaded_at}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Evidence ID:</span>
                      <span className="text-muted-foreground truncate max-w-[200px]">{selectedPhoto.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Verification:</span>
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Immutable Audit Record
                      </span>
                    </div>
                  </div>
                </div>

                {/* Job & Personnel Info */}
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border">
                  <p className="font-bold uppercase tracking-wider text-muted-foreground text-[10px]">
                    Job &amp; Cleaner Assignment
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Job Number:</span>
                      <Link
                        href={`/sobadmin/jobs/${selectedPhoto.job_id}`}
                        className="font-bold text-blue-600 hover:underline flex items-center gap-1"
                      >
                        {selectedPhoto.job?.job_number || 'View Job'}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cleaner:</span>
                      <span className="font-semibold text-foreground">
                        {selectedPhoto.employee?.full_name || 'Staff'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Customer:</span>
                      <span>{selectedPhoto.job?.customer?.full_name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Location:</span>
                      <span className="truncate max-w-[180px]">
                        {selectedPhoto.job?.address_line1}, {selectedPhoto.job?.city}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Note / Memo */}
              {selectedPhoto.caption && (
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-900 text-xs">
                  <span className="font-bold text-blue-900 dark:text-blue-300 block mb-1">
                    Cleaner Checklist Note / Description:
                  </span>
                  <p className="text-foreground">{selectedPhoto.caption}</p>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <Link href={`/sobadmin/jobs/${selectedPhoto.job_id}`}>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Full Job Details
                  </Button>
                </Link>

                <a href={selectedPhoto.file_url} target="_blank" rel="noopener noreferrer" download>
                  <Button size="sm" className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                    <Download className="h-3.5 w-3.5" />
                    Download Original High-Res
                  </Button>
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
