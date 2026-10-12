'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Copy, FileText, Calculator, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  calcCommercialCleaning,
  type CommercialCleaningComplexity,
  type CommercialCleaningFrequency,
} from '@/lib/pricing/commercial-calculator';
import { LeadContactFields, type LeadContactData } from './LeadContactFields';

interface CommercialCleaningSectionProps {
  contact: LeadContactData;
  onContactChange: (field: keyof LeadContactData, value: string) => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtParts(n: number) {
  const parts = n.toFixed(2).split('.');
  return {
    dollars: `$${Number(parts[0]).toLocaleString()}`,
    cents: parts[1],
  };
}

const COMPLEXITY_OPTIONS: {
  value: CommercialCleaningComplexity;
  label: string;
  typicalSqft: string;
  rate: number;
}[] = [
  { value: 'small',  label: 'Small & simple',       typicalSqft: 'Under 2,000 sqft',   rate: 0.11 },
  { value: 'medium', label: 'Medium & standard',     typicalSqft: '2,000 – 5,000 sqft', rate: 0.15 },
  { value: 'large',  label: 'Large & complex',       typicalSqft: '5,000 – 20,000 sqft',rate: 0.22 },
];

const FREQUENCY_OPTIONS: {
  value: CommercialCleaningFrequency;
  label: string;
  visits: number;
  discount: string;
}[] = [
  { value: '1x',    label: '1× per week', visits: 1, discount: 'No discount' },
  { value: '2x',    label: '2× per week', visits: 2, discount: '5% off / visit' },
  { value: '3x',    label: '3× per week', visits: 3, discount: '10% off / visit' },
  { value: 'daily', label: 'Daily (5×/wk)', visits: 5, discount: '15% off / visit' },
];

export function CommercialCleaningSection({
  contact,
  onContactChange,
  onSuccess,
  onClose,
}: CommercialCleaningSectionProps) {
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'breakdown'>('form');

  // ── Core inputs ──
  const [sqftStr,    setSqftStr]    = useState('');
  const [complexity, setComplexity] = useState<CommercialCleaningComplexity>('small');
  const [frequency,  setFrequency]  = useState<CommercialCleaningFrequency>('1x');

  // ── Validation ──
  const sqft = sqftStr === '' ? 0 : Number(sqftStr);
  const sqftError =
    sqftStr !== '' && (isNaN(sqft) || sqft <= 0)
      ? 'Square footage must be a positive number'
      : null;

  const hasValidInput = sqft > 0 && !sqftError;

  const result = useMemo(
    () =>
      hasValidInput
        ? calcCommercialCleaning({
            sqft,
            complexity,
            frequency,
            carpetExtractionUnits: 0,
            kitchenDeepClean: false,
            windowCleaning: false,
            postConstructionSqft: 0,
            afterHours: false,
            rushSameDay: false,
          })
        : null,
    [sqft, complexity, frequency, hasValidInput],
  );

  const complexityOption = COMPLEXITY_OPTIONS.find((o) => o.value === complexity)!;
  const frequencyOption  = FREQUENCY_OPTIONS.find((o) => o.value === frequency)!;
  const displayTotal = result ? fmt(result.monthlyTotal) : '$0.00';

  const handleCopy = () => {
    if (!result) return;
    const freqLabel = FREQUENCY_OPTIONS.find((f) => f.value === frequency)?.label ?? frequency;
    const complexLabel = COMPLEXITY_OPTIONS.find((c) => c.value === complexity)?.label ?? complexity;
    const lines: string[] = ['COMMERCIAL CLEANING (JANITORIAL) QUOTE', ''];
    lines.push(`${sqft.toLocaleString()} sqft · ${complexLabel} · ${freqLabel}`);
    lines.push('');
    lines.push(`Base per visit:     ${fmt(result.basePerVisit)}`);
    if (result.adjustedPerVisit !== result.basePerVisit) {
      lines.push(`Adjusted per visit: ${fmt(result.adjustedPerVisit)} (frequency discount applied)`);
    }
    lines.push(`Weekly total:       ${fmt(result.weeklyTotal)}`);
    lines.push('');
    lines.push('—'.repeat(40));
    lines.push(`MONTHLY TOTAL:      ${fmt(result.monthlyTotal)}`);
    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Quote copied to clipboard');
  };

  const handleGenerateLead = async () => {
    if (!contact.customerName.trim()) {
      toast.error('Customer name is required to create a lead');
      return;
    }
    if (!result) return;

    setLoading(true);
    try {
      const finalPrice = result.monthlyTotal;
      const notes = [
        contact.companyName ? `Company: ${contact.companyName}` : null,
        `Main Contact: ${contact.customerName}${contact.contactTitle ? ` (${contact.contactTitle})` : ''}`,
        `Commercial Cleaning & Janitorial (${complexityOption?.label || complexity}, ${frequencyOption?.label || frequency})`,
        `Square footage: ${sqft.toLocaleString()} sqft`,
        `Base visit: ${fmt(result.basePerVisit)} | Monthly: ${fmt(result.monthlyTotal)}`,
        `TOTAL: ${fmt(finalPrice)}/mo`,
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
          service_type: 'commercial_cleaning',
          package_name: 'Commercial Cleaning & Janitorial',
          calculated_price: finalPrice,
          sqft: sqft,
          frequency: frequency,
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
          <span>2. Quote Breakdown ({displayTotal})</span>
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
          <LeadContactFields contact={contact} onChange={onContactChange} isCommercial={true} />

          <hr className="border-muted" />

          {/* 1. Square Footage */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              1. Square Footage
            </h3>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Total cleanable floor area (sqft)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="h-8 text-sm w-36"
                  placeholder="e.g. 3000"
                  value={sqftStr}
                  onChange={(e) => setSqftStr(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">sqft</span>
              </div>
              {sqftError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {sqftError}
                </p>
              )}
            </div>
          </section>

          <hr className="border-muted" />

          {/* 2. Complexity Tier */}
          <section className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                2. Complexity Tier
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Layout matters more than raw size — select based on the office&apos;s physical complexity, not sqft alone.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {COMPLEXITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                    complexity === opt.value
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-muted hover:border-primary/30 hover:bg-muted/50'
                  }`}
                  onClick={() => setComplexity(opt.value)}
                >
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    complexity === opt.value ? 'border-primary' : 'border-muted-foreground/40'
                  }`}>
                    {complexity === opt.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${complexity === opt.value ? 'text-primary' : ''}`}>
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Typical: {opt.typicalSqft} · ${opt.rate.toFixed(2)}/sqft
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <hr className="border-muted" />

          {/* 3. Frequency */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              3. Frequency
            </h3>
            <div className="flex gap-2 flex-wrap">
              {FREQUENCY_OPTIONS.map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  variant={frequency === f.value ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-auto py-2 px-3 flex flex-col"
                  onClick={() => setFrequency(f.value)}
                >
                  <span>{f.label}</span>
                  {f.discount !== 'No discount' && (
                    <span className="opacity-70 text-[10px]">({f.discount})</span>
                  )}
                </Button>
              ))}
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
              Review Quote Breakdown ({displayTotal}) →
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
                disabled={!hasValidInput}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
              {!hasValidInput ? (
                <p className="text-xs text-muted-foreground italic">
                  Enter a valid square footage on the left to see a quote.
                </p>
              ) : result ? (
                <>
                  {/* Calculation detail */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">
                      Calculation
                    </h4>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Base / visit</span>
                        <span className="font-medium text-foreground">{fmt(result.basePerVisit)}</span>
                      </div>
                      {result.adjustedPerVisit !== result.basePerVisit && (
                        <div className="flex justify-between text-green-700">
                          <span>Freq. discount ({frequencyOption.discount})</span>
                          <span>{fmt(result.adjustedPerVisit)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Per visit (final)</span>
                        <span className="font-semibold text-foreground">{fmt(result.perVisitWithSurcharges)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>× {frequencyOption.visits} visits / week</span>
                        <span className="font-medium text-foreground">{fmt(result.weeklyTotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground/70">
                        <span>× 4.33 weeks / month</span>
                        <span className="font-medium text-foreground font-[family-name:var(--font-inter)]">{fmt(result.monthlyTotal)}</span>
                      </div>
                    </div>
                  </div>

                  <hr />

                  {/* Three headline figures */}
                  <div className="space-y-2">
                    {/* Per-visit — small */}
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Per visit</span>
                      <span className="text-base font-semibold font-[family-name:var(--font-inter)]">{fmt(result.perVisitWithSurcharges)}</span>
                    </div>
                    {/* Weekly — medium */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Weekly</span>
                      <span className="text-lg font-bold font-[family-name:var(--font-inter)]">{fmt(result.weeklyTotal)}</span>
                    </div>
                    {/* Monthly — primary, largest */}
                    <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="text-sm font-semibold text-primary">Monthly</span>
                      <div className="flex items-baseline font-[family-name:var(--font-inter)] tracking-tight text-primary">
                        <span className="text-3xl font-extrabold">{fmtParts(result.monthlyTotal).dollars}</span>
                        <span className="text-lg font-bold text-primary/75">.{fmtParts(result.monthlyTotal).cents}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-4 pt-3 border-t shrink-0 space-y-2">
              <Button
                className="w-full text-sm font-bold"
                size="lg"
                onClick={handleGenerateLead}
                disabled={!hasValidInput || !contact.customerName.trim() || loading}
              >
                {loading ? 'Generating...' : 'Generate Quote & Lead'}
              </Button>
              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={handleCopy}
                disabled={!hasValidInput}
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
