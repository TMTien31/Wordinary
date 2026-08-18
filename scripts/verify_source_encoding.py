from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CHECKED_FILES = [
    *(ROOT / "frontend").rglob("*.html"),
    *(ROOT / "frontend/src").rglob("*.js"),
]
MOJIBAKE_MARKERS = [
    "\u00c3",
    "\u00c4",
    "\u00c2",
    "\u00c6",
    "\u00e2\u20ac",
    "\u00e2\u20ac\u00a2",
    "\u00e2\u2020",
    "\u00e2\u0153",
    "\u00e2\u2013",
    "\u00e2\u2014",
    "\u00ef\u00bc",
    "\u00f0\u0178",
    "\u00e1\u00ba",
    "\u00e1\u00bb",
    "\u00e6\u2013",
]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    for path in CHECKED_FILES:
        text = path.read_text(encoding="utf-8")
        for marker in MOJIBAKE_MARKERS:
            require(marker not in text, f"{path.relative_to(ROOT)} contains mojibake marker {marker!r}")
    print("Source encoding contracts OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
