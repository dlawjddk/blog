# CLAUDE.md

이 파일은 이 저장소에서 작업하는 Claude Code에게 프로젝트 맥락과 규칙을 안내합니다.

## 프로젝트 개요

마크다운(`.md`) 파일을 읽어 블로그 웹사이트로 보여주는 정적 사이트입니다.

- **프레임워크·빌드 도구 없음**: 순수 HTML, CSS, JavaScript(ES 모듈)만 사용합니다.
  React/Vue/Svelte, Tailwind, Bootstrap, jQuery, 번들러(Vite, Webpack 등), npm 의존성을 추가하지 마세요.
- **외부 라이브러리 없음**: 마크다운 파서도 직접 구현합니다(`js/markdown.js`). 라이브러리 도입이 정말 필요하다고 판단되면 먼저 사용자에게 물어보세요.
- **정적 호스팅 전제**: GitHub Pages, Netlify 등 서버 없이 파일만 올려도 동작해야 합니다.

## 디렉터리 구조

```
blog/
├── index.html          # 단일 진입점 (SPA)
├── css/
│   └── style.css       # 전체 스타일, 테마 변수 포함
├── js/
│   ├── main.js         # 앱 시작, 라우팅
│   ├── markdown.js     # 마크다운 → HTML 변환기
│   ├── posts.js        # 글 목록/본문 불러오기, front matter 파싱
│   └── theme.js        # 다크 모드 토글
├── posts/
│   ├── index.json      # 글 목록 매니페스트 (serve.py가 자동 생성 — 직접 수정 금지)
│   └── *.md            # 블로그 글
├── assets/
│   ├── favicon.svg     # 브라우저 탭 아이콘
│   └── blog.ico        # 바탕화면 바로가기 아이콘 (make-shortcut.ps1이 생성)
├── serve.py            # 로컬 서버 + index.json 생성 (Python 표준 라이브러리만 사용)
└── make-shortcut.ps1   # 바탕화면 "블로그" 바로가기 생성
```

`serve.py`와 `make-shortcut.ps1`은 로컬 편의 도구일 뿐이며, 사이트 자체(HTML/CSS/JS)는 이들 없이도 정적 호스팅에서 동작해야 합니다.

새 파일이 필요하면 이 구조에 맞춰 추가하고, 이 문서도 함께 갱신하세요.

## 동작 방식

1. `index.html`이 `js/main.js`를 `<script type="module">`로 불러옵니다.
2. 해시 라우팅을 사용합니다 (정적 호스팅에서 404 없이 동작하도록).
   - `#/` → 글 목록
   - `#/post/<slug>` → 글 본문 (`posts/<slug>.md`)
   - `#/tag/<tag>` → 태그별 목록
3. 글 목록은 `posts/index.json`에서 읽습니다. 브라우저는 디렉터리 목록을 읽을 수 없으므로 매니페스트가 필요합니다.
4. 글 본문은 `fetch()`로 `.md`를 받아 front matter를 분리한 뒤 `markdown.js`로 HTML로 변환해 렌더링합니다.

### 글 작성 형식

각 글은 YAML 스타일 front matter로 시작합니다:

```markdown
---
title: 글 제목
date: 2026-10-14
tags: [javascript, css]
description: 목록에 보일 짧은 요약
---

본문...
```

`posts/index.json` 항목은 `slug`, `title`, `date`, `tags`, `description`을 가지며, 최신 글이 먼저 오도록 날짜 내림차순으로 정렬해 표시합니다.

`index.json`은 `serve.py`가 각 글의 front matter를 읽어 **자동 생성**합니다(서버 시작 시와 `/posts/index.json` 요청 때마다). 새 글은 `.md` 파일만 추가하면 됩니다.
- 파일 이름이 `_`로 시작하거나 `draft: true`인 글은 목록에서 제외됩니다.
- front matter 파싱 규칙은 `js/posts.js`와 `serve.py` 두 곳에 있으므로, 바꿀 때는 둘 다 맞춰 수정하세요.

### 마크다운 파서 지원 범위

`js/markdown.js`는 최소한 다음을 지원해야 합니다:

- 제목(`#`~`######`), 문단, 줄바꿈
- 굵게, 기울임, 취소선, 인라인 코드
- 링크, 이미지
- 순서 있는/없는 목록 (중첩 포함)
- 인용문, 수평선
- 펜스 코드 블록(```` ```lang ````) — `class="language-lang"` 부여
- 표(GFM 테이블)

**보안**: 변환 전 HTML 특수문자(`< > & " '`)를 반드시 이스케이프하고, 링크의 `javascript:` 스킴을 차단하세요. 코드 블록 내용은 절대 마크다운으로 재해석하지 않습니다.

## 디자인 원칙

깔끔하고 읽기 좋은 것이 최우선입니다. 장식보다 타이포그래피와 여백으로 위계를 만드세요.

- **본문 폭**: 약 `680px`(대략 `65ch`) 이하로 제한
- **글꼴**: 시스템 폰트 스택 사용, 한글 가독성 고려
  `-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", "Segoe UI", sans-serif`
- **본문 크기/행간**: `font-size: 1.0625rem`(17px) 전후, `line-height: 1.75`
- **한글 줄바꿈**: `word-break: keep-all; overflow-wrap: break-word;`
- **코드**: 고정폭 폰트, 코드 블록은 가로 스크롤(`overflow-x: auto`) — 페이지 전체가 가로로 넘치지 않게
- **이미지**: `max-width: 100%; height: auto;`
- 색 대비는 WCAG AA(본문 4.5:1) 이상

### 다크 모드

- 모든 색은 `:root`의 CSS 사용자 정의 속성(`--color-bg`, `--color-text`, `--color-muted`, `--color-accent`, `--color-border`, `--color-code-bg` 등)으로 정의합니다. 컴포넌트에 색 값을 직접 쓰지 마세요.
- 기본값은 시스템 설정(`prefers-color-scheme`)을 따릅니다.
- 헤더의 토글 버튼으로 수동 전환하며, 선택은 `localStorage`에 저장하고 `<html data-theme="light|dark">`로 적용합니다.
- 페이지 로드 시 깜빡임(FOUC)을 막기 위해, 테마 적용 코드는 `<head>` 안 인라인 스크립트로 CSS보다 먼저 실행합니다.
- `localStorage` 접근은 `try/catch`로 감싸세요 (차단된 환경 대비).

### 반응형 / 모바일

- 모바일 우선(mobile-first)으로 작성하고 `min-width` 미디어 쿼리로 확장합니다.
- `<meta name="viewport" content="width=device-width, initial-scale=1">` 필수
- 좌우 여백 최소 `16px`, 어떤 화면 폭에서도 가로 스크롤이 생기지 않아야 합니다.
- 터치 대상(버튼, 링크)은 최소 `44×44px`
- 표는 래퍼로 감싸 가로 스크롤 처리

## 코딩 규칙

- **JavaScript**: ES2020+ 모듈, `const`/`let`, 세미콜론 사용, 2칸 들여쓰기. 전역 변수 금지.
- **DOM 삽입**: 사용자/파일에서 온 텍스트는 `textContent`로 넣고, `innerHTML`은 이스케이프된 마크다운 변환 결과에만 사용합니다.
- **CSS**: 클래스 선택자 위주, 단순한 BEM 스타일 이름(`.post-card__title`). `!important` 지양.
- **HTML**: 시맨틱 태그(`header`, `main`, `article`, `nav`, `time`, `footer`) 사용, 이미지에는 `alt` 제공.
- 에러 처리: 글을 찾지 못하거나 `fetch` 실패 시 빈 화면 대신 안내 메시지를 보여줍니다.
- 주석과 UI 문구는 한국어를 기본으로 합니다.

## 로컬 실행

`fetch()`는 `file://`에서 동작하지 않으므로 로컬 서버가 필요합니다.

- **바탕화면 "블로그" 아이콘**: 더블클릭하면 `serve.py`가 실행되어 서버를 띄우고 브라우저를 엽니다. 이미 실행 중이면 브라우저만 엽니다. 서버 창(최소화됨)을 닫으면 종료됩니다.
- 명령줄: `python serve.py` (브라우저를 열지 않으려면 `--no-browser`). 포트는 8000부터 빈 포트를 사용합니다.
- 바로가기 다시 만들기: `powershell -ExecutionPolicy Bypass -File make-shortcut.ps1`
  (이 스크립트는 한글 문자열 때문에 **UTF-8 BOM**으로 저장해야 Windows PowerShell 5.1에서 정상 동작합니다.)

## 변경 후 확인 사항

변경 후에는 브라우저에서 직접 확인하세요:

- 글 목록 → 글 본문 → 뒤로 가기 흐름이 정상 동작하는지
- 라이트/다크 모드 모두에서 본문, 코드 블록, 링크, 표가 잘 보이는지
- 모바일 폭(약 375px)에서 가로 스크롤 없이 읽기 편한지
- 브라우저 콘솔에 에러가 없는지
