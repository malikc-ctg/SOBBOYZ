'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import React from 'react';
import { calculateQuote } from '@/lib/pricing/calculator';
import type { PackageType, Frequency, PropertyType } from '@/lib/pricing/constants';

export async function submitQuoteRequest(data: {
  category: string;
  address: string;
  description: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  quoted_price?: number;
  home_bedrooms?: number;
  home_bathrooms?: number;
  has_pets?: boolean;
  scheduled_date?: string;
  scheduled_window?: string;
}) {
  try {
    const supabase = await createServiceClient();

    // Map service category to the closest service_type enum if possible, or null
    // service_type ENUM: 'standard_clean','deep_clean','move_in_clean','move_out_clean','recurring_standard','recurring_deep'
    let service_type = null;
    if (data.category === 'House Cleaning') service_type = 'standard_clean';
    
    // Insert into leads table
    const { data: leadData, error } = await supabase
      .from('leads')
      .insert({
        source: 'website_quote',
        customer_name: `${data.firstName} ${data.lastName}`.trim(),
        customer_email: data.email,
        customer_phone: data.phone,
        city: data.address, // Store full address in city
        service_type: service_type, 
        condition: data.description,
        notes: `Requested Category: ${data.category}\nAddress: ${data.address}`,
        status: 'new',
        quoted_price: data.quoted_price,
        home_bedrooms: data.home_bedrooms,
        home_bathrooms: data.home_bathrooms,
        has_pets: data.has_pets || false,
        preferred_date: data.scheduled_date,
        preferred_window: data.scheduled_window,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error inserting lead:', error);
      return { success: false, error: error.message };
    }

    return { success: true, lead: leadData };

  } catch (err: any) {
    console.error('Error submitting quote request:', err);
    return { success: false, error: 'Internal server error' };
  }
}

import { applyDynamicPricing } from '@/lib/dynamic-pricing';
import type { ServiceType, TimeWindow } from '@/types';

export async function getLiveQuote(data: {
  property_type?: string;
  service_type: string;
  scheduled_date: string;
  scheduled_window: string;
  home_bedrooms: number;
  home_bathrooms: number;
  has_pets: boolean;
  add_ons: string[];
}) {
  try {
    const supabase = await createServiceClient();

    // 1. Get default zone
    const { data: zone } = await supabase.from('zones').select('id').limit(1).single();
    if (!zone) return { error: 'No service zones available' };

    // Map service_type back to PackageType
    let selectedPackage: PackageType = 'standard';
    if (data.service_type === 'deep_clean' || data.service_type === 'recurring_deep') selectedPackage = 'deep_clean';
    else if (data.service_type === 'standard_plus_clean') selectedPackage = 'standard_plus';
    else if (data.service_type === 'reset_clean') selectedPackage = 'deep_clean';
    else if (data.service_type === 'move_in_clean' || data.service_type === 'move_out_clean') selectedPackage = 'move_in_out';

    let frequency: Frequency = 'one_time';
    if (data.service_type === 'recurring_standard') {
      selectedPackage = 'standard';
      frequency = 'biweekly'; // default to biweekly recurring discount (10%)
    } else if (data.service_type === 'recurring_deep') {
      selectedPackage = 'deep_clean';
      frequency = 'biweekly';
    }

    // Fallback sqft estimation logic from bed/bath
    let sqft = 1000;
    const bedrooms = data.home_bedrooms ?? 2;
    const fullBathrooms = data.home_bathrooms ?? 1;
    const propertyType = (data.property_type as PropertyType) || 'house';
    
    if (propertyType === 'condo') {
      if (bedrooms === 0) sqft = 450;
      else if (bedrooms <= 1) sqft = 600;
      else if (bedrooms === 2) sqft = 1000;
      else sqft = 1250;
    } else if (propertyType === 'basement') {
      if (bedrooms === 0) sqft = 450;
      else if (bedrooms <= 1) sqft = 600;
      else sqft = 800;
    } else if (propertyType === 'house') {
      if (bedrooms === 0) sqft = 450;
      else if (bedrooms <= 2) sqft = 500;
      else if (bedrooms === 3) sqft = 1250;
      else sqft = 2250;
    }

    // Call calculator
    const quoteResult = calculateQuote({
      propertyType,
      sqft,
      selectedPackage,
      frequency,
      fullBathrooms,
      halfBathrooms: 0,
      selectedAddOnIds: data.add_ons || [],
      customAddOnPrices: {},
      addOnQuantities: {},
      vacancyConfirmed: selectedPackage === 'move_in_out' ? true : undefined,
    });

    if (quoteResult.requiresCustomQuote) {
      return { error: 'A custom quote is required for this size of property' };
    }

    // Map calculator result to the legacy UI structure
    const lineItems: Array<{ label: string; amount: number }> = [];
    let basePrice = 0;

    if (quoteResult.isRange) {
      const range = quoteResult.basePrice as [number, number];
      basePrice = (range[0] + range[1]) / 2;
      lineItems.push({ label: 'Base price (Est. Average)', amount: basePrice });
    } else {
      basePrice = quoteResult.basePrice as number;
      lineItems.push({ label: 'Base price', amount: basePrice });
    }

    if (quoteResult.bathroomAdjustment > 0) {
      lineItems.push({ label: 'Bathroom adjustment', amount: quoteResult.bathroomAdjustment });
    }

    if (typeof quoteResult.frequencyDiscount === 'number' && quoteResult.frequencyDiscount < 0) {
      lineItems.push({ label: 'Frequency discount', amount: quoteResult.frequencyDiscount });
    }

    let addOnsPrice = 0;
    for (const addOn of quoteResult.addOns) {
      if (typeof addOn.price === 'number') {
        addOnsPrice += addOn.price;
        lineItems.push({ label: addOn.label, amount: addOn.price });
      }
    }

    for (const surcharge of quoteResult.percentageSurcharges) {
      addOnsPrice += surcharge.amount;
      lineItems.push({ label: surcharge.label, amount: surcharge.amount });
    }

    const finalPrice = typeof quoteResult.total === 'number'
      ? quoteResult.total
      : (quoteResult.total[0] + quoteResult.total[1]) / 2;

    const deposit = Math.round(finalPrice * 0.3 * 100) / 100;

    const baseQuote = {
      service_type: data.service_type as ServiceType,
      base_price: basePrice,
      add_ons_price: addOnsPrice,
      final_price: finalPrice,
      deposit_amount: deposit,
      balance_due: finalPrice - deposit,
      line_items: lineItems,
    };

    const quote = await applyDynamicPricing({
      service_type: data.service_type as ServiceType,
      zone_id: zone.id,
      requested_date: data.scheduled_date,
      requested_window: data.scheduled_window as TimeWindow,
      base_quote: baseQuote,
      customer_credit: 0, // Guest quote
    });

    return { success: true, quote };
  } catch (err: any) {
    console.error('Error generating live quote:', err);
    return { error: 'Failed to generate quote' };
  }
}


export async function createCustomerAccountAndLinkQuote(data: any) {
  try {
    const supabase = await createServiceClient();
    const fullName = `${data.firstName} ${data.lastName}`.trim();

    // 1. Create the Auth User through the normal sign-up flow so Supabase requires the
    //    person to confirm they own this email before the account can sign in. Creating a
    //    pre-confirmed user here would let anyone register (and see data for) any email.
    const anonClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { data: signUpData, error: authError } = await anonClient.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: fullName } },
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return { success: false, error: 'An account with this email already exists. Please log in.' };
      }
      return { success: false, error: authError.message };
    }

    // Supabase returns a user with no identities when the email is already registered
    const newUser = signUpData.user;
    if (!newUser || (Array.isArray(newUser.identities) && newUser.identities.length === 0)) {
      return { success: false, error: 'An account with this email already exists. Please log in.' };
    }
    const authUser = { user: newUser };
    const needsEmailConfirmation = !signUpData.session;

    // 2. Ensure Profile Exists (Manually handle in case trigger fails)
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: authUser.user.id,
      email: data.email,
      full_name: fullName,
      phone: data.phone,
      role: 'customer'
    }, { onConflict: 'id', ignoreDuplicates: true });

    if (profileError) {
      console.error('Error creating profile manually:', profileError);
    }

    // Check if zone exists
    const { data: zone } = await supabase.from('zones').select('id').limit(1).single();

    // Never attach an existing customer record (jobs, address, credits) to a new account
    // here: the email is not verified yet. The portal links it after the email is confirmed.
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .ilike('email', String(data.email).replace(/[\\%_]/g, (c: string) => '\\' + c))
      .maybeSingle();

    if (!existingCustomer) {
      const { error: customerError } = await supabase
        .from('customers')
        .insert({
          profile_id: authUser.user.id,
          full_name: fullName,
          email: data.email,
          phone: data.phone,
          address_line1: data.address,
          city: data.city || '',
          postal_code: data.postal_code || '',
          zone_id: zone?.id,
          notes: JSON.stringify({ is_onboarded: true }),
          is_active: true
        });

      if (customerError) {
        console.error('Error creating customer record:', customerError);
        return { success: false, error: 'Failed to fully set up your profile. Please try again.' };
      }
    }

    // 3. Submit the Lead exactly like submitQuoteRequest
    let service_type = null;
    if (data.category === 'Standard Clean') service_type = 'standard_clean';
    else if (data.category === 'Deep Clean') service_type = 'deep_clean';
    else if (data.category === 'Move In/Out Clean') service_type = 'move_in_clean';
    else if (data.category === 'Recurring Standard') service_type = 'recurring_standard';
    else if (data.category === 'Recurring Deep') service_type = 'recurring_deep';
    else service_type = 'standard_clean';

    const { error: leadError } = await supabase
      .from('leads')
      .insert({
        source: 'website_quote_account',
        customer_name: `${data.firstName} ${data.lastName}`.trim(),
        customer_email: data.email,
        customer_phone: data.phone,
        city: data.address,
        service_type: service_type,
        condition: data.description,
        notes: `Account created during quote flow.\nCategory: ${data.category}\nAddress: ${data.address}`,
        status: 'new',
        quoted_price: data.quoted_price,
        home_bedrooms: data.home_bedrooms,
        home_bathrooms: data.home_bathrooms,
        has_pets: data.has_pets || false,
        preferred_date: data.scheduled_date,
        preferred_window: data.scheduled_window,
      });

    if (leadError) {
      console.error('Supabase error inserting lead for new account:', leadError);
    }

    return { success: true, needsEmailConfirmation };
  } catch (err: any) {
    console.error('Error creating customer account:', err);
    return { success: false, error: 'Internal server error' };
  }
}
