'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AddressAutocomplete } from '@/components/ui/address-autocomplete';

export interface LeadContactData {
  companyName?: string;
  customerName: string;
  contactTitle?: string;
  customerPhone: string;
  customerEmail: string;
  address: string;
  source: string;
}

export function LeadContactFields({
  contact,
  onChange,
  isCommercial = false,
}: {
  contact: LeadContactData;
  onChange: (field: keyof LeadContactData, value: string) => void;
  isCommercial?: boolean;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-3.5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <span>{isCommercial ? '🏢 Commercial Account & Main Contact' : '👤 Contact Information'}</span>
        </h3>
        {isCommercial && (
          <span className="text-[11px] text-muted-foreground font-medium">
            Who do we speak to?
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {isCommercial ? (
          <>
            <div>
              <Label className="text-xs font-medium">Company / Business Name</Label>
              <Input
                value={contact.companyName || ''}
                onChange={(e) => onChange('companyName', e.target.value)}
                placeholder="e.g. John's Roofing"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Main Contact Person *</Label>
              <Input
                value={contact.customerName}
                onChange={(e) => onChange('customerName', e.target.value)}
                placeholder="e.g. Mark"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Contact Title / Role</Label>
              <Input
                value={contact.contactTitle || ''}
                onChange={(e) => onChange('contactTitle', e.target.value)}
                placeholder="e.g. Site Supervisor, PM, Owner"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Direct Phone</Label>
              <Input
                value={contact.customerPhone}
                onChange={(e) => onChange('customerPhone', e.target.value)}
                placeholder="(555) 555-5555"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Direct Email</Label>
              <Input
                type="email"
                value={contact.customerEmail}
                onChange={(e) => onChange('customerEmail', e.target.value)}
                placeholder="mark@example.com"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Lead Source *</Label>
              <Select
                value={contact.source}
                onValueChange={(val) => onChange('source', val)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound_call">Inbound Call</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="realtor">Realtor / GC</SelectItem>
                  <SelectItem value="cold_call">Cold Call / Outreach</SelectItem>
                  <SelectItem value="d2d">D2D</SelectItem>
                  <SelectItem value="lsa">Local Service Ads (LSA)</SelectItem>
                  <SelectItem value="google_search">Google Search</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Job Site / Facility Address</Label>
              <AddressAutocomplete
                value={contact.address}
                onChange={(e) => onChange('address', e.target.value)}
                onAddressSelect={(addr) =>
                  onChange('address', `${addr.address_line1}, ${addr.city}`)
                }
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <Label className="text-xs font-medium">Full Name *</Label>
              <Input
                value={contact.customerName}
                onChange={(e) => onChange('customerName', e.target.value)}
                placeholder="e.g. Sarah Jenkins"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Phone</Label>
              <Input
                value={contact.customerPhone}
                onChange={(e) => onChange('customerPhone', e.target.value)}
                placeholder="(555) 555-5555"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Email</Label>
              <Input
                type="email"
                value={contact.customerEmail}
                onChange={(e) => onChange('customerEmail', e.target.value)}
                placeholder="sarah@example.com"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Lead Source *</Label>
              <Select
                value={contact.source}
                onValueChange={(val) => onChange('source', val)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound_call">Inbound Call</SelectItem>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="realtor">Realtor</SelectItem>
                  <SelectItem value="cold_call">Cold Call / Outreach</SelectItem>
                  <SelectItem value="d2d">D2D</SelectItem>
                  <SelectItem value="lsa">Local Service Ads (LSA)</SelectItem>
                  <SelectItem value="google_search">Google Search</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-medium">Property Address</Label>
              <AddressAutocomplete
                value={contact.address}
                onChange={(e) => onChange('address', e.target.value)}
                onAddressSelect={(addr) =>
                  onChange('address', `${addr.address_line1}, ${addr.city}`)
                }
              />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
