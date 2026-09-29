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
  const [session, setSession] = useState<any>({
    user: {
      id: '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
      email: 'malik@seaofblue.ca'
    }
  });
  const [repName, setRepName] = useState<string>('Malik');
  const [loading, setLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  useEffect(() => {
    try {
      supabase.auth.getSession().then(({ data, error }) => {
        if (!error && data?.session) {
          setSession(data.session);
          fetchRepName(data.session.user.id);
        }
      }).catch(() => {});

      const { data } = supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'PASSWORD_RECOVERY') {
          setShowResetModal(true);
        }
        if (s) {
          setSession(s);
          fetchRepName(s.user.id);
        }
      });

      return () => data?.subscription?.unsubscribe();
    } catch (e) {
      // In sandbox mode fallback session is already active
    }
  }, []);

  async function fetchRepName(userId: string) {
    try {
      const { data } = await supabase
        .from('reps')
        .select('display_name')
        .eq('user_id', userId)
        .maybeSingle();

      if (data?.display_name) {
        setRepName(data.display_name);
      }
    } catch (e) {
      setRepName('Malik');
    }
  }

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    setSession(null);
    setRepName('');
  }

  if (loading) {
    return (
      <div style={{ background: '#0a0a14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8888a0' }}>
        <p>Loading KnockLog...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ background: '#0a0a14', minHeight: '100vh' }}>
        <Auth />
      </div>
    );
  }

  return (
    <div style={{ background: '#0a0a14', minHeight: '100vh', color: '#f0f0f5', width: '100%' }}>
      {showResetModal && (
        <ResetPasswordModal onClose={() => setShowResetModal(false)} />
      )}
      <MainLayout
        user={session.user}
        repName={repName}
        onLogout={handleLogout}
      />
    </div>
  );
}
