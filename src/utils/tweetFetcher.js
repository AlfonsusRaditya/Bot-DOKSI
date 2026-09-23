const axios = require('axios');

const FXTWITTER_API = 'https://api.fxtwitter.com/status';

class TweetFetcherError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'TweetFetcherError';
    this.code = code;
    this.cause = cause;
  }
}

async function fetchTweet(tweetId) {
  try {
    const response = await axios.get(`${FXTWITTER_API}/${encodeURIComponent(tweetId)}`, {
      timeout: 15_000,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Discord-Twitter-Media-Forwarder/1.0'
      },
      validateStatus: () => true
    });

    const data = response.data;
    const apiCode = Number(data?.code);
    if (response.status === 404 || response.status === 401 || response.status === 403 || apiCode === 404) {
      throw new TweetFetcherError('NOT_FOUND', 'Tweet tidak ditemukan atau bersifat private.');
    }
    if (response.status < 200 || response.status >= 300 || !data?.tweet) {
      throw new TweetFetcherError(
        'API_ERROR',
        data?.message || 'API fxtwitter tidak dapat mengambil tweet tersebut.'
      );
    }

    return data.tweet;
  } catch (error) {
    if (error instanceof TweetFetcherError) throw error;

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new TweetFetcherError('TIMEOUT', 'API fxtwitter terlalu lama merespons.', error);
    }
    if (error.response) {
      throw new TweetFetcherError('API_ERROR', 'API fxtwitter sedang tidak tersedia.', error);
    }
    throw new TweetFetcherError('NETWORK_ERROR', 'Tidak dapat terhubung ke API fxtwitter.', error);
  }
}

function extractMedia(tweet) {
  const media = tweet?.media || {};
  const entries = [
    ...(Array.isArray(media.all)
      ? media.all.map((item) => ({
        ...item,
        type: item.type === 'video' || item.type === 'gif' ? item.type : 'image'
      }))
      : []),
    ...(Array.isArray(media.photos) ? media.photos.map((item) => ({ ...item, type: 'image' })) : []),
    ...(Array.isArray(media.videos) ? media.videos.map((item) => ({ ...item, type: 'video' })) : []),
    ...(Array.isArray(media.gifs) ? media.gifs.map((item) => ({ ...item, type: 'gif' })) : []),
    ...(Array.isArray(media.animated_gifs)
      ? media.animated_gifs.map((item) => ({ ...item, type: 'gif' }))
      : [])
  ];

  const seen = new Set();
  return entries
    .filter((item) => typeof item.url === 'string' && item.url.startsWith('http'))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
    .map((item, index) => ({
      url: item.url,
      type: item.type,
      index: index + 1,
      thumbnailUrl: item.thumbnail_url
    }));
}

module.exports = { fetchTweet, extractMedia, TweetFetcherError };
