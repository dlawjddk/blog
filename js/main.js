// 앱 시작과 해시 라우팅
//   #/              글 목록
//   #/post/<slug>   글 본문
//   #/tag/<tag>     태그별 목록

import { initTheme } from './theme.js';
import { getPostIndex, getPost, NotFoundError } from './posts.js';

const SITE_TITLE = '블로그';
const main = document.getElementById('main');

/* --------------------------------------------------------------------------
   DOM 도우미
   -------------------------------------------------------------------------- */

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of children.flat()) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

const tagHref = (tag) => `#/tag/${encodeURIComponent(tag)}`;
const postHref = (slug) => `#/post/${encodeURIComponent(slug)}`;

function tagList(tags) {
  if (!tags.length) return null;
  return el('ul', { className: 'tag-list', 'aria-label': '태그' },
    tags.map((tag) => el('li', {}, el('a', { className: 'tag', href: tagHref(tag) }, `#${tag}`))));
}

function postMeta(post, extra) {
  return el('div', { className: 'post-meta' },
    post.date ? el('time', { datetime: post.date }, formatDate(post.date)) : null,
    extra,
    tagList(post.tags));
}

function render(title, ...nodes) {
  document.title = title ? `${title} · ${SITE_TITLE}` : SITE_TITLE;
  main.replaceChildren(...nodes);
}

function renderMessage(title, message) {
  render(title,
    el('h1', { className: 'page-title' }, title),
    el('p', { className: 'page-subtitle' }, message),
    el('a', { className: 'back-link', href: '#/' }, '← 글 목록으로'));
}

/* --------------------------------------------------------------------------
   화면
   -------------------------------------------------------------------------- */

async function showList(tag) {
  const posts = await getPostIndex();
  const visible = tag ? posts.filter((p) => p.tags.includes(tag)) : posts;

  const header = tag
    ? [el('a', { className: 'back-link', href: '#/' }, '← 전체 글'),
       el('h1', { className: 'page-title' }, `#${tag}`),
       el('p', { className: 'page-subtitle' }, `${visible.length}개의 글`)]
    : [el('h1', { className: 'page-title' }, '최근 글'),
       el('p', { className: 'page-subtitle' }, '생각과 배운 것을 기록합니다.')];

  if (!visible.length) {
    render(tag ? `#${tag}` : null, ...header, el('p', { className: 'status' }, '아직 글이 없습니다.'));
    return;
  }

  const list = el('ul', { className: 'post-list' }, visible.map((post) =>
    el('li', { className: 'post-card' },
      el('h2', { className: 'post-card__title' }, el('a', { href: postHref(post.slug) }, post.title)),
      post.description ? el('p', { className: 'post-card__description' }, post.description) : null,
      postMeta(post))));

  render(tag ? `#${tag}` : null, ...header, list);
}

async function showPost(slug) {
  let post;
  try {
    post = await getPost(slug);
  } catch (err) {
    if (err instanceof NotFoundError) {
      renderMessage('글을 찾을 수 없습니다', '주소가 바뀌었거나 삭제된 글일 수 있습니다.');
      return;
    }
    throw err;
  }

  const { meta, html, readingMinutes } = post;

  const content = el('div', { className: 'prose' });
  content.innerHTML = html; // markdown.js가 모든 텍스트를 이스케이프한 결과

  const article = el('article', {},
    el('header', { className: 'post-header' },
      el('a', { className: 'back-link', href: '#/' }, '← 글 목록'),
      el('h1', { className: 'post-header__title' }, meta.title),
      postMeta(meta, el('span', {}, `${readingMinutes}분 분량`))),
    content);

  render(meta.title, article);

  // 이전/다음 글 (목록을 못 불러와도 본문은 보여준다)
  try {
    const posts = await getPostIndex();
    const idx = posts.findIndex((p) => p.slug === slug);
    if (idx !== -1) {
      const newer = posts[idx - 1];
      const older = posts[idx + 1];
      if (newer || older) {
        article.append(el('nav', { className: 'post-nav', 'aria-label': '이전/다음 글' },
          older ? el('a', { className: 'post-nav__link post-nav__link--prev', href: postHref(older.slug) },
            el('span', { className: 'post-nav__label' }, '이전 글'), older.title) : null,
          newer ? el('a', { className: 'post-nav__link post-nav__link--next', href: postHref(newer.slug) },
            el('span', { className: 'post-nav__label' }, '다음 글'), newer.title) : null));
      }
    }
  } catch {
    /* 무시 */
  }
}

/* --------------------------------------------------------------------------
   라우터
   -------------------------------------------------------------------------- */

function parseRoute() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  return parts;
}

async function route() {
  const [view, param] = parseRoute();
  try {
    if (!view) await showList();
    else if (view === 'post' && param) await showPost(param);
    else if (view === 'tag' && param) await showList(param);
    else renderMessage('페이지를 찾을 수 없습니다', '요청한 주소에 해당하는 페이지가 없습니다.');
  } catch (err) {
    console.error(err);
    renderMessage('문제가 발생했습니다', `${err.message} — 로컬에서는 바탕화면의 블로그 아이콘(또는 serve.py)으로 열어야 합니다.`);
  }
  window.scrollTo(0, 0);
}

// 본문 안의 "#제목" 앵커는 라우팅 대신 해당 제목으로 스크롤
main.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const href = link.getAttribute('href');
  if (href.startsWith('#/')) return;
  const target = document.getElementById(decodeURIComponent(href.slice(1)));
  if (target) {
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
});

initTheme();
window.addEventListener('hashchange', route);
route();
