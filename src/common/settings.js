/**
 * Custom Hot Corners - Extended
 * Settings
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as ActionList from '../prefs/actionList.js';

export const Triggers = {
    PRESSURE:         0,
    BUTTON_PRIMARY:   1,
    BUTTON_SECONDARY: 2,
    BUTTON_MIDDLE:    3,
    SCROLL_UP:        4,
    SCROLL_DOWN:      5,
    CTRL_PRESSURE:    6,
};

export function listTriggers() {
    return Object.values(Triggers);
}

export const TRANSITION_TIME = 200;

export const colorAccents = ['red', 'bark', 'sage', 'olive', 'viridian', 'prussiangreen', 'blue', 'purple', 'magenta'];

export let actionList;
export let excludedItems;
export let actionDict;

export const _schema = 'org.gnome.shell.extensions.custom-hot-corners-extended';
export const _path = '/org/gnome/shell/extensions/custom-hot-corners-extended';

// const winSwitcherPopup = Utils.extensionEnabled('advanced-alt-tab');

let Me;

export function init(extension) {
    Me = extension;
    actionDict = {};
    actionList = ActionList.actionList;
    excludedItems  = ActionList.excludedItems;
    actionList.forEach(act => {
        actionDict[act[1]] = { title: act[2], icon: act[4] };
    });
}

export function cleanGlobals() {
    Me = null;
}

export const MscOptions = class {
    constructor() {
        this._gsettings = this._loadSettings('misc');
        this._gsettings.delay();
        this._writeTimeoutId = 0;
        this._gsettings.connect('changed', () => {
            if (this._writeTimeoutId)
                GLib.Source.remove(this._writeTimeoutId);

            this._writeTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                300,
                () => {
                    this._gsettings.apply();
                    this._writeTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );
        });

        this._connectionIds = [];

        this.options = {
            enablePanelMenu:        { type: 'boolean', key: 'panel-menu-enable' },
            buttonsTriggerOnPress:  { type: 'boolean', key: 'buttons-trigger-on-press' },
            watchCorners:           { type: 'boolean', key: 'watch-corners' },
            cornersVisible:         { type: 'boolean', key: 'corners-visible' },
            winSwitchWrap:          { type: 'boolean', key: 'win-switch-wrap' },
            winSkipMinimized:       { type: 'boolean', key: 'win-switch-skip-minimized' },
            winStableSequence:      { type: 'boolean', key: 'win-switch-stable-sequence' },
            actionEventDelay:       { type: 'int',     key: 'action-event-delay' },
            rippleAnimation:        { type: 'boolean', key: 'ripple-animation' },
            barrierFallback:        { type: 'boolean', key: 'barrier-fallback' },
            customMenu1:            { type: 'strv',    key: 'custom-menu-1' },
            customMenu2:            { type: 'strv',    key: 'custom-menu-2' },
            customMenu3:            { type: 'strv',    key: 'custom-menu-3' },
            customMenu4:            { type: 'strv',    key: 'custom-menu-4' },
            supportedExtensions:    { type: 'strv',    key: 'supported-active-extensions' },
            keyboardShortcuts:      { type: 'strv',    key: 'keyboard-shortcuts' },
            internalFlags:          { type: 'strv',    key: 'internal-flags' },
            showOsdMonitorIndexes:  { type: 'boolean', key: 'show-osd-monitor-indexes' },
            customTintColor:        { type: 'string',  key: 'custom-tint-color' },
            hotCornersRequireShift: { type: 'boolean', key: 'hot-corners-require-shift' },
            hotCornersEnabled:      { type: 'boolean', key: 'hot-corners-enabled' },
        };
    }

    connect(name, callback) {
        const id = this._gsettings.connect(name, callback);
        this._connectionIds.push(id);
        return id;
    }

    destroy() {
        this._connectionIds.forEach(id => this._gsettings.disconnect(id));
        if (this._writeTimeoutId) {
            GLib.source_remove(this._writeTimeoutId);
            this._writeTimeoutId = 0;
        }
    }

    _loadSettings(schm) {
        const schema = `${_schema}.${schm}`;
        const path = `${_path}/${schm}/`;
        return getSettings(schema, path);
    }

    get(option) {
        const key = this.options[option].key;
        return this._gsettings.get_value(key).deep_unpack();
    }

    set(option, value) {
        const type = this.options[option].type;
        const key = this.options[option].key;

        switch (type) {
        case 'string':
            this._gsettings.set_string(key, value);
            break;
        case 'int':
            this._gsettings.set_int(key, value);
            break;
        case 'boolean':
            this._gsettings.set_boolean(key, value);
            break;
        case 'strv':
            this._gsettings.set_strv(key, value);
            break;
        }
    }

    getDefault(option) {
        const key = this.options[option].key;
        return this._gsettings.get_default_value(key).deep_unpack();
    }

    resetAll() {
        const settings = this._gsettings;
        settings.list_keys().forEach(key => {
            settings.reset(key);
        });
    }
};

export function resetAllCorners() {
    // since we can't find all created monitor directories in gsettings without using dconf,
    // we assume that max monitor count of 6 is enough for all users
    for (const monitor of [0, 1, 2, 3, 4, 5]) {
        for (const corner of ['top-left', 'top-right', 'bottom-left', 'bottom-right'])
            resetCorner(monitor, corner);
    }
}

export function resetCorner(monitorIndex, corner) {
    const schema = `${_schema}.corner`;
    for (const trigger of [0, 1, 2, 3, 4, 5, 6]) {
        const path = `${_path}/monitor-${monitorIndex}-${corner}-${trigger}/`;
        const settings = getSettings(schema, path);
        if (settings) {
            settings.list_keys().forEach(key => {
                settings.reset(key);
            });
            // ctrlBtn for the secondary hot corner action must be always checked
            if (trigger === 6)
                settings.set_boolean('ctrl', true);
        }
    }
}

export const Corner = class Corner {
    constructor(loadIndex, monitorIndex, top, left, x, y) {
        this.monitorIndex = monitorIndex;
        this._loadIndex = loadIndex;
        this.top = top;
        this.left = left;
        this.x = x;
        this.y = y;
        this._gsettings = this._loadSettingsForTriggers();
        this._connectionIds = [];
        this.hotCornerExists = false;
        this.fullExpandHorizontal = false;
        this.fullExpandVertical = false;

        this.action = {};
        this.ctrl = {};
        this.command = {};
        this.fullscreen = {};
        this.workspaceIndex = {};

        this.options = {
            action: ['string', 'action'],
            command: ['string', 'command'],
            fullscreen: ['boolean', 'fullscreen'],
            ctrl: ['boolean', 'ctrl'],
            workspaceIndex: ['int', 'workspace-index'],
            hExpand: ['boolean', 'h-expand', Triggers.BUTTON_PRIMARY],
            vExpand: ['boolean', 'v-expand', Triggers.BUTTON_PRIMARY],
            barrierSizeH: ['int', 'barrier-size-h', Triggers.PRESSURE],
            barrierSizeV: ['int', 'barrier-size-v', Triggers.PRESSURE],
            pressureThreshold: ['int', 'pressure-threshold', Triggers.PRESSURE],
        };

        this.cachedOptions = {};
        for (let trigger of listTriggers())
            this.cachedOptions[trigger] = {};
    }

    _updateCachedSettings(trigger) {
        Object.keys(this.options).forEach(v => this.get(v, trigger, true));
    }

    get(option, trigger, updateCache = false) {
        if (updateCache || this.cachedOptions[option] === undefined) {
            const [, key, defaultTrigger] = this.options[option];
            if (trigger === undefined && defaultTrigger !== undefined)
                trigger = defaultTrigger;


            let gSettings = this._gsettings[trigger];

            this.cachedOptions[trigger][option] = gSettings.get_value(key).deep_unpack();
        }

        return this.cachedOptions[trigger][option];
    }

    set(option, value, trigger) {
        const [format, key, defaultTrigger] = this.options[option];
        if (trigger === undefined && defaultTrigger !== undefined)
            trigger = defaultTrigger;

        switch (format) {
        case 'string':
            this._gsettings[trigger].set_string(key, value);
            break;
        case 'int':
            this._gsettings[trigger].set_int(key, value);
            break;
        case 'boolean':
            this._gsettings[trigger].set_boolean(key, value);
            break;
        }
    }

    getDefault(option, trigger) {
        const [, key, defaultTrigger] = this.options[option];
        if (trigger === undefined && defaultTrigger !== undefined)
            trigger = defaultTrigger;

        return this._gsettings[trigger].get_default_value(key).deep_unpack();
    }

    static forMonitor(loadIndex, index, geometry) {
        let corners = [];
        for (let top of [true, false]) {
            for (let left of [true, false]) {
                let x = left ? geometry.x : geometry.x + geometry.width - 1;
                let y = top ? geometry.y : geometry.y + geometry.height - 1;
                let c = new Corner(loadIndex, index, top, left, x, y);
                corners.push(c);
            }
        }
        return corners;
    }

    connect(name, callback, trigger) {
        const id = this._gsettings[trigger].connect(name, callback);
        this._connectionIds.push([this._gsettings[trigger], id]);
        return id;
    }

    destroy() {
        this._connectionIds.forEach(id => id[0].disconnect(id[1]));
        if (this._writeTimeoutId) {
            GLib.source_remove(this._writeTimeoutId);
            this._writeTimeoutId = 0;
        }
    }

    _loadSettingsForTriggers() {
        let gsettings = {};
        this._writeTimeoutId = 0;

        for (let trigger of listTriggers()) {
            gsettings[trigger] = this._loadSettings(trigger);

            // delay write to backend to avoid excessive disk writes when adjusting scales and spinbuttons
            gsettings[trigger].delay();
            gsettings[trigger].connect('changed', () => {
                if (this._writeTimeoutId)
                    GLib.Source.remove(this._writeTimeoutId);

                this._writeTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    300,
                    () => {
                        gsettings[trigger].apply();
                        this._updateCachedSettings(trigger);
                        this._writeTimeoutId = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            });
        }
        return gsettings;
    }

    _loadSettings(trigger) {
        const schema = `${_schema}.corner`;
        const v = this.top ? 'top' : 'bottom';
        const h = this.left ? 'left' : 'right';
        let path = `${_path}/`;
        path += `monitor-${this._loadIndex}-${v}-${h}-${trigger}/`;
        return getSettings(schema, path);
    }
};

/**
 * Copied from Gnome Shells extensionUtils.js and adapted to allow
 * loading the setting with a specific path.
 */
export function getSettings(schema, path) {
    const schemaDir = Me.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir.get_path(),
            Gio.SettingsSchemaSource.get_default(),
            false
        );
    } else {
        schemaSource = Gio.SettingsSchemaSource.get_default();
    }

    const schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj) {
        // throw new Error(
        log(
            `Schema ${schema} could not be found for extension ${
                Me.metadata.uuid}. Please check your installation.`
        );
        return null;
    }

    const args = { settings_schema: schemaObj };
    if (path)
        args.path = path;


    return new Gio.Settings(args);
}
