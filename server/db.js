// Tiny durable JSON store. Writes are atomic (tmp file + rename) and serialized,
// so the data survives restarts and crashes. Point DATA_DIR at a persistent disk in production.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const empty = () => ({
  version: 1,
  settings: { hideCustomers: false, brandTitle: "Use Case Universe" },
  useCases: [],
  activity: [],
});

let state = empty();
try {
  if (fs.existsSync(DB_FILE)) state = { ...empty(), ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) };
} catch (e) {
  console.error("Could not read db.json, keeping a backup and starting fresh:", e.message);
  fs.copyFileSync(DB_FILE, DB_FILE + ".corrupt-" + Date.now());
}

let writing = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(state, null, 2);
  writing = writing.then(async () => {
    const tmp = DB_FILE + ".tmp";
    await fs.promises.writeFile(tmp, snapshot);
    await fs.promises.rename(tmp, DB_FILE);
  }).catch((e) => console.error("persist failed", e));
  return writing;
}

export const newId = () => crypto.randomBytes(6).toString("hex");

export const db = {
  get settings() { return state.settings; },
  updateSettings(patch) { state.settings = { ...state.settings, ...patch }; persist(); return state.settings; },

  list() { return state.useCases; },
  get(id) { return state.useCases.find((u) => u.id === id); },
  insert(uc) { state.useCases.unshift(uc); persist(); return uc; },
  update(id, patch) {
    const uc = this.get(id);
    if (!uc) return null;
    Object.assign(uc, typeof patch === "function" ? patch(uc) || {} : patch, { updatedAt: new Date().toISOString() });
    persist();
    return uc;
  },
  remove(id) {
    const i = state.useCases.findIndex((u) => u.id === id);
    if (i < 0) return false;
    state.useCases.splice(i, 1);
    persist();
    return true;
  },

  log(event) {
    state.activity.unshift({ id: newId(), at: new Date().toISOString(), ...event });
    state.activity = state.activity.slice(0, 300);
    persist();
  },
  get activity() { return state.activity; },
  flush: () => writing,
};
