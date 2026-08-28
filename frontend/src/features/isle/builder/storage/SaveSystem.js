/**
 * SaveSystem.js
 *
 * Persistence using localStorage. Saves the tilemap (terrain + objects)
 * along with camera state for a smoother return-to-game experience.
 */

import { CONFIG } from '../config.js';
import { PlacedObject } from '../building/PlacedObject.js';

const KEY = CONFIG.storageKey;
const DEFAULT_SLOT_ID = 'main';
const DEFAULT_SLOT_NAME = 'Main Island';

function now() {
    return Date.now();
}

function makePayload(tileMap, camera) {
    return {
        v: 1,
        tileMap: tileMap.serialize(),
        camera: {
            offsetX: camera.offsetX,
            offsetY: camera.offsetY,
            zoom: camera.zoom,
        },
    };
}

function applyPayload(payload, tileMap, camera) {
    if (!payload?.tileMap) return false;
    tileMap.deserialize(payload.tileMap, d => new PlacedObject(d));
    if (payload.camera) {
        camera.offsetX = payload.camera.offsetX;
        camera.offsetY = payload.camera.offsetY;
        camera.zoom    = payload.camera.zoom;
    }
    return true;
}

function baseStore(payload = null) {
    const stamp = now();
    return {
        v: 2,
        activeSlotId: DEFAULT_SLOT_ID,
        slots: [{
            id: DEFAULT_SLOT_ID,
            name: DEFAULT_SLOT_NAME,
            createdAt: stamp,
            updatedAt: payload ? stamp : null,
            payload,
        }],
    };
}

function readLegacyPayload() {
    try {
        const raw = localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function readStore() {
    try {
        const raw = localStorage.getItem(`${KEY}.slots`);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed?.v === 2 && Array.isArray(parsed.slots) && parsed.slots.length) {
            return normalizeStore(parsed);
        }
    } catch (e) {
        console.error('Slot load failed:', e);
    }
    return baseStore(readLegacyPayload());
}

function normalizeStore(store) {
    const slots = store.slots
        .filter(slot => slot?.id)
        .map(slot => ({
            id: String(slot.id),
            name: String(slot.name || 'Island Slot'),
            createdAt: Number(slot.createdAt) || now(),
            updatedAt: slot.updatedAt == null ? null : Number(slot.updatedAt) || null,
            payload: slot.payload ?? null,
        }));
    const safeSlots = slots.length ? slots : baseStore().slots;
    const activeSlotId = safeSlots.some(slot => slot.id === store.activeSlotId)
        ? store.activeSlotId
        : safeSlots[0].id;
    return { v: 2, activeSlotId, slots: safeSlots };
}

function writeStore(store) {
    localStorage.setItem(`${KEY}.slots`, JSON.stringify(normalizeStore(store)));
}

function uniqueSlotId(store) {
    let id = `slot-${Date.now().toString(36)}`;
    let i = 1;
    while (store.slots.some(slot => slot.id === id)) {
        id = `slot-${Date.now().toString(36)}-${i++}`;
    }
    return id;
}

export const SaveSystem = {
    save(tileMap, camera, slotId = this.activeSlotId()) {
        const payload = makePayload(tileMap, camera);
        try {
            const store = readStore();
            const targetId = slotId || store.activeSlotId || DEFAULT_SLOT_ID;
            let slot = store.slots.find(item => item.id === targetId);
            if (!slot) {
                slot = {
                    id: targetId,
                    name: DEFAULT_SLOT_NAME,
                    createdAt: now(),
                    updatedAt: null,
                    payload: null,
                };
                store.slots.push(slot);
            }
            slot.payload = payload;
            slot.updatedAt = now();
            store.activeSlotId = slot.id;
            writeStore(store);
            localStorage.setItem(KEY, JSON.stringify(payload));
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            return false;
        }
    },

    load(tileMap, camera, slotId = this.activeSlotId()) {
        try {
            const store = readStore();
            const targetId = slotId || store.activeSlotId || DEFAULT_SLOT_ID;
            const slot = store.slots.find(item => item.id === targetId);
            if (!slot?.payload) return false;
            store.activeSlotId = slot.id;
            writeStore(store);
            return applyPayload(slot.payload, tileMap, camera);
        } catch (e) {
            console.error('Load failed:', e);
            return false;
        }
    },

    clear(slotId = this.activeSlotId()) {
        try {
            const store = readStore();
            const slot = store.slots.find(item => item.id === slotId);
            if (slot) {
                slot.payload = null;
                slot.updatedAt = null;
                writeStore(store);
            }
            if (slotId === DEFAULT_SLOT_ID) localStorage.removeItem(KEY);
        } catch {}
    },

    listSlots() {
        return readStore().slots.map(slot => ({
            id: slot.id,
            name: slot.name,
            createdAt: slot.createdAt,
            updatedAt: slot.updatedAt,
            hasSave: !!slot.payload,
        }));
    },

    activeSlotId() {
        return readStore().activeSlotId || DEFAULT_SLOT_ID;
    },

    setActiveSlot(slotId) {
        const store = readStore();
        if (!store.slots.some(slot => slot.id === slotId)) return false;
        store.activeSlotId = slotId;
        writeStore(store);
        return true;
    },

    createSlot(name = 'New Island') {
        const store = readStore();
        const stamp = now();
        const slot = {
            id: uniqueSlotId(store),
            name: String(name || 'New Island').trim().slice(0, 40) || 'New Island',
            createdAt: stamp,
            updatedAt: null,
            payload: null,
        };
        store.slots.push(slot);
        store.activeSlotId = slot.id;
        writeStore(store);
        return slot;
    },

    deleteSlot(slotId) {
        const store = readStore();
        if (store.slots.length <= 1) return false;
        const nextSlots = store.slots.filter(slot => slot.id !== slotId);
        if (nextSlots.length === store.slots.length) return false;
        store.slots = nextSlots;
        if (store.activeSlotId === slotId) store.activeSlotId = nextSlots[0].id;
        writeStore(store);
        return true;
    },
};
