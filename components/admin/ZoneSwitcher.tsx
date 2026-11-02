'use client';

interface Zone {
  id: string;
  name: string;
  active_jobs_today: number;
  employees_online: number;
  color: string;
}

const ZONE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2',
];

interface ZoneSwitcherProps {
  zones: Zone[];
  selected: string | 'all';
  onSelect: (zoneId: string | 'all') => void;
}

export function ZoneSwitcher({ zones, selected, onSelect }: ZoneSwitcherProps) {
  const zonesWithColor = zones.map((z, i) => ({
    ...z,
    color: z.color || ZONE_COLORS[i % ZONE_COLORS.length],
  }));

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-background overflow-x-auto scrollbar-none min-w-0">
      <span className="text-xs text-muted-foreground font-medium mr-1 shrink-0">Zone:</span>
      <button
        onClick={() => onSelect('all')}
        className={`px-3 py-2.5 md:py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 whitespace-nowrap ${
          selected === 'all'
            ? 'bg-foreground text-background'
            : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
        }`}
      >
        All zones
      </button>
      {zonesWithColor.map((zone) => (
        <button
          key={zone.id}
          onClick={() => onSelect(zone.id)}
          className={`px-3 py-2.5 md:py-1.5 rounded-full text-xs font-medium transition-all shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
            selected === zone.id
              ? 'text-white shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
          style={selected === zone.id ? { background: zone.color } : {}}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: selected === zone.id ? 'rgba(255,255,255,0.7)' : zone.color,
            }}
          />
          {zone.name}
          {zone.active_jobs_today > 0 && (
            <span
              className={`text-[10px] font-semibold ${
                selected === zone.id ? 'opacity-80' : 'text-muted-foreground'
              }`}
            >
              {zone.active_jobs_today}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
