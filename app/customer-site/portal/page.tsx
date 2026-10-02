import { Calendar, ChevronRight, MapPin, Plus, ShieldCheck, FileText, Clock, Star, User } from 'lucide-react';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SERVICE_TYPE_LABELS, TIME_WINDOW_LABELS } from '@/types';
import { LiveJobTracker } from '@/components/customer/LiveJobTracker';
import { HomeProfileWidget } from '@/components/customer/HomeProfileWidget';
import { ReferralWidget } from '@/components/customer/ReferralWidget';
import { MyCleanerWidget } from '@/components/customer/MyCleanerWidget';

export default async function CustomerPortalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/customer-site/login');
  }

  let { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('profile_id', user.id)
    .single();

  // Leads and unlinked customer records are matched by email, so only trust a verified email
  const verifiedEmail = user.email && user.email_confirmed_at ? user.email : null;
  const serviceClient = await createServiceClient();

  if (!customer && verifiedEmail) {
    // Link a customer record created for this email before the account existed (e.g. by an admin)
    const { data: unlinkedCustomer } = await serviceClient
      .from('customers')
      .select('id')
      .eq('email', verifiedEmail)
      .is('profile_id', null)
      .maybeSingle();

    if (unlinkedCustomer) {
      const { data: linkedCustomer } = await serviceClient
        .from('customers')
        .update({ profile_id: user.id })
        .eq('id', unlinkedCustomer.id)
        .is('profile_id', null)
        .select()
        .single();
      if (linkedCustomer) customer = linkedCustomer;
    }
  }

  if (!customer) {
    // Check if they have a lead we can pull from
    const { data: lead } = verifiedEmail
      ? await serviceClient
          .from('leads')
          .select('*')
          .eq('customer_email', verifiedEmail)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    // Auto-create customer using service client to bypass RLS
    
    // Ensure profile exists first (trigger might have failed)
    await serviceClient.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: lead?.customer_name || 'Valued Customer',
      phone: lead?.customer_phone || '555-555-5555',
      role: 'customer'
    }, { onConflict: 'id', ignoreDuplicates: true });
    
    const { data: newCustomer, error } = await serviceClient
      .from('customers')
      .insert({
        profile_id: user.id,
        email: user.email,
        full_name: lead?.customer_name || 'Valued Customer',
        phone: lead?.customer_phone || '555-555-5555',
        address_line1: lead?.city || '',
        notes: JSON.stringify({ is_onboarded: true }),
        is_active: true
      })
      .select()
      .single();
      
    if (newCustomer) {
      customer = newCustomer;
    }
    // We intentionally removed the redirect to onboarding here.
  }

  const { data: upcomingJobs } = await supabase
    .from('jobs')
    .select('*, employee:employees(*)')
    .eq('customer_id', customer?.id || '00000000-0000-0000-0000-000000000000')
    .in('status', ['confirmed', 'offered', 'accepted', 'assigned', 'on_the_way', 'in_progress'])
    .order('scheduled_date', { ascending: true })
    .limit(1);

  const { data: pendingJobs } = await supabase
    .from('jobs')
    .select('*, employee:employees(*)')
    .eq('customer_id', customer?.id || '00000000-0000-0000-0000-000000000000')
    .in('status', ['lead_received', 'quoted', 'deposit_paid'])
    .order('created_at', { ascending: false });

  const { data: pendingLeads } = verifiedEmail
    ? await serviceClient
        .from('leads')
        .select('*')
        .eq('customer_email', verifiedEmail)
        .not('status', 'in', '("converted","lost")')
        .order('created_at', { ascending: false })
    : { data: [] as any[] };

  const pendingItems = [
    ...(pendingJobs || []).map((j: any) => ({
      id: `job-${j.id}`,
      type: 'job',
      status: j.status,
      service_type: j.service_type,
      date: j.scheduled_date,
      quoted_price: j.quoted_price,
      raw: j
    })),
    ...(pendingLeads || []).map((l: any) => ({
      id: `lead-${l.id}`,
      type: 'lead',
      status: l.status === 'new' ? 'pending_review' : l.status,
      service_type: l.service_type,
      date: l.preferred_date,
      quoted_price: l.quoted_price,
      raw: l
    }))
  ].sort((a, b) => new Date(b.raw.created_at).getTime() - new Date(a.raw.created_at).getTime());

  const { data: pastJobs } = await supabase
    .from('jobs')
    .select('*, employee:employees(*)')
    .eq('customer_id', customer?.id || '00000000-0000-0000-0000-000000000000')
    .in('status', ['completed', 'cancelled'])
    .order('scheduled_date', { ascending: false })
    .limit(5);

  const nextJob = upcomingJobs?.[0];
  const isLive = nextJob && ['on_the_way', 'in_progress'].includes(nextJob.status);

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-64px)] py-12">
      <div className="container max-w-6xl mx-auto px-6">
        
        {/* Welcome & Quick Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome back, {customer?.full_name?.split(' ')[0] || 'Valued Customer'}</h1>
            <p className="text-slate-500">{customer?.address_line1 || 'No Address Provided'} {customer?.city ? `, ${customer.city}` : ''} • Customer Dashboard</p>
          </div>
          <div className="flex gap-3">
            <Link href="/customer-site/portal/billing">
              <button className="bg-white text-[#001a36] border border-slate-200 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" /> My Invoices
              </button>
            </Link>
            <Link href="/customer-site/portal/quote">
              <button className="bg-[#001a36] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#022850] transition-colors shadow-sm text-sm flex items-center gap-2">
                <Plus className="h-4 w-4" /> Request Quote
              </button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Pool Health & Live Tracking */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Next / Live Service Block */}
            {nextJob && (
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden mb-8">
                {isLive ? (
                  <div className="bg-[#001a36] p-6 text-white relative flex flex-col lg:flex-row items-center justify-between gap-6">
                    {/* Subtle background graphic */}
                    <div className="absolute right-0 top-0 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start lg:items-center gap-6 w-full text-center sm:text-left">
                      <div className="h-20 w-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0 shadow-inner overflow-hidden border-2 border-white/20">
                        {nextJob.employee?.avatar_url ? (
                          <img src={nextJob.employee.avatar_url} alt={nextJob.employee.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-10 w-10" />
                        )}
                      </div>
                      <div>
                        <div className="inline-flex items-center gap-2 px-2 py-1 rounded bg-blue-500/20 text-blue-200 text-xs font-bold uppercase tracking-wider mb-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
                          </span>
                          Live Service
                        </div>
                        <h2 className="text-2xl font-bold mb-1">Your technician is en route</h2>
                        <p className="text-blue-100/70">
                          {nextJob.employee?.full_name ? `${nextJob.employee.full_name} is arriving around ` : 'Estimated arrival: '} 
                          {new Date(nextJob.scheduled_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                      </div>
                    </div>
                    
                    <button className="bg-white text-[#001a36] px-6 py-3 rounded-xl font-semibold w-full lg:w-auto relative z-10 flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors shrink-0 shadow-sm">
                      <MapPin className="h-4 w-4" />
                      Track Live
                    </button>
                  </div>
                ) : (
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900">Next Scheduled Service</h3>
                  </div>
                )}
                <div className={isLive ? "border-t border-slate-100" : ""}>
                  <LiveJobTracker initialJob={nextJob} />
                </div>
              </div>
            )}

            {/* Active Quotes & Pending Actions */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Pending Actions & Quotes</h3>
              {pendingItems && pendingItems.length > 0 ? (
                <div className="space-y-4">
                  {pendingItems.map((item: any) => (
                    <div key={item.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize ${item.status === 'pending_review' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                            {item.status.replace('_', ' ')}
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {SERVICE_TYPE_LABELS[item.service_type as keyof typeof SERVICE_TYPE_LABELS] || item.service_type}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          Requested for {new Date(item.date).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="text-right flex-1 md:flex-none">
                          <div className="text-sm text-slate-500">Quoted Price</div>
                          <div className="text-xl font-bold text-slate-900">${item.quoted_price || '0'}</div>
                        </div>
                        <button 
                          disabled={item.status === 'pending_review'}
                          className="bg-[#001a36] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#022850] transition-colors shadow-sm text-sm whitespace-nowrap disabled:opacity-50"
                        >
                          {item.status === 'quoted' ? 'Review Quote' : item.status === 'pending_review' ? 'Under Review' : 'Pay Deposit'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center">
                  <div className="h-12 w-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">All caught up!</h3>
                  <p className="text-sm text-slate-500">You have no pending quotes or actions required.</p>
                </div>
              )}
            </div>

            {/* Service Timeline / Logbook */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-4">Service Timeline</h3>
              <div className="space-y-4">
                {pastJobs && pastJobs.length > 0 ? pastJobs.map((job: any, idx: number) => (
                  <div key={job.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex gap-6 relative">
                    <div className="hidden sm:flex flex-col items-center">
                      <div className={`h-10 w-10 ${idx === 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'} rounded-full flex items-center justify-center shrink-0 border-4 border-white z-10`}>
                        {idx === 0 ? <ShieldCheck className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                      </div>
                      {idx !== pastJobs.length - 1 && (
                        <div className="w-0.5 bg-slate-100 h-full absolute top-10 bottom-0 left-11" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-bold text-slate-900">{SERVICE_TYPE_LABELS[job.service_type as keyof typeof SERVICE_TYPE_LABELS] || job.service_type}</h4>
                          <p className="text-sm text-slate-500">
                            {job.status === 'completed' ? 'Completed' : 'Cancelled'} 
                            {job.employee?.full_name ? ` by ${job.employee.full_name}` : ''} on {new Date(job.scheduled_date).toLocaleDateString()} at {new Date(job.scheduled_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                        <span className={`${job.status === 'completed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'} px-2.5 py-1 rounded-md text-xs font-semibold capitalize`}>
                          {job.status}
                        </span>
                      </div>
                      {job.notes && (
                        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                          {job.notes}
                        </p>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-slate-500 text-sm italic">No past services found.</div>
                )}
              </div>
              <button className="w-full mt-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
                View All History
              </button>
            </div>
            
          </div>
          
          {/* Right Column: Quick Stats & Support */}
          <div className="space-y-6">
            
            {/* Removed LiveJobTracker from here */}

            {(nextJob?.employee || pastJobs?.[0]?.employee) && (
              <MyCleanerWidget employee={nextJob?.employee || pastJobs?.[0]?.employee} />
            )}

            <HomeProfileWidget customer={customer} />

            <ReferralWidget customerId={customer.id} />

            <div className="bg-blue-50 rounded-2xl border border-blue-100 p-5">
              <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                <Star className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-blue-900 mb-1">Need something else?</h3>
              <p className="text-sm text-blue-800/70 mb-4">Our concierge team is available 7 days a week to handle any special requests or emergency repairs.</p>
              <button className="w-full bg-white text-blue-600 border border-blue-200 px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors shadow-sm text-sm">
                Message Support
              </button>
            </div>

          </div>
        </div>
        
      </div>
    </div>
  );
}
