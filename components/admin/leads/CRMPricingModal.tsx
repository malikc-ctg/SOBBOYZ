'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';
import {
  Calculator,
  Copy,
  AlertTriangle,
  Minus,
  Plus,
  ClipboardCheck,
  FileText,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Users,
  Home,
  Building2,
  Warehouse,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { ResidentialCarpetSection }  from './ResidentialCarpetSection';
import { CommercialCarpetSection }   from './CommercialCarpetSection';
import { StripAndWaxSection }        from './StripAndWaxSection';
import { CommercialCleaningSection } from './CommercialCleaningSection';
import { PostConstructionSection }   from './PostConstructionSection';
import { JunkRemovalSection }         from './JunkRemovalSection';
import { PaintingSection }            from './PaintingSection';
import { LeadContactFields, type LeadContactData } from './LeadContactFields';

// ── Service sectors and services ──
type Sector = 'residential' | 'commercial';

type ServiceTab =
  | 'residential_cleaning'
  | 'residential_carpet'
  | 'commercial_carpet'
  | 'strip_and_wax'
  | 'commercial_cleaning'
  | 'post_construction'
  | 'junk_removal'
  | 'painting';

interface ServiceOption {
  value: ServiceTab;
  label: string;
  badge?: string;
}

const RESIDENTIAL_SERVICES: ServiceOption[] = [
  { value: 'residential_cleaning', label: 'Home Cleaning' },
  { value: 'residential_carpet',   label: 'Carpet & Rugs' },
  { value: 'post_construction',    label: 'Post-Construction' },
  { value: 'junk_removal',         label: 'Junk Removal' },
  { value: 'painting',             label: 'Painting' },
];

const COMMERCIAL_SERVICES: ServiceOption[] = [
  { value: 'commercial_cleaning',  label: 'Office & Janitorial' },
  { value: 'strip_and_wax',        label: 'Strip & Wax' },
  { value: 'commercial_carpet',    label: 'Carpet Extraction' },
  { value: 'post_construction',    label: 'Post-Construction' },
  { value: 'junk_removal',         label: 'Junk Removal' },
  { value: 'painting',             label: 'Painting' },
];

function getSectorForService(tab: ServiceTab): Sector {
  if (tab === 'commercial_cleaning' || tab === 'commercial_carpet' || tab === 'strip_and_wax') {
    return 'commercial';
  }
  return 'residential';
}
import { toast } from 'sonner';
import {
  type PropertyType,
  type PackageType,
  type Frequency,
  CONDO_RATES,
  BASEMENT_RATES,
  HOUSE_RATES,
  ADD_ONS,
  ADD_ON_CATEGORIES,
  PACKAGE_LABELS,
  PROPERTY_TYPE_LABELS,
  FREQUENCY_LABELS,
  PACKAGE_TIER_ORDER,
  PACKAGE_TO_SERVICE_TYPE,
} from '@/lib/pricing/constants';
import { calculateQuote, type QuoteInput, type QuoteResult } from '@/lib/pricing/calculator';
import { generateScopeOfWork } from '@/lib/pricing/scope-of-work';

// ============================================================
// Sub-components
// ============================================================

// --- Stepper ---
function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  step = 1,
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
        <div className="h-8 min-w-[3rem] flex items-center justify-center border border-input bg-background text-sm font-medium px-2">
          {value}{suffix}
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

// --- Property Type Card ---
function PropertyTypeCard({
  type,
  icon: Icon,
  selected,
  onClick,
}: {
  type: PropertyType;
  icon: React.ElementType;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all cursor-pointer text-center ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-muted hover:border-primary/30 hover:bg-muted/50'
      }`}
      onClick={onClick}
    >
      <Icon className={`h-5 w-5 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
      <span className={`text-xs font-medium ${selected ? 'text-primary' : 'text-muted-foreground'}`}>
        {PROPERTY_TYPE_LABELS[type]}
      </span>
    </button>
  );
}

// --- Package Card ---
function PackageCard({
  pkg,
  selected,
  priceHint,
  onClick,
}: {
  pkg: PackageType;
  selected: boolean;
  priceHint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer text-left ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-muted hover:border-primary/30 hover:bg-muted/50'
      }`}
      onClick={onClick}
    >
      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
        selected ? 'border-primary' : 'border-muted-foreground/40'
      }`}>
        {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
      </div>
      <div className="min-w-0">
        <div className={`text-sm font-semibold ${selected ? 'text-primary' : ''}`}>
          {PACKAGE_LABELS[pkg]}
        </div>
        <div className="text-[10px] text-muted-foreground">{priceHint}</div>
      </div>
    </button>
  );
}

// ============================================================
// Main Modal
// ============================================================

export function CRMPricingModal({ onSuccess }: { onSuccess?: () => void }) {
  const [open,       setOpen]       = useState(false);
  const [sector,     setSector]     = useState<Sector>('residential');
  const [serviceTab, setServiceTab] = useState<ServiceTab>('residential_cleaning');
  const [contact,    setContact]    = useState<LeadContactData>({
    companyName: '',
    customerName: '',
    contactTitle: '',
    customerPhone: '',
    customerEmail: '',
    address: '',
    source: 'inbound_call',
  });

  const handleContactChange = useCallback((field: keyof LeadContactData, value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    // Reset to the residential cleaning tab on close so state is fresh next open
    if (!v) {
      setSector('residential');
      setServiceTab('residential_cleaning');
      setContact({
        companyName: '',
        customerName: '',
        contactTitle: '',
        customerPhone: '',
        customerEmail: '',
        address: '',
        source: 'inbound_call',
      });
    }
  };

  const serviceScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = serviceScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 6);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  }, []);

  const handleSelectSector = (newSector: Sector) => {
    setSector(newSector);
    const targetServices = newSector === 'residential' ? RESIDENTIAL_SERVICES : COMMERCIAL_SERVICES;
    const existsInTarget = targetServices.some((s) => s.value === serviceTab);
    if (!existsInTarget) {
      setServiceTab(newSector === 'residential' ? 'residential_cleaning' : 'commercial_cleaning');
    }
  };

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(checkScroll, 100);
    window.addEventListener('resize', checkScroll);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', checkScroll);
    };
  }, [open, sector, checkScroll]);

  // When active service tab changes, ensure it scrolls into view
  useEffect(() => {
    if (!open) return;
    const el = serviceScrollRef.current;
    if (!el) return;
    const activeBtn = el.querySelector('[data-active="true"]') as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
    const timer = setTimeout(checkScroll, 150);
    return () => clearTimeout(timer);
  }, [open, serviceTab, checkScroll]);

  const scrollServices = (direction: 'left' | 'right') => {
    const el = serviceScrollRef.current;
    if (!el) return;
    const scrollAmount = 240;
    el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    setTimeout(checkScroll, 250);
  };

  // Lock body scroll and prevent touch through when modal is open
  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [open]);

  const activeServiceList = sector === 'residential' ? RESIDENTIAL_SERVICES : COMMERCIAL_SERVICES;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" className="font-bold text-md">
          <Calculator className="h-5 w-5 mr-2" /> New Lead / Quote
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-6xl w-[96vw] md:w-full h-[92dvh] md:h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-background rounded-xl sm:rounded-lg"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-4 sm:px-6 py-3 border-b shrink-0">
          <DialogTitle className="text-lg">Generate Pricing Quote</DialogTitle>
          <DialogDescription className="sr-only">
            Generate a new pricing quote using the Sea of Blue rate card.
          </DialogDescription>
        </DialogHeader>

        {/* ── Condensed 2-Tier Sector & Service Selector with Scroll Arrows ── */}
        <div className="px-3 sm:px-6 py-2 border-b shrink-0 bg-muted/30 flex items-center gap-2 sm:gap-3 overflow-hidden">
          {/* Sector Toggle */}
          <div className="flex items-center gap-1 bg-background/80 p-0.5 sm:p-1 rounded-lg border shadow-xs shrink-0">
            <button
              type="button"
              onClick={() => handleSelectSector('residential')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                sector === 'residential'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              Residential
            </button>
            <button
              type="button"
              onClick={() => handleSelectSector('commercial')}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                sector === 'commercial'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Commercial
            </button>
          </div>

          <div className="h-4 w-px bg-border shrink-0 hidden sm:block" />

          {/* Sector-Specific Service Pills with Left & Right Arrows */}
          <div className="flex-1 min-w-0 flex items-center relative gap-1">
            <span className="text-[11px] font-medium text-muted-foreground mr-1 uppercase tracking-wider shrink-0 hidden lg:inline">
              {sector === 'residential' ? 'Services:' : 'Commercial Services:'}
            </span>

            {/* Left Scroll Arrow */}
            {canScrollLeft && (
              <button
                type="button"
                onClick={() => scrollServices('left')}
                className="h-7 w-7 rounded-md border bg-background/95 hover:bg-muted text-foreground flex items-center justify-center shrink-0 shadow-xs transition z-10 cursor-pointer"
                aria-label="Scroll services left"
                title="Scroll services left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            {/* Horizontal Scrollable Pills */}
            <div
              ref={serviceScrollRef}
              onScroll={checkScroll}
              className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 scroll-smooth"
            >
              {activeServiceList.map((srv) => {
                const isActive = serviceTab === srv.value;
                return (
                  <Button
                    key={srv.value}
                    type="button"
                    data-active={isActive ? "true" : "false"}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    className={`text-xs h-7 sm:h-8 px-2.5 sm:px-3 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      isActive
                        ? 'font-semibold shadow-xs'
                        : 'bg-background hover:bg-muted'
                    }`}
                    onClick={() => setServiceTab(srv.value)}
                  >
                    {srv.label}
                  </Button>
                );
              })}
            </div>

            {/* Right Scroll Arrow (Highlighted when more items like Junk Removal & Painting are available) */}
            {canScrollRight && (
              <button
                type="button"
                onClick={() => scrollServices('right')}
                className="h-7 w-7 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs transition z-10 cursor-pointer"
                aria-label="Scroll services right"
                title="Scroll right to see more services (Junk Removal, Painting)"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* ── Active section ── */}
        {open && serviceTab === 'residential_cleaning' && (
          <PricingModalContent
            contact={contact}
            onContactChange={handleContactChange}
            onSuccess={onSuccess}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {open && serviceTab === 'residential_carpet'   && (
          <ResidentialCarpetSection
            contact={contact}
            onContactChange={handleContactChange}
            onSuccess={onSuccess}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {open && serviceTab === 'commercial_carpet'    && (
          <CommercialCarpetSection
            contact={contact}
            onContactChange={handleContactChange}
            onSuccess={onSuccess}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {open && serviceTab === 'strip_and_wax'        && (
          <StripAndWaxSection
            contact={contact}
            onContactChange={handleContactChange}
            onSuccess={onSuccess}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {open && serviceTab === 'commercial_cleaning'  && (
          <CommercialCleaningSection
            contact={contact}
            onContactChange={handleContactChange}
            onSuccess={onSuccess}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {open && serviceTab === 'post_construction'    && (
          <PostConstructionSection
            contact={contact}
            onContactChange={handleContactChange}
            onSuccess={onSuccess}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {open && serviceTab === 'junk_removal'         && (
          <JunkRemovalSection
            contact={contact}
            onContactChange={handleContactChange}
            onSuccess={onSuccess}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {open && serviceTab === 'painting'             && (
          <PaintingSection
            contact={contact}
            onContactChange={handleContactChange}
            onSuccess={onSuccess}
            onClose={() => handleOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Modal Content — all state lives here, destroyed on close
// ============================================================

function PricingModalContent({
  contact,
  onContactChange,
  onSuccess,
  onClose,
}: {
  contact: LeadContactData;
  onContactChange: (field: keyof LeadContactData, value: string) => void;
  onSuccess?: () => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [quoteFinalized, setQuoteFinalized] = useState(false);
  const [scopeText, setScopeText] = useState('');
  const [mobileTab, setMobileTab] = useState<'form' | 'breakdown'>('form');

  // --- Property ---
  const [propertyType, setPropertyType] = useState<PropertyType>('condo');
  const [sqft, setSqft] = useState(500);
  const [bedrooms, setBedrooms] = useState(1);
  const [fullBathrooms, setFullBathrooms] = useState(1);
  const [halfBathrooms, setHalfBathrooms] = useState(0);

  // --- Package ---
  const [selectedPackage, setSelectedPackage] = useState<PackageType>('standard');
  const [frequency, setFrequency] = useState<Frequency>('one_time');
  const [vacancyConfirmed, setVacancyConfirmed] = useState(false);

  // --- Add-ons ---
  const [selectedAddOnIds, setSelectedAddOnIds] = useState<string[]>([]);
  const [customAddOnPrices, setCustomAddOnPrices] = useState<Record<string, number>>({});
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({});
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  // --- Manual override ---
  const [manualPrice, setManualPrice] = useState<number | null>(null);

  // Disable frequency for non-standard packages
  const frequencyEnabled = selectedPackage === 'standard' || selectedPackage === 'standard_plus';

  // Reset frequency when switching to a non-standard package
  const handlePackageChange = (pkg: PackageType) => {
    setSelectedPackage(pkg);
    if (pkg !== 'standard' && pkg !== 'standard_plus') {
      setFrequency('one_time');
    }
    setManualPrice(null);
    setQuoteFinalized(false);
  };

  // Toggle add-on
  const toggleAddOn = (id: string) => {
    setSelectedAddOnIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setManualPrice(null);
    setQuoteFinalized(false);
  };

  // Toggle category expand
  const toggleCategory = (label: string) => {
    setExpandedCategories((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Get price hint for a package based on property type
  const getPackagePriceHint = (pkg: PackageType): string => {
    const table =
      propertyType === 'condo' ? CONDO_RATES :
      propertyType === 'basement' ? BASEMENT_RATES :
      HOUSE_RATES;
    if (table.length === 0) return '';
    const first = table[0];
    const key = pkg === 'standard' ? 'standard' :
                pkg === 'standard_plus' ? 'standardPlus' :
                pkg === 'deep_clean' ? 'deepClean' : 'moveInOut';
    const val = first[key as keyof typeof first];
    if (Array.isArray(val)) return `From $${val[0]}`;
    return `From $${val}`;
  };

  // --- Calculate quote ---
  const quoteInput: QuoteInput = useMemo(() => ({
    propertyType,
    sqft,
    selectedPackage,
    frequency: frequencyEnabled ? frequency : 'one_time',
    fullBathrooms,
    halfBathrooms,
    selectedAddOnIds,
    customAddOnPrices,
    addOnQuantities,
    vacancyConfirmed,
  }), [propertyType, sqft, selectedPackage, frequency, frequencyEnabled, fullBathrooms, halfBathrooms, selectedAddOnIds, customAddOnPrices, addOnQuantities, vacancyConfirmed]);

  const quote: QuoteResult = useMemo(() => calculateQuote(quoteInput), [quoteInput]);

  // Final price (with manual override)
  const finalPrice = useMemo(() => {
    if (manualPrice !== null) return manualPrice;
    if (quote.isRange) return quote.total as [number, number];
    return quote.total as number;
  }, [manualPrice, quote]);

  const displayTotal = typeof finalPrice === 'number'
    ? `$${finalPrice.toFixed(2)}`
    : `$${(finalPrice as [number, number])[0].toFixed(2)}–$${(finalPrice as [number, number])[1].toFixed(2)}`;

  // --- Handlers ---

  const handleCopyBreakdown = () => {
    const lines: string[] = [`QUOTE BREAKDOWN`, ''];
    lines.push(`Property: ${PROPERTY_TYPE_LABELS[propertyType]}, ${quote.sizeBandLabel}`);
    lines.push(`Package: ${PACKAGE_LABELS[selectedPackage]}`);

    if (quote.isRange) {
      const [min, max] = quote.basePrice as [number, number];
      lines.push(`Base: $${min.toFixed(2)}–$${max.toFixed(2)} (confirmed on arrival)`);
    } else {
      lines.push(`Base: $${(quote.basePrice as number).toFixed(2)}`);
    }

    if (quote.bathroomAdjustment > 0) {
      lines.push(`Bathroom adjustment: +$${quote.bathroomAdjustment.toFixed(2)}`);
    }
    if (typeof quote.frequencyDiscount === 'number' && quote.frequencyDiscount < 0) {
      lines.push(`${FREQUENCY_LABELS[frequency]} discount (${(quote.frequencyDiscountPercent * 100).toFixed(0)}%): $${quote.frequencyDiscount.toFixed(2)}`);
    }

    const pricedAddOns = quote.addOns.filter((a) => typeof a.price === 'number');
    if (pricedAddOns.length > 0) {
      lines.push('', 'Add-ons:');
      for (const a of pricedAddOns) {
        const q = a.quantity > 1 ? ` (×${a.quantity})` : '';
        lines.push(`  - ${a.label}${q}: +$${(a.price as number).toFixed(2)}`);
      }
    }
    for (const s of quote.percentageSurcharges) {
      lines.push(`  - ${s.label} (${(s.percent * 100).toFixed(1)}%): +$${s.amount.toFixed(2)}`);
    }

    lines.push('', '—'.repeat(40));
    if (manualPrice !== null) {
      lines.push(`CALCULATED: ${typeof quote.total === 'number' ? '$' + quote.total.toFixed(2) : '$' + (quote.total as [number, number])[0].toFixed(2) + '–$' + (quote.total as [number, number])[1].toFixed(2)}`);
      lines.push(`OVERRIDE APPLIED`);
      lines.push(`TOTAL: $${manualPrice.toFixed(2)}`);
    } else {
      lines.push(`TOTAL: ${displayTotal}`);
    }

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Quote copied to clipboard');
  };

  const handleCopyScopeOfWork = () => {
    const text = generateScopeOfWork({
      customerName: contact.customerName || 'Customer',
      propertyType,
      sizeBandLabel: quote.sizeBandLabel,
      selectedPackage,
      frequency: frequencyEnabled ? frequency : 'one_time',
      quote,
      vacancyConfirmed,
      bedrooms,
      bathrooms: fullBathrooms + halfBathrooms,
    });
    setScopeText(text);
    navigator.clipboard.writeText(text);
    toast.success('Scope of work copied to clipboard');
  };

  const handleGenerateQuote = async () => {
    if (!contact.customerName.trim()) {
      toast.error('Please enter the customer name.');
      return;
    }
    if (quote.requiresCustomQuote && quote.total === 0 && manualPrice === null) {
      toast.error('This quote requires a manual price entry.');
      return;
    }
    if (selectedPackage === 'move_in_out' && !vacancyConfirmed) {
      toast.error('Move-In/Out requires vacancy confirmation.');
      return;
    }
    if (quote.unresolvedCustomAddOns.length > 0) {
      toast.error('Some add-ons require a custom price. Please enter them or remove them.');
      return;
    }

    setLoading(true);
    try {
      const computedTotal = typeof finalPrice === 'number' ? finalPrice : (finalPrice as [number, number])[1];
      const sowText = generateScopeOfWork({
        customerName: contact.customerName,
        propertyType,
        sizeBandLabel: quote.sizeBandLabel,
        selectedPackage,
        frequency: frequencyEnabled ? frequency : 'one_time',
        quote,
        vacancyConfirmed,
        bedrooms,
        bathrooms: fullBathrooms + halfBathrooms,
      });

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
          property_type: propertyType,
          package_name: PACKAGE_TO_SERVICE_TYPE[selectedPackage],
          frequency: frequencyEnabled ? frequency : 'one_time',
          selected_add_ons: selectedAddOnIds,
          add_on_quantities: addOnQuantities,
          custom_add_on_prices: customAddOnPrices,
          bedrooms: bedrooms,
          bathrooms: fullBathrooms,
          half_bathrooms: halfBathrooms,
          sqft,
          calculated_price: computedTotal,
          price_min: quote.isRange ? (quote.total as [number, number])[0] : null,
          price_max: quote.isRange ? (quote.total as [number, number])[1] : null,
          is_range: quote.isRange,
          is_custom_quote: quote.requiresCustomQuote,
          vacancy_confirmed: vacancyConfirmed,
          breakdown: quote,
          scope_of_work_text: sowText,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate quote');
      }

      toast.success('Quote generated and lead created');
      setQuoteFinalized(true);
      setScopeText(sowText);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Estimate Sqft from Bedrooms / Bathrooms fallback
  const handleEstimateSqft = () => {
    let estimated = 1000;
    if (propertyType === 'condo') {
      if (bedrooms <= 1) estimated = 600; // Studio/1BR midpoint
      else if (bedrooms === 2) estimated = 1000; // 2BR/2BA midpoint
      else estimated = 1250; // 3BR/2BA midpoint
    } else if (propertyType === 'basement') {
      if (bedrooms <= 1) estimated = 600;
      else estimated = 800;
    } else if (propertyType === 'house') {
      if (bedrooms <= 2) estimated = 500; // Under 1000 sqft midpoint
      else if (bedrooms === 3) estimated = (fullBathrooms + halfBathrooms >= 2) ? 1750 : 1250;
      else estimated = (fullBathrooms + halfBathrooms >= 3) ? 2750 : 2250;
    }
    setSqft(estimated);
    setManualPrice(null);
    setQuoteFinalized(false);
  };

  // Determine house band hint
  const currentHouseBand = propertyType === 'house'
    ? HOUSE_RATES.find((b) => sqft >= b.sqftMin && (b.sqftMax === null || sqft < b.sqftMax))
    : null;

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

      {/* LEFT COLUMN: Form Inputs */}
      <div
        className={`w-full md:w-[60%] overflow-y-auto overscroll-contain touch-pan-y ${
          mobileTab === 'form' ? 'flex-1' : 'hidden md:block'
        }`}
      >
        <div className="p-4 sm:p-5 space-y-5">

          {/* ── Contact Info ── */}
          <LeadContactFields contact={contact} onChange={onContactChange} />

          <hr className="border-muted" />

          {/* ── Property Type ── */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              1. Property Type
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <PropertyTypeCard type="condo" icon={Building2} selected={propertyType === 'condo'} onClick={() => { setPropertyType('condo'); setManualPrice(null); setQuoteFinalized(false); }} />
              <PropertyTypeCard type="basement" icon={Warehouse} selected={propertyType === 'basement'} onClick={() => { setPropertyType('basement'); setManualPrice(null); setQuoteFinalized(false); }} />
              <PropertyTypeCard type="house" icon={Home} selected={propertyType === 'house'} onClick={() => { setPropertyType('house'); setManualPrice(null); setQuoteFinalized(false); }} />
            </div>
          </section>

          {/* ── Size & Bathrooms ── */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              2. Size & Bathrooms
            </h3>
            <div className="flex items-end gap-4 flex-wrap">
              <div className="flex flex-col gap-1">
                <Stepper label="Sqft" value={sqft} onChange={(v) => { setSqft(v); setManualPrice(null); setQuoteFinalized(false); }} min={0} max={5000} step={100} />
                <Button
                  type="button"
                  variant="link"
                  className="text-[10px] h-auto p-0 font-normal text-primary hover:underline text-left"
                  onClick={handleEstimateSqft}
                >
                  Estimate sqft from Bed/Bath
                </Button>
              </div>
              <Stepper label="Bedrooms" value={bedrooms} onChange={(v) => { setBedrooms(v); setManualPrice(null); setQuoteFinalized(false); }} min={1} max={10} />
              <Stepper label="Full Baths" value={fullBathrooms} onChange={(v) => { setFullBathrooms(v); setManualPrice(null); setQuoteFinalized(false); }} min={0} max={10} />
              <Stepper label="Half Baths" value={halfBathrooms} onChange={(v) => { setHalfBathrooms(v); setManualPrice(null); setQuoteFinalized(false); }} min={0} max={10} />
            </div>
            {/* House band hint */}
            {propertyType === 'house' && currentHouseBand?.bedBath && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="h-3 w-3" />
                Typical config for {currentHouseBand.label}: {currentHouseBand.bedBath}
              </p>
            )}
            {propertyType === 'house' && sqft >= 3000 && (
              <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                3,000+ sqft house — custom quote required, site visit recommended.
              </div>
            )}
          </section>

          <hr className="border-muted" />

          {/* ── Package ── */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              3. Package
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PACKAGE_TIER_ORDER.map((pkg) => (
                <PackageCard
                  key={pkg}
                  pkg={pkg}
                  selected={selectedPackage === pkg}
                  priceHint={getPackagePriceHint(pkg)}
                  onClick={() => handlePackageChange(pkg)}
                />
              ))}
            </div>

            {/* Vacancy toggle for Move-In/Out */}
            {selectedPackage === 'move_in_out' && (
              <div className="p-3 rounded-md border border-blue-200 bg-blue-50 space-y-2">
                <div className="flex items-center gap-3">
                  <Switch
                    id="vacancy"
                    checked={vacancyConfirmed}
                    onCheckedChange={setVacancyConfirmed}
                  />
                  <Label htmlFor="vacancy" className="text-sm font-medium cursor-pointer">
                    Unit is fully vacant
                  </Label>
                </div>
                {!vacancyConfirmed && (
                  <p className="text-xs text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Move-In/Out requires a vacant unit. Switch to Full Reset for occupied properties.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* ── Frequency ── */}
          <section className="space-y-2">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              4. Frequency
            </h3>
            {frequencyEnabled ? (
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
                  <Button
                    key={f}
                    type="button"
                    variant={frequency === f ? 'default' : 'outline'}
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => { setFrequency(f); setManualPrice(null); setQuoteFinalized(false); }}
                  >
                    {FREQUENCY_LABELS[f]}
                    {f !== 'one_time' && (
                      <span className="ml-1 opacity-70">
                        ({Math.abs(FREQUENCY_DISCOUNT_MAP[f] * 100)}% off)
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">One-time service (frequency discounts only apply to Standard / Standard Plus)</p>
            )}
          </section>

          <hr className="border-muted" />

          {/* ── Add-Ons ── */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
              5. Add-Ons
            </h3>

            {ADD_ON_CATEGORIES.map((cat) => {
              const isExpanded = expandedCategories[cat.label] !== false; // default open
              const addOnsInCat = cat.ids.map((id) => ADD_ONS.find((a) => a.id === id)!).filter(Boolean);
              const selectedCount = addOnsInCat.filter((a) => selectedAddOnIds.includes(a.id)).length;
              const includedCount = addOnsInCat.filter((a) => {
                if (!a.includedFrom) return false;
                return PACKAGE_TIER_ORDER.indexOf(selectedPackage) >= PACKAGE_TIER_ORDER.indexOf(a.includedFrom);
              }).length;

              return (
                <div key={cat.label} className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                    onClick={() => toggleCategory(cat.label)}
                  >
                    <span className="text-xs font-semibold">{cat.label}</span>
                    <div className="flex items-center gap-2">
                      {selectedCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                          {selectedCount} selected
                        </Badge>
                      )}
                      {includedCount > 0 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-green-700 border-green-300">
                          {includedCount} included
                        </Badge>
                      )}
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-2 space-y-1">
                      {addOnsInCat.map((addOn) => {
                        const isIncluded = addOn.includedFrom
                          ? PACKAGE_TIER_ORDER.indexOf(selectedPackage) >= PACKAGE_TIER_ORDER.indexOf(addOn.includedFrom)
                          : false;
                        const isSelected = selectedAddOnIds.includes(addOn.id);
                        const isCustom = addOn.customQuoteOnly;
                        const hasPercent = !!addOn.percentOfTotal;
                        const quantity = addOnQuantities[addOn.id] || 1;

                        return (
                          <div
                            key={addOn.id}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
                              isIncluded
                                ? 'bg-green-50 opacity-80'
                                : isSelected
                                ? 'bg-primary/5'
                                : 'hover:bg-muted/50'
                            }`}
                          >
                            {isIncluded ? (
                              <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            ) : (
                              <Checkbox
                                id={`addon-${addOn.id}`}
                                checked={isSelected}
                                onCheckedChange={() => toggleAddOn(addOn.id)}
                                className="h-3.5 w-3.5"
                              />
                            )}
                            <label
                              htmlFor={`addon-${addOn.id}`}
                              className={`flex-1 text-xs cursor-pointer ${isIncluded ? 'text-green-700' : ''}`}
                            >
                              {addOn.label}
                            </label>

                            {isIncluded && (
                              <span className="text-[10px] text-green-600 font-medium">Included</span>
                            )}

                            {!isIncluded && isCustom && isSelected && (
                              <Input
                                type="number"
                                className="h-6 w-20 text-xs text-right"
                                placeholder="$ price"
                                value={customAddOnPrices[addOn.id] || ''}
                                onChange={(e) => {
                                  setCustomAddOnPrices((prev) => ({
                                    ...prev,
                                    [addOn.id]: parseFloat(e.target.value) || 0,
                                  }));
                                  setManualPrice(null);
                                  setQuoteFinalized(false);
                                }}
                              />
                            )}

                            {!isIncluded && !isCustom && !hasPercent && addOn.price !== null && (
                              <span className="text-[10px] text-muted-foreground font-medium">
                                ${addOn.price}{addOn.perUnit ? `/${addOn.perUnit}` : ''}
                              </span>
                            )}

                            {!isIncluded && hasPercent && (
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {(addOn.percentOfTotal! * 100).toFixed(1)}% of total
                              </span>
                            )}

                            {!isIncluded && isCustom && !isSelected && (
                              <span className="text-[10px] text-muted-foreground">Custom</span>
                            )}

                            {/* Quantity stepper for per-unit items */}
                            {!isIncluded && isSelected && (addOn.perUnit || ['laundry', 'linen_change', 'blinds_detail', 'curtain_dusting', 'full_wall_wash', 'ceiling_fan', 'carpet_steam_room'].includes(addOn.id)) && (
                              <div className="flex items-center gap-0 ml-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => {
                                    setAddOnQuantities((prev) => ({
                                      ...prev,
                                      [addOn.id]: Math.max(1, (prev[addOn.id] || 1) - 1),
                                    }));
                                    setManualPrice(null);
                                    setQuoteFinalized(false);
                                  }}
                                >
                                  <Minus className="h-2.5 w-2.5" />
                                </Button>
                                <span className="text-[10px] w-4 text-center font-medium">{quantity}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-5 w-5"
                                  onClick={() => {
                                    setAddOnQuantities((prev) => ({
                                      ...prev,
                                      [addOn.id]: (prev[addOn.id] || 1) + 1,
                                    }));
                                    setManualPrice(null);
                                    setQuoteFinalized(false);
                                  }}
                                >
                                  <Plus className="h-2.5 w-2.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* RIGHT COLUMN: Quote Breakdown (Sticky on Desktop, Tabbed on Mobile) */}
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
            {/* Header */}
            <div className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="font-bold text-lg tracking-tight">Quote Breakdown</h2>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyBreakdown} disabled={quote.requiresCustomQuote && quote.total === 0}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copy breakdown</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Scrollable breakdown */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">

              {/* Custom quote required */}
              {quote.requiresCustomQuote && quote.total === 0 && (
                <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <AlertTriangle className="h-4 w-4 inline mr-1.5 -mt-0.5" />
                  <strong>Custom quote required</strong> — {quote.customQuoteReason || 'Site visit recommended'}
                  <div className="mt-2">
                    <Label className="text-xs">Manual price override:</Label>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-sm font-medium">$</span>
                      <Input
                        type="number"
                        className="h-7 w-28 text-sm"
                        placeholder="Enter price"
                        value={manualPrice ?? ''}
                        onChange={(e) => setManualPrice(e.target.value === '' ? null : parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Normal breakdown */}
              {!(quote.requiresCustomQuote && quote.total === 0) && (
                <>
                  {/* Base Package */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Base Package</h4>
                    <div className="flex justify-between text-sm">
                      <span>{PACKAGE_LABELS[selectedPackage]}</span>
                      <span className="font-medium">
                        {quote.isRange
                          ? `$${(quote.basePrice as [number, number])[0]}–$${(quote.basePrice as [number, number])[1]}`
                          : `$${(quote.basePrice as number).toFixed(2)}`}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {PROPERTY_TYPE_LABELS[propertyType]} · {quote.sizeBandLabel}
                      {quote.isRange && ' · confirmed on arrival'}
                    </p>
                  </div>

                  {/* Bathroom Adjustment */}
                  {quote.bathroomAdjustment > 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Bathroom Adjustment</h4>
                      <div className="flex justify-between text-sm text-slate-700">
                        <span>Extra bathrooms</span>
                        <span>+${quote.bathroomAdjustment.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Frequency Discount */}
                  {typeof quote.frequencyDiscount === 'number' && quote.frequencyDiscount < 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Frequency Discount</h4>
                      <div className="flex justify-between text-sm text-green-700">
                        <span>{FREQUENCY_LABELS[frequency]} ({Math.abs(quote.frequencyDiscountPercent * 100)}% off)</span>
                        <span>${quote.frequencyDiscount.toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {/* Add-ons */}
                  {quote.addOns.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Add-Ons</h4>
                      {quote.addOns.map((a) => (
                        <div key={a.id} className="flex justify-between text-xs mb-1">
                          <span className={a.price === 'included' ? 'text-green-700' : a.price === 'custom' ? 'text-amber-700' : 'text-slate-700'}>
                            {a.label}
                            {a.quantity > 1 && ` (×${a.quantity})`}
                          </span>
                          <span className={`font-medium ${a.price === 'included' ? 'text-green-600' : a.price === 'custom' ? 'text-amber-600' : ''}`}>
                            {a.price === 'included'
                              ? 'Included'
                              : a.price === 'custom'
                              ? 'Custom'
                              : `+$${(a.price as number).toFixed(2)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Percentage surcharges */}
                  {quote.percentageSurcharges.length > 0 && (
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Surcharges</h4>
                      {quote.percentageSurcharges.map((s) => (
                        <div key={s.id} className="flex justify-between text-xs text-orange-700 mb-1">
                          <span>{s.label} ({(s.percent * 100).toFixed(1)}%)</span>
                          <span>+${s.amount.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <hr />

                  {/* Total */}
                  <div>
                    <div className="flex justify-between items-center text-2xl font-bold text-primary mb-2">
                      <span>TOTAL</span>
                      {quote.isRange ? (
                        <span>{displayTotal}</span>
                      ) : (
                        <div className="flex items-center">
                          <span className="mr-1">$</span>
                          <Input
                            type="number"
                            className="w-28 text-xl font-bold h-10 text-right focus-visible:ring-1"
                            value={manualPrice !== null ? manualPrice : (quote.total as number)}
                            onChange={(e) => {
                              setManualPrice(e.target.value === '' ? null : parseFloat(e.target.value) || 0);
                              setQuoteFinalized(false);
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {frequency !== 'one_time' && frequencyEnabled && (
                      <p className="text-[10px] text-muted-foreground">per visit</p>
                    )}

                    {quote.isRange && (
                      <p className="text-[10px] text-muted-foreground mt-1">Final price confirmed once our team assesses the property on arrival.</p>
                    )}
                  </div>

                  {/* Flags */}
                  {quote.requires2PersonCrewFlag && (
                    <div className="p-2 rounded-md bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      Estimated 12+ hours — flag for 2-person crew.
                    </div>
                  )}

                  {quote.requiresVacancyConfirmation && !vacancyConfirmed && (
                    <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Vacancy confirmation required to finalize.
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Actions — pinned to bottom */}
            <div className="mt-4 pt-3 border-t space-y-2 shrink-0">
              <Button
                className="w-full text-sm font-bold"
                size="lg"
                onClick={handleGenerateQuote}
                disabled={
                  !contact.customerName.trim() ||
                  loading ||
                  (quote.requiresCustomQuote && quote.total === 0 && manualPrice === null) ||
                  (selectedPackage === 'move_in_out' && !vacancyConfirmed) ||
                  quote.unresolvedCustomAddOns.length > 0
                }
              >
                {loading ? 'Generating...' : 'Generate Quote & Lead'}
              </Button>

              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={handleCopyScopeOfWork}
                disabled={quote.requiresCustomQuote && quote.total === 0 && manualPrice === null}
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Copy Scope of Work
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Small helper to avoid importing from constants in the JSX
const FREQUENCY_DISCOUNT_MAP: Record<Frequency, number> = {
  one_time: 0,
  monthly: 0.05,
  biweekly: 0.10,
  weekly: 0.15,
};
