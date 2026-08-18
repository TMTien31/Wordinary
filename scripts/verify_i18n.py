import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
I18N_FILES = [
    ROOT / "frontend/src/shared/i18n/i18n.js",
    ROOT / "frontend/src/shared/i18n/translations.js",
]
MOJIBAKE_MARKERS = ["Ã", "Ä", "Â", "â€", "â€¢", "â†", "âœ", "ðŸ"]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    for path in I18N_FILES:
      text = path.read_text(encoding="utf-8")
      for marker in MOJIBAKE_MARKERS:
          require(marker not in text, f"{path.relative_to(ROOT)} contains mojibake marker {marker!r}")

    translations = (ROOT / "frontend/src/shared/i18n/translations.js").read_text(encoding="utf-8")
    require("const EN_TO_VI" in translations, "translations must use English as the canonical key")
    require("const VI_TO_EN" in translations, "reverse Vietnamese-to-English map is missing")
    require('"Library": "Thư viện"' in translations, "Library translation is missing or reversed")
    require('"Settings": "Cài đặt"' in translations, "Settings translation is missing or reversed")
    require('"Words in this article": "Từ trong bài này"' in translations, "Reader word-list translation is missing")
    require(re.search(r'"Use your Wordinary account to continue\."\s*:\s*"Dùng tài khoản Wordinary', translations), "auth translation direction is wrong")

    print("i18n contracts OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
