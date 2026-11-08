'use client';

import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  User, MapPin, Phone, Mail, CheckCircle2,
  Star, TrendingUp, Award, Shield, Zap, Clock,
} from 'lucide-react';
import type { Employee, Zone, EmployeeScoreHistory } from '@/types';
import { AvailabilityModal } from '@/components/employee/AvailabilityModal';

interface ReviewData {
  id: string;
  rating: number;
  was_on_time: boolean | null;
  job_completed_properly: boolean | null;
  public_comment: string | null;
  created_at: string;
  job?: { job_number: string; service_type: string; scheduled_date: string };
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getBadges(employee: Employee, totalCompleted: number, reviews: ReviewData[]): { label: string; icon: React.ReactNode; color: string }[] {
  const badges: { label: string; icon: React.ReactNode; color: string }[] = [];
  if (totalCompleted >= 50) badges.push({ label: 'Veteran', icon: <Award className="h-3 w-3" />, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' });
  else if (totalCompleted >= 10) badges.push({ label: 'Experienced', icon: <Zap className="h-3 w-3" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' });
  if (employee.score >= 4.8) badges.push({ label: '5 Star Streak', icon: <Star className="h-3 w-3" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' });
  if (employee.background_check_cleared) badges.push({ label: 'Verified', icon: <Shield className="h-3 w-3" />, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' });
  const onTimeRate = reviews.filter(r => r.was_on_time).length / Math.max(reviews.length, 1);
  if (reviews.length >= 5 && onTimeRate >= 0.9) badges.push({ label: 'Punctual Pro', icon: <Clock className="h-3 w-3" />, color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' });
  return badges;
}

export default function EmployeeProfilePage() {
  const [employee, setEmployee] = useState<Employee & { selected_zone_ids?: string[] } | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<EmployeeScoreHistory[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [totalCompleted, setTotalCompleted] = useState(0);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    zone_ids: [] as string[],
    max_radius: 30,
  });
  const [hqCoords, setHqCoords] = useState<{lat: number, lng: number} | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [meRes, zonesRes, historyRes, statsRes] = await Promise.all([
          fetch('/api/employees/me'),
          fetch('/api/zones'),
          fetch('/api/employees/me/score-history'),
          fetch('/api/employees/me/stats'),
        ]);

        if (!meRes.ok) throw new Error('Could not fetch profile');
        const meData = await meRes.json();
        setEmployee(meData);
        const parsedNotes = meData.notes ? JSON.parse(meData.notes) : {};
        setFormData({
          full_name: meData.full_name || '',
          phone: meData.phone || '',
          zone_ids: meData.selected_zone_ids || [],
          max_radius: parsedNotes.max_radius || 30,
        });
        if (parsedNotes.hq_coords) {
          setHqCoords(parsedNotes.hq_coords);
        }

        const zonesData = await zonesRes.json();
        setZones(Array.isArray(zonesData) ? zonesData : []);

        if (historyRes.ok) {
          const hData = await historyRes.json();
          setScoreHistory(hData.score_history || []);
          setReviews(hData.reviews || []);
        }

        if (statsRes.ok) {
          const sData = await statsRes.json();
          setTotalCompleted(sData.total_completed || 0);
        }
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const eligibleZones = useMemo(() => {
    if (!hqCoords || zones.length === 0) return [];
    const distances = zones.map(zone => {
      if (!zone.latitude || !zone.longitude) return { zone, distance: Infinity };
      return { zone, distance: getDistanceFromLatLonInKm(hqCoords.lat, hqCoords.lng, zone.latitude, zone.longitude) };
    });
    return distances.filter(d => d.distance <= formData.max_radius).sort((a, b) => a.distance - b.distance);
  }, [hqCoords, zones, formData.max_radius]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/employees/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      toast.success('Profile updated successfully');
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const badges = employee ? getBadges(employee, totalCompleted, reviews) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      </div>



      {/* Availability Settings Modal */}
      <div className="py-2">
        <AvailabilityModal />
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-4 pb-10">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="full_name" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} className="pl-10" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (Read-only)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" value={employee?.email || ''} className="pl-10 bg-muted cursor-not-allowed" disabled />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="pl-10" required />
              </div>
            </div>

          </CardContent>
        </Card>


        <div className="pt-4">
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  );
}
