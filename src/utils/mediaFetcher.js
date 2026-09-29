const path = require('node:path');
const axios = require('axios');

const MAX_FILE_SIZE = 20 * 1024 * 1024;

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
    // Fall back to Content-Type when the URL has no usable path.
  }
  return extensionFromContentType(contentType);
}

async function fetchMediaBuffer(mediaUrl, options = {}) {
  const { signal } = options;
  if (signal?.aborted) {
    const abortError = new Error('canceled');
    abortError.code = 'ERR_CANCELED';
    throw abortError;
  }

  // Fast HEAD check: skip the body download when content-length is already over the limit.
  try {
    const head = await axios.head(mediaUrl, {
      timeout: 10_000,
      signal,
      headers: {
        'User-Agent': 'Discord-Twitter-Media-Forwarder/1.0'
      },
      validateStatus: (status) => status >= 200 && status < 300
    });
    const contentLength = Number(head.headers['content-length']);
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE) {
      throw new MediaFetcherError(
        'TOO_LARGE',
        'File exceeds the 20 MB Discord limit.',
        mediaUrl
      );
    }
  } catch (error) {
    if (error instanceof MediaFetcherError) throw error;
    // Ignore abort / unsupported HEAD (403/405/timeout) and continue to GET.
    const isAbort = error?.code === 'ERR_CANCELED'
      || error?.name === 'CanceledError'
      || error?.message?.toLowerCase().includes('canceled');
    if (isAbort) throw error;
  }

  try {
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      timeout: 30_000,
      maxContentLength: MAX_FILE_SIZE,
      maxBodyLength: MAX_FILE_SIZE,
      signal,
      headers: {
        'User-Agent': 'Discord-Twitter-Media-Forwarder/1.0'
      },
      validateStatus: (status) => status >= 200 && status < 300
    });

    const buffer = Buffer.from(response.data);
    if (buffer.length > MAX_FILE_SIZE) {
      throw new MediaFetcherError(
        'TOO_LARGE',
        'File exceeds the 20 MB Discord limit.',
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

    const isAbort = error?.code === 'ERR_CANCELED'
      || error?.name === 'CanceledError'
      || error?.message?.toLowerCase().includes('canceled');
    if (isAbort) throw error;

    if (error.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED'
      || error.code === 'ERR_BAD_RESPONSE'
      || error.message?.toLowerCase().includes('maxcontentlength')) {
      throw new MediaFetcherError(
        'TOO_LARGE',
        'File exceeds the 20 MB Discord limit.',
        mediaUrl,
        error
      );
    }
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new MediaFetcherError('TIMEOUT', 'Media fetch timed out.', mediaUrl, error);
    }
    throw new MediaFetcherError('FETCH_ERROR', 'Failed to fetch media.', mediaUrl, error);
  }
}

module.exports = { fetchMediaBuffer, MediaFetcherError, MAX_FILE_SIZE };
