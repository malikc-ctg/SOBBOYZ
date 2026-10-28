'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import {
  resolvePostLoginDestination,
  STORAGE_KEYS,
} from '@/lib/navigation/workspaces';

function AdminLoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      const explicitRedirect = searchParams.get('redirect');
      if (explicitRedirect && explicitRedirect !== '/sobadmin') {
        window.location.href = explicitRedirect;
        return;
      }

      // Resolve user's role & title from public.profiles for smart workspace routing
      let profile = null;
      if (authData.user?.id) {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, role, title')
          .eq('id', authData.user.id)
          .maybeSingle();
        profile = data;
      }

      const savedWorkspace =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE)
          : null;

      const destination = resolvePostLoginDestination(
        {
          id: authData.user?.id,
          email: authData.user?.email,
          full_name: profile?.full_name || authData.user?.user_metadata?.full_name,
          role: profile?.role,
          title: profile?.title,
        },
        savedWorkspace
      );

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          STORAGE_KEYS.ACTIVE_WORKSPACE,
          destination.workspaceId
        );
      }

      window.location.href = destination.href;
    } catch (err: unknown) {
      console.error('Login error:', err);
      toast.error((err as Error).message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground dark px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center p-2.5 shadow-sm">
            <img
              src="/logo.png"
              alt="Sea of Blue Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-blue-400">
              Sea of Blue Operating System
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
              Sign in to Workspace
            </h1>
          </div>
        </div>

        <Card className="border-border/80 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Operator Credentials
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-semibold">
                  Work Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@seaofblue.app"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password" className="text-xs font-semibold">
                    Password
                  </Label>
                  <Link
                    href="/sobadmin/forgot-password"
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-11 font-semibold gap-2" disabled={loading}>
                {loading ? 'Authenticating...' : 'Enter Workspace'}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background dark" />}>
      <AdminLoginContent />
    </Suspense>
  );
}
