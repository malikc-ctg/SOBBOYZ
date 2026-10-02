'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Waves } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { safeRedirectPath } from '@/lib/utils';
import { toast } from 'sonner';
import { Suspense } from 'react';

function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const redirect = safeRedirectPath(searchParams.get('redirect'), '/sobadmin');
      window.location.href = redirect;
    } catch (err: unknown) {
      console.error('Login error:', err);
      toast.error((err as Error).message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground dark px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-4">
          <img src="/logo.png" alt="Sea of Blue Logo" className="mx-auto w-80 h-80 object-contain" />
          <CardTitle className="text-xl">Sea of Blue</CardTitle>
          <p className="text-sm text-muted-foreground">Admin Portal Login</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12"
                autoComplete="email"
                required
              />
            </div>
            <div>
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <Link href="/sobadmin/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12"
                autoComplete="current-password"
                required
              />
            </div>
            <Button type="submit" className="w-full h-12" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AdminLoginContent />
    </Suspense>
  );
}
