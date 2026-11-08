'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, User, Home, Key, MapPin, CheckCircle2, ChevronRight, ChevronLeft, Search } from 'lucide-react';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import dynamic_import from 'next/dynamic';

export default function CustomerOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isSelectingAddress = useRef(false);
  
  // Step 1: Profile
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Step 2: Property
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [homeSize, setHomeSize] = useState<number | ''>('');
  const [bedrooms, setBedrooms] = useState<number | ''>('');
  const [bathrooms, setBathrooms] = useState<number | ''>('');
  
  // Step 3: Preferences
  const [hasPets, setHasPets] = useState(false);
  const [parkingInstructions, setParkingInstructions] = useState('');
  const [entryInstructions, setEntryInstructions] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );

  useEffect(() => {
    async function loadProfile() {
      try {
        const { data: session } = await supabase.auth.getSession();
        if (!session?.session) {
          router.push('/customer-site/login');
          return;
        }

        const res = await fetch('/api/customers/me');
        if (res.ok) {
          const customer = await res.json();
          if (customer) {
            let isOnboarded = false;
            let notes: any = {};
            try {
              notes = customer.notes ? JSON.parse(customer.notes) : {};
              isOnboarded = notes.is_onboarded || !!customer.address_line1;
            } catch (e) {
              isOnboarded = !!customer.address_line1;
            }
            
            if (isOnboarded) {
              router.push('/customer-site/portal');
              return;
            }

            setFullName(customer.full_name || '');
            setPhone(customer.phone || '');
            setAddressLine1(customer.address_line1 || '');
            setAddressLine2(customer.address_line2 || '');
            setCity(customer.city || '');
            setProvince(customer.province || '');
            setPostalCode(customer.postal_code || '');
            
            if (notes.home_size_sqft) setHomeSize(notes.home_size_sqft);
            if (notes.bedrooms) setBedrooms(notes.bedrooms);
            if (notes.bathrooms) setBathrooms(notes.bathrooms);
            if (notes.has_pets !== undefined) setHasPets(notes.has_pets);
            if (notes.parking_instructions) setParkingInstructions(notes.parking_instructions);
            if (notes.entry_instructions) setEntryInstructions(notes.entry_instructions);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [router, supabase]);

  const handleNext = () => setStep(s => Math.min(s + 1, 3));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        full_name: fullName,
        phone,
        address_line1: addressLine1,
        address_line2: addressLine2,
        city,
        province,
        postal_code: postalCode,
        home_size_sqft: homeSize || null,
        bedrooms: bedrooms || null,
        bathrooms: bathrooms || null,
        has_pets: hasPets,
        parking_instructions: parkingInstructions,
        entry_instructions: entryInstructions,
        is_onboarded: true
      };

      const res = await fetch('/api/customers/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save profile');
      
      toast.success('Account setup complete!');
      router.push('/customer-site/portal');
    } catch (err: any) {
      toast.error(err.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#010A14] flex flex-col justify-center items-center py-12 px-4 sm:px-6">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center space-y-3">
            <Skeleton className="h-10 w-36 mx-auto bg-white/10" />
            <Skeleton className="h-9 w-72 mx-auto bg-white/10" />
            <Skeleton className="h-4 w-96 max-w-full mx-auto bg-white/10" />
          </div>
          <Skeleton className="h-80 w-full rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010A14] flex flex-col justify-center items-center py-12 px-4 sm:px-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#001a36]/50 rounded-full blur-[120px] pointer-events-none -translate-x-1/3 translate-y-1/3" />

      <div className="w-full max-w-xl relative z-10">
        <div className="text-center mb-10">
          <img src="/nav-logo.png?v=2" alt="Sea of Blue" className="h-10 w-auto mx-auto mb-6" />
          <h1 className="font-rustic text-4xl text-white mb-2">Welcome to Sea of Blue</h1>
          <p className="text-white/60">Let&apos;s set up your home profile to get you accurate quotes and seamless service.</p>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-8 relative">
          <div className="absolute left-0 top-1/2 w-full h-1 bg-white/10 -translate-y-1/2 rounded-full" />
          <div 
            className="absolute left-0 top-1/2 h-1 bg-blue-500 -translate-y-1/2 rounded-full transition-all duration-500" 
            style={{ width: `${((step - 1) / 2) * 100}%` }} 
          />
          
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors duration-300 ${
                step >= s ? 'bg-blue-500 text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]' : 'bg-[#001a36] text-white/40 border border-white/10'
              }`}
            >
              {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
          ))}
        </div>

        <Card className="bg-[#001a36]/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          <CardContent className="p-8">
            
            {/* STEP 1: PROFILE */}
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Basic Information</h2>
                    <p className="text-sm text-white/50">Tell us a bit about yourself.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-white/80">Full Name</Label>
                    <Input 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="bg-black/20 border-white/10 text-white placeholder:text-white/20 h-12 rounded-xl"
                      placeholder="e.g. Sarah Jenkins"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">Phone Number</Label>
                    <Input 
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-black/20 border-white/10 text-white placeholder:text-white/20 h-12 rounded-xl"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: PROPERTY */}
            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Home className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Property Details</h2>
                    <p className="text-sm text-white/50">Where will we be cleaning?</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2 relative">
                    <Label className="text-white/80 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" /> Primary Address
                    </Label>
                    <AddressAutocomplete 
                      theme="dark"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      onAddressSelect={(addr) => {
                        setAddressLine1(addr.address_line1);
                        setCity(addr.city);
                        setProvince(addr.state);
                        setPostalCode(addr.postal_code);
                        isSelectingAddress.current = false;
                      }}
                      className="bg-black/20 border-white/10 text-white h-12 rounded-xl pr-10"
                    />
                    <Input type="hidden" autoComplete="address-line2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
                    <Input type="hidden" autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
                    <Input type="hidden" autoComplete="address-level1" value={province} onChange={(e) => setProvince(e.target.value)} />
                    <Input type="hidden" autoComplete="postal-code" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-white/80">Sq. Ft.</Label>
                      <Input 
                        type="number"
                        value={homeSize}
                        onChange={(e) => setHomeSize(parseInt(e.target.value) || '')}
                        className="bg-black/20 border-white/10 text-white h-12 rounded-xl"
                        placeholder="2500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80">Bedrooms</Label>
                      <Input 
                        type="number"
                        value={bedrooms}
                        onChange={(e) => setBedrooms(parseInt(e.target.value) || '')}
                        className="bg-black/20 border-white/10 text-white h-12 rounded-xl"
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <Label className="text-white/80">Bathrooms</Label>
                      <Input 
                        type="number"
                        value={bathrooms}
                        onChange={(e) => setBathrooms(parseInt(e.target.value) || '')}
                        className="bg-black/20 border-white/10 text-white h-12 rounded-xl"
                        placeholder="2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: PREFERENCES */}
            {step === 3 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Access & Preferences</h2>
                    <p className="text-sm text-white/50">Help our cleaners serve you better.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center space-x-3 bg-black/20 border border-white/10 p-4 rounded-xl cursor-pointer" onClick={() => setHasPets(!hasPets)}>
                    <Checkbox checked={hasPets} onCheckedChange={(c) => setHasPets(c as boolean)} id="pets" className="border-white/30 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                    <Label htmlFor="pets" className="text-white font-medium cursor-pointer">I have pets in the home</Label>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80">Parking Instructions</Label>
                    <Input 
                      value={parkingInstructions}
                      onChange={(e) => setParkingInstructions(e.target.value)}
                      className="bg-black/20 border-white/10 text-white h-12 rounded-xl"
                      placeholder="e.g. Park in the driveway, or visitor parking spot #4"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-white/80">Home Entry Instructions</Label>
                    <Input 
                      value={entryInstructions}
                      onChange={(e) => setEntryInstructions(e.target.value)}
                      className="bg-black/20 border-white/10 text-white h-12 rounded-xl"
                      placeholder="e.g. Front door code is 1234, or I will be home"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-8 pt-6 border-t border-white/10">
              {step > 1 && (
                <Button 
                  variant="outline" 
                  onClick={handleBack} 
                  className="h-12 px-6 bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              )}
              
              <Button 
                onClick={step === 3 ? handleSubmit : handleNext} 
                disabled={submitting || (step === 1 && !fullName) || (step === 2 && !addressLine1)}
                className="h-12 flex-1 bg-white text-[#010A14] hover:bg-white/90 font-bold transition-colors"
              >
                {step === 3 ? (
                  submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Setup'
                ) : (
                  <>Next Step <ChevronRight className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
