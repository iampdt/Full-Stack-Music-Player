import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const TARGET_COUNT = 50;
const ROWS_PER_PAGE = 100;
const MAX_PAGES = 80;
const MIN_FILE_SIZE_BYTES = 900_000; // avoid tiny clips
const MAX_FILE_SIZE_BYTES = 30_000_000;
const MIN_DURATION_SECONDS = 45;
const REQUEST_TIMEOUT_MS = 30_000;

const TMP_ROOT = '/tmp/common50-real-tracks';
const AUDIO_DIR = path.join(TMP_ROOT, 'audio');
const METADATA_PATH = path.join(TMP_ROOT, 'metadata.json');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.'
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const timeoutFetch = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...(options.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
};

const asString = (value) => {
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === 'string' && entry.trim().length);
    return first || '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return '';
};

const cleanText = (value) =>
  asString(value)
    .replace(/\s+/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();

const normalizeKey = (value) =>
  cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const parseDurationSeconds = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return 0;
  }

  if (!trimmed.includes(':')) {
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parts = trimmed.split(':').map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return 0;
};

const parseFileSize = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasAcceptableLicense = (license) => {
  const l = normalizeKey(license);

  if (!l) {
    return true; // netlabels are generally CC; keep permissive when metadata is incomplete
  }

  return (
    l.includes('creativecommons') ||
    l.includes('public domain') ||
    l.includes('cc by') ||
    l.includes('cc-by') ||
    l.includes('cc0')
  );
};

const pickBestMp3 = (files) => {
  if (!Array.isArray(files)) {
    return null;
  }

  const candidates = files
    .map((file) => {
      const name = cleanText(file?.name);
      const format = normalizeKey(file?.format);
      const source = normalizeKey(file?.source);
      const size = parseFileSize(file?.size);
      const duration = parseDurationSeconds(file?.length);

      if (!name.toLowerCase().endsWith('.mp3')) {
        return null;
      }

      if (size < MIN_FILE_SIZE_BYTES || size > MAX_FILE_SIZE_BYTES) {
        return null;
      }

      if (duration > 0 && duration < MIN_DURATION_SECONDS) {
        return null;
      }

      let score = 0;
      if (format.includes('vbr')) score += 4;
      if (format.includes('mp3')) score += 2;
      if (source.includes('original')) score += 2;
      if (name.toLowerCase().includes('_64kb')) score -= 6;
      if (name.toLowerCase().includes('_128kb')) score -= 4;

      return {
        ...file,
        _name: name,
        _size: size,
        _duration: duration,
        _score: score,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b._score - a._score || b._size - a._size);

  return candidates[0] || null;
};

const getSearchPage = async (page) => {
  const q = encodeURIComponent('collection:(netlabels) AND mediatype:(audio)');
  const fl = ['identifier', 'title', 'creator', 'licenseurl']
    .map((field) => `fl[]=${encodeURIComponent(field)}`)
    .join('&');

  const url = `https://archive.org/advancedsearch.php?q=${q}&${fl}&rows=${ROWS_PER_PAGE}&page=${page}&output=json`;
  const response = await timeoutFetch(url);

  if (!response.ok) {
    throw new Error(`Archive search failed on page ${page}: HTTP ${response.status}`);
  }

  return response.json();
};

const getMetadata = async (identifier) => {
  const response = await timeoutFetch(
    `https://archive.org/metadata/${encodeURIComponent(identifier)}`
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
};

const downloadTrack = async (url) => {
  const response = await timeoutFetch(url);

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

await fs.mkdir(AUDIO_DIR, { recursive: true });

const selected = [];
const seenIdentifier = new Set();
const seenTitle = new Set();
const seenCreator = new Set();
const seenHash = new Set();

for (let page = 1; page <= MAX_PAGES && selected.length < TARGET_COUNT; page += 1) {
  const searchResult = await getSearchPage(page);
  const docs = searchResult?.response?.docs || [];

  if (!docs.length) {
    break;
  }

  for (const doc of docs) {
    if (selected.length >= TARGET_COUNT) {
      break;
    }

    const identifier = cleanText(doc?.identifier);
    if (!identifier || seenIdentifier.has(identifier)) {
      continue;
    }

    seenIdentifier.add(identifier);

    try {
      const metadata = await getMetadata(identifier);
      if (!metadata) {
        continue;
      }

      const archiveMeta = metadata?.metadata || {};

      const title = cleanText(archiveMeta?.title || doc?.title);
      const creator = cleanText(archiveMeta?.creator || doc?.creator);
      const license = cleanText(archiveMeta?.licenseurl || doc?.licenseurl || archiveMeta?.rights);

      if (!title || !creator) {
        continue;
      }

      const titleKey = normalizeKey(title);
      const creatorKey = normalizeKey(creator);
      if (!titleKey || !creatorKey) {
        continue;
      }

      if (seenTitle.has(titleKey) || seenCreator.has(creatorKey)) {
        continue;
      }

      if (!hasAcceptableLicense(license)) {
        continue;
      }

      const mp3 = pickBestMp3(metadata?.files);
      if (!mp3?._name) {
        continue;
      }

      const sourceUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(mp3._name)}`;
      const audioBuffer = await downloadTrack(sourceUrl);

      if (
        audioBuffer.byteLength < MIN_FILE_SIZE_BYTES ||
        audioBuffer.byteLength > MAX_FILE_SIZE_BYTES
      ) {
        continue;
      }

      const hash = crypto.createHash('sha256').update(audioBuffer).digest('hex');
      if (seenHash.has(hash)) {
        continue;
      }

      const index = selected.length + 1;
      const trackNumber = String(index).padStart(2, '0');
      const localPath = path.join(AUDIO_DIR, `track-${trackNumber}.mp3`);

      await fs.writeFile(localPath, audioBuffer);

      selected.push({
        index,
        trackNumber,
        title,
        creator,
        identifier,
        license,
        sourceUrl,
        hash,
      });

      seenTitle.add(titleKey);
      seenCreator.add(creatorKey);
      seenHash.add(hash);

      console.log(
        `SELECTED ${index}/${TARGET_COUNT}: ${title} — ${creator} [${identifier}]`
      );

      await sleep(120);
    } catch {
      // Skip and continue searching.
    }
  }
}

if (selected.length < TARGET_COUNT) {
  throw new Error(
    `Could only collect ${selected.length} real tracks with unique title/creator/audio.`
  );
}

for (const track of selected) {
  const songPath = `seed/common50/track-${track.trackNumber}.mp3`;
  const localPath = path.join(AUDIO_DIR, `track-${track.trackNumber}.mp3`);
  const payload = await fs.readFile(localPath);

  const { error: uploadError } = await supabase.storage
    .from('songs')
    .upload(songPath, payload, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Upload failed for ${songPath}: ${uploadError.message}`);
  }

  const { error: updateError } = await supabase
    .from('songs')
    .update({
      title: track.title,
      author: track.creator,
    })
    .eq('song_path', songPath)
    .is('user_id', null);

  if (updateError) {
    throw new Error(`DB update failed for ${songPath}: ${updateError.message}`);
  }
}

await fs.writeFile(METADATA_PATH, JSON.stringify(selected, null, 2));

const { data: seededRows, error: rowsError } = await supabase
  .from('songs')
  .select('id,title,author,song_path,image_path')
  .like('song_path', 'seed/common50/track-%')
  .order('song_path', { ascending: true });

if (rowsError) {
  throw new Error(`Verification query failed: ${rowsError.message}`);
}

const rows = seededRows || [];
const distinctTitleCount = new Set(rows.map((row) => cleanText(row.title))).size;
const distinctAuthorCount = new Set(rows.map((row) => cleanText(row.author))).size;
const distinctSongPathCount = new Set(rows.map((row) => row.song_path)).size;
const distinctImagePathCount = new Set(rows.map((row) => row.image_path)).size;

console.log(`\nDONE: seeded real songs into common50 set`);
console.log(`ROWS=${rows.length}`);
console.log(`DISTINCT_TITLES=${distinctTitleCount}`);
console.log(`DISTINCT_AUTHORS=${distinctAuthorCount}`);
console.log(`DISTINCT_AUDIO_PATHS=${distinctSongPathCount}`);
console.log(`DISTINCT_IMAGE_PATHS=${distinctImagePathCount}`);
console.log(`METADATA_FILE=${METADATA_PATH}`);
