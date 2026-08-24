/* ARTICLE LIBRARY */
function articlePlainPreview(article, limit = 160) {
  const value = (article.content || "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit).trim()}…` : value;
}

function occurrenceCount(text = "", word = "") {
  if (!word.trim()) return 0;
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  try {
    const pattern = /^[a-z0-9].*[a-z0-9]$/i.test(word.trim()) ? `\\b${escaped}\\b` : escaped;
    return (text.match(new RegExp(pattern, "gi")) || []).length;
  } catch (_) { return 0; }
}

function libraryItemSearchText(item) {
  return `${item.title} ${item.description} ${item.type} ${item.metadata?.author || ""} ${item.sourceUrl || ""}`.toLowerCase();
}

function libraryTypeLabel(type) {
  if (state.language === "en") return type === "article" ? "ARTICLE" : type === "pdf" ? "PDF" : "VIDEO";
  return type === "article" ? "BÀI ĐỌC" : type === "pdf" ? "PDF" : "VIDEO";
}

function libraryItemSecondary(item) {
  if (item.type === "article") return `${item.metadata?.author || "Imported by you"} • ${item.metadata?.wordCount || 0} words`;
  if (item.type === "pdf") return state.language === "en" ? `${item.metadata?.pageCount || 0} pages • saved file` : `${item.metadata?.pageCount || 0} trang • file đã lưu`;
  const duration = item.metadata?.duration ? formatVideoTime(item.metadata.duration) : (state.language === "en" ? "duration unknown" : "chưa rõ thời lượng");
  return `${duration} • ${item.metadata?.captionCount || 0} caption`;
}

function renderContinueLearning(items) {
  const root = $("#continueLearningGrid");
  if (!root) return;
  const candidates = [...items].filter(item => item.progress > 0 && item.progress < 100).sort((a,b) => b.lastOpenedAt - a.lastOpenedAt).slice(0,3);
  $("#continueLearningSection")?.classList.toggle("is-hidden", !candidates.length);
  if (!candidates.length) { root.innerHTML = ""; return; }
  root.innerHTML = candidates.map(item => {
    const icon = item.type === "article" ? "Aa" : item.type === "pdf" ? "PDF" : "▶";
    const position = item.type === "article"
      ? (state.language === "en" ? `${Math.round(item.progress)}% read` : `Đã đọc ${Math.round(item.progress)}%`)
      : item.type === "pdf"
        ? (state.language === "en" ? `Page ${item.position?.page || 1}/${item.metadata?.pageCount || "—"}` : `Trang ${item.position?.page || 1}/${item.metadata?.pageCount || "—"}`)
        : (state.language === "en" ? `Stopped at ${formatVideoTime(item.position?.timestamp || 0)}` : `Dừng ở ${formatVideoTime(item.position?.timestamp || 0)}`);
    return `<button class="continue-card" data-open-library-item="${item.id}"><span class="continue-icon ${item.type}">${icon}</span><span class="continue-copy"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(position)}</small><span class="continue-progress"><span class="continue-progress-track"><span style="width:${Math.round(item.progress)}%"></span></span><strong>${Math.round(item.progress)}%</strong></span></span></button>`;
  }).join("");
}

function getLibraryApiQuery() {
  return {
    type: state.libraryFilter || "all",
    search: $("#librarySearch")?.value || "",
    sort: $("#librarySort")?.value || "recent",
    page: 1,
    pageSize: 100
  };
}

async function refreshAndRenderLibrary(delay = 0) {
  clearTimeout(refreshAndRenderLibrary._timer);
  const run = async () => {
    try {
      await refreshLibraryFromApi(getLibraryApiQuery());
    } catch (error) {
      if (state.currentUser && getAuthToken()) {
        showToast(state.language === "en" ? "Library sync failed" : "Chưa đồng bộ được thư viện", error.message || "Please try again.", "!");
      }
    } finally {
      renderLibraryOverview();
    }
  };
  if (delay > 0) {
    refreshAndRenderLibrary._timer = setTimeout(run, delay);
    return;
  }
  await run();
}

function renderLibraryOverview() {
  $("#libraryOverview").classList.remove("is-hidden");
  syncArticleLibraryItems();
  const allItems = state.libraryItems.map(normalizeLibraryItem);
  const q = ($("#librarySearch")?.value || "").trim().toLowerCase();
  const sort = $("#librarySort")?.value || "recent";
  const filter = state.libraryFilter || "all";
  const enriched = allItems.map(item => ({ item, saved:itemSavedWordCount(item) })).filter(entry => (filter === "all" || entry.item.type === filter) && (!q || libraryItemSearchText(entry.item).includes(q)));

  enriched.sort((a,b) => {
    if (sort === "added") return b.item.createdAt - a.item.createdAt;
    if (sort === "saved") return b.saved - a.saved || b.item.lastOpenedAt - a.item.lastOpenedAt;
    if (sort === "progress") {
      const score = entry => entry.item.progress > 0 && entry.item.progress < 100 ? 1000 + entry.item.progress : entry.item.progress;
      return score(b) - score(a);
    }
    if (sort === "title") return a.item.title.localeCompare(b.item.title);
    return b.item.lastOpenedAt - a.item.lastOpenedAt;
  });

  const inProgress = allItems.filter(item => item.progress > 0 && item.progress < 100).length;
  $("#libraryArticleStat").textContent = allItems.length;
  $("#libraryWordStat").textContent = state.cards.length;
  $("#libraryReturnStat").textContent = inProgress;
  $("#navArticleCount").textContent = allItems.length;
  $("#libraryFilterAllCount").textContent = allItems.length;
  $("#libraryFilterArticleCount").textContent = allItems.filter(item => item.type === "article").length;
  $("#libraryFilterPdfCount").textContent = allItems.filter(item => item.type === "pdf").length;
  $("#libraryFilterVideoCount").textContent = allItems.filter(item => item.type === "video").length;
  $$("[data-library-filter]").forEach(button => button.classList.toggle("active", button.dataset.libraryFilter === filter));
  renderContinueLearning(allItems);

  const root = $("#articleLibraryGrid");
  if (!enriched.length) {
    root.innerHTML = `<div class="library-empty"><div><div class="big">▤</div><h3>${allItems.length ? (state.language === "en" ? "No matching content" : "Không tìm thấy nội dung phù hợp") : (state.language === "en" ? "Your library is empty" : "Thư viện đang trống")}</h3><p>${allItems.length ? (state.language === "en" ? "Try another keyword or content filter." : "Thử từ khóa hoặc bộ lọc khác.") : (state.language === "en" ? "Add an article, PDF, or video to begin." : "Thêm bài đọc, PDF hoặc video để bắt đầu.")}</p></div></div>`;
    applyLanguage();
    return;
  }

  root.innerHTML = enriched.map(({item,saved}) => {
    const progress = Math.round(item.progress || 0);
    const icon = item.type === "article" ? ((item.title.match(/[A-Za-z]/)?.[0] || "A").toUpperCase()) : item.type === "pdf" ? "PDF" : "▶";
    const coverStyle = item.thumbnailUrl ? ` style="background-image:url('${escapeHtml(item.thumbnailUrl)}')"` : "";
    const unavailable = item.type === "pdf" && !item.metadata?.availableInSession;
    const status = unavailable ? `<div class="content-card-status"><span>↻</span><span>${state.language === "en" ? "Choose the PDF file again to continue" : "Chọn lại file PDF để tiếp tục"}</span></div>` : "";
    const deleteAction = item.storageSource === "sample" ? "" : `<button class="content-delete" data-delete-library-item="${item.id}" title="${state.language === "en" ? "Remove from library" : "Xoa khoi thu vien"}" aria-label="${state.language === "en" ? "Remove from library" : "Xoa khoi thu vien"}">&times;</button>`;
    const metrics = item.type === "article"
      ? [`✦ ${saved} ${state.language === "en" ? "words" : "từ"}`, `${item.metadata?.wordCount || 0} words`, `${item.metadata?.readingMinutes || 1} min`]
      : item.type === "pdf"
        ? [`${item.metadata?.pageCount || 0} ${state.language === "en" ? "pages" : "trang"}`, `${state.language === "en" ? "Page" : "Trang"} ${item.position?.page || 1}`, `✦ ${saved}`]
        : [item.metadata?.duration ? formatVideoTime(item.metadata.duration) : "—", `${item.metadata?.captionCount || 0} caption`, `✦ ${saved}`];
    return `<article class="content-card ${item.type}" data-open-library-item="${item.id}"><div class="content-card-cover ${item.thumbnailUrl ? "has-image" : ""}"${coverStyle}><div class="content-card-top"><span class="content-type-badge">${libraryTypeLabel(item.type)}</span>${deleteAction}</div><div class="content-card-mark">${icon}</div></div><div class="content-card-body"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description || libraryItemSecondary(item))}</p><div class="content-card-metrics">${metrics.map(metric => `<span class="content-card-metric">${escapeHtml(metric)}</span>`).join("")}</div>${status}<div class="content-card-footer"><div class="library-progress-track"><span style="width:${progress}%"></span></div><strong>${progress}%</strong></div></div></article>`;
  }).join("");
  applyLanguage();
}

async function openStoredVideoItem(item) {
  videoState.libraryItemId = item.id;
  const url = item.metadata?.url || item.sourceUrl || "";
  $("#videoUrlInput").value = url;
  await loadVideoFromUrl(url, { libraryItemId:item.id, restoreItem:item });
  const storedCaptions = item.metadata?.captions;
  if ((!videoState.captions.length || item.metadata?.sourceLabel) && Array.isArray(storedCaptions) && storedCaptions.length) setCaptions(storedCaptions, item.metadata?.sourceLabel || "saved captions");
  const timestamp = Number(item.position?.timestamp) || 0;
  if (timestamp > 0) setTimeout(() => seekVideo(timestamp), 650);
}

function pdfDownloadOptions(downloadUrl = "") {
  const token = getAuthToken();
  const usesApi = downloadUrl.startsWith("/api/") || downloadUrl.startsWith(API_BASE_URL);
  return token && usesApi ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

function resolvePdfDownloadUrl(downloadUrl = "") {
  if (downloadUrl.startsWith("/api/") && /^https?:\/\//i.test(API_BASE_URL)) {
    return `${new URL(API_BASE_URL).origin}${downloadUrl}`;
  }
  return downloadUrl;
}

async function openStoredPdfItem(item) {
  state.pendingPdfLibraryId = item.id;
  if (item.storageSource === "api" && item.metadata?.downloadUrl) {
    try {
      if (typeof setPdfOnboardingLoading === "function") {
        setPdfOnboardingLoading(true, state.language === "en" ? "Downloading the saved PDF..." : "Đang tải PDF đã lưu...");
      }
      setPdfLoading(true, state.language === "en" ? "Downloading PDF..." : "Đang tải PDF...");
      const downloadUrl = resolvePdfDownloadUrl(item.metadata.downloadUrl);
      const response = await fetch(downloadUrl, pdfDownloadOptions(item.metadata.downloadUrl));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      await openPdfBytes(bytes, item.metadata.fileName || item.title || "document.pdf", {
        libraryItemId:item.id,
        restoreItem:item,
        skipApiUpload:true
      });
      return;
    } catch (error) {
      if (typeof setPdfOnboardingLoading === "function") setPdfOnboardingLoading(false);
      showToast(state.language === "en" ? "Could not download PDF" : "Chưa tải được PDF", error.message || "Please try again.", "!");
    } finally {
      setPdfLoading(false);
    }
  }
  $("#pdfWorkspace").classList.add("is-hidden");
  $("#pdfOnboarding").classList.remove("is-hidden");
  $("#pdfOnboardingTitle").textContent = state.language === "en" ? "Choose this PDF again" : "Chọn lại file PDF này";
  $("#pdfOnboardingText").textContent = state.language === "en" ? `The library kept your reading position on page ${item.position?.page || 1}, but needs the PDF file again.` : `Thư viện vẫn giữ thông tin và trang ${item.position?.page || 1}, nhưng cần bạn chọn lại file PDF.`;
  $("#pdfChooseFile").textContent = state.language === "en" ? "Choose PDF to continue" : "Chọn PDF để tiếp tục";
  showToast(state.language === "en" ? "PDF file needed" : "Cần chọn lại file PDF", state.language === "en" ? "Choose the same file to restore your reading position." : "Chọn lại đúng file để khôi phục vị trí đọc.", "↻");
}

async function openLibraryItem(itemId) {
  const item = getLibraryItem(itemId);
  if (!item) return;
  item.lastOpenedAt = Date.now();
  state.currentLibraryItemId = item.id;
  if (item.type === "article") {
    let article = state.articles.find(entry => entry.id === item.contentId);
    if (item.storageSource === "api" && state.currentUser && getAuthToken()) {
      try {
        article = upsertApiArticleDetail(await libraryApiGetItem(item.id));
      } catch (error) {
        showToast(state.language === "en" ? "Could not open article" : "Chưa mở được bài đọc", error.message || "Please try again.", "!");
        return;
      }
    }
    if (!article) return;
    article.lastOpenedAt = Date.now();
    state.article = { ...article };
    upsertArticle(state.article, true);
    saveState();
    renderArticle();
    setView("readerView");
    if (item.storageSource === "api") {
      scheduleArticleProgressSync(state.article, state.article.progress || 0);
      flushArticleProgressSync();
    }
  } else if (item.type === "pdf") {
    let openItem = item;
    if (item.storageSource === "api" && state.currentUser && getAuthToken()) {
      try {
        openItem = upsertApiPdfDetail(await libraryApiGetItem(item.id));
      } catch (error) {
        showToast(state.language === "en" ? "Could not open PDF" : "Chưa mở được PDF", error.message || "Please try again.", "!");
        return;
      }
    }
    saveState();
    setView("pdfView");
    await openStoredPdfItem(openItem);
  } else {
    let openItem = item;
    if (item.storageSource === "api" && state.currentUser && getAuthToken()) {
      try {
        openItem = upsertApiVideoDetail(await libraryApiGetItem(item.id));
      } catch (error) {
        showToast(state.language === "en" ? "Could not open video" : "Chưa mở được video", error.message || "Please try again.", "!");
        return;
      }
    }
    saveState();
    setView("videoView");
    await openStoredVideoItem(openItem);
  }
}

async function deleteLibraryItem(itemId) {
  const item = getLibraryItem(itemId);
  if (!item) return;
  const message = state.language === "en" ? `Remove “${item.title}” from the library? Saved vocabulary will be kept.` : `Xóa “${item.title}” khỏi thư viện? Từ vựng đã lưu vẫn được giữ lại.`;
  if (!confirm(message)) return;
  if (item.storageSource === "api" && state.currentUser && getAuthToken()) {
    try {
      await libraryApiDeleteItem(item.id);
    } catch (error) {
      showToast(state.language === "en" ? "Could not delete item" : "Chưa xóa được nội dung", error.message || "Please try again.", "!");
      return;
    }
  }
  state.libraryItems = state.libraryItems.filter(entry => entry.id !== itemId);
  if (item.type === "article") {
    state.articles = state.articles.filter(article => article.id !== item.contentId);
    if (state.article?.id === item.contentId) state.article = state.articles[0] ? { ...state.articles[0] } : normalizeArticleRecord({ title:"Untitled article", content:"", author:"Imported by you", kicker:"Your article • interactive reader" });
  }
  if (state.currentLibraryItemId === itemId) state.currentLibraryItemId = state.libraryItems[0]?.id || null;
  saveState(); updateStats(); renderLibraryOverview();
  showToast(state.language === "en" ? "Removed from Library" : "Đã gỡ khỏi Thư viện", state.language === "en" ? "Related vocabulary cards were kept." : "Các flashcard liên quan vẫn được giữ lại.", "×");
}

function scheduleArticleProgressSync(article, percent) {
  if (!article || article.storageSource !== "api" || !state.currentUser || !getAuthToken()) return;
  const progress = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  scheduleArticleProgressSync._pending = { itemId: article.id, progress };
  clearTimeout(scheduleArticleProgressSync._timer);
  scheduleArticleProgressSync._timer = setTimeout(flushArticleProgressSync, 900);
}

async function flushArticleProgressSync(options = {}) {
  const pending = scheduleArticleProgressSync._pending;
  if (!pending || !state.currentUser || !getAuthToken()) return;
  scheduleArticleProgressSync._pending = null;
  clearTimeout(scheduleArticleProgressSync._timer);
  try {
    const result = await libraryApiUpdateProgress(pending.itemId, {
      type: "article",
      libraryItemId: pending.itemId,
      progress: pending.progress,
      position: { scrollProgress: pending.progress }
    }, options);
    const item = state.libraryItems.find(entry => entry.id === pending.itemId);
    if (item) {
      item.progress = pending.progress;
      item.position = result.position || { scrollProgress: pending.progress };
      item.lastOpenedAt = Date.now();
    }
    const article = state.articles.find(entry => entry.id === pending.itemId);
    if (article) {
      article.progress = pending.progress;
      article.lastOpenedAt = Date.now();
    }
    if (state.article?.id === pending.itemId) state.article.progress = pending.progress;
    saveState();
  } catch (error) {
    console.warn("Could not sync article progress", error);
  }
}

