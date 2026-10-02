import React, { useState, useEffect } from 'react';
import { ExternalLink, Settings, Maximize2, Minimize2, Map, RefreshCw } from 'lucide-react';

const DEFAULT_MIRO_KEY = 'sob_miro_script_embed_url';

/**
 * Normalizes Miro URLs:
 * Handles:
 * 1. Full <iframe> code snippet: <iframe src="https://miro.com/app/live-embed/..." ...></iframe>
 * 2. Standard board URL: https://miro.com/app/board/uXjVO.../ -> https://miro.com/app/live-embed/uXjVO.../
 * 3. Already live-embed URL: https://miro.com/app/live-embed/...
 */
export function sanitizeMiroUrl(rawInput) {
  if (!rawInput) return '';
  let url = rawInput.trim();

  // If user pasted full iframe tag
  const iframeSrcMatch = url.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch && iframeSrcMatch[1]) {
    url = iframeSrcMatch[1];
  }

  // Convert board link to live-embed link if needed
  if (url.includes('miro.com/app/board/') && !url.includes('/live-embed/')) {
    url = url.replace('miro.com/app/board/', 'miro.com/app/live-embed/');
  }

  return url;
}

export default function MiroScriptEmbed({ isCompact = false }) {
  const [embedUrl, setEmbedUrl] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [keyCounter, setKeyCounter] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DEFAULT_MIRO_KEY);
      if (saved) {
        setEmbedUrl(saved);
        setInputUrl(saved);
      }
    } catch (e) {
      console.warn('[MiroEmbed] Failed to read localStorage', e);
    }
  }, []);

  const handleSave = (e) => {
    if (e) e.preventDefault();
    const clean = sanitizeMiroUrl(inputUrl);
    setEmbedUrl(clean);
    try {
      localStorage.setItem(DEFAULT_MIRO_KEY, clean);
    } catch (e) {
      console.warn('[MiroEmbed] Failed to save localStorage', e);
    }
    setIsEditing(false);
    setKeyCounter(k => k + 1);
  };

  const handleClear = () => {
    setEmbedUrl('');
    setInputUrl('');
    try {
      localStorage.removeItem(DEFAULT_MIRO_KEY);
    } catch (e) {
      console.warn('[MiroEmbed] Failed to remove localStorage', e);
    }
  };

  return (
    <div className={`miro-embed-container ${isFullscreen ? 'miro-fullscreen' : ''}`}>
      {/* Control bar */}
      <div className="miro-embed-toolbar">
        <div className="miro-embed-title">
          <div className="miro-badge-icon">
            <Map size={14} className="text-amber-400" />
          </div>
          <div>
            <span className="font-bold text-white text-xs tracking-tight">Interactive Miro Mind Map Script</span>
            <span className="text-[10px] text-slate-400 block font-normal">
              Post-Construction & Commercial Cold Calling Tree
            </span>
          </div>
        </div>

        <div className="miro-embed-actions">
          {embedUrl && (
            <>
              <button
                type="button"
                className="miro-tool-btn"
                title="Refresh Mind Map"
                onClick={() => setKeyCounter(k => k + 1)}
              >
                <RefreshCw size={12} />
              </button>
              <a
                href={embedUrl.replace('/live-embed/', '/board/')}
                target="_blank"
                rel="noopener noreferrer"
                className="miro-tool-btn"
                title="Open in Miro Tab"
              >
                <ExternalLink size={12} />
                <span className="hidden sm:inline">Open Miro</span>
              </a>
              <button
                type="button"
                className="miro-tool-btn"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mind Map"}
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span className="hidden sm:inline">{isFullscreen ? 'Minimize' : 'Expand'}</span>
              </button>
            </>
          )}

          <button
            type="button"
            className="miro-tool-btn miro-tool-btn-primary"
            title="Configure Miro Embed URL"
            onClick={() => setIsEditing(true)}
          >
            <Settings size={12} />
            <span>{embedUrl ? 'Change Link' : 'Set Link'}</span>
          </button>
        </div>
      </div>

      {/* Configuration Modal / Overlay */}
      {isEditing && (
        <div className="phone-modal-overlay" style={{ zIndex: 3000 }}>
          <div className="phone-modal-content" style={{ maxWidth: 520 }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Map className="w-4 h-4 text-amber-400" /> Connect Miro Mind Map Script
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Paste your Miro board share link, live embed link, or the full <code>&lt;iframe&gt;</code> code from your Miro mind map. We automatically format it for seamless in-call navigation.
            </p>

            <form onSubmit={handleSave}>
              <div className="mb-3">
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Miro Board Link or Embed Code
                </label>
                <textarea
                  className="phone-search-input"
                  style={{ minHeight: 90, fontFamily: 'monospace', fontSize: '11px', padding: '10px' }}
                  placeholder="https://miro.com/app/live-embed/uXjVO.../ or https://miro.com/app/board/..."
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/50 mb-4 text-[11px] text-slate-400">
                <strong className="text-amber-300 block mb-1">💡 How to find your Miro Embed link:</strong>
                1. In your Miro mind map, click the <strong>Share</strong> button (top right).<br />
                2. Click <strong>Embed</strong> or <strong>Copy link</strong>.<br />
                3. Paste it directly in the box above and hit save!
              </div>

              <div className="flex items-center justify-between">
                {embedUrl && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-red-400 hover:text-red-300 text-xs font-semibold"
                  >
                    Disconnect
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button
                    type="button"
                    className="phone-text-btn"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="phone-call-btn"
                    style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  >
                    Save & Load Mind Map
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Frame / Content area */}
      <div className={`miro-frame-wrapper ${isCompact ? 'compact' : ''}`}>
        {embedUrl ? (
          <iframe
            key={keyCounter}
            src={embedUrl}
            title="Miro Sales Mind Map Script"
            className="miro-iframe"
            allowFullScreen
            allow="clipboard-read; clipboard-write"
          />
        ) : (
          <div className="miro-empty-state">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
              <Map size={24} />
            </div>
            <h4 className="text-sm font-bold text-white mb-1">Miro Script Mind Map Not Linked Yet</h4>
            <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
              Embed your curated Miro cold calling flow chart right here. Your phone sales reps can navigate branch-by-branch through openers, objection turnarounds, and walkthrough closes during live calls.
            </p>
            <button
              type="button"
              className="phone-call-btn"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', padding: '8px 16px', fontSize: '12px' }}
              onClick={() => setIsEditing(true)}
            >
              + Link Miro Mind Map Script
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
