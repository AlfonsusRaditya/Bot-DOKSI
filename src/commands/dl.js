const { AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { parseTweetUrl } = require('../utils/urlParser');
const { fetchTweet, extractMedia, TweetFetcherError } = require('../utils/tweetFetcher');
const { fetchMediaBuffer, MediaFetcherError } = require('../utils/mediaFetcher');

const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const COLORS = {
  loading: 0x5865f2,
  success: 0x57f287,
  error: 0xed4245
};

function createEmbed(title, description, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp();
}

function getAuthorInfo(tweet) {
  const author = tweet?.author || {};
  const username = author.screen_name || author.username || author.handle || '';
  const displayName = author.name || username || 'Unknown account';
  return { username, displayName };
}

function truncateText(text, maxLength = 1_000) {
  if (!text) return 'Tweet has no text.';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function createEmbedLink(tweet, tweetId) {
  const { username } = getAuthorInfo(tweet);
  return `https://fixupx.com/${username || 'i'}/status/${tweetId}`;
}

function createSuccessEmbed(tweet, mediaCount) {
  const { username, displayName } = getAuthorInfo(tweet);
  const embed = createEmbed(
    'Media delivered',
    truncateText(tweet.text),
    COLORS.success
  );

  embed.addFields(
    { name: 'Account', value: username ? `${displayName} (@${username})` : displayName, inline: true },
    { name: 'Media count', value: String(mediaCount), inline: true }
  );

  if (tweet.url) embed.setURL(tweet.url);
  if (tweet.author?.avatar_url) embed.setThumbnail(tweet.author.avatar_url);
  return embed;
}

function getErrorDescription(error) {
  if (error instanceof TweetFetcherError) {
    if (error.code === 'NOT_FOUND') return 'Tweet not found or private.';
    if (error.code === 'TIMEOUT') return 'fxtwitter API timed out. Please try again later.';
    if (error.code === 'API_ERROR' || error.code === 'NETWORK_ERROR') {
      return 'fxtwitter API is unavailable. Please try again later.';
    }
  }
  if (error instanceof MediaFetcherError) {
    if (error.code === 'TIMEOUT') return 'Media fetch timed out. Please try again later.';
    return 'Failed to fetch media from the source URL.';
  }
  return 'An error occurred while fetching media. Please try again later.';
}

function createAttachments(mediaBuffers) {
  return mediaBuffers.map((media, index) => new AttachmentBuilder(
    media.buffer,
    { name: `media-${index + 1}${media.extension}` }
  ));
}

function splitIntoChunks(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function execute(message, urlInput) {
  const loading = await message.reply({
    embeds: [createEmbed('Fetching media', 'Fetching tweet and media from fxtwitter...', COLORS.loading)]
  });

  try {
    const parsed = parseTweetUrl(urlInput);
    if (!parsed.valid) {
      await loading.edit({ embeds: [createEmbed('Invalid URL', parsed.error, COLORS.error)] });
      return;
    }

    const tweet = await fetchTweet(parsed.tweetId);
    const media = extractMedia(tweet);
    if (media.length === 0) {
      await loading.edit({
        embeds: [createEmbed('No media found', 'This tweet contains only text or its media is unavailable.', COLORS.error)]
      });
      return;
    }

    const controller = new AbortController();
    const isAbortError = (error) => (
      error?.code === 'ERR_CANCELED'
      || error?.name === 'CanceledError'
      || error?.message?.toLowerCase().includes('canceled')
    );
    const tasks = media.map((item) => (
      fetchMediaBuffer(item.url, { signal: controller.signal }).catch((error) => {
        // An abort after early exit is not a real failure.
        if (isAbortError(error)) return { aborted: true };
        throw error;
      })
    ));

    let mediaBuffers;
    try {
      mediaBuffers = await Promise.all(tasks);
    } catch (error) {
      controller.abort();
      if (error instanceof MediaFetcherError && error.code === 'TOO_LARGE') {
        await message.channel.send({ content: createEmbedLink(tweet, parsed.tweetId) });
        await loading.delete().catch(() => {});
        await message.delete().catch(() => {});
        return;
      }
      throw error;
    }

    const attachments = createAttachments(mediaBuffers);
    const chunks = splitIntoChunks(attachments, MAX_ATTACHMENTS_PER_MESSAGE);
    const successEmbed = createSuccessEmbed(tweet, media.length);

    for (let index = 0; index < chunks.length; index += 1) {
      const payload = { files: chunks[index] };
      if (index === 0) payload.embeds = [successEmbed];
      await message.channel.send(payload);
    }

    await loading.delete().catch(() => {});
    await message.delete().catch(() => {});
  } catch (error) {
    console.error('Error running !dl:', error);
    await loading.edit({
      embeds: [createEmbed('Failed to fetch media', getErrorDescription(error), COLORS.error)]
    }).catch(() => {});
  }
}

module.exports = { execute };
