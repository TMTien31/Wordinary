const createMemoryStorage = () => {
  const data = new Map();
  return { getItem: key => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), clear: () => data.clear(), key: index => [...data.keys()][index] || null, get length() { return data.size; } };
};
const safeBrowserStorage = name => {
  try {
    const storage = window[name];
    const testKey = `__lingoleaf_${name}_test__`;
    storage.setItem(testKey, "1"); storage.removeItem(testKey);
    return storage;
  } catch (_) { return createMemoryStorage(); }
};
const appStorage = safeBrowserStorage("localStorage");
const appSessionStorage = safeBrowserStorage("sessionStorage");
