/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ VIDEO LAB LOGIC â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
  $("#captionSourcePill").textContent = label || "chÆ°a cÃ³ caption";
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
    $(".video-embed-notice-icon", notice).textContent = "â†—";
    title.textContent = english ? "This video cannot be embedded" : "Video nÃ y khÃ´ng cho phÃ©p phÃ¡t nhÃºng";
    text.textContent = english
      ? "YouTube Error 150 is the same as Error 101: the owner disabled playback in embedded players. Wordinary cannot override that setting. Your transcript is still available, and you can open YouTube at the selected timestamp or pair it with a local video file."
      : "YouTube Error 150 giá»‘ng Error 101: chá»§ video Ä‘Ã£ táº¯t quyá»n phÃ¡t trong trÃ¬nh phÃ¡t nhÃºng. Wordinary khÃ´ng thá»ƒ vÆ°á»£t qua thiáº¿t láº­p nÃ y. Transcript váº«n dÃ¹ng Ä‘Æ°á»£c; báº¡n cÃ³ thá»ƒ má»Ÿ YouTube táº¡i timestamp Ä‘ang chá»n hoáº·c ghÃ©p caption vá»›i file video cÃ³ sáºµn trÃªn mÃ¡y.";
    detail.textContent = english ? "YouTube policy â€¢ Error 150 = embedding disabled" : "ChÃ­nh sÃ¡ch YouTube â€¢ Error 150 = chá»§ video cháº·n embed";
    copyBtn.hidden = true;
    cueBtn.hidden = false;
    localBtn.hidden = false;
    openBtn.classList.add("primary");
    openBtn.textContent = english ? "Open on YouTube" : "Má»Ÿ video trÃªn YouTube";
    cueBtn.textContent = english ? "Open at selected caption" : "Má»Ÿ táº¡i cÃ¢u Ä‘ang chá»n";
    localBtn.textContent = english ? "Use a local video file" : "DÃ¹ng file video trÃªn mÃ¡y";
    closeBtn.textContent = english ? "Keep transcript only" : "Chá»‰ dÃ¹ng transcript";
  } else {
    $(".video-embed-notice-icon", notice).textContent = "âŒ";
    title.textContent = english
      ? (code === "153" ? "YouTube rejected this embed (Error 153)" : "Run Wordinary through localhost for YouTube")
      : (code === "153" ? "YouTube tá»« chá»‘i iframe nÃ y (Error 153)" : "YouTube cáº§n Wordinary cháº¡y qua localhost");
    text.textContent = english
      ? "YouTube requires an HTTP referrer or equivalent client identity. A page opened with file:// cannot provide it. Start the included Wordinary server, then open the localhost address."
      : "YouTube yÃªu cáº§u HTTP Referer hoáº·c danh tÃ­nh client tÆ°Æ¡ng Ä‘Æ°Æ¡ng. Trang má»Ÿ báº±ng file:// khÃ´ng thá»ƒ cung cáº¥p thÃ´ng tin Ä‘Ã³. HÃ£y cháº¡y server Wordinary Ä‘i kÃ¨m rá»“i má»Ÿ Ä‘á»‹a chá»‰ localhost.";
    detail.textContent = "docker compose up -d --build  ->  http://localhost:5500/";
    copyBtn.hidden = false;
    cueBtn.hidden = true;
    localBtn.hidden = true;
    copyBtn.classList.add("primary");
    openBtn.classList.remove("primary");
    copyBtn.textContent = english ? "Copy fallback command" : "Sao chÃ©p lá»‡nh dá»± phÃ²ng";
    openBtn.textContent = english ? "Open on YouTube" : "Má»Ÿ video trÃªn YouTube";
    closeBtn.textContent = english ? "Close" : "ÄÃ³ng thÃ´ng bÃ¡o";
  }

  notice.classList.remove("video-hidden");
  $("#videoPlaceholder")?.classList.add("video-hidden");
  $("#youtubeHost")?.classList.add("video-hidden");
  setVideoStatus(blocked ? "Error 150" : (code === "153" ? "Error 153" : (english ? "localhost required" : "cáº§n localhost")), false);
}

function hideVideoEmbedNotice() {
  $("#videoEmbedNotice")?.classList.add("video-hidden");
}

async function copyWordinaryServerCommand() {
  const command = "python tools/reference_server/server.py";
  try {
    await navigator.clipboard.writeText(command);
    showToast(state.language === "en" ? "Command copied" : "ÄÃ£ sao chÃ©p lá»‡nh", command, "âœ“");
  } catch (_) {
    window.prompt(state.language === "en" ? "Copy this command" : "Sao chÃ©p lá»‡nh nÃ y", command);
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
    showToast(state.language === "en" ? "Unsupported file" : "File chÆ°a Ä‘Æ°á»£c há»— trá»£", state.language === "en" ? "Choose an MP4, WebM, OGG, or another browser-playable video file." : "HÃ£y chá»n MP4, WebM, OGG hoáº·c Ä‘á»‹nh dáº¡ng video mÃ  trÃ¬nh duyá»‡t phÃ¡t Ä‘Æ°á»£c.", "âš ï¸");
    return;
  }
  if (videoState.localVideoObjectUrl) URL.revokeObjectURL(videoState.localVideoObjectUrl);
  videoState.localVideoObjectUrl = URL.createObjectURL(file);
  const previousTitle = videoState.title && videoState.title !== "ChÆ°a cÃ³ video" ? videoState.title : file.name;
  mountNativeVideo(videoState.localVideoObjectUrl, `${previousTitle} â€¢ local`);
  videoState.embedBlocked = false;
  hideVideoEmbedNotice();
  showToast(state.language === "en" ? "Local video connected" : "ÄÃ£ ghÃ©p video trÃªn mÃ¡y", state.language === "en" ? "The existing transcript will follow this video's currentTime." : "Transcript hiá»‡n táº¡i sáº½ cháº¡y theo currentTime cá»§a file nÃ y.", "â–¶ï¸");
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
  else $("#nativeVideo").play().catch(() => showToast("TrÃ¬nh duyá»‡t cháº·n autoplay", "HÃ£y nháº¥n nÃºt Play má»™t láº§n ná»¯a.", "â–¶ï¸"));
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

function lockManualCue(cue) {
  videoState.manualCueLockIndex = Number.isFinite(cue?.index) ? cue.index : -1;
  videoState.manualCueLockUntil = performance.now() + 900;
}

function seekToCaptionCue(cue, options = {}) {
  if (!cue) return;
  videoState.activeCueIndex = cue.index;
  videoState.pausedAtCue = -1;
  lockManualCue(cue);
  renderCaptions($("#captionSearch")?.value || "");
  const overlay = $("#stageCaption");
  if (overlay) {
    overlay.textContent = cue.text;
    overlay.classList.add("show");
  }
  updateActiveCue(cue.start);
  if (videoState.embedBlocked) {
    if (options.showEmbedNotice !== false) {
      showVideoEmbedNotice("150", videoState.pendingYouTubeId, videoState.pendingYouTubeUrl || videoState.url);
      showToast("Caption selected", "Use Open at selected caption to continue on YouTube.", "->");
    }
    return;
  }
  const target = Math.max(0, cue.start + 0.06);
  seekVideo(target);
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
    script.onerror = () => reject(new Error("KhÃ´ng táº£i Ä‘Æ°á»£c YouTube Player API"));
    document.head.appendChild(script);
    setTimeout(() => { if (!window.YT?.Player) reject(new Error("YouTube Player API pháº£n há»“i quÃ¡ lÃ¢u")); }, 12000);
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
      : "YouTube khÃ´ng thá»ƒ nháº­n diá»‡n trang má»Ÿ báº±ng file://. HÃ£y cháº¡y Wordinary qua localhost.");
  }

  setVideoStatus(state.language === "en" ? "loading player" : "Ä‘ang táº£i player");
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
      else setVideoStatus(code ? `Error ${code}` : (state.language === "en" ? "player error" : "lá»—i player"), false);
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
          videoState.title = data.title || `YouTube â€¢ ${videoId}`;
          $("#videoTitle").textContent = videoState.title;
          $("#videoMeta").textContent = state.language === "en"
            ? "YouTube embed â€¢ captions synchronized by timestamp"
            : "YouTube embed â€¢ caption Ä‘á»“ng bá»™ qua timestamp";
          setVideoStatus(state.language === "en" ? "ready" : "sáºµn sÃ ng", true);
          resolve();
        },
        onStateChange: updateVideoPlayIcon,
        onError: event => {
          const code = Number(event?.data) || 0;
          const messages = {
            2: state.language === "en" ? "The YouTube URL or video ID is invalid." : "URL hoáº·c video ID YouTube khÃ´ng há»£p lá»‡.",
            5: state.language === "en" ? "This video cannot play in the HTML5 embedded player." : "Video nÃ y khÃ´ng phÃ¡t Ä‘Æ°á»£c trong HTML5 embedded player.",
            100: state.language === "en" ? "This video was removed, is private, or cannot be found." : "Video Ä‘Ã£ bá»‹ xoÃ¡, Ä‘áº·t riÃªng tÆ° hoáº·c khÃ´ng tá»“n táº¡i.",
            101: state.language === "en" ? "The owner does not allow this video to be embedded." : "Chá»§ video khÃ´ng cho phÃ©p phÃ¡t nhÃºng.",
            150: state.language === "en" ? "The owner does not allow this video to be embedded." : "Chá»§ video khÃ´ng cho phÃ©p phÃ¡t nhÃºng.",
            153: state.language === "en"
              ? "YouTube did not receive an HTTP referrer/client identity. Open Wordinary through localhost, not file://."
              : "YouTube khÃ´ng nháº­n Ä‘Æ°á»£c HTTP Referer/danh tÃ­nh client. HÃ£y má»Ÿ Wordinary qua localhost, khÃ´ng má»Ÿ báº±ng file://."
          };
          fail(messages[code] || (state.language === "en" ? `YouTube player error ${code || "unknown"}.` : `YouTube player lá»—i ${code || "khÃ´ng xÃ¡c Ä‘á»‹nh"}.`), code);
        }
      }
    });
  });
  ensureVideoPolling();
}

function mountNativeVideo(url, title = "Video trá»±c tiáº¿p") {
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
  $("#videoMeta").textContent = "HTML5 video â€¢ transcript follows playback";
  setVideoStatus("ready", true);
  ensureVideoPolling();
}

async function loadVideoFromUrl(explicitUrl = "", options = {}) {
  if (explicitUrl?.preventDefault) explicitUrl = "";
  const input = $("#videoUrlInput");
  const url = String(explicitUrl || input.value || "").trim();
  input.value = url;
  videoState.libraryItemId = options.libraryItemId || "";
  if (!state.currentUser || !getAuthToken()) return showToast(state.language === "en" ? "Log in required" : "Cáº§n Ä‘Äƒng nháº­p", state.language === "en" ? "Sign in to save videos to your library." : "ÄÄƒng nháº­p Ä‘á»ƒ lÆ°u video vÃ o thÆ° viá»‡n.", "!");
  if (!/^https?:\/\//i.test(url)) return showToast("Invalid URL", "Paste a YouTube URL or a public MP4/WebM link that starts with http.", "âš ï¸");
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
        videoState.title = captionData.title || `YouTube â€¢ ${youtubeId}`;
        $("#videoTitle").textContent = videoState.title;
        $("#videoMeta").textContent = state.language === "en"
          ? "YouTube transcript â€¢ external playback required"
          : "YouTube transcript â€¢ video yÃªu cáº§u phÃ¡t bÃªn ngoÃ i";
        showVideoEmbedNotice("150", youtubeId, url);
        showToast(state.language === "en" ? "Embedding is disabled" : "Video Ä‘Ã£ cháº·n phÃ¡t nhÃºng", state.language === "en" ? "The transcript is ready. Open YouTube at a caption timestamp or use a local video file." : "Transcript váº«n sáºµn sÃ ng. HÃ£y má»Ÿ YouTube táº¡i timestamp hoáº·c ghÃ©p vá»›i file video trÃªn mÃ¡y.", "â†—");
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
          state.language === "en" ? "Video loaded without a transcript" : "ChÆ°a cÃ³ transcript",
          videoState.lastCaptionError || (state.language === "en" ? "Fetch captions automatically, upload VTT/SRT, or paste a transcript." : "Tá»± láº¥y caption, upload VTT/SRT hoáº·c dÃ¡n transcript."),
          "ðŸ’¬"
        );
      }
    } else if (/\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(url)) {
      mountNativeVideo(url, decodeURIComponent(url.split("/").pop().split(/[?#]/)[0]) || "Direct video");
      renderCaptions();
      $("#captionDrawer").open = true;
      showToast("Video opened", "Upload VTT/SRT captions to enable the synced transcript.", "â–¶ï¸");
    } else {
      throw new Error("Wordinary supports YouTube URLs or public MP4/WebM/OGG video files.");
    }
  } catch (error) {
    showToast("Could not open video", error.message || "Try another URL.", "âš ï¸");
  } finally {
    if (videoState.url) {
      persistCurrentVideoToLibrary(true);
      try {
        const apiItem = await saveCurrentVideoToApi();
        if (!apiItem?.storageSource) throw new Error("Video was not saved");
      } catch (error) {
        discardTransientLibraryItems();
        console.warn("Could not sync video", error);
        showToast(state.language === "en" ? "Video was not saved" : "Video chÆ°a Ä‘Æ°á»£c lÆ°u", error.message || "Backend sync failed.", "!");
      }
      saveState(); updateStats();
    }
    button.disabled = false; button.textContent = state.language === "en" ? "Analyze video" : "PhÃ¢n tÃ­ch video";
  }
}

function setCaptions(captions, label = "caption Ä‘Ã£ nháº­p") {
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
  if (showMessage) showToast("Transcript cleared", "The video stays open.", "ðŸ§¹");
}

function renderCaptions(filter = $("#captionSearch")?.value || "") {
  const root = $("#captionList");
  const query = filter.trim().toLowerCase();
  if (!videoState.captions.length) {
    root.innerHTML = `<div class="caption-empty"><div><div class="big">ðŸ’¬</div><b>No captions for this video yet</b><p>The video can still play. Fetch captions automatically, upload VTT/SRT, or paste a transcript below.</p><div class="caption-empty-actions"><button class="caption-upload-btn" data-caption-paste>Paste transcript</button><button class="caption-upload-btn" data-caption-upload>Upload caption</button></div></div></div>`;
    bindCaptionInlineActions();
    return;
  }
  const matches = videoState.captions.filter(cue => !query || `${cue.text} ${cue.translation}`.toLowerCase().includes(query));
  if (!matches.length) {
    root.innerHTML = `<div class="caption-empty"><div><div class="big">ðŸ”Ž</div><b>No matching caption found</b><p>Try a shorter keyword or clear the filter.</p></div></div>`;
    return;
  }
  root.innerHTML = matches.map(cue => `<article class="caption-row ${cue.index === videoState.activeCueIndex ? "active" : ""}" data-cue-index="${cue.index}" data-no-i18n><button class="caption-time-btn" data-seek-cue="${cue.index}">${formatVideoTime(cue.start)}</button><div class="caption-text">${escapeHtml(cue.text)}${cue.translation ? `<small class="caption-translation">${escapeHtml(cue.translation)}</small>` : ""}</div></article>`).join("");
}

function openCaptionPastePanel() {
  const drawer = $("#captionDrawer");
  drawer.open = true;
  drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
  setTimeout(() => $("#captionPaste")?.focus(), 180);
}

function bindCaptionInlineActions() {
  $$('[data-caption-paste]', $("#captionList")).forEach(btn => btn.addEventListener("click", openCaptionPastePanel));
  $$('[data-caption-upload]', $("#captionList")).forEach(btn => btn.addEventListener("click", () => $("#captionFileInput").click()));
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
  let next = cueAtTime(time);
  const lockedCue = videoState.captions[videoState.manualCueLockIndex];
  if (lockedCue && performance.now() < videoState.manualCueLockUntil) {
    const nearSelectedStart = Math.abs(time - lockedCue.start) < 1.25;
    const insideSelectedCue = time >= lockedCue.start && time < lockedCue.end;
    if (nearSelectedStart || insideSelectedCue) next = lockedCue.index;
  } else {
    videoState.manualCueLockIndex = -1;
    videoState.manualCueLockUntil = 0;
  }
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
      showToast("Äáº¿n cuá»‘i cÃ¢u", "Nháº¥n Play Ä‘á»ƒ tiáº¿p tá»¥c hoáº·c â†» CÃ¢u Ä‘á»ƒ nghe láº¡i.", "ðŸ—£ï¸");
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

function updateVideoPlayIcon() { $("#videoPlayToggle").textContent = isVideoPlaying() ? "âšâš" : "â–¶"; }

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
  if (!cue) return showToast("ChÆ°a cÃ³ cÃ¢u Ä‘ang phÃ¡t", "PhÃ¡t video hoáº·c chá»n timestamp trong transcript.", "ðŸ’¬");
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
  if (!cue) return showToast("ChÆ°a cÃ³ cÃ¢u Ä‘ang phÃ¡t", "HÃ£y phÃ¡t video hoáº·c chá»n má»™t timestamp.", "ðŸ’¬");
  const button = $("#translateCueBtn");
  if (cue.translation) { cue.translation = ""; button.classList.remove("active"); renderCaptions(); updateActiveCue(getVideoCurrentTime()); return; }
  const old = button.textContent; button.textContent = "Äang dá»‹ch..."; button.disabled = true;
  try {
    cue.translation = await translate(cue.text);
    renderCaptions();
    updateActiveCue(getVideoCurrentTime());
    button.classList.add("active");
  } catch (_) { showToast("ChÆ°a dá»‹ch Ä‘Æ°á»£c cÃ¢u", "API miá»…n phÃ­ Ä‘ang báº­n. Báº¡n váº«n cÃ³ thá»ƒ chá»n tá»« Ä‘á»ƒ dá»‹ch.", "âš ï¸"); }
  finally { button.textContent = old; button.disabled = false; }
}

async function handleCaptionFile(file) {
  if (!file) return;
  try {
    const cues = parseCaptionText(await file.text());
    if (!cues.length) throw new Error("KhÃ´ng tÃ¬m tháº¥y timestamp hoáº·c cÃ¢u caption há»£p lá»‡.");
    setCaptions(cues, `${file.name} â€¢ ${cues.length} cues`);
    showToast("ÄÃ£ nháº­p caption", `${cues.length} dÃ²ng Ä‘Ã£ sáºµn sÃ ng Ä‘á»ƒ Ä‘á»“ng bá»™.`, "ðŸ’¬");
  } catch (error) { showToast("ChÆ°a Ä‘á»c Ä‘Æ°á»£c caption", error.message || "HÃ£y thá»­ tá»‡p VTT/SRT khÃ¡c.", "âš ï¸"); }
  finally { $("#captionFileInput").value = ""; }
}

function usePastedCaptions() {
  const cues = parseCaptionText($("#captionPaste").value);
  if (!cues.length) return showToast("Transcript is empty", "Paste VTT, SRT, JSON, or one sentence per line.", "âš ï¸");
  setCaptions(cues, `pasted transcript â€¢ ${cues.length} cues`);
  showToast("Transcript synced", "Timestamps were read or distributed automatically.", "âœ¨");
}

async function fetchCaptionsFromBridge(url = videoState.url, notify = true) {
  if (!url || url.startsWith("wordinary://")) {
    if (notify) showToast("No video URL", "Paste and analyze a video before fetching captions.", "!");
    return false;
  }
  setCaptionSource("fetching captions...", false);
  videoState.lastCaptionError = "";
  try {
    const data = await apiRequest(`/captions/fetch?lang=en&url=${encodeURIComponent(url)}`);
    const cues = Array.isArray(data?.captions) ? data.captions : [];
    if (!cues.length) throw new Error(data?.error || "Video khÃ´ng cÃ³ caption tiáº¿ng Anh.");
    if (data.title) { videoState.title = data.title; $("#videoTitle").textContent = data.title; }
    videoState.embedAllowed = typeof data.embeddable === "boolean" ? data.embeddable : null;
    setCaptions(cues, `${data.source === "manual" ? "official" : "auto"} â€¢ ${data.language || "EN"} â€¢ yt-dlp`);
    if (notify) showToast("Captions ready", `${cues.length} caption lines loaded.`, "âœ…");
    return data;
  } catch (error) {
    videoState.lastCaptionError = error.message || "Paste or upload a transcript instead.";
    setCaptionSource("caption fetch failed", false);
    if (notify) showToast("Could not fetch captions", error.message || "Paste or upload a transcript instead.", "ðŸ”Œ");
    return null;
  }
}

async function checkCaptionServer() {
  try {
    await apiRequest("/captions/health");
    showToast("Caption status", "Automatic captions are reachable.", "âœ…");
  } catch (_) { showToast("Caption status", "Automatic captions are unavailable. Paste or upload a transcript instead.", "ðŸ”Œ"); }
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
  $("#captionHint").textContent = `Äang chá»n â€œ${selected}â€ táº¡i ${formatVideoTime(cue.start)}`;
}

function updateVideoSavedCount() {
  $("#videoSavedCount").textContent = state.cards.filter(card => card.sourceType === "video").length;
}

