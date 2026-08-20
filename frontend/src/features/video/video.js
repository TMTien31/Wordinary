/* ───────────────────────── VIDEO LAB LOGIC ───────────────────────── */
function formatVideoTime(seconds = 0) {
  const safe = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function setVideoStatus(text, ready = false) {
  $("#videoStatusText").textContent = text;
  $("#videoStatus").classList.toggle("ready", ready);
}

function setCaptionSource(label, ready = false) {
  videoState.sourceLabel = label;
  $("#captionSourcePill").textContent = label || "chưa có caption";
  $("#captionSourcePill").classList.toggle("ready", ready);
}

function isHttpAppContext() {
  return location.protocol === "http:" || location.protocol === "https:";
}

function getWordinaryOrigin() {
  return isHttpAppContext() ? location.origin : "";
}

function showVideoEmbedNotice(reason = "file", videoId = "", url = "") {
  const notice = $("#videoEmbedNotice");
  if (!notice) return;
  videoState.pendingYouTubeId = videoId || videoState.pendingYouTubeId || "";
  videoState.pendingYouTubeUrl = url || videoState.pendingYouTubeUrl || "";
  const english = state.language === "en";
  const code = String(reason || "");
  const blocked = code === "101" || code === "150";
  const needsLocalhost = code === "153" || code === "file";
  videoState.embedBlocked = blocked;

  const title = $("#videoEmbedNoticeTitle");
  const text = $("#videoEmbedNoticeText");
  const detail = $("#videoEmbedNoticeCommand");
  const copyBtn = $("#copyLocalhostCommand");
  const openBtn = $("#openCurrentYouTube");
  const cueBtn = $("#openYouTubeAtCue");
  const localBtn = $("#pickLocalVideo");
  const closeBtn = $("#dismissVideoEmbedNotice");

  if (blocked) {
    $(".video-embed-notice-icon", notice).textContent = "↗";
    title.textContent = english ? "This video cannot be embedded" : "Video này không cho phép phát nhúng";
    text.textContent = english
      ? "YouTube Error 150 is the same as Error 101: the owner disabled playback in embedded players. Wordinary cannot override that setting. Your transcript is still available, and you can open YouTube at the selected timestamp or pair it with a local video file."
      : "YouTube Error 150 giống Error 101: chủ video đã tắt quyền phát trong trình phát nhúng. Wordinary không thể vượt qua thiết lập này. Transcript vẫn dùng được; bạn có thể mở YouTube tại timestamp đang chọn hoặc ghép caption với file video có sẵn trên máy.";
    detail.textContent = english ? "YouTube policy • Error 150 = embedding disabled" : "Chính sách YouTube • Error 150 = chủ video chặn embed";
    copyBtn.hidden = true;
    cueBtn.hidden = false;
    localBtn.hidden = false;
    openBtn.classList.add("primary");
    openBtn.textContent = english ? "Open on YouTube" : "Mở video trên YouTube";
    cueBtn.textContent = english ? "Open at selected caption" : "Mở tại câu đang chọn";
    localBtn.textContent = english ? "Use a local video file" : "Dùng file video trên máy";
    closeBtn.textContent = english ? "Keep transcript only" : "Chỉ dùng transcript";
  } else {
    $(".video-embed-notice-icon", notice).textContent = "⌁";
    title.textContent = english
      ? (code === "153" ? "YouTube rejected this embed (Error 153)" : "Run Wordinary through localhost for YouTube")
      : (code === "153" ? "YouTube từ chối iframe này (Error 153)" : "YouTube cần Wordinary chạy qua localhost");
    text.textContent = english
      ? "YouTube requires an HTTP referrer or equivalent client identity. A page opened with file:// cannot provide it. Start the included Wordinary server, then open the localhost address."
      : "YouTube yêu cầu HTTP Referer hoặc danh tính client tương đương. Trang mở bằng file:// không thể cung cấp thông tin đó. Hãy chạy server Wordinary đi kèm rồi mở địa chỉ localhost.";
    detail.textContent = "docker compose up -d --build  ->  http://localhost:5500/";
    copyBtn.hidden = false;
    cueBtn.hidden = true;
    localBtn.hidden = true;
    copyBtn.classList.add("primary");
    openBtn.classList.remove("primary");
    copyBtn.textContent = english ? "Copy fallback command" : "Sao chép lệnh dự phòng";
    openBtn.textContent = english ? "Open on YouTube" : "Mở video trên YouTube";
    closeBtn.textContent = english ? "Close" : "Đóng thông báo";
  }

  notice.classList.remove("video-hidden");
  $("#videoPlaceholder")?.classList.add("video-hidden");
  $("#youtubeHost")?.classList.add("video-hidden");
  setVideoStatus(blocked ? "Error 150" : (code === "153" ? "Error 153" : (english ? "localhost required" : "cần localhost")), false);
}

function hideVideoEmbedNotice() {
  $("#videoEmbedNotice")?.classList.add("video-hidden");
}

async function copyWordinaryServerCommand() {
  const command = "python tools/reference_server/server.py";
  try {
    await navigator.clipboard.writeText(command);
    showToast(state.language === "en" ? "Command copied" : "Đã sao chép lệnh", command, "✓");
  } catch (_) {
    window.prompt(state.language === "en" ? "Copy this command" : "Sao chép lệnh này", command);
  }
}

function openPendingYouTubeVideo(seconds = 0) {
  const id = videoState.pendingYouTubeId || parseYouTubeId(videoState.pendingYouTubeUrl || videoState.url || "");
  const safeTime = Math.max(0, Math.floor(Number(seconds) || 0));
  const target = id
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(id)}${safeTime ? `&t=${safeTime}s` : ""}`
    : (videoState.pendingYouTubeUrl || videoState.url || "https://www.youtube.com/");
  window.open(target, "_blank", "noopener,noreferrer");
}

function openPendingYouTubeAtCue() {
  const cue = videoState.captions[videoState.activeCueIndex];
  openPendingYouTubeVideo(cue?.start || 0);
}

function useLocalVideoFile(file) {
  if (!file) return;
  if (!String(file.type || "").startsWith("video/")) {
    showToast(state.language === "en" ? "Unsupported file" : "File chưa được hỗ trợ", state.language === "en" ? "Choose an MP4, WebM, OGG, or another browser-playable video file." : "Hãy chọn MP4, WebM, OGG hoặc định dạng video mà trình duyệt phát được.", "⚠️");
    return;
  }
  if (videoState.localVideoObjectUrl) URL.revokeObjectURL(videoState.localVideoObjectUrl);
  videoState.localVideoObjectUrl = URL.createObjectURL(file);
  const previousTitle = videoState.title && videoState.title !== "Chưa có video" ? videoState.title : file.name;
  mountNativeVideo(videoState.localVideoObjectUrl, `${previousTitle} • local`);
  videoState.embedBlocked = false;
  hideVideoEmbedNotice();
  showToast(state.language === "en" ? "Local video connected" : "Đã ghép video trên máy", state.language === "en" ? "The existing transcript will follow this video's currentTime." : "Transcript hiện tại sẽ chạy theo currentTime của file này.", "▶️");
}

function parseYouTubeId(value = "") {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] || "";
    if (/youtube\.com$/.test(url.hostname.replace(/^www\./, ""))) {
      if (url.pathname === "/watch") return url.searchParams.get("v") || "";
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
      return match?.[1] || "";
    }
  } catch (_) {}
  return /^[A-Za-z0-9_-]{11}$/.test(value.trim()) ? value.trim() : "";
}

function parseTimestamp(value = "") {
  const clean = value.trim().replace(",", ".");
  const parts = clean.split(":").map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function cleanCaptionText(value = "") {
  const holder = document.createElement("div");
  holder.innerHTML = String(value).replace(/<br\s*\/?>/gi, " ").replace(/<\/?(?:c|v|lang|ruby|rt)[^>]*>/gi, "");
  return decodeHtml(holder.textContent || "").replace(/\s+/g, " ").trim();
}

function parseCaptionText(raw = "") {
  const value = String(raw || "").replace(/^\uFEFF/, "").trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    const list = Array.isArray(parsed) ? parsed : parsed.captions || parsed.cues || [];
    if (Array.isArray(list) && list.length) {
      return list.map((cue, i) => ({
        start: Number(cue.start ?? cue.startTime ?? cue.from ?? i * 4),
        end: Number(cue.end ?? cue.endTime ?? ((cue.start ?? cue.startTime ?? i * 4) + Number(cue.duration ?? 4))),
        text: cleanCaptionText(cue.text ?? cue.caption ?? cue.utf8 ?? ""),
        translation: cleanCaptionText(cue.translation || "")
      })).filter(c => c.text && c.end > c.start);
    }
  } catch (_) {}
  const normalized = value.replace(/^WEBVTT[^\n]*\n+/i, "").replace(/\r/g, "");
  const blocks = normalized.split(/\n{2,}/);
  const cues = [];
  blocks.forEach(block => {
    const lines = block.split("\n").map(line => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex(line => line.includes("-->"));
    if (timingIndex < 0) return;
    const match = lines[timingIndex].match(/([^\s]+)\s*-->\s*([^\s]+)/);
    if (!match) return;
    const start = parseTimestamp(match[1]);
    const end = parseTimestamp(match[2]);
    const text = cleanCaptionText(lines.slice(timingIndex + 1).join(" "));
    if (text && end > start) cues.push({ start, end, text, translation: "" });
  });
  if (cues.length) return cues;
  return normalized.split("\n").map(line => cleanCaptionText(line)).filter(Boolean).map((text, i) => ({ start: i * 4.2, end: i * 4.2 + 3.9, text, translation: "" }));
}

function getVideoCurrentTime() {
  if (videoState.type === "youtube" && videoState.youtubePlayer?.getCurrentTime) {
    try { return Number(videoState.youtubePlayer.getCurrentTime()) || 0; } catch (_) { return 0; }
  }
  return Number($("#nativeVideo").currentTime) || 0;
}

function getVideoDuration() {
  if (videoState.type === "youtube" && videoState.youtubePlayer?.getDuration) {
    try { return Number(videoState.youtubePlayer.getDuration()) || 0; } catch (_) { return 0; }
  }
  return Number($("#nativeVideo").duration) || 0;
}

function isVideoPlaying() {
  if (videoState.type === "youtube" && videoState.youtubePlayer?.getPlayerState && window.YT) {
    try { return videoState.youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING; } catch (_) { return false; }
  }
  const video = $("#nativeVideo");
  return !video.paused && !video.ended;
}

function playVideo() {
  if (!videoState.ready) return;
  if (videoState.type === "youtube") videoState.youtubePlayer?.playVideo?.();
  else $("#nativeVideo").play().catch(() => showToast("Trình duyệt chặn autoplay", "Hãy nhấn nút Play một lần nữa.", "▶️"));
}

function pauseVideo() {
  if (videoState.type === "youtube") videoState.youtubePlayer?.pauseVideo?.();
  else $("#nativeVideo").pause();
}

function toggleVideoPlayback() { isVideoPlaying() ? pauseVideo() : playVideo(); }

function seekVideo(seconds) {
  const duration = getVideoDuration();
  const target = Math.max(0, duration ? Math.min(seconds, duration) : seconds);
  if (videoState.type === "youtube") videoState.youtubePlayer?.seekTo?.(target, true);
  else $("#nativeVideo").currentTime = target;
  updateVideoTimeline(true);
}

function setVideoRate(rate) {
  const speed = Number(rate) || 1;
  if (videoState.type === "youtube") videoState.youtubePlayer?.setPlaybackRate?.(speed);
  else $("#nativeVideo").playbackRate = speed;
}

function showVideoPlayer(type) {
  hideVideoEmbedNotice();
  videoState.embedBlocked = false;
  $("#videoPlaceholder").classList.add("video-hidden");
  $("#nativeVideo").classList.toggle("video-hidden", type !== "native");
  $("#youtubeHost").classList.toggle("video-hidden", type !== "youtube");
}

function resetYouTubeHost() {
  try { videoState.youtubePlayer?.destroy?.(); } catch (_) {}
  videoState.youtubePlayer = null;
  $("#youtubeHost").innerHTML = '<div id="youtubePlayerMount"></div>';
}

function ensureYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (videoState.youtubeApiPromise) return videoState.youtubeApiPromise;
  videoState.youtubeApiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => reject(new Error("Không tải được YouTube Player API"));
    document.head.appendChild(script);
    setTimeout(() => { if (!window.YT?.Player) reject(new Error("YouTube Player API phản hồi quá lâu")); }, 12000);
  });
  return videoState.youtubeApiPromise;
}

async function mountYouTubeVideo(videoId, url) {
  videoState.pendingYouTubeId = videoId;
  videoState.pendingYouTubeUrl = url;
  if (!isHttpAppContext()) {
    showVideoEmbedNotice("file", videoId, url);
    throw new Error(state.language === "en"
      ? "YouTube embeds cannot identify a file:// page. Run Wordinary through localhost."
      : "YouTube không thể nhận diện trang mở bằng file://. Hãy chạy Wordinary qua localhost.");
  }

  setVideoStatus(state.language === "en" ? "loading player" : "đang tải player");
  await ensureYouTubeApi();
  resetYouTubeHost();
  videoState.type = "youtube";
  videoState.url = url;
  showVideoPlayer("youtube");

  const playerVars = {
    playsinline: 1,
    rel: 0,
    cc_load_policy: 0,
    enablejsapi: 1,
    origin: getWordinaryOrigin(),
    widget_referrer: location.href
  };

  await new Promise((resolve, reject) => {
    let settled = false;
    const fail = (message, code = 0) => {
      videoState.ready = false;
      if (code === 101 || code === 150) showVideoEmbedNotice(String(code), videoId, url);
      else if (code === 153) showVideoEmbedNotice("153", videoId, url);
      else setVideoStatus(code ? `Error ${code}` : (state.language === "en" ? "player error" : "lỗi player"), false);
      if (!settled) {
        settled = true;
        const error = new Error(message);
        error.youtubeCode = code;
        reject(error);
      }
    };

    videoState.youtubePlayer = new YT.Player("youtubePlayerMount", {
      width: "100%",
      height: "100%",
      videoId,
      playerVars,
      events: {
        onReady: event => {
          if (settled) return;
          settled = true;
          videoState.ready = true;
          videoState.embedBlocked = false;
          videoState.embedAllowed = true;
          const iframe = event.target.getIframe?.();
          if (iframe) {
            iframe.title = "Wordinary YouTube player";
            iframe.referrerPolicy = "strict-origin-when-cross-origin";
            iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
            iframe.setAttribute("allowfullscreen", "");
          }
          const data = event.target.getVideoData?.() || {};
          videoState.title = data.title || `YouTube • ${videoId}`;
          $("#videoTitle").textContent = videoState.title;
          $("#videoMeta").textContent = state.language === "en"
            ? "YouTube embed • captions synchronized by timestamp"
            : "YouTube embed • caption đồng bộ qua timestamp";
          setVideoStatus(state.language === "en" ? "ready" : "sẵn sàng", true);
          resolve();
        },
        onStateChange: updateVideoPlayIcon,
        onError: event => {
          const code = Number(event?.data) || 0;
          const messages = {
            2: state.language === "en" ? "The YouTube URL or video ID is invalid." : "URL hoặc video ID YouTube không hợp lệ.",
            5: state.language === "en" ? "This video cannot play in the HTML5 embedded player." : "Video này không phát được trong HTML5 embedded player.",
            100: state.language === "en" ? "This video was removed, is private, or cannot be found." : "Video đã bị xoá, đặt riêng tư hoặc không tồn tại.",
            101: state.language === "en" ? "The owner does not allow this video to be embedded." : "Chủ video không cho phép phát nhúng.",
            150: state.language === "en" ? "The owner does not allow this video to be embedded." : "Chủ video không cho phép phát nhúng.",
            153: state.language === "en"
              ? "YouTube did not receive an HTTP referrer/client identity. Open Wordinary through localhost, not file://."
              : "YouTube không nhận được HTTP Referer/danh tính client. Hãy mở Wordinary qua localhost, không mở bằng file://."
          };
          fail(messages[code] || (state.language === "en" ? `YouTube player error ${code || "unknown"}.` : `YouTube player lỗi ${code || "không xác định"}.`), code);
        }
      }
    });
  });
  ensureVideoPolling();
}

function mountNativeVideo(url, title = "Video trực tiếp") {
  resetYouTubeHost();
  const video = $("#nativeVideo");
  video.pause();
  video.src = url;
  video.load();
  videoState.type = "native";
  videoState.url = url;
  videoState.title = title;
  videoState.ready = true;
  showVideoPlayer("native");
  $("#videoTitle").textContent = title;
  $("#videoMeta").textContent = "HTML5 video • transcript follows playback";
  setVideoStatus("ready", true);
  ensureVideoPolling();
}

function loadDemoVideo(options = {}) {
  if (options?.preventDefault) options = {};
  if (!state.currentUser || !getAuthToken()) {
    showToast(state.language === "en" ? "Log in required" : "Cần đăng nhập", state.language === "en" ? "Sign in to save videos to your library." : "Đăng nhập để lưu video vào thư viện.", "!");
    return;
  }
  videoState.libraryItemId = options.libraryItemId || "";
  mountNativeVideo(DEMO_VIDEO_DATA, "Why context makes vocabulary stick");
  setCaptions(DEMO_VIDEO_CAPTIONS.map(cue => ({ ...cue, translation: "" })), "caption demo • EN");
  videoState.url = "wordinary://video-demo";
  $("#videoUrlInput").value = "";
  const item = persistCurrentVideoToLibrary(true);
  if (options.restoreItem && item) item.progress = options.restoreItem.progress || item.progress;
  saveState(); updateStats();
  saveCurrentVideoToApi().then(() => {
    if ($("#libraryView")?.classList.contains("active")) renderLibraryOverview();
  }).catch(error => {
    discardTransientLibraryItems();
    console.warn("Could not sync demo video", error);
  });
  showToast("Video ready", "Press Play, pause, then highlight a word in the transcript.", "🎬");
}

async function loadVideoFromUrl(explicitUrl = "", options = {}) {
  if (explicitUrl?.preventDefault) explicitUrl = "";
  const input = $("#videoUrlInput");
  const url = String(explicitUrl || input.value || "").trim();
  input.value = url;
  videoState.libraryItemId = options.libraryItemId || "";
  if (!state.currentUser || !getAuthToken()) return showToast(state.language === "en" ? "Log in required" : "Cần đăng nhập", state.language === "en" ? "Sign in to save videos to your library." : "Đăng nhập để lưu video vào thư viện.", "!");
  if (!/^https?:\/\//i.test(url)) return showToast("Invalid URL", "Paste a YouTube URL or a public MP4/WebM link that starts with http.", "⚠️");
  const button = $("#loadVideoUrl");
  button.disabled = true; button.textContent = "Analyzing...";
  try {
    clearCaptionData(false);
    const youtubeId = parseYouTubeId(url);
    if (youtubeId) {
      videoState.pendingYouTubeId = youtubeId;
      videoState.pendingYouTubeUrl = url;
      videoState.url = url;

      // Ask yt-dlp for captions and embed metadata first. This lets Wordinary
      // avoid presenting Error 150 as an app bug when the owner disabled embeds.
      const captionData = await fetchCaptionsFromBridge(url, false);
      if (captionData?.embeddable === false) {
        videoState.embedAllowed = false;
        videoState.title = captionData.title || `YouTube • ${youtubeId}`;
        $("#videoTitle").textContent = videoState.title;
        $("#videoMeta").textContent = state.language === "en"
          ? "YouTube transcript • external playback required"
          : "YouTube transcript • video yêu cầu phát bên ngoài";
        showVideoEmbedNotice("150", youtubeId, url);
        showToast(state.language === "en" ? "Embedding is disabled" : "Video đã chặn phát nhúng", state.language === "en" ? "The transcript is ready. Open YouTube at a caption timestamp or use a local video file." : "Transcript vẫn sẵn sàng. Hãy mở YouTube tại timestamp hoặc ghép với file video trên máy.", "↗");
      } else {
        try {
          await mountYouTubeVideo(youtubeId, url);
        } catch (error) {
          if (![101, 150].includes(Number(error?.youtubeCode))) throw error;
          // Error 150 is a video-level policy restriction, not a broken iframe.
        }
      }
      if (!captionData) {
        renderCaptions();
        $("#captionDrawer").open = true;
        showToast(
          state.language === "en" ? "Video loaded without a transcript" : "Chưa có transcript",
          videoState.lastCaptionError || (state.language === "en" ? "Fetch captions automatically, upload VTT/SRT, or paste a transcript." : "Tự lấy caption, upload VTT/SRT hoặc dán transcript."),
          "💬"
        );
      }
    } else if (/\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(url)) {
      mountNativeVideo(url, decodeURIComponent(url.split("/").pop().split(/[?#]/)[0]) || "Direct video");
      renderCaptions();
      $("#captionDrawer").open = true;
      showToast("Video opened", "Upload VTT/SRT captions to enable the synced transcript.", "▶️");
    } else {
      throw new Error("Wordinary supports YouTube URLs or public MP4/WebM/OGG video files.");
    }
  } catch (error) {
    showToast("Could not open video", error.message || "Try another URL.", "⚠️");
  } finally {
    if (videoState.url) {
      persistCurrentVideoToLibrary(true);
      try {
        const apiItem = await saveCurrentVideoToApi();
        if (!apiItem?.storageSource) throw new Error("Video was not saved");
      } catch (error) {
        discardTransientLibraryItems();
        console.warn("Could not sync video", error);
        showToast(state.language === "en" ? "Video was not saved" : "Video chưa được lưu", error.message || "Backend sync failed.", "!");
      }
      saveState(); updateStats();
    }
    button.disabled = false; button.textContent = state.language === "en" ? "Analyze video" : "Phân tích video";
  }
}

function setCaptions(captions, label = "caption đã nhập") {
  videoState.captions = captions.map(cue => ({
    start: Math.max(0, Number(cue.start) || 0),
    end: Math.max(Number(cue.end) || Number(cue.start) + 3, Number(cue.start) + .1),
    text: cleanCaptionText(cue.text), translation: cleanCaptionText(cue.translation || "")
  })).filter(cue => cue.text).sort((a, b) => a.start - b.start).map((cue, index) => ({ ...cue, index }));
  videoState.activeCueIndex = -1;
  videoState.lastRenderedActive = -2;
  videoState.pausedAtCue = -1;
  setCaptionSource(label, Boolean(videoState.captions.length));
  $("#captionCount").textContent = videoState.captions.length;
  $("#captionSearch").value = "";
  renderCaptions();
  updateVideoTimeline(true);
  if (videoState.url) {
    persistCurrentVideoToLibrary(false);
    clearTimeout(setCaptions._saveTimer);
    setCaptions._saveTimer = setTimeout(() => {
      saveCurrentVideoToApi().catch(error => {
        discardTransientLibraryItems();
        console.warn("Could not sync captions", error);
      });
      saveState();
      updateStats();
    }, 180);
  }
}

function clearCaptionData(showMessage = true) {
  videoState.captions = [];
  videoState.activeCueIndex = -1;
  $("#captionCount").textContent = "0";
  setCaptionSource("no captions", false);
  $("#stageCaption").classList.remove("show");
  renderCaptions();
  if (showMessage) showToast("Transcript cleared", "The video stays open.", "🧹");
}

function renderCaptions(filter = $("#captionSearch")?.value || "") {
  const root = $("#captionList");
  const query = filter.trim().toLowerCase();
  if (!videoState.captions.length) {
    root.innerHTML = `<div class="caption-empty"><div><div class="big">💬</div><b>No captions for this video yet</b><p>The video can still play. Fetch captions automatically, upload VTT/SRT, or paste a transcript below.</p><div class="caption-empty-actions"><button class="caption-upload-btn" data-caption-upload>Upload caption</button><button class="caption-upload-btn" data-open-demo>Open demo</button></div></div></div>`;
    bindCaptionInlineActions();
    return;
  }
  const matches = videoState.captions.filter(cue => !query || `${cue.text} ${cue.translation}`.toLowerCase().includes(query));
  if (!matches.length) {
    root.innerHTML = `<div class="caption-empty"><div><div class="big">🔎</div><b>No matching caption found</b><p>Try a shorter keyword or clear the filter.</p></div></div>`;
    return;
  }
  root.innerHTML = matches.map(cue => `<article class="caption-row ${cue.index === videoState.activeCueIndex ? "active" : ""}" data-cue-index="${cue.index}" data-no-i18n><button class="caption-time-btn" data-seek-cue="${cue.index}">${formatVideoTime(cue.start)}</button><div class="caption-text">${escapeHtml(cue.text)}${cue.translation ? `<small class="caption-translation">${escapeHtml(cue.translation)}</small>` : ""}</div></article>`).join("");
}

function bindCaptionInlineActions() {
  $$('[data-caption-upload]', $("#captionList")).forEach(btn => btn.addEventListener("click", () => $("#captionFileInput").click()));
  $$('[data-open-demo]', $("#captionList")).forEach(btn => btn.addEventListener("click", loadDemoVideo));
}

function cueAtTime(time) {
  let index = videoState.captions.findIndex(cue => time >= cue.start && time < cue.end);
  if (index < 0 && videoState.captions.length) {
    for (let i = videoState.captions.length - 1; i >= 0; i -= 1) {
      if (time >= videoState.captions[i].start && time < videoState.captions[i].end + .35) { index = i; break; }
    }
  }
  return index;
}

function updateActiveCue(time) {
  const next = cueAtTime(time);
  if (videoState.loopCue && videoState.activeCueIndex >= 0) {
    const cue = videoState.captions[videoState.activeCueIndex];
    if (cue && time >= cue.end) { seekVideo(cue.start); playVideo(); return; }
  }
  if (videoState.pauseEachCue && videoState.activeCueIndex >= 0) {
    const cue = videoState.captions[videoState.activeCueIndex];
    if (cue && time >= cue.end - .05 && videoState.pausedAtCue !== videoState.activeCueIndex && isVideoPlaying()) {
      videoState.pausedAtCue = videoState.activeCueIndex;
      pauseVideo();
      seekVideo(Math.max(cue.start, cue.end - .04));
      showToast("Đến cuối câu", "Nhấn Play để tiếp tục hoặc ↻ Câu để nghe lại.", "🗣️");
      return;
    }
  }
  if (next === videoState.activeCueIndex) return;
  videoState.activeCueIndex = next;
  if (next >= 0) videoState.pausedAtCue = -1;
  const cue = videoState.captions[next];
  const overlay = $("#stageCaption");
  if (cue) { overlay.textContent = cue.text; overlay.classList.add("show"); }
  else overlay.classList.remove("show");
  $$(".caption-row", $("#captionList")).forEach(row => row.classList.toggle("active", Number(row.dataset.cueIndex) === next));
  if (videoState.autoFollow && cue && !$("#captionSearch").value.trim()) {
    const row = $(`.caption-row[data-cue-index="${next}"]`, $("#captionList"));
    row?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function updateVideoPlayIcon() { $("#videoPlayToggle").textContent = isVideoPlaying() ? "❚❚" : "▶"; }

function updateVideoTimeline(force = false) {
  const current = getVideoCurrentTime();
  const duration = getVideoDuration();
  if (current > videoState.maxWatched) videoState.maxWatched = current;
  $("#videoCurrent").textContent = formatVideoTime(current);
  $("#videoDuration").textContent = formatVideoTime(duration);
  if (force || !$("#videoProgress").matches(":active")) $("#videoProgress").value = duration ? Math.round(current / duration * 1000) : 0;
  $("#videoCoverage").textContent = duration ? `${Math.min(100, Math.round(videoState.maxWatched / duration * 100))}%` : "0%";
  updateVideoPlayIcon();
  updateActiveCue(current);
  if (videoState.url && Date.now() - videoState.lastLibraryPersist > 3000) {
    const existing = getLibraryItem(videoState.libraryItemId);
    if (!existing || existing.storageSource !== "api") return;
    videoState.lastLibraryPersist = Date.now();
    const item = persistCurrentVideoToLibrary(false);
    if (item?.storageSource === "api") scheduleVideoProgressSync(item);
    clearTimeout(updateVideoTimeline._saveTimer);
    updateVideoTimeline._saveTimer = setTimeout(() => { saveState(); if ($("#libraryView")?.classList.contains("active")) renderLibraryOverview(); }, 350);
  }
}

function scheduleVideoProgressSync(item = getLibraryItem(videoState.libraryItemId)) {
  if (!item || item.storageSource !== "api" || !state.currentUser || !getAuthToken()) return;
  const duration = Math.max(0, getVideoDuration());
  const timestamp = Math.max(0, getVideoCurrentTime());
  const progress = duration ? Math.min(100, Math.round(timestamp / duration * 100)) : Math.max(0, Math.min(100, Number(item.progress) || 0));
  scheduleVideoProgressSync._pending = {
    itemId: item.id,
    progress,
    timestamp,
    captionIndex: videoState.activeCueIndex >= 0 ? videoState.activeCueIndex : null
  };
  clearTimeout(scheduleVideoProgressSync._timer);
  scheduleVideoProgressSync._timer = setTimeout(flushVideoProgressSync, 1000);
}

async function flushVideoProgressSync(options = {}) {
  const pending = scheduleVideoProgressSync._pending;
  if (!pending || !state.currentUser || !getAuthToken()) return;
  scheduleVideoProgressSync._pending = null;
  clearTimeout(scheduleVideoProgressSync._timer);
  try {
    const result = await libraryApiUpdateProgress(pending.itemId, {
      type: "video",
      libraryItemId: pending.itemId,
      progress: pending.progress,
      position: { timestamp: pending.timestamp, captionIndex: pending.captionIndex }
    }, options);
    const item = getLibraryItem(pending.itemId);
    if (item) {
      item.progress = pending.progress;
      item.position = result.position || { timestamp: pending.timestamp, captionIndex: pending.captionIndex };
      item.lastOpenedAt = Date.now();
    }
    saveState();
  } catch (error) {
    console.warn("Could not sync video progress", error);
  }
}

function ensureVideoPolling() {
  if (videoState.pollingTimer) return;
  videoState.pollingTimer = setInterval(() => {
    if ($("#videoView")?.classList.contains("active") || isVideoPlaying()) updateVideoTimeline();
  }, 160);
}

function jumpToActiveCue() {
  const cue = videoState.captions[videoState.activeCueIndex];
  if (!cue) return showToast("Chưa có câu đang phát", "Phát video hoặc chọn timestamp trong transcript.", "💬");
  $(`.caption-row[data-cue-index="${videoState.activeCueIndex}"]`, $("#captionList"))?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function replayActiveCue() {
  const cue = videoState.captions[videoState.activeCueIndex];
  if (!cue) return;
  videoState.pausedAtCue = -1;
  seekVideo(cue.start);
  playVideo();
}

async function translateActiveCue() {
  const cue = videoState.captions[videoState.activeCueIndex];
  if (!cue) return showToast("Chưa có câu đang phát", "Hãy phát video hoặc chọn một timestamp.", "💬");
  const button = $("#translateCueBtn");
  if (cue.translation) { cue.translation = ""; button.classList.remove("active"); renderCaptions(); updateActiveCue(getVideoCurrentTime()); return; }
  const old = button.textContent; button.textContent = "Đang dịch..."; button.disabled = true;
  try {
    cue.translation = await translate(cue.text);
    renderCaptions();
    updateActiveCue(getVideoCurrentTime());
    button.classList.add("active");
  } catch (_) { showToast("Chưa dịch được câu", "API miễn phí đang bận. Bạn vẫn có thể chọn từ để dịch.", "⚠️"); }
  finally { button.textContent = old; button.disabled = false; }
}

async function handleCaptionFile(file) {
  if (!file) return;
  try {
    const cues = parseCaptionText(await file.text());
    if (!cues.length) throw new Error("Không tìm thấy timestamp hoặc câu caption hợp lệ.");
    setCaptions(cues, `${file.name} • ${cues.length} cues`);
    showToast("Đã nhập caption", `${cues.length} dòng đã sẵn sàng để đồng bộ.`, "💬");
  } catch (error) { showToast("Chưa đọc được caption", error.message || "Hãy thử tệp VTT/SRT khác.", "⚠️"); }
  finally { $("#captionFileInput").value = ""; }
}

function usePastedCaptions() {
  const cues = parseCaptionText($("#captionPaste").value);
  if (!cues.length) return showToast("Transcript is empty", "Paste VTT, SRT, JSON, or one sentence per line.", "⚠️");
  setCaptions(cues, `pasted transcript • ${cues.length} cues`);
  showToast("Transcript synced", "Timestamps were read or distributed automatically.", "✨");
}

async function fetchCaptionsFromBridge(url = videoState.url, notify = true) {
  if (!url || url.startsWith("wordinary://")) {
    if (notify) showToast("Demo captions are ready", "The sample captions are already included.", "✨");
    return false;
  }
  setCaptionSource("fetching captions...", false);
  videoState.lastCaptionError = "";
  try {
    const data = await apiRequest(`/captions/fetch?lang=en&url=${encodeURIComponent(url)}`);
    const cues = Array.isArray(data?.captions) ? data.captions : [];
    if (!cues.length) throw new Error(data?.error || "Video không có caption tiếng Anh.");
    if (data.title) { videoState.title = data.title; $("#videoTitle").textContent = data.title; }
    videoState.embedAllowed = typeof data.embeddable === "boolean" ? data.embeddable : null;
    setCaptions(cues, `${data.source === "manual" ? "official" : "auto"} • ${data.language || "EN"} • yt-dlp`);
    if (notify) showToast("Captions ready", `${cues.length} caption lines loaded.`, "✅");
    return data;
  } catch (error) {
    videoState.lastCaptionError = error.message || "Check the caption service.";
    setCaptionSource("caption fetch failed", false);
    if (notify) showToast("Could not fetch captions", error.message || "Check the caption service.", "🔌");
    return null;
  }
}

async function checkCaptionServer() {
  try {
    const data = await apiRequest("/captions/health");
    showToast("Caption service is running", `yt-dlp ${data.ytDlp || data.yt_dlp || "ready"} • service`, "✅");
  } catch (_) { showToast("Caption service is unavailable", "Start the Docker Compose stack, then try again.", "🔌"); }
}

async function handleCaptionSelection() {
  await sleep(10);
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  const inList = $("#captionList").contains(range.commonAncestorContainer);
  if (!inList) return;
  const selected = normalizeSelectedText(selection.toString());
  if (!selected || selected.length > 100 || selected.split(/\s+/).length > 10) return;
  let node = range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer;
  const row = node.closest(".caption-row");
  const cueIndex = Number(row?.dataset.cueIndex);
  const cue = videoState.captions[Number.isFinite(cueIndex) ? cueIndex : videoState.activeCueIndex];
  if (!cue) return;
  pauseVideo();
  state.selection = {
    word: selected, sentence: cue.text, range: range.cloneRange(), translation: "", sentenceTranslation: "",
    definition: "", phonetic: "", icons: [], selectedIcon: ICON_FALLBACKS.default[0],
    sourceId: "", sourceTitle: videoState.title,
    sourceType: "video", sourceUrl: videoState.url, sourceTime: cue.start,
    captionIndex: Number.isFinite(cueIndex) ? cueIndex : videoState.activeCueIndex
  };
  openSelectionPopup(range.getBoundingClientRect());
  loadSelectionData();
  $("#captionHint").textContent = `Đang chọn “${selected}” tại ${formatVideoTime(cue.start)}`;
}

function updateVideoSavedCount() {
  $("#videoSavedCount").textContent = state.cards.filter(card => card.sourceType === "video").length;
}
