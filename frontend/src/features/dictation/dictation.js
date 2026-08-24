const DICTATION_PROGRESS_KEY = "wordinary_dictation_progress";

function loadDictationProgress() {
  try {
    const parsed = JSON.parse(appStorage.getItem(DICTATION_PROGRESS_KEY) || "{}");
    dictationState.progress = parsed && typeof parsed === "object" ? parsed : {};
  } catch (_) {
    dictationState.progress = {};
  }
}

function saveDictationProgress() {
  appStorage.setItem(DICTATION_PROGRESS_KEY, JSON.stringify(dictationState.progress || {}));
}

function dictationVideoItems() {
  return (state.libraryItems || [])
    .map(normalizeLibraryItem)
    .filter(item => item.type === "video")
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

function dictationItemCaptions(item = getLibraryItem(dictationState.itemId)) {
  const captions = item?.metadata?.captions;
  if (Array.isArray(captions) && captions.length) return captions;
  const currentUrl = item?.metadata?.url || item?.sourceUrl || "";
  if (currentUrl && currentUrl === videoState.url && Array.isArray(videoState.captions)) return videoState.captions;
  if (item?.id && item.id === videoState.libraryItemId && Array.isArray(videoState.captions)) return videoState.captions;
  return [];
}

function dictationSourceSignature(item = getLibraryItem(dictationState.itemId)) {
  const captions = dictationItemCaptions(item);
  const first = captions[0] || {};
  const last = captions[captions.length - 1] || {};
  return [
    item?.id || "",
    dictationState.segmentLength,
    captions.length,
    Math.round((Number(first.start) || 0) * 1000),
    Math.round((Number(last.end) || 0) * 1000),
    stableStringHash(`${first.text || ""}|${last.text || ""}`)
  ].join(":");
}

function dictationSanitizeCue(cue = {}, index = 0) {
  const start = Math.max(0, Number(cue.start) || 0);
  const end = Math.max(Number(cue.end) || start + 0.1, start + 0.1);
  let text = dictationCleanText(cue.text || "");
  const boundaryBefore = /^(?:>>+|[-–—]\s+|[A-Z][A-Za-z .'-]{1,28}:\s+)/.test(text);
  text = text
    .replace(/^(?:>>+\s*)+/, "")
    .replace(/^[-–—]\s+/, "")
    .replace(/^[A-Z][A-Za-z .'-]{1,28}:\s+/, "")
    .trim();
  return {
    index,
    start,
    end,
    text,
    translation: dictationCleanText(cue.translation || ""),
    boundaryBefore
  };
}

function dictationLengthLimits(length = dictationState.segmentLength) {
  if (length === "short") return { fallbackWords: 16, fallbackDuration: 10 };
  if (length === "long") return { fallbackWords: 42, fallbackDuration: 24 };
  return { fallbackWords: 28, fallbackDuration: 16 };
}

function dictationSentenceComplete(text = "") {
  return /[.!?]["')\]]*$/.test(text.trim());
}

function dictationCueIsNoise(cue) {
  const text = String(cue?.text || "").trim();
  if (!text) return true;
  if (/^\[(?:music|applause|laughter|silence|noise|sound)\]$/i.test(text)) return true;
  if (/^\((?:music|applause|laughter|silence|noise|sound)\)$/i.test(text)) return true;
  if (!/[a-z0-9]/i.test(text)) return true;
  return false;
}

function dictationStartsWithCapital(text = "") {
  const first = String(text).trim().match(/[A-Za-z]/);
  return Boolean(first && first[0] === first[0].toUpperCase());
}

function splitDictationCueSentences(cue) {
  const text = cue.text.replace(/\s+/g, " ").trim();
  if (!text) return [];
  const duration = Math.max(0.1, cue.end - cue.start);
  const pattern = /.+?(?:[.!?]+["')\]]*(?=\s|$)|$)/g;
  const parts = [];
  let match;
  while ((match = pattern.exec(text))) {
    const raw = match[0];
    const clean = raw.trim();
    if (!clean) continue;
    const leading = raw.length - raw.trimStart().length;
    const trailing = raw.length - raw.trimEnd().length;
    const from = match.index + leading;
    const to = Math.max(from + clean.length, match.index + raw.length - trailing);
    parts.push({
      index: cue.index,
      start: cue.start + duration * (from / Math.max(text.length, 1)),
      end: cue.start + duration * (to / Math.max(text.length, 1)),
      text: clean,
      translation: cue.translation,
      boundaryBefore: cue.boundaryBefore && parts.length === 0
    });
  }
  return parts;
}

function buildDictationSegments(captions = [], length = dictationState.segmentLength) {
  const limits = dictationLengthLimits(length);
  const cues = captions.map(dictationSanitizeCue).filter(cue => cue.text && cue.end > cue.start);
  const segments = [];
  let buffer = [];

  const flush = () => {
    if (!buffer.length) return;
    const text = buffer.map(cue => cue.text).join(" ").replace(/\s+/g, " ").trim();
    const words = dictationTokenize(text, "easy");
    if (words.length >= 2) {
      segments.push({
        id: `segment_${segments.length}_${Math.round(buffer[0].start * 1000)}_${stableStringHash(text)}`,
        sourceCueIndexes: [...new Set(buffer.map(cue => cue.index))],
        start: buffer[0].start,
        end: buffer[buffer.length - 1].end,
        expectedText: text,
        translation: buffer.map(cue => cue.translation).filter(Boolean).join(" "),
        wordCount: words.length
      });
    }
    buffer = [];
  };

  cues.forEach(cue => {
    if (dictationCueIsNoise(cue)) {
      flush();
      return;
    }
    const parts = splitDictationCueSentences(cue);
    parts.forEach(part => {
      const previous = buffer[buffer.length - 1];
      const gap = previous ? part.start - previous.end : 0;
      const bufferedWords = dictationTokenize(buffer.map(entry => entry.text).join(" "), "easy").length;
      const softBoundary = previous && bufferedWords >= 2 && (part.boundaryBefore || gap > 0.7 || (gap > 0.45 && dictationStartsWithCapital(part.text)));
      if (softBoundary) flush();
      buffer.push(part);
      const text = buffer.map(entry => entry.text).join(" ");
      const wordCount = dictationTokenize(text, "easy").length;
      const duration = buffer[buffer.length - 1].end - buffer[0].start;
      if (dictationSentenceComplete(part.text) || wordCount >= limits.fallbackWords || duration >= limits.fallbackDuration) flush();
    });
  });
  flush();
  return segments;
}

function dictationProgressForItem(itemId = dictationState.itemId) {
  if (!itemId) return {};
  dictationState.progress[itemId] ||= { segments: {}, replayCount: 0, lastIndex: 0, updatedAt: Date.now() };
  dictationState.progress[itemId].segments ||= {};
  return dictationState.progress[itemId];
}

function dictationSegmentProgress(segment) {
  return dictationProgressForItem().segments?.[segment?.id] || null;
}

function dictationCurrentSegment() {
  return dictationState.segments[dictationState.index] || null;
}

function dictationVideoMatchesItem(item = getLibraryItem(dictationState.itemId)) {
  if (!item || !videoState.url || !videoState.ready || videoState.embedBlocked) return false;
  const itemUrl = item.metadata?.url || item.sourceUrl || "";
  return Boolean(itemUrl && itemUrl === videoState.url) || item.id === videoState.libraryItemId;
}

function dictationSourceLabel() {
  const item = getLibraryItem(dictationState.itemId);
  if (!item) return "voice";
  return dictationVideoMatchesItem(item) ? "source audio" : "text voice";
}

function renderDictationSourceOptions() {
  const select = $("#dictationSourceSelect");
  if (!select) return;
  const items = dictationVideoItems();
  if (!dictationState.itemId && items.length) dictationState.itemId = items[0].id;
  select.innerHTML = items.length
    ? items.map(item => {
        const captions = Number(item.metadata?.captionCount) || dictationItemCaptions(item).length;
        const label = `${item.title || "Untitled video"} (${captions} captions)`;
        return `<option value="${escapeHtml(item.id)}">${escapeHtml(label)}</option>`;
      }).join("")
    : `<option value="">No captioned videos yet</option>`;
  if (!items.some(item => item.id === dictationState.itemId)) dictationState.itemId = items[0]?.id || "";
  select.value = dictationState.itemId;
}

async function ensureDictationItemDetail(itemId = dictationState.itemId) {
  let item = getLibraryItem(itemId);
  if (!item || item.type !== "video") return null;
  if (dictationItemCaptions(item).length || item.storageSource !== "api" || !state.currentUser || !getAuthToken()) return item;
  dictationState.loading = true;
  renderDictation();
  try {
    const detail = await libraryApiGetItem(item.id);
    item = upsertLibraryItem(apiDetailToVideoItem(detail), false);
  } catch (error) {
    showToast(state.language === "en" ? "Could not load transcript" : "Chưa tải được transcript", error.message || "Open the video and fetch captions first.", "!");
  } finally {
    dictationState.loading = false;
  }
  return item;
}

async function selectDictationItem(itemId, options = {}) {
  dictationState.itemId = itemId || "";
  dictationState.checked = null;
  dictationState.hintLevel = 0;
  const item = await ensureDictationItemDetail(dictationState.itemId);
  const segments = item ? buildDictationSegments(dictationItemCaptions(item), dictationState.segmentLength) : [];
  dictationState.segments = segments;
  dictationState.segmentSignature = item ? dictationSourceSignature(item) : "";
  const progress = dictationProgressForItem(dictationState.itemId);
  const restored = Number(progress.lastIndex) || 0;
  dictationState.index = options.reset ? 0 : Math.max(0, Math.min(restored, Math.max(segments.length - 1, 0)));
  if (options.retryMissed) {
    const missedIndex = segments.findIndex(segment => progress.segments?.[segment.id]?.status === "retry");
    dictationState.index = missedIndex >= 0 ? missedIndex : 0;
  }
  renderDictation();
}

async function prepareDictationView() {
  if (videoState.url && videoState.captions.length) {
    persistCurrentVideoToLibrary(false);
  }
  renderDictationSourceOptions();
  const itemId = dictationState.itemId || dictationVideoItems()[0]?.id || "";
  const item = getLibraryItem(itemId);
  const signature = item ? dictationSourceSignature(item) : "";
  if (itemId && (
    dictationState.itemId !== itemId ||
    dictationState.segmentSignature !== signature ||
    !dictationState.segments.length
  )) {
    await selectDictationItem(itemId, { reset: false });
    return;
  }
  renderDictation();
}

function dictationSummary() {
  const progress = dictationProgressForItem();
  const entries = dictationState.segments.map(segment => progress.segments?.[segment.id]).filter(Boolean);
  const mastered = entries.filter(entry => entry.status === "mastered").length;
  const retry = entries.filter(entry => entry.status === "retry").length;
  const replayCount = Number(progress.replayCount) || 0;
  const accuracyEntries = entries.filter(entry => Number.isFinite(Number(entry.accuracy)));
  const accuracy = accuracyEntries.length
    ? Math.round(accuracyEntries.reduce((sum, entry) => sum + Number(entry.accuracy), 0) / accuracyEntries.length)
    : 0;
  return { mastered, retry, replayCount, accuracy };
}

function renderDictationStats() {
  const summary = dictationSummary();
  $("#dictationDoneCount").textContent = summary.mastered;
  $("#dictationAccuracy").textContent = `${summary.accuracy}%`;
  $("#dictationRetryCount").textContent = summary.retry;
  $("#dictationReplayCount").textContent = summary.replayCount;
  $("#dictationSourceStatus").textContent = dictationSourceLabel();
  $("#navDictationCount").textContent = dictationState.segments.length || dictationVideoItems().filter(item => dictationItemCaptions(item).length).length;
}

function dictationProgressPercent() {
  if (!dictationState.segments.length) return 0;
  return Math.round(dictationState.index / dictationState.segments.length * 100);
}

function renderDictationDiff(result) {
  if (!result) return "";
  const notes = Array.isArray(result.notes) && result.notes.length
    ? `<div class="dictation-feedback" data-no-i18n>${result.notes.map(note => `<span class="${escapeHtml(note.type)}">${escapeHtml(note.text)}</span>`).join("")}</div>`
    : "";
  return `<div class="dictation-diff" data-no-i18n>${result.diff.pieces.map(piece => `<span class="${piece.type}">${escapeHtml(piece.text)}</span>`).join(" ")}</div>${notes}`;
}

function renderDictationHint(segment) {
  if (!segment || dictationState.hintLevel <= 0) return "";
  const tokens = dictationTokenize(segment.expectedText, "easy");
  if (dictationState.hintLevel === 1) {
    return `<div class="dictation-hint" data-no-i18n>${tokens.map(() => "<span></span>").join("")}</div>`;
  }
  if (dictationState.hintLevel === 2) {
    return `<div class="dictation-hint letters" data-no-i18n>${tokens.map(token => `<span>${escapeHtml(token[0] || "")}</span>`).join("")}</div>`;
  }
  return `<div class="dictation-reveal" data-no-i18n>${escapeHtml(segment.expectedText)}</div>`;
}

function renderDictationFullAnswer(segment) {
  if (!segment || !dictationState.showAnswer) return "";
  return `<div class="dictation-full-answer" data-no-i18n>
    <div><b>Full answer</b><span>${formatVideoTime(segment.start)} - ${formatVideoTime(segment.end)}</span></div>
    <p>${escapeHtml(segment.expectedText)}</p>
  </div>`;
}

function dictationSourceUrl(item = getLibraryItem(dictationState.itemId)) {
  return item?.metadata?.url || item?.sourceUrl || videoState.url || "";
}

function dictationYouTubeId(item = getLibraryItem(dictationState.itemId)) {
  const url = dictationSourceUrl(item);
  return typeof parseYouTubeId === "function" ? parseYouTubeId(url) : "";
}

function dictationYouTubeUrlAt(segment, item = getLibraryItem(dictationState.itemId)) {
  const id = dictationYouTubeId(item);
  if (!id) return dictationSourceUrl(item) || "https://www.youtube.com/";
  const start = Math.max(0, Math.floor(Number(segment?.start) || 0));
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}${start ? `&t=${start}s` : ""}`;
}

function dictationEmbedUrl(segment, item = getLibraryItem(dictationState.itemId), autoplay = false) {
  const id = dictationYouTubeId(item);
  if (!id) return "";
  const start = Math.max(0, Math.floor(Number(segment?.start) || 0));
  const end = Math.max(start + 1, Math.ceil(Number(segment?.end) || start + 4));
  const params = new URLSearchParams({
    start: String(start),
    end: String(end),
    rel: "0",
    playsinline: "1",
    enablejsapi: "0"
  });
  if (autoplay) params.set("autoplay", "1");
  if (isHttpAppContext()) params.set("origin", location.origin);
  return `https://www.youtube.com/embed/${encodeURIComponent(id)}?${params.toString()}`;
}

function renderDictationMedia(segment, item) {
  const sourceUrl = dictationSourceUrl(item);
  const youtubeId = dictationYouTubeId(item);
  const directVideo = /\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(sourceUrl);
  const status = dictationVideoMatchesItem(item) ? "connected" : (youtubeId || directVideo ? "preview" : "voice");
  const speedOptions = [0.75, 1, 1.25, 1.5, 2]
    .map(rate => `<option value="${rate}" ${Number(dictationState.playbackRate) === rate ? "selected" : ""}>${rate}&times;</option>`)
    .join("");
  const body = youtubeId
    ? `<div class="dictation-youtube-mount" id="dictationYoutubePlayer"></div>`
    : directVideo
      ? `<video id="dictationNativeFrame" src="${escapeHtml(sourceUrl)}" preload="metadata" controls playsinline></video>`
      : `<div class="dictation-media-empty"><b>Text voice</b><span>This source can be practiced with browser speech until a playable video is connected.</span></div>`;
  return `<section class="dictation-media-panel">
    <div class="dictation-media-head">
      <div><h3>Source video</h3><span>${formatVideoTime(segment.start)} - ${formatVideoTime(segment.end)}</span></div>
      <small>${status}</small>
    </div>
    <div class="dictation-media-frame">${body}</div>
    <div class="dictation-media-actions">
      <button id="dictationReplayMedia">Replay segment</button>
      <label><span>Speed</span><select id="dictationSpeed" aria-label="Playback speed">${speedOptions}</select></label>
    </div>
  </section>`;
}

function renderDictationStage() {
  const root = $("#dictationStage");
  if (!root) return;
  destroyDictationYouTubePlayer();
  stopDictationPlayback();
  const item = getLibraryItem(dictationState.itemId);
  if (dictationState.loading) {
    root.innerHTML = `<div class="dictation-empty"><div class="big">...</div><h2>Loading transcript</h2><p>Preparing captions for dictation.</p></div>`;
    return;
  }
  if (!dictationVideoItems().length) {
    root.innerHTML = `<div class="dictation-empty"><div class="big">âŒ</div><h2>No videos yet</h2><p>Add a video with captions first, then come back to practice dictation.</p><button class="tool-btn primary" data-view="videoView">Add video</button></div>`;
    return;
  }
  if (!item || !dictationState.segments.length) {
    root.innerHTML = `<div class="dictation-empty"><div class="big">CC</div><h2>No transcript ready</h2><p>This source needs captions before it can become a dictation session.</p><div class="dictation-empty-actions"><button class="tool-btn primary" id="dictationOpenVideo">Open in Video</button><button class="tool-btn ghost" id="dictationRefreshSource">Refresh source</button></div></div>`;
    return;
  }
  const segment = dictationCurrentSegment();
  const result = dictationState.checked;
  const progress = dictationProgressPercent();
  const answerClass = result ? (result.accepted ? "correct" : "wrong") : "";
  const resultTitle = result
    ? result.accepted
      ? (result.exact ? "Perfect" : "Accepted")
      : "Try again"
    : "Listen and type the full line";
  const resultNote = result
    ? result.accepted
      ? "Full context matched well enough to move forward."
      : `${result.diff.accuracy}% match. Fix the highlighted words or hear it again.`
    : `${formatVideoTime(segment.start)} - ${formatVideoTime(segment.end)} • ${segment.wordCount} words`;

  root.innerHTML = `<div class="dictation-card">
    <div class="dictation-topline"><span>${dictationState.index + 1}/${dictationState.segments.length}</span><span>${escapeHtml(item.title)}</span></div>
    <div class="dictation-track"><span style="width:${progress}%"></span></div>
    <div class="dictation-workbench">
      <div class="dictation-video-column">
        ${renderDictationMedia(segment, item)}
      </div>
      <div class="dictation-side-column">
        <section class="dictation-practice-panel">
          <div class="dictation-prompt">
            <div><span class="dictation-time">${formatVideoTime(segment.start)} - ${formatVideoTime(segment.end)}</span><h2>${escapeHtml(resultTitle)}</h2><p>${escapeHtml(resultNote)}</p></div>
            <div class="dictation-audio-actions">
              <button class="dictation-round-btn" id="dictationPrev" title="Previous segment">←</button>
              <button class="dictation-round-btn" id="dictationNext" title="Next segment">→</button>
            </div>
          </div>
          ${renderDictationHint(segment)}
          <textarea class="dictation-answer ${answerClass}" id="dictationAnswer" placeholder="Type exactly what you hear..." spellcheck="false" autocomplete="off" data-no-i18n>${escapeHtml(dictationState.answer || "")}</textarea>
          ${renderDictationFullAnswer(segment)}
          ${renderDictationDiff(result)}
        <div class="dictation-actions">
            <button class="tool-btn ghost" id="dictationHearAgain">Hear again</button>
            <button class="tool-btn primary" id="dictationCheck">Check</button>
            <button class="tool-btn ghost" id="dictationHint">Hint</button>
            <button class="tool-btn ghost" id="dictationToggleAnswer">${dictationState.showAnswer ? "Hide answer" : "Full answer"}</button>
            <button class="tool-btn ghost ${dictationState.loopSegment ? "active" : ""}" id="dictationLoopSegment">${dictationState.loopSegment ? "Looping" : "Loop segment"}</button>
            <button class="tool-btn ghost" id="dictationConnectAudio">${dictationVideoMatchesItem(item) ? "Source connected" : "Connect source audio"}</button>
          </div>
        </section>
        <aside class="dictation-segment-rail">
          <div class="dictation-rail-card">
            <div class="dictation-rail-head"><h3>Segments</h3><button id="dictationRetryMissed">Retry missed</button></div>
            <div class="dictation-segment-progress">
              <div><span id="dictationSegmentProgressText">0/${dictationState.segments.length} mastered</span><span id="dictationSegmentRetryText">0 retry</span></div>
              <b><i id="dictationSegmentProgressFill"></i></b>
            </div>
            <div class="dictation-segment-list" id="dictationSegmentList"></div>
          </div>
        </aside>
      </div>
    </div>
  </div>`;
  $("#dictationAnswer")?.focus();
  queueMicrotask(() => mountDictationMedia(segment, item));
}

function renderDictationSegments() {
  const root = $("#dictationSegmentList");
  if (!root) return;
  if (!dictationState.segments.length) {
    root.innerHTML = `<div class="dictation-mini-empty">No segments yet.</div>`;
    return;
  }
  const progress = dictationProgressForItem();
  const mastered = dictationState.segments.filter(segment => progress.segments?.[segment.id]?.status === "mastered").length;
  const retry = dictationState.segments.filter(segment => progress.segments?.[segment.id]?.status === "retry").length;
  const percent = dictationState.segments.length ? Math.round(mastered / dictationState.segments.length * 100) : 0;
  if ($("#dictationSegmentProgressText")) $("#dictationSegmentProgressText").textContent = `${mastered}/${dictationState.segments.length} mastered`;
  if ($("#dictationSegmentRetryText")) $("#dictationSegmentRetryText").textContent = `${retry} retry`;
  if ($("#dictationSegmentProgressFill")) $("#dictationSegmentProgressFill").style.width = `${percent}%`;
  root.innerHTML = dictationState.segments.map((segment, index) => {
    const entry = progress.segments?.[segment.id];
    const status = entry?.status || "new";
    return `<button class="dictation-segment-row ${index === dictationState.index ? "active" : ""} ${status}" data-dictation-segment="${index}">
      <span><i></i>${index + 1}</span>
      <b>${formatVideoTime(segment.start)} - ${formatVideoTime(segment.end)}</b>
      <small>${status}</small>
    </button>`;
  }).join("");
}

function renderDictation() {
  renderDictationSourceOptions();
  if ($("#dictationLength")) $("#dictationLength").value = dictationState.segmentLength;
  if ($("#dictationMode")) $("#dictationMode").value = dictationState.mode;
  renderDictationStage();
  renderDictationSegments();
  renderDictationStats();
  applyLanguage();
}

function persistDictationIndex() {
  const progress = dictationProgressForItem();
  progress.lastIndex = dictationState.index;
  progress.updatedAt = Date.now();
  saveDictationProgress();
}

function setDictationIndex(index) {
  if (!dictationState.segments.length) return;
  dictationState.index = Math.max(0, Math.min(index, dictationState.segments.length - 1));
  dictationState.answer = "";
  dictationState.checked = null;
  dictationState.hintLevel = 0;
  dictationState.showAnswer = false;
  dictationState.loopSegment = false;
  persistDictationIndex();
  renderDictation();
}

function checkDictationAnswer() {
  const segment = dictationCurrentSegment();
  const answer = $("#dictationAnswer")?.value || "";
  if (!segment) return;
  if (!answer.trim()) {
    showToast(state.language === "en" ? "Type the line first" : "Hãy gõ câu trước", "Listen once, then type the full segment.", "!");
    return;
  }
  dictationState.answer = answer;
  const result = dictationCheckAnswer(segment.expectedText, answer, dictationState.mode);
  dictationState.checked = result;
  const progress = dictationProgressForItem();
  const previous = progress.segments?.[segment.id] || {};
  progress.segments[segment.id] = {
    status: result.accepted ? "mastered" : "retry",
    accuracy: result.diff.accuracy,
    attempts: Number(previous.attempts || 0) + 1,
    updatedAt: Date.now()
  };
  if (result.accepted && previous.status !== "mastered") {
    state.xp += result.exact ? 10 : 6;
    state.daily += 1;
    state.dailyXp += result.exact ? 10 : 6;
    updateStats();
    saveState();
  }
  if (result.accepted) dictationState.loopSegment = false;
  saveDictationProgress();
  renderDictation();
  if (!result.accepted && dictationState.loopSegment) {
    scheduleDictationLoopReplay(segment, 420);
  }
  if (result.accepted && dictationState.autoNext && dictationState.index < dictationState.segments.length - 1) {
    setTimeout(() => setDictationIndex(dictationState.index + 1), 650);
  }
}

function revealDictationAnswer() {
  const segment = dictationCurrentSegment();
  if (!segment) return;
  dictationState.answer = segment.expectedText;
  dictationState.hintLevel = 3;
  const progress = dictationProgressForItem();
  progress.segments[segment.id] = {
    ...(progress.segments?.[segment.id] || {}),
    status: "retry",
    accuracy: 0,
    updatedAt: Date.now()
  };
  saveDictationProgress();
  renderDictation();
}

function showDictationHint() {
  dictationState.hintLevel = Math.min(3, dictationState.hintLevel + 1);
  renderDictation();
}

function toggleDictationFullAnswer() {
  dictationState.showAnswer = !dictationState.showAnswer;
  renderDictation();
}

function scheduleDictationLoopReplay(segment = dictationCurrentSegment(), delay = 520) {
  clearTimeout(dictationState.loopTimer);
  dictationState.loopTimer = null;
  if (!dictationState.loopSegment || !segment) return;
  if (dictationState.checked?.accepted) return;
  const segmentId = segment.id;
  dictationState.loopTimer = setTimeout(() => {
    if (!dictationState.loopSegment || dictationCurrentSegment()?.id !== segmentId || dictationState.checked?.accepted) return;
    replayDictationSegment({ fromLoop: true });
  }, delay);
}

function toggleDictationSegmentLoop() {
  dictationState.loopSegment = !dictationState.loopSegment;
  clearTimeout(dictationState.loopTimer);
  dictationState.loopTimer = null;
  renderDictation();
  if (dictationState.loopSegment) {
    setTimeout(() => replayDictationSegment(), 120);
  }
}

function clearDictationPlaybackGuard() {
  clearInterval(dictationState.playbackGuard);
  dictationState.playbackGuard = null;
}

function destroyDictationYouTubePlayer() {
  clearDictationPlaybackGuard();
  dictationState.pendingReplay = false;
  dictationState.youtubePlayerReady = false;
  dictationState.youtubeVideoId = "";
  if (!dictationState.youtubePlayer) return;
  try {
    dictationState.youtubePlayer.destroy?.();
  } catch (_) {
    // The iframe may already be gone after a stage rerender.
  }
  dictationState.youtubePlayer = null;
}

function stopDictationPlayback() {
  clearTimeout(dictationState.replayTimer);
  dictationState.replayTimer = null;
  clearTimeout(dictationState.loopTimer);
  dictationState.loopTimer = null;
  clearDictationPlaybackGuard();
  try {
    dictationState.youtubePlayer?.pauseVideo?.();
  } catch (_) {
    // Ignore player state races while the stage is rerendering.
  }
  const native = $("#dictationNativeFrame");
  if (native) native.pause();
}

function dictationPlaybackRate() {
  return Number(dictationState.playbackRate) || 1;
}

function applyDictationPlaybackRate() {
  const rate = dictationPlaybackRate();
  try {
    dictationState.youtubePlayer?.setPlaybackRate?.(rate);
  } catch (_) {}
  const native = $("#dictationNativeFrame");
  if (native) native.playbackRate = rate;
}

function guardDictationMediaEnd(segment = dictationCurrentSegment()) {
  clearDictationPlaybackGuard();
  if (!segment) return;
  const end = Math.max(Number(segment.start) || 0, Number(segment.end) || 0);
  const pauseMountedMedia = () => {
    clearDictationPlaybackGuard();
    try {
      dictationState.youtubePlayer?.pauseVideo?.();
    } catch (_) {}
    const native = $("#dictationNativeFrame");
    if (native) native.pause();
    scheduleDictationLoopReplay(segment);
  };
  dictationState.playbackGuard = setInterval(() => {
    const native = $("#dictationNativeFrame");
    if (native && !native.paused && native.currentTime >= end - 0.04) {
      pauseMountedMedia();
      return;
    }
    const player = dictationState.youtubePlayer;
    if (!player || !dictationState.youtubePlayerReady) return;
    let current = 0;
    try {
      current = Number(player.getCurrentTime?.()) || 0;
    } catch (_) {
      return;
    }
    if (current >= end - 0.04) pauseMountedMedia();
  }, 90);
}

function mountDictationMedia(segment = dictationCurrentSegment(), item = getLibraryItem(dictationState.itemId)) {
  const native = $("#dictationNativeFrame");
  if (native) {
    native.playbackRate = dictationPlaybackRate();
    native.currentTime = Math.max(0, Number(segment?.start) || 0);
    return;
  }
  const mount = $("#dictationYoutubePlayer");
  const youtubeId = dictationYouTubeId(item);
  if (!mount || !youtubeId) return;
  if (!isHttpAppContext()) {
    mount.innerHTML = `<iframe src="${escapeHtml(dictationEmbedUrl(segment, item, false))}" title="Dictation source video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    return;
  }
  ensureYouTubeApi().then(() => {
    if (!$("#dictationYoutubePlayer") || dictationYouTubeId(getLibraryItem(dictationState.itemId)) !== youtubeId) return;
    const start = Math.max(0, Math.floor(Number(segment?.start) || 0));
    const end = Math.max(start + 1, Math.ceil(Number(segment?.end) || start + 4));
    dictationState.youtubePlayer = new YT.Player("dictationYoutubePlayer", {
      width: "100%",
      height: "100%",
      videoId: youtubeId,
      playerVars: {
        start,
        end,
        playsinline: 1,
        rel: 0,
        controls: 1,
        enablejsapi: 1,
        origin: getWordinaryOrigin(),
        widget_referrer: location.href
      },
      events: {
        onReady: event => {
          dictationState.youtubePlayerReady = true;
          dictationState.youtubeVideoId = youtubeId;
          event.target.setPlaybackRate?.(dictationPlaybackRate());
          event.target.seekTo?.(Number(segment?.start) || 0, true);
          if (dictationState.pendingReplay) {
            dictationState.pendingReplay = false;
            playDictationVisibleMedia(dictationCurrentSegment(), getLibraryItem(dictationState.itemId));
          }
        },
        onStateChange: event => {
          if (event.data === YT.PlayerState.PLAYING) guardDictationMediaEnd(dictationCurrentSegment());
        }
      }
    });
  }).catch(error => {
    console.warn("Could not mount dictation YouTube player", error);
  });
}

function playDictationVoice(text, rate = 0.88) {
  if (!("speechSynthesis" in window)) return speak(text);
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  speechSynthesis.speak(utterance);
}

function playDictationVisibleMedia(segment = dictationCurrentSegment(), item = getLibraryItem(dictationState.itemId)) {
  if (!segment || !item) return false;
  const youtubeMount = $("#dictationYoutubePlayer");
  if (youtubeMount && dictationYouTubeId(item)) {
    if (!dictationState.youtubePlayerReady || !dictationState.youtubePlayer) {
      dictationState.pendingReplay = true;
      return true;
    }
    try {
      dictationState.youtubePlayer.setPlaybackRate?.(dictationPlaybackRate());
      dictationState.youtubePlayer.seekTo?.(Math.max(0, Number(segment.start) || 0), true);
      dictationState.youtubePlayer.playVideo?.();
      guardDictationMediaEnd(segment);
    } catch (_) {
      return false;
    }
    return true;
  }
  const native = $("#dictationNativeFrame");
  if (native) {
    native.currentTime = Math.max(0, Number(segment.start) || 0);
    native.playbackRate = dictationPlaybackRate();
    native.play().catch(() => showToast("Playback blocked", "Press play in the video panel once, then replay the segment.", "▶"));
    clearTimeout(dictationState.replayTimer);
    dictationState.replayTimer = setTimeout(() => {
      native.pause();
      scheduleDictationLoopReplay(segment);
    }, Math.max(700, (segment.end - segment.start) * 1000 / dictationPlaybackRate() + 140));
    guardDictationMediaEnd(segment);
    return true;
  }
  return false;
}

function replayDictationSegment(options = {}) {
  const segment = dictationCurrentSegment();
  const item = getLibraryItem(dictationState.itemId);
  if (!segment) return;
  stopDictationPlayback();
  const forceVoice = options.voice === true;
  if (!forceVoice && playDictationVisibleMedia(segment, item)) {
    dictationState.sourceStatus = "media";
  } else if (!forceVoice && dictationVideoMatchesItem(item)) {
    applyDictationPlaybackRate();
    seekVideo(segment.start);
    playVideo();
    const durationMs = Math.max(700, (segment.end - segment.start) * 1000 / dictationPlaybackRate() + 140);
    dictationState.replayTimer = setTimeout(() => {
      pauseVideo();
      scheduleDictationLoopReplay(segment);
    }, durationMs);
    dictationState.sourceStatus = "source";
  } else {
    playDictationVoice(segment.expectedText, Math.max(0.65, Math.min(1.6, dictationPlaybackRate())));
    scheduleDictationLoopReplay(segment, Math.max(1200, (segment.wordCount || 6) * 430 / dictationPlaybackRate()));
    dictationState.sourceStatus = "voice";
  }
  const progress = dictationProgressForItem();
  progress.replayCount = Number(progress.replayCount || 0) + 1;
  saveDictationProgress();
  renderDictationStats();
  setTimeout(() => $("#dictationAnswer")?.focus(), 40);
}

async function openDictationSourceInVideo() {
  const item = getLibraryItem(dictationState.itemId);
  if (!item) return setView("videoView");
  setView("videoView");
  await openLibraryItem(item.id);
}

async function startDictationFromCurrentVideo() {
  if (!videoState.url) {
    setView("videoView");
    showToast(state.language === "en" ? "Open a video first" : "Hãy mở video trước", "Dictation needs a video transcript.", "!");
    return;
  }
  if (!videoState.captions.length) {
    setView("videoView");
    $("#captionDrawer").open = true;
    showToast(state.language === "en" ? "Captions needed" : "Cần caption", "Fetch, upload, or paste captions before dictation.", "CC");
    return;
  }
  const item = persistCurrentVideoToLibrary(true);
  if (state.currentUser && getAuthToken()) saveCurrentVideoToApi().catch(error => console.warn("Could not sync dictation source", error));
  saveState();
  setView("dictationView");
  await selectDictationItem(item.id, { reset: false });
  replayDictationSegment();
}

function retryMissedDictation() {
  const progress = dictationProgressForItem();
  const missedIndex = dictationState.segments.findIndex(segment => progress.segments?.[segment.id]?.status === "retry");
  if (missedIndex < 0) {
    showToast(state.language === "en" ? "No missed segments" : "Chưa có đoạn sai", "Segments you miss will appear here for another pass.", "✓");
    return;
  }
  setDictationIndex(missedIndex);
}

function bindDictationEvents() {
  loadDictationProgress();
  $("#dictationSourceSelect")?.addEventListener("change", event => selectDictationItem(event.target.value, { reset: true }));
  $("#dictationLength")?.addEventListener("change", event => {
    dictationState.segmentLength = event.target.value;
    selectDictationItem(dictationState.itemId, { reset: true });
  });
  $("#dictationMode")?.addEventListener("change", event => { dictationState.mode = event.target.value; renderDictation(); });
  $("#dictationUseCurrentVideo")?.addEventListener("click", startDictationFromCurrentVideo);
  $("#startVideoDictation")?.addEventListener("click", startDictationFromCurrentVideo);
  $("#dictationRetryMissed")?.addEventListener("click", retryMissedDictation);
  $("#dictationStage")?.addEventListener("click", event => {
    const row = event.target.closest("[data-dictation-segment]");
    if (row) {
      setDictationIndex(Number(row.dataset.dictationSegment));
      setTimeout(() => replayDictationSegment(), 180);
      return;
    }
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) { setView(viewButton.dataset.view); return; }
    if (event.target.closest("#dictationRetryMissed")) { retryMissedDictation(); return; }
    if (event.target.closest("#dictationReplayMedia")) replayDictationSegment();
    if (event.target.closest("#dictationHearAgain")) replayDictationSegment();
    if (event.target.closest("#dictationLoopSegment")) toggleDictationSegmentLoop();
    if (event.target.closest("#dictationPrev")) setDictationIndex(dictationState.index - 1);
    if (event.target.closest("#dictationNext")) setDictationIndex(dictationState.index + 1);
    if (event.target.closest("#dictationCheck")) checkDictationAnswer();
    if (event.target.closest("#dictationHint")) showDictationHint();
    if (event.target.closest("#dictationToggleAnswer")) toggleDictationFullAnswer();
    if (event.target.closest("#dictationConnectAudio") || event.target.closest("#dictationOpenVideo")) openDictationSourceInVideo();
    if (event.target.closest("#dictationRefreshSource")) selectDictationItem(dictationState.itemId, { reset: false });
  });
  $("#dictationStage")?.addEventListener("change", event => {
    if (!event.target.matches("#dictationSpeed")) return;
    dictationState.playbackRate = Number(event.target.value) || 1;
    applyDictationPlaybackRate();
    if (typeof setVideoRate === "function") setVideoRate(dictationState.playbackRate);
  });
  $("#dictationStage")?.addEventListener("input", event => {
    if (event.target.matches("#dictationAnswer")) dictationState.answer = event.target.value;
  });
  document.addEventListener("keydown", event => {
    if (!$("#dictationView")?.classList.contains("active") || $("#editCardModal")?.classList.contains("show")) return;
    if (event.target.matches("textarea") && event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      checkDictationAnswer();
      return;
    }
    if (event.target.matches("input,textarea,select")) return;
    if (event.code === "Space") { event.preventDefault(); replayDictationSegment(); }
    if (event.key === "ArrowLeft") setDictationIndex(dictationState.index - 1);
    if (event.key === "ArrowRight") setDictationIndex(dictationState.index + 1);
  });
}

function initializeDictation() {
  loadDictationProgress();
  const firstCaptioned = dictationVideoItems().find(item => dictationItemCaptions(item).length);
  const first = firstCaptioned || dictationVideoItems()[0];
  if (first) selectDictationItem(first.id, { reset: false });
  else renderDictation();
}
