// 다크 모드 토글
// 저장된 선택이 없으면 시스템 설정(prefers-color-scheme)을 따른다.
// 첫 화면 적용은 index.html <head>의 인라인 스크립트가 담당한다.

const STORAGE_KEY = 'theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readSaved() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function save(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* 저장 불가 환경에서는 이번 방문 동안만 유지 */
  }
}

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
}

function syncUi(button) {
  const theme = currentTheme();
  button.setAttribute('aria-label', theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim());
  }
}

export function initTheme() {
  const button = document.querySelector('.theme-toggle');
  if (!button) return;

  const saved = readSaved();
  if (saved) document.documentElement.setAttribute('data-theme', saved);

  button.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    save(next);
    syncUi(button);
  });

  media.addEventListener('change', () => syncUi(button));
  syncUi(button);
}
