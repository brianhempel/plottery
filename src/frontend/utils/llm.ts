// (window as any).snp_ai_provider = "inception"
// (window as any).snp_ai_provider = "cerebras"
// (window as any).snp_ai_provider = "anthropic"
(window as any).snp_ai_provider = "openai"

export type LLMApiKeys = { [provider: string]: string };

export function fetch_llm_api_key(): string | null {
  return window.localStorage.getItem('OPENAI_API_KEY');
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
// warmup_cap_param differs because 'max_tokens' is rejected by newer OpenAI models while
// Mercury ignores 'max_completion_tokens'; reasoning models burn ~16 tokens before emitting
// anything and 400 on a cap they can't finish under, so their cap can't be lower.
function openai_style(url: string, query_params: { [key: string]: any }, warmup_cap_param: string, warmup_cap: number): ProviderConfig {
  return {
    url,
    headers: (api_key) => ({ 'Authorization': `Bearer ${api_key}` }),
    body: (message_contents, is_warmup) => ({
      ...query_params,
      'messages': message_contents.map(content => ({ 'role': 'user', content: content })),
      'stream': false,
      ...(is_warmup ? { [warmup_cap_param]: warmup_cap } : {}),
    }),
    reply_from: (response) => response['choices'][0]['message']['content'],
    // Inception doesn't report cached tokens (undefined is expected there).
    usage_summary: (response) => {
      const usage = response['usage'];
      return `cached ${usage?.['prompt_tokens_details']?.['cached_tokens']} of ${usage?.['prompt_tokens']} prompt; ${usage?.['completion_tokens']} completion`;
    },
  };
}

// Provider registry, selected by the snp_ai_provider flag at the top of this file.
function provider_config(): ProviderConfig & { provider: string } {
  const provider: string = (window as any).snp_ai_provider || "openai";
  const configs: { [name: string]: ProviderConfig } = {
    openai: openai_style(
      'https://api.openai.com/v1/chat/completions',
      {
        'model': 'gpt-4o', // gpt-4o and luna are both ~1s warmed; gpt-4o has no reasoning overhead
        // 'model': 'gpt-5.6-luna',
        // 'model': 'gpt-5.2',
        // 'model': 'gpt-5.4-nano',
        // 'reasoning_effort': 'none', // for gpt-5* reasoning models; gpt-4o rejects the param.
        //                             // NOTE it's part of luna's prompt-cache key, so warm and
        //                             // real requests must agree on it (they do; it's every request).
      },
      'max_completion_tokens', 16,
    ),
    inception: openai_style(
      'https://api.inceptionlabs.ai/v1/chat/completions',
      {
        'model': 'mercury-2', // diffusion LLM: ~300-600ms per request, ~2x faster than warmed gpt-4o
        // 'reasoning_effort': 'instant', // seems to miss simple things
        'reasoning_effort': 'low', // 'low' costs ~150ms more, but GPT-4o similar and sometimes smarter
      },
      'max_tokens', 1,
    ),
    cerebras: openai_style(
      'https://api.cerebras.ai/v1/chat/completions',
      {
        'model': 'gpt-oss-120b', // ~270-680ms warmed: Mercury-class speed from a 120B reasoning model
        'reasoning_effort': 'low', // 'none' is rejected; only low/medium/high
      },
      'max_completion_tokens', 16,
    ),
    // Raw Anthropic Messages API. ~700-2200ms warmed (median ~900ms), 8/8 on the edit suite.
    anthropic: {
      url: 'https://api.anthropic.com/v1/messages',
      headers: (api_key) => ({
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01',
        // Required for the API to accept requests directly from a browser page (CORS).
        'anthropic-dangerous-direct-browser-access': 'true',
      }),
      body: (message_contents, is_warmup) => ({
        'model': 'claude-haiku-4-5', // no thinking by default
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
    },
  };
  if (!configs[provider]) { throw new Error(`snp: unknown snp_ai_provider '${provider}'`); }
  return { provider, ...configs[provider] };
}

// The API key for the active provider, from the per-provider keys the kernel passed in.
export function llm_api_key(api_keys: LLMApiKeys): string {
  return api_keys[provider_config().provider] || '';
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
