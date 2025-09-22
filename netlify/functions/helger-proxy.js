// Netlify Function: helger-proxy
// Proxies requests to Helger Peppol API to avoid browser CORS issues

export async function handler(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  try {
    const base = 'https://peppol.helger.com/api';

    // Expect full API path in `endpoint` query param, e.g. `/ppidexistence/digitprod/...`
    const endpoint = (event.queryStringParameters && event.queryStringParameters.endpoint) || '';

    // Very basic allow-list of endpoints
    const allowed = ['/ppidexistence/', '/businesscard/', '/smpquery/'];
    const isAllowed = allowed.some(p => endpoint.startsWith(p));
    if (!endpoint || !isAllowed) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or missing endpoint parameter.' }),
      };
    }

    const targetUrl = `${base}${endpoint}`;
    const resp = await fetch(targetUrl, { method: 'GET' });

    const text = await resp.text();
    // Try to forward status and JSON body if possible
    return {
      statusCode: resp.status,
      headers: {
        ...headers,
        'Content-Type': resp.headers.get('content-type') || 'application/json',
      },
      body: text,
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Upstream request failed', details: String(err) }),
    };
  }
}
