import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { applyReferralCode, getCustomerReferrals, ensureCustomerReferralCode } from '@/lib/referral-engine';

/** True if the caller is an admin or owns the given customer record. */
async function canAccessCustomer(auth: { id: string; role?: string }, customerId: string) {
  if (auth.role === 'admin') return true;
  const supabase = await createServiceClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customerId)
    .eq('profile_id', auth.id)
    .maybeSingle();
  return !!customer;
}

export async function GET(request: NextRequest) {
  // GET code for a customer, or apply code
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const customer_id = searchParams.get('customer_id');
    const action = searchParams.get('action');

    if (!customer_id) return NextResponse.json({ error: 'customer_id required' }, { status: 400 });

    // Security Check: Only the customer or an admin can access this data
    if (!(await canAccessCustomer(auth, customer_id))) {
      return NextResponse.json({ error: 'Unauthorized access to referral data' }, { status: 403 });
    }

    if (action === 'history') {
      const referrals = await getCustomerReferrals(customer_id);
      return NextResponse.json(referrals);
    }

    // Default: return the customer's referral code (create if needed)
    const code = await ensureCustomerReferralCode(customer_id);
    const { data: customer } = await supabase
      .from('customers')
      .select('credit_balance')
      .eq('id', customer_id)
      .single();

    return NextResponse.json({
      code,
      credit_balance: customer?.credit_balance ?? 0,
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Apply a referral code for a new customer
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { code, customer_id } = body;

    if (!code || !customer_id) {
      return NextResponse.json({ error: 'code and customer_id required' }, { status: 400 });
    }

    if (!(await canAccessCustomer(auth, customer_id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await applyReferralCode(code, customer_id);
    if (!result) {
      return NextResponse.json({ error: 'Invalid or already used referral code' }, { status: 400 });
    }

    return NextResponse.json({ discount: result.discount, referral_id: result.referral_id });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
