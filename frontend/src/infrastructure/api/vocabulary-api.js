function vocabularyApiCreate(payload) {
  return apiRequest("/vocabulary", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

function vocabularyApiList(params = {}) {
  return apiRequest(`/vocabulary${toQueryString(params)}`);
}

function vocabularyApiUpdate(id, payload) {
  return apiRequest(`/vocabulary/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
}

function vocabularyApiRecordReview(id, result) {
  return apiRequest(`/vocabulary/${encodeURIComponent(id)}/review/${encodeURIComponent(result)}`, {
    method: "PUT"
  });
}

function vocabularyApiDelete(id) {
  return apiRequest(`/vocabulary/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}
