const ALLOWED_HOSTS = new Set([
  'twitter.com',
  'www.twitter.com',
  'x.com',
  'www.x.com',
  'fixupx.com',
  'www.fixupx.com',
  'fxtwitter.com',
  'www.fxtwitter.com'
]);

/**
 * Mengambil ID tweet dari URL Twitter/X, fixupx.com, atau fxtwitter.com.
 */
function parseTweetUrl(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'URL tweet wajib diisi.' };
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return { valid: false, error: 'Format URL tidak valid.' };
  }

  const hostname = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || !ALLOWED_HOSTS.has(hostname)) {
    return {
      valid: false,
      error: 'URL harus berasal dari twitter.com, x.com, fixupx.com, atau fxtwitter.com.'
    };
  }

  const match = url.pathname.match(/\/status\/(\d+)(?:\/|$)/i);
  if (!match) {
    return { valid: false, error: 'URL tersebut bukan URL tweet/status yang valid.' };
  }

  return {
    valid: true,
    tweetId: match[1],
    url: url.toString()
  };
}

module.exports = { parseTweetUrl };
