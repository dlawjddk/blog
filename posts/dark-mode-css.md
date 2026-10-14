---
title: CSS 변수로 다크 모드 만들기
date: 2026-10-14
tags: [css, 웹개발]
description: 색을 CSS 사용자 정의 속성으로 모아 두면 다크 모드를 깔끔하게 지원할 수 있습니다.
---

다크 모드를 지원하는 가장 깔끔한 방법은 **모든 색을 CSS 변수로 관리**하는 것입니다.

## 색을 변수로 정의하기

```css
:root {
  --color-bg: #ffffff;
  --color-text: #1d1f23;
}

:root[data-theme="dark"] {
  --color-bg: #15171b;
  --color-text: #e4e6ea;
}

body {
  background: var(--color-bg);
  color: var(--color-text);
}
```

컴포넌트에서는 색 값을 직접 쓰지 않고 항상 `var(--color-...)`만 사용합니다.
그러면 테마가 바뀔 때 변수 값만 바뀌고, 나머지는 자동으로 따라옵니다.

## 시스템 설정 따르기

사용자가 직접 고르지 않았다면 운영체제 설정을 따르는 것이 좋습니다.

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg: #15171b;
    --color-text: #e4e6ea;
  }
}
```

## 깜빡임 막기

저장된 테마를 JavaScript 모듈에서 적용하면, 페이지가 잠깐 밝게 보였다가 어두워지는 **깜빡임**이 생깁니다.
그래서 `<head>` 안에 작은 인라인 스크립트를 두어 CSS보다 먼저 테마를 적용합니다.

## 정리

| 할 일 | 방법 |
| --- | --- |
| 색 관리 | `:root`의 CSS 변수 |
| 기본값 | `prefers-color-scheme` |
| 사용자 선택 저장 | `localStorage` |
| 깜빡임 방지 | `<head>` 인라인 스크립트 |
