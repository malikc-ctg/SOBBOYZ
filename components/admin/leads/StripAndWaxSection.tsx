'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Copy, Info, FileText, Calculator, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { calcStripAndWax } from '@/lib/pricing/commercial-calculator';
import { LeadContactFields, type LeadContactData } from './LeadContactFields';

interface StripAndWaxSectionProps {
  contact: LeadContactData;
  onContactChange: (field: keyof LeadContactData, value: string) => void;
  onSuccess?: () => void;
  onClose?: () => void;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function fmtRange(lo: number, hi: number) {
  return `${fmt(lo)} to ${fmt(hi)}`;
}

// ----------------------------------------------------------------
// StripAndWaxSection
// ----------------------------------------------------------------

export function StripAndWaxSection({
  contact,
  onContactChange,
  onSuccess,
  onClose,
}: StripAndWaxSectionProps) {
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'breakdown'>('form');
  const [sqftStr,      setSqftStr]      = useState('');
  const [burnishAddon, setBurnishAddon] = useState(false);

  const sqft = sqftStr === '' ? 0 : Number(sqftStr);
  const sqftError =
    sqftStr !== '' && (isNaN(sqft) || sqft <= 0)
      ? 'Square footage must be a positive number'
      : null;

  const hasValidInput = sqft > 0 && !sqftError;

  const result = useMemo(
    () => (hasValidInput ? calcStripAndWax({ sqft, burnishAddon }) : null),
    [sqft, burnishAddon, hasValidInput],
  );

  const displayTotal = result ? fmt(result.stripTotal) : '$0.00';

  const handleCopy = () => {
    if (!result) return;
    const lines: string[] = ['COMMERCIAL STRIP AND WAX QUOTE', ''];
    lines.push(`Square footage: ${sqft.toLocaleString()} sqft`);
    lines.push(`Rate: $0.55/sqft`);
    lines.push('');
    lines.push('—'.repeat(40));
    lines.push(`Strip & Wax Total: ${fmt(result.stripTotal)}`);
    if (result.burnishLow !== null && result.burnishHigh !== null) {
      lines.push('');
      lines.push(`Recurring maintenance option (burnish & wax): ${fmtRange(result.burnishLow, result.burnishHigh)} per visit`);
      lines.push('(This is a separate recurring maintenance charge, not included in the strip total above.)');
    }
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
        'Commercial Strip & Wax Quote',
        `Square footage: ${sqft.toLocaleString()} sqft`,
        `Rate: $0.55/sqft`,
        burnishAddon && result.burnishLow !== null && result.burnishHigh !== null
          ? `Recurring maintenance option: ${fmtRange(result.burnishLow, result.burnishHigh)}/visit`
          : null,
        `TOTAL: ${fmt(result.stripTotal)}`,
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
          service_type: 'strip_and_wax',
          package_name: 'Commercial Strip & Wax',
          calculated_price: result.stripTotal,
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

          {/* 1. Square Footage */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              1. Square Footage
            </h3>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Total floor area (sqft)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  className="h-8 text-sm w-36"
                  placeholder="e.g. 3400"
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

            <div className="rounded-md border border-muted p-3">
              <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                <Info className="h-3 w-3 shrink-0 mt-0.5" />
                Rate: $0.55/sqft · Minimum charge: $300 · Reference: 3,400 sqft → $1,870
              </p>
            </div>
          </section>

          <hr className="border-muted" />

          {/* 2. Burnish add-on */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              2. Recurring Maintenance Add-On
            </h3>
            <div className="flex items-start gap-3 p-3 rounded-md border border-muted">
              <Switch
                id="burnish-addon"
                checked={burnishAddon}
                onCheckedChange={setBurnishAddon}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="burnish-addon" className="text-sm font-medium cursor-pointer">
                  Burnish & maintenance wax
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  $0.15 – $0.25/sqft per visit. A recurring maintenance service offered between full strip
                  jobs to maintain floor appearance — quoted separately from the one-time strip total.
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
                  {/* One-time job */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">
                      One-Time Job
                    </h4>
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                      <span>{sqft.toLocaleString()} sqft × $0.55</span>
                      <span className="font-medium text-foreground">{fmt(result.stripTotal)}</span>
                    </div>
                    {sqft * 0.55 < 300 && (
                      <p className="text-[10px] text-muted-foreground">Minimum $300 applied.</p>
                    )}
                  </div>

                  <hr />

                  <div>
                    <div className="flex justify-between items-center text-2xl font-bold text-primary mb-1">
                      <span>TOTAL</span>
                      <span>{fmt(result.stripTotal)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">One-time strip and wax</p>
                  </div>

                  {/* Burnish recurring option */}
                  {result.burnishLow !== null && result.burnishHigh !== null && (
                    <div className="mt-2 p-3 rounded-md bg-blue-50 border border-blue-200">
                      <p className="text-[10px] font-semibold uppercase text-blue-700 mb-1">
                        Recurring Maintenance Option
                      </p>
                      <div className="flex justify-between text-sm text-blue-900">
                        <span>Burnish & maintenance wax</span>
                        <span className="font-semibold">
                          {fmtRange(result.burnishLow, result.burnishHigh)}
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-700 mt-1">
                        Per visit · separate from the one-time strip total above
                      </p>
                    </div>
                  )}
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
