function openImportModal() { $("#importModal").classList.add("show"); }
function closeImportModal() { $("#importModal").classList.remove("show"); }

function markdownToText(markdown) {
  const lines = markdown.split("\n");
  const titleLine = lines.find(line => /^Title:\s*/i.test(line));
  const title = titleLine ? titleLine.replace(/^Title:\s*/i, "").trim() : "Imported article";
  let content = markdown.replace(/^Title:.*$/gmi, "").replace(/^URL Source:.*$/gmi, "").replace(/^Published Time:.*$/gmi, "").replace(/^Markdown Content:\s*$/gmi, "");
  content = content
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, content };
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style,nav,footer,aside,noscript").forEach(el => el.remove());
  const title = doc.querySelector("title,h1")?.textContent?.trim() || "Imported article";
  const blocks = [...doc.querySelectorAll("article p, main p, body p")].map(p => p.textContent.trim()).filter(t => t.length > 25);
  return { title, content: blocks.length ? blocks.join("\n\n") : doc.body.textContent.replace(/\n{3,}/g, "\n\n").trim() };
}

async function importArticle() {
  const btn = $("#doImport");
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = "Đang xử lý...";
  try {
    let article;
    if (state.currentTab === "pastePanel") {
      const content = $("#pasteContent").value.trim();
      if (!content) throw new Error("Hãy dán nội dung bài viết trước.");
      article = { title: $("#pasteTitle").value.trim() || "My reading article", content, importMethod: "paste" };
    } else if (state.currentTab === "filePanel") {
      if (!state.uploadedFile) throw new Error("Hãy chọn một tệp trước.");
      const text = await state.uploadedFile.text();
      const parsed = /\.html?$/i.test(state.uploadedFile.name) ? htmlToText(text) : /\.md$/i.test(state.uploadedFile.name) ? markdownToText(text) : { title: state.uploadedFile.name.replace(/\.[^.]+$/, ""), content: text };
      article = { title: $("#fileTitle").value.trim() || parsed.title, content: parsed.content, importMethod: "file", fileName: state.uploadedFile.name };
    } else {
      let url = $("#articleUrl").value.trim();
      if (!/^https?:\/\//i.test(url)) throw new Error("Hãy nhập URL bắt đầu bằng http:// hoặc https://");
      const res = await fetch(`https://r.jina.ai/${url}`, { headers: { "Accept": "text/plain" } });
      if (!res.ok) throw new Error(`Không thể đọc URL (HTTP ${res.status}).`);
      const text = await res.text();
      const parsed = markdownToText(text);
      if (parsed.content.length < 120) throw new Error("Trang này không trả về đủ nội dung bài viết.");
      article = { ...parsed, sourceUrl: url, importMethod: "url" };
    }
    article = {
      ...article,
      kicker: "Your article • interactive reader",
      author: "Imported by you",
      date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
      level: estimateLevel(article.content)
    };
    if (!state.currentUser || !getAuthToken()) {
      throw new Error(state.language === "en" ? "Please log in before importing articles." : "Hãy đăng nhập trước khi nhập bài đọc.");
    }
    const detail = await libraryApiCreateArticle({
      title: article.title,
      content: article.content,
      sourceUrl: article.sourceUrl || null,
      importMethod: article.importMethod || "paste",
      originalFileName: article.fileName || null
    });
    article = upsertApiArticleDetail(detail);
    state.sessionSaved = 0;
    state.sessionXp = 0;
    saveState();
    renderArticle(); updateStats(); closeImportModal();
    if ($("#libraryView").classList.contains("active")) renderLibraryOverview();
    showToast("Bài đọc đã sẵn sàng", `${article.title} • ${article.level}`, "📖");
  } catch (error) {
    showToast("Chưa nhập được bài", error.message || "Hãy thử lại với nội dung khác.", "⚠️");
  } finally { btn.disabled = false; btn.textContent = original; }
}
