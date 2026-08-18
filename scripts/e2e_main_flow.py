import os
import re
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import expect
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
FRONTEND_URL = os.environ.get("WORDINARY_E2E_FRONTEND_URL", "http://localhost:5500")
API_HEALTH_URL = os.environ.get("WORDINARY_E2E_API_HEALTH_URL", "http://localhost:8000/health")
EDGE_PATHS = [
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
]


ARTICLE_TITLE = "E2E Reader Highlight Contract"
ARTICLE_CONTENT = """
Representative readers notice a representative word when it appears more than once.
The representative example keeps the article simple, but the global context is still useful.
When a saved word is highlighted, every representative occurrence should become visible.
""".strip()
VIDEO_DEMO_TITLE = "Why context makes vocabulary stick"


def require_stack() -> None:
    try:
        with urllib.request.urlopen(API_HEALTH_URL, timeout=5) as response:
            if response.status != 200:
                raise RuntimeError(f"API health returned {response.status}")
    except Exception as exc:
        raise RuntimeError(f"Wordinary API is not reachable at {API_HEALTH_URL}") from exc


def browser_executable() -> str:
    for path in EDGE_PATHS:
        if path.exists():
            return str(path)
    raise RuntimeError("No supported Edge/Chrome executable was found")


def open_view(page, view_id: str) -> None:
    page.locator(f".nav-btn[data-view='{view_id}']").click()
    try:
        expect(page.locator(f"#{view_id}")).to_have_class(re.compile("active"), timeout=5000)
    except AssertionError:
        page.evaluate("viewId => window.setView(viewId)", view_id)
        expect(page.locator(f"#{view_id}")).to_have_class(re.compile("active"), timeout=15000)


def select_article_word(page, word: str) -> None:
    page.evaluate(
        """
        targetWord => {
          const root = document.querySelector("#articleBody");
          const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          let node;
          while ((node = walker.nextNode())) {
            const index = node.nodeValue.toLowerCase().indexOf(targetWord.toLowerCase());
            if (index < 0) continue;
            const range = document.createRange();
            range.setStart(node, index);
            range.setEnd(node, index + targetWord.length);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            const rect = range.getBoundingClientRect();
            root.dispatchEvent(new MouseEvent("mouseup", {
              bubbles: true,
              clientX: rect.left + 2,
              clientY: rect.top + 2
            }));
            return;
          }
          throw new Error(`Could not find ${targetWord} in article body`);
        }
        """,
        word,
    )


def sign_up(page, email: str) -> None:
    page.locator("#showSignup").click()
    page.locator("#authSignupForm input[name='displayName']").fill("E2E Runner")
    page.locator("#authSignupForm input[name='email']").fill(email)
    page.locator("#authSignupForm input[name='password']").fill("wordinary-e2e-pass")
    page.locator("#authSignupForm button[type='submit']").click()
    expect(page.locator("#appShell")).not_to_have_class(re.compile("auth-locked"), timeout=15000)
    expect(page.locator("#isleView")).to_have_class(re.compile("active"), timeout=15000)
    expect(page.locator("#isleLevel")).to_have_text("Level 0", timeout=15000)


def run_reader_library_flow(page) -> None:
    open_view(page, "readerView")
    page.locator("#openImport").click()
    expect(page.locator("#importModal")).to_have_class(re.compile("show"))
    page.locator("#pasteTitle").fill(ARTICLE_TITLE)
    page.locator("#pasteContent").fill(ARTICLE_CONTENT)
    page.locator("#doImport").click()
    expect(page.locator("#articleTitle")).to_have_text(ARTICLE_TITLE, timeout=15000)

    open_view(page, "libraryView")
    article_card = page.locator(".content-card", has_text=ARTICLE_TITLE).first
    expect(article_card).to_be_visible(timeout=15000)
    article_card.click()
    expect(page.locator("#readerView")).to_have_class(re.compile("active"))
    expect(page.locator("#articleTitle")).to_have_text(ARTICLE_TITLE)

    select_article_word(page, "representative")
    expect(page.locator("#selectionPopup")).to_have_class(re.compile("show"), timeout=10000)
    expect(page.locator("#popupWord")).to_have_text("Representative")
    page.locator("#saveWord").click()
    word_card = page.locator("[data-reader-card]", has_text="Representative").first
    expect(word_card).to_be_visible(timeout=15000)
    expect(page.locator("#navDueCount")).to_have_text("1", timeout=15000)

    page.locator("[data-reader-highlight-word='Representative']").click()
    expect(page.locator("mark.reader-word-match")).to_have_count(4, timeout=10000)

    open_view(page, "reviewView")
    expect(page.locator("#reviewView")).to_have_class(re.compile("active"))
    expect(page.locator("[data-practice-mode='due']")).to_have_class(re.compile("active"))
    expect(page.locator("#reviewShell")).to_contain_text("Representative", timeout=15000)
    page.locator("#reviewFlipArea").click()
    expect(page.locator("#reviewActions")).to_have_class(re.compile("show"))
    page.locator("[data-rate='good']").click()
    expect(page.locator("#reviewShell")).to_contain_text("You remembered every card", timeout=15000)
    expect(page.locator("#xpCount")).to_have_text("20 XP", timeout=15000)
    expect(page.locator("#navDueCount")).to_have_text("0", timeout=15000)

    open_view(page, "cardsView")
    vocab_card = page.locator(".word-card", has_text="Representative").first
    expect(vocab_card).to_be_visible(timeout=15000)
    expect(vocab_card).to_contain_text("Due tomorrow")
    expect(vocab_card).to_contain_text("Reviewed 1 time")

    open_view(page, "libraryView")
    article_card = page.locator(".content-card", has_text=ARTICLE_TITLE).first
    expect(article_card).to_be_visible(timeout=15000)
    article_card.locator("[data-delete-library-item]").click()
    expect(page.locator(".content-card", has_text=ARTICLE_TITLE)).to_have_count(0, timeout=15000)


def run_pdf_smoke(page) -> None:
    open_view(page, "pdfView")
    expect(page.locator("#pdfView")).to_have_class(re.compile("active"))
    expect(page.locator("#pdfOnboarding")).to_be_visible()
    expect(page.locator("#pdfChooseFile")).to_be_visible()
    expect(page.locator("#pdfLoadDemo")).to_be_visible()
    response = page.request.get(f"{FRONTEND_URL}/public/demo/demo-document.pdf")
    if response.status != 200:
        raise AssertionError(f"sample PDF asset returned HTTP {response.status}")


def run_video_demo_flow(page) -> None:
    open_view(page, "videoView")
    expect(page.locator("#videoView")).to_have_class(re.compile("active"))
    page.locator("#loadVideoDemo").click()
    expect(page.locator("#videoTitle")).to_have_text(VIDEO_DEMO_TITLE, timeout=15000)
    expect(page.locator("#captionList .caption-row")).not_to_have_count(0, timeout=10000)

    open_view(page, "libraryView")
    video_card = page.locator(".content-card", has_text=VIDEO_DEMO_TITLE).first
    expect(video_card).to_be_visible(timeout=15000)
    video_card.locator("[data-delete-library-item]").click()
    expect(page.locator(".content-card", has_text=VIDEO_DEMO_TITLE)).to_have_count(0, timeout=15000)


def main() -> int:
    require_stack()
    email = f"e2e-{int(time.time())}@wordinary.local"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=browser_executable(),
            args=["--disable-gpu", "--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 960})
        page.on("dialog", lambda dialog: dialog.accept())

        page.goto(FRONTEND_URL, wait_until="domcontentloaded")
        page.evaluate("localStorage.clear(); sessionStorage.clear();")
        page.goto(FRONTEND_URL, wait_until="networkidle")

        sign_up(page, email)
        run_reader_library_flow(page)
        run_pdf_smoke(page)
        run_video_demo_flow(page)

        browser.close()

    print("Browser E2E scenarios OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
