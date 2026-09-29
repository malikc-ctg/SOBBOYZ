'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/sales/supabase';
import MainLayout from '@/components/sales/MainLayout';
import Auth from '@/components/sales/Auth';
import ResetPasswordModal from '@/components/sales/ResetPasswordModal';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@/components/sales/styles/knocklog.css';
import '@/components/sales/mapStyles.css';
import '@/components/sales/team/teamStyles.css';
import '@/components/sales/historyStyles.css';

export default function SalesPortalPage() {
  const [session, setSession] = useState<any>(null);
  const [repName, setRepName] = useState<string>('Malik');
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    // 1. Check existing Supabase session from KnockLog project
    supabase.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        supabase.auth.signOut();
        setSession(null);
        setLoading(false);
        return;
      }
      if (s) {
        setSession(s);
        fetchRepName(s.user.id);
      } else {
        // Fallback default rep for sandbox testing: Malik (07853cdf-ed2c-4f3b-b713-cde7c40e20a1)
        setSession({
          user: {
            id: '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
            email: 'malik@seaofblue.ca'
          }
        });
        setRepName('Malik');
        setLoading(false);
      }
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetModal(true);
        setSession(s);
        setLoading(false);
        return;
      }
      if (s) {
        setSession(s);
        fetchRepName(s.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchRepName(userId: string) {
    try {
      const { data } = await supabase
        .from('reps')
        .select('display_name')
        .eq('user_id', userId)
        .maybeSingle();

      setRepName(data?.display_name || 'Malik');
    } catch (e) {
      setRepName('Malik');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setSession(null);
    setRepName('');
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading KnockLog...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <>
      {showResetModal && (
        <ResetPasswordModal onClose={() => setShowResetModal(false)} />
      )}
      <MainLayout
        user={session.user}
        repName={repName}
        onLogout={handleLogout}
      />
    </>
  );
}
