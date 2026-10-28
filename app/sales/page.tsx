'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SalesRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams?.toString();
    const target = qs ? `/sobadmin/sales?${qs}` : '/sobadmin/sales?app=phone';
    router.replace(target);
  }, [router, searchParams]);

  return (
    <div className="fixed inset-0 flex h-dvh w-screen items-center justify-center bg-[#001326] text-[#fffcf6] font-sans dark">
      <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
    </div>
  );
}

export default function SalesPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex h-dvh w-screen items-center justify-center bg-[#001326] dark" />
      }
    >
      <SalesRedirectInner />
    </Suspense>
  );
}
