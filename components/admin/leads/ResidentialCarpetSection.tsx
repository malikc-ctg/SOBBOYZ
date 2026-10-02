'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Minus,
  Plus,
  Copy,
  Info,
  FileText,
  Calculator,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  calcResidentialCarpet,
  type ResidentialCarpetTier,
  type ResidentialCarpetInput,
} from '@/lib/pricing/carpet-calculator';
import { LeadContactFields, type LeadContactData } from './LeadContactFields';

interface ResidentialCarpetSectionProps {
  contact: LeadContactData;
  onContactChange: (field: keyof LeadContactData, value: string) => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

// ── Stepper (re-declared locally — Stepper inside CRMPricingModal.tsx is not extracted
//    to avoid touching that file. Duplication is intentional per project constraints.) ──
function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <div className="flex items-center gap-0">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-r-none border-r-0 shrink-0"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <div className="h-8 min-w-[3rem] flex items-center justify-center border border-input bg-background text-sm font-medium px-2">
          {value}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-l-none border-l-0 shrink-0"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ──
function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtRange(lo: number, hi: number) {
  return `${fmt(lo)} to ${fmt(hi)}`;
}

// ----------------------------------------------------------------
// ResidentialCarpetSection
// ----------------------------------------------------------------

export function ResidentialCarpetSection({
  contact,
  onContactChange,
  onSuccess,
  onClose,
}: ResidentialCarpetSectionProps) {
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'breakdown'>('form');

  // ── Tier ──
  const [tier, setTier] = useState<ResidentialCarpetTier>('standard');

  // ── Room counts ──
  const [bedrooms,      setBedrooms]      = useState(0);
  const [livingRooms,   setLivingRooms]   = useState(0);
  const [basementRooms, setBasementRooms] = useState(0);
  const [hallways,      setHallways]      = useState(0);
  const [stairsFlights, setStairsFlights] = useState(0);
  const [stairsHalfFlights, setStairsHalfFlights] = useState(0);

  // ── Add-ons ──
  const [rugSmall,            setRugSmall]            = useState(0);
  const [rugMedium,           setRugMedium]           = useState(0);
  const [rugLarge,            setRugLarge]            = useState(0);
  const [petSpots,            setPetSpots]            = useState(0);
  const [dispatchFee,         setDispatchFee]         = useState(false);

  const allZero =
    bedrooms === 0 && livingRooms === 0 && basementRooms === 0 &&
    hallways === 0 && stairsFlights === 0 && stairsHalfFlights === 0;

  const input: ResidentialCarpetInput = useMemo(() => ({
    tier,
    bedrooms,
    livingRooms,
    basementRooms,
    hallways,
    stairsFlights,
    stairsHalfFlights,
    rugSmall,
    rugMedium,
    rugLarge,
    petSpots,
    dispatchFee,
  }), [
    tier, bedrooms, livingRooms, basementRooms, hallways, stairsFlights, stairsHalfFlights,
    rugSmall, rugMedium, rugLarge, petSpots, dispatchFee,
  ]);

  const result = useMemo(() => calcResidentialCarpet(input), [input]);

  const totalDisplay = result.isRange
    ? fmtRange((result.total as [number, number])[0], (result.total as [number, number])[1])
    : fmt(result.total as number);

  const handleCopy = () => {
    const lines: string[] = ['RESIDENTIAL CARPET CLEANING QUOTE', ''];
    lines.push(`Tier: ${tier === 'standard' ? 'Standard' : 'Premium (heavy soil / staining / pet)'}`);
    lines.push('');
    lines.push('Room counts:');
    if (bedrooms)      lines.push(`  Bedrooms: ${bedrooms}`);
    if (livingRooms)   lines.push(`  Living rooms: ${livingRooms}`);
    if (basementRooms) lines.push(`  Basement/bonus rooms: ${basementRooms}`);
    if (hallways)      lines.push(`  Hallways: ${hallways}`);
    if (stairsFlights) lines.push(`  Stairs (flights): ${stairsFlights}`);
    if (stairsHalfFlights) lines.push(`  Stairs (half flights): ${stairsHalfFlights}`);
    const roomTotal = result.roomTotal;
    lines.push(`Room subtotal: ${Array.isArray(roomTotal) ? fmtRange(roomTotal[0], roomTotal[1]) : fmt(roomTotal)}`);
    if (result.addOnLines.length > 0) {
      lines.push('');
      lines.push('Add-ons:');
      for (const a of result.addOnLines) {
        const amtStr = a.isRange
          ? fmtRange((a.amount as [number, number])[0], (a.amount as [number, number])[1])
          : fmt(a.amount as number);
        lines.push(`  ${a.label}: ${amtStr}`);
      }
    }
    lines.push('');
    lines.push('—'.repeat(40));
    lines.push(`TOTAL: ${totalDisplay}`);
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Quote copied to clipboard');
  };

  const handleGenerateLead = async () => {
    if (!contact.customerName.trim()) {
      toast.error('Customer name is required to create a lead');
      return;
    }
    setLoading(true);
    try {
      const computedTotal = result.isRange
        ? (result.total as [number, number])[1]
        : (result.total as number);

      const notes = [
        contact.companyName ? `Company: ${contact.companyName}` : null,
        contact.companyName ? `Main Contact: ${contact.customerName}${contact.contactTitle ? ` (${contact.contactTitle})` : ''}` : null,
        `Residential Carpet Cleaning (${tier === 'standard' ? 'Standard' : 'Premium'})`,
        `Rooms: ${[
          bedrooms ? `${bedrooms} Bed` : null,
          livingRooms ? `${livingRooms} Living` : null,
          basementRooms ? `${basementRooms} Basement` : null,
          hallways ? `${hallways} Hallway` : null,
          stairsFlights ? `${stairsFlights} Flight(s)` : null,
          stairsHalfFlights ? `${stairsHalfFlights} Half-flight(s)` : null,
        ].filter(Boolean).join(', ') || 'None'}`,
        result.addOnLines.length > 0
          ? `Add-ons: ${result.addOnLines.map((a) => a.label).join(', ')}`
          : null,
        `Total: ${totalDisplay}`,
      ].filter(Boolean).join(' | ');

      const res = await fetch('/api/pricing-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: contact.companyName || null,
          customer_name: contact.customerName,
          contact_title: contact.contactTitle || null,
          customer_phone: contact.customerPhone,
          customer_email: contact.customerEmail,
          address: contact.address,
          source: contact.source,
          service_type: 'carpet_clean',
          package_name: 'Residential Carpet Cleaning',
          calculated_price: computedTotal,
          price_min: result.isRange ? (result.total as [number, number])[0] : null,
          price_max: result.isRange ? (result.total as [number, number])[1] : null,
          is_range: result.isRange,
          notes,
          breakdown: result,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate quote');
      }

      toast.success('Quote generated and lead created');
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
      {/* Mobile Segmented View Switcher */}
      <div className="md:hidden border-b bg-muted/40 p-1.5 flex gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setMobileTab('form')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
            mobileTab === 'form'
              ? 'bg-background text-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          <span>1. Service Details</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('breakdown')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-semibold transition-all ${
            mobileTab === 'breakdown'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calculator className="h-3.5 w-3.5" />
          <span>2. Quote Breakdown ({totalDisplay})</span>
        </button>
      </div>

      {/* ── LEFT: Form ── */}
      <div
        className={`w-full md:w-[60%] overflow-y-auto overscroll-contain touch-pan-y ${
          mobileTab === 'form' ? 'flex-1' : 'hidden md:block'
        }`}
      >
        <div className="p-4 sm:p-5 space-y-5">
          {/* Contact Information */}
          <LeadContactFields contact={contact} onChange={onContactChange} />

          <hr className="border-muted" />

          {/* 1. Quality Tier */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              1. Quality Tier
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(['standard', 'premium'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`flex flex-col gap-1 p-3 rounded-lg border-2 transition-all text-left ${
                    tier === t
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-muted hover:border-primary/30 hover:bg-muted/50'
                  }`}
                  onClick={() => setTier(t)}
                >
                  <span className={`text-sm font-semibold ${tier === t ? 'text-primary' : ''}`}>
                    {t === 'standard' ? 'Standard' : 'Premium'}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {t === 'standard'
                      ? 'Regular soil — fixed rate'
                      : 'Heavy soil, staining, pet accidents — quoted as a range'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <hr className="border-muted" />

          {/* 2. Room Counts */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              2. Room Counts
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Stepper label="Bedrooms"            value={bedrooms}      onChange={setBedrooms}      max={20} />
              <Stepper label="Living rooms"         value={livingRooms}   onChange={setLivingRooms}   max={10} />
              <Stepper label="Basement / bonus"     value={basementRooms} onChange={setBasementRooms} max={10} />
              <Stepper label="Hallways"             value={hallways}      onChange={setHallways}      max={10} />
              <Stepper label="Stairs (per flight)"  value={stairsFlights} onChange={setStairsFlights} max={10} />
              <Stepper label="Stairs (half flight)" value={stairsHalfFlights} onChange={setStairsHalfFlights} max={10} />
            </div>
            {allZero && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 italic">
                <Info className="h-3 w-3" /> Enter at least one room or space to generate a quote.
              </p>
            )}
          </section>

          <hr className="border-muted" />

          {/* 3. Add-ons */}
          <section className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              3. Add-Ons
            </h3>

            {/* Area rugs */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Area Rugs</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Stepper label="Small (up to 5×7) · $60" value={rugSmall}  onChange={setRugSmall}  max={10} />
                <Stepper label="Medium (up to 8×10) · $85" value={rugMedium} onChange={setRugMedium} max={10} />
                <Stepper label="Large (9×12+) · $110–$130" value={rugLarge}  onChange={setRugLarge}  max={10} />
              </div>
            </div>

            {/* Pet spots */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Pet Treatment</p>
              <Stepper label="Pet stain / odor spots · $18/spot" value={petSpots} onChange={setPetSpots} max={50} />
            </div>

            {/* Dispatch fee */}
            <div className="flex items-center gap-3 p-3 rounded-md border border-muted">
              <Switch
                id="dispatch-fee"
                checked={dispatchFee}
                onCheckedChange={setDispatchFee}
              />
              <div>
                <Label htmlFor="dispatch-fee" className="text-sm font-medium cursor-pointer">
                  Standalone dispatch fee · $40
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Apply when this carpet job is booked as its own appointment, not bundled into a cleaning visit.
                </p>
              </div>
            </div>
          </section>

          {/* Mobile Bottom Action: Proceed to Quote Breakdown */}
          <div className="md:hidden pt-4 border-t">
            <Button
              type="button"
              className="w-full font-bold text-sm shadow-xs"
              size="lg"
              onClick={() => setMobileTab('breakdown')}
            >
              Review Quote Breakdown ({totalDisplay}) →
            </Button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Quote Breakdown ── */}
      <div
        className={`w-full md:w-[40%] bg-muted/30 border-l flex flex-col ${
          mobileTab === 'breakdown' ? 'flex-1 overflow-y-auto overscroll-contain touch-pan-y' : 'hidden md:flex'
        }`}
      >
        <div className="p-3 sm:p-5 flex-1 flex flex-col min-h-0">
          {/* Mobile back link */}
          <div className="md:hidden mb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs -ml-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMobileTab('form')}
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Service Details
            </Button>
          </div>

          <div className="bg-card border rounded-xl shadow-sm p-4 sm:p-5 flex-1 flex flex-col min-h-0">
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="font-bold text-lg tracking-tight">Quote Breakdown</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
                disabled={allZero}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
              {allZero ? (
                <p className="text-xs text-muted-foreground italic">
                  Enter room counts on the left to see a quote.
                </p>
              ) : (
                <>
                  {/* Room subtotal */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">
                      Room Subtotal
                    </h4>
                    <div className="flex justify-between text-sm">
                      <span>{tier === 'premium' ? 'Premium tier' : 'Standard tier'}</span>
                      <span className="font-medium">
                        {Array.isArray(result.roomTotal)
                          ? fmtRange(result.roomTotal[0], result.roomTotal[1])
                          : fmt(result.roomTotal)}
                      </span>
                    </div>
                    {bedrooms > 0      && <p className="text-[10px] text-muted-foreground">{bedrooms} bed × {tier === 'standard' ? '$60' : '$75'}</p>}
                    {livingRooms > 0   && <p className="text-[10px] text-muted-foreground">{livingRooms} living × {tier === 'standard' ? '$60' : '$75'}</p>}
                    {basementRooms > 0 && <p className="text-[10px] text-muted-foreground">{basementRooms} basement/bonus × {tier === 'standard' ? '$60' : '$75'}</p>}
                    {hallways > 0      && <p className="text-[10px] text-muted-foreground">{hallways} hallway × {tier === 'standard' ? '$40' : '$50'}</p>}
                    {stairsFlights > 0 && <p className="text-[10px] text-muted-foreground">{stairsFlights} flight × {tier === 'standard' ? '$30' : '$30'}</p>}
                    {stairsHalfFlights > 0 && <p className="text-[10px] text-muted-foreground">{stairsHalfFlights} half flight × {tier === 'standard' ? '$15' : '$15'}</p>}
                  </div>

                  {/* Add-ons */}
                  {result.addOnLines.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Add-Ons</h4>
                      {result.addOnLines.map((a, i) => (
                        <div key={i} className="flex justify-between text-xs mb-1 text-slate-700">
                          <span>{a.label}</span>
                          <span className="font-medium">
                            {a.isRange
                              ? fmtRange((a.amount as [number, number])[0], (a.amount as [number, number])[1])
                              : fmt(a.amount as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <hr />

                  {/* Total */}
                  <div>
                    <div className="flex justify-between items-center text-2xl font-bold text-primary mb-1">
                      <span>TOTAL</span>
                      <span>{totalDisplay}</span>
                    </div>
                    {result.isRange && (
                      <p className="text-[10px] text-muted-foreground">
                        Range reflects exact size assessment of area rugs on arrival.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Actions */}
            <div className="mt-4 pt-3 border-t shrink-0 space-y-2">
              <Button
                className="w-full text-sm font-bold"
                size="lg"
                onClick={handleGenerateLead}
                disabled={allZero || !contact.customerName.trim() || loading}
              >
                {loading ? 'Generating...' : 'Generate Quote & Lead'}
              </Button>
              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={handleCopy}
                disabled={allZero}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy Quote
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
