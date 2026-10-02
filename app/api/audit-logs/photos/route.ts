import { requireRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);

    const photoType = searchParams.get('photo_type');
    const jobId = searchParams.get('job_id');
    const employeeId = searchParams.get('employee_id');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') ?? '60');
    const offset = parseInt(searchParams.get('offset') ?? '0');

    let query = supabase
      .from('job_photos')
      .select(`
        *,
        job:jobs(id, job_number, service_type, scheduled_date, status, address_line1, city, customer:customers(id, full_name, phone)),
        employee:employees(id, full_name, email, phone)
      `, { count: 'exact' })
      .order('uploaded_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (photoType && photoType !== 'all') {
      if (photoType === 'issues') {
        query = query.in('photo_type', ['problem', 'damage', 'issue']);
      } else {
        query = query.eq('photo_type', photoType);
      }
    }
    if (jobId) {
      query = query.eq('job_id', jobId);
    }
    if (employeeId && employeeId !== 'all') {
      query = query.eq('employee_id', employeeId);
    }

    const { data: photos, error, count } = await query;
    if (error) {
      console.error('Error fetching job photos:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter by search in-memory if requested
    let filteredPhotos = photos || [];
    if (search) {
      const s = search.toLowerCase();
      filteredPhotos = filteredPhotos.filter((p: any) =>
        p.caption?.toLowerCase().includes(s) ||
        p.room?.toLowerCase().includes(s) ||
        p.job?.job_number?.toLowerCase().includes(s) ||
        p.job?.city?.toLowerCase().includes(s) ||
        p.job?.customer?.full_name?.toLowerCase().includes(s) ||
        p.employee?.full_name?.toLowerCase().includes(s)
      );
    }

    // Calculate metrics across all photos
    const { data: allStats } = await supabase
      .from('job_photos')
      .select('photo_type, uploaded_at');

    const stats = allStats || [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const summary = {
      total: stats.length,
      before: stats.filter((p) => p.photo_type === 'before').length,
      after: stats.filter((p) => p.photo_type === 'after').length,
      issues: stats.filter((p) => ['problem', 'damage', 'issue'].includes(p.photo_type)).length,
      checklist: stats.filter((p) => ['checklist', 'extra'].includes(p.photo_type)).length,
      today: stats.filter((p) => p.uploaded_at && p.uploaded_at.startsWith(todayStr)).length,
    };

    return NextResponse.json({
      photos: filteredPhotos,
      count: count ?? filteredPhotos.length,
      summary,
      limit,
      offset,
    });
  } catch (err: unknown) {
    console.error('GET /api/audit-logs/photos error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
