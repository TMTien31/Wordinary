function hashPdfBytes(bytes, name = "document") {
  let hash = 2166136261;
  const step = Math.max(1, Math.floor(bytes.length / 2048));
  for (let i = 0; i < bytes.length; i += step) { hash ^= bytes[i]; hash = Math.imul(hash, 16777619); }
  for (let i = 0; i < name.length; i += 1) { hash ^= name.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `pdf_${(hash >>> 0).toString(36)}`;
}

function base64ToBytes(base64) {
  const binary = atob(base64); const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function loadExternalScript(src, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const existing = [...document.scripts].find(script => script.src === src);
    if (existing?.dataset.loaded === "1") return resolve();
    const script = existing || document.createElement("script");
    const timer = setTimeout(() => reject(new Error("Library request timed out")), timeout);
    script.src = src;
    script.onload = () => { clearTimeout(timer); script.dataset.loaded = "1"; resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error("Library request failed")); };
    if (!existing) document.head.appendChild(script);
  });
}

async function ensurePdfJs() {
  if (pdfState.pdfjs) return pdfState.pdfjs;
  setPdfEngineState("loading", state.language === "en" ? "loading PDF engine…" : "đang tải PDF engine…");
  try {
    const modernImport = import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
    const pdfjs = await Promise.race([
      modernImport,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Modern PDF.js timed out")), 9000))
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    pdfState.pdfjs = pdfjs;
    setPdfEngineState("ready", "PDF.js ready");
    return pdfjs;
  } catch (modernError) {
    try {
      await loadExternalScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", 12000);
      const pdfjs = window.pdfjsLib;
      if (!pdfjs) throw new Error("Legacy PDF.js did not initialize");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      pdfState.pdfjs = pdfjs;
      setPdfEngineState("ready", "PDF.js ready • fallback");
      return pdfjs;
    } catch (legacyError) {
      setPdfEngineState("error", state.language === "en" ? "PDF engine unavailable" : "không tải được PDF engine");
      throw legacyError;
    }
  }
}

function setPdfEngineState(kind, text) {
  const root = $(".pdf-engine-state");
  if (root) root.className = `pdf-engine-state ${kind === "ready" ? "ready" : kind === "error" ? "error" : ""}`;
  if ($("#pdfEngineStatus")) $("#pdfEngineStatus").textContent = text;
}

function setPdfLoading(show, text = "Đang render trang…") {
  $("#pdfLoading")?.classList.toggle("is-hidden", !show);
  if ($("#pdfLoadingText")) $("#pdfLoadingText").textContent = text;
}

async function openPdfBytes(bytes, fileName = "document.pdf", options = {}) {
  if (!bytes?.length) return;
  const originalBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const durableBytes = originalBytes.slice();
  setPdfLoading(true, state.language === "en" ? "Opening PDF…" : "Đang mở PDF…");
  try {
    const pdfjs = await ensurePdfJs();
    const loadingTask = pdfjs.getDocument({ data: originalBytes });
    const doc = await loadingTask.promise;
    pdfState.doc = doc;
    pdfState.fileName = fileName;
    pdfState.id = hashPdfBytes(durableBytes, fileName);
    const existingItem = options.restoreItem || getLibraryItem(options.libraryItemId || state.pendingPdfLibraryId);
    pdfState.libraryItemId = options.libraryItemId || state.pendingPdfLibraryId || `library_pdf_${pdfState.id}`;
    pdfState.page = Math.max(1, Math.min(doc.numPages, Number(existingItem?.position?.page) || 1));
    pdfState.pageCount = doc.numPages;
    pdfState.scale = Number(existingItem?.metadata?.zoom) || 1.15;
    pdfState.fitMode = "width";
    pdfState.pageTexts.clear();
    pdfState.pageItems.clear();
    pdfState.activeWord = "";
    pdfState.wordPages = [];
    $("#pdfOnboarding").classList.add("is-hidden");
    $("#pdfWorkspace").classList.remove("is-hidden");
    $("#pdfFileName").textContent = fileName;
    $("#pdfFileMeta").textContent = `${doc.numPages} ${state.language === "en" ? "pages" : "trang"} ${existingItem?.storageSource === "api" ? "• cloud" : "• uploading"}`;
    $("#pdfPageTotal").textContent = `/ ${doc.numPages}`;
    $("#pdfPageInput").max = doc.numPages;
    $("#pdfOnboardingTitle").textContent = state.language === "en" ? "Drop a document here" : "Thả tài liệu vào đây";
    $("#pdfOnboardingText").textContent = state.language === "en" ? "The file is saved to your library after it opens." : "File sẽ được lưu vào thư viện sau khi mở.";
    $("#pdfChooseFile").textContent = state.language === "en" ? "Choose PDF file" : "Chọn file PDF";
    const item = upsertPdfLibraryItem({
      id:existingItem?.storageSource === "api" ? pdfState.libraryItemId : pdfState.id,
      fileName,
      pageCount:doc.numPages,
      currentPage:pdfState.page,
      progress:doc.numPages > 1 ? Math.round((pdfState.page - 1) / (doc.numPages - 1) * 100) : 100,
      availableInSession:true,
      storageSource:existingItem?.storageSource === "api" ? "api" : "local",
      metadata:existingItem?.metadata || {}
    }, true);
    pdfState.libraryItemId = item.id;
    state.pendingPdfLibraryId = null;
    saveState(); updateStats();
    await renderPdfThumbnails();
    await renderPdfPage(pdfState.page);
    renderPdfWordRail();
    indexPdfDocumentText();
    if (!options.skipApiUpload && item.storageSource !== "api") {
      showToast(state.language === "en" ? "Saving PDF" : "Đang lưu PDF", state.language === "en" ? "Adding the file to your library..." : "Đang thêm file vào thư viện...", "↑");
      savePdfToApi(durableBytes, fileName, doc.numPages, item)
        .then(apiItem => {
          if (!apiItem || apiItem.storageSource !== "api") {
            throw new Error("PDF was not saved");
          }
          pdfState.libraryItemId = apiItem.id;
          apiItem.position = { ...apiItem.position, page:pdfState.page, zoom:pdfState.scale };
          apiItem.progress = pdfState.pageCount > 1 ? Math.round((pdfState.page - 1) / (pdfState.pageCount - 1) * 100) : 100;
          schedulePdfProgressSync(apiItem);
          flushPdfProgressSync();
          updateStats();
          refreshAndRenderLibrary(250);
          showToast(state.language === "en" ? "PDF saved" : "Đã lưu PDF", state.language === "en" ? "It is now available in your library." : "File đã sẵn sàng trong thư viện của bạn.", "✓");
        })
        .catch(error => {
          discardTransientLibraryItems();
          pdfState.libraryItemId = "";
          state.currentLibraryItemId = null;
          console.warn("Could not sync PDF", error);
          updateStats();
          if ($("#libraryView")?.classList.contains("active")) renderLibraryOverview();
          showToast(state.language === "en" ? "PDF was not saved" : "PDF chưa được lưu", error.message || (state.language === "en" ? "Cloud sync failed. Try again later." : "Chưa đồng bộ lên server được. Hãy thử lại sau."), "!");
        });
    }
    showToast(state.language === "en" ? "PDF ready" : "PDF đã sẵn sàng", state.language === "en" ? "Highlight text directly on the page to translate and save it." : "Bôi đen chữ trực tiếp trên trang để dịch và lưu từ.", "📄");
  } catch (error) {
    console.error(error);
    showToast(state.language === "en" ? "Cannot open PDF" : "Không thể mở PDF", state.language === "en" ? "Try another file or run the app from a local web server." : "Hãy thử file khác hoặc chạy app bằng local web server.", "⚠️");
  } finally { setPdfLoading(false); applyLanguage(); }
}

async function handlePdfFile(file) {
  if (!file) return;
  if (!state.currentUser || !getAuthToken()) return showToast(state.language === "en" ? "Log in required" : "Cần đăng nhập", state.language === "en" ? "Sign in to save PDF files to your library." : "Đăng nhập để lưu PDF vào thư viện.", "!");
  if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") return showToast("Định dạng chưa hỗ trợ", "Hãy chọn một file PDF.", "⚠️");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const restoreItem = getLibraryItem(state.pendingPdfLibraryId);
  await openPdfBytes(bytes, file.name, { libraryItemId:state.pendingPdfLibraryId || "", restoreItem });
  $("#pdfFileInput").value = "";
}

function computePdfScale(page) {
  const base = page.getViewport({ scale:1 });
  if (pdfState.fitMode === "width") {
    const available = Math.max(320, $("#pdfViewerViewport").clientWidth - 70);
    return Math.max(.45, Math.min(2.6, available / base.width));
  }
  return pdfState.scale;
}

async function renderPdfPage(pageNumber = pdfState.page) {
  if (!pdfState.doc) return;
  const token = ++pdfState.renderToken;
  pageNumber = Math.max(1, Math.min(pdfState.pageCount, Number(pageNumber) || 1));
  pdfState.page = pageNumber;
  if (pdfState.libraryItemId) {
    const item = getLibraryItem(pdfState.libraryItemId);
    if (item) {
      item.position = { ...item.position, page:pageNumber };
      item.progress = pdfState.pageCount > 1 ? Math.round((pageNumber - 1) / (pdfState.pageCount - 1) * 100) : 100;
      item.lastOpenedAt = Date.now();
      item.metadata = { ...item.metadata, availableInSession:true, zoom:pdfState.scale };
      schedulePdfProgressSync(item);
      clearTimeout(renderPdfPage._saveTimer);
      renderPdfPage._saveTimer = setTimeout(() => { saveState(); updateStats(); }, 260);
    }
  }
  setPdfLoading(true, state.language === "en" ? `Rendering page ${pageNumber}…` : `Đang render trang ${pageNumber}…`);
  try {
    const page = await pdfState.doc.getPage(pageNumber);
    const scale = computePdfScale(page);
    const viewport = page.getViewport({ scale });
    const outputScale = Math.min(2, window.devicePixelRatio || 1);
    pdfState.outputScale = outputScale;
    const canvas = $("#pdfCanvas");
    const context = canvas.getContext("2d", { alpha:false });
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    const shell = $("#pdfPageShell");
    shell.style.width = `${viewport.width}px`;
    shell.style.height = `${viewport.height}px`;
    const transform = outputScale !== 1 ? [outputScale,0,0,outputScale,0,0] : null;
    await page.render({ canvasContext:context, transform, viewport, background:"rgb(255,255,255)" }).promise;
    if (token !== pdfState.renderToken) return;
    const textContent = await page.getTextContent();
    pdfState.pageItems.set(pageNumber, textContent);
    pdfState.pageTexts.set(pageNumber, textContent.items.map(item => item.str).join(" ").replace(/\s+/g," ").trim());
    renderPdfTextLayer(textContent, viewport);
    $("#pdfPageInput").value = pageNumber;
    $("#pdfZoomReset").textContent = `${Math.round(scale * 100)}%`;
    $("#pdfPageStatus").textContent = textContent.items.length ? (state.language === "en" ? `Page ${pageNumber} / ${pdfState.pageCount} • selectable text ready` : `Trang ${pageNumber} / ${pdfState.pageCount} • text layer sẵn sàng`) : (state.language === "en" ? `Page ${pageNumber} / ${pdfState.pageCount} • scanned page, try OCR` : `Trang ${pageNumber} / ${pdfState.pageCount} • trang scan, hãy thử OCR`);
    $$(".pdf-thumb").forEach(item => item.classList.toggle("active", Number(item.dataset.pdfPage) === pageNumber));
    const activeThumb = $(`.pdf-thumb[data-pdf-page="${pageNumber}"]`); activeThumb?.scrollIntoView({ block:"nearest" });
    if (pdfState.activeWord) highlightPdfWordOnPage(pdfState.activeWord, false);
  } catch (error) { console.error(error); showToast("PDF render error", error.message || "Không thể render trang này.", "⚠️"); }
  finally { if (token === pdfState.renderToken) setPdfLoading(false); }
}

function schedulePdfProgressSync(item = getLibraryItem(pdfState.libraryItemId)) {
  if (!item || item.storageSource !== "api" || !state.currentUser || !getAuthToken()) return;
  schedulePdfProgressSync._pending = {
    itemId:item.id,
    progress:Math.max(0, Math.min(100, Number(item.progress) || 0)),
    page:Math.max(1, Number(item.position?.page) || 1),
    zoom:Number(pdfState.scale) || undefined
  };
  clearTimeout(schedulePdfProgressSync._timer);
  schedulePdfProgressSync._timer = setTimeout(flushPdfProgressSync, 900);
}

async function flushPdfProgressSync(options = {}) {
  const pending = schedulePdfProgressSync._pending;
  if (!pending || !state.currentUser || !getAuthToken()) return;
  schedulePdfProgressSync._pending = null;
  clearTimeout(schedulePdfProgressSync._timer);
  try {
    const result = await libraryApiUpdateProgress(pending.itemId, {
      type:"pdf",
      libraryItemId:pending.itemId,
      progress:pending.progress,
      position:{ page:pending.page, zoom:pending.zoom }
    }, options);
    const item = getLibraryItem(pending.itemId);
    if (item) {
      item.progress = pending.progress;
      item.position = result.position || { page:pending.page, zoom:pending.zoom };
      item.lastOpenedAt = Date.now();
    }
    saveState();
  } catch (error) {
    console.warn("Could not sync PDF progress", error);
  }
}

function renderPdfTextLayer(textContent, viewport) {
  const container = $("#pdfTextLayer");
  container.innerHTML = "";
  container.style.width = `${viewport.width}px`;
  container.style.height = `${viewport.height}px`;
  const styles = textContent.styles || {};
  textContent.items.forEach((item, index) => {
    if (!item.str) return;
    const tx = pdfState.pdfjs.Util.transform(viewport.transform, item.transform);
    const angle = Math.atan2(tx[1], tx[0]);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    const style = styles[item.fontName] || {};
    let fontAscent = fontHeight;
    if (style.ascent) fontAscent = style.ascent * fontHeight;
    else if (style.descent) fontAscent = (1 + style.descent) * fontHeight;
    const span = document.createElement("span");
    span.textContent = item.str;
    span.dataset.pdfText = item.str;
    span.dataset.pdfItem = index;
    span.style.left = `${tx[4]}px`;
    span.style.top = `${tx[5] - fontAscent}px`;
    span.style.fontSize = `${fontHeight}px`;
    span.style.fontFamily = style.fontFamily || "sans-serif";
    span.style.height = `${fontHeight}px`;
    container.appendChild(span);
    const measured = span.getBoundingClientRect().width || span.offsetWidth || 1;
    const target = Math.abs((item.width || 0) * viewport.scale);
    const scaleX = target > 0 ? target / measured : 1;
    span.style.transform = `${angle ? `rotate(${angle}rad) ` : ""}scaleX(${Math.max(.05, scaleX)})`;
  });
}

async function renderPdfThumbnails() {
  const root = $("#pdfThumbnails"); root.innerHTML = "";
  for (let number = 1; number <= pdfState.pageCount; number += 1) {
    const button = document.createElement("button");
    button.className = `pdf-thumb${number === 1 ? " active" : ""}`;
    button.dataset.pdfPage = number;
    button.innerHTML = `<canvas></canvas><small>${state.language === "en" ? "Page" : "Trang"} ${number}</small>`;
    root.appendChild(button);
    if (number <= 32) {
      try {
        const page = await pdfState.doc.getPage(number);
        const base = page.getViewport({ scale:1 });
        const scale = Math.min(.24, 118 / base.width);
        const viewport = page.getViewport({ scale });
        const canvas = button.querySelector("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvasContext:canvas.getContext("2d"), viewport }).promise;
      } catch (_) {}
    }
  }
}

async function indexPdfDocumentText() {
  if (!pdfState.doc || pdfState.indexing) return;
  pdfState.indexing = true;
  for (let number = 1; number <= pdfState.pageCount; number += 1) {
    if (!pdfState.pageTexts.has(number)) {
      try {
        const page = await pdfState.doc.getPage(number);
        const content = await page.getTextContent();
        pdfState.pageTexts.set(number, content.items.map(item => item.str).join(" ").replace(/\s+/g," ").trim());
        pdfState.pageItems.set(number, content);
      } catch (_) {}
    }
    if (number % 5 === 0) setPdfEngineState("ready", `${state.language === "en" ? "indexing" : "đang lập chỉ mục"} ${number}/${pdfState.pageCount}`);
  }
  pdfState.indexing = false;
  setPdfEngineState("ready", "PDF.js ready");
  if (pdfState.activeWord) updatePdfWordPages(pdfState.activeWord);
}

function pdfCards() {
  if (!pdfState.id && !pdfState.libraryItemId) return [];
  return state.cards.filter(card => card.sourceType === "pdf" && (card.sourceId === pdfState.libraryItemId || card.sourceId === pdfState.id));
}

function renderPdfWordRail() {
  if (!$("#pdfWordList")) return;
  const map = new Map();
  pdfCards().forEach(card => { const key = (card.word || "").trim().toLowerCase(); if (key && !map.has(key)) map.set(key, card); });
  const cards = [...map.values()];
  $("#pdfSavedCount").textContent = cards.length;
  const root = $("#pdfWordList");
  if (!cards.length) {
    root.innerHTML = `<div class="pdf-word-empty">${state.language === "en" ? "No words saved from this PDF yet. Highlight text on the page to start a context collection." : "Chưa có từ nào được lưu từ PDF này. Hãy bôi đen chữ trên trang để bắt đầu bộ ngữ cảnh."}</div>`;
    return;
  }
  root.innerHTML = cards.map(card => `<button class="pdf-word-item ${pdfState.activeWord.toLowerCase() === card.word.toLowerCase() ? "active" : ""}" data-pdf-word="${escapeHtml(card.word)}"><img src="${iconUrl(card.icon)}" alt=""><span><b>${escapeHtml(card.word)}</b><small>${escapeHtml(card.translation || "")}</small></span><span>${Number.isFinite(card.sourcePage) ? `p.${card.sourcePage}` : "PDF"}</span></button>`).join("");
}

function updatePdfWordPages(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const regex = new RegExp(`(^|[^A-Za-z])${escaped}([^A-Za-z]|$)`,"i");
  pdfState.wordPages = [...pdfState.pageTexts.entries()].filter(([,text]) => regex.test(text)).map(([page]) => page).sort((a,b)=>a-b);
  pdfState.wordPageIndex = Math.max(0, pdfState.wordPages.indexOf(pdfState.page));
  $("#pdfActiveWordBox").classList.toggle("is-hidden", !word);
  $("#pdfActiveWord").textContent = word || "—";
  $("#pdfOccurrenceLabel").textContent = `${pdfState.wordPages.length} ${state.language === "en" ? "pages" : "trang"}`;
}

async function highlightPdfWord(word, navigate = true) {
  pdfState.activeWord = word || "";
  renderPdfWordRail();
  if (!word) { $$("#pdfTextLayer .pdf-word-hit").forEach(span => span.classList.remove("pdf-word-hit","active")); $("#pdfActiveWordBox").classList.add("is-hidden"); return; }
  updatePdfWordPages(word);
  if (navigate && pdfState.wordPages.length && !pdfState.wordPages.includes(pdfState.page)) await renderPdfPage(pdfState.wordPages[0]);
  highlightPdfWordOnPage(word, true);
}

function highlightPdfWordOnPage(word, scroll = true) {
  const normalized = word.toLowerCase();
  const hits = [];
  $$("#pdfTextLayer span").forEach(span => {
    span.classList.remove("pdf-word-hit","active");
    const text = (span.dataset.pdfText || span.textContent || "").toLowerCase();
    if (normalized && text.includes(normalized)) { span.classList.add("pdf-word-hit"); hits.push(span); }
  });
  if (hits.length) { hits[0].classList.add("active"); if (scroll) hits[0].scrollIntoView({ behavior:"smooth", block:"center", inline:"center" }); }
}

async function movePdfOccurrence(direction) {
  if (!pdfState.wordPages.length) return;
  pdfState.wordPageIndex = (pdfState.wordPageIndex + direction + pdfState.wordPages.length) % pdfState.wordPages.length;
  await renderPdfPage(pdfState.wordPages[pdfState.wordPageIndex]);
  highlightPdfWordOnPage(pdfState.activeWord, true);
}

function pdfSentenceForSelection(selected, pageText) {
  const clean = pageText || selected;
  try {
    const segments = [...new Intl.Segmenter("en", { granularity:"sentence" }).segment(clean)];
    const found = segments.find(segment => segment.segment.toLowerCase().includes(selected.toLowerCase()));
    if (found) return found.segment.trim();
  } catch (_) {}
  const index = clean.toLowerCase().indexOf(selected.toLowerCase());
  if (index < 0) return selected;
  return clean.slice(Math.max(0,index-120),Math.min(clean.length,index+selected.length+160)).trim();
}

async function handlePdfSelection() {
  await sleep(12);
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!$("#pdfTextLayer").contains(range.commonAncestorContainer)) return;
  const selected = normalizeSelectedText(selection.toString());
  if (!selected || selected.length > 100 || selected.split(/\s+/).length > 8) return;
  const pageText = pdfState.pageTexts.get(pdfState.page) || $("#pdfTextLayer").textContent || selected;
  const sentence = pdfSentenceForSelection(selected, pageText);
  state.selection = {
    word:selected, sentence, range:range.cloneRange(), translation:"", sentenceTranslation:"", definition:"", phonetic:"", icons:[], selectedIcon:ICON_FALLBACKS.default[0],
    sourceId:pdfState.id, sourceTitle:pdfState.fileName || "PDF document", sourceType:"pdf", sourceUrl:"", sourcePage:pdfState.page
  };
  openSelectionPopup(range.getBoundingClientRect());
  loadSelectionData();
  $("#pdfPageStatus").textContent = `${state.language === "en" ? "Selected" : "Đã chọn"} “${selected}” • ${state.language === "en" ? "page" : "trang"} ${pdfState.page}`;
}

async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve,reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
  });
  return window.Tesseract;
}

async function ocrCurrentPdfPage() {
  if (!pdfState.doc || pdfState.ocrRunning) return;
  pdfState.ocrRunning = true;
  const button = $("#pdfOcrPage"); button.disabled = true;
  try {
    const Tesseract = await ensureTesseract();
    setPdfLoading(true, state.language === "en" ? "Loading local OCR…" : "Đang tải OCR cục bộ…");
    const result = await Tesseract.recognize($("#pdfCanvas"), "eng+vie", { logger: message => {
      if (message.status === "recognizing text") setPdfLoading(true, `${state.language === "en" ? "OCR" : "OCR"} ${Math.round((message.progress || 0) * 100)}%`);
    }});
    const words = result.data.words || [];
    const layer = $("#pdfTextLayer"); layer.innerHTML = "";
    const canvas = $("#pdfCanvas");
    const scaleX = layer.clientWidth / canvas.width;
    const scaleY = layer.clientHeight / canvas.height;
    words.forEach((word,index) => {
      if (!word.text?.trim()) return;
      const span = document.createElement("span");
      span.textContent = word.text;
      span.dataset.pdfText = word.text;
      span.dataset.pdfItem = `ocr_${index}`;
      span.style.left = `${word.bbox.x0 * scaleX}px`;
      span.style.top = `${word.bbox.y0 * scaleY}px`;
      span.style.width = `${Math.max(3,(word.bbox.x1-word.bbox.x0)*scaleX)}px`;
      span.style.height = `${Math.max(8,(word.bbox.y1-word.bbox.y0)*scaleY)}px`;
      span.style.fontSize = `${Math.max(8,(word.bbox.y1-word.bbox.y0)*scaleY)}px`;
      span.style.fontFamily = "sans-serif";
      layer.appendChild(span);
    });
    pdfState.pageTexts.set(pdfState.page, result.data.text.replace(/\s+/g," ").trim());
    $("#pdfPageStatus").textContent = state.language === "en" ? `Page ${pdfState.page} • OCR text layer ready` : `Trang ${pdfState.page} • OCR text layer sẵn sàng`;
    showToast(state.language === "en" ? "OCR complete" : "OCR hoàn tất", state.language === "en" ? "This scanned page can now be highlighted." : "Trang scan này giờ đã có thể bôi đen.", "◎");
  } catch (error) {
    console.error(error);
    showToast(state.language === "en" ? "OCR failed" : "OCR chưa chạy được", state.language === "en" ? "Check your internet connection for the first model download." : "Kiểm tra mạng vì lần đầu cần tải model OCR.", "⚠️");
  } finally { pdfState.ocrRunning = false; button.disabled = false; setPdfLoading(false); }
}

function bindPdfEvents() {
  $("#pdfChooseFile").addEventListener("click", event => { event.stopPropagation(); $("#pdfFileInput").click(); });
  $("#pdfOpenAnother").addEventListener("click", () => $("#pdfFileInput").click());
  $("#pdfFileInput").addEventListener("change", () => handlePdfFile($("#pdfFileInput").files[0]));
  $("#pdfLoadDemo").addEventListener("click", async event => {
    event.stopPropagation();
    state.pendingPdfLibraryId = null;
    if (!state.currentUser || !getAuthToken()) return showToast(state.language === "en" ? "Log in required" : "Cần đăng nhập", state.language === "en" ? "Sign in to save PDF files to your library." : "Đăng nhập để lưu PDF vào thư viện.", "!");
    try {
      const response = await fetch(PDF_DEMO_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await openPdfBytes(new Uint8Array(await response.arrayBuffer()), "wordinary-context-demo.pdf");
    } catch (error) {
      console.error(error);
      showToast(state.language === "en" ? "Could not open sample PDF" : "Không mở được PDF mẫu", state.language === "en" ? "Check that the demo asset is available." : "Kiểm tra file demo trong public/demo.", "⚠️");
    }
  });
  $("#pdfDropzone").addEventListener("click", () => $("#pdfFileInput").click());
  ["dragenter","dragover"].forEach(type => $("#pdfDropzone").addEventListener(type,event => { event.preventDefault(); $("#pdfDropzone").classList.add("drag"); }));
  ["dragleave","drop"].forEach(type => $("#pdfDropzone").addEventListener(type,event => { event.preventDefault(); $("#pdfDropzone").classList.remove("drag"); }));
  $("#pdfDropzone").addEventListener("drop", event => handlePdfFile(event.dataTransfer.files[0]));
  $("#pdfPrevPage").addEventListener("click", () => renderPdfPage(pdfState.page - 1));
  $("#pdfNextPage").addEventListener("click", () => renderPdfPage(pdfState.page + 1));
  $("#pdfPageInput").addEventListener("change", event => renderPdfPage(event.target.value));
  $("#pdfZoomIn").addEventListener("click", () => { pdfState.fitMode = "manual"; pdfState.scale = Math.min(3, Number($("#pdfZoomReset").textContent.replace("%", "")) / 100 + .15); renderPdfPage(pdfState.page); });
  $("#pdfZoomOut").addEventListener("click", () => { pdfState.fitMode = "manual"; pdfState.scale = Math.max(.45, Number($("#pdfZoomReset").textContent.replace("%", "")) / 100 - .15); renderPdfPage(pdfState.page); });
  $("#pdfZoomReset").addEventListener("click", () => { pdfState.fitMode = "manual"; pdfState.scale = 1; renderPdfPage(pdfState.page); });
  $("#pdfFitWidth").addEventListener("click", () => { pdfState.fitMode = "width"; renderPdfPage(pdfState.page); });
  $("#pdfToggleThumbs").addEventListener("click", () => { const collapsed = $("#pdfLayout").classList.toggle("thumbs-collapsed"); $("#pdfToggleThumbs").textContent = collapsed ? "›" : "‹"; requestAnimationFrame(() => pdfState.doc && renderPdfPage(pdfState.page)); });
  $("#pdfThumbnails").addEventListener("click", event => { const item = event.target.closest("[data-pdf-page]"); if (item) renderPdfPage(item.dataset.pdfPage); });
  $("#pdfTextLayer").addEventListener("mouseup", handlePdfSelection);
  $("#pdfTextLayer").addEventListener("touchend", handlePdfSelection);
  $("#pdfWordList").addEventListener("click", event => { const item = event.target.closest("[data-pdf-word]"); if (item) highlightPdfWord(item.dataset.pdfWord); });
  $("#pdfPrevOccurrence").addEventListener("click", () => movePdfOccurrence(-1));
  $("#pdfNextOccurrence").addEventListener("click", () => movePdfOccurrence(1));
  $("#pdfSearchInput").addEventListener("keydown", event => { if (event.key === "Enter") highlightPdfWord(event.target.value.trim()); });
  $("#pdfOcrPage").addEventListener("click", ocrCurrentPdfPage);
  let resizeTimer; window.addEventListener("resize", () => { if (!pdfState.doc || pdfState.fitMode !== "width" || !$("#pdfView").classList.contains("active")) return; clearTimeout(resizeTimer); resizeTimer = setTimeout(() => renderPdfPage(pdfState.page), 180); });
}
