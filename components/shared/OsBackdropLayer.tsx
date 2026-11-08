'use client';

import React from 'react';
import { useOsAppearance } from '@/lib/theme/AppearanceProvider';

/**
 * Fixed 3-Layer Atmospheric Scrim & Ambient Glow Backdrop for Sea of Blue OS.
 * Ensures any preset or custom uploaded picture stays calm, refined, and legible
 * behind adjustable frosted glass surfaces.
 */
export function OsBackdropLayer() {
  const { settings, activeWallpaperUrl } = useOsAppearance();

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none bg-background transition-colors duration-300"
    >
      {/* Layer 1: Optional Curated or Custom Uploaded Picture */}
      {activeWallpaperUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-[1.02] transition-opacity duration-300 will-change-transform"
          style={{
            backgroundImage: `url("${activeWallpaperUrl}")`,
            filter: 'blur(2px) saturate(1.05)',
          }}
        />
      )}

      {/* Layer 2: Adaptive Theme Contrast Scrim + Soft Edge Vignette */}
      {activeWallpaperUrl && (
        <div
          className="os-wallpaper-veil absolute inset-0 transition-colors duration-200"
        />
      )}

      {/* Layer 3: Subtle Ambient Accent Light Blooms (gives glass cards depth even without a photo) */}
      {settings.ambientGlow && (
        <div className="os-ambient-blooms absolute inset-0" />
      )}
    </div>
  );
}
