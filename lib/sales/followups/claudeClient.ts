/**
 * Claude Sonnet 5.5 API Client for Sea of Blue Follow-Up Engine.
 * Uses prompt caching ($0.10/MTok cache hits) and optional native web search.
 */

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5-5';

export interface ClaudeCallOptions {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  enableWebSearch?: boolean;
  maxWebSearches?: number;
  effort?: 'low' | 'medium' | 'high';
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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured in environment variables.');
  }

  const body: Record<string, any> = {
    model: CLAUDE_MODEL,
    max_tokens: options.maxTokens || 2048,
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
        content: options.userPrompt,
      },
    ],
  };

  if (options.enableWebSearch) {
    body.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: options.maxWebSearches || 3,
      },
    ];
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
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
 * Extracts a JSON object from Claude's text response cleanly.
 */
export function extractJsonFromClaude<T = any>(rawText: string): T {
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const slice = cleaned.slice(firstBrace, lastBrace + 1);
      return JSON.parse(slice) as T;
    }
    throw new Error('Failed to parse JSON from Claude response');
  }
}
