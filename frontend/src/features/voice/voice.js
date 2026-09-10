const voiceState = {
  itemId: "",
  segments: [],
  index: 0,
  attempts: {},
  loading: false,
  segmentSignature: "",
  playingTimer: null,
  playbackGuard: null,
  mediaRecorder: null,
  mediaStream: null,
  recognition: null,
  recognitionText: "",
  recordingStartedAt: 0,
  recordingTimer: null,
  recordingLimitTimer: null,
  attemptAudioUrl: ""
};

function voiceText(en, vi) {
  return state.language === "en" ? en : vi;
}

function voiceVideoItems() {
  return (state.libraryItems || [])
    .map(normalizeLibraryItem)
    .filter(item => item.type === "video" && (voiceItemCaptions(item).length || Number(item.metadata?.captionCount) > 0))
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

function voiceItemCaptions(item = getLibraryItem(voiceState.itemId)) {
  const stored = item?.metadata?.captions;
  if (Array.isArray(stored) && stored.length) return stored;
  const url = item?.metadata?.url || item?.sourceUrl || "";
  if ((item?.id === videoState.libraryItemId || (url && url === videoState.url)) && Array.isArray(videoState.captions)) return videoState.captions;
  return [];
}

function voiceCurrentSegment() {
  return voiceState.segments[voiceState.index] || null;
}

function stopVoiceSourcePlayback() {
  clearTimeout(voiceState.playingTimer);
  clearInterval(voiceState.playbackGuard);
  voiceState.playingTimer = null;
  voiceState.playbackGuard = null;
  pauseVideo();
  $("#voiceAudioState")?.classList.remove("is-playing");
  const listenLabel = $("#voiceListen span:last-child");
  if (listenLabel) listenLabel.textContent = voiceText("Listen", "Nghe mẫu");
}

function voiceSourceEndTime(segment = voiceCurrentSegment()) {
  if (!segment) return 0;
  const next = voiceState.segments[voiceState.index + 1];
  const segmentEnd = Math.max(Number(segment.start) || 0, Number(segment.end) || 0);
  const nextStart = Number(next?.start);
  const boundary = Number.isFinite(nextStart) && nextStart > segment.start
    ? Math.min(segmentEnd, nextStart)
    : segmentEnd;
  const safetyMargin = videoState.type === "youtube" ? 0.14 : 0.07;
  return Math.max((Number(segment.start) || 0) + 0.12, boundary - safetyMargin);
}

function clearVoiceAttemptAudio() {
  if (voiceState.attemptAudioUrl) URL.revokeObjectURL(voiceState.attemptAudioUrl);
  voiceState.attemptAudioUrl = "";
  const button = $("#voicePlayAttempt");
  if (button) button.disabled = true;
}

function renderVoiceSourceOptions() {
  const select = $("#voiceSourceSelect");
  if (!select) return [];
  const items = voiceVideoItems();
  if (!items.some(item => item.id === voiceState.itemId)) voiceState.itemId = items[0]?.id || "";
  select.innerHTML = items.length
    ? items.map(item => {
        const count = voiceItemCaptions(item).length || Number(item.metadata?.captionCount) || 0;
        return `<option value="${escapeHtml(item.id)}">${escapeHtml(item.title || voiceText("Untitled video", "Video chưa đặt tên"))} · ${count} ${voiceText("captions", "caption")}</option>`;
      }).join("")
    : `<option value="">${voiceText("No captioned videos", "Chưa có video kèm caption")}</option>`;
  select.value = voiceState.itemId;
  return items;
}

async function loadVoiceItemDetail(itemId) {
  let item = getLibraryItem(itemId);
  if (!item || item.type !== "video") return null;
  if (voiceItemCaptions(item).length || item.storageSource !== "api" || !state.currentUser || !getAuthToken()) return item;
  try {
    const detail = await libraryApiGetItem(item.id);
    item = upsertLibraryItem(apiDetailToVideoItem(detail), false);
  } catch (error) {
    showToast(voiceText("Transcript unavailable", "Chưa tải được transcript"), error.message || voiceText("Open the video and add captions first.", "Hãy mở video và thêm caption trước."), "!");
  }
  return item;
}

async function selectVoiceItem(itemId, options = {}) {
  voiceState.itemId = itemId || "";
  voiceState.segments = [];
  voiceState.index = 0;
  voiceState.loading = true;
  renderVoice();
  const item = await loadVoiceItemDetail(voiceState.itemId);
  voiceState.segments = item ? buildDictationSegments(voiceItemCaptions(item), dictationState.segmentLength) : [];
  voiceState.segmentSignature = item ? dictationSourceSignature(item) : "";
  voiceState.index = options.reset ? 0 : Math.min(voiceState.index, Math.max(voiceState.segments.length - 1, 0));
  voiceState.loading = false;
  renderVoiceSourceOptions();
  renderVoice();
}

function voiceSegmentAttempt(segment) {
  return segment ? voiceState.attempts[segment.id] || null : null;
}

function renderVoiceResult(segment) {
  const attempt = voiceSegmentAttempt(segment);
  $("#voiceResultEmpty")?.classList.toggle("is-hidden", Boolean(attempt));
  $("#voiceResultContent")?.classList.toggle("is-hidden", !attempt);
  if (!attempt) return;
  $("#voiceScore").textContent = attempt.score ?? "--";
  $("#voiceFeedbackTitle").textContent = attempt.score == null
    ? voiceText("Recording saved", "Đã lưu bản thu")
    : attempt.score >= 92
      ? voiceText("Strong match", "Khớp rất tốt")
      : attempt.score >= 75
        ? voiceText("Nearly there", "Gần đạt rồi")
        : voiceText("Try once more", "Thử lại một lần nữa");
  $("#voiceTranscript").textContent = attempt.transcript
    ? `${voiceText("Heard", "Đã nghe")}: “${attempt.transcript}”`
    : voiceText("A scoring model has not been connected yet. Your recording is ready.", "Model chấm điểm chưa được kết nối. Bản thu của bạn đã sẵn sàng.");
  $("#voiceWordFeedback").innerHTML = attempt.pieces?.length
    ? attempt.pieces.map(piece => `<span class="${piece.type}">${escapeHtml(piece.text)}</span>`).join("")
    : "";
}

function renderVoiceQueue() {
  const root = $("#voiceQueue");
  if (!root) return;
  if (!voiceState.segments.length) {
    root.innerHTML = `<div class="voice-queue-empty">${voiceState.loading ? voiceText("Loading transcript...", "Đang tải transcript...") : voiceText("No sentences available", "Chưa có câu để luyện")}</div>`;
    return;
  }
  root.innerHTML = voiceState.segments.map((segment, index) => {
    const attempt = voiceSegmentAttempt(segment);
    return `<button class="voice-queue-item ${index === voiceState.index ? "active" : ""}" type="button" data-voice-segment="${index}"><span>${index + 1}</span><span><b>${escapeHtml(segment.expectedText)}</b><small>${formatVideoTime(segment.start)} · ${segment.wordCount} ${voiceText("words", "từ")}</small></span>${attempt?.score != null ? `<strong>${attempt.score}</strong>` : ""}</button>`;
  }).join("");
}

function renderVoice() {
  const items = renderVoiceSourceOptions();
  const item = items.find(entry => entry.id === voiceState.itemId) || getLibraryItem(voiceState.itemId);
  const segment = voiceCurrentSegment();
  const hasSession = Boolean(item && segment);
  $("#voiceEmptyState")?.classList.toggle("is-hidden", hasSession || voiceState.loading);
  $("#voiceSession")?.classList.toggle("is-hidden", !hasSession);
  $("#voiceSourceTitle").textContent = item?.title || voiceText("No video selected", "Chưa chọn video");
  $("#voiceSourceMeta").textContent = item
    ? `${voiceState.segments.length || Number(item.metadata?.captionCount) || 0} ${voiceText("sentences", "câu")} · ${item.metadata?.duration ? formatVideoTime(item.metadata.duration) : voiceText("duration unknown", "chưa rõ thời lượng")}`
    : voiceText("No captioned video selected", "Chưa chọn video có caption");
  $("#voiceSentenceIndex").textContent = segment ? voiceState.index + 1 : 0;
  $("#voiceSentenceTotal").textContent = voiceState.segments.length;
  const completed = voiceState.segments.filter(entry => voiceSegmentAttempt(entry)).length;
  $("#voiceAttemptCount").textContent = `${completed} ${voiceText("attempts", "lượt nói")}`;
  $("#voiceCompletedCount").textContent = `${completed}/${voiceState.segments.length}`;
  $("#voiceProgressFill").style.width = voiceState.segments.length ? `${(voiceState.index + 1) / voiceState.segments.length * 100}%` : "0%";
  $("#voicePrevious").disabled = voiceState.index <= 0;
  $("#voiceNext").disabled = voiceState.index >= voiceState.segments.length - 1;
  $("#voiceResultNext").disabled = voiceState.index >= voiceState.segments.length - 1;
  if (segment) {
    $("#voiceSentence").textContent = segment.expectedText;
    $("#voiceTranslation").textContent = segment.translation || "";
  }
  renderVoiceResult(segment);
  renderVoiceQueue();
}

function setVoiceSegment(index) {
  if (!voiceState.segments.length || voiceState.mediaRecorder?.state === "recording") return;
  stopVoiceSourcePlayback();
  clearVoiceAttemptAudio();
  voiceState.index = Math.max(0, Math.min(Number(index) || 0, voiceState.segments.length - 1));
  renderVoice();
  $("#voiceRecordStatus").textContent = voiceText("Ready", "Sẵn sàng");
  $("#voiceRecordTimer").textContent = "00:00";
}

async function ensureVoiceSourceReady() {
  const item = getLibraryItem(voiceState.itemId);
  if (!item) return false;
  const itemUrl = item.metadata?.url || item.sourceUrl || "";
  const alreadyReady = videoState.ready && (item.id === videoState.libraryItemId || (itemUrl && itemUrl === videoState.url));
  if (alreadyReady) return true;
  $("#voiceListen").disabled = true;
  $("#voiceListen span:last-child").textContent = voiceText("Loading", "Đang tải");
  try {
    videoState.libraryItemId = item.id;
    const youtubeId = parseYouTubeId(itemUrl);
    if (youtubeId) await mountYouTubeVideo(youtubeId, itemUrl);
    else if (/\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(itemUrl)) mountNativeVideo(itemUrl, item.title || "Video");
    else await openStoredVideoItem(item);

    const storedCaptions = item.metadata?.captions;
    if (Array.isArray(storedCaptions) && storedCaptions.length) setCaptions(storedCaptions, item.metadata?.sourceLabel || "saved captions");
    return videoState.ready && !videoState.embedBlocked;
  } catch (error) {
    showToast(voiceText("Audio unavailable", "Chưa phát được audio"), error.message || voiceText("Open this video once in Video.", "Hãy mở video này một lần trong mục Video."), "!");
    return false;
  } finally {
    $("#voiceListen").disabled = false;
    $("#voiceListen span:last-child").textContent = voiceText("Listen", "Nghe mẫu");
  }
}

async function playVoiceSource() {
  const segment = voiceCurrentSegment();
  if (!segment) return;
  if (voiceState.playingTimer || voiceState.playbackGuard) {
    stopVoiceSourcePlayback();
    return;
  }
  if (!await ensureVoiceSourceReady()) return;
  const speed = Number($("#voiceSpeed").value) || 1;
  setVideoRate(speed);
  seekVideo(segment.start);
  playVideo();
  $("#voiceAudioState").classList.add("is-playing");
  $("#voiceListen span:last-child").textContent = voiceText("Pause", "Dừng");
  const endTime = voiceSourceEndTime(segment);
  const startTime = Number(segment.start) || 0;
  const duration = Math.max(0.3, endTime - segment.start) / speed;
  let reachedSegment = false;
  voiceState.playbackGuard = setInterval(() => {
    const currentTime = getVideoCurrentTime();
    if (currentTime >= startTime - 0.2 && currentTime < endTime) reachedSegment = true;
    if (reachedSegment && currentTime >= endTime) stopVoiceSourcePlayback();
  }, 30);
  voiceState.playingTimer = setTimeout(stopVoiceSourcePlayback, duration * 1000 + 1500);
}

function createVoiceRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.onresult = event => {
    let text = "";
    for (let index = 0; index < event.results.length; index += 1) text += `${event.results[index][0]?.transcript || ""} `;
    voiceState.recognitionText = text.trim();
  };
  recognition.onerror = () => {};
  return recognition;
}

function updateVoiceRecordingTimer() {
  const elapsed = Math.max(0, Date.now() - voiceState.recordingStartedAt);
  const seconds = Math.floor(elapsed / 1000);
  $("#voiceRecordTimer").textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

async function startVoiceRecording() {
  const segment = voiceCurrentSegment();
  if (!segment || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    showToast(voiceText("Microphone unavailable", "Không dùng được microphone"), voiceText("This browser cannot record audio.", "Trình duyệt này không hỗ trợ thu âm."), "!");
    return;
  }
  stopVoiceSourcePlayback();
  clearVoiceAttemptAudio();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    voiceState.mediaStream = stream;
    voiceState.mediaRecorder = recorder;
    voiceState.recognitionText = "";
    voiceState.recognition = createVoiceRecognition();
    recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      voiceState.attemptAudioUrl = URL.createObjectURL(blob);
      $("#voicePlayAttempt").disabled = false;
      voiceState.mediaStream?.getTracks().forEach(track => track.stop());
      voiceState.mediaStream = null;
      setTimeout(() => scoreVoiceAttempt(segment, voiceState.recognitionText), 350);
    };
    recorder.start();
    try { voiceState.recognition?.start(); } catch (_) {}
    voiceState.recordingStartedAt = Date.now();
    voiceState.recordingTimer = setInterval(updateVoiceRecordingTimer, 200);
    voiceState.recordingLimitTimer = setTimeout(stopVoiceRecording, Math.min(30000, Math.max(7000, (segment.end - segment.start + 5) * 1000)));
    $("#voiceRecord").classList.add("is-recording");
    $("#voiceRecord").setAttribute("aria-label", voiceText("Stop recording", "Dừng thu âm"));
    $("#voiceRecordStatus").textContent = voiceText("Listening...", "Đang nghe...");
    $("#voiceAudioState").classList.add("is-recording");
  } catch (error) {
    showToast(voiceText("Microphone permission needed", "Cần quyền microphone"), voiceText("Allow microphone access and try again.", "Cho phép truy cập microphone rồi thử lại."), "!");
  }
}

function stopVoiceRecording() {
  if (voiceState.mediaRecorder?.state !== "recording") return;
  clearInterval(voiceState.recordingTimer);
  clearTimeout(voiceState.recordingLimitTimer);
  voiceState.recordingTimer = null;
  voiceState.recordingLimitTimer = null;
  try { voiceState.recognition?.stop(); } catch (_) {}
  voiceState.mediaRecorder.stop();
  $("#voiceRecord").classList.remove("is-recording");
  $("#voiceRecord").setAttribute("aria-label", voiceText("Start recording", "Bắt đầu thu âm"));
  $("#voiceRecordStatus").textContent = voiceText("Checking...", "Đang chấm...");
  $("#voiceAudioState").classList.remove("is-recording");
}

function scoreVoiceAttempt(segment, transcript) {
  if (!segment || voiceCurrentSegment()?.id !== segment.id) return;
  const result = transcript ? dictationCheckAnswer(segment.expectedText, transcript, "easy") : null;
  voiceState.attempts[segment.id] = {
    score: result ? result.diff.accuracy : null,
    transcript: transcript || "",
    pieces: result?.diff.pieces || [],
    createdAt: Date.now()
  };
  $("#voiceRecordStatus").textContent = voiceText("Ready to retry", "Sẵn sàng thử lại");
  renderVoice();
}

function toggleVoiceRecording() {
  if (voiceState.mediaRecorder?.state === "recording") stopVoiceRecording();
  else startVoiceRecording();
}

function playVoiceAttempt() {
  if (!voiceState.attemptAudioUrl) return;
  const audio = new Audio(voiceState.attemptAudioUrl);
  audio.play().catch(() => {});
}

function prepareVoiceView() {
  const items = renderVoiceSourceOptions();
  if (!voiceState.itemId && items.length) voiceState.itemId = items[0].id;
  const item = getLibraryItem(voiceState.itemId);
  const signature = item ? dictationSourceSignature(item) : "";
  if (voiceState.itemId && (!voiceState.segments.length || voiceState.segmentSignature !== signature) && !voiceState.loading) selectVoiceItem(voiceState.itemId);
  else renderVoice();
}

function bindVoiceEvents() {
  $("#voiceSourceSelect")?.addEventListener("change", event => selectVoiceItem(event.target.value, { reset: true }));
  $("#voicePrevious")?.addEventListener("click", () => setVoiceSegment(voiceState.index - 1));
  $("#voiceNext")?.addEventListener("click", () => setVoiceSegment(voiceState.index + 1));
  $("#voiceResultNext")?.addEventListener("click", () => setVoiceSegment(voiceState.index + 1));
  $("#voiceListen")?.addEventListener("click", playVoiceSource);
  $("#voiceSpeed")?.addEventListener("change", event => setVideoRate(event.target.value));
  $("#voiceRecord")?.addEventListener("click", toggleVoiceRecording);
  $("#voicePlayAttempt")?.addEventListener("click", playVoiceAttempt);
  $("#voiceQueue")?.addEventListener("click", event => {
    const button = event.target.closest("[data-voice-segment]");
    if (button) setVoiceSegment(Number(button.dataset.voiceSegment));
  });
  $("[data-voice-mode='conversation']")?.addEventListener("click", () => showToast(voiceText("Conversation is coming next", "Hội thoại sẽ có ở bản tiếp theo"), voiceText("Shadowing is ready for the first voice release.", "Shadowing được ưu tiên cho bản Voice đầu tiên."), "◌"));
}

function initializeVoice() {
  renderVoiceSourceOptions();
  renderVoice();
}
