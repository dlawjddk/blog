"""블로그 로컬 서버.

실행하면 posts/index.json을 갱신하고, 로컬 서버를 띄운 뒤 브라우저를 엽니다.
이미 실행 중이면 브라우저만 엽니다. 바탕화면 아이콘이 이 파일을 실행합니다.

    python serve.py               # 서버 실행 + 브라우저 열기
    python serve.py --no-browser  # 서버만 실행

표준 라이브러리만 사용합니다.
"""

import json
import re
import sys
import urllib.request
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
POSTS_DIR = ROOT / "posts"
INDEX_FILE = POSTS_DIR / "index.json"
HOST = "127.0.0.1"
PORTS = range(8000, 8021)
PING_PATH = "/__blog_ping"


# ---------------------------------------------------------------------------
# posts/index.json 생성
# ---------------------------------------------------------------------------

def parse_front_matter(text):
    text = text.lstrip("﻿").replace("\r\n", "\n")
    match = re.match(r"^---\n(.*?)\n---\n?", text, re.S)
    if not match:
        return {}
    meta = {}
    for line in match.group(1).split("\n"):
        kv = re.match(r"^([\w-]+)\s*:\s*(.*)$", line)
        if not kv:
            continue
        key, raw = kv.group(1), kv.group(2).strip()
        if raw.startswith("[") and raw.endswith("]"):
            meta[key] = [unquote(v.strip()) for v in raw[1:-1].split(",") if v.strip()]
        elif raw in ("true", "false"):
            meta[key] = raw == "true"
        else:
            meta[key] = unquote(raw)
    return meta


def unquote(value):
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
        return value[1:-1]
    return value


def build_index():
    """posts/*.md 를 읽어 index.json을 만든다. 내용이 바뀐 경우에만 파일을 쓴다."""
    posts = []
    for path in sorted(POSTS_DIR.glob("*.md")):
        if path.name.startswith("_"):
            continue
        meta = parse_front_matter(path.read_text(encoding="utf-8"))
        if meta.get("draft") is True:
            continue
        tags = meta.get("tags", [])
        posts.append({
            "slug": path.stem,
            "title": meta.get("title", path.stem),
            "date": str(meta.get("date", "")),
            "tags": tags if isinstance(tags, list) else [tags],
            "description": meta.get("description", ""),
        })
    posts.sort(key=lambda p: p["date"], reverse=True)

    content = json.dumps(posts, ensure_ascii=False, indent=2) + "\n"
    try:
        old = INDEX_FILE.read_text(encoding="utf-8")
    except FileNotFoundError:
        old = None
    if content != old:
        INDEX_FILE.write_text(content, encoding="utf-8", newline="\n")
    return posts


# ---------------------------------------------------------------------------
# 서버
# ---------------------------------------------------------------------------

class BlogHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".md": "text/markdown; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".svg": "image/svg+xml",
    }

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == PING_PATH:
            body = str(ROOT).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/posts/index.json":
            # 서버가 켜진 동안 추가한 글도 새로고침만 하면 보이도록 매번 갱신
            try:
                build_index()
            except Exception as exc:  # 글 하나가 깨져도 서버는 계속 동작
                print(f"[경고] 글 목록 갱신 실패: {exc}")
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, format, *args):
        pass  # 요청 로그는 생략


class BlogServer(ThreadingHTTPServer):
    # Windows에서 SO_REUSEADDR는 이미 사용 중인 포트도 바인딩해 버리므로 끈다
    allow_reuse_address = sys.platform != "win32"
    daemon_threads = True


def running_server_port():
    """이 블로그 서버가 이미 떠 있으면 그 포트를 반환한다."""
    for port in PORTS:
        try:
            with urllib.request.urlopen(f"http://{HOST}:{port}{PING_PATH}", timeout=0.3) as res:
                if res.read().decode("utf-8") == str(ROOT):
                    return port
        except Exception:
            continue
    return None


def main():
    open_browser = "--no-browser" not in sys.argv[1:]

    existing = running_server_port()
    if existing:
        print(f"이미 실행 중입니다: http://localhost:{existing}/")
        if open_browser:
            webbrowser.open(f"http://localhost:{existing}/")
        return

    posts = build_index()

    handler = partial(BlogHandler, directory=str(ROOT))
    server = None
    for port in PORTS:
        try:
            server = BlogServer((HOST, port), handler)
            break
        except OSError:
            continue
    if server is None:
        print("사용 가능한 포트를 찾지 못했습니다 (8000~8020).")
        input("Enter를 누르면 닫힙니다...")
        sys.exit(1)

    url = f"http://localhost:{server.server_address[1]}/"
    print("=" * 48)
    print("  블로그 서버가 실행 중입니다")
    print(f"  주소: {url}")
    print(f"  글 {len(posts)}개")
    print()
    print("  이 창을 닫으면 블로그 서버가 종료됩니다.")
    print("=" * 48)

    if open_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
