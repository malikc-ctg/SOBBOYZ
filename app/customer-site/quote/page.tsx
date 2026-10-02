'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { DatePicker } from '@/components/ui/date-picker';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import { submitQuoteRequest, getLiveQuote, createCustomerAccountAndLinkQuote } from './actions';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, MapPin, ChevronRight, ChevronLeft, Home, Sparkles, Calendar, User, Key, ArrowRight, Plus, Minus, Clock, Building2, Warehouse } from 'lucide-react';

export default function QuotePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [isSkipped, setIsSkipped] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const [formData, setFormData] = useState({
    category: '',
    address: '',
    city: '',
    province: 'ON',
    postal_code: '',
    description: '',
    home_bedrooms: 2,
    home_bathrooms: 1,
    has_pets: false,
    scheduled_date: '',
    scheduled_window: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    property_type: 'house',
  });

  const updateForm = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const categories = [
    { id: 'Standard Clean', title: 'Standard Clean', desc: 'Routine upkeep for a tidy home.' },
    { id: 'Deep Clean', title: 'Deep Clean', desc: 'Thorough cleaning for built-up grime.' },
    { id: 'Move In/Out Clean', title: 'Move In/Out Clean', desc: 'Make it spotless for the next chapter.' },
    { id: 'Recurring Standard', title: 'Recurring Standard', desc: 'Weekly or bi-weekly maintenance.' },
    { id: 'Recurring Deep', title: 'Recurring Deep', desc: 'Consistent deep cleaning schedule.' }
  ];

  const windows = [
    { id: 'morning', label: 'Morning (8am - 12pm)' },
    { id: 'afternoon', label: 'Afternoon (12pm - 4pm)' },
    { id: 'evening', label: 'Evening (4pm - 8pm)' }
  ];

  const nextStep = () => setStep(s => Math.min(7, s + 1));
  const prevStep = () => setStep(s => Math.max(1, s - 1));

  const handleGenerateQuote = async () => {
    setIsGeneratingQuote(true);
    setError(null);
    try {
      let service_type = 'standard_clean';
      if (formData.category === 'Deep Clean') service_type = 'deep_clean';
      else if (formData.category === 'Move In/Out Clean') service_type = 'move_in_clean';
      else if (formData.category === 'Recurring Standard') service_type = 'recurring_standard';
      else if (formData.category === 'Recurring Deep') service_type = 'recurring_deep';

      const res = await getLiveQuote({
        property_type: (formData as any).property_type,
        service_type,
        scheduled_date: formData.scheduled_date,
        scheduled_window: formData.scheduled_window,
        home_bedrooms: formData.home_bedrooms,
        home_bathrooms: formData.home_bathrooms,
        has_pets: formData.has_pets,
        add_ons: []
      });

      if (res.success && res.quote) {
        setQuoteData(res.quote);
        nextStep(); // Move to Step 6 (Gate)
      } else {
        setError(res.error || 'Failed to generate quote. Please ensure we service your area.');
      }
    } catch (e) {
      setError('An unexpected error occurred generating your quote.');
    } finally {
      setIsGeneratingQuote(false);
    }
  };

  const handleCreateAccount = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await createCustomerAccountAndLinkQuote({
        ...formData,
        quoted_price: quoteData?.final_price,
      });

      if (res.success) {
        if (res.needsEmailConfirmation) {
          // The account can't sign in until the email address is confirmed
          setNeedsEmailConfirmation(true);
        } else {
          // Log them in!
          const supabase = createClient();
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });

          if (signInError) {
            console.error("Auto login failed:", signInError);
          }
        }
        
        setIsSkipped(false);
        nextStep(); // Move to Step 7 Reveal
      } else {
        setError(res.error || 'Failed to create account.');
      }
    } catch (e) {
      setError('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipAccount = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await submitQuoteRequest({
        ...formData,
        quoted_price: quoteData?.final_price,
      });

      if (res.success) {
        setIsSkipped(true);
        nextStep(); // Move to Step 7 Success
      } else {
        setError(res.error || 'Failed to submit request');
      }
    } catch (e) {
      setError('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prevent scroll jumping
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  };

  return (
    <div className="min-h-screen bg-[#010A14] flex flex-col pt-20 pb-10 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header & Progress */}
      <div className="max-w-2xl w-full mx-auto px-6 relative z-10 mb-10">
        <Link href="/" className="text-white/50 hover:text-white text-sm font-medium tracking-wide flex items-center gap-2 mb-8 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Home
        </Link>
        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${(step / 7) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>
      </div>

      <div className="flex-1 w-full max-w-2xl mx-auto px-6 relative z-10">
        <AnimatePresence mode="wait">
          
          {step === 1 && (
            <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
              <h1 className="font-rustic text-4xl text-white mb-2">What type of cleaning do you need?</h1>
              <p className="text-white/60 mb-8">Select a service to get started.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      updateForm('category', cat.id);
                      setTimeout(nextStep, 150); // Small delay for visual feedback
                    }}
                    className={`p-6 rounded-2xl border text-left transition-all ${
                      formData.category === cat.id 
                        ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.3)]' 
                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Sparkles className={`w-5 h-5 ${formData.category === cat.id ? 'text-blue-400' : 'text-white/50'}`} />
                      <span className={`font-semibold ${formData.category === cat.id ? 'text-white' : 'text-white/90'}`}>{cat.title}</span>
                    </div>
                    <p className="text-white/50 text-sm">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
              <h1 className="font-rustic text-4xl text-white mb-2">Where is your home?</h1>
              <p className="text-white/60 mb-8">We currently serve the Greater Ontario area.</p>
              
              <div className="mb-10 relative">
                <AddressAutocomplete 
                  theme="dark"
                  value={formData.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                  onAddressSelect={(addr) => {
                    updateForm('address', addr.address_line1);
                    updateForm('city', addr.city);
                    updateForm('province', addr.state);
                    updateForm('postal_code', addr.postal_code);
                  }}
                  className="bg-black/20 border-white/10 text-white h-16 rounded-2xl pl-12 text-lg"
                  placeholder="Start typing your address..."
                />
                <MapPin className="absolute left-4 top-5 w-5 h-5 text-white/40" />
              </div>

              <div className="flex justify-between items-center">
                <button onClick={prevStep} className="text-white/60 hover:text-white transition-colors">Back</button>
                <button 
                  disabled={!formData.address}
                  onClick={nextStep}
                  className="bg-white text-[#010A14] px-8 py-4 rounded-full font-bold tracking-widest uppercase hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
              <h1 className="font-rustic text-4xl text-white mb-2">Tell us about the space.</h1>
              <p className="text-white/60 mb-8">This helps us calculate the time needed for a pristine clean.</p>
              
              <div className="space-y-8 mb-10">
                <div className="space-y-3">
                  <span className="text-sm font-semibold text-white/70">Property Type</span>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'house', label: 'House', icon: Home },
                      { id: 'condo', label: 'Condo/Apt', icon: Building2 },
                      { id: 'basement', label: 'Basement', icon: Warehouse },
                    ].map((pt) => {
                      const Icon = pt.icon;
                      const isSelected = (formData as any).property_type === pt.id;
                      return (
                        <button
                          key={pt.id}
                          type="button"
                          onClick={() => updateForm('property_type' as any, pt.id)}
                          className={`flex flex-col items-center gap-2.5 p-4 rounded-xl border text-center transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                              : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                          }`}
                        >
                          <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-400' : 'text-white/60'}`} />
                          <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-white/60'}`}>
                            {pt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-2xl p-6">
                  <span className="text-lg text-white font-medium">Bedrooms</span>
                  <div className="flex items-center gap-6">
                    <button onClick={() => updateForm('home_bedrooms', Math.max(0, formData.home_bedrooms - 1))} className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10"><Minus className="w-4 h-4" /></button>
                    <span className="text-2xl font-bold text-white w-6 text-center">{formData.home_bedrooms}</span>
                    <button onClick={() => updateForm('home_bedrooms', formData.home_bedrooms + 1)} className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-2xl p-6">
                  <span className="text-lg text-white font-medium">Bathrooms</span>
                  <div className="flex items-center gap-6">
                    <button onClick={() => updateForm('home_bathrooms', Math.max(0, formData.home_bathrooms - 1))} className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10"><Minus className="w-4 h-4" /></button>
                    <span className="text-2xl font-bold text-white w-6 text-center">{formData.home_bathrooms}</span>
                    <button onClick={() => updateForm('home_bathrooms', formData.home_bathrooms + 1)} className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10"><Plus className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-black/20 border border-white/10 rounded-2xl p-6">
                  <span className="text-lg text-white font-medium">Do you have pets?</span>
                  <div className="flex bg-black/40 rounded-xl p-1">
                    <button onClick={() => updateForm('has_pets', false)} className={`px-6 py-2 rounded-lg font-medium transition-colors ${!formData.has_pets ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}>No</button>
                    <button onClick={() => updateForm('has_pets', true)} className={`px-6 py-2 rounded-lg font-medium transition-colors ${formData.has_pets ? 'bg-blue-600 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}>Yes</button>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button onClick={prevStep} className="text-white/60 hover:text-white transition-colors">Back</button>
                <button onClick={nextStep} className="bg-white text-[#010A14] px-8 py-4 rounded-full font-bold tracking-widest uppercase hover:scale-105 transition-all flex items-center gap-2">Continue <ArrowRight className="w-4 h-4" /></button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
              <h1 className="font-rustic text-4xl text-white mb-2">When should we arrive?</h1>
              <p className="text-white/60 mb-8">Choose a date and arrival window that works for you.</p>
              
              <div className="space-y-6 mb-10">
                <div>
                  <label className="block text-white/70 text-sm mb-2 flex items-center gap-2"><Calendar className="w-4 h-4" /> Preferred Date</label>
                  <DatePicker
                    value={formData.scheduled_date}
                    onChange={(val) => updateForm('scheduled_date', val)}
                    className="w-full bg-black/20 border-white/10 text-white h-14 rounded-2xl"
                  />
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2 flex items-center gap-2"><Clock className="w-4 h-4" /> Arrival Window</label>
                  <div className="grid grid-cols-1 gap-3">
                    {windows.map(w => (
                      <button 
                        key={w.id}
                        onClick={() => updateForm('scheduled_window', w.id)}
                        className={`p-4 rounded-xl border text-left transition-all ${formData.scheduled_window === w.id ? 'border-blue-500 bg-blue-500/20 text-white' : 'border-white/10 bg-black/20 text-white/70 hover:border-white/30 hover:text-white'}`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button onClick={prevStep} className="text-white/60 hover:text-white transition-colors">Back</button>
                <button 
                  disabled={!formData.scheduled_date || !formData.scheduled_window}
                  onClick={nextStep} 
                  className="bg-white text-[#010A14] px-8 py-4 rounded-full font-bold tracking-widest uppercase hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  Continue <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div key="step5" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
              <h1 className="font-rustic text-4xl text-white mb-2">Who should we contact?</h1>
              <p className="text-white/60 mb-8">We&apos;ll use this to send your customized quote.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <div>
                  <label className="block text-white/70 text-sm mb-2">First Name</label>
                  <input type="text" value={formData.firstName} onChange={(e) => updateForm('firstName', e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-white/70 text-sm mb-2">Last Name</label>
                  <input type="text" value={formData.lastName} onChange={(e) => updateForm('lastName', e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-white/70 text-sm mb-2">Email Address</label>
                  <input type="email" value={formData.email} onChange={(e) => updateForm('email', e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-white/70 text-sm mb-2">Phone Number</label>
                  <input type="tel" value={formData.phone} onChange={(e) => updateForm('phone', e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-6 text-sm">{error}</div>}

              <div className="flex justify-between items-center">
                <button onClick={prevStep} className="text-white/60 hover:text-white transition-colors">Back</button>
                <button 
                  disabled={!formData.firstName || !formData.lastName || !formData.email || !formData.phone || isGeneratingQuote}
                  onClick={handleGenerateQuote} 
                  className="bg-blue-600 text-white px-8 py-4 rounded-full font-bold tracking-widest uppercase hover:bg-blue-500 transition-all disabled:opacity-50 flex items-center gap-2 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                >
                  {isGeneratingQuote ? 'Calculating...' : 'Calculate My Quote'}
                </button>
              </div>
            </motion.div>
          )}

          {step === 6 && (
            <motion.div key="step6" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-blue-400" />
                </div>
                <h1 className="font-rustic text-4xl text-white mb-2">Your Quote is Ready!</h1>
                <p className="text-white/60 text-lg max-w-sm mx-auto">Create a quick password to unlock your customized pricing instantly.</p>
              </div>
              
              <div className="bg-black/20 border border-white/10 rounded-2xl p-6 mb-8">
                <label className="block text-white/70 text-sm mb-2 flex items-center gap-2"><Key className="w-4 h-4" /> Choose a Password</label>
                <input 
                  type="password" 
                  value={formData.password} 
                  onChange={(e) => updateForm('password', e.target.value)} 
                  placeholder="Minimum 8 characters"
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-blue-500 transition-colors" 
                />
              </div>

              {error && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-xl mb-6 text-sm">{error}</div>}

              <div className="flex flex-col gap-4">
                <button 
                  disabled={!formData.password || formData.password.length < 8 || isSubmitting}
                  onClick={handleCreateAccount} 
                  className="w-full bg-white text-[#010A14] py-4 rounded-full font-bold tracking-widest uppercase hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Processing...' : 'Create Account & View Quote'}
                </button>
                <button 
                  disabled={isSubmitting}
                  onClick={handleSkipAccount}
                  className="w-full py-4 text-white/50 hover:text-white transition-colors text-sm font-medium underline-offset-4 hover:underline"
                >
                  Skip and wait for the team to email me
                </button>
              </div>
            </motion.div>
          )}

          {step === 7 && quoteData && !isSkipped && (
            <motion.div key="step7-quote" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <Sparkles className="w-32 h-32 text-blue-500" />
              </div>
              <h2 className="text-xl text-white font-medium mb-6">Here is your customized quote.</h2>
              
              <div className="bg-gradient-to-br from-blue-900/40 to-blue-600/20 border border-blue-500/30 rounded-3xl p-8 mb-8 relative z-10 shadow-[0_0_40px_rgba(37,99,235,0.15)]">
                <p className="text-blue-200 text-sm font-bold tracking-widest uppercase mb-2">Estimated Total</p>
                <p className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-6">
                  ${quoteData.final_price.toFixed(2)}
                </p>

                <div className="space-y-4 pt-6 border-t border-blue-500/20 text-left">
                  {quoteData.line_items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm md:text-base">
                      <span className="text-blue-100">{item.label}</span>
                      <span className="text-white font-medium">${item.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {needsEmailConfirmation ? (
                <p className="text-white/60 text-sm mb-8">We&apos;ve saved this to your new account. Check your inbox for {formData.email} and confirm your email address, then log in to review and book.</p>
              ) : (
                <p className="text-white/60 text-sm mb-8">We&apos;ve saved this to your new account. You can log in anytime to review and book.</p>
              )}

              <button 
                onClick={() => router.push('/customer-site/portal')}
                className="w-full bg-blue-600 text-white px-8 py-4 rounded-full font-bold tracking-widest uppercase hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]"
              >
                Go to Dashboard
              </button>
            </motion.div>
          )}

          {step === 7 && isSkipped && (
            <motion.div key="step7-skipped" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl text-center">
              <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h1 className="font-rustic text-4xl text-white mb-4">Request Received</h1>
              <p className="text-white/60 text-lg mb-8 max-w-md mx-auto">
                Your request has been sent securely to our dispatch network. A team member will review it and contact you shortly with your pricing.
              </p>
              <Link 
                href="/"
                className="inline-block bg-white text-[#010A14] px-8 py-4 rounded-full font-bold tracking-widest uppercase hover:scale-105 transition-transform"
              >
                Return Home
              </Link>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
