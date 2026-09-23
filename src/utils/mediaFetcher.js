const path = require('node:path');
const axios = require('axios');

const MAX_FILE_SIZE = 25 * 1024 * 1024;

class MediaFetcherError extends Error {
  constructor(code, message, mediaUrl, cause) {
    super(message);
    this.name = 'MediaFetcherError';
    this.code = code;
    this.mediaUrl = mediaUrl;
    this.cause = cause;
  }
}

function extensionFromContentType(contentType) {
  const type = (contentType || '').split(';')[0].toLowerCase();
  return {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov'
  }[type] || '.bin';
}

function getSafeExtension(mediaUrl, contentType) {
  try {
    const extension = path.extname(new URL(mediaUrl).pathname).toLowerCase();
    if (/^\.[a-z0-9]{1,5}$/.test(extension)) return extension;
  } catch {
    // Gunakan extension dari Content-Type jika URL tidak memiliki path valid.
  }
  return extensionFromContentType(contentType);
}

async function fetchMediaBuffer(mediaUrl) {
  try {
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxContentLength: MAX_FILE_SIZE,
      maxBodyLength: MAX_FILE_SIZE,
      headers: {
        'User-Agent': 'Discord-Twitter-Media-Forwarder/1.0'
      },
      validateStatus: (status) => status >= 200 && status < 300
    });

    const buffer = Buffer.from(response.data);
    if (buffer.length > MAX_FILE_SIZE) {
      throw new MediaFetcherError(
        'TOO_LARGE',
        'File melebihi batas 25 MB Discord.',
        mediaUrl
      );
    }

    const contentType = response.headers['content-type'] || '';
    return {
      buffer,
      contentType,
      extension: getSafeExtension(mediaUrl, contentType)
    };
  } catch (error) {
    if (error instanceof MediaFetcherError) throw error;

    if (error.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED'
      || error.code === 'ERR_BAD_RESPONSE'
      || error.message?.toLowerCase().includes('maxcontentlength')) {
      throw new MediaFetcherError(
        'TOO_LARGE',
        'File melebihi batas 25 MB Discord.',
        mediaUrl,
        error
      );
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new MediaFetcherError('TIMEOUT', 'Media terlalu lama diambil.', mediaUrl, error);
    }
    throw new MediaFetcherError('FETCH_ERROR', 'Media gagal diambil.', mediaUrl, error);
  }
}

module.exports = { fetchMediaBuffer, MediaFetcherError, MAX_FILE_SIZE };
