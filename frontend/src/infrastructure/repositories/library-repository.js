function stableArticleId(article = {}) {
  const input = `${article.title || "untitled"}|${(article.content || "").slice(0, 500)}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `article_${(hash >>> 0).toString(36)}`;
}

function normalizeArticleRecord(article = {}, forcedId = "") {
  const content = String(article.content || "").trim();
  return {
    ...article,
    id: article.id || forcedId || stableArticleId(article),
    title: article.title || "Untitled article",
    content,
    kicker: article.kicker || "Your article • interactive reader",
    author: article.author || "Imported by you",
    date: article.date || new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    level: article.level || estimateLevel(content),
    createdAt: Number(article.createdAt) || Date.now(),
    lastOpenedAt: Number(article.lastOpenedAt) || Number(article.createdAt) || Date.now(),
    progress: Math.max(0, Math.min(100, Number(article.progress) || 0)),
    storageSource: article.storageSource || "local"
  };
}

function upsertArticle(article, touch = false) {
  const normalized = normalizeArticleRecord(article);
  if (touch) normalized.lastOpenedAt = Date.now();
  const index = state.articles.findIndex(item => item.id === normalized.id);
  if (index >= 0) state.articles[index] = { ...state.articles[index], ...normalized };
  else state.articles.unshift(normalized);
  if (state.article?.id === normalized.id) state.article = { ...state.article, ...normalized };
  if (normalized.storageSource === "api" && Array.isArray(state.libraryItems)) upsertArticleLibraryItem(normalized, touch);
  return normalized;
}

function builtinSampleArticles() {
  return [
    { ...SAMPLE_ARTICLE, id: "wordinary-sample-curiosity" },
    ...WORDINARY_STARTER_ARTICLES
  ].map(item => normalizeArticleRecord({
    ...item,
    storageSource: "sample",
    createdAt: Date.parse(item.date || "") || Date.now(),
    lastOpenedAt: Date.parse(item.date || "") || Date.now()
  }, item.id));
}

function sampleLibraryItems() {
  return builtinSampleArticles().map(article => {
    const words = (article.content || "").match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)?.length || 0;
    return normalizeLibraryItem({
      id: `sample_${article.id}`,
      type: "article",
      storageSource: "sample",
      contentId: article.id,
      title: article.title,
      description: articlePlainPreview(article, 150),
      createdAt: article.createdAt,
      lastOpenedAt: article.lastOpenedAt,
      progress: 0,
      position: { scrollProgress: 0 },
      metadata: { author: article.author || "Wordinary Starter", level: article.level || "B1", wordCount: words, readingMinutes: Math.max(1, Math.round(words / 190)) }
    });
  });
}

function ensureSampleLibraryItems() {
  const apiArticles = (Array.isArray(state.articles) ? state.articles : []).filter(article => article.storageSource === "api");
  const samples = builtinSampleArticles();
  state.articles = [...apiArticles, ...samples];
  const apiItems = (Array.isArray(state.libraryItems) ? state.libraryItems : []).map(normalizeLibraryItem).filter(item => item.storageSource === "api");
  state.libraryItems = [...apiItems, ...sampleLibraryItems()];
}

function initializeArticleLibrary() {
  state.article = normalizeArticleRecord(SAMPLE_ARTICLE, "wordinary-sample-curiosity");
  state.articles = builtinSampleArticles();
  state.libraryArticleId = null;
  state.cards = state.cards.map(card => {
    if (card.sourceType === "video" || card.sourceId) return card;
    return card;
  });
}

function cardsForArticle(article) {
  if (!article) return [];
  return state.cards.filter(card => {
    const sourceType = card.sourceType || "article";
    if (sourceType !== "article") return false;
    return card.sourceId === article.id
      || card.sourceId === article.contentId
      || (!card.sourceId && card.sourceTitle === article.title)
      || card.sourceTitle === article.title;
  });
}

function uniqueCardsForArticle(article) {
  const map = new Map();
  cardsForArticle(article).forEach(card => {
    const key = (card.word || "").trim().toLowerCase();
    if (key && !map.has(key)) map.set(key, card);
  });
  return [...map.values()];
}


const WORDINARY_DATA_VERSION = 2;
function stableStringHash(value = "") {
  let hash = 2166136261;
  const input = String(value);
  for (let i = 0; i < input.length; i += 1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return (hash >>> 0).toString(36);
}

function normalizeLibraryItem(item = {}) {
  const type = ["article", "pdf", "video"].includes(item.type) ? item.type : "article";
  const sourceKey = item.contentId || item.sourceUrl || item.title || `${type}-${Date.now()}`;
  return {
    ...item,
    id: item.id || `library_${type}_${stableStringHash(sourceKey)}`,
    type,
    contentId: item.contentId || "",
    title: item.title || (type === "pdf" ? "Untitled.pdf" : type === "video" ? "Untitled video" : "Untitled article"),
    description: item.description || "",
    thumbnailUrl: item.thumbnailUrl || "",
    sourceUrl: item.sourceUrl || "",
    createdAt: Number(item.createdAt) || Date.now(),
    lastOpenedAt: Number(item.lastOpenedAt) || Number(item.createdAt) || Date.now(),
    progress: Math.max(0, Math.min(100, Number(item.progress) || 0)),
    position: item.position && typeof item.position === "object" ? item.position : {},
    metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {}
  };
}

function upsertLibraryItem(item, touch = false) {
  const existing = item?.id ? state.libraryItems.find(entry => entry.id === item.id) : null;
  const normalized = normalizeLibraryItem({
    ...existing,
    ...item,
    createdAt: Number(item?.createdAt) || Number(existing?.createdAt) || Date.now(),
    lastOpenedAt: touch ? Date.now() : (Number(item?.lastOpenedAt) || Number(existing?.lastOpenedAt) || Date.now()),
    metadata: { ...(existing?.metadata || {}), ...(item?.metadata || {}) },
    position: { ...(existing?.position || {}), ...(item?.position || {}) }
  });
  const index = state.libraryItems.findIndex(entry => entry.id === normalized.id);
  if (index >= 0) state.libraryItems[index] = normalized;
  else state.libraryItems.unshift(normalized);
  return state.libraryItems.find(entry => entry.id === normalized.id);
}

function articleLibraryItemId(articleId, article = {}) {
  return article.storageSource === "api" ? articleId : `library_article_${articleId}`;
}

function upsertArticleLibraryItem(article, touch = false) {
  if (!article?.id) return null;
  const words = (article.content || "").match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)?.length || 0;
  return upsertLibraryItem({
    id: articleLibraryItemId(article.id, article),
    type: "article",
    storageSource: article.storageSource || "local",
    contentId: article.id,
    title: article.title,
    description: articlePlainPreview(article, 150),
    sourceUrl: article.sourceUrl || "",
    createdAt: article.createdAt,
    lastOpenedAt: article.lastOpenedAt,
    progress: article.progress || 0,
    position: { scrollProgress: article.progress || 0 },
    metadata: { author: article.author || "Imported by you", level: article.level || "B1", wordCount: words, readingMinutes: Math.max(1, Math.round(words / 190)) }
  }, touch);
}

function syncArticleLibraryItems() {
  ensureSampleLibraryItems();
}

function dateToMs(value, fallback = Date.now()) {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function apiSummaryToLibraryItem(summary = {}) {
  const type = summary.type || "article";
  const metadata = summary.metadata || {};
  return normalizeLibraryItem({
    id: summary.id,
    type,
    storageSource: "api",
    contentId: type === "video" ? (metadata.youtubeId || summary.id) : summary.id,
    title: summary.title,
    description: summary.description || "",
    thumbnailUrl: summary.thumbnailUrl || "",
    sourceUrl: summary.sourceUrl || "",
    createdAt: dateToMs(summary.createdAt),
    lastOpenedAt: dateToMs(summary.lastOpenedAt, dateToMs(summary.createdAt)),
    progress: Number(summary.progress) || 0,
    position: summary.position || {},
    metadata: {
      ...metadata,
      savedWordCount: Number(summary.savedWordCount) || 0
    }
  });
}

function apiDetailToArticleRecord(detail = {}) {
  const metadata = detail.metadata || {};
  return normalizeArticleRecord({
    id: detail.id,
    storageSource: "api",
    title: detail.title,
    content: detail.content || "",
    sourceUrl: detail.sourceUrl || "",
    author: metadata.author || "Imported by you",
    level: metadata.level || estimateLevel(detail.content || ""),
    createdAt: dateToMs(detail.createdAt),
    lastOpenedAt: dateToMs(detail.lastOpenedAt, dateToMs(detail.createdAt)),
    progress: Number(detail.progress) || 0,
    kicker: "Your article • interactive reader",
    date: detail.createdAt ? new Date(detail.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : undefined
  });
}

function mergeServerLibraryPage(page = {}) {
  const serverItems = Array.isArray(page.items) ? page.items.map(apiSummaryToLibraryItem) : [];
  const serverIds = new Set(serverItems.map(item => item.id));
  state.libraryItems = serverItems;
  state.articles = state.articles.filter(article => article.storageSource === "api" && serverIds.has(article.id));
  serverItems.forEach(item => {
    if (item.type !== "article") return;
    const existing = state.articles.find(article => article.id === item.contentId);
    if (!existing) {
      state.articles.push(normalizeArticleRecord({
        id: item.contentId,
        storageSource: "api",
        title: item.title,
        content: "",
        sourceUrl: item.sourceUrl,
        createdAt: item.createdAt,
        lastOpenedAt: item.lastOpenedAt,
        progress: item.progress,
        author: item.metadata?.author || "Imported by you",
        level: item.metadata?.level || "B1"
      }));
    } else {
      existing.storageSource = "api";
      existing.title = item.title;
      existing.sourceUrl = item.sourceUrl;
      existing.progress = item.progress;
      existing.lastOpenedAt = item.lastOpenedAt;
    }
  });
  ensureSampleLibraryItems();
  state.libraryServerReady = true;
}

function clearApiLibraryCache() {
  state.libraryItems = [];
  state.articles = builtinSampleArticles();
  state.currentLibraryItemId = null;
  state.libraryArticleId = null;
  state.pendingPdfLibraryId = null;
  state.article = normalizeArticleRecord(SAMPLE_ARTICLE, "wordinary-sample-curiosity");
  if (typeof purgeBackendBackedBrowserState === "function") purgeBackendBackedBrowserState();
}

function discardTransientLibraryItems() {
  state.libraryItems = (Array.isArray(state.libraryItems) ? state.libraryItems : []).filter(item => item.storageSource === "api");
  state.articles = (Array.isArray(state.articles) ? state.articles : []).filter(article => article.storageSource === "api");
  if (state.currentLibraryItemId && !state.libraryItems.some(item => item.id === state.currentLibraryItemId)) state.currentLibraryItemId = null;
  if (typeof videoState !== "undefined" && videoState.libraryItemId && !state.libraryItems.some(item => item.id === videoState.libraryItemId)) videoState.libraryItemId = "";
  if (typeof pdfState !== "undefined" && pdfState.libraryItemId && !state.libraryItems.some(item => item.id === pdfState.libraryItemId)) pdfState.libraryItemId = "";
  ensureSampleLibraryItems();
  if (typeof purgeBackendBackedBrowserState === "function") purgeBackendBackedBrowserState();
}

async function refreshLibraryFromApi(params = {}) {
  if (!state.currentUser || !getAuthToken()) return null;
  const page = await libraryApiList({
    type: params.type ?? (state.libraryFilter === "all" ? "all" : state.libraryFilter),
    search: params.search ?? ($("#librarySearch")?.value || ""),
    sort: params.sort ?? ($("#librarySort")?.value || "recent"),
    page: params.page || 1,
    pageSize: params.pageSize || 100
  });
  mergeServerLibraryPage(page);
  saveState();
  return page;
}

function upsertApiArticleDetail(detail) {
  const article = apiDetailToArticleRecord(detail);
  state.article = article;
  upsertArticle(article, true);
  return article;
}

function apiDetailToPdfItem(detail = {}) {
  const metadata = detail.metadata || {};
  return normalizeLibraryItem({
    id: detail.id,
    type: "pdf",
    storageSource: "api",
    contentId: detail.id,
    title: detail.title || metadata.fileName || "document.pdf",
    description: detail.description || `${metadata.pageCount || 0} pages`,
    thumbnailUrl: detail.thumbnailUrl || "",
    sourceUrl: detail.sourceUrl || "",
    createdAt: dateToMs(detail.createdAt),
    lastOpenedAt: dateToMs(detail.lastOpenedAt, dateToMs(detail.createdAt)),
    progress: Number(detail.progress) || 0,
    position: detail.position || {},
    metadata: {
      ...metadata,
      documentId: metadata.documentId || detail.id,
      fileName: metadata.fileName || detail.title || "document.pdf",
      pageCount: Number(metadata.pageCount) || 0,
      fileSizeBytes: Number(metadata.fileSizeBytes) || 0,
      mimeType: metadata.mimeType || "application/pdf",
      checksumSha256: metadata.checksumSha256 || "",
      downloadUrl: metadata.downloadUrl || "",
      downloadUrlExpiresAt: metadata.downloadUrlExpiresAt || "",
      fileAvailable: metadata.fileAvailable !== false,
      availableInSession: Boolean(metadata.downloadUrl || metadata.fileAvailable !== false),
      textLayerAvailable: Boolean(metadata.textLayerAvailable),
      ocrUsed: Boolean(metadata.ocrUsed)
    }
  });
}

function upsertApiPdfDetail(detail, previousId = "") {
  const item = apiDetailToPdfItem(detail);
  upsertLibraryItem(item, true);
  if (previousId && previousId !== item.id) {
    state.libraryItems = state.libraryItems.filter(entry => entry.id !== previousId);
  }
  pdfState.libraryItemId = item.id;
  state.currentLibraryItemId = item.id;
  return item;
}

async function savePdfToApi(bytes, fileName, pageCount, previousItem = null) {
  const token = getAuthToken();
  if (!token) throw new Error("Missing auth token; please log in again before uploading PDF");
  if (!bytes?.length) throw new Error("PDF bytes are empty; choose the file again");
  const normalizedFileName = fileName || "document.pdf";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: "application/pdf" }), normalizedFileName);
  form.append("title", previousItem?.title || normalizedFileName);
  form.append("pageCount", String(pageCount || 1));
  form.append("textLayerAvailable", "true");
  console.info("Wordinary PDF sync: uploading", { fileName: normalizedFileName, bytes: bytes.length, pageCount });
  const response = await fetch(`${API_BASE_URL}/library/pdfs`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });
  const detail = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      clearAuthToken();
      if (typeof showAuthScreen === "function") showAuthScreen();
    }
    throw new Error(detail.detail || `PDF upload HTTP ${response.status}`);
  }
  if (!detail?.id || detail.type !== "pdf") {
    throw new Error("PDF upload did not return a server PDF item");
  }
  const item = upsertApiPdfDetail(detail, previousItem?.id || "");
  if (item.storageSource !== "api") {
    throw new Error("PDF upload did not become an API-backed library item");
  }
  item.metadata = { ...item.metadata, documentId: pdfState.id || item.metadata.documentId };
  saveState();
  return item;
}

function apiDetailToVideoItem(detail = {}) {
  const metadata = detail.metadata || {};
  return normalizeLibraryItem({
    id: detail.id,
    type: "video",
    storageSource: "api",
    contentId: metadata.youtubeId || detail.id,
    title: detail.title,
    description: detail.description || (metadata.youtubeId ? "YouTube video" : "Interactive video"),
    thumbnailUrl: detail.thumbnailUrl || "",
    sourceUrl: detail.sourceUrl || metadata.url || "",
    createdAt: dateToMs(detail.createdAt),
    lastOpenedAt: dateToMs(detail.lastOpenedAt, dateToMs(detail.createdAt)),
    progress: Number(detail.progress) || 0,
    position: detail.position || {},
    metadata: {
      ...metadata,
      url: metadata.url || detail.sourceUrl || "",
      duration: Number(metadata.duration) || 0,
      captionCount: Number(metadata.captionCount) || 0,
      captions: Array.isArray(metadata.captions) ? metadata.captions : [],
      sourceLabel: metadata.sourceLabel || "",
      savedWordCount: Number(detail.savedWordCount) || 0
    }
  });
}

function upsertApiVideoDetail(detail) {
  const item = apiDetailToVideoItem(detail);
  upsertLibraryItem(item, true);
  videoState.libraryItemId = item.id;
  state.currentLibraryItemId = item.id;
  return item;
}

function videoCaptionsForApi() {
  if (!Array.isArray(videoState.captions) || videoState.captions.length > 600) return [];
  return videoState.captions.map(cue => ({
    start: Math.max(0, Number(cue.start) || 0),
    end: Math.max(Number(cue.end) || Number(cue.start) + 0.1, Number(cue.start) + 0.1),
    text: String(cue.text || "").trim(),
    translation: String(cue.translation || "").trim()
  })).filter(cue => cue.text && cue.end > cue.start);
}

function currentVideoApiPayload() {
  const youtubeId = parseYouTubeId(videoState.url || "");
  const duration = Math.max(0, getVideoDuration());
  return {
    url: videoState.url,
    title: videoState.title || (youtubeId ? `YouTube • ${youtubeId}` : "Video"),
    duration: duration || null,
    thumbnailUrl: youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : null,
    embeddable: videoState.embedAllowed,
    sourceLabel: videoState.sourceLabel || "",
    captions: videoCaptionsForApi()
  };
}

async function saveCurrentVideoToApi() {
  if (!state.currentUser || !getAuthToken() || !videoState.url || videoState.url.startsWith("data:")) return null;
  const payload = currentVideoApiPayload();
  const existing = videoState.libraryItemId ? getLibraryItem(videoState.libraryItemId) : null;
  const previousId = existing?.storageSource === "api" ? "" : existing?.id || "";
  const detail = existing?.storageSource === "api"
    ? await libraryApiUpdateVideoContent(existing.id, {
        title: payload.title,
        duration: payload.duration,
        thumbnailUrl: payload.thumbnailUrl,
        embeddable: payload.embeddable,
        sourceLabel: payload.sourceLabel,
        captions: payload.captions
      })
    : await libraryApiCreateVideo(payload);
  const item = upsertApiVideoDetail(detail);
  if (previousId && previousId !== item.id) {
    state.libraryItems = state.libraryItems.filter(entry => entry.id !== previousId);
  }
  saveState();
  return item;
}

function videoApiPayloadFromLibraryItem(item = {}) {
  const metadata = item.metadata || {};
  const url = metadata.url || item.sourceUrl || "";
  const captions = Array.isArray(metadata.captions) && metadata.captions.length <= 600
    ? metadata.captions.map(cue => ({
        start: Math.max(0, Number(cue.start) || 0),
        end: Math.max(Number(cue.end) || Number(cue.start) + 0.1, Number(cue.start) + 0.1),
        text: String(cue.text || "").trim(),
        translation: String(cue.translation || "").trim()
      })).filter(cue => cue.text && cue.end > cue.start)
    : [];
  return {
    url,
    title: item.title || "Video",
    duration: Number(metadata.duration) || null,
    thumbnailUrl: item.thumbnailUrl || null,
    embeddable: metadata.embeddable ?? null,
    sourceLabel: metadata.sourceLabel || "",
    captions
  };
}

function initializeUnifiedLibrary() {
  state.libraryItems = sampleLibraryItems();
  state.currentLibraryItemId = null;
  ensureSampleLibraryItems();
  if (typeof purgeBackendBackedBrowserState === "function") purgeBackendBackedBrowserState();
}

function getLibraryItem(itemId) { return state.libraryItems.find(item => item.id === itemId) || null; }

function itemSavedWordCount(item) {
  if (!item) return 0;
  if (item.storageSource === "api" && Number.isFinite(Number(item.metadata?.savedWordCount))) return Number(item.metadata.savedWordCount);
  if (item.type === "article") return state.cards.filter(card => card.sourceType !== "video" && card.sourceType !== "pdf" && (card.sourceId === item.id || card.sourceId === item.contentId || card.sourceTitle === item.title)).length;
  return state.cards.filter(card => card.sourceType === item.type && (card.sourceId === item.id || card.sourceId === item.contentId || card.sourceId === item.metadata?.documentId || card.sourceTitle === item.title)).length;
}

function persistCurrentVideoToLibrary(touch = false) {
  if (!videoState.url) return null;
  const youtubeId = parseYouTubeId(videoState.url || "");
  const id = videoState.libraryItemId || `library_video_${stableStringHash(youtubeId || videoState.url)}`;
  const existing = getLibraryItem(id);
  const duration = Math.max(0, getVideoDuration());
  const current = Math.max(0, getVideoCurrentTime());
  const title = videoState.title || (youtubeId ? `YouTube • ${youtubeId}` : "Video");
  const captions = videoState.captions.length <= 600 ? videoState.captions.map(cue => ({ start:cue.start, end:cue.end, text:cue.text, translation:cue.translation || "" })) : [];
  const item = upsertLibraryItem({
    id,
    type: "video",
    storageSource: existing?.storageSource || "local",
    contentId: youtubeId || stableStringHash(videoState.url),
    title,
    description: youtubeId ? "YouTube video" : "Interactive video",
    thumbnailUrl: youtubeId ? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg` : "",
    sourceUrl: videoState.url,
    progress: duration ? Math.min(100, Math.round(current / duration * 100)) : Math.min(100, Number(getLibraryItem(id)?.progress) || 0),
    position: { timestamp: current },
    metadata: {
      url: videoState.url,
      youtubeId: youtubeId || "",
      duration,
      captionCount: videoState.captions.length,
      captions,
      sourceLabel: videoState.sourceLabel || ""
    }
  }, touch);
  videoState.libraryItemId = item.id;
  state.currentLibraryItemId = item.id;
  return item;
}

function upsertPdfLibraryItem({
  id,
  fileName,
  pageCount,
  currentPage = 1,
  progress = 0,
  availableInSession = true,
  storageSource = "local",
  metadata = {}
}, touch = true) {
  const item = upsertLibraryItem({
    id: storageSource === "api" ? id : (id.startsWith("library_pdf_") ? id : `library_pdf_${id}`),
    type: "pdf",
    storageSource,
    contentId: id,
    title: fileName || "document.pdf",
    description: `${pageCount || 0} pages${storageSource === "api" ? "" : " • uploading"}`,
    progress,
    position: { page: currentPage },
    metadata: {
      ...metadata,
      documentId:metadata.documentId || id,
      fileName:fileName || metadata.fileName || "document.pdf",
      pageCount:Number(pageCount) || Number(metadata.pageCount) || 0,
      availableInSession:Boolean(availableInSession)
    }
  }, touch);
  state.currentLibraryItemId = item.id;
  return item;
}
