/**
 * Custom Hot Corners - Extended
 * panelButton.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021 - 2024
 * @license    GPL-3.0
 */
'use strict';

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as Actions from './actions.js';

const PANEL_ICON_SIZE = 16;

let _;
let Me;

export function init(extension) {
    Me = extension;
    _ = extension.gettext.bind(Me);
}

export function cleanGlobals() {
    _ = null;
    Me = null;
}

export const MenuButton = GObject.registerClass({ GTypeName: 'CHCEMenuButton' }, class MenuButton extends PanelMenu.Button {
    _init(mscOptions) {
        super._init(0.5, 'CHCE-Menu', false);

        this._actions = null;
        this._mscOptions = mscOptions;

        const bin = new St.BoxLayout();
        this.add_child(bin);
        this._panelBin = bin;

        this._menuItems = [];

        const disableItem = new PopupMenu.PopupMenuItem(_('Disable all triggers'), false);
        disableItem.connect('activate', this._toggleDisable.bind(this));
        this._menuItems.push(disableItem);

        const shiftItem = new PopupMenu.PopupMenuItem(_('Hot corner triggers require Shift key'), false);
        shiftItem.connect('activate', this._toggleRequireShift.bind(this));
        this._menuItems.push(shiftItem);

        const resetItem = new PopupMenu.PopupMenuItem(_('Update all triggers'), false);
        resetItem.connect('activate', this._reset.bind(this));
        this._menuItems.push(resetItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const openPrefs = new PopupMenu.PopupMenuItem(_('Settings'), false);
        openPrefs.connect('activate', this._openPrefs.bind(this));
        this._menuItems.push(openPrefs);

        this.menu.addMenuItem(disableItem);
        this.menu.addMenuItem(shiftItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(resetItem);
        this.menu.addMenuItem(openPrefs);

        this._disableItem = disableItem;
        this._shiftItem = shiftItem;

        this._updatePanelIcon();
        this._update();

        this.connect('destroy', () => {

        });
    }

    _updatePanelIcon() {
        if (this._icon) {
            this._panelBin.remove_child(this._icon);
            this._icon.destroy();
            this._icon = null;
        }

        let iconPath = this._hotCornersEnabled
            ? `${Me.path}/hot-corners-symbolic.svg`
            : `${Me.path}/hot-corners-disabled-symbolic.svg`;
        iconPath = this._hotCornersEnabled && this._hotCornersRequireShift
            ? `${Me.path}/hot-corners-shift-symbolic.svg`
            : iconPath;
        const gicon = Gio.icon_new_for_string(iconPath);
        const icon = new St.Icon({ gicon, icon_size: PANEL_ICON_SIZE + 2 });

        this._panelBin.add_child(icon);
        this._icon = icon;
    }

    _getActions() {
        if (!this._actions)
            this._actions = new Actions.Actions();


        return this._actions;
    }

    _update() {
        this._hotCornersRequireShift = this._mscOptions.get('hotCornersRequireShift', true);
        this._hotCornersEnabled = this._mscOptions.get('hotCornersEnabled', true);
        this._disableItem.setOrnament(this._hotCornersEnabled ? PopupMenu.Ornament.NONE : PopupMenu.Ornament.CHECK);
        this._shiftItem.setOrnament(this._hotCornersRequireShift ? PopupMenu.Ornament.CHECK : PopupMenu.Ornament.NONE);
        this._updatePanelIcon();
    }

    _toggleRequireShift() {
        const key = 'hotCornersRequireShift';
        const state = this._hotCornersRequireShift;
        this._mscOptions.set(key, !state);
        this._update();
    }

    _toggleDisable() {
        const key = 'hotCornersEnabled';
        const state = this._hotCornersEnabled;
        this._mscOptions.set(key, !state);
        this._update();
        Main.layoutManager._updateHotCorners();
    }

    _reset() {
        Main.layoutManager._updateHotCorners();
        Main.notify(Me.metadata.name, _('Hot corners were re-created.'));
    }

    _openPrefs() {
        this._getActions().openPreferences();
    }
});
