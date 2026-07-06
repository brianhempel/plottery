export function fetch_llm_api_key(): string | null {
  return window.localStorage.getItem('OPENAI_API_KEY');
}

export function prompt_llm(prompt: string, success: (reply: string) => void, failure: () => void, api_key: string): void {

  const xhr = new XMLHttpRequest();

  function handle_llm_response() {
    if (xhr.status == 200) {
      const raw_response = JSON.parse(xhr.responseText);
      const reply = raw_response['choices'][0]['message']['content'];
      console.log('LLM reply', reply);
      success(reply);
    } else {
      console.warn('prompt error', xhr.responseText);
      failure();
    }
  }

  xhr.open('POST', 'https://api.openai.com/v1/chat/completions');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', `Bearer ${api_key}`);
  xhr.addEventListener('load', handle_llm_response);
  xhr.addEventListener('error',   () => { console.warn('prompt error', xhr); failure() });
  xhr.addEventListener('timeout', () => { console.warn('prompt timeout'); failure() });
  xhr.timeout = 60*1000;

  const query = {
      'model':    'gpt-4o',
      // 'model':    'gpt-5.4-nano',
      'messages': [{ 'role': 'user', content: prompt }],
      'stream':   false,
  };

  console.log('LLM prompt', prompt);
  xhr.send(JSON.stringify(query));
}