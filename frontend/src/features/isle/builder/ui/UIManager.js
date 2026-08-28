/**
 * UIManager.js
 *
 * Aggregates all DOM-driven UI subsystems and toast feedback.
 */

import { Toolbar } from './Toolbar.js';
import { AssetPalette } from './AssetPalette.js';
import { HUD } from './HUD.js';
import { SlotPanel } from './SlotPanel.js';
import { playUiClick } from './Audio.js';

export class UIManager {
    constructor(game, root = document) {
        this.game = game;
        this.root = root;
        this.toolbar = new Toolbar(root.getElementById('toolbar'), game);
        this.slotPanel = new SlotPanel(root.getElementById('slot-panel'), game);
        this.palette = new AssetPalette(
            root.getElementById('palette-tabs'),
            root.getElementById('palette-grid'),
            game,
        );
        this.hud = new HUD(game, root);
        this.toast = root.getElementById('toast');

        // The Controls cheatsheet is a native <details> disclosure: clicking
        // the summary toggles it. Wire the same UI click sound to that
        // toggle so it feels consistent with the toolbar / palette / HUD.
        const ins = root.getElementById('instructions');
        if (ins) {
            ins.addEventListener('toggle', () => playUiClick());
        }

        // Expose for sibling modules
        game.toolbar = this.toolbar;
        game.slotPanel = this.slotPanel;
        game.palette = this.palette;
        game.hud = this.hud;
    }

    update() {
        this.toolbar.update();
        this.slotPanel.update();
        this.palette.update();
    }

    showToast(text, ms = 1600) {
        this.toast.textContent = text;
        this.toast.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this.toast.classList.remove('show');
        }, ms);
    }
}
