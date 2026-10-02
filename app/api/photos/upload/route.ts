import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';

const ALLOWED_PHOTO_TYPES = ['before', 'after', 'problem', 'damage', 'issue', 'checklist'];

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
};

const EXTENSION_MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  gif: 'image/gif',
};

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceClient = await createServiceClient();

    // Check user role
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const isAdmin = profile?.role === 'admin';

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const jobId = formData.get('job_id') as string | null;
    const photoType = (formData.get('photo_type') as string | null) || 'after';
    const caption = (formData.get('caption') as string | null) || '';
    const room = (formData.get('room') as string | null) || '';

    if (!file || !jobId) {
      return NextResponse.json({ error: 'Missing required fields (file, job_id)' }, { status: 400 });
    }

    if (!ALLOWED_PHOTO_TYPES.includes(photoType)) {
      return NextResponse.json({ error: 'Invalid photo_type' }, { status: 400 });
    }

    // Only accept images, and derive the stored extension from the MIME type rather than
    // the client-supplied filename (prevents uploading e.g. .html/.svg served publicly)
    // Some browsers send HEIC photos with an empty MIME type; fall back to an allowlisted extension
    const nameExt = (file.name?.split('.').pop() || '').toLowerCase();
    const mimeType = file.type || EXTENSION_MIME_TYPES[nameExt] || '';
    const fileExt = IMAGE_EXTENSIONS[mimeType];
    if (!fileExt) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP, HEIC or GIF images are allowed' }, { status: 400 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: 'Photo is too large (max 15 MB)' }, { status: 413 });
    }

    // Verify job exists
    const { data: job, error: jobError } = await serviceClient
      .from('jobs')
      .select('id, job_number, assigned_employee_id, assigned_employee_ids')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let employeeId: string | null = null;

    if (!isAdmin) {
      const { data: employee } = await serviceClient
        .from('employees')
        .select('id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!employee) {
        return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
      }

      employeeId = employee.id;

      // Verify job belongs to this employee or crew
      const isAssigned =
        job.assigned_employee_id === employeeId ||
        (Array.isArray(job.assigned_employee_ids) && job.assigned_employee_ids.includes(employeeId));

      if (!isAssigned) {
        return NextResponse.json({ error: 'You are not assigned to this job' }, { status: 403 });
      }
    } else {
      // If admin, allow passing custom employee_id or fallback to job's assigned cleaner
      employeeId = (formData.get('employee_id') as string | null) || job.assigned_employee_id || null;
    }

    // Generate unique filename
    const fileName = `${jobId}/${photoType}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

    // Upload to Supabase Storage bucket 'job_photos'
    const { data: uploadData, error: uploadError } = await serviceClient
      .storage
      .from('job_photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: `Storage error: ${uploadError.message}` }, { status: 500 });
    }

    // Get public URL
    const { data: publicUrlData } = serviceClient
      .storage
      .from('job_photos')
      .getPublicUrl(fileName);

    const publicUrl = publicUrlData.publicUrl;

    // Insert into job_photos table
    const { data: photoRecord, error: dbError } = await serviceClient
      .from('job_photos')
      .insert({
        job_id: jobId,
        employee_id: employeeId,
        photo_type: photoType,
        room: room || null,
        file_url: publicUrl,
        caption: caption || '',
      })
      .select('*, employee:employees(id, full_name, phone)')
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Write audit log entry
    logAudit({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: isAdmin ? 'admin' : 'employee',
      action: 'job.photo_uploaded',
      entityType: 'job_photo',
      entityId: photoRecord.id,
      newValues: {
        job_id: jobId,
        photo_type: photoType,
        room: room || null,
        file_url: publicUrl,
        caption: caption || '',
      },
      request,
      metadata: {
        job_id: jobId,
        job_number: job.job_number,
        photo_type: photoType,
        room: room || null,
      },
    });

    return NextResponse.json({ success: true, photo: photoRecord });

  } catch (err: unknown) {
    console.error('POST /api/photos/upload error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
