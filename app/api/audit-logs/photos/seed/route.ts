import { requireRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();

    // Check if photos already exist
    const { count } = await supabase
      .from('job_photos')
      .select('id', { count: 'exact', head: true });

    if (count && count > 0) {
      return NextResponse.json({ message: 'Photos already present', count });
    }

    // Get a couple of jobs and employees
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, job_number, assigned_employee_id')
      .limit(3);

    const { data: employees } = await supabase
      .from('employees')
      .select('id, full_name')
      .limit(2);

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs available to seed photos' }, { status: 400 });
    }

    const job1 = jobs[0];
    const job2 = jobs[1] || jobs[0];
    const emp1 = employees?.[0]?.id || job1.assigned_employee_id || null;
    const emp2 = employees?.[1]?.id || emp1;

    const samplePhotos = [
      {
        job_id: job1.id,
        employee_id: emp1,
        photo_type: 'before',
        room: 'Kitchen Stove & Cooktop',
        file_url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
        caption: 'Pre-existing grease build-up and burned residues documented prior to deep degreasing',
        uploaded_at: new Date(Date.now() - 4 * 3600000).toISOString(),
      },
      {
        job_id: job1.id,
        employee_id: emp1,
        photo_type: 'after',
        room: 'Kitchen Stove & Cooktop',
        file_url: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
        caption: 'Full degrease and sanitize completed. Stainless steel surfaces polished and verified',
        uploaded_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      },
      {
        job_id: job1.id,
        employee_id: emp1,
        photo_type: 'problem',
        room: 'Master Bathroom Baseboard',
        file_url: 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?auto=format&fit=crop&w=1200&q=80',
        caption: 'Pre-existing hairline crack and water swelling on baseboard photographed upon arrival to protect against damage claims',
        uploaded_at: new Date(Date.now() - 3.8 * 3600000).toISOString(),
      },
      {
        job_id: job2.id,
        employee_id: emp2,
        photo_type: 'checklist',
        room: 'Living Room Hardwood Floors',
        file_url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
        caption: 'HEPA vacuum and microfiber hardwood mop step verified per checklist standards',
        uploaded_at: new Date(Date.now() - 1 * 3600000).toISOString(),
      },
    ];

    const { data: inserted, error } = await supabase
      .from('job_photos')
      .insert(samplePhotos)
      .select();

    if (error) throw error;

    return NextResponse.json({ success: true, seeded: inserted?.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
