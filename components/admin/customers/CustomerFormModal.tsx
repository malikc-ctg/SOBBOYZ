'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Building2,
  Home,
  Loader2,
  MapPin,
  Shield,
  CreditCard,
  Key,
  PawPrint,
  FileText,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Customer, Zone } from '@/types';

interface CustomerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  onSuccess: (customer: Customer) => void;
  defaultType?: 'residential' | 'commercial';
}

const FACILITY_TYPES = [
  { value: 'office', label: 'Corporate Office' },
  { value: 'medical', label: 'Medical / Dental Clinic' },
  { value: 'retail', label: 'Retail Store / Showroom' },
  { value: 'warehouse', label: 'Industrial / Warehouse' },
  { value: 'post_construction', label: 'Post-Construction Site' },
  { value: 'daycare', label: 'Daycare / School' },
  { value: 'restaurant', label: 'Restaurant / Hospitality' },
  { value: 'other', label: 'Other Commercial Facility' },
];

const BILLING_TERMS = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_15', label: 'Net 15 Days' },
  { value: 'net_30', label: 'Net 30 Days' },
  { value: 'prepaid', label: 'Prepaid / Card on File' },
];

export function CustomerFormModal({
  open,
  onOpenChange,
  customer,
  onSuccess,
  defaultType = 'residential',
}: CustomerFormModalProps) {
  const isEditing = Boolean(customer?.id);

  // Form State
  const [customerType, setCustomerType] = useState<'residential' | 'commercial'>(defaultType);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [facilityType, setFacilityType] = useState('office');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [zones, setZones] = useState<Zone[]>([]);
  const [notes, setNotes] = useState('');

  // Residential specs
  const [homeBedrooms, setHomeBedrooms] = useState<string>('3');
  const [homeBathrooms, setHomeBathrooms] = useState<string>('2');
  const [petDetails, setPetDetails] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Commercial specs
  const [squareFootage, setSquareFootage] = useState<string>('');
  const [apName, setApName] = useState('');
  const [apEmail, setApEmail] = useState('');
  const [apPhone, setApPhone] = useState('');
  const [billingTerms, setBillingTerms] = useState<string>('due_on_receipt');
  const [taxId, setTaxId] = useState('');
  const [taxExempt, setTaxExempt] = useState(false);

  // Access & Security
  const [accessCode, setAccessCode] = useState('');
  const [alarmInstructions, setAlarmInstructions] = useState('');
  const [parkingInstructions, setParkingInstructions] = useState('');

  const [saving, setSaving] = useState(false);

  // Fetch zones on mount
  useEffect(() => {
    fetch('/api/zones')
      .then((r) => r.json())
      .then((data) => setZones(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Populate form when editing or changing customer
  useEffect(() => {
    if (customer) {
      const type = customer.customer_type || (customer.company_name ? 'commercial' : 'residential');
      setCustomerType(type);
      setFullName(customer.full_name || '');
      setCompanyName(customer.company_name || '');
      setFacilityType(customer.commercial_facility_type || 'office');
      setEmail(customer.email?.startsWith('no-email-') ? '' : customer.email || '');
      setPhone(customer.phone === '—' ? '' : customer.phone || '');
      setAddressLine1(customer.address_line1 || '');
      setAddressLine2(customer.address_line2 || '');
      setCity(customer.city || '');
      setPostalCode(customer.postal_code || '');
      setZoneId(customer.zone_id || '');
      setNotes(customer.notes || '');

      // Specs
      setHomeBedrooms(customer.home_bedrooms != null ? String(customer.home_bedrooms) : '3');
      setHomeBathrooms(customer.home_bathrooms != null ? String(customer.home_bathrooms) : '2');
      setPetDetails(customer.pet_details || '');
      setSpecialInstructions(customer.special_instructions || '');

      setSquareFootage(customer.square_footage != null ? String(customer.square_footage) : '');
      setApName(customer.accounts_payable_name || '');
      setApEmail(customer.accounts_payable_email || '');
      setApPhone(customer.accounts_payable_phone || '');
      setBillingTerms(customer.billing_terms || 'due_on_receipt');
      setTaxId(customer.tax_id || '');
      setTaxExempt(Boolean(customer.tax_exempt));

      setAccessCode(customer.access_code || '');
      setAlarmInstructions(customer.alarm_instructions || '');
      setParkingInstructions(customer.parking_instructions || '');
    } else {
      // Reset defaults for new customer
      setCustomerType(defaultType);
      setFullName('');
      setCompanyName('');
      setFacilityType('office');
      setEmail('');
      setPhone('');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setPostalCode('');
      setZoneId('');
      setNotes('');
      setHomeBedrooms('3');
      setHomeBathrooms('2');
      setPetDetails('');
      setSpecialInstructions('');
      setSquareFootage('');
      setApName('');
      setApEmail('');
      setApPhone('');
      setBillingTerms('due_on_receipt');
      setTaxId('');
      setTaxExempt(false);
      setAccessCode('');
      setAlarmInstructions('');
      setParkingInstructions('');
    }
  }, [customer, defaultType, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setSaving(true);

    try {
      const payload: Record<string, any> = {
        full_name: fullName.trim(),
        customer_type: customerType,
        company_name: customerType === 'commercial' ? companyName.trim() || null : null,
        commercial_facility_type: customerType === 'commercial' ? facilityType : null,
        email: email.trim() || (isEditing ? undefined : `no-email-${Date.now()}@seaofblue.local`),
        phone: phone.trim(),
        address_line1: addressLine1.trim() || null,
        address_line2: addressLine2.trim() || null,
        city: city.trim() || null,
        postal_code: postalCode.trim().toUpperCase() || null,
        zone_id: zoneId || null,
        notes: notes.trim() || null,
        access_code: accessCode.trim() || null,
        alarm_instructions: alarmInstructions.trim() || null,
        parking_instructions: parkingInstructions.trim() || null,
        special_instructions: specialInstructions.trim() || null,
      };

      if (customerType === 'residential') {
        payload.home_bedrooms = homeBedrooms ? Number(homeBedrooms) : null;
        payload.home_bathrooms = homeBathrooms ? Number(homeBathrooms) : null;
        payload.pet_details = petDetails.trim() || null;
      } else {
        payload.square_footage = squareFootage ? Number(squareFootage) : null;
        payload.accounts_payable_name = apName.trim() || null;
        payload.accounts_payable_email = apEmail.trim() || null;
        payload.accounts_payable_phone = apPhone.trim() || null;
        payload.billing_terms = billingTerms;
        payload.tax_id = taxId.trim() || null;
        payload.tax_exempt = taxExempt;
      }

      let res: Response;
      if (isEditing && customer?.id) {
        res = await fetch(`/api/customers/${customer.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save customer');
      }

      toast.success(
        isEditing
          ? `${customerType === 'commercial' ? 'Commercial Client' : 'Residential Customer'} updated successfully`
          : `${customerType === 'commercial' ? 'Commercial Client' : 'Residential Customer'} created successfully`
      );

      onSuccess(data);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while saving');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader className="p-6 pb-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                  customerType === 'commercial'
                    ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                    : 'bg-blue-950/80 text-blue-300 border border-blue-800'
                }`}
              >
                {customerType === 'commercial' ? (
                  <Building2 className="h-5 w-5" />
                ) : (
                  <Home className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-xl text-white">
                  {isEditing
                    ? `Edit ${customerType === 'commercial' ? 'Commercial Client' : 'Residential Customer'}`
                    : `Add New ${customerType === 'commercial' ? 'Commercial Client' : 'Residential Customer'}`}
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  {customerType === 'commercial'
                    ? 'Manage commercial enterprise account, facility details, and AP billing.'
                    : 'Manage residential home profile, family/pet preferences, and entry specs.'}
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Type Switcher Segmented Control */}
          <div className="grid grid-cols-2 gap-2 mt-4 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setCustomerType('residential')}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
                customerType === 'residential'
                  ? 'bg-blue-950/80 text-blue-300 border border-blue-800 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              Residential Home
            </button>
            <button
              type="button"
              onClick={() => setCustomerType('commercial')}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all ${
                customerType === 'commercial'
                  ? 'bg-purple-950/80 text-purple-300 border border-purple-800 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Commercial Facility
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* COMMERCIAL HEADER SECTION */}
          {customerType === 'commercial' && (
            <div className="p-4 bg-purple-950/30 border border-purple-900/50 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                <Building2 className="h-4 w-4 text-purple-400" />
                Company & Facility Classification
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-300">
                    Company / Organization Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Apex Health Clinic, Oakville Law Chambers"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required={customerType === 'commercial'}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Facility Type</Label>
                  <Select value={facilityType} onValueChange={setFacilityType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FACILITY_TYPES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Square Footage (sq ft)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 3500"
                    value={squareFootage}
                    onChange={(e) => setSquareFootage(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* PRIMARY CONTACT DETAILS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
              <UserCheck className="h-4 w-4 text-slate-400" />
              {customerType === 'commercial' ? 'On-Site / Primary Contact' : 'Customer Contact Details'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
                  {customerType === 'commercial' ? 'Contact Name / Facility Mgr' : 'Full Name'}{' '}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="e.g. Sarah Jenkins"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
                  Phone Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="(416) 555-0199"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-300">Email Address</Label>
                <Input
                  type="email"
                  placeholder="name@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* LOCATION & SERVICE ZONE */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
              <MapPin className="h-4 w-4 text-slate-400" />
              Location & Service Zone
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-300">Street Address</Label>
                <Input
                  placeholder="123 Queen Street West"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
                  {customerType === 'commercial' ? 'Suite / Floor / Unit' : 'Unit / Apt #'}
                </Label>
                <Input
                  placeholder="Suite 400"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">City</Label>
                <Input
                  placeholder="Toronto, Mississauga, Oakville..."
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Postal Code</Label>
                <Input
                  placeholder="M5V 2H1"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Assigned Service Zone</Label>
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* RESIDENTIAL-SPECIFIC SPECS */}
          {customerType === 'residential' && (
            <div className="p-4 bg-blue-950/30 border border-blue-900/50 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-300">
                <Home className="h-4 w-4 text-blue-400" />
                Home Details & Preferences
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Bedrooms</Label>
                  <Select value={homeBedrooms} onValueChange={setHomeBedrooms}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? 'Bed' : 'Beds'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Bathrooms</Label>
                  <Select value={homeBathrooms} onValueChange={setHomeBathrooms}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} {n === 1 ? 'Bath' : 'Baths'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs font-semibold text-slate-300">Pets in Home</Label>
                  <Input
                    placeholder="e.g. Golden Retriever (friendly), 1 cat"
                    value={petDetails}
                    onChange={(e) => setPetDetails(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">Special Preferences / Surfaces</Label>
                <Input
                  placeholder="e.g. Hardwood floor cleaner only in living room, do not disturb home office"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* COMMERCIAL BILLING & AP TERMS */}
          {customerType === 'commercial' && (
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                <CreditCard className="h-4 w-4 text-slate-400" />
                Commercial Billing & Accounts Payable
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">AP Contact Name</Label>
                  <Input
                    placeholder="e.g. Finance Dept"
                    value={apName}
                    onChange={(e) => setApName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">AP Invoicing Email</Label>
                  <Input
                    type="email"
                    placeholder="invoices@company.com"
                    value={apEmail}
                    onChange={(e) => setApEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Payment Terms</Label>
                  <Select value={billingTerms} onValueChange={setBillingTerms}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_TERMS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-300">Tax / HST # (if registered)</Label>
                  <Input
                    placeholder="e.g. 123456789RT0001"
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between sm:col-span-2 p-3 bg-slate-950 rounded-lg border border-slate-800 mt-auto">
                  <div>
                    <span className="text-xs font-semibold block text-slate-200">Tax-Exempt Entity</span>
                    <span className="text-[11px] text-slate-400">
                      Enable for certified tax-exempt institutions (schools, reserves)
                    </span>
                  </div>
                  <Switch checked={taxExempt} onCheckedChange={setTaxExempt} />
                </div>
              </div>
            </div>
          )}

          {/* ACCESS & SECURITY SPECS (Shared with context) */}
          <div className="p-4 bg-amber-950/30 border border-amber-900/50 rounded-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Key className="h-4 w-4 text-amber-400" />
              Access, Security & Entry Codes
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
                  {customerType === 'commercial' ? 'Keycard / Master Lockbox PIN' : 'Door / Lockbox Code'}
                </Label>
                <Input
                  placeholder="e.g. 4821#"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-300">
                  {customerType === 'commercial' ? 'Alarm Panel PIN & Disarm Protocol' : 'Alarm Disarm Instructions'}
                </Label>
                <Input
                  placeholder="e.g. Disarm within 45s with code 9922"
                  value={alarmInstructions}
                  onChange={(e) => setAlarmInstructions(e.target.value)}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-300">
                  {customerType === 'commercial'
                    ? 'Loading Dock, Janitor Closet & Parking Directions'
                    : 'Parking Directions & Entry Door (Front/Side/Garage)'}
                </Label>
                <Input
                  placeholder={
                    customerType === 'commercial'
                      ? 'e.g. Park in loading bay 3, key to janitor supply room in lockbox B'
                      : 'e.g. Park on left side of driveway, enter through side garage door'
                  }
                  value={parkingInstructions}
                  onChange={(e) => setParkingInstructions(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* INTERNAL ADMIN NOTES */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-300">Internal Admin Notes</Label>
            <Textarea
              placeholder="Private team notes regarding customer history, billing agreements, or special arrangements..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className={
                customerType === 'commercial'
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              {isEditing
                ? `Update ${customerType === 'commercial' ? 'Commercial Client' : 'Residential Customer'}`
                : `Create ${customerType === 'commercial' ? 'Commercial Client' : 'Residential Customer'}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
