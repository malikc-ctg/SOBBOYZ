'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  type OsWallpaperId,
  WALLPAPER_PRESETS,
  clearCustomWallpaperDataUrl,
  compressWallpaperFile,
  loadCustomWallpaperDataUrl,
  saveCustomWallpaperDataUrl,
} from './wallpaperStore';

export type OsThemeMode = 'ocean-dark' | 'obsidian-dark' | 'frosted-light' | 'system';
export type ResolvedOsTheme = 'ocean-dark' | 'obsidian-dark' | 'frosted-light';
export type OsAccentId = 'blue' | 'indigo' | 'cyan' | 'emerald' | 'amber';

export interface OsAppearanceSettings {
  mode: OsThemeMode;
  cardOpacity: number;        // 25..100 (%)
  frostBlur: number;          // 0..32 (px)
  wallpaperId: OsWallpaperId;
  wallpaperIntensity: number; // 10..55 (%) — mapped safely to adaptive scrim
  ambientGlow: boolean;
  accent: OsAccentId;
}

export const DEFAULT_APPEARANCE: OsAppearanceSettings = {
  mode: 'ocean-dark',
  cardOpacity: 74,
  frostBlur: 18,
  wallpaperId: 'none',
  wallpaperIntensity: 26,
  ambientGlow: true,
  accent: 'blue',
};

export const GLASS_MATERIAL_PRESETS = [
  { id: 'crystal', label: 'Crystal', cardOpacity: 40, frostBlur: 24 },
  { id: 'frosted', label: 'Frosted', cardOpacity: 74, frostBlur: 18 },
  { id: 'smoked', label: 'Smoked', cardOpacity: 88, frostBlur: 14 },
  { id: 'solid', label: 'Solid', cardOpacity: 100, frostBlur: 0 },
] as const;

export const ACCENT_SWATCHES: Array<{
  id: OsAccentId;
  label: string;
  swatchHex: string;
}> = [
  { id: 'blue', label: 'Sea Blue', swatchHex: '#2563eb' },
  { id: 'indigo', label: 'Indigo', swatchHex: '#6366f1' },
  { id: 'cyan', label: 'Cyan Ice', swatchHex: '#06b6d4' },
  { id: 'emerald', label: 'Emerald', swatchHex: '#10b981' },
  { id: 'amber', label: 'Amber', swatchHex: '#f59e0b' },
];

const STORAGE_KEY = 'sob_os_appearance_v1';

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function sanitizeSettings(raw: Partial<OsAppearanceSettings> | null): OsAppearanceSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_APPEARANCE;
  const validModes: OsThemeMode[] = ['ocean-dark', 'obsidian-dark', 'frosted-light', 'system'];
  const validAccents: OsAccentId[] = ['blue', 'indigo', 'cyan', 'emerald', 'amber'];
  const validWallpapers: OsWallpaperId[] = [
    'none',
    'ocean-silk',
    'toronto-dusk',
    'arctic-mist',
    'aurora-glass',
    'custom',
  ];

  return {
    mode: validModes.includes(raw.mode as OsThemeMode)
      ? (raw.mode as OsThemeMode)
      : DEFAULT_APPEARANCE.mode,
    cardOpacity:
      typeof raw.cardOpacity === 'number'
        ? clamp(Math.round(raw.cardOpacity), 25, 100)
        : DEFAULT_APPEARANCE.cardOpacity,
    frostBlur:
      typeof raw.frostBlur === 'number'
        ? clamp(Math.round(raw.frostBlur), 0, 32)
        : DEFAULT_APPEARANCE.frostBlur,
    wallpaperId: validWallpapers.includes(raw.wallpaperId as OsWallpaperId)
      ? (raw.wallpaperId as OsWallpaperId)
      : DEFAULT_APPEARANCE.wallpaperId,
    wallpaperIntensity:
      typeof raw.wallpaperIntensity === 'number'
        ? clamp(Math.round(raw.wallpaperIntensity), 10, 55)
        : DEFAULT_APPEARANCE.wallpaperIntensity,
    ambientGlow:
      typeof raw.ambientGlow === 'boolean' ? raw.ambientGlow : DEFAULT_APPEARANCE.ambientGlow,
    accent: validAccents.includes(raw.accent as OsAccentId)
      ? (raw.accent as OsAccentId)
      : DEFAULT_APPEARANCE.accent,
  };
}

/**
 * Writes continuous CSS variables directly onto <html> so dragging sliders
 * updates glass opacity, frost blur, and wallpaper scrim at 60fps without lag.
 */
export function writeOsCssVariables(
  el: HTMLElement,
  vals: Pick<OsAppearanceSettings, 'cardOpacity' | 'frostBlur' | 'wallpaperIntensity'>,
  resolvedTheme: ResolvedOsTheme
) {
  const opacity = clamp(vals.cardOpacity, 25, 100);
  const blur = clamp(vals.frostBlur, 0, 32);
  const intensity = clamp(vals.wallpaperIntensity, 10, 55);

  const cardAlpha = opacity / 100;
  // Popovers, dropdowns & inputs keep a slightly higher legibility floor
  const elevatedAlpha = Math.min(1, (opacity + 14) / 100);
  // Top & bottom OS dock bars stay anchored
  const dockAlpha = Math.min(0.96, Math.max(0.62, (opacity + 12) / 100));
  // Effective blur disables GPU filter when 100% solid and blur is 0
  const effectiveBlur = opacity === 100 && blur === 0 ? 0 : blur;
  const saturate = effectiveBlur > 0 ? Math.round(115 + (effectiveBlur / 32) * 55) : 100;

  // Map Backdrop Intensity (10..55) into a protective atmospheric scrim alpha:
  // Even at max 55%, at least ~46-52% adaptive theme veil shields foreground text.
  const normIntensity = (intensity - 10) / 45; // 0..1
  const isLight = resolvedTheme === 'frosted-light';
  const scrimAlpha = isLight
    ? 0.93 - normIntensity * 0.39 // 0.93 (very subtle) -> 0.54 (vivid but crisp)
    : 0.91 - normIntensity * 0.43; // 0.91 (very subtle) -> 0.48 (vivid but crisp)

  el.style.setProperty('--os-card-alpha', cardAlpha.toFixed(3));
  el.style.setProperty('--os-elevated-alpha', elevatedAlpha.toFixed(3));
  el.style.setProperty('--os-dock-alpha', dockAlpha.toFixed(3));
  el.style.setProperty('--os-blur', `${effectiveBlur}px`);
  el.style.setProperty('--os-saturate', `${saturate}%`);
  el.style.setProperty('--os-wallpaper-scrim', scrimAlpha.toFixed(3));
}

interface AppearanceContextValue {
  settings: OsAppearanceSettings;
  resolvedTheme: ResolvedOsTheme;
  isLight: boolean;
  customWallpaperUrl: string | null;
  activeWallpaperUrl: string | null;
  isUploadingWallpaper: boolean;
  updateSettings: (patch: Partial<OsAppearanceSettings>) => void;
  previewContinuous: (
    patch: Partial<Pick<OsAppearanceSettings, 'cardOpacity' | 'frostBlur' | 'wallpaperIntensity'>>
  ) => void;
  uploadWallpaperFile: (file: File) => Promise<void>;
  removeCustomWallpaper: () => Promise<void>;
  resetDefaults: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isOsRoute = Boolean(
    pathname?.startsWith('/sobadmin') || pathname?.startsWith('/sales')
  );

  const [settings, setSettings] = useState<OsAppearanceSettings>(DEFAULT_APPEARANCE);
  const [systemPrefersDark, setSystemPrefersDark] = useState(true);
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(null);
  const [isUploadingWallpaper, setIsUploadingWallpaper] = useState(false);
  const hydratedRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Hydrate stored preferences & custom wallpaper from IndexedDB on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSettings(sanitizeSettings(JSON.parse(raw)));
      }
    } catch {
      // Ignore storage read errors
    }
    hydratedRef.current = true;

    loadCustomWallpaperDataUrl().then((dataUrl) => {
      if (dataUrl) setCustomWallpaperUrl(dataUrl);
    });

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      setSystemPrefersDark(mq.matches);
      const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  const resolvedTheme: ResolvedOsTheme = useMemo(() => {
    if (settings.mode === 'system') {
      return systemPrefersDark ? 'ocean-dark' : 'frosted-light';
    }
    return settings.mode;
  }, [settings.mode, systemPrefersDark]);

  const activeWallpaperUrl = useMemo(() => {
    if (settings.wallpaperId === 'none') return null;
    if (settings.wallpaperId === 'custom') return customWallpaperUrl;
    const preset = WALLPAPER_PRESETS.find((p) => p.id === settings.wallpaperId);
    return preset?.imageUrl || null;
  }, [settings.wallpaperId, customWallpaperUrl]);

  // Apply data attributes, .dark class, and CSS variables on <html> whenever active on OS routes
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement;

    if (!isOsRoute) {
      html.removeAttribute('data-os-active');
      html.removeAttribute('data-os-theme');
      html.removeAttribute('data-os-accent');
      html.removeAttribute('data-os-ambient');
      html.removeAttribute('data-os-wallpaper');
      html.classList.remove('dark');
      return;
    }

    html.setAttribute('data-os-active', 'true');
    html.setAttribute('data-os-theme', resolvedTheme);
    html.setAttribute('data-os-accent', settings.accent);
    html.setAttribute('data-os-ambient', settings.ambientGlow ? 'on' : 'off');
    html.setAttribute('data-os-wallpaper', activeWallpaperUrl ? 'active' : 'none');

    if (resolvedTheme === 'frosted-light') {
      html.classList.remove('dark');
    } else {
      html.classList.add('dark');
    }

    writeOsCssVariables(html, settings, resolvedTheme);
  }, [isOsRoute, resolvedTheme, settings, activeWallpaperUrl]);

  const updateSettings = useCallback((patch: Partial<OsAppearanceSettings>) => {
    setSettings((prev) => {
      const next = sanitizeSettings({ ...prev, ...patch });
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  const previewContinuous = useCallback(
    (
      patch: Partial<
        Pick<OsAppearanceSettings, 'cardOpacity' | 'frostBlur' | 'wallpaperIntensity'>
      >
    ) => {
      if (typeof document === 'undefined') return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        writeOsCssVariables(
          document.documentElement,
          {
            cardOpacity: patch.cardOpacity ?? settings.cardOpacity,
            frostBlur: patch.frostBlur ?? settings.frostBlur,
            wallpaperIntensity: patch.wallpaperIntensity ?? settings.wallpaperIntensity,
          },
          resolvedTheme
        );
      });
    },
    [settings.cardOpacity, settings.frostBlur, settings.wallpaperIntensity, resolvedTheme]
  );

  const uploadWallpaperFile = useCallback(
    async (file: File) => {
      setIsUploadingWallpaper(true);
      try {
        const compressedDataUrl = await compressWallpaperFile(file);
        await saveCustomWallpaperDataUrl(compressedDataUrl);
        setCustomWallpaperUrl(compressedDataUrl);
        updateSettings({ wallpaperId: 'custom' });
      } finally {
        setIsUploadingWallpaper(false);
      }
    },
    [updateSettings]
  );

  const removeCustomWallpaper = useCallback(async () => {
    await clearCustomWallpaperDataUrl();
    setCustomWallpaperUrl(null);
    setSettings((prev) => {
      const next: OsAppearanceSettings = {
        ...prev,
        wallpaperId: prev.wallpaperId === 'custom' ? 'none' : prev.wallpaperId,
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const resetDefaults = useCallback(() => {
    setSettings(DEFAULT_APPEARANCE);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_APPEARANCE));
    } catch {
      // Ignore
    }
  }, []);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      settings,
      resolvedTheme,
      isLight: resolvedTheme === 'frosted-light',
      customWallpaperUrl,
      activeWallpaperUrl,
      isUploadingWallpaper,
      updateSettings,
      previewContinuous,
      uploadWallpaperFile,
      removeCustomWallpaper,
      resetDefaults,
    }),
    [
      settings,
      resolvedTheme,
      customWallpaperUrl,
      activeWallpaperUrl,
      isUploadingWallpaper,
      updateSettings,
      previewContinuous,
      uploadWallpaperFile,
      removeCustomWallpaper,
      resetDefaults,
    ]
  );

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useOsAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext);
  if (!ctx) {
    throw new Error('useOsAppearance must be used inside AppearanceProvider');
  }
  return ctx;
}
