'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Copy, Info, Minus, Plus, FileText, Calculator, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import {
  calcCommercialCarpet,
  type CommercialCarpetTier,
} from '@/lib/pricing/carpet-calculator';
import { LeadContactFields, type LeadContactData } from './LeadContactFields';

interface CommercialCarpetSectionProps {
  contact: LeadContactData;
  onContactChange: (field: keyof LeadContactData, value: string) => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

// ── Stepper (re-declared locally) ──
function Stepper({
  value,
  onChange,
  min = 0,
  max = 99999,
  step = 100,
  label,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  suffix?: string;
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
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <div className="h-8 min-w-[4.5rem] flex items-center justify-center border border-input bg-background text-sm font-medium px-2">
          {value.toLocaleString()}{suffix}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 rounded-l-none border-l-0 shrink-0"
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

// ----------------------------------------------------------------
// CommercialCarpetSection
// ----------------------------------------------------------------

export function CommercialCarpetSection({
  contact,
  onContactChange,
  onSuccess,
  onClose,
}: CommercialCarpetSectionProps) {
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'breakdown'>('form');
  const [tier, setTier]     = useState<CommercialCarpetTier>('standard');
  const [sqftStr, setSqftStr] = useState('');

  const sqft = sqftStr === '' ? 0 : Number(sqftStr);
  const sqftError =
    sqftStr !== '' && (isNaN(sqft) || sqft <= 0)
      ? 'Square footage must be a positive number'
      : null;

  const hasValidInput = sqft > 0 && !sqftError;

  const result = useMemo(
    () => (hasValidInput ? calcCommercialCarpet({ tier, sqft }) : null),
    [tier, sqft, hasValidInput],
  );

  const displayTotal = result ? fmt(result.total) : '$0.00';

  const handleCopy = () => {
    if (!result) return;
    const lines: string[] = ['COMMERCIAL CARPET CLEANING QUOTE', ''];
    lines.push(`Tier: ${tier === 'standard' ? 'Standard' : 'Premium'}`);
    lines.push(`Square footage: ${sqft.toLocaleString()} sqft`);
    lines.push(`Rate: $${result.rate.toFixed(2)}/sqft${result.guardApplied ? ' (monotonic guard applied)' : ''}`);
    lines.push('');
    lines.push('—'.repeat(40));
    lines.push(`TOTAL: ${fmt(result.total)}`);
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
      const notes = [
        contact.companyName ? `Company: ${contact.companyName}` : null,
        `Main Contact: ${contact.customerName}${contact.contactTitle ? ` (${contact.contactTitle})` : ''}`,
        `Commercial Carpet Extraction (${tier === 'standard' ? 'Standard' : 'Premium'})`,
        `Square footage: ${sqft.toLocaleString()} sqft`,
        `Rate: $${result.rate.toFixed(2)}/sqft`,
        `TOTAL: ${fmt(result.total)}`,
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
          package_name: 'Commercial Carpet Extraction',
          calculated_price: result.total,
          sqft: sqft,
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
                      ? '$0.70 → $0.55/sqft by volume'
                      : '$0.80 → $0.65/sqft by volume'}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <hr className="border-muted" />

          {/* 2. Square Footage */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              2. Square Footage
            </h3>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Total carpet area (sqft)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="h-8 text-sm w-36"
                  placeholder="e.g. 2500"
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

            {/* Rate table reference */}
            <div className="rounded-md border border-muted p-3 space-y-1">
              <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
                Rate tiers ({tier === 'standard' ? 'Standard' : 'Premium'})
              </p>
              {[
                { label: 'Under 1,000 sqft',    stdRate: 0.70, premRate: 0.80 },
                { label: '1,000 – 2,999 sqft',  stdRate: 0.65, premRate: 0.75 },
                { label: '3,000 – 5,999 sqft',  stdRate: 0.60, premRate: 0.70 },
                { label: '6,000+ sqft',          stdRate: 0.55, premRate: 0.65 },
              ].map((row) => {
                const rate    = tier === 'standard' ? row.stdRate : row.premRate;
                const isActive =
                  sqft > 0 && result &&
                  Math.abs(result.rate - rate) < 0.001;
                return (
                  <div
                    key={row.label}
                    className={`flex justify-between text-xs py-0.5 px-1.5 rounded ${
                      isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    <span>{row.label}</span>
                    <span>${rate.toFixed(2)}/sqft</span>
                  </div>
                );
              })}
              <p className="text-[10px] text-muted-foreground mt-2 flex items-start gap-1">
                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                A price guard prevents lower totals at bracket boundaries — larger jobs never quote below smaller ones.
              </p>
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
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">
                      Calculation
                    </h4>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{sqft.toLocaleString()} sqft</span>
                      <span>× ${result.rate.toFixed(2)}/sqft</span>
                    </div>
                    {result.guardApplied && (
                      <p className="text-[10px] text-amber-700 mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Price guard applied — raised to bracket floor.
                      </p>
                    )}
                  </div>

                  <div>
                    <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">
                      Minimum
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {tier === 'standard' ? '$200 (Standard)' : '$300 (Premium)'}
                    </p>
                  </div>

                  <hr />

                  <div>
                    <div className="flex justify-between items-center text-2xl font-bold text-primary mb-1">
                      <span>TOTAL</span>
                      <span>{fmt(result.total)}</span>
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
