'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Droplets,
  Image as ImageIcon,
  ImagePlus,
  Layers,
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

/**
 * macOS Control Center-style inline filled capsule slider.
 * Eliminates floating thin range wires and 2-line label stacks.
 */
function CapsuleSlider({
  icon: Icon,
  label,
  displayValue,
  min,
  max,
  value,
  onPreview,
  onCommit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  displayValue: string;
  min: number;
  max: number;
  value: number;
  onPreview: (val: number) => void;
  onCommit: (val: number) => void;
}) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="os-recessed relative h-8 rounded-xl overflow-hidden flex items-center justify-between px-3 select-none group">
      <div
        className="os-slider-fill absolute inset-y-0 left-0 pointer-events-none"
        style={{ width: `${pct}%` }}
      />
      <div className="relative z-[1] flex items-center gap-2 pointer-events-none min-w-0">
        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-[11px] font-semibold text-foreground/95 truncate">
          {label}
        </span>
      </div>
      <span className="relative z-[1] text-[11px] font-mono font-bold tabular-nums text-muted-foreground group-hover:text-foreground transition-colors pointer-events-none shrink-0">
        {displayValue}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={label}
        onChange={(e) => onPreview(Number(e.target.value))}
        onMouseUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => onCommit(Number((e.target as HTMLInputElement).value))}
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-10 m-0"
      />
    </div>
  );
}

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
      toast.success('Backdrop updated');
    } catch {
      toast.error('Could not process that image');
    }
  };

  return (
    <div className="os-appearance-panel space-y-3 text-popover-foreground font-sans select-none">
      {/* 1. Compact Operator Bar (Identity + Reset + Sign Out inline) */}
      {operator && (
        <div className="os-recessed flex items-center justify-between gap-2 px-3 py-2 rounded-xl">
          <div className="min-w-0 flex items-center gap-2.5">
            <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
              {operator.name
                .split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-bold text-foreground truncate">
                {operator.name}
              </p>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {operator.title || operator.email || 'Active Session'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isModified && (
              <button
                type="button"
                onClick={() => {
                  resetDefaults();
                  toast.success('Reset to Sea of Blue defaults');
                }}
                className="h-7 px-2 rounded-lg text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:bg-background/40 inline-flex items-center gap-1 transition cursor-pointer"
                title="Reset appearance to defaults"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
            {onLogout && !compact && (
              <button
                type="button"
                onClick={onLogout}
                title="Sign Out"
                aria-label="Sign Out"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-300 bg-red-500/12 hover:bg-red-500/22 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Theme Mode */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Theme
          </span>
          {!operator && isModified && (
            <button
              type="button"
              onClick={() => {
                resetDefaults();
                toast.success('Reset to Sea of Blue defaults');
              }}
              className="text-[10px] font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
        <div className="os-recessed grid grid-cols-4 gap-1 p-1 rounded-xl">
          {THEME_MODES.map(({ id, label, icon: Icon }) => {
            const active = settings.mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => updateSettings({ mode: id })}
                className={`flex flex-col items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/35'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Glass Material & Capsule Sliders */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground shrink-0">
            Glass
          </span>
          <div className="os-recessed inline-flex items-center gap-0.5 p-0.5 rounded-lg shrink-0">
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
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap transition cursor-pointer ${
                    isPresetActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <CapsuleSlider
          icon={Layers}
          label="Card Opacity"
          displayValue={opacityVal === 100 ? 'Solid' : `${opacityVal}%`}
          min={25}
          max={100}
          value={opacityVal}
          onPreview={(v) => {
            setOpacityVal(v);
            previewContinuous({ cardOpacity: v });
          }}
          onCommit={(v) => updateSettings({ cardOpacity: v })}
        />

        <CapsuleSlider
          icon={Droplets}
          label="Frost Blur"
          displayValue={blurVal === 0 ? 'Off' : `${blurVal}px`}
          min={0}
          max={32}
          value={blurVal}
          onPreview={(v) => {
            setBlurVal(v);
            previewContinuous({ frostBlur: v });
          }}
          onCommit={(v) => updateSettings({ frostBlur: v })}
        />
      </div>

      {/* 4. Atmospheric Backdrop (Widescreen 3x2 Grid) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Backdrop
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploadingWallpaper}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:opacity-85 cursor-pointer disabled:opacity-50"
            >
              <ImagePlus className="w-3 h-3" />
              <span>
                {isUploadingWallpaper
                  ? 'Saving...'
                  : customWallpaperUrl
                  ? 'Change'
                  : 'Upload Photo'}
              </span>
            </button>
            {customWallpaperUrl && (
              <button
                type="button"
                onClick={removeCustomWallpaper}
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground hover:text-red-400 cursor-pointer"
                title="Remove uploaded photo"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {WALLPAPER_PRESETS.map((preset) => {
            const active = settings.wallpaperId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => updateSettings({ wallpaperId: preset.id })}
                title={preset.subtitle}
                className={`group relative h-11 rounded-xl overflow-hidden transition cursor-pointer ${
                  active
                    ? 'ring-2 ring-primary'
                    : 'opacity-80 hover:opacity-100'
                }`}
                style={{ background: preset.previewCss }}
              >
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                <span className="absolute left-2 bottom-1.5 text-[10px] font-bold text-white leading-none truncate max-w-[calc(100%-1rem)]">
                  {preset.id === 'none' ? 'None' : preset.label}
                </span>
                {active && (
                  <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </span>
                )}
              </button>
            );
          })}

          {/* Slot 6: Widescreen Custom Photo Tile */}
          {customWallpaperUrl ? (
            <button
              type="button"
              onClick={() => updateSettings({ wallpaperId: 'custom' })}
              title="Custom uploaded backdrop"
              className={`relative h-11 rounded-xl overflow-hidden bg-cover bg-center transition cursor-pointer ${
                settings.wallpaperId === 'custom'
                  ? 'ring-2 ring-primary'
                  : 'opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundImage: `url("${customWallpaperUrl}")` }}
            >
              <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <span className="absolute left-2 bottom-1.5 text-[10px] font-bold text-white leading-none">
                Custom
              </span>
              {settings.wallpaperId === 'custom' && (
                <span className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="w-2.5 h-2.5" />
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload your own background picture"
              className="os-recessed h-11 rounded-xl flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <ImagePlus className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-bold">Custom</span>
            </button>
          )}
        </div>

        {settings.wallpaperId !== 'none' && (
          <CapsuleSlider
            icon={ImageIcon}
            label="Photo Presence"
            displayValue={`${intensityVal}%`}
            min={10}
            max={55}
            value={intensityVal}
            onPreview={(v) => {
              setIntensityVal(v);
              previewContinuous({ wallpaperIntensity: v });
            }}
            onCommit={(v) => updateSettings({ wallpaperIntensity: v })}
          />
        )}
      </div>

      {/* 5. Single Inline Footer Bar: Accent Swatches + Ambient Glow */}
      <div className="os-recessed flex items-center justify-between gap-2 px-3 py-2 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Accent
          </span>
          <div className="flex items-center gap-1.5">
            {ACCENT_SWATCHES.map((swatch) => {
              const active = settings.accent === swatch.id;
              return (
                <button
                  key={swatch.id}
                  type="button"
                  onClick={() => updateSettings({ accent: swatch.id })}
                  title={swatch.label}
                  aria-label={`Select ${swatch.label} accent`}
                  className={`w-4.5 h-4.5 h-[18px] w-[18px] rounded-full flex items-center justify-center transition cursor-pointer ${
                    active
                      ? 'scale-110 ring-2 ring-primary/45 shadow-xs'
                      : 'opacity-65 hover:opacity-100 hover:scale-105'
                  }`}
                  style={{ backgroundColor: swatch.swatchHex }}
                >
                  {active && <Check className="w-2.5 h-2.5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-primary" />
            <span>Glow</span>
          </span>
          <Switch
            checked={settings.ambientGlow}
            onCheckedChange={(checked) => updateSettings({ ambientGlow: checked })}
            aria-label="Toggle ambient backdrop glow"
            className="scale-90 origin-right"
          />
        </div>
      </div>
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
          className={`os-operator-pill inline-flex items-center h-9 md:h-8 px-2.5 rounded-full text-[11px] gap-1.5 border font-sans transition cursor-pointer select-none shrink-0 ${className}`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse shrink-0" />
          <span className="font-bold text-foreground truncate max-w-[90px] sm:hidden">
            {operator.name.split(' ')[0]}
          </span>
          <span className="font-bold text-foreground truncate max-w-[130px] hidden sm:inline">
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
        className="os-glass-popover w-[356px] max-w-[calc(100vw-1.5rem)] p-3.5 rounded-2xl border z-[80]"
      >
        <AppearanceControlsPanel operator={operator} onLogout={onLogout} />
      </PopoverContent>
    </Popover>
  );
}
