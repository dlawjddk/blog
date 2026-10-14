// 글 목록과 본문 불러오기

import { markdownToHtml } from './markdown.js';

const POSTS_DIR = 'posts';
const SLUG_RE = /^[\p{L}\p{N}_-]+$/u;

let indexCache = null;

export class NotFoundError extends Error {}

export function isValidSlug(slug) {
  return typeof slug === 'string' && SLUG_RE.test(slug);
}

// "---" 로 둘러싼 front matter를 분리해 { meta, body } 로 반환
export function parseFrontMatter(text) {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { meta: {}, body: src };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const [, key, raw] = kv;
    meta[key] = parseValue(raw.trim());
  }
  return { meta, body: src.slice(match[0].length) };
}

function parseValue(raw) {
  if (raw.startsWith('[') && raw.endsWith(']')) {
    return raw.slice(1, -1).split(',').map((v) => unquote(v.trim())).filter(Boolean);
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return unquote(raw);
}

function unquote(value) {
  const m = value.match(/^(['"])(.*)\1$/);
  return m ? m[2] : value;
}

function normalizeEntry(entry) {
  return {
    slug: String(entry.slug),
    title: String(entry.title || entry.slug),
    date: String(entry.date || ''),
    description: String(entry.description || ''),
    tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
  };
}

export async function getPostIndex() {
  if (indexCache) return indexCache;

  const res = await fetch(`${POSTS_DIR}/index.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`글 목록을 불러오지 못했습니다 (${res.status})`);
  const data = await res.json();

  indexCache = (Array.isArray(data) ? data : data.posts || [])
    .filter((entry) => entry && isValidSlug(entry.slug))
    .map(normalizeEntry)
    .sort((a, b) => b.date.localeCompare(a.date));
  return indexCache;
}

export async function getPost(slug) {
  if (!isValidSlug(slug)) throw new NotFoundError();

  const res = await fetch(`${POSTS_DIR}/${encodeURIComponent(slug)}.md`, { cache: 'no-cache' });
  if (res.status === 404) throw new NotFoundError();
  if (!res.ok) throw new Error(`글을 불러오지 못했습니다 (${res.status})`);

  const { meta, body } = parseFrontMatter(await res.text());
  return {
    meta: normalizeEntry({ ...meta, slug }),
    html: markdownToHtml(body),
    readingMinutes: estimateReadingMinutes(body),
  };
}

// 한글 기준 분당 약 500자
function estimateReadingMinutes(text) {
  const chars = text.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, '').length;
  return Math.max(1, Math.round(chars / 500));
}
