'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type Lenis from 'lenis';
import 'lenis/dist/lenis.css';

interface LenisContextValue {
  lenis: Lenis | null;
  startScroll: () => void;
  stopScroll: () => void;
}

const LenisContext = createContext<LenisContextValue>({
  lenis: null,
  startScroll: () => {},
  stopScroll: () => {},
});

export function useLenis() {
  return useContext(LenisContext);
}

interface LenisProviderProps {
  children: ReactNode;
  /** If true, scroll starts paused (for preloader/gate) */
  startPaused?: boolean;
}

// Portals that own their own scroll containers — Lenis must NOT intercept these.
// Any pathname starting with one of these prefixes will skip Lenis entirely.
const LENIS_EXCLUDED_PREFIXES = [
  '/sobadmin',
  '/sales',
  '/employee',
  '/reset-password',
];

export function LenisProvider({ children, startPaused = false }: LenisProviderProps) {
  const pathname = usePathname();
  const lenisRef = useRef<Lenis | null>(null);
  const [ready, setReady] = useState(false);

  // Determine whether this route should use Lenis smooth scroll.
  // Portal routes use inner overflow-auto containers, so Lenis should be disabled.
  const shouldUseLenis = !LENIS_EXCLUDED_PREFIXES.some(prefix => pathname.startsWith(prefix));

  useEffect(() => {
    // If this page doesn't need Lenis, destroy any existing instance and bail.
    if (!shouldUseLenis) {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      setReady(true);
      return;
    }

    // Skip on reduced-motion preference
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setReady(true);
      return;
    }

    // Dynamic import to avoid SSR
    import('lenis').then(({ default: LenisClass }) => {
      import('gsap').then(({ default: gsap }) => {
        import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
          gsap.registerPlugin(ScrollTrigger);

          const lenis = new LenisClass({
            duration: 1.2,
            easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            touchMultiplier: 2,
            infinite: false,
          });

          if (startPaused) {
            lenis.stop();
          }

          lenis.on('scroll', ScrollTrigger.update);

          const rafCallback = (time: number) => {
            lenis.raf(time * 1000);
          };
          gsap.ticker.add(rafCallback);
          gsap.ticker.lagSmoothing(0);

          lenisRef.current = lenis;
          setReady(true);

          return () => {
            gsap.ticker.remove(rafCallback);
            lenis.destroy();
            lenisRef.current = null;
          };
        });
      });
    });

    return () => {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
    };
  }, [shouldUseLenis, startPaused]);

  const startScroll = () => { lenisRef.current?.start(); };
  const stopScroll = () => { lenisRef.current?.stop(); };

  return (
    <LenisContext.Provider value={{ lenis: lenisRef.current, startScroll, stopScroll }}>
      {children}
    </LenisContext.Provider>
  );
}
