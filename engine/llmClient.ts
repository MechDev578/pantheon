import type { AIProvider } from './types.ts';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        enum?: readonly string[];
        items?: { type: string };
      }
    >;
    required?: readonly string[];
  };
}

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type LLMMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCallRequest[] }
  | { role: 'tool'; toolCallId: string; toolName: string; content: string };

export interface LLMCallParams {
  provider: AIProvider;
  model: string;
  apiKey: string;
  systemPrompt: string;
  messages: LLMMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LLMResponse {
  text: string;
  toolCalls: ToolCallRequest[];
  usage?: {
    input: number;
    output: number;
  };
  stopReason: string;
}

function makeCallId(prefix: string, idx: number): string {
  return `${prefix}_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`;
}

async function fetchJsonWithError(
  url: string,
  init: RequestInit,
  providerLabel: string,
): Promise<unknown> {
  const res = await fetch(url, init);
  const raw = await res.text();
  if (!res.ok) {
    let detail = raw.slice(0, 400);
    try {
      const parsed = JSON.parse(raw) as { error?: { message?: string } | string };
      if (typeof parsed.error === 'string') {
        detail = parsed.error;
      } else if (parsed.error?.message) {
        detail = parsed.error.message;
      }
    } catch {
      // keep raw snippet
    }
    throw new Error(`${providerLabel} API error (${res.status}): ${detail}`);
  }
  return JSON.parse(raw);
}

/* -------------------------------------------------------------------------- */
/* Google Gemini Adapter                                                      */
/* -------------------------------------------------------------------------- */

function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) {
    return schema.map(toGeminiSchema);
  }
  if (!schema || typeof schema !== 'object') {
    return schema;
  }
  const src = schema as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    if (key === 'additionalProperties') continue;
    if (key === 'type' && typeof value === 'string') {
      out[key] = value.toUpperCase();
    } else {
      out[key] = toGeminiSchema(value);
    }
  }
  return out;
}

async function callGemini(params: LLMCallParams): Promise<LLMResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    params.model,
  )}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

  const contents: Array<{ role: 'user' | 'model'; parts: unknown[] }> = [];

  for (const msg of params.messages) {
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content }] });
    } else if (msg.role === 'assistant') {
      const parts: unknown[] = [];
      if (msg.content.trim()) {
        parts.push({ text: msg.content });
      }
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.args,
            },
          });
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'model', parts });
      }
    } else if (msg.role === 'tool') {
      let parsedResponse: Record<string, unknown>;
      try {
        const candidate = JSON.parse(msg.content);
        parsedResponse =
          candidate && typeof candidate === 'object' && !Array.isArray(candidate)
            ? (candidate as Record<string, unknown>)
            : { result: candidate };
      } catch {
        parsedResponse = { result: msg.content };
      }
      const part = {
        functionResponse: {
          name: msg.toolName,
          response: parsedResponse,
        },
      };
      // Group consecutive tool responses into a single 'user' turn for Gemini
      const prev = contents[contents.length - 1];
      if (
        prev &&
        prev.role === 'user' &&
        prev.parts.every((p) => typeof p === 'object' && p !== null && 'functionResponse' in p)
      ) {
        prev.parts.push(part);
      } else {
        contents.push({ role: 'user', parts: [part] });
      }
    }
  }

  const body: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: params.systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: params.temperature ?? 0.4,
      maxOutputTokens: params.maxTokens ?? 4096,
    },
  };

  if (params.tools && params.tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: params.tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: toGeminiSchema(t.parameters),
        })),
      },
    ];
  }

  const data = (await fetchJsonWithError(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: params.signal,
    },
    'Gemini',
  )) as {
    candidates?: Array<{
      finishReason?: string;
      content?: {
        parts?: Array<{
          text?: string;
          functionCall?: { name: string; args?: Record<string, unknown> };
        }>;
      };
    }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
    };
  };

  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const textParts: string[] = [];
  const toolCalls: ToolCallRequest[] = [];

  parts.forEach((part, idx) => {
    if (part.text) {
      textParts.push(part.text);
    }
    if (part.functionCall?.name) {
      toolCalls.push({
        id: makeCallId('gem', idx),
        name: part.functionCall.name,
        args: part.functionCall.args ?? {},
      });
    }
  });

  return {
    text: textParts.join('\n').trim(),
    toolCalls,
    usage: data.usageMetadata
      ? {
          input: data.usageMetadata.promptTokenCount ?? 0,
          output: data.usageMetadata.candidatesTokenCount ?? 0,
        }
      : undefined,
    stopReason: candidate?.finishReason ?? 'STOP',
  };
}

/* -------------------------------------------------------------------------- */
/* OpenAI Adapter                                                             */
/* -------------------------------------------------------------------------- */

async function callOpenAI(params: LLMCallParams): Promise<LLMResponse> {
  const url = 'https://api.openai.com/v1/chat/completions';
  const isReasoningModel = /^(o1|o3|o4)/i.test(params.model);

  const messages: unknown[] = [
    {
      role: isReasoningModel ? 'developer' : 'system',
      content: params.systemPrompt,
    },
  ];

  for (const msg of params.messages) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      const assistantMsg: Record<string, unknown> = {
        role: 'assistant',
        content: msg.content || null,
      };
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        assistantMsg.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.args),
          },
        }));
      }
      messages.push(assistantMsg);
    } else if (msg.role === 'tool') {
      messages.push({
        role: 'tool',
        tool_call_id: msg.toolCallId,
        content: msg.content,
      });
    }
  }

  const body: Record<string, unknown> = {
    model: params.model,
    messages,
  };

  if (isReasoningModel) {
    body.max_completion_tokens = params.maxTokens ?? 4096;
  } else {
    body.temperature = params.temperature ?? 0.4;
    body.max_tokens = params.maxTokens ?? 4096;
  }

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  const data = (await fetchJsonWithError(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: params.signal,
    },
    'OpenAI',
  )) as {
    choices?: Array<{
      finish_reason?: string;
      message?: {
        content?: string | null;
        tool_calls?: Array<{
          id: string;
          function?: { name: string; arguments?: string };
        }>;
      };
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const choice = data.choices?.[0];
  const toolCalls: ToolCallRequest[] = (choice?.message?.tool_calls ?? []).map(
    (tc, idx) => {
      let args: Record<string, unknown> = {};
      if (tc.function?.arguments) {
        try {
          args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
        } catch {
          args = {};
        }
      }
      return {
        id: tc.id || makeCallId('oai', idx),
        name: tc.function?.name ?? 'unknown',
        args,
      };
    },
  );

  return {
    text: (choice?.message?.content ?? '').trim(),
    toolCalls,
    usage: data.usage
      ? {
          input: data.usage.prompt_tokens ?? 0,
          output: data.usage.completion_tokens ?? 0,
        }
      : undefined,
    stopReason: choice?.finish_reason ?? 'stop',
  };
}

/* -------------------------------------------------------------------------- */
/* Anthropic Claude Adapter                                                   */
/* -------------------------------------------------------------------------- */

async function callAnthropic(params: LLMCallParams): Promise<LLMResponse> {
  const url = 'https://api.anthropic.com/v1/messages';

  const messages: Array<{ role: 'user' | 'assistant'; content: unknown[] }> = [];

  for (const msg of params.messages) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: [{ type: 'text', text: msg.content }] });
    } else if (msg.role === 'assistant') {
      const blocks: unknown[] = [];
      if (msg.content.trim()) {
        blocks.push({ type: 'text', text: msg.content });
      }
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.args,
          });
        }
      }
      if (blocks.length > 0) {
        messages.push({ role: 'assistant', content: blocks });
      }
    } else if (msg.role === 'tool') {
      const block = {
        type: 'tool_result',
        tool_use_id: msg.toolCallId,
        content: msg.content,
      };
      const prev = messages[messages.length - 1];
      if (
        prev &&
        prev.role === 'user' &&
        prev.content.every(
          (b) => typeof b === 'object' && b !== null && (b as { type?: string }).type === 'tool_result',
        )
      ) {
        prev.content.push(block);
      } else {
        messages.push({ role: 'user', content: [block] });
      }
    }
  }

  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens ?? 4096,
    temperature: params.temperature ?? 0.4,
    system: params.systemPrompt,
    messages,
  };

  if (params.tools && params.tools.length > 0) {
    body.tools = params.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  const data = (await fetchJsonWithError(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    },
    'Anthropic',
  )) as {
    stop_reason?: string;
    content?: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  const textParts: string[] = [];
  const toolCalls: ToolCallRequest[] = [];

  (data.content ?? []).forEach((block, idx) => {
    if (block.type === 'text' && block.text) {
      textParts.push(block.text);
    } else if (block.type === 'tool_use' && block.name) {
      toolCalls.push({
        id: block.id || makeCallId('ant', idx),
        name: block.name,
        args: block.input ?? {},
      });
    }
  });

  return {
    text: textParts.join('\n').trim(),
    toolCalls,
    usage: data.usage
      ? {
          input: data.usage.input_tokens ?? 0,
          output: data.usage.output_tokens ?? 0,
        }
      : undefined,
    stopReason: data.stop_reason ?? 'end_turn',
  };
}

export async function callLLM(params: LLMCallParams): Promise<LLMResponse> {
  if (!params.apiKey?.trim()) {
    throw new Error(
      `Missing API key for ${params.provider}. Add your key in Settings or .env to deploy live Olympians.`,
    );
  }
  switch (params.provider) {
    case 'gemini':
      return callGemini(params);
    case 'openai':
      return callOpenAI(params);
    case 'anthropic':
      return callAnthropic(params);
    default: {
      const exhaustive: never = params.provider;
      throw new Error(`Unsupported provider: ${String(exhaustive)}`);
    }
  }
}

export function extractJsonBlock<T>(text: string): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
