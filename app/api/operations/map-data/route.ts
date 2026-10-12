import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { format } from 'date-fns';

const ACTIVE_STATUSES = ['lead_received', 'confirmed', 'offered', 'assigned', 'on_the_way', 'in_progress'];

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();

    // Parse date from query string. Default to today if omitted or 'today'. If 'all', return all footprint.
    const { searchParams } = new URL(request.url);
    const rawDate = searchParams.get('date');
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const showAll = rawDate === 'all';
    const targetDate = showAll ? null : (rawDate && rawDate !== 'today' ? rawDate : todayStr);

    let jobsQuery = supabase
      .from('jobs')
      .select(`
        id,
        job_number,
        status,
        service_type,
        scheduled_date,
        scheduled_window,
        scheduled_start_time,
        address_line1,
        city,
        postal_code,
        quoted_price,
        final_price,
        add_ons,
        latitude,
        longitude,
        zone_id,
        assigned_employee_id,
        customer:customers(full_name, phone),
        assigned_employee:employees(id, full_name, phone, tier)
      `)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('scheduled_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (targetDate) {
      jobsQuery = jobsQuery.eq('scheduled_date', targetDate);
    }

    let allJobsStatsQuery = supabase
      .from('jobs')
      .select('id, job_number, service_type, scheduled_date, address_line1, status, quoted_price, final_price, city, latitude, longitude, assigned_employee_id, zone_id')
      .order('scheduled_date', { ascending: false });

    if (targetDate) {
      allJobsStatsQuery = allJobsStatsQuery.eq('scheduled_date', targetDate);
    }

    // Attempt to query contractor_locations for live GPS telemetry (table exists in schema)
    const locsQuery = supabase
      .from('contractor_locations')
      .select('id, contractor_id, latitude, longitude, accuracy, heading, speed, is_active, last_updated')
      .eq('is_active', true);

    // Dedicated query for today's live stats
    const todayJobsQuery = supabase
      .from('jobs')
      .select('id, status, quoted_price, final_price')
      .eq('scheduled_date', todayStr);

    const [jobsRes, locsRes, zonesRes, activeEmployeesRes, allJobsStatsRes, todayJobsRes] = await Promise.all([
      jobsQuery,
      locsQuery,
      supabase
        .from('zones')
        .select('id, name, city, is_active, areas, latitude, longitude, geojson_polygon')
        .eq('is_active', true)
        .order('name'),
      supabase
        .from('employees')
        .select('id, full_name, phone, tier, status, notes, zone_id')
        .eq('status', 'active'),
      allJobsStatsQuery,
      todayJobsQuery,
    ]);

    if (jobsRes.error) {
      console.error('Error fetching jobs for map-data:', jobsRes.error);
      throw jobsRes.error;
    }
    if (zonesRes.error) {
      console.error('Error fetching zones for map-data:', zonesRes.error);
      throw zonesRes.error;
    }

    const rawJobs = jobsRes.data ?? [];
    const zones = zonesRes.data ?? [];
    const employees = activeEmployeesRes.data ?? [];
    const allScopedJobs = allJobsStatsRes.data ?? [];
    const rawLocs = locsRes.data ?? [];

    // Normalize employee association on jobs
    const jobs = rawJobs.map((j: any) => ({
      ...j,
      employee: j.assigned_employee || null,
    }));

    // Normalize contractor_locations to employeeLocations
    const employeeLocations = rawLocs.map((loc: any) => {
      const emp = employees.find((e) => e.id === loc.contractor_id);
      return {
        id: loc.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        heading: loc.heading,
        speed: loc.speed,
        accuracy: loc.accuracy,
        last_updated: loc.last_updated,
        employee_id: loc.contractor_id,
        employee: emp || null,
      };
    });

    // Build Employee HQs from notes or default coordinates
    const employeeHQs = employees
      .map((employee) => {
        let hq_coords = null;
        try {
          if (employee.notes) {
            const notesObj = JSON.parse(employee.notes);
            if (notesObj.hq_coords && typeof notesObj.hq_coords.lat === 'number') {
              hq_coords = notesObj.hq_coords;
            }
          }
        } catch {
          // ignore
        }
        return {
          id: employee.id,
          full_name: employee.full_name,
          phone: employee.phone,
          tier: employee.tier,
          status: employee.status,
          zone_id: employee.zone_id,
          latitude: hq_coords?.lat || null,
          longitude: hq_coords?.lng || null,
        };
      })
      .filter((hq) => hq.latitude !== null && hq.longitude !== null);

    const onlineEmployeeIds = new Set(employeeLocations.map((l) => l.employee_id).filter(Boolean));

    // Calculate rich Zone Intelligence Metrics
    const zoneMetrics = zones.map((zone) => {
      const zoneJobs = allScopedJobs.filter((j) => j.zone_id === zone.id);
      const activeJobs = zoneJobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
      const completedJobs = zoneJobs.filter((j) => j.status === 'completed');

      const totalRevenue = zoneJobs.reduce(
        (sum, j) => sum + (Number(j.final_price) || Number(j.quoted_price) || 0),
        0
      );
      const activeRevenue = activeJobs.reduce(
        (sum, j) => sum + (Number(j.quoted_price) || 0),
        0
      );

      const zoneEmployees = employees.filter((c) => c.zone_id === zone.id);
      const onlineInZone = zoneEmployees.filter((c) => onlineEmployeeIds.has(c.id)).length;
      const assignedInZone = activeJobs.filter((j) => j.assigned_employee_id).length;

      // Coverage ratio & status
      const demand = activeJobs.length;
      let coverageStatus: 'high' | 'medium' | 'low' | 'idle' = 'idle';
      if (demand === 0 && onlineInZone === 0) {
        coverageStatus = 'idle';
      } else if (onlineInZone === 0 && demand > 0) {
        coverageStatus = 'low'; // High demand, no staff online
      } else if (onlineInZone >= demand) {
        coverageStatus = 'high'; // Fully covered
      } else {
        coverageStatus = demand - onlineInZone >= 2 ? 'low' : 'medium';
      }

      // Dominance (in-house vs contractor)
      const IN_HOUSE_TIERS = ['team'];
      const inHouseInZone = zoneEmployees.filter((c) => IN_HOUSE_TIERS.includes(c.tier)).length;
      const independentInZone = zoneEmployees.length - inHouseInZone;

      const inHouseEmployeeIds = new Set(
        zoneEmployees.filter((c) => IN_HOUSE_TIERS.includes(c.tier)).map((c) => c.id)
      );
      const inHouseJobsToday = zoneJobs.filter(
        (j) => j.assigned_employee_id && inHouseEmployeeIds.has(j.assigned_employee_id)
      ).length;
      const employeeJobsToday = zoneJobs.filter(
        (j) => j.assigned_employee_id && !inHouseEmployeeIds.has(j.assigned_employee_id)
      ).length;

      let dominanceMode: 'in_house' | 'employee' | 'mixed' | 'none' = 'none';
      if (inHouseInZone > 0 || independentInZone > 0) {
        const inHousePct = zoneEmployees.length > 0 ? inHouseInZone / zoneEmployees.length : 0;
        if (inHousePct >= 0.7) dominanceMode = 'in_house';
        else if (inHousePct <= 0.3) dominanceMode = 'employee';
        else dominanceMode = 'mixed';
      }

      return {
        zone_id: zone.id,
        name: zone.name,
        city: zone.city,
        total_jobs_today: zoneJobs.length,
        active_jobs: demand,
        completed_jobs: completedJobs.length,
        total_revenue: totalRevenue,
        active_revenue: activeRevenue,
        avg_ticket: zoneJobs.length > 0 ? Math.round(totalRevenue / zoneJobs.length) : 0,
        total_employees: zoneEmployees.length,
        online_employees: onlineInZone,
        assigned_jobs: assignedInZone,
        coverage_status: coverageStatus,
        in_house_employees: inHouseInZone,
        independent_employees: independentInZone,
        in_house_jobs_today: inHouseJobsToday,
        employee_jobs_today: employeeJobsToday,
        dominance_mode: dominanceMode,
        // Jobs preview for zone detail expansion (sorted latest first)
        jobs_preview: zoneJobs.slice(0, 8).map((j) => ({
          id: j.id,
          job_number: j.job_number,
          service_type: j.service_type,
          status: j.status,
          scheduled_date: j.scheduled_date,
          address_line1: j.address_line1,
          price: j.final_price || j.quoted_price || 0,
        })),
      };
    });

    // Compute live metrics for today
    const todayJobsRaw = todayJobsRes?.data || [];
    const todayJobsNonCancelled = todayJobsRaw.filter((j: any) => j.status !== 'cancelled');
    const todayMetrics = {
      todayDate: todayStr,
      jobsToday: todayJobsNonCancelled.length,
      activeToday: todayJobsRaw.filter((j: any) => ACTIVE_STATUSES.includes(j.status)).length,
      completedToday: todayJobsRaw.filter((j: any) => j.status === 'completed').length,
      revenueToday: todayJobsNonCancelled.reduce(
        (sum: number, j: any) => sum + (Number(j.final_price) || Number(j.quoted_price) || 0),
        0
      ),
    };

    // Assignment routing lines
    const liveLocMap = new Map(
      employeeLocations.map((loc) => [loc.employee_id, { lng: loc.longitude, lat: loc.latitude }])
    );
    const hqMap = new Map(employeeHQs.map((hq) => [hq.id, { lng: hq.longitude, lat: hq.latitude }]));

    const assignmentLines = jobs
      .filter(
        (job: any) =>
          ['assigned', 'on_the_way', 'in_progress'].includes(job.status) && job.assigned_employee_id
      )
      .map((job: any) => {
        const cid = job.assigned_employee_id;
        const from = liveLocMap.get(cid) || hqMap.get(cid);
        if (!from || !job.longitude || !job.latitude) return null;
        return {
          job_id: job.id,
          job_status: job.status,
          employee_id: cid,
          from: [from.lng, from.lat],
          to: [job.longitude, job.latitude],
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      jobs,
      employeeLocations,
      zones,
      employeeHQs,
      zoneMetrics,
      todayMetrics,
      assignmentLines,
    });
  } catch (err: unknown) {
    console.error('GET /api/operations/map-data error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
