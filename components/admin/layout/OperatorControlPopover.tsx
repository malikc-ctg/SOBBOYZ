'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ImagePlus,
  LogOut,
  Monitor,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  Trash2,
  Waves,
} from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import {
  ACCENT_SWATCHES,
  DEFAULT_APPEARANCE,
  GLASS_MATERIAL_PRESETS,
  type OsThemeMode,
  useOsAppearance,
} from '@/lib/theme/AppearanceProvider';
import { WALLPAPER_PRESETS } from '@/lib/theme/wallpaperStore';

interface OperatorIdentity {
  name: string;
  title?: string | null;
  email?: string | null;
}

interface OperatorControlPopoverProps {
  operator: OperatorIdentity;
  onLogout?: () => void;
  showTitleBreakpoint?: 'xl' | '2xl';
  className?: string;
}

const THEME_MODES: Array<{
  id: OsThemeMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'ocean-dark', label: 'Ocean', icon: Waves },
  { id: 'obsidian-dark', label: 'Obsidian', icon: Moon },
  { id: 'frosted-light', label: 'Light', icon: Sun },
  { id: 'system', label: 'Auto', icon: Monitor },
];

export function AppearanceControlsPanel({
  onLogout,
  operator,
  compact = false,
}: {
  operator?: OperatorIdentity;
  onLogout?: () => void;
  compact?: boolean;
}) {
  const {
    settings,
    customWallpaperUrl,
    isUploadingWallpaper,
    updateSettings,
    previewContinuous,
    uploadWallpaperFile,
    removeCustomWallpaper,
    resetDefaults,
  } = useOsAppearance();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Local slider mirrors for ultra-smooth 60fps thumb tracking
  const [opacityVal, setOpacityVal] = useState(settings.cardOpacity);
  const [blurVal, setBlurVal] = useState(settings.frostBlur);
  const [intensityVal, setIntensityVal] = useState(settings.wallpaperIntensity);

  useEffect(() => {
    setOpacityVal(settings.cardOpacity);
  }, [settings.cardOpacity]);

  useEffect(() => {
    setBlurVal(settings.frostBlur);
  }, [settings.frostBlur]);

  useEffect(() => {
    setIntensityVal(settings.wallpaperIntensity);
  }, [settings.wallpaperIntensity]);

  const isModified =
    settings.mode !== DEFAULT_APPEARANCE.mode ||
    settings.cardOpacity !== DEFAULT_APPEARANCE.cardOpacity ||
    settings.frostBlur !== DEFAULT_APPEARANCE.frostBlur ||
    settings.wallpaperId !== DEFAULT_APPEARANCE.wallpaperId ||
    settings.ambientGlow !== DEFAULT_APPEARANCE.ambientGlow ||
    settings.accent !== DEFAULT_APPEARANCE.accent;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file (JPG, PNG, WebP).');
      return;
    }
    try {
      await uploadWallpaperFile(file);
      toast.success('Atmospheric backdrop updated');
    } catch {
      toast.error('Could not process that image');
    }
  };

  return (
    <div className="space-y-4 text-popover-foreground font-sans select-none">
      {/* 1. Operator Header */}
      {operator && (
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-border/70">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <p className="text-sm font-bold text-foreground truncate">
                {operator.name}
              </p>
            </div>
            {operator.title && (
              <p className="text-[11px] font-medium text-muted-foreground truncate mt-0.5 pl-4">
                {operator.title}
              </p>
            )}
            {operator.email && (
              <p className="text-[10px] text-muted-foreground/80 truncate pl-4">
                {operator.email}
              </p>
            )}
          </div>

          {isModified && (
            <button
              type="button"
              onClick={() => {
                resetDefaults();
                toast.success('Appearance reset to Sea of Blue defaults');
              }}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/70 transition cursor-pointer shrink-0"
              title="Reset appearance to defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      )}

      {/* 2. Theme Mode Switcher */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Appearance Theme
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-muted/60 border border-border/70">
          {THEME_MODES.map(({ id, label, icon: Icon }) => {
            const active = settings.mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => updateSettings({ mode: id })}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Glass Opacity & Frost Blur */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Glass Surface & Opaqueness
          </span>
          <div className="flex items-center gap-1">
            {GLASS_MATERIAL_PRESETS.map((preset) => {
              const isPresetActive =
                Math.abs(opacityVal - preset.cardOpacity) <= 2 &&
                Math.abs(blurVal - preset.frostBlur) <= 2;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setOpacityVal(preset.cardOpacity);
                    setBlurVal(preset.frostBlur);
                    updateSettings({
                      cardOpacity: preset.cardOpacity,
                      frostBlur: preset.frostBlur,
                    });
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    isPresetActive
                      ? 'bg-primary/20 text-primary border border-primary/40'
                      : 'text-muted-foreground hover:text-foreground bg-muted/40'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Card Opacity / Opaqueness Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-foreground/90">Card Opaqueness</span>
            <span className="font-mono font-bold text-muted-foreground">
              {opacityVal === 100 ? '100% Solid' : `${opacityVal}%`}
            </span>
          </div>
          <input
            type="range"
            min={25}
            max={100}
            step={1}
            value={opacityVal}
            aria-label="Card opaqueness percentage"
            onChange={(e) => {
              const v = Number(e.target.value);
              setOpacityVal(v);
              previewContinuous({ cardOpacity: v });
            }}
            onMouseUp={() => updateSettings({ cardOpacity: opacityVal })}
            onTouchEnd={() => updateSettings({ cardOpacity: opacityVal })}
            onKeyUp={() => updateSettings({ cardOpacity: opacityVal })}
            className="os-range-slider w-full"
          />
        </div>

        {/* Frost Blur Slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-foreground/90">Frost Blur</span>
            <span className="font-mono font-bold text-muted-foreground">
              {blurVal === 0 ? 'Off' : `${blurVal}px`}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={32}
            step={1}
            value={blurVal}
            aria-label="Glass frost blur radius"
            onChange={(e) => {
              const v = Number(e.target.value);
              setBlurVal(v);
              previewContinuous({ frostBlur: v });
            }}
            onMouseUp={() => updateSettings({ frostBlur: blurVal })}
            onTouchEnd={() => updateSettings({ frostBlur: blurVal })}
            onKeyUp={() => updateSettings({ frostBlur: blurVal })}
            className="os-range-slider w-full"
          />
        </div>
      </div>

      {/* 4. Atmospheric Backdrop Picture */}
      <div className="space-y-2.5 pt-1 border-t border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Backdrop Picture
          </span>
          <button
            type="button"
            disabled={isUploadingWallpaper}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline cursor-pointer disabled:opacity-50"
          >
            <ImagePlus className="w-3 h-3" />
            <span>{isUploadingWallpaper ? 'Compressing...' : customWallpaperUrl ? 'Change Photo' : 'Upload Photo'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Preset + Custom Thumbnail Grid */}
        <div className="grid grid-cols-6 gap-1.5">
          {WALLPAPER_PRESETS.map((preset) => {
            const active = settings.wallpaperId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => updateSettings({ wallpaperId: preset.id })}
                title={`${preset.label} (${preset.subtitle})`}
                className={`group relative h-11 rounded-lg overflow-hidden border transition cursor-pointer ${
                  active
                    ? 'border-primary ring-2 ring-primary/35 scale-[1.02]'
                    : 'border-border/70 hover:border-foreground/40 opacity-85 hover:opacity-100'
                }`}
                style={{ background: preset.previewCss }}
              >
                <span className="absolute inset-x-0 bottom-0 bg-black/55 px-0.5 py-0.5 text-[8px] font-bold text-white truncate text-center">
                  {preset.id === 'none' ? 'None' : preset.label.split(' ')[0]}
                </span>
                {active && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            );
          })}

          {/* Slot 6: Custom Photo Upload / Active Custom Thumbnail */}
          {customWallpaperUrl ? (
            <div className="relative h-11">
              <button
                type="button"
                onClick={() => updateSettings({ wallpaperId: 'custom' })}
                title="Custom uploaded backdrop"
                className={`w-full h-full rounded-lg overflow-hidden border bg-cover bg-center transition cursor-pointer ${
                  settings.wallpaperId === 'custom'
                    ? 'border-primary ring-2 ring-primary/35 scale-[1.02]'
                    : 'border-border/70 hover:border-foreground/40 opacity-85 hover:opacity-100'
                }`}
                style={{ backgroundImage: `url("${customWallpaperUrl}")` }}
              >
                <span className="absolute inset-x-0 bottom-0 bg-black/60 px-0.5 py-0.5 text-[8px] font-bold text-white truncate text-center">
                  Photo
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeCustomWallpaper();
                }}
                title="Remove custom photo"
                aria-label="Remove custom photo"
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center shadow-xs hover:scale-110 transition cursor-pointer"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload your own background picture"
              className="h-11 rounded-lg border border-dashed border-border hover:border-primary/60 bg-muted/40 hover:bg-muted/70 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              <span className="text-[8px] font-bold">Custom</span>
            </button>
          )}
        </div>

        {/* Backdrop Subtlety / Intensity Slider (Only shown when a picture is active) */}
        {settings.wallpaperId !== 'none' && (
          <div className="space-y-1 pt-0.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-foreground/90">
                Picture Presence
              </span>
              <span className="font-mono font-bold text-muted-foreground">
                {intensityVal <= 20
                  ? `Subtle (${intensityVal}%)`
                  : intensityVal <= 38
                  ? `Balanced (${intensityVal}%)`
                  : `Vivid (${intensityVal}%)`}
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={55}
              step={1}
              value={intensityVal}
              aria-label="Backdrop picture presence"
              onChange={(e) => {
                const v = Number(e.target.value);
                setIntensityVal(v);
                previewContinuous({ wallpaperIntensity: v });
              }}
              onMouseUp={() => updateSettings({ wallpaperIntensity: intensityVal })}
              onTouchEnd={() => updateSettings({ wallpaperIntensity: intensityVal })}
              onKeyUp={() => updateSettings({ wallpaperIntensity: intensityVal })}
              className="os-range-slider w-full"
            />
          </div>
        )}
      </div>

      {/* 5. Accent Color & Ambient Glow */}
      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-border/60">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
            Accent Tint
          </span>
          <div className="flex items-center gap-2">
            {ACCENT_SWATCHES.map((swatch) => {
              const active = settings.accent === swatch.id;
              return (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => updateSettings({ accent: swatch.id })}
                  title={swatch.label}
                  aria-label={`Select ${swatch.label} accent`}
                  className={`w-5 h-5 rounded-full flex items-center justify-center transition cursor-pointer ${
                    active
                      ? 'ring-2 ring-offset-2 ring-offset-popover ring-foreground scale-110'
                      : 'opacity-75 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{ backgroundColor: swatch.swatchHex }}
                >
                  {active && <Check className="w-3 h-3 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" />
            Ambient Glow
          </span>
          <Switch
            checked={settings.ambientGlow}
            onCheckedChange={(checked) => updateSettings({ ambientGlow: checked })}
            aria-label="Toggle ambient backdrop glow"
          />
        </div>
      </div>

      {/* 6. Optional Sign Out Footer */}
      {onLogout && !compact && (
        <div className="pt-2.5 border-t border-border/60">
          <button
            type="button"
            onClick={onLogout}
            className="w-full h-8 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-red-500/12 hover:bg-red-500/22 text-red-500 dark:text-red-300 border border-red-500/30 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function OperatorControlPopover({
  operator,
  onLogout,
  showTitleBreakpoint = '2xl',
  className = '',
}: OperatorControlPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open operator appearance and workspace preferences"
          className={`os-operator-pill inline-flex items-center h-8 px-2.5 rounded-full text-[11px] gap-1.5 border font-sans transition cursor-pointer select-none ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0" />
          <span className="font-bold text-foreground truncate max-w-[120px]">
            {operator.name}
          </span>
          {operator.title && (
            <span
              className={`text-muted-foreground ${
                showTitleBreakpoint === 'xl' ? 'hidden xl:inline' : 'hidden 2xl:inline'
              }`}
            >
              • {operator.title}
            </span>
          )}
          <ChevronDown
            className={`w-3 h-3 text-muted-foreground transition-transform duration-200 shrink-0 ${
              open ? 'rotate-180 text-foreground' : ''
            }`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="os-glass-popover w-[340px] p-4 rounded-2xl border border-border/80 z-[80]"
      >
        <AppearanceControlsPanel operator={operator} onLogout={onLogout} />
      </PopoverContent>
    </Popover>
  );
}
