import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { FOLLOWUP_CONFIG, resolveRepConfig } from '@/lib/sales/followups/config';

export async function GET(request: NextRequest) {
  try {
    const supabaseUserClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
    }

    const supabase = await createServiceClient();
    const { data: settings } = await supabase
      .from('sales_rep_followup_settings')
      .select('*')
      .eq('rep_id', user.id)
      .maybeSingle();

    const repFallback = resolveRepConfig(user.id || user.user_metadata?.full_name || user.email);
    return NextResponse.json({
      success: true,
      settings: settings || {
        rep_id: user.id,
        signature_name: user.user_metadata?.full_name || repFallback.name,
        signature_title: repFallback.title,
        signature_phone: repFallback.phone,
        gmail_address: repFallback.gmail_address || user.email || null,
      },
      mailingAddressSet: Boolean(FOLLOWUP_CONFIG.company.mailingAddress),
      mailingAddress: FOLLOWUP_CONFIG.company.mailingAddress || '',
    });
  } catch (err: any) {
    console.error('[API /api/sales/followups/settings] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const SettingsSchema = z.object({
  signature_name: z.string().min(1),
  signature_title: z.string().nullable().optional(),
  signature_phone: z.string().min(1),
  gmail_address: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const supabaseUserClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = SettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_request', details: parsed.error.issues }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('sales_rep_followup_settings')
      .upsert({
        rep_id: user.id,
        signature_name: parsed.data.signature_name,
        signature_title: parsed.data.signature_title || null,
        signature_phone: parsed.data.signature_phone,
        gmail_address: parsed.data.gmail_address || null,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      settings: data,
    });
  } catch (err: any) {
    console.error('[API /api/sales/followups/settings] PUT error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
