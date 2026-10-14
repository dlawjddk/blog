// 마크다운 → HTML 변환기 (외부 라이브러리 없음)
// 지원: 제목, 문단, 강조, 취소선, 인라인 코드, 링크, 이미지, 목록(중첩·체크박스),
//       인용문, 수평선, 펜스 코드 블록, 표

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

// 이스케이프된 URL에서 위험한 스킴을 걸러낸다
function safeUrl(url, { allowDataImage = false } = {}) {
  const decoded = url.replace(/&amp;/g, '&').replace(/[\u0000- ]/g, '').toLowerCase();
  if (allowDataImage && /^data:image\/(png|gif|jpe?g|webp);/.test(decoded)) return url;
  if (/^(javascript|vbscript|data):/.test(decoded)) return '#';
  return url;
}

export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z0-9#]+;/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

/* --------------------------------------------------------------------------
   인라인 요소
   -------------------------------------------------------------------------- */

function parseInline(src) {
  const stash = [];
  const keep = (html) => `\u0000${stash.push(html) - 1}\u0000`;

  let text = src;

  // 1. 인라인 코드: 내용은 그대로 이스케이프만 한다
  text = text.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, (_, __, code) =>
    keep(`<code>${escapeHtml(code.replace(/^ (.+) $/, '$1'))}</code>`));

  // 2. 백슬래시 이스케이프
  text = text.replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g, (_, ch) => keep(escapeHtml(ch)));

  // 3. 나머지 HTML 이스케이프
  text = escapeHtml(text);

  // 4. 이미지 (주소 안의 괄호는 한 단계까지 허용)
  const URL_PART = String.raw`((?:[^()\s]|\([^()\s]*\))+)`;
  const TITLE_PART = String.raw`(?:\s+&quot;([^"]*?)&quot;)?\s*\)`;
  text = text.replace(new RegExp(String.raw`!\[([^\]]*)\]\(\s*${URL_PART}${TITLE_PART}`, 'g'),
    (_, alt, url, title) => {
      const titleAttr = title ? ` title="${title}"` : '';
      return keep(`<img src="${safeUrl(url, { allowDataImage: true })}" alt="${alt}"${titleAttr} loading="lazy">`);
    });

  // 5. 링크 (주소는 보관해 두고, 링크 텍스트는 이후 강조 처리를 받는다)
  text = text.replace(new RegExp(String.raw`\[([^\]]+)\]\(\s*${URL_PART}${TITLE_PART}`, 'g'),
    (_, label, url, title) => {
      const href = safeUrl(url);
      const external = /^https?:\/\//i.test(href);
      const attrs = [`href="${href}"`];
      if (title) attrs.push(`title="${title}"`);
      if (external) attrs.push('target="_blank"', 'rel="noopener noreferrer"');
      return `${keep(`<a ${attrs.join(' ')}>`)}${label}${keep('</a>')}`;
    });

  // 6. 자동 링크 <https://...>
  text = text.replace(/&lt;(https?:\/\/[^\s&]+(?:&amp;[^\s&]+)*)&gt;/g, (_, url) =>
    keep(`<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`));

  // 7. 강조
  text = text
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\p{L}\p{N}_])__(?=\S)([\s\S]*?\S)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>')
    .replace(/\*(?=\S)([\s\S]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)([\s\S]*?\S)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replace(/==(?=\S)([\s\S]*?\S)==/g, '<mark>$1</mark>');

  // 8. 강제 줄바꿈 (줄 끝 공백 2개 이상 또는 백슬래시)
  text = text.replace(/( {2,}|\\)\n/g, '<br>\n');

  // 보관한 조각 복원 (중첩될 수 있으므로 반복)
  while (/\u0000\d+\u0000/.test(text)) {
    text = text.replace(/\u0000(\d+)\u0000/g, (_, i) => stash[Number(i)]);
  }
  return text;
}

/* --------------------------------------------------------------------------
   블록 요소
   -------------------------------------------------------------------------- */

const RE_FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^\s`]*)/;
const RE_HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
const RE_HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const RE_QUOTE = /^ {0,3}> ?/;
const RE_LIST = /^( *)([-*+]|\d{1,9}[.)])( +|$)(.*)$/;
const RE_TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const isBlank = (line) => /^\s*$/.test(line);
const indentOf = (line) => line.match(/^ */)[0].length;

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function isTableStart(lines, i) {
  return lines[i].includes('|') && i + 1 < lines.length && RE_TABLE_SEP.test(lines[i + 1])
    && lines[i + 1].includes('-');
}

function startsBlock(lines, i) {
  const line = lines[i];
  return RE_FENCE.test(line) || RE_HEADING.test(line) || RE_HR.test(line)
    || RE_QUOTE.test(line) || RE_LIST.test(line) || isTableStart(lines, i);
}

class BlockParser {
  constructor() {
    this.headingIds = new Map();
  }

  uniqueId(text) {
    const base = slugify(text) || 'section';
    const count = this.headingIds.get(base) || 0;
    this.headingIds.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  }

  // tight: 촘촘한 목록 항목 안에서는 문단을 <p>로 감싸지 않는다
  parse(lines, tight = false) {
    const out = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (isBlank(line)) {
        i++;
        continue;
      }

      // 펜스 코드 블록
      const fence = line.match(RE_FENCE);
      if (fence) {
        const marker = fence[1];
        const lang = fence[2];
        const indent = indentOf(line);
        const body = [];
        i++;
        while (i < lines.length && !new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`).test(lines[i])) {
          body.push(lines[i].replace(new RegExp(`^ {0,${indent}}`), ''));
          i++;
        }
        i++; // 닫는 펜스
        const safeLang = escapeHtml(lang);
        const langAttr = lang ? ` data-lang="${safeLang}"` : '';
        const classAttr = lang ? ` class="language-${safeLang}"` : '';
        out.push(`<pre${langAttr}><code${classAttr}>${escapeHtml(body.join('\n'))}</code></pre>`);
        continue;
      }

      // 제목
      const heading = line.match(RE_HEADING);
      if (heading) {
        const level = heading[1].length;
        const inner = parseInline(heading[2] || '');
        out.push(`<h${level} id="${escapeHtml(this.uniqueId(inner))}">${inner}</h${level}>`);
        i++;
        continue;
      }

      // 수평선 (목록 표시와 겹치므로 목록보다 먼저 검사)
      if (RE_HR.test(line)) {
        out.push('<hr>');
        i++;
        continue;
      }

      // 인용문
      if (RE_QUOTE.test(line)) {
        const body = [];
        while (i < lines.length && !isBlank(lines[i])) {
          if (RE_QUOTE.test(lines[i])) {
            body.push(lines[i].replace(RE_QUOTE, ''));
          } else if (startsBlock(lines, i)) {
            break;
          } else {
            body.push(lines[i]); // 게으른 연속 줄
          }
          i++;
        }
        out.push(`<blockquote>\n${this.parse(body)}\n</blockquote>`);
        continue;
      }

      // 목록
      if (RE_LIST.test(line)) {
        i = this.parseList(lines, i, out);
        continue;
      }

      // 표
      if (isTableStart(lines, i)) {
        i = this.parseTable(lines, i, out);
        continue;
      }

      // 문단
      const para = [line.replace(/^\s+/, '')]; // 줄 끝 공백은 강제 줄바꿈 표시이므로 유지
      i++;
      while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines, i)) {
        para.push(lines[i].replace(/^\s+/, ''));
        i++;
      }
      const html = parseInline(para.join('\n'));
      out.push(tight ? html : `<p>${html}</p>`);
    }

    return out.join('\n');
  }

  parseList(lines, start, out) {
    const first = lines[start].match(RE_LIST);
    const baseIndent = first[1].length;
    const ordered = /\d/.test(first[2]);
    const startNum = ordered ? parseInt(first[2], 10) : 1;
    const items = [];
    let loose = false;
    let i = start;

    while (i < lines.length) {
      const m = lines[i].match(RE_LIST);
      if (!m || m[1].length !== baseIndent || /\d/.test(m[2]) !== ordered || RE_HR.test(lines[i])) break;

      // 항목 내용이 시작하는 열: 이 위치까지 들여쓴 줄은 항목에 속한다
      const contentIndent = m[1].length + m[2].length + Math.max(1, Math.min(m[3].length, 4));
      const body = [m[4]];
      i++;

      while (i < lines.length) {
        const line = lines[i];
        if (isBlank(line)) {
          // 빈 줄 뒤에 들여쓴 내용이 이어지면 같은 항목
          let j = i;
          while (j < lines.length && isBlank(lines[j])) j++;
          if (j < lines.length && indentOf(lines[j]) >= contentIndent) {
            loose = true;
            for (; i < j; i++) body.push('');
            continue;
          }
          break;
        }
        if (indentOf(line) >= contentIndent) {
          body.push(line.slice(contentIndent));
        } else if (RE_LIST.test(line) || startsBlock(lines, i)) {
          if (indentOf(line) > baseIndent && RE_LIST.test(line)) {
            body.push(line.slice(Math.min(indentOf(line), contentIndent)));
          } else {
            break;
          }
        } else {
          body.push(line.trim()); // 게으른 연속 줄
        }
        i++;
      }
      items.push(body);

      // 항목 사이 빈 줄 → 느슨한 목록
      let j = i;
      while (j < lines.length && isBlank(lines[j])) j++;
      if (j > i && j < lines.length) {
        const next = lines[j].match(RE_LIST);
        if (next && next[1].length === baseIndent && /\d/.test(next[2]) === ordered) {
          loose = true;
          i = j;
        }
      }
    }

    const tag = ordered ? 'ol' : 'ul';
    const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
    const lis = items.map((body) => {
      const task = body[0].match(/^\[([ xX])\]\s+(.*)$/);
      if (task) body[0] = task[2];
      const inner = this.parse(body, !loose);
      if (task) {
        const checked = task[1] !== ' ' ? ' checked' : '';
        return `<li class="task-item"><input type="checkbox" disabled${checked}> ${inner}</li>`;
      }
      return `<li>${inner}</li>`;
    });

    out.push(`<${tag}${startAttr}>\n${lis.join('\n')}\n</${tag}>`);
    return i;
  }

  parseTable(lines, start, out) {
    const header = splitRow(lines[start]);
    const aligns = splitRow(lines[start + 1]).map((cell) => {
      const left = cell.startsWith(':');
      const right = cell.endsWith(':');
      if (left && right) return 'center';
      if (right) return 'right';
      if (left) return 'left';
      return '';
    });
    const alignAttr = (idx) => (aligns[idx] ? ` style="text-align:${aligns[idx]}"` : '');

    let i = start + 2;
    const rows = [];
    while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
      rows.push(splitRow(lines[i]));
      i++;
    }

    const thead = header.map((cell, idx) => `<th${alignAttr(idx)}>${parseInline(cell)}</th>`).join('');
    const tbody = rows.map((row) => {
      const cells = header.map((_, idx) => `<td${alignAttr(idx)}>${parseInline(row[idx] || '')}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    }).join('\n');

    out.push(`<div class="table-wrap"><table>\n<thead><tr>${thead}</tr></thead>\n<tbody>\n${tbody}\n</tbody>\n</table></div>`);
    return i;
  }
}

export function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  return new BlockParser().parse(lines);
}
