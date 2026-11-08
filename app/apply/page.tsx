'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Building2, 
  Users, 
  UserCircle,
  Briefcase,
  ShieldCheck,
  MapPin,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Footer } from '@/components/landing/Footer';

export default function ApplyPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    businessName: '',
    email: '',
    phone: '',
    applicantType: '',
    yearsExperience: '',
    teamSize: '',
    servicesOffered: [] as string[],
    otherService: '',
    primaryCity: '',
    serviceAreas: '',
    travelRadius: '',
    weekdaysAvailable: [] as string[],
    preferredJobTypes: [] as string[],
    hasLiabilityInsurance: 'Company Covered',
    insuranceProvider: '',
    hasRegisteredBusiness: '',
    businessRegistrationNumber: '',
    legallyAllowedToWorkOntario: '',
    agreesToVerification: false,
    hasGoogleBusinessProfile: '',
    googleBusinessProfileLink: '',
    googleBusinessProfileBusinessName: '',
    googleRating: '',
    googleReviewCount: '',
    googleBusinessProfileVerified: '',
    websiteUrl: '',
    instagramUrl: '',
    facebookUrl: '',
    otherProfileUrl: '',
    businessDescription: '',
    reasonForJoining: '',
    consentInformationAccurate: false,
    consentApplicationNotGuaranteed: false,
    consentContact: false,
  });

  const handleCheckboxChange = (field: 'servicesOffered' | 'weekdaysAvailable' | 'preferredJobTypes', value: string, checked: boolean) => {
    setForm(prev => ({
      ...prev,
      [field]: checked 
        ? [...prev[field], value]
        : prev[field].filter(v => v !== value)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Basic validation
    if (!form.consentInformationAccurate || !form.consentApplicationNotGuaranteed || !form.consentContact || !form.agreesToVerification) {
      setError("You must agree to all consent and verification checkboxes.");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = { ...form };
      if (form.otherService) {
        payload.servicesOffered.push(`Other: ${form.otherService}`);
      }

      const res = await fetch('/api/employee-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit application');
      
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById('application-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen text-white flex flex-col font-sans relative overflow-x-hidden" style={{ backgroundColor: '#010A14' }}>
      {/* Background glow overlay */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#021A35]/30 rounded-full blur-[120px] pointer-events-none" />

      {/* HEADER */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#010A14]/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-6">
          <Link href="/" className="flex items-center justify-start hover:opacity-80 transition-opacity">
            <img
              src="/nav-logo.png?v=2"
              alt="Sea of Blue"
              className="h-4 w-auto object-contain"
            />
          </Link>
          <nav className="flex items-center gap-6">
            <Link 
              href="/employee/login" 
              className="text-xs uppercase tracking-widest text-white/50 hover:text-white transition-colors"
            >
              Employee Login
            </Link>
            <button 
              onClick={scrollToForm} 
              className="hidden sm:inline-block bg-white text-[#010A14] px-6 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-white/90 transition-colors"
            >
              Apply to Join
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {/* Intro Section */}
        <section className="py-20">
          <div className="container max-w-3xl mx-auto px-6 text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-rustic tracking-wide text-white">
              Apply to Join the Network
            </h1>
            <p className="text-lg text-white/50 leading-relaxed max-w-2xl mx-auto">
              Submit your information below. Our team will review your application and contact selected applicants for the next onboarding steps.
            </p>
            <div className="pt-2">
              <span className="text-xs font-medium text-amber-400 bg-amber-400/10 inline-block px-5 py-2 rounded-full border border-amber-400/25">
                Important: Submitting an application does not guarantee approval.
              </span>
            </div>
          </div>
        </section>

        {/* APPLICATION FORM */}
        <section id="application-form" className="pb-32">
          <div className="container max-w-3xl mx-auto px-6">
            
            {isSuccess ? (
              <Card className="border border-green-500/20 bg-green-500/5 shadow-2xl text-center py-16 rounded-xl">
                <CardContent className="space-y-6 flex flex-col items-center">
                  <div className="h-16 w-16 bg-green-500/10 text-green-400 rounded-full flex items-center justify-center mb-4 border border-green-500/25">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-white font-rustic tracking-wide">Application Submitted</h2>
                  <p className="text-white/60 text-lg max-w-lg leading-relaxed">
                    Thank you! Your application has been submitted successfully. Our team will review your request and contact selected applicants for next steps.
                  </p>
                  <div className="pt-4">
                    <Link
                      href="/"
                      className="bg-white text-[#010A14] px-8 py-3 rounded-full text-xs font-semibold uppercase tracking-wider hover:bg-white/90 transition-colors inline-block"
                    >
                      Return to Home
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-8">
                <Card className="shadow-2xl border border-white/5 bg-[#021A35]/30 backdrop-blur-md rounded-xl">
                  <CardContent className="p-8 md:p-12 text-white">
                    {error && (
                      <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm font-medium">
                        {error}
                      </div>
                    )}
                    
                    <form onSubmit={handleSubmit} className="space-y-12">
                      {/* 1. Applicant Information */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-6">
                          <UserCircle className="text-white/80 h-5 w-5" />
                          <h3 className="text-lg font-semibold tracking-wide">Applicant Information</h3>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-white/70">Full Name <span className="text-red-400">*</span></Label>
                            <Input 
                              required 
                              value={form.fullName} 
                              onChange={e => setForm({...form, fullName: e.target.value})} 
                              placeholder="Jane Doe"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Business Name (Optional)</Label>
                            <Input 
                              value={form.businessName} 
                              onChange={e => setForm({...form, businessName: e.target.value})} 
                              placeholder="Jane's Cleaning"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Email Address <span className="text-red-400">*</span></Label>
                            <Input 
                              type="email" 
                              required 
                              value={form.email} 
                              onChange={e => setForm({...form, email: e.target.value})} 
                              placeholder="jane@example.com"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Phone Number <span className="text-red-400">*</span></Label>
                            <Input 
                              type="tel" 
                              required 
                              value={form.phone} 
                              onChange={e => setForm({...form, phone: e.target.value})} 
                              placeholder="416-555-0192"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 2. Business Type */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-6">
                          <Briefcase className="text-white/80 h-5 w-5" />
                          <h3 className="text-lg font-semibold tracking-wide">Business Type</h3>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-white/70">Applicant Type <span className="text-red-400">*</span></Label>
                            <Select required value={form.applicantType} onValueChange={v => setForm({...form, applicantType: v})}>
                              <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-white/40 focus:border-white/40 h-11">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#021A35] text-white border-white/10">
                                <SelectItem value="Independent Cleaner" className="focus:bg-white/10 focus:text-white">Independent Cleaner</SelectItem>
                                <SelectItem value="Cleaning Team" className="focus:bg-white/10 focus:text-white">Cleaning Team</SelectItem>
                                <SelectItem value="Cleaning Company" className="focus:bg-white/10 focus:text-white">Cleaning Company</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Years of Experience <span className="text-red-400">*</span></Label>
                            <Input 
                              required 
                              value={form.yearsExperience} 
                              onChange={e => setForm({...form, yearsExperience: e.target.value})} 
                              placeholder="e.g. 5"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Number of Team Members (Optional)</Label>
                            <Input 
                              type="number" 
                              value={form.teamSize} 
                              onChange={e => setForm({...form, teamSize: e.target.value})} 
                              placeholder="e.g. 3"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                        </div>
                      </div>

                      {/* 3. Services Offered */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-6">
                          <CheckCircle2 className="text-white/80 h-5 w-5" />
                          <h3 className="text-lg font-semibold tracking-wide">Services Offered</h3>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-8">
                          <div className="space-y-4">
                            <Label className="text-base text-white/90">Residential Cleaning</Label>
                            {['Standard Cleaning', 'Deep Cleaning', 'Move-In / Move-Out Cleaning', 'Post-Construction Cleaning', 'Airbnb Turnovers'].map(service => (
                              <div key={service} className="flex items-center space-x-3">
                                <Checkbox 
                                  id={service} 
                                  checked={form.servicesOffered.includes(service)} 
                                  onCheckedChange={(c) => handleCheckboxChange('servicesOffered', service, !!c)}
                                  className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#010A14]"
                                />
                                <Label htmlFor={service} className="font-normal text-white/70 text-sm cursor-pointer">{service}</Label>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-4">
                            <Label className="text-base text-white/90">Commercial & Specialty</Label>
                            {['Office Cleaning', 'Retail Cleaning', 'Facility Cleaning', 'Window Cleaning', 'Pressure Washing', 'Carpet Cleaning'].map(service => (
                              <div key={service} className="flex items-center space-x-3">
                                <Checkbox 
                                  id={service} 
                                  checked={form.servicesOffered.includes(service)} 
                                  onCheckedChange={(c) => handleCheckboxChange('servicesOffered', service, !!c)}
                                  className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#010A14]"
                                />
                                <Label htmlFor={service} className="font-normal text-white/70 text-sm cursor-pointer">{service}</Label>
                              </div>
                            ))}
                            <div className="pt-2 space-y-2">
                              <Label className="font-normal text-sm text-white/70">Other Service</Label>
                              <Input 
                                value={form.otherService} 
                                onChange={e => setForm({...form, otherService: e.target.value})} 
                                placeholder="Please specify"
                                className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4. Service Area & Availability */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-6">
                          <MapPin className="text-white/80 h-5 w-5" />
                          <h3 className="text-lg font-semibold tracking-wide">Service Area & Availability</h3>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-white/70">Primary City <span className="text-red-400">*</span></Label>
                            <Input 
                              required 
                              value={form.primaryCity} 
                              onChange={e => setForm({...form, primaryCity: e.target.value})} 
                              placeholder="e.g. Toronto"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Maximum Travel Radius</Label>
                            <Select value={form.travelRadius} onValueChange={v => setForm({...form, travelRadius: v})}>
                              <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-white/40 focus:border-white/40 h-11">
                                <SelectValue placeholder="Select radius" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#021A35] text-white border-white/10">
                                <SelectItem value="10 km" className="focus:bg-white/10 focus:text-white">10 km</SelectItem>
                                <SelectItem value="20 km" className="focus:bg-white/10 focus:text-white">20 km</SelectItem>
                                <SelectItem value="30 km" className="focus:bg-white/10 focus:text-white">30 km</SelectItem>
                                <SelectItem value="50 km" className="focus:bg-white/10 focus:text-white">50 km</SelectItem>
                                <SelectItem value="75 km" className="focus:bg-white/10 focus:text-white">75 km</SelectItem>
                                <SelectItem value="100 km+" className="focus:bg-white/10 focus:text-white">100 km+</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-white/70">Service Areas <span className="text-red-400">*</span></Label>
                            <Textarea 
                              required 
                              value={form.serviceAreas} 
                              onChange={e => setForm({...form, serviceAreas: e.target.value})} 
                              placeholder="List the cities or neighborhoods you service"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 min-h-20"
                            />
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-8 pt-4">
                          <div className="space-y-3">
                            <Label className="text-white/80">Weekdays Available</Label>
                            <div className="grid grid-cols-2 gap-3">
                              {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(day => (
                                <div key={day} className="flex items-center space-x-3">
                                  <Checkbox 
                                    id={day} 
                                    checked={form.weekdaysAvailable.includes(day)} 
                                    onCheckedChange={(c) => handleCheckboxChange('weekdaysAvailable', day, !!c)}
                                    className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#010A14]"
                                  />
                                  <Label htmlFor={day} className="font-normal text-white/70 text-sm cursor-pointer">{day}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-3">
                            <Label className="text-white/80">Preferred Job Types</Label>
                            <div className="space-y-3">
                              {['One-time jobs','Recurring jobs','Same-day jobs','Commercial jobs','Residential jobs'].map(type => (
                                <div key={type} className="flex items-center space-x-3">
                                  <Checkbox 
                                    id={type} 
                                    checked={form.preferredJobTypes.includes(type)} 
                                    onCheckedChange={(c) => handleCheckboxChange('preferredJobTypes', type, !!c)}
                                    className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#010A14]"
                                  />
                                  <Label htmlFor={type} className="font-normal text-white/70 text-sm cursor-pointer">{type}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 5. Insurance / Compliance */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-6">
                          <ShieldCheck className="text-white/80 h-5 w-5" />
                          <h3 className="text-lg font-semibold tracking-wide">Insurance & Compliance</h3>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-white/70">Liability Insurance</Label>
                            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-3 text-xs text-emerald-200 flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                              <span>Commercial General Liability Insurance is fully provided and maintained by Sea of Blue for all cleaning staff. Personal contractor insurance is not required.</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Insurance Provider (Optional)</Label>
                            <Input 
                              value={form.insuranceProvider} 
                              onChange={e => setForm({...form, insuranceProvider: e.target.value})} 
                              placeholder="e.g. Intact"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Registered Business? <span className="text-red-400">*</span></Label>
                            <Select required value={form.hasRegisteredBusiness} onValueChange={v => setForm({...form, hasRegisteredBusiness: v})}>
                              <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-white/40 focus:border-white/40 h-11">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#021A35] text-white border-white/10">
                                <SelectItem value="Yes" className="focus:bg-white/10 focus:text-white">Yes</SelectItem>
                                <SelectItem value="No" className="focus:bg-white/10 focus:text-white">No</SelectItem>
                                <SelectItem value="In Progress" className="focus:bg-white/10 focus:text-white">In Progress</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Business Reg. Number (Optional)</Label>
                            <Input 
                              value={form.businessRegistrationNumber} 
                              onChange={e => setForm({...form, businessRegistrationNumber: e.target.value})} 
                              placeholder="e.g. 123456789"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Legally allowed to work in Ontario? <span className="text-red-400">*</span></Label>
                            <Select required value={form.legallyAllowedToWorkOntario} onValueChange={v => setForm({...form, legallyAllowedToWorkOntario: v})}>
                              <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-white/40 focus:border-white/40 h-11">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#021A35] text-white border-white/10">
                                <SelectItem value="Yes" className="focus:bg-white/10 focus:text-white">Yes</SelectItem>
                                <SelectItem value="No" className="focus:bg-white/10 focus:text-white">No</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2 pt-6">
                            <div className="flex items-start space-x-3">
                              <Checkbox 
                                required 
                                id="verification" 
                                checked={form.agreesToVerification} 
                                onCheckedChange={(c) => setForm({...form, agreesToVerification: !!c})}
                                className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#010A14]"
                              />
                              <Label htmlFor="verification" className="font-normal text-white/70 text-sm leading-snug cursor-pointer">
                                I agree to complete verification (ID check, background check) if selected. <span className="text-red-400">*</span>
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 6. Google Business Profile Section */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-6">
                          <Users className="text-white/80 h-5 w-5" />
                          <h3 className="text-lg font-semibold tracking-wide">Google Business Profile</h3>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-white/70">Do you have a Google Business Profile? <span className="text-red-400">*</span></Label>
                            <Select required value={form.hasGoogleBusinessProfile} onValueChange={v => setForm({...form, hasGoogleBusinessProfile: v})}>
                              <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-white/40 focus:border-white/40 h-11 w-full sm:w-1/2">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#021A35] text-white border-white/10">
                                <SelectItem value="Yes" className="focus:bg-white/10 focus:text-white">Yes</SelectItem>
                                <SelectItem value="No" className="focus:bg-white/10 focus:text-white">No</SelectItem>
                                <SelectItem value="In Progress" className="focus:bg-white/10 focus:text-white">In Progress</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Profile Link (URL)</Label>
                            <Input 
                              type="url" 
                              value={form.googleBusinessProfileLink} 
                              onChange={e => setForm({...form, googleBusinessProfileLink: e.target.value})} 
                              placeholder="https://g.page/..."
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Business Name on Google</Label>
                            <Input 
                              value={form.googleBusinessProfileBusinessName} 
                              onChange={e => setForm({...form, googleBusinessProfileBusinessName: e.target.value})} 
                              placeholder="e.g. Jane's Cleaning Service"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Approximate Rating</Label>
                            <Select value={form.googleRating} onValueChange={v => setForm({...form, googleRating: v})}>
                              <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-white/40 focus:border-white/40 h-11">
                                <SelectValue placeholder="Select rating" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#021A35] text-white border-white/10">
                                <SelectItem value="No reviews yet" className="focus:bg-white/10 focus:text-white">No reviews yet</SelectItem>
                                <SelectItem value="Under 3.0" className="focus:bg-white/10 focus:text-white">Under 3.0</SelectItem>
                                <SelectItem value="3.0 - 3.4" className="focus:bg-white/10 focus:text-white">3.0 - 3.4</SelectItem>
                                <SelectItem value="3.5 - 3.9" className="focus:bg-white/10 focus:text-white">3.5 - 3.9</SelectItem>
                                <SelectItem value="4.0 - 4.4" className="focus:bg-white/10 focus:text-white">4.0 - 4.4</SelectItem>
                                <SelectItem value="4.5 - 5.0" className="focus:bg-white/10 focus:text-white">4.5 - 5.0</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Number of Reviews</Label>
                            <Input 
                              type="number" 
                              value={form.googleReviewCount} 
                              onChange={e => setForm({...form, googleReviewCount: e.target.value})} 
                              placeholder="e.g. 15"
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Is your profile verified?</Label>
                            <Select value={form.googleBusinessProfileVerified} onValueChange={v => setForm({...form, googleBusinessProfileVerified: v})}>
                              <SelectTrigger className="bg-white/5 border-white/10 text-white focus:ring-white/40 focus:border-white/40 h-11">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent className="bg-[#021A35] text-white border-white/10">
                                <SelectItem value="Yes" className="focus:bg-white/10 focus:text-white">Yes</SelectItem>
                                <SelectItem value="No" className="focus:bg-white/10 focus:text-white">No</SelectItem>
                                <SelectItem value="Not Sure" className="focus:bg-white/10 focus:text-white">Not Sure</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* 7. Online Presence & Notes */}
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-6">
                          <CheckCircle2 className="text-white/80 h-5 w-5" />
                          <h3 className="text-lg font-semibold tracking-wide">Online Presence & Details</h3>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-white/70">Website URL</Label>
                            <Input 
                              type="url" 
                              value={form.websiteUrl} 
                              onChange={e => setForm({...form, websiteUrl: e.target.value})} 
                              placeholder="https://..."
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Instagram URL</Label>
                            <Input 
                              type="url" 
                              value={form.instagramUrl} 
                              onChange={e => setForm({...form, instagramUrl: e.target.value})} 
                              placeholder="https://instagram.com/..."
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Facebook Page URL</Label>
                            <Input 
                              type="url" 
                              value={form.facebookUrl} 
                              onChange={e => setForm({...form, facebookUrl: e.target.value})} 
                              placeholder="https://facebook.com/..."
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-white/70">Other Profile (Yelp, Houzz, etc.)</Label>
                            <Input 
                              type="url" 
                              value={form.otherProfileUrl} 
                              onChange={e => setForm({...form, otherProfileUrl: e.target.value})} 
                              placeholder="https://..."
                              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40 h-11"
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-white/70">Briefly tell us about your cleaning business <span className="text-red-400">*</span></Label>
                            <Textarea 
                              required 
                              className="min-h-24 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40" 
                              value={form.businessDescription} 
                              onChange={e => setForm({...form, businessDescription: e.target.value})} 
                              placeholder="Describe your services, your team, and your approach to cleaning." 
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-white/70">Why do you want to join Sea of Blue? (Optional)</Label>
                            <Textarea 
                              className="min-h-20 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-white/40 focus-visible:border-white/40" 
                              value={form.reasonForJoining} 
                              onChange={e => setForm({...form, reasonForJoining: e.target.value})} 
                              placeholder="" 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Documents Notice */}
                      <div className="bg-white/5 p-5 rounded-lg border border-white/10 text-sm text-white/60 leading-relaxed">
                        <strong className="text-white/90">Document Uploads:</strong> Supporting documents (insurance, business license) may be requested during the review process.
                      </div>

                      {/* 8. Consent */}
                      <div className="space-y-4 pt-4 border-t border-white/10">
                        <div className="flex items-start space-x-3">
                          <Checkbox 
                            required 
                            id="c1" 
                            checked={form.consentInformationAccurate} 
                            onCheckedChange={(c) => setForm({...form, consentInformationAccurate: !!c})}
                            className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#010A14]"
                          />
                          <Label htmlFor="c1" className="font-normal text-sm text-white/60 leading-snug cursor-pointer">
                            I confirm that the information submitted is accurate. <span className="text-red-400">*</span>
                          </Label>
                        </div>
                        <div className="flex items-start space-x-3">
                          <Checkbox 
                            required 
                            id="c2" 
                            checked={form.consentApplicationNotGuaranteed} 
                            onCheckedChange={(c) => setForm({...form, consentApplicationNotGuaranteed: !!c})}
                            className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#010A14]"
                          />
                          <Label htmlFor="c2" className="font-normal text-sm text-white/60 leading-snug cursor-pointer">
                            I understand that this is an application request and does not guarantee approval. <span className="text-red-400">*</span>
                          </Label>
                        </div>
                        <div className="flex items-start space-x-3">
                          <Checkbox 
                            required 
                            id="c3" 
                            checked={form.consentContact} 
                            onCheckedChange={(c) => setForm({...form, consentContact: !!c})}
                            className="border-white/20 data-[state=checked]:bg-white data-[state=checked]:text-[#010A14]"
                          />
                          <Label htmlFor="c3" className="font-normal text-sm text-white/60 leading-snug cursor-pointer">
                            I agree that Sea of Blue may contact me regarding my application. <span className="text-red-400">*</span>
                          </Label>
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button 
                          type="submit" 
                          disabled={isSubmitting}
                          className="w-full h-12 bg-white text-[#010A14] hover:bg-white/90 text-sm font-semibold uppercase tracking-[0.25em] transition-colors focus:ring-2 focus:ring-white/40"
                        >
                          {isSubmitting ? 'Submitting Application...' : 'Submit Application'}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <Footer />
    </div>
  );
}
