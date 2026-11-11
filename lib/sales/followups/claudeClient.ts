/**
 * Claude Haiku 4.5 API Client for Sea of Blue Follow-Up Engine.
 * Uses prompt caching and optional domain-restricted web search.
 */

import { createServiceClient } from '@/lib/supabase/server';

export const CLAUDE_MODEL = 'claude-haiku-4-5';

let cachedSystemConfig: {
  ANTHROPIC_API_KEY?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
} | null = null;

export async function getFollowupSystemSecrets() {
  if (!cachedSystemConfig) {
    try {
      const supabase = await createServiceClient();
      const { data } = await supabase
        .from('sales_followup_processed_events')
        .select('summary')
        .eq('event_id', '00000000-0000-0000-0000-000000000001')
        .eq('outcome_type', 'SYSTEM_CONFIG')
        .maybeSingle();

      if (data?.summary) {
        cachedSystemConfig = data.summary;
      }
    } catch {
      // ignore
    }
  }

  return {
    ANTHROPIC_API_KEY:
      cachedSystemConfig?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '',
    GOOGLE_CLIENT_ID:
      cachedSystemConfig?.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
    GOOGLE_CLIENT_SECRET:
      cachedSystemConfig?.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
    RESEND_API_KEY:
      cachedSystemConfig?.RESEND_API_KEY || process.env.RESEND_API_KEY || '',
  };
}

export interface ClaudeDocumentBlock {
  type: 'document';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface ClaudeCallOptions {
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  enableWebSearch?: boolean;
  maxWebSearches?: number;
  allowedSearchDomains?: string[];
  effort?: 'low' | 'medium' | 'high';
  documents?: ClaudeDocumentBlock[];
}

export interface ClaudeResponse {
  text: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  citations?: Array<{ url?: string; title?: string }>;
}

/**
 * Calls Anthropic's Messages API with claude-sonnet-5-5 and ephemeral prompt caching on the system prompt.
 */
export async function callClaudeSonnet(options: ClaudeCallOptions): Promise<ClaudeResponse> {
  const secrets = await getFollowupSystemSecrets();
  const apiKey = secrets.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured in environment variables.');
  }

  const userContent =
    options.documents && options.documents.length > 0
      ? [
          ...options.documents,
          {
            type: 'text',
            text: options.userPrompt,
          },
        ]
      : options.userPrompt;

  const body: Record<string, any> = {
    model: options.model || CLAUDE_MODEL,
    max_tokens: options.maxTokens || 4096,
    system: [
      {
        type: 'text',
        text: options.systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
  };

  if (options.enableWebSearch) {
    const webSearchTool: Record<string, any> = {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: options.maxWebSearches || 1,
    };
    if (options.allowedSearchDomains && options.allowedSearchDomains.length > 0) {
      webSearchTool.allowed_domains = options.allowedSearchDomains;
    }
    body.tools = [webSearchTool];
  }

  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };

  if (options.documents && options.documents.length > 0) {
    headers['anthropic-beta'] = 'pdfs-2024-09-25';
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Claude API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const contentBlocks = Array.isArray(data.content) ? data.content : [];

  const textParts: string[] = [];
  const citations: Array<{ url?: string; title?: string }> = [];

  for (const block of contentBlocks) {
    if (block.type === 'text' && typeof block.text === 'string') {
      textParts.push(block.text);
      if (Array.isArray(block.citations)) {
        for (const c of block.citations) {
          if (c.url) citations.push({ url: c.url, title: c.title });
        }
      }
    }
  }

  return {
    text: textParts.join('\n').trim(),
    usage: data.usage,
    citations,
  };
}

/**
 * Repairs truncated JSON when output tokens cut off mid-string or mid-object.
 */
function repairTruncatedJson(str: string): string {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') stack.pop();
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') stack.pop();
      }
    }
  }

  let repaired = str;
  if (inString) {
    repaired += '"';
  }

  repaired = repaired.replace(/,\s*$/, '');

  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') repaired += '}';
    else if (open === '[') repaired += ']';
  }

  return repaired;
}

/**
 * Sanitizes unescaped control characters (such as literal newlines or tabs) inside JSON string literals.
 */
function sanitizeJsonControlChars(str: string): string {
  let inString = false;
  let escaped = false;
  let result = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (inString) {
      if (char === '\n') {
        result += '\\n';
        continue;
      }
      if (char === '\r') {
        continue;
      }
      if (char === '\t') {
        result += '\\t';
        continue;
      }
    }
    result += char;
  }
  return result;
}

/**
 * Extracts a JSON object from Claude's text response cleanly with resilient error recovery.
 */
export function extractJsonFromClaude<T = any>(rawText: string): T {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // 1. Try direct parse
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // 2. Try with sanitized control characters (escapes unescaped newlines inside strings)
    try {
      return JSON.parse(sanitizeJsonControlChars(cleaned)) as T;
    } catch {
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const slice = cleaned.slice(firstBrace, lastBrace + 1);
        try {
          return JSON.parse(slice) as T;
        } catch {
          try {
            return JSON.parse(sanitizeJsonControlChars(slice)) as T;
          } catch {
            // Attempt truncated JSON repair
            try {
              const repaired = repairTruncatedJson(sanitizeJsonControlChars(slice));
              return JSON.parse(repaired) as T;
            } catch {
              // continue to next fallback
            }
          }
        }
      } else if (firstBrace !== -1) {
        // JSON opened but never closed
        try {
          const slice = cleaned.slice(firstBrace);
          const repaired = repairTruncatedJson(sanitizeJsonControlChars(slice));
          return JSON.parse(repaired) as T;
        } catch {
          // continue
        }
      }
      throw new Error('Failed to parse JSON from Claude response');
    }
  }
}
