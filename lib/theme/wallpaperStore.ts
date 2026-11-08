'use client';

export type OsWallpaperId =
  | 'none'
  | 'ocean-silk'
  | 'toronto-dusk'
  | 'arctic-mist'
  | 'aurora-glass'
  | 'custom';

export interface WallpaperPreset {
  id: Exclude<OsWallpaperId, 'custom'>;
  label: string;
  subtitle: string;
  previewCss: string;
  imageUrl?: string;
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

const OCEAN_SILK_SVG = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#021b3a"/>
      <stop offset="50%" stop-color="#063466"/>
      <stop offset="100%" stop-color="#031a33"/>
    </linearGradient>
    <radialGradient id="g1" cx="22%" cy="24%" r="55%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="g2" cx="82%" cy="72%" r="58%">
      <stop offset="0%" stop-color="#2563eb" stop-opacity="0.48"/>
      <stop offset="100%" stop-color="#2563eb" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#7dd3fc" stop-opacity="0.06"/>
      <stop offset="50%" stop-color="#93c5fd" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.05"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#bg)"/>
  <rect width="1600" height="1000" fill="url(#g1)"/>
  <rect width="1600" height="1000" fill="url(#g2)"/>
  <path d="M-100,620 C280,460 580,760 980,560 C1260,420 1460,540 1700,470 L1700,1050 L-100,1050 Z" fill="url(#wave)"/>
  <path d="M-100,740 C340,610 690,850 1120,670 C1350,575 1510,650 1700,610 L1700,1050 L-100,1050 Z" fill="url(#wave)"/>
</svg>
`);

const TORONTO_DUSK_SVG = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="48%" stop-color="#1e293b"/>
      <stop offset="78%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e3a5f"/>
    </linearGradient>
    <radialGradient id="glow" cx="68%" cy="62%" r="48%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.32"/>
      <stop offset="55%" stop-color="#6366f1" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="cool" cx="20%" cy="25%" r="50%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#sky)"/>
  <rect width="1600" height="1000" fill="url(#glow)"/>
  <rect width="1600" height="1000" fill="url(#cool)"/>
  <g fill="#09111f" fill-opacity="0.52">
    <rect x="120" y="680" width="90" height="320" rx="3"/>
    <rect x="230" y="620" width="115" height="380" rx="3"/>
    <rect x="370" y="700" width="85" height="300" rx="3"/>
    <rect x="520" y="560" width="130" height="440" rx="4"/>
    <rect x="680" y="630" width="95" height="370" rx="3"/>
    <rect x="855" y="420" width="22" height="580"/>
    <ellipse cx="866" cy="535" rx="38" ry="14"/>
    <rect x="862" y="330" width="8" height="100"/>
    <rect x="940" y="585" width="140" height="415" rx="4"/>
    <rect x="1105" y="640" width="110" height="360" rx="3"/>
    <rect x="1245" y="690" width="130" height="310" rx="3"/>
  </g>
</svg>
`);

const ARCTIC_MIST_SVG = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="mist" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#dbeafe"/>
      <stop offset="45%" stop-color="#bfdbfe"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
    <radialGradient id="m1" cx="25%" cy="30%" r="55%">
      <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="m2" cx="78%" cy="22%" r="48%">
      <stop offset="0%" stop-color="#818cf8" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#818cf8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="m3" cx="65%" cy="80%" r="55%">
      <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#2dd4bf" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#mist)"/>
  <rect width="1600" height="1000" fill="url(#m1)"/>
  <rect width="1600" height="1000" fill="url(#m2)"/>
  <rect width="1600" height="1000" fill="url(#m3)"/>
  <path d="M0,540 Q420,410 820,560 T1600,490 L1600,1000 L0,1000 Z" fill="#ffffff" fill-opacity="0.28"/>
</svg>
`);

const AURORA_GLASS_SVG = svgToDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="abg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#041226"/>
      <stop offset="55%" stop-color="#0b1d3a"/>
      <stop offset="100%" stop-color="#071526"/>
    </linearGradient>
    <radialGradient id="a1" cx="28%" cy="28%" r="52%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.36"/>
      <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="a2" cx="74%" cy="34%" r="52%">
      <stop offset="0%" stop-color="#6366f1" stop-opacity="0.42"/>
      <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="a3" cx="52%" cy="78%" r="55%">
      <stop offset="0%" stop-color="#0ea5e9" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1600" height="1000" fill="url(#abg)"/>
  <rect width="1600" height="1000" fill="url(#a1)"/>
  <rect width="1600" height="1000" fill="url(#a2)"/>
  <rect width="1600" height="1000" fill="url(#a3)"/>
</svg>
`);

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: 'none',
    label: 'Pure Theme',
    subtitle: 'Clean surface only',
    previewCss: 'linear-gradient(135deg, #001326 0%, #0a2547 100%)',
  },
  {
    id: 'ocean-silk',
    label: 'Sea Silk',
    subtitle: 'Soft cerulean waves',
    previewCss: 'linear-gradient(135deg, #021b3a 0%, #0ea5e9 55%, #1d4ed8 100%)',
    imageUrl: OCEAN_SILK_SVG,
  },
  {
    id: 'toronto-dusk',
    label: 'GTA Dusk',
    subtitle: 'Warm horizon & skyline',
    previewCss: 'linear-gradient(135deg, #0f172a 0%, #334155 55%, #d97706 100%)',
    imageUrl: TORONTO_DUSK_SVG,
  },
  {
    id: 'arctic-mist',
    label: 'Ice Pearl',
    subtitle: 'Airy daylight mist',
    previewCss: 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 50%, #a5b4fc 100%)',
    imageUrl: ARCTIC_MIST_SVG,
  },
  {
    id: 'aurora-glass',
    label: 'Aurora',
    subtitle: 'Emerald & indigo bloom',
    previewCss: 'linear-gradient(135deg, #041226 0%, #10b981 50%, #6366f1 100%)',
    imageUrl: AURORA_GLASS_SVG,
  },
];

const DB_NAME = 'sob_os_appearance_db';
const STORE_NAME = 'wallpapers';
const CUSTOM_KEY = 'custom_wallpaper_v1';

function openWallpaperDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomWallpaperDataUrl(dataUrl: string): Promise<void> {
  const db = await openWallpaperDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(dataUrl, CUSTOM_KEY);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadCustomWallpaperDataUrl(): Promise<string | null> {
  try {
    const db = await openWallpaperDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(CUSTOM_KEY);
      req.onsuccess = () => {
        db.close();
        resolve(typeof req.result === 'string' ? req.result : null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function clearCustomWallpaperDataUrl(): Promise<void> {
  try {
    const db = await openWallpaperDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(CUSTOM_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Downscales an uploaded image file to max 1920x1200 WebP/JPEG (~150-350KB)
 * so high-resolution photos render smoothly at 60fps behind frosted glass.
 */
export function compressWallpaperFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 1920;
        const maxH = 1200;
        let { width, height } = img;
        const scale = Math.min(1, maxW / width, maxH / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);

        let encoded = canvas.toDataURL('image/webp', 0.84);
        if (!encoded.startsWith('data:image/webp')) {
          encoded = canvas.toDataURL('image/jpeg', 0.85);
        }
        resolve(encoded);
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode image file'));
    };
    img.src = objectUrl;
  });
}
