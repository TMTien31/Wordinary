function bindVideoEvents() {
  $("#loadVideoUrl").addEventListener("click", () => loadVideoFromUrl());
  $("#copyLocalhostCommand")?.addEventListener("click", copyWordinaryServerCommand);
  $("#openCurrentYouTube")?.addEventListener("click", () => openPendingYouTubeVideo(0));
  $("#openYouTubeAtCue")?.addEventListener("click", openPendingYouTubeAtCue);
  $("#pickLocalVideo")?.addEventListener("click", () => $("#localVideoFileInput")?.click());
  $("#localVideoFileInput")?.addEventListener("change", event => {
    useLocalVideoFile(event.target.files?.[0]);
    event.target.value = "";
  });
  $("#dismissVideoEmbedNotice")?.addEventListener("click", hideVideoEmbedNotice);
  $("#videoUrlInput").addEventListener("keydown", event => { if (event.key === "Enter") loadVideoFromUrl(); });
  $("#videoPlayToggle").addEventListener("click", toggleVideoPlayback);
  $("#videoBack").addEventListener("click", () => seekVideo(getVideoCurrentTime() - 5));
  $("#videoForward").addEventListener("click", () => seekVideo(getVideoCurrentTime() + 5));
  $("#replayCue").addEventListener("click", replayActiveCue);
  $("#loopCueToggle").addEventListener("click", event => { videoState.loopCue = !videoState.loopCue; event.currentTarget.classList.toggle("active", videoState.loopCue); });
  $("#pauseEachCueToggle").addEventListener("click", event => { videoState.pauseEachCue = !videoState.pauseEachCue; event.currentTarget.classList.toggle("active", videoState.pauseEachCue); });
  $("#autoFollowToggle").addEventListener("click", event => { videoState.autoFollow = !videoState.autoFollow; event.currentTarget.classList.toggle("active", videoState.autoFollow); });
  $("#translateCueBtn").addEventListener("click", translateActiveCue);
  $("#videoSpeed").addEventListener("change", event => setVideoRate(event.target.value));
  $("#videoProgress").addEventListener("input", event => seekVideo(getVideoDuration() * Number(event.target.value) / 1000));
  $("#nativeVideo").addEventListener("play", updateVideoPlayIcon);
  $("#nativeVideo").addEventListener("pause", updateVideoPlayIcon);
  $("#nativeVideo").addEventListener("loadedmetadata", () => updateVideoTimeline(true));
  $("#captionSearch").addEventListener("input", event => renderCaptions(event.target.value));
  $("#captionUploadTrigger").addEventListener("click", () => $("#captionFileInput").click());
  $("#captionFileInput").addEventListener("change", () => handleCaptionFile($("#captionFileInput").files[0]));
  $("#captionList").addEventListener("mouseup", handleCaptionSelection);
  $("#captionList").addEventListener("touchend", handleCaptionSelection);
  $("#captionList").addEventListener("click", event => {
    const mark = event.target.closest("mark.saved-word");
    if (mark?.dataset.cardId) return openEditCard(mark.dataset.cardId);
    const button = event.target.closest("[data-seek-cue]");
    const row = event.target.closest(".caption-row");
    if (button) {
      const cue = videoState.captions[Number(button.dataset.seekCue)];
      if (cue) seekToCaptionCue(cue);
      return;
    }
    if (row && window.getSelection()?.isCollapsed) {
      const cue = videoState.captions[Number(row.dataset.cueIndex)];
      if (cue) seekToCaptionCue(cue, { showEmbedNotice: false });
    }
  });
  $("#jumpActiveCue").addEventListener("click", jumpToActiveCue);
  $("#retryCaptionServer")?.addEventListener("click", () => fetchCaptionsFromBridge(videoState.url, true));
  $("#checkCaptionServer")?.addEventListener("click", checkCaptionServer);
  $("#usePastedCaptions").addEventListener("click", usePastedCaptions);
  $("#clearCaptions").addEventListener("click", () => clearCaptionData(true));
  document.addEventListener("keydown", event => {
    if (!$("#videoView").classList.contains("active") || event.target.matches("input,textarea,select") || $("#selectionPopup").classList.contains("show") || $("#editCardModal").classList.contains("show")) return;
    if (event.code === "Space") { event.preventDefault(); toggleVideoPlayback(); }
    if (event.key === "ArrowLeft") seekVideo(getVideoCurrentTime() - 5);
    if (event.key === "ArrowRight") seekVideo(getVideoCurrentTime() + 5);
  });
  bindCaptionInlineActions();
}
