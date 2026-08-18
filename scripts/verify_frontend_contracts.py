from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"


def read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    index = read("frontend/index.html")
    state = read("frontend/src/app/state.js")
    reader = read("frontend/src/features/reader/reader.js")
    reader_css = read("frontend/src/features/reader/reader.css")
    library = read("frontend/src/features/library/library.js")
    library_css = read("frontend/src/features/library/library.css")
    library_v7_css = read("frontend/src/features/library/library-v7.css")
    tokens_css = read("frontend/src/styles/tokens.css")
    bootstrap = read("frontend/src/app/bootstrap.js")

    legacy_tokens = [
        "libraryReader",
        "libraryArticleBody",
        "libraryWordList",
        "readerHighlightToggle",
        "readerPreviousOccurrence",
        "readerNextOccurrence",
        "occurrenceNavigator",
        "library-match",
        "data-reader-word",
    ]
    searchable = "\n".join([index, reader, reader_css, library, library_css, library_v7_css, bootstrap])
    for token in legacy_tokens:
        require(token not in searchable, f"legacy Reader/Library highlight token remains: {token}")

    require('language: appStorage.getItem("wordinary_language") || "en"' in state, "default UI language must be English")
    require("Words that just became yours" not in index, "Reader saved-preview section should stay removed")
    require("readerArticleWordList" in index, "Reader article word list container is missing")
    require("data-reader-highlight-word" in reader, "Reader highlight toggle button is missing")
    require("toggleReaderWordHighlight" in bootstrap, "Reader highlight event delegation is not wired")

    color_count = reader.count("READER_HIGHLIGHT_COLORS")
    require(color_count >= 2, "Reader highlight palette should be defined and used")
    for color in ["yellow", "green", "coral", "violet", "blue", "mint", "rose", "amber", "teal", "indigo"]:
        require(f'"{color}"' in reader, f"Reader highlight palette is missing {color}")
        require(f".reader-word-match.{color}" in reader_css, f"Reader highlight CSS is missing {color}")

    for token in ["--learning-card-radius", "--learning-card-padding", "--learning-card-shadow", "--learning-card-icon-size"]:
        require(token in tokens_css, f"shared learning card token is missing: {token}")
        require(token in reader_css, f"Reader cards do not use shared token: {token}")
        require(token in library_v7_css, f"Library cards do not use shared token: {token}")

    print("Frontend contracts OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
