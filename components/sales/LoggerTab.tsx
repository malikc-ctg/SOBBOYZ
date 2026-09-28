'use client';

import React, { useState, useEffect, useRef } from 'react';
import { salesDB } from '@/lib/sales/db';
import { salesSyncEngine } from '@/lib/sales/sync-engine';
import { toast } from 'sonner';
import {
  Building2, Home, MapPin, Play, Pause, Square,
  Clock, DollarSign, Calendar, ChevronRight, CheckCircle2,
  Users, AlertCircle, FileText, Phone, User
} from 'lucide-react';

interface LoggerTabProps {
  user: any;
  repName: string;
}

const RESIDENTIAL_OBJECTIONS = [
  'CALLBACK',
  'NOT INTERESTED',
  'ALREADY HAVE / DIY',
  'BAD TIMING',
  'NEED TO THINK',
  'NOT DECISION MAKER',
  'NO SOLICITING',
];

const COMMERCIAL_FACILITIES = [
  'Medical / Dental Clinic',
  'Professional Office',
  'Retail Store',
  'Fitness / Gym',
  'Daycare / School',
  'Industrial / Warehouse',
  'Restaurant / Cafe',
];

export default function LoggerTab({ user, repName }: LoggerTabProps) {
  // Session State
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isBreak, setIsBreak] = useState(false);
  const [breakId, setBreakId] = useState<string | null>(null);
  const [shiftSeconds, setShiftSeconds] = useState(0);

  // Sales OS mode: 'residential' | 'commercial'
  const [salesMode, setSalesMode] = useState<'residential' | 'commercial'>('residential');

  // Residential Form State
  const [street, setStreet] = useState('');
  const [houseNum, setHouseNum] = useState('');
  const [stepSize, setStepSize] = useState(2);
  const [showResiObjections, setShowResiObjections] = useState(false);
  const [showResiSaleModal, setShowResiSaleModal] = useState(false);
  const [resiCustomerName, setResiCustomerName] = useState('');
  const [resiPhone, setResiPhone] = useState('');
  const [resiJobTotal, setResiJobTotal] = useState('250');
  const [resiPaymentMethod, setResiPaymentMethod] = useState('Credit');

  // Commercial Form State
  const [commAddress, setCommAddress] = useState('');
  const [commUnit, setCommUnit] = useState('');
  const [commCompanyName, setCommCompanyName] = useState('');
  const [commFacilityType, setCommFacilityType] = useState('Medical / Dental Clinic');
  const [commDmStatus, setCommDmStatus] = useState<'DIRECT' | 'GATEKEEPER'>('DIRECT');
  const [commContactName, setCommContactName] = useState('');
  const [commContactTitle, setCommContactTitle] = useState('');
  const [commContactPhone, setCommContactPhone] = useState('');
  const [commContactEmail, setCommContactEmail] = useState('');

  // Commercial Action Modals
  const [showWalkthroughModal, setShowWalkthroughModal] = useState(false);
  const [walkthroughDate, setWalkthroughDate] = useState('');
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [commSqft, setCommSqft] = useState('2500');
  const [commFrequency, setCommFrequency] = useState('3x');
  const [showCompetitorModal, setShowCompetitorModal] = useState(false);
  const [competitorVendor, setCompetitorVendor] = useState('');
  const [competitorExpiry, setCompetitorExpiry] = useState('');
  const [showCommSaleModal, setShowCommSaleModal] = useState(false);
  const [commMrr, setCommMrr] = useState('1450');

  // Geolocation
  const [currentCoords, setCurrentCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });

  // Shift Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionActive && !isBreak) {
      interval = setInterval(() => setShiftSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [sessionActive, isBreak]);

  // Geolocation Tracker
  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => console.log('Location watch fallback:', err.message),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Format seconds into HH:MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Shift Start / Break / End Handlers
  const handleStartShift = async () => {
    const sid = crypto.randomUUID();
    setSessionId(sid);
    setSessionActive(true);
    setShiftSeconds(0);

    await salesDB.insertLocalEvent(sid, 'DAY_START', {
      session_id: sid,
      rep_id: user.id,
      session_date: new Date().toISOString().split('T')[0],
      start_time: new Date().toISOString(),
    });
    salesSyncEngine.runSync();
    toast.success('Shift started! Happy hunting.');
  };

  const handleToggleBreak = async () => {
    if (!sessionId) return;
    if (!isBreak) {
      const bid = crypto.randomUUID();
      setBreakId(bid);
      setIsBreak(true);
      await salesDB.insertLocalEvent(bid, 'BREAK_START', {
        break_id: bid,
        session_id: sessionId,
        break_start_time: new Date().toISOString(),
      });
      toast.info('Break started');
    } else {
      if (breakId) {
        await salesDB.insertLocalEvent(crypto.randomUUID(), 'BREAK_END', {
          break_id: breakId,
          session_id: sessionId,
          break_end_time: new Date().toISOString(),
        });
      }
      setIsBreak(false);
      setBreakId(null);
      toast.success('Resumed shift');
    }
    salesSyncEngine.runSync();
  };

  const handleEndShift = async () => {
    if (!sessionId) return;
    if (confirm('Are you sure you want to end today’s shift?')) {
      await salesDB.insertLocalEvent(crypto.randomUUID(), 'DAY_END', {
        session_id: sessionId,
        end_time: new Date().toISOString(),
      });
      setSessionActive(false);
      setSessionId(null);
      salesSyncEngine.runSync();
      toast.success('Shift ended. Excellent work today!');
    }
  };

  // Increment / Decrement house number for fast walking
  const adjustHouseNum = (amount: number) => {
    const current = parseInt(houseNum, 10);
    if (isNaN(current)) return;
    const next = Math.max(1, current + amount);
    setHouseNum(next.toString());
  };

  // Log Residential Event
  const logResidentialKnock = async (outcomeType: string, objection?: string) => {
    if (!street.trim()) {
      toast.error('Please enter a street name');
      return;
    }

    const eventId = crypto.randomUUID();
    const payload = {
      mode: 'residential',
      session_id: sessionId,
      street_name: street.trim(),
      house_number: houseNum.trim(),
      outcome_type: outcomeType,
      objection_type: objection || null,
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      timestamp: new Date().toISOString(),
    };

    await salesDB.insertLocalEvent(eventId, 'KNOCK', payload);

    // Save pin in local property cache
    await salesDB.upsertProperty({
      property_id: eventId,
      address: `${houseNum} ${street}`.trim(),
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      last_status: outcomeType,
      last_knocked_at: payload.timestamp,
      mode: 'residential',
    });

    // Auto-advance house number for speed
    adjustHouseNum(stepSize);
    setShowResiObjections(false);
    salesSyncEngine.runSync();

    if (outcomeType === 'SALE') {
      toast.success(`🎉 Sale logged at ${houseNum} ${street}!`);
    } else {
      toast.info(`Logged ${outcomeType} at ${houseNum} ${street}`);
    }
  };

  // Submit Residential Sale
  const handleSaveResiSale = async () => {
    const eventId = crypto.randomUUID();
    const payload = {
      mode: 'residential',
      session_id: sessionId,
      street_name: street.trim(),
      house_number: houseNum.trim(),
      outcome_type: 'SALE',
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      sale_details: {
        customer_name: resiCustomerName,
        phone: resiPhone,
        job_total: `$${resiJobTotal}`,
        payment_method: resiPaymentMethod,
      },
      timestamp: new Date().toISOString(),
    };

    await salesDB.insertLocalEvent(eventId, 'KNOCK', payload);
    setShowResiSaleModal(false);
    setResiCustomerName('');
    setResiPhone('');
    adjustHouseNum(stepSize);
    salesSyncEngine.runSync();
    toast.success('🎉 Deal recorded! Added to customer dispatch queue.');
  };

  // Log Commercial B2B Event
  const logCommercialEvent = async (outcomeType: string, extraData: Record<string, any> = {}) => {
    if (!commAddress.trim() || !commCompanyName.trim()) {
      toast.error('Please enter the Plaza Address and Company Name');
      return;
    }

    const eventId = crypto.randomUUID();
    const payload = {
      mode: 'commercial',
      session_id: sessionId,
      street_name: commAddress.trim(),
      unit_number: commUnit.trim(),
      company_name: commCompanyName.trim(),
      facility_type: commFacilityType,
      decision_maker_status: commDmStatus,
      contact_name: commContactName.trim() || null,
      contact_title: commContactTitle.trim() || null,
      contact_phone: commContactPhone.trim() || null,
      contact_email: commContactEmail.trim() || null,
      outcome_type: outcomeType,
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      timestamp: new Date().toISOString(),
      ...extraData,
    };

    await salesDB.insertLocalEvent(eventId, 'KNOCK', payload);

    await salesDB.upsertProperty({
      property_id: eventId,
      address: `${commCompanyName} (${commAddress} #${commUnit})`,
      lat: currentCoords.lat,
      lng: currentCoords.lng,
      last_status: outcomeType,
      last_knocked_at: payload.timestamp,
      mode: 'commercial',
      company_name: commCompanyName,
    });

    salesSyncEngine.runSync();

    if (outcomeType === 'WALKTHROUGH_BOOKED') {
      toast.success(`📅 Walkthrough booked with ${commCompanyName}! Added to Sales OS Pipeline.`);
      setShowWalkthroughModal(false);
    } else if (outcomeType === 'SALE') {
      toast.success(`🏆 Commercial Contract closed with ${commCompanyName}!`);
      setShowCommSaleModal(false);
    } else {
      toast.info(`Logged ${outcomeType} for ${commCompanyName}`);
    }

    // Reset company-specific inputs
    setCommCompanyName('');
    setCommUnit('');
    setCommContactName('');
    setCommContactPhone('');
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] text-white">
      {/* Top Shift Status & Timer */}
      <div className="bg-[#11192e] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${sessionActive ? (isBreak ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse') : 'bg-slate-500'}`} />
          <div>
            <div className="text-xs text-slate-400 font-medium">
              {sessionActive ? (isBreak ? 'Shift on Break' : 'Active Shift') : 'Ready to Knock'}
            </div>
            <div className="text-lg font-bold tracking-tight text-white font-mono">
              {formatTime(shiftSeconds)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!sessionActive ? (
            <button
              onClick={handleStartShift}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Start Shift
            </button>
          ) : (
            <>
              <button
                onClick={handleToggleBreak}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium rounded-lg"
              >
                {isBreak ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                {isBreak ? 'Resume' : 'Break'}
              </button>
              <button
                onClick={handleEndShift}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium rounded-lg"
              >
                <Square className="w-3.5 h-3.5 fill-current" /> End
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dual Mode Switcher */}
      <div className="p-3 bg-[#0d1424] border-b border-white/5">
        <div className="grid grid-cols-2 p-1 bg-[#141d33] rounded-xl border border-white/10">
          <button
            onClick={() => setSalesMode('residential')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              salesMode === 'residential' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-3.5 h-3.5" /> 🏡 Residential
          </button>
          <button
            onClick={() => setSalesMode('commercial')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              salesMode === 'commercial' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> 🏢 Commercial
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {salesMode === 'residential' ? (
          /* ============================================================== */
          /* RESIDENTIAL MODE (Classic KnockLog)                            */
          /* ============================================================== */
          <div className="space-y-4">
            {/* Street & House Stepper */}
            <div className="bg-[#121a2f] p-4 rounded-2xl border border-white/10 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Target Street
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Maple Avenue"
                    value={street}
                    onChange={e => setStreet(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                  <MapPin className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                    House Number
                  </label>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <span>Step:</span>
                    <button
                      onClick={() => setStepSize(s => (s === 2 ? 1 : 2))}
                      className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-300 font-mono"
                    >
                      ±{stepSize}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => adjustHouseNum(-stepSize)}
                    className="w-14 h-12 bg-[#1a243d] hover:bg-[#233152] active:bg-[#2c3c63] rounded-xl text-lg font-bold text-slate-200 border border-white/10"
                  >
                    -{stepSize}
                  </button>

                  <input
                    type="number"
                    value={houseNum}
                    onChange={e => setHouseNum(e.target.value)}
                    placeholder="104"
                    className="flex-1 h-12 bg-[#0a0f1d] border border-white/15 rounded-xl text-center text-xl font-bold font-mono text-white focus:outline-none focus:border-blue-500"
                  />

                  <button
                    onClick={() => adjustHouseNum(stepSize)}
                    className="w-14 h-12 bg-[#1a243d] hover:bg-[#233152] active:bg-[#2c3c63] rounded-xl text-lg font-bold text-slate-200 border border-white/10"
                  >
                    +{stepSize}
                  </button>
                </div>
              </div>
            </div>

            {/* Fast 1-Tap Action Buttons */}
            <div className="grid grid-cols-1 gap-2.5 pt-1">
              <button
                onClick={() => logResidentialKnock('NO_ANSWER')}
                className="w-full py-4 bg-[#1f293d] hover:bg-[#28354f] active:scale-[0.98] transition-all rounded-2xl border border-white/10 flex items-center justify-center gap-2 text-base font-bold text-slate-200 shadow-sm"
              >
                ⚪ NO ANSWER
              </button>

              <button
                onClick={() => setShowResiObjections(prev => !prev)}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white shadow-lg shadow-blue-900/30"
              >
                🔵 CONVERSATION
              </button>

              {/* Objection Pill Drawer */}
              {showResiObjections && (
                <div className="p-3 bg-[#11192e] rounded-2xl border border-blue-500/30 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  {RESIDENTIAL_OBJECTIONS.map(obj => (
                    <button
                      key={obj}
                      onClick={() => logResidentialKnock('CONVO', obj)}
                      className="py-2.5 px-3 bg-[#18233f] hover:bg-blue-950 active:bg-blue-900 text-xs font-semibold text-blue-200 rounded-xl border border-blue-400/20 text-center"
                    >
                      {obj}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowResiSaleModal(true)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white shadow-lg shadow-emerald-900/30"
              >
                🟢 SALE / SIGNUP ($)
              </button>
            </div>
          </div>
        ) : (
          /* ============================================================== */
          /* COMMERCIAL MODE (Sales OS B2B Pipeline)                       */
          /* ============================================================== */
          <div className="space-y-4">
            {/* Plaza / Building & Business Info */}
            <div className="bg-[#121a2f] p-4 rounded-2xl border border-white/10 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Plaza / Commercial Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1200 Central Parkway W"
                  value={commAddress}
                  onChange={e => setCommAddress(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
                    Suite / Bay #
                  </label>
                  <input
                    type="text"
                    placeholder="Ste 104"
                    value={commUnit}
                    onChange={e => setCommUnit(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="col-span-2">
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
                    Company Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Dental Care"
                    value={commCompanyName}
                    onChange={e => setCommCompanyName(e.target.value)}
                    className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Facility Type
                </label>
                <select
                  value={commFacilityType}
                  onChange={e => setCommFacilityType(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {COMMERCIAL_FACILITIES.map(fac => (
                    <option key={fac} value={fac} className="bg-[#0a0f1d] text-white">
                      {fac}
                    </option>
                  ))}
                </select>
              </div>

              {/* Decision Maker Status */}
              <div>
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider block mb-1">
                  Speaking With
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCommDmStatus('GATEKEEPER')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 ${
                      commDmStatus === 'GATEKEEPER'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-[#18233f] border-white/10 text-slate-400'
                    }`}
                  >
                    <User className="w-3.5 h-3.5" /> Gatekeeper / Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommDmStatus('DIRECT')}
                    className={`py-2 px-3 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 ${
                      commDmStatus === 'DIRECT'
                        ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                        : 'bg-[#18233f] border-white/10 text-slate-400'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" /> Decision Maker
                  </button>
                </div>
              </div>
            </div>

            {/* Commercial Action Pipeline Buttons */}
            <div className="space-y-2.5">
              <button
                onClick={() => setShowWalkthroughModal(true)}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] transition-all rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white shadow-lg shadow-indigo-900/30"
              >
                📅 BOOK WALKTHROUGH (Stage 2)
              </button>

              <button
                onClick={() => setShowProposalModal(true)}
                className="w-full py-3.5 bg-[#1b2642] hover:bg-[#233154] active:scale-[0.98] transition-all rounded-2xl border border-white/10 flex items-center justify-center gap-2 text-sm font-semibold text-blue-300"
              >
                📄 REQUEST PROPOSAL / RFP (Stage 3)
              </button>

              <button
                onClick={() => setShowCompetitorModal(true)}
                className="w-full py-3.5 bg-[#1b2642] hover:bg-[#233154] active:scale-[0.98] transition-all rounded-2xl border border-white/10 flex items-center justify-center gap-2 text-sm font-semibold text-amber-300"
              >
                ⏳ EXISTING VENDOR EXPIRATION
              </button>

              <button
                onClick={() => setShowCommSaleModal(true)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all rounded-2xl flex items-center justify-center gap-2 text-base font-bold text-white shadow-lg shadow-emerald-900/30"
              >
                🏆 CLOSED CONTRACT / MRR
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL: RESIDENTIAL SALE QUICK FORM                             */}
      {/* ============================================================== */}
      {showResiSaleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121a2f] border border-white/15 rounded-2xl p-5 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Log Residential Sale
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Homeowner Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. John Doe"
                  value={resiCustomerName}
                  onChange={e => setResiCustomerName(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Phone Number</label>
                <input
                  type="tel"
                  placeholder="416-555-0199"
                  value={resiPhone}
                  onChange={e => setResiPhone(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Job Amount ($)</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {['150', '250', '350', '400', '500', '600'].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setResiJobTotal(amt)}
                      className={`py-1.5 rounded-lg text-xs font-semibold ${
                        resiJobTotal === amt ? 'bg-emerald-600 text-white' : 'bg-[#1a243d] text-slate-300'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowResiSaleModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResiSale}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                Confirm Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: COMMERCIAL BOOK WALKTHROUGH (Stage 2)                    */}
      {/* ============================================================== */}
      {showWalkthroughModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121a2f] border border-white/15 rounded-2xl p-5 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" /> Book Commercial Walkthrough
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Decision Maker Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Vance"
                  value={commContactName}
                  onChange={e => setCommContactName(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">DM Phone</label>
                <input
                  type="tel"
                  placeholder="416-555-0122"
                  value={commContactPhone}
                  onChange={e => setCommContactPhone(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Walkthrough Date & Time</label>
                <input
                  type="datetime-local"
                  value={walkthroughDate}
                  onChange={e => setWalkthroughDate(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowWalkthroughModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => logCommercialEvent('WALKTHROUGH_BOOKED', { walkthrough_date: walkthroughDate })}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold"
              >
                Save Walkthrough
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: COMPETITOR CONTRACT EXPIRATION RADAR                     */}
      {/* ============================================================== */}
      {showCompetitorModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121a2f] border border-white/15 rounded-2xl p-5 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" /> Competitor Contract Radar
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Current Cleaning Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. Modern Cleaning Co."
                  value={competitorVendor}
                  onChange={e => setCompetitorVendor(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Approx. Contract Expiry Date</label>
                <input
                  type="date"
                  value={competitorExpiry}
                  onChange={e => setCompetitorExpiry(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCompetitorModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => logCommercialEvent('EXISTING_CONTRACT', {
                  competitor_vendor: competitorVendor,
                  competitor_contract_expires_at: competitorExpiry,
                })}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
              >
                Set Radar Alert
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: COMMERCIAL CONTRACT WON / MRR                           */}
      {/* ============================================================== */}
      {showCommSaleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#121a2f] border border-white/15 rounded-2xl p-5 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Close Commercial Contract
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Monthly Contract Value (MRR)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    value={commMrr}
                    onChange={e => setCommMrr(e.target.value)}
                    placeholder="1450"
                    className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl pl-8 pr-3 py-2 text-lg font-bold text-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Cleaning Frequency</label>
                <select
                  value={commFrequency}
                  onChange={e => setCommFrequency(e.target.value)}
                  className="w-full bg-[#0a0f1d] border border-white/15 rounded-xl px-3 py-2 text-sm text-slate-200 mt-1"
                >
                  <option value="1x">1x per week</option>
                  <option value="2x">2x per week</option>
                  <option value="3x">3x per week</option>
                  <option value="5x">5x per week (Daily)</option>
                  <option value="one_time">One-Time Deep Clean</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowCommSaleModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => logCommercialEvent('SALE', { contract_mrr: commMrr, cleaning_frequency: commFrequency })}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                Save Won Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
