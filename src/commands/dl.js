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
  const displayName = author.name || username || 'Akun tidak diketahui';
  return { username, displayName };
}

function truncateText(text, maxLength = 1_000) {
  if (!text) return 'Tweet tidak memiliki teks.';
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function createSuccessEmbed(tweet, mediaCount) {
  const { username, displayName } = getAuthorInfo(tweet);
  const embed = createEmbed(
    '✅ Media Berhasil Dikirim',
    truncateText(tweet.text),
    COLORS.success
  );

  embed.addFields(
    { name: 'Akun', value: username ? `${displayName} (@${username})` : displayName, inline: true },
    { name: 'Jumlah Media', value: String(mediaCount), inline: true }
  );

  if (tweet.url) embed.setURL(tweet.url);
  if (tweet.author?.avatar_url) embed.setThumbnail(tweet.author.avatar_url);
  return embed;
}

function getErrorDescription(error) {
  if (error instanceof MediaFetcherError && error.code === 'TOO_LARGE') {
    return `File terlalu besar untuk dikirim di Discord (maksimal 25 MB).\nURL media langsung:\n${error.mediaUrl}`;
  }
  if (error instanceof TweetFetcherError) {
    if (error.code === 'NOT_FOUND') return 'Tweet tidak ditemukan atau bersifat private.';
    if (error.code === 'TIMEOUT') return 'API fxtwitter terlalu lama merespons. Coba lagi nanti.';
    if (error.code === 'API_ERROR' || error.code === 'NETWORK_ERROR') {
      return 'API fxtwitter sedang tidak tersedia atau gagal dihubungi. Coba lagi nanti.';
    }
  }
  if (error instanceof MediaFetcherError) {
    if (error.code === 'TIMEOUT') return 'Media terlalu lama diambil. Coba lagi nanti.';
    return 'Media gagal diambil dari URL sumbernya.';
  }
  return 'Terjadi kesalahan saat mengambil media. Silakan coba lagi nanti.';
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
    embeds: [createEmbed('⏳ Mengambil Media', 'Sedang mengambil data tweet dan media dari fxtwitter...', COLORS.loading)]
  });

  try {
    const parsed = parseTweetUrl(urlInput);
    if (!parsed.valid) {
      await loading.edit({ embeds: [createEmbed('❌ URL Tidak Valid', parsed.error, COLORS.error)] });
      return;
    }

    const tweet = await fetchTweet(parsed.tweetId);
    const media = extractMedia(tweet);
    if (media.length === 0) {
      await loading.edit({
        embeds: [createEmbed('❌ Media Tidak Ditemukan', 'Tweet tersebut hanya berisi teks atau medianya tidak tersedia.', COLORS.error)]
      });
      return;
    }

    const mediaBuffers = await Promise.all(media.map((item) => fetchMediaBuffer(item.url)));
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
    console.error('❌ Error saat menjalankan !dl:', error);
    await loading.edit({
      embeds: [createEmbed('❌ Gagal Mengambil Media', getErrorDescription(error), COLORS.error)]
    }).catch(() => {});
  }
}

module.exports = { execute };
