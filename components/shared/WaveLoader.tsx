'use client';
/**
 * WaveLoader — Sea of Blue page-load animation
 * ------------------------------------------------------------------
 * Self-contained React component. No dependencies beyond React.
 * The brand wave mark fills in horizontally, a wordmark rises, then
 * the splash lifts to reveal whatever you wrap.
 *
 * Usage:
 *   import WaveLoader from './WaveLoader';
 *   export default function App() {
 *     return <WaveLoader><YourApp /></WaveLoader>;
 *   }
 *
 * Play only once per browser session:
 *   <WaveLoader sessionKey="sob-splash"><YourApp /></WaveLoader>
 *
 * The filling wave alone is exported as <WaveMark/>.
 */
import React, { useEffect, useRef, useState, useId } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/* Wave silhouette traced from the Sea of Blue logo mark (viewBox 1000×181). */
const WAVE_PATH =
  'M 0 108.21 C 4.6 109.9 19.5 115.5 27.8 118.52 C 36.1 121.5 41.7 124.0 50 126.25 C 58.3 128.5 69.5 130.9 77.8 132.05 C 86.1 133.2 91.7 133.4 100 133.33 C 108.3 133.2 119.5 132.5 127.8 131.4 C 136.1 130.3 142.6 128.9 150 126.89 C 157.4 124.8 163.9 123.0 172.2 119.16 C 180.5 115.3 190.7 109.7 200 103.7 C 209.3 97.7 219.5 89.3 227.8 83.09 C 236.1 76.9 241.7 71.8 250 66.35 C 258.3 60.9 269.5 54.2 277.8 50.24 C 286.1 46.3 291.7 44.0 300 42.51 C 308.3 41.0 319.5 40.9 327.8 41.22 C 336.1 41.5 341.7 42.5 350 44.44 C 358.3 46.4 369.5 50.0 377.8 52.82 C 386.1 55.6 391.7 58.0 400 61.19 C 408.3 64.4 419.5 69.1 427.8 72.14 C 436.1 75.1 441.7 77.2 450 79.23 C 458.3 81.3 469.5 83.7 477.8 84.38 C 486.1 85.0 491.7 84.9 500 83.09 C 508.3 81.3 519.5 77.3 527.8 73.43 C 536.1 69.6 542.6 65.2 550 59.9 C 557.4 54.6 563.9 48.3 572.2 41.87 C 580.5 35.4 590.7 26.8 600 21.26 C 609.3 15.7 619.5 11.1 627.8 8.37 C 636.1 5.7 641.7 5.2 650 5.15 C 658.3 5.2 669.5 6.7 677.8 8.37 C 686.1 10.1 691.7 12.3 700 15.46 C 708.3 18.6 719.5 23.4 727.8 27.05 C 736.1 30.7 741.7 33.5 750 37.36 C 758.3 41.2 769.5 46.5 777.8 50.24 C 786.1 54.0 791.7 56.7 800 59.9 C 808.3 63.1 819.5 67.1 827.8 69.57 C 836.1 72.0 841.7 73.3 850 74.72 C 858.3 76.1 869.5 77.5 877.8 77.94 C 886.1 78.4 891.7 78.4 900 77.3 C 908.3 76.2 919.5 74.3 927.8 71.5 C 936.1 68.7 941.7 66.7 950 60.55 C 958.3 54.4 969.5 44.5 977.8 34.78 C 986.1 25.0 996.3 7.4 1000 1.93 L 1000 181 L 0 181 Z';

const STYLE_ID = 'sob-waveloader-styles';
const CSS = `
.sob-wl{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:28px;
  transition:transform 1.05s cubic-bezier(.76,0,.24,1),opacity .55s ease .4s;
  will-change:transform,opacity}
.sob-wl[data-lifting="true"]{transform:translateY(-10px);opacity:0;pointer-events:none}
.sob-wl__mark{display:block;width:min(30vw,120px);height:auto;overflow:visible}
.sob-wl__fill{transform:scaleX(0);transform-box:fill-box;transform-origin:left center;
  transition: transform 0.3s ease-out;}
.sob-wl__shine{opacity:0;transform:translateX(-260px);transform-box:fill-box;
  animation:sob-wl-shine 1.15s ease 1.55s forwards}
.sob-wl__rule{position:relative;width:min(30vw,120px);height:2px;border-radius:2px;overflow:hidden}
.sob-wl__rulefill{position:absolute;inset:0;transform-origin:left;transform:scaleX(0);
  transition: transform 0.3s ease-out;}
.sob-wl__word{opacity:0;transform:translateY(8px);
  animation:sob-wl-rise .7s ease 0.5s forwards;letter-spacing:-.01em}
@keyframes sob-wl-rise{to{opacity:1;transform:none}}
@keyframes sob-wl-shine{0%{opacity:0;transform:translateX(-260px)}18%{opacity:1}
  100%{opacity:0;transform:translateX(1100px)}}
@media (prefers-reduced-motion:reduce){
  .sob-wl__fill,.sob-wl__rulefill{transition-duration:.01ms}
  .sob-wl__shine{display:none}
  .sob-wl{transition-duration:.01ms}}
`;

function useInjectedStyles() {
  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);
}

/** The brand wave mark that fills in horizontally. */
export function WaveMark({
  fill = '#3c6ca8',
  track = '#e6eef6',
  progress = 0, // 0 to 1
  shimmer = true,
  style,
  ...rest
}: any) {
  useInjectedStyles();
  const rawId = useId();
  const clipId = `sobwl-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const gradId = `${clipId}-g`;
  return (
    <svg
      className="sob-wl__mark"
      viewBox="0 0 1000 181"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Sea of Blue"
      style={style}
      {...rest}
    >
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d={WAVE_PATH} />
        </clipPath>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={WAVE_PATH} fill={track} />
      <g clipPath={`url(#${clipId})`}>
        <rect 
          className="sob-wl__fill" 
          x="0" 
          y="0" 
          width="1000" 
          height="181" 
          fill={fill} 
          style={{ transform: `scaleX(${progress})` }}
        />
        {shimmer && progress >= 1 && (
          <rect className="sob-wl__shine" x="0" y="0" width="220" height="181" fill={`url(#${gradId})`} />
        )}
      </g>
    </svg>
  );
}

/**
 * Full page-load splash. 
 * Modified to hook into Next.js navigation events to simulate actual page loading.
 */
export default function WaveLoader({
  children,
  background = 'transparent', // Default to transparent now
  fill = '#3c6ca8',
  track = '#e6eef6',
  wordmark = '',
  wordmarkColor = '#002c58',
  wordmarkFont = "var(--font-rustic), Georgia, serif",
}: any) {
  useInjectedStyles();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (pathname?.startsWith('/sales')) return children;

  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [lifting, setLifting] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Handle route changes
  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
      return;
    }
    // Reset state for new page load
    setIsLoading(true);
    setLifting(false);
    setProgress(0);
  }, [pathname, searchParams]);

  // Simulate progress based on actual loading state
  useEffect(() => {
    if (!isLoading) return;

    // Quick jump to 30%
    setProgress(0.3);
    
    // Increment slowly up to 90% while "loading"
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 0.9) return prev;
        return prev + Math.random() * 0.1;
      });
    }, 200);

    // If the document is fully loaded (initial load) or we just started a route change
    // We can simulate finishing after a short minimum delay to show the animation
    const finishTimeout = setTimeout(() => {
      setProgress(1);
      setTimeout(() => {
        setLifting(true);
        setTimeout(() => {
          setIsLoading(false);
        }, 500); // Wait for fade out animation
      }, 300); // Give it a moment at 100%
    }, 500); // Minimum time to show the loader so it's not a glitchy flash

    return () => {
      clearInterval(interval);
      clearTimeout(finishTimeout);
    };
  }, [isLoading]);

  const isCustomerSite = pathname?.startsWith('/customer-site') || pathname === '/';

  return (
    <>
      {children}
      {isLoading && !isCustomerSite && (
        <div className="sob-wl" data-lifting={lifting} style={{ background }}>
          <WaveMark fill={fill} track={track} progress={progress} />
          <div className="sob-wl__rule" style={{ background: track }}>
            <span 
              className="sob-wl__rulefill" 
              style={{ background: fill, opacity: 0.55, transform: `scaleX(${progress})` }} 
            />
          </div>
          {wordmark && (
            <div className="sob-wl__word"
              style={{ fontFamily: wordmarkFont, color: wordmarkColor,
                fontSize: 'clamp(18px,2vw,24px)' }}>
              {wordmark}
            </div>
          )}
        </div>
      )}
    </>
  );
}
