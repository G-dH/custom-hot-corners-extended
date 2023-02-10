/**
 * Custom Hot Corners - Extended
 * panelButton.js
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021 - 2023
 * @license    GPL-3.0
 */
'use strict';

const { Gio, GLib, GObject, St, Clutter } = imports.gi;

const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const PANEL_ICON_SIZE = imports.ui.panel.PANEL_ICON_SIZE + 2;

const ExtensionSystem = imports.ui.extensionSystem;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Actions = Me.imports.src.extension.actions;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

var MenuButton = GObject.registerClass ({
    GTypeName: 'CHCEMenuButton',}, class MenuButton extends PanelMenu.Button {
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

        const resetItem = new PopupMenu.PopupMenuItem(_('Reset all triggers'), false);
        resetItem.connect('activate', this._reset.bind(this));
        this._menuItems.push(resetItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const openPrefs = new PopupMenu.PopupMenuItem(_('Settings'), false);
        openPrefs.connect('activate', this._openPrefs.bind(this));
        this._menuItems.push(openPrefs);

        this.menu.addMenuItem(disableItem);
        this.menu.addMenuItem(shiftItem);
        this.menu.addMenuItem(resetItem);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(openPrefs);

        this._disableItem = disableItem;
        this._shiftItem = shiftItem;

        this._updatePanelIcon();
        this._update();

        this.connect('destroy', ()=> {

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
        const icon = new St.Icon({ gicon, icon_size: PANEL_ICON_SIZE });

        this._panelBin.add_child(icon);
        this._icon = icon;
    }

    _getActions() {
        if (!this._actions) {
            this._actions = new Actions.Actions();
        }

        return this._actions;
    }

    _update() {
        this._hotCornersRequireShift = this._mscOptions.get('hotCornersRequireShift', true);
        this._hotCornersEnabled = this._mscOptions.get('hotCornersEnabled', true);
        this._disableItem.setOrnament(!this._hotCornersEnabled);
        this._shiftItem.setOrnament(this._hotCornersRequireShift);
        this._updatePanelIcon();
    }

    _toggleRequireShift(item) {
        const key = 'hotCornersRequireShift';
        const state = this._hotCornersRequireShift;
        this._mscOptions.set(key, !state);
        this._update();
        Main.notify(Me.metadata.name, _(`Option 'Hot Corners Require Shift' ${state ? 'disabled' : 'enabled'}`));
    }

    _toggleDisable(item) {
        const key = 'hotCornersEnabled';
        const state = this._hotCornersEnabled;
        this._mscOptions.set(key, !state);
        this._update();
        Main.layoutManager._updateHotCorners();
        Main.notify(Me.metadata.name, _(`All triggers ${state ? 'disabled' : 'enabled'}`));
    }

    _reset(item) {
        Main.layoutManager._updateHotCorners();
        Main.notify(Me.metadata.name, _('Hot corners were re-created.'));
    }

    _openPrefs(item) {
        this._getActions().openPreferences();
    }
});
