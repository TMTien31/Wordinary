import { SaveSystem } from '../storage/SaveSystem.js';
import { playUiClick } from './Audio.js';

export class SlotPanel {
    constructor(rootEl, game) {
        this.root = rootEl;
        this.game = game;
        this.select = rootEl.querySelector('#slot-select');
        this.newButton = rootEl.querySelector('#slot-new');
        this.deleteButton = rootEl.querySelector('#slot-delete');
        this.screenshotButton = rootEl.querySelector('#slot-screenshot');
        this._bind();
        this.update();
    }

    _bind() {
        this.select?.addEventListener('change', () => {
            playUiClick();
            if (this.select.value) this.game.loadSlot(this.select.value);
        });
        this.newButton?.addEventListener('click', async () => {
            playUiClick();
            const name = await window.appPrompt({
                title: 'New island slot',
                message: 'Give this version of your Isle a short name.',
                defaultValue: 'New Island',
                confirmLabel: 'Create slot',
                cancelLabel: 'Cancel',
                icon: '+',
            });
            if (name == null) return;
            this.game.createSlot(name);
        });
        this.deleteButton?.addEventListener('click', async () => {
            playUiClick();
            const slot = SaveSystem.listSlots().find(item => item.id === SaveSystem.activeSlotId());
            if (!slot) return;
            const ok = await window.appConfirm({
                title: 'Delete save slot?',
                message: `"${slot.name}" will be removed from this browser.`,
                confirmLabel: 'Delete',
                cancelLabel: 'Cancel',
                icon: '-',
                danger: true,
            });
            if (!ok) return;
            this.game.deleteCurrentSlot();
        });
        this.screenshotButton?.addEventListener('click', () => {
            playUiClick();
            this.game.downloadScreenshot();
        });
    }

    update() {
        if (!this.select) return;
        const slots = SaveSystem.listSlots();
        const activeId = SaveSystem.activeSlotId();
        this.select.innerHTML = '';
        for (const slot of slots) {
            const option = document.createElement('option');
            option.value = slot.id;
            option.textContent = `${slot.name}${slot.hasSave ? '' : ' (empty)'}`;
            option.selected = slot.id === activeId;
            this.select.appendChild(option);
        }
        if (this.deleteButton) this.deleteButton.disabled = slots.length <= 1;
    }
}
