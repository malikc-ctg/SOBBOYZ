import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import {
  findDuplicateGroups,
  buildMergedLeadUpdate,
  scoreLeadCompleteness,
} from '@/lib/sales/leadDeduplication';

/**
 * Helper to fetch either B2B Sales OS leads or Inbound CRM leads (or all leads)
 */
async function fetchTargetLeads(supabase: any, scope: string) {
  let query = supabase.from('leads').select('*').order('created_at', { ascending: false });

  if (scope === 'b2b') {
    query = query.or('source.in.(phone_sales_os,contact_import,apollo),company_name.ilike.%Apex Edge%');
  } else if (scope === 'inbound') {
    query = query
      .neq('source', 'quo_telephony')
      .neq('status', 'vendor_list')
      .not('source', 'ilike', '%quo%')
      .not('source', 'in', '(contact_import,phone_sales_os,apollo,bid_tender,vendor_list)');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Safely merges one or more duplicate lead records into `primaryLead`,
 * re-pointing related outreach_tasks, jobs, pricing_quotes, and PHONE_CALL events
 * before deleting the redundant rows.
 */
async function executeClusterMerge(
  supabase: any,
  primaryLead: any,
  duplicateLeads: any[]
): Promise<{ primaryId: string; deletedIds: string[]; updatedPrimary: any }> {
  const primaryId = String(primaryLead.id);
  const dupIds = duplicateLeads.map((d) => String(d.id)).filter((id) => id !== primaryId);

  if (dupIds.length === 0) {
    return { primaryId, deletedIds: [], updatedPrimary: primaryLead };
  }

  // 1. Fold all duplicate fields sequentially into primaryLead
  let foldedPrimary = { ...primaryLead };
  for (const dup of duplicateLeads) {
    if (String(dup.id) === primaryId) continue;
    const mergedFields = buildMergedLeadUpdate(foldedPrimary, dup);
    foldedPrimary = { ...foldedPrimary, ...mergedFields };
  }

  // 2. Update primary lead in DB
  const { data: updatedPrimary, error: updateErr } = await supabase
    .from('leads')
    .update({
      customer_name: foldedPrimary.customer_name,
      company_name: foldedPrimary.company_name,
      contact_title: foldedPrimary.contact_title,
      customer_phone: foldedPrimary.customer_phone,
      customer_email: foldedPrimary.customer_email,
      city: foldedPrimary.city,
      status: foldedPrimary.status,
      quoted_price: foldedPrimary.quoted_price,
      notes: foldedPrimary.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', primaryId)
    .select()
    .maybeSingle();

  if (updateErr) {
    console.warn('[Leads Duplicates Merge] Primary update error:', updateErr);
  }

  // 3. Re-point outreach_tasks, jobs, pricing_quotes, commercial_opportunities
  try {
    await supabase.from('outreach_tasks').update({ lead_id: primaryId }).in('lead_id', dupIds);
  } catch {}
  try {
    await supabase.from('jobs').update({ lead_id: primaryId }).in('lead_id', dupIds);
  } catch {}
  try {
    await supabase.from('pricing_quotes').update({ lead_id: primaryId }).in('lead_id', dupIds);
  } catch {}
  try {
    await supabase.from('commercial_opportunities').update({ lead_id: primaryId }).in('lead_id', dupIds);
  } catch {}

  // 4. Re-point PHONE_CALL events whose payload->>'contact_id' references any duplicate ID
  for (const dupId of dupIds) {
    try {
      const { data: dupEvents } = await supabase
        .from('events')
        .select('event_id, payload')
        .eq('type', 'PHONE_CALL')
        .in('payload->>contact_id', [dupId, `lead_${dupId}`]);

      if (dupEvents && dupEvents.length > 0) {
        for (const ev of dupEvents) {
          const p = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : { ...ev.payload };
          p.contact_id = primaryId;
          await supabase.from('events').update({ payload: p }).eq('event_id', ev.event_id);
        }
      }
    } catch {}
  }

  // 5. Delete the duplicate lead rows (cascades remaining enrollments/tasks/flags safely)
  const { error: deleteErr } = await supabase.from('leads').delete().in('id', dupIds);
  if (deleteErr) {
    console.error('[Leads Duplicates Merge] Delete error:', deleteErr);
    throw deleteErr;
  }

  return {
    primaryId,
    deletedIds: dupIds,
    updatedPrimary: updatedPrimary || foldedPrimary,
  };
}

/**
 * GET /api/sales/leads/duplicates?scope=b2b|inbound|all
 * Scans and returns all duplicate clusters with primary vs duplicate leads.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'b2b';

    const leads = await fetchTargetLeads(supabase, scope);
    const groups = findDuplicateGroups(leads);

    const totalDuplicateRows = groups.reduce((acc, g) => acc + g.duplicateLeads.length, 0);

    return NextResponse.json({
      success: true,
      scope,
      groups_count: groups.length,
      duplicate_rows_count: totalDuplicateRows,
      groups,
    });
  } catch (err: any) {
    console.error('[API /api/sales/leads/duplicates GET] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/sales/leads/duplicates
 * Supports:
 * - action === 'merge_group': merges specific `duplicate_ids` into `primary_id`
 * - action === 'merge_all': automatically merges all detected duplicate groups in `scope`
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();
    const action = body.action || 'merge_group';

    if (action === 'merge_group') {
      const { primary_id, duplicate_ids } = body;
      if (!primary_id || !Array.isArray(duplicate_ids) || duplicate_ids.length === 0) {
        return NextResponse.json(
          { error: 'primary_id and non-empty duplicate_ids array are required' },
          { status: 400 }
        );
      }

      const allIds = [String(primary_id), ...duplicate_ids.map(String)];
      const { data: rows, error } = await supabase.from('leads').select('*').in('id', allIds);
      if (error) throw error;

      const primaryLead = (rows || []).find((r: any) => String(r.id) === String(primary_id));
      const dupLeads = (rows || []).filter((r: any) => String(r.id) !== String(primary_id));

      if (!primaryLead) {
        return NextResponse.json({ error: 'Primary lead not found' }, { status: 404 });
      }

      const result = await executeClusterMerge(supabase, primaryLead, dupLeads);
      return NextResponse.json({
        success: true,
        merged_groups: 1,
        deleted_count: result.deletedIds.length,
        deleted_ids: result.deletedIds,
        primary_lead: result.updatedPrimary,
      });
    }

    if (action === 'merge_all') {
      const scope = body.scope || 'b2b';
      const leads = await fetchTargetLeads(supabase, scope);
      const groups = findDuplicateGroups(leads);

      const allDeletedIds: string[] = [];
      const updatedPrimaries: any[] = [];

      for (const group of groups) {
        // Ensure highest completeness lead is primary
        const sorted = [...group.allLeads].sort(
          (a, b) => scoreLeadCompleteness(b) - scoreLeadCompleteness(a)
        );
        const primary = sorted[0];
        const dups = sorted.slice(1);
        const res = await executeClusterMerge(supabase, primary, dups);
        allDeletedIds.push(...res.deletedIds);
        updatedPrimaries.push(res.updatedPrimary);
      }

      return NextResponse.json({
        success: true,
        merged_groups: groups.length,
        deleted_count: allDeletedIds.length,
        deleted_ids: allDeletedIds,
        updated_primaries: updatedPrimaries,
      });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('[API /api/sales/leads/duplicates POST] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
