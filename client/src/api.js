const TOKEN_KEY = "ua-admin-token";
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; } };
export const setToken = (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch {} };

async function req(path, { method = "GET", body, form, reveal } = {}) {
  const headers = { "x-admin-token": getToken() };
  if (reveal) headers["x-reveal"] = "1";
  if (body) headers["content-type"] = "application/json";
  const res = await fetch(path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw Object.assign(new Error(data?.error || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

export const api = {
  config: () => req("/api/config"),
  list: (reveal) => req("/api/usecases", { reveal }),
  get: (id, reveal) => req(`/api/usecases/${id}`, { reveal }),
  create: (body) => req("/api/usecases", { method: "POST", body }),
  update: (id, body) => req(`/api/usecases/${id}`, { method: "PATCH", body }),
  remove: (id) => req(`/api/usecases/${id}`, { method: "DELETE" }),
  reanalyze: (id, unlock) => req(`/api/usecases/${id}/reanalyze`, { method: "POST", body: { unlock } }),
  addAsset: (id, data) => {
    if (data.file) {
      const f = new FormData();
      f.append("file", data.file);
      if (data.kind) f.append("kind", data.kind);
      if (data.title) f.append("title", data.title);
      return req(`/api/usecases/${id}/assets`, { method: "POST", form: f });
    }
    return req(`/api/usecases/${id}/assets`, { method: "POST", body: data });
  },
  removeAsset: (id, assetId) => req(`/api/usecases/${id}/assets/${assetId}`, { method: "DELETE" }),
  uploadLogo: (id, file) => { const f = new FormData(); f.append("file", file); return req(`/api/usecases/${id}/logo`, { method: "POST", form: f }); },
  stats: () => req("/api/stats"),
  graph: () => req("/api/graph"),
  ask: (question, lang, history) => req("/api/ask", { method: "POST", body: { question, lang, history } }),
  settings: (patch) => req("/api/settings", { method: "PUT", body: patch }),
};
