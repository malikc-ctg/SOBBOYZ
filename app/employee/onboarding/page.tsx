'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import type { Employee, Zone } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import dynamic_import from 'next/dynamic';

const AddressAutofill = dynamic_import(
  () => import('@mapbox/search-js-react').then((mod) => mod.AddressAutofill),
  { ssr: false }
);

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const isSelectingAddress = useRef(false);
  
  // Editable form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [hqAddress, setHqAddress] = useState('');
  const [hqCoords, setHqCoords] = useState<{lat: number, lng: number} | null>(null);
  const [maxRadius, setMaxRadius] = useState<number>(20); // Default 20km
  const [bringsOwnSupplies, setBringsOwnSupplies] = useState(false);
  const [hasVehicle, setHasVehicle] = useState(true);
  
  // Password and Terms state
  const [infoAccurate, setInfoAccurate] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [inviteId, setInviteId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  const loadEmployeeData = async (token: string) => {
    try {
      const res = await fetch(`/api/employees/invite/verify?id=${token}`);
      if (res.ok) {
        const data = await res.json();
        setEmployee(data.employee);
        setFullName(data.employee.full_name || '');
        setEmail(data.employee.email || '');
        setPhone(data.employee.phone || '');
        
        const existingNotes = data.employee.notes ? JSON.parse(data.employee.notes) : {};
        setHqAddress(existingNotes.hq_address || '');
        if (existingNotes.hq_coords) setHqCoords(existingNotes.hq_coords);
        if (existingNotes.max_radius) setMaxRadius(existingNotes.max_radius);
        setBringsOwnSupplies(data.employee.brings_own_supplies || false);
        setHasVehicle(data.employee.has_vehicle ?? true);
      } else {
        const errData = await res.json();
        toast.error(errData.error || 'Invalid or expired invite link.');
        router.push('/employee/login');
        return;
      }

      const { data: allZones } = await supabase.from('zones').select('*').order('name');
      setZones(allZones || []);
    } catch (e) {
      console.error("Error loading employee data", e);
      toast.error('Failed to load invite details.');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingSessionData = async () => {
    try {
      const meRes = await fetch('/api/employees/me');
      if (meRes.ok) {
        const data = await meRes.json();
        if (data.status === 'active') {
          router.push('/employee');
          return;
        }
        setEmployee(data);
        setFullName(data.full_name || '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        
        const existingNotes = data.notes ? JSON.parse(data.notes) : {};
        setHqAddress(existingNotes.hq_address || '');
        if (existingNotes.hq_coords) setHqCoords(existingNotes.hq_coords);
        if (existingNotes.max_radius) setMaxRadius(existingNotes.max_radius);
        setBringsOwnSupplies(data.brings_own_supplies || false);
        setHasVehicle(data.has_vehicle ?? true);
      } else {
        router.push('/employee/login');
        return;
      }
      const { data: allZones } = await supabase.from('zones').select('*').order('name');
      setZones(allZones || []);
    } catch (e) {
      console.error("Error loading existing data", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const invite_id = searchParams.get('invite_id');

    if (invite_id) {
      setInviteId(invite_id);
      loadEmployeeData(invite_id);
    } else {
      // Backwards compatibility for old magic links or users who already have a session
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          loadExistingSessionData();
        } else {
          router.push('/employee/login');
        }
      });
    }
  }, [router, supabase]);

  // Radius Calculations
  const calculatedZones = useMemo(() => {
    if (!hqCoords || zones.length === 0) return [];
    
    const distances = zones.map(zone => {
      if (!zone.latitude || !zone.longitude) return { zone, distance: Infinity };
      const dist = getDistanceFromLatLonInKm(hqCoords.lat, hqCoords.lng, zone.latitude, zone.longitude);
      return { zone, distance: dist };
    });

    // Filter within radius and sort by distance
    const eligible = distances
      .filter(d => d.distance <= maxRadius)
      .sort((a, b) => a.distance - b.distance);
      
    return eligible;
  }, [hqCoords, zones, maxRadius]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (!hqCoords) {
      toast.error('Please select a valid address from the autocomplete dropdown.');
      return;
    }

    if (calculatedZones.length === 0) {
      toast.error('No operating zones found within your radius. Try increasing the distance or updating your address.');
      return;
    }

    if (!infoAccurate || !agreeTerms) {
      toast.error('Please confirm the mandatory checkboxes to proceed.');
      return;
    }

    setSubmitting(true);
    try {
      const primaryZoneId = calculatedZones[0].zone.id; // Closest is primary
      const additionalZoneIds = calculatedZones.slice(1).map(z => z.zone.id);

      if (inviteId) {
        // NEW FLOW: Create the auth account and link it securely
        const res = await fetch('/api/employees/onboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invite_id: inviteId,
            password,
            fullName,
            phone,
            hqAddress,
            hqCoords,
            maxRadius,
            primaryZoneId,
            additionalZoneIds,
            bringsOwnSupplies,
            hasVehicle
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to complete onboarding');

        // Automatically log them in now that the account exists
        // (an existing account was linked while already signed in, so no sign-in is needed)
        if (!data.linkedExistingAccount) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: password
          });

          if (signInError) throw signInError;
        }

      } else {
        // OLD FLOW (Backwards compatibility)
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError) throw passwordError;

        if (additionalZoneIds.length > 0) {
          await supabase.from('contractor_zones').delete().eq('contractor_id', employee?.id);
          const zoneInserts = additionalZoneIds.map(zId => ({
            contractor_id: employee?.id,
            zone_id: zId
          }));
          await supabase.from('contractor_zones').insert(zoneInserts);
        }

        let existingNotes: any = {};
        if (employee?.notes) {
          try {
            existingNotes = typeof employee.notes === 'string' ? JSON.parse(employee.notes) : employee.notes;
          } catch {
            existingNotes = {};
          }
        }
        const updatedNotes = {
            ...existingNotes,
            hq_address: hqAddress,
            hq_coords: hqCoords,
            max_radius: maxRadius
        };

        const { error: updateError } = await supabase
          .from('employees')
          .update({ 
              full_name: fullName,
              phone: phone,
              zone_id: primaryZoneId,
              brings_own_supplies: bringsOwnSupplies,
              has_vehicle: hasVehicle,
              status: 'active',
              notes: JSON.stringify(updatedNotes)
          })
          .eq('id', employee?.id);
          
        if (updateError) throw updateError;
        await supabase.from('profiles').update({ full_name: fullName, phone: phone }).eq('id', employee?.profile_id);
      }

      toast.success('Onboarding complete! Welcome to Sea of Blue.');
      router.push('/employee');

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An error occurred during onboarding');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-50"><p>Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-12">
      <div className="w-full max-w-2xl mb-8">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/20">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12h4l3-9 5 18 3-9h5" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Complete Your Profile</h1>
        <p className="text-muted-foreground">Verify your details, set your password, and get started.</p>
      </div>

      <Card className="w-full max-w-2xl shadow-xl">
        <CardContent className="p-0">
          <form onSubmit={handleSubmit}>
            
            {/* Account Info Section */}
            <div className="p-6 bg-slate-50 border-b space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Account Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input 
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    required
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email"
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Phone Number</Label>
                  <Input 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    required
                  />
                </div>
              </div>
            </div>

            {/* Coverage Area Section */}
            <div className="p-6 border-b space-y-6">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-1">Coverage Area</h2>
                <p className="text-sm text-muted-foreground mb-4">Enter your HQ and choose how far you are willing to travel. We will automatically assign you to the operating zones within this radius.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <Label>HQ Address (Home or Office)</Label>
                  {isMounted ? (
                    <AddressAutofill 
                      accessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN!}
                      onRetrieve={(res) => {
                        const feature = res.features[0];
                        if (feature && feature.geometry) {
                          isSelectingAddress.current = true;
                          setHqCoords({
                            lng: feature.geometry.coordinates[0],
                            lat: feature.geometry.coordinates[1]
                          });
                          
                          // Also update the input text to match the full selected address
                          if (feature.properties.full_address) {
                            setHqAddress(feature.properties.full_address);
                          } else if (feature.properties.place_name) {
                            setHqAddress(feature.properties.place_name);
                          }
                          
                          setTimeout(() => {
                            isSelectingAddress.current = false;
                          }, 100);
                        }
                      }}
                    >
                      <Input 
                        placeholder="e.g. 123 Main St, Toronto, ON"
                        value={hqAddress} 
                        onChange={e => {
                          setHqAddress(e.target.value);
                          // Clear coords if they edit the address manually to force re-selection
                          // but only if it wasn't triggered by Mapbox Autofill
                          if (!isSelectingAddress.current) {
                            setHqCoords(null);
                          }
                        }} 
                        autoComplete="address-line1"
                        required
                      />
                    </AddressAutofill>
                  ) : (
                    <Input 
                      placeholder="e.g. 123 Main St, Toronto, ON"
                      value={hqAddress} 
                      onChange={e => setHqAddress(e.target.value)} 
                      required
                    />
                  )}
                  {!hqCoords && hqAddress.length > 5 && (
                    <p className="text-xs text-amber-600 mt-1">Please select an address from the dropdown to calculate zones.</p>
                  )}
                </div>

                <div>
                  <Label>Max Travel Distance</Label>
                  <Select value={maxRadius.toString()} onValueChange={(val) => setMaxRadius(Number(val))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select distance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 km</SelectItem>
                      <SelectItem value="20">20 km</SelectItem>
                      <SelectItem value="30">30 km</SelectItem>
                      <SelectItem value="40">40 km</SelectItem>
                      <SelectItem value="50">50 km</SelectItem>
                      <SelectItem value="100">100 km</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Calculated Zones Display */}
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <Label className="text-blue-900 mb-2 block">Your Operating Zones ({calculatedZones.length})</Label>
                {calculatedZones.length > 0 ? (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {calculatedZones.map((z, idx) => (
                      <Badge key={z.zone.id} variant={idx === 0 ? "default" : "secondary"} className="text-xs py-1">
                        {z.zone.name} ({Math.round(z.distance)}km)
                        {idx === 0 && " • Primary"}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-blue-600/70 italic mt-2">
                    {hqCoords ? 'No zones found within this radius. Try increasing distance.' : 'Select your HQ address above to see your zones.'}
                  </p>
                )}
              </div>
            </div>

            {/* Equipment & Vehicle */}
            <div className="p-6 border-b space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Equipment & Vehicle</h2>
              <p className="text-sm text-muted-foreground">Confirm your operational readiness to accept jobs.</p>
              <div className="flex flex-col gap-4 mt-4">
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="supplies" 
                    checked={bringsOwnSupplies} 
                    onCheckedChange={(checked) => setBringsOwnSupplies(checked as boolean)} 
                  />
                  <label htmlFor="supplies" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I bring my own cleaning supplies and equipment
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox 
                    id="vehicle" 
                    checked={hasVehicle} 
                    onCheckedChange={(checked) => setHasVehicle(checked as boolean)} 
                  />
                  <label htmlFor="vehicle" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I have access to a reliable vehicle
                  </label>
                </div>
              </div>
            </div>

            {/* Legal */}
            <div className="p-6 border-b space-y-6">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Legal & Terms</h2>
                <p className="text-sm text-muted-foreground">Please confirm your details and agree to our terms to proceed.</p>
              </div>

              <div className="flex flex-col gap-4 mt-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                <div className="flex items-start space-x-3 mt-2">
                  <Checkbox 
                    id="infoAccurate" 
                    checked={infoAccurate} 
                    onCheckedChange={(checked) => setInfoAccurate(checked as boolean)} 
                  />
                  <label htmlFor="infoAccurate" className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I confirm that all information provided is accurate and true to the best of my knowledge.
                  </label>
                </div>
                <div className="flex items-start space-x-3">
                  <Checkbox 
                    id="agreeTerms" 
                    checked={agreeTerms} 
                    onCheckedChange={(checked) => setAgreeTerms(checked as boolean)} 
                  />
                  <label htmlFor="agreeTerms" className="text-sm font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I agree to the Sea of Blue Employee Terms of Service and Privacy Policy.
                  </label>
                </div>
              </div>
            </div>

            {/* Password Setup */}
            <div className="p-6 space-y-4 bg-slate-50">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Set Your Password</h2>
              <p className="text-sm text-muted-foreground">Create a secure password to log in to your account moving forward.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>New Password <span className="text-red-500">*</span></Label>
                  <Input 
                    type="password" 
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Confirm Password <span className="text-red-500">*</span></Label>
                  <Input 
                    type="password" 
                    required 
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 pt-0 bg-slate-50">
              <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={submitting}>
                {submitting ? 'Setting up your profile...' : 'Complete Onboarding & Start'}
              </Button>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
