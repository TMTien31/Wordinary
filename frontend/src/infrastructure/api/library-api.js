function libraryApiCreateArticle(payload) {
  return apiRequest("/library/articles", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function libraryApiCreateVideo(payload) {
  return apiRequest("/library/videos", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function libraryApiCreatePdf(file, metadata = {}) {
  const form = new FormData();
  form.append("file", file, metadata.fileName || file.name || "document.pdf");
  if (metadata.title) form.append("title", metadata.title);
  form.append("pageCount", String(metadata.pageCount || 1));
  form.append("textLayerAvailable", String(metadata.textLayerAvailable !== false));
  return apiRequest("/library/pdfs", {
    method: "POST",
    body: form
  });
}

function libraryApiList(params = {}) {
  return apiRequest(`/library${toQueryString(params)}`);
}

function libraryApiGetItem(id) {
  return apiRequest(`/library/${encodeURIComponent(id)}`);
}

function libraryApiUpdateItem(id, payload) {
  return apiRequest(`/library/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

function libraryApiUpdateArticleContent(id, payload) {
  return apiRequest(`/library/articles/${encodeURIComponent(id)}/content`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

function libraryApiUpdateVideoContent(id, payload) {
  return apiRequest(`/library/videos/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

function libraryApiUpdateProgress(id, payload, options = {}) {
  return apiRequest(`/library/${encodeURIComponent(id)}/progress`, {
    ...options,
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

function libraryApiDeleteItem(id) {
  return apiRequest(`/library/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}
