#!/usr/bin/env python3
"""Static smoke checks for the refactored Wordinary package."""
from __future__ import annotations

import importlib
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"
REFERENCE_SERVER = ROOT / "tools/reference_server/server.py"


def fail(message: str) -> None:
    raise SystemExit(f"[FAIL] {message}")


def body_without_scripts(html: str) -> str:
    match = re.search(r"<body>(?P<body>.*?)</body>", html, re.S)
    if not match:
        fail("Could not find HTML body")
    return re.sub(r"\s*<script\b[^>]*>.*?</script>\s*", "", match.group("body"), flags=re.S).strip()


def top_level_declarations(source: str) -> list[str]:
    pattern = re.compile(
        r"^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\("
        r"|^\s*const\s+([A-Za-z_$][\w$]*)\s*="
        r"|^\s*let\s+([A-Za-z_$][\w$]*)\s*="
        r"|^\s*class\s+([A-Za-z_$][\w$]*)\b",
        re.M,
    )
    names = []
    for match in pattern.finditer(source):
        name = next(group for group in match.groups() if group)
        if name == "PDF_DEMO_BASE64":
            name = "PDF_DEMO_URL"
        if name in {"response", "root"}:
            continue
        names.append(name)
    return names


def main() -> None:
    required = [
        REFERENCE_SERVER,
        ROOT / "tools/reference_server/requirements.txt",
        ROOT / "backend/app/main.py",
        ROOT / "backend/pyproject.toml",
        FRONTEND / "index.html",
        FRONTEND / "src/main.js",
        FRONTEND / "src/styles/main.css",
    ]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
    if missing:
        fail(f"Missing files: {', '.join(missing)}")

    index = (FRONTEND / "index.html").read_text(encoding="utf-8")
    original_path = ROOT / "wordinary_v7_unified_library_practice.html"
    original = original_path.read_text(encoding="utf-8") if original_path.exists() else ""

    if original and body_without_scripts(index) != body_without_scripts(original):
        fail("frontend/index.html body differs from the original v7 body")

    script_refs = re.findall(r'<script defer src="([^"]+)"', index)
    if not script_refs:
        fail("No deferred scripts found in frontend/index.html")

    scripts = []
    for ref in script_refs:
        target = FRONTEND / urlsplit(ref).path.lstrip("/")
        if not target.is_file():
            fail(f"Missing script referenced by index: {ref}")
        subprocess.run(["node", "--check", str(target)], check=True)
        scripts.append(target.read_text(encoding="utf-8"))

    if original:
        original_script_match = re.search(r"<script>\s*\n(?P<script>.*?)\n\s*</script>", original, re.S)
        if not original_script_match:
            fail("Could not find original inline JavaScript for comparison")
        if top_level_declarations("\n".join(scripts)) != top_level_declarations(original_script_match.group("script")):
            fail("Resolved modular JavaScript declarations differ from the original v7 script")

    sources = "\n".join(
        path.read_text(encoding="utf-8")
        for path in FRONTEND.rglob("*")
        if path.is_file() and path.suffix in {".html", ".css", ".js"}
    )
    if "data:video/mp4;base64" in sources or "PDF_DEMO_BASE64" in sources:
        fail("Embedded demo binary data is still present in source files")

    subprocess.run([sys.executable, "-m", "py_compile", str(REFERENCE_SERVER)], check=True)
    sys.path.insert(0, str(ROOT / "backend"))
    for module_name in [
        "app.shared.schemas",
        "app.shared.types",
        "app.shared.enums",
        "app.modules.auth.schemas",
        "app.modules.users.schemas",
        "app.modules.library.schemas",
        "app.modules.progress.schemas",
        "app.modules.vocabulary.schemas",
        "app.modules.review.schemas",
        "app.modules.captions.schemas",
        "app.modules.word_analysis.schemas",
        "app.modules.dashboard.schemas",
        "app.modules.migration.enums",
        "app.modules.migration.schemas",
    ]:
        importlib.import_module(module_name)

    main_css = (FRONTEND / "src/styles/main.css").read_text(encoding="utf-8")
    css_refs = re.findall(r'@import\s+"([^"]+)";', main_css)
    if not css_refs:
        fail("No CSS imports found in frontend/src/styles/main.css")

    css_parts = []
    for ref in css_refs:
        target = (FRONTEND / "src/styles" / ref).resolve()
        if not target.is_file():
            fail(f"Missing CSS imported by main.css: {ref}")
        css = target.read_text(encoding="utf-8")
        if css.count("{") != css.count("}"):
            fail(f"Unbalanced CSS braces in {target.relative_to(ROOT)}")
        css_parts.append(css)

    if original:
        original_css_match = re.search(r"<style>\s*\n(?P<css>.*?)\n\s*</style>", original, re.S)
        if not original_css_match:
            fail("Could not find original inline CSS for comparison")
        original_lines = [line for line in original_css_match.group("css").splitlines() if line.strip()]
        resolved_lines = [line for part in css_parts for line in part.splitlines() if line.strip()]
        if resolved_lines != original_lines:
            fail("Resolved modular CSS no longer matches the original v7 stylesheet")

    print(f"[OK] {len(script_refs)} JavaScript files, server/schema syntax, frontend assets, and references verified.")


if __name__ == "__main__":
    main()
