// Server-provided API keys, keyed by provider name (passed in from snp.py's env vars).
// The user can override any of these with their own key via the AI config panel (below).
export type LLMApiKeys = { [provider: string]: string };

// Everything the user can set for one provider. Held per provider (see LLMConfig) so
// switching providers and switching back doesn't lose what you had configured for each.
export type LLMProviderSettings = {
  model: string;
  effort: string;   // reasoning_effort; "" means don't send the param
  endpoint: string; // only used by providers with custom_endpoint
  api_key: string;  // the user's own key; takes precedence over the server's key
};

// The user-editable LLM config, stored in localStorage. Config lives in the frontend now
// (it was the window.snp_ai_provider flag + hardcoded models) so it's editable from the UI.
export type LLMConfig = {
  provider: string; // the active provider
  by_provider: { [provider: string]: LLMProviderSettings };
};

// Per-provider metadata for both request shaping and the config panel's dropdowns.
export type ProviderMeta = {
  label: string;                       // shown in the provider dropdown and key placeholder
  style: "openai" | "anthropic";       // request/response shape
  default_url: string;                 // also the endpoint box's prefill when custom_endpoint
  custom_endpoint: boolean;            // if true, show the endpoint box and take the URL from config.endpoint
  models: string[];                    // suggestions for the model dropdown
  default_model: string;
  efforts: string[];                   // selectable reasoning_effort values ("" = provider default); empty = no effort control
  default_effort: string;
  custom_effort: boolean;              // if true, effort is a typable combobox rather than a fixed dropdown
  // 'max_tokens' is rejected by newer OpenAI models while Mercury ignores
  // 'max_completion_tokens'; reasoning models burn ~16 tokens before emitting anything and
  // 400 on a cap they can't finish under, so their warmup cap can't be lower.
  warmup_cap_param: string;
  warmup_cap: number;
};

// The LLM config constants. They're module-level, but a top-level `const`/`let` would throw
// "already declared" when a cell rerun re-injects the flat bundle and nothing would re-attach
// (AGENTS.md "No Outer-Level consts in Typescript"). Functions are re-injection-safe, so the
// config is built once and memoized on window here; destructure what you need into a
// function-local `const` at each use site. Providers' key order also drives the dropdown.
export function llm_config_constants(): {
  PROVIDERS: { [key: string]: ProviderMeta };
  DEFAULT_PROVIDER: string;
  CONFIG_KEY: string; // localStorage key
} {
  return (window as any).__snp_llm_config_constants ||= {
  PROVIDERS: {
  openai: {
    label: "OpenAI",
    style: "openai",
    default_url: "https://api.openai.com/v1/chat/completions",
    custom_endpoint: false,
    // gpt-4o and luna are both ~1s warmed; gpt-4o has no reasoning overhead.
    models: ["gpt-4o", "gpt-5.6-luna", "gpt-5.2", "gpt-5.4-nano"],
    default_model: "gpt-4o",
    // gpt-4o rejects reasoning_effort, so the default is "(none)". NOTE effort is part of
    // luna's prompt-cache key, so warm and real requests must agree on it (they do; every
    // request goes through the same body()).
    efforts: ["", "minimal", "low", "medium", "high"],
    default_effort: "",
    custom_effort: false,
    warmup_cap_param: "max_completion_tokens",
    warmup_cap: 16,
  },
  anthropic: {
    label: "Anthropic",
    style: "anthropic",
    default_url: "https://api.anthropic.com/v1/messages",
    custom_endpoint: false,
    // Raw Anthropic Messages API. Haiku ~700-2200ms warmed (median ~900ms), no thinking by default.
    models: ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-4-8"],
    default_model: "claude-haiku-4-5",
    efforts: [], // no reasoning_effort knob on the Messages API
    default_effort: "",
    custom_effort: false,
    warmup_cap_param: "",
    warmup_cap: 0,
  },
  // Gemini via Google's OpenAI-compatibility layer rather than the native generateContent
  // API: it shares openai_style (including reasoning_effort and OpenAI-shaped usage), so
  // there's no second response shape to maintain.
  gemini: {
    label: "Google Gemini",
    style: "openai",
    default_url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    custom_endpoint: false,
    models: ["gemini-2.5-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-2.5-pro"],
    // Gemini thinks by default, which is slow for live preview. 'none' turns thinking off
    // entirely but is accepted *only* by Gemini 2.5 non-Pro, so the fastest safe default is
    // 2.5 Flash + none rather than a newer model. Switching to any Gemini 3 model (or 2.5
    // Pro) means also raising effort off 'none', which those reject.
    default_model: "gemini-2.5-flash",
    efforts: ["", "none", "minimal", "low", "medium", "high"],
    default_effort: "none",
    custom_effort: false,
    warmup_cap_param: "max_completion_tokens",
    warmup_cap: 16,
  },
  // Bedrock's OpenAI-compatible Chat Completions API, authed with a Bedrock API key as a
  // bearer token (AWS_BEARER_TOKEN_BEDROCK) — that's what lets us skip SigV4 request signing
  // in the browser. AWS recommends the bedrock-mantle endpoint over bedrock-runtime
  // (https://bedrock-runtime.{region}.amazonaws.com/v1/chat/completions), which also takes a
  // Bedrock API key. The region is baked into the host, so the endpoint box is shown for editing.
  bedrock: {
    label: "AWS Bedrock",
    style: "openai",
    default_url: "https://bedrock-mantle.us-east-1.api.aws/v1/chat/completions",
    custom_endpoint: true,
    models: ["openai.gpt-oss-120b", "openai.gpt-oss-20b", "us.anthropic.claude-sonnet-4-6"],
    default_model: "openai.gpt-oss-120b",
    efforts: ["", "low", "medium", "high"],
    default_effort: "",
    custom_effort: false,
    warmup_cap_param: "max_completion_tokens",
    warmup_cap: 16,
  },
  openrouter: {
    label: "OpenRouter",
    style: "openai",
    default_url: "https://openrouter.ai/api/v1/chat/completions",
    custom_endpoint: false,
    models: ["openai/gpt-4o", "anthropic/claude-haiku-4.5", "google/gemini-2.5-flash", "inception/mercury-coder"],
    default_model: "openai/gpt-4o",
    efforts: ["", "minimal", "low", "medium", "high"],
    default_effort: "",
    custom_effort: false,
    warmup_cap_param: "max_completion_tokens",
    warmup_cap: 16,
  },
  inception: {
    label: "Inception",
    style: "openai",
    default_url: "https://api.inceptionlabs.ai/v1/chat/completions",
    custom_endpoint: false,
    // diffusion LLM: ~300-600ms per request, ~2x faster than warmed gpt-4o
    models: ["mercury-2"],
    default_model: "mercury-2",
    // 'instant' seems to miss simple things; 'low' costs ~150ms more but is smarter.
    efforts: ["", "instant", "low", "medium", "high"],
    default_effort: "low",
    custom_effort: false,
    warmup_cap_param: "max_tokens",
    warmup_cap: 1,
  },
  cerebras: {
    label: "Cerebras",
    style: "openai",
    default_url: "https://api.cerebras.ai/v1/chat/completions",
    custom_endpoint: false,
    // ~270-680ms warmed: Mercury-class speed from a 120B reasoning model
    models: ["gpt-oss-120b"],
    default_model: "gpt-oss-120b",
    efforts: ["low", "medium", "high"], // 'none' is rejected; only low/medium/high
    default_effort: "low",
    custom_effort: false,
    warmup_cap_param: "max_completion_tokens",
    warmup_cap: 16,
  },
  openai_compatible: {
    label: "OpenAI Compatible",
    style: "openai",
    default_url: "",
    custom_endpoint: true,
    models: [],
    default_model: "",
    // Suggestions only: an arbitrary endpoint may take effort values we don't know about, so
    // this one is typable rather than a fixed list.
    efforts: ["", "minimal", "none", "low", "medium", "high"],
    default_effort: "",
    custom_effort: true,
    warmup_cap_param: "max_completion_tokens",
    warmup_cap: 16,
  },
  },
  DEFAULT_PROVIDER: "openai",
  CONFIG_KEY: "snp_llm_config",
  };
}

function default_settings(provider: string): LLMProviderSettings {
  const { PROVIDERS } = llm_config_constants();
  const meta = PROVIDERS[provider];
  return {
    model: meta.default_model,
    effort: meta.default_effort,
    // Prefilled for custom_endpoint providers so e.g. a Bedrock user only edits the region.
    endpoint: meta.custom_endpoint ? meta.default_url : "",
    api_key: "",
  };
}

// Always returns settings for every known provider, so callers can read straight through
// without defaulting at each use site.
export function get_llm_config(): LLMConfig {
  const { PROVIDERS, DEFAULT_PROVIDER, CONFIG_KEY } = llm_config_constants();
  let stored: any = {};
  try { stored = JSON.parse(window.localStorage.getItem(CONFIG_KEY) || "{}") || {}; } catch { /* ignore */ }

  const by_provider: { [provider: string]: LLMProviderSettings } = {};
  Object.keys(PROVIDERS).forEach(provider => {
    by_provider[provider] = { ...default_settings(provider), ...(stored.by_provider?.[provider] || {}) };
  });
  migrate_old_config_shapes(by_provider, stored);

  return {
    provider: PROVIDERS[stored.provider] ? stored.provider : DEFAULT_PROVIDER,
    by_provider,
  };
}

// Older shapes of the stored config, newest first:
//   - one flat model/effort/endpoint for the selected provider, plus an api_keys map
//   - no config at all; the OpenAI key sat in its own localStorage slot
// Both only fill gaps, so a real per-provider setting always wins.
function migrate_old_config_shapes(by_provider: { [provider: string]: LLMProviderSettings }, stored: any): void {
  Object.keys(stored.api_keys || {}).forEach(provider => {
    if (by_provider[provider] && !by_provider[provider].api_key) {
      by_provider[provider].api_key = stored.api_keys[provider];
    }
  });

  const flat = by_provider[stored.provider];
  if (!stored.by_provider && flat) {
    if (stored.model) flat.model = stored.model;
    if (stored.effort) flat.effort = stored.effort;
    if (stored.endpoint) flat.endpoint = stored.endpoint;
  }

  const legacy_openai_key = window.localStorage.getItem("OPENAI_API_KEY");
  if (legacy_openai_key && !by_provider.openai.api_key) by_provider.openai.api_key = legacy_openai_key;
}

export function save_llm_config(config: LLMConfig): void {
  const { CONFIG_KEY } = llm_config_constants();
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

// The active provider's settings.
export function current_llm_settings(): LLMProviderSettings {
  const config = get_llm_config();
  return config.by_provider[config.provider];
}

export function set_llm_provider(provider: string): void {
  save_llm_config({ ...get_llm_config(), provider });
}

// Merge changes into one provider's settings, leaving every other provider's untouched.
export function update_llm_provider_settings(provider: string, changes: Partial<LLMProviderSettings>): void {
  const config = get_llm_config();
  config.by_provider[provider] = { ...config.by_provider[provider], ...changes };
  save_llm_config(config);
}

// Each provider shapes its own request and response; the message contents are the only
// provider-independent part (message_contents[0] is the big shared notebook prefix, the
// optional second entry is the ask — see prompt_prefix_for_llm in ai_panel.ts).
type ProviderConfig = {
  url: string,
  headers: (api_key: string) => { [name: string]: string },
  body: (message_contents: string[], is_warmup: boolean) => { [key: string]: any },
  reply_from: (response: any) => string,
  usage_summary: (response: any) => string, // for the console, to tell cache misses from long generations
};

// The OpenAI chat-completions shape, shared by every OpenAI-compatible provider.
function openai_style(url: string, model: string, effort: string, warmup_cap_param: string, warmup_cap: number): ProviderConfig {
  return {
    url,
    headers: (api_key) => ({ 'Authorization': `Bearer ${api_key}` }),
    body: (message_contents, is_warmup) => ({
      'model': model,
      ...(effort ? { 'reasoning_effort': effort } : {}),
      'messages': message_contents.map(content => ({ 'role': 'user', content: content })),
      'stream': false,
      ...(is_warmup && warmup_cap_param ? { [warmup_cap_param]: warmup_cap } : {}),
    }),
    reply_from: (response) => response['choices'][0]['message']['content'],
    // Inception doesn't report cached tokens (undefined is expected there).
    usage_summary: (response) => {
      const usage = response['usage'];
      return `cached ${usage?.['prompt_tokens_details']?.['cached_tokens']} of ${usage?.['prompt_tokens']} prompt; ${usage?.['completion_tokens']} completion`;
    },
  };
}

// The raw Anthropic Messages API shape.
function anthropic_style(url: string, model: string): ProviderConfig {
  return {
    url,
    headers: (api_key) => ({
      'x-api-key': api_key,
      'anthropic-version': '2023-06-01',
      // Required for the API to accept requests directly from a browser page (CORS).
      'anthropic-dangerous-direct-browser-access': 'true',
    }),
    body: (message_contents, is_warmup) => ({
      'model': model,
      // max_tokens is required. 0 is the official cache pre-warm: prefill runs (writing the
      // cache), returns immediately with empty content, and no output tokens are billed.
      'max_tokens': is_warmup ? 0 : 4096,
      'messages': message_contents.map((content, i) => ({
        'role': 'user', // consecutive user messages are allowed; the API combines them into one turn
        'content': [{
          'type': 'text',
          'text': content,
          // Anthropic caching is explicit: mark the prefix message as the cache breakpoint.
          // Haiku 4.5's minimum cacheable prefix is 4096 tokens — a small notebook below
          // that silently won't cache (fine; small prefills are fast anyway). 5-minute TTL.
          ...(i === 0 ? { 'cache_control': { 'type': 'ephemeral' } } : {}),
        }],
      })),
    }),
    reply_from: (response) => (response['content'].find((block: any) => block['type'] === 'text') || {})['text'] || '',
    usage_summary: (response) => {
      const usage = response['usage'];
      return `cache_read ${usage?.['cache_read_input_tokens']}, cache_write ${usage?.['cache_creation_input_tokens']}, uncached ${usage?.['input_tokens']} prompt; ${usage?.['output_tokens']} completion`;
    },
  };
}

// Provider config for the current selection (from get_llm_config / the AI config panel).
function provider_config(): ProviderConfig & { provider: string } {
  const { PROVIDERS, DEFAULT_PROVIDER } = llm_config_constants();
  const config = get_llm_config();
  const meta = PROVIDERS[config.provider] || PROVIDERS[DEFAULT_PROVIDER];
  const settings = config.by_provider[config.provider];
  // The stored endpoint is only consulted for custom_endpoint providers, so it can never pin
  // a normal provider to a URL this file has since changed.
  const url = meta.custom_endpoint ? (settings.endpoint.trim() || meta.default_url) : meta.default_url;
  const model = settings.model || meta.default_model;
  const base = meta.style === "anthropic"
    ? anthropic_style(url, model)
    : openai_style(url, model, settings.effort, meta.warmup_cap_param, meta.warmup_cap);
  return { provider: config.provider, ...base };
}

// The API key for the active provider: the user's own key (localStorage) wins, else the
// server-provided key the kernel passed in.
export function llm_api_key(server_keys: LLMApiKeys): string {
  const config = get_llm_config();
  const own = config.by_provider[config.provider].api_key.trim();
  return own || server_keys[config.provider] || '';
}

// Takes the prompt as a list of user-message contents rather than one string: some models
// (gpt-5.6-luna) only prompt-cache whole messages, so the big shared notebook prefix must be
// its own message — sent alone to warm, then unchanged while the final ask message varies.
// (gpt-4o, Mercury, and Anthropic cache by prefix and hit either way.)
// Returns the XHR so callers can abort() a request that's no longer wanted (aborting fires
// neither success nor failure). is_warmup makes a cache-warming request whose reply we
// don't care about (each provider caps or suppresses the completion its own way).
export function prompt_llm(message_contents: string[], success: (reply: string) => void, failure: () => void, api_keys: LLMApiKeys, opts: { is_warmup?: boolean } = {}): XMLHttpRequest {

  const config = provider_config();

  const xhr = new XMLHttpRequest();

  const request_start_time = new Date().getTime();

  function handle_llm_response() {
    console.log('LLM request time (ms)', new Date().getTime() - request_start_time);
    if (xhr.status == 200) {
      const raw_response = JSON.parse(xhr.responseText);
      console.log('LLM tokens:', config.usage_summary(raw_response));
      const reply = config.reply_from(raw_response);
      console.log('LLM reply', reply);
      success(reply);
    } else {
      console.warn('prompt error', xhr.responseText);
      failure();
    }
  }

  xhr.open('POST', config.url);
  xhr.setRequestHeader('Content-Type', 'application/json');
  const headers = config.headers(llm_api_key(api_keys));
  Object.keys(headers).forEach(name => xhr.setRequestHeader(name, headers[name]));
  xhr.addEventListener('load', handle_llm_response);
  xhr.addEventListener('error',   () => { console.warn('prompt error', xhr); failure() });
  xhr.addEventListener('timeout', () => { console.warn('prompt timeout'); failure() });
  xhr.timeout = 60*1000;

  console.log('LLM prompt', message_contents.join('\n\n---(next message)---\n\n'));
  xhr.send(JSON.stringify(config.body(message_contents, !!opts.is_warmup)));

  return xhr;
}
