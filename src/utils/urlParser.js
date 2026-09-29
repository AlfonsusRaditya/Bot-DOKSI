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
 * Extracts the tweet ID from a Twitter/X, fixupx.com, or fxtwitter.com URL.
 */
function parseTweetUrl(input) {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'Tweet URL is required.' };
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return { valid: false, error: 'Invalid URL format.' };
  }

  const hostname = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || !ALLOWED_HOSTS.has(hostname)) {
    return {
      valid: false,
      error: 'URL must be from twitter.com, x.com, fixupx.com, or fxtwitter.com.'
    };
  }

  const match = url.pathname.match(/\/status\/(\d+)(?:\/|$)/i);
  if (!match) {
    return { valid: false, error: 'Not a valid tweet/status URL.' };
  }

  return {
    valid: true,
    tweetId: match[1],
    url: url.toString()
  };
}

module.exports = { parseTweetUrl };
