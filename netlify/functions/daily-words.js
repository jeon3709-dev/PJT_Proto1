// Netlify Function: Anthropic API 프록시
// API 키는 서버 환경변수에서만 읽으므로 브라우저에 노출되지 않습니다.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: { message: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. Netlify 대시보드 → Site configuration → Environment variables 를 확인하세요.' }
      }),
    };
  }

  try {
    const payload = JSON.parse(event.body);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 24000);

    let response;
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const data = await response.json();

    // Log a truncated version of the model text for debugging (helps diagnose JSON issues)
    try {
      const modelText = data?.content?.[0]?.text;
      if (modelText) {
        console.error('Anthropic output (first 2000 chars):\n', modelText.slice(0, 2000));
      } else {
        console.error('Anthropic output not found in response JSON.');
      }
    } catch (logErr) {
      console.error('Error while logging model output:', logErr?.message || logErr);
    }

    return {
      statusCode: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    return {
      statusCode: isTimeout ? 504 : 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: isTimeout ? 'API 응답 시간 초과 (9s). 잠시 후 재시도하세요.' : err.message } }),
    };
  }
};
