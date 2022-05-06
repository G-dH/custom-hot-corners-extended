/* Custom Hot Corners - Extended
 * Copyright 2021-2022 GdH <G-dH@github.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

const {GLib, Gio}    = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();

const Utils          = Me.imports.src.common.utils;

const Config         = imports.misc.config;
var shellVersion     = parseFloat(Config.PACKAGE_VERSION);

var _                = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;

var actionList       = Me.imports.src.prefs.actionList.actionList;
var excludedItems    = Me.imports.src.prefs.actionList.excludedItems;

var Triggers = {
    PRESSURE:         0,
    BUTTON_PRIMARY:   1,
    BUTTON_SECONDARY: 2,
    BUTTON_MIDDLE:    3,
    SCROLL_UP:        4,
    SCROLL_DOWN:      5,
    CTRL_PRESSURE:    6
};

var TriggerLabels = [
    _('Hot Corner'),
    _('Primary Button'),
    _('Secondary Button'),
    _('Middle Button'),
    _('Scroll Up'),
    _('Scroll Down'),
    _('Ctrl + Hot Corner')
];

var TRANSITION_DURATION = 200;

var MONITOR_TITLE = _('Monitor');
//var MONITOR_ICON = 'preferences-desktop-display-symbolic';
var MONITOR_ICON = 'video-display-symbolic';
var KEYBOARD_TITLE = _('Keyboard');
var KEYBOARD_ICON = 'input-keyboard-symbolic';
var MENUS_TITLE = _('Custom Menus');
var MENUS_ICON = 'open-menu-symbolic';
var OPTIONS_TITLE = _('Options');
var OPTIONS_ICON = 'preferences-other-symbolic';

const colorAccents = ['red', 'bark', 'sage', 'olive', 'viridian', 'prussiangreen', 'blue', 'purple', 'magenta'];

var actionDict = {};
actionList.forEach(act => actionDict[act[1]] = {title: act[2], icon: act[4]});

const _schema = 'org.gnome.shell.extensions.custom-hot-corners-extended';
const _path = '/org/gnome/shell/extensions/custom-hot-corners-extended';

const winSwitcherPopup = Utils.extensionEnabled('advanced-alt-tab@G-dH.github.com-dev');

function listTriggers() {
    return Object.values(Triggers);
}

var MscOptions = class MscOptions {
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
            watchCorners:           {type: 'boolean', key: 'watch-corners'},
            cornersVisible:         {type: 'boolean', key: 'corners-visible'},
            winSwitchWrap:          {type: 'boolean', key: 'win-switch-wrap'},
            winSkipMinimized:       {type: 'boolean', key: 'win-switch-skip-minimized'},
            winStableSequence:      {type: 'boolean', key: 'win-switch-stable-sequence'},
            winThumbnailScale:      {type: 'int',     key: 'win-thumbnail-scale'},
            actionEventDelay:       {type: 'int',     key: 'action-event-delay'},
            rippleAnimation:        {type: 'boolean', key: 'ripple-animation'},
            barrierFallback:        {type: 'boolean', key: 'barrier-fallback'},
            customMenu1:            {type: 'strv',    key: 'custom-menu-1'},
            customMenu2:            {type: 'strv',    key: 'custom-menu-2'},
            customMenu3:            {type: 'strv',    key: 'custom-menu-3'},
            customMenu4:            {type: 'strv',    key: 'custom-menu-4'},
            supportedExetensions:   {type: 'strv',    key: 'supported-active-extensions'},
            keyboardShortcuts:      {type: 'strv',    key: 'keyboard-shortcuts'},
            internalFlags:          {type: 'strv',    key: 'internal-flags'},
            showOsdMonitorIndexes:  {type: 'boolean', key: 'show-osd-monitor-indexes'},
            customTintColor:        {type: 'string',  key: 'custom-tint-color'},
            hotCornersRequireShift: {type: 'boolean', key: 'hot-corners-require-shift'}
        }
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
};

var Corner = class Corner {
    constructor(loadIndex, monitorIndex, top, left, x, y) {
        this.monitorIndex = monitorIndex;
        this._loadIndex = loadIndex;
        this.top = top;
        this.left = left;
        this.x = x;
        this.y = y;
        this._gsettings = {};
        this._gsettings = this._loadSettingsForTrigges();
        this._connectionIds = [];
        this.hotCornerExists = false;
        this.fullExpandHorizontal = false;
        this.fullExpandVertical = false;

        this.action = {};
        this.ctrl = {};
        this.command = {};
        this.fullscreen = {};
        this.workspaceIndex = {};
        for (let trigger of listTriggers()) {
            this.action[trigger] = this.getAction(trigger);
            this.ctrl[trigger] = this.getCtrl(trigger);
            this.command[trigger] = this.getCommand(trigger);
            this.fullscreen[trigger] = this.getFullscreen(trigger);
            this.workspaceIndex[trigger] = this.getWorkspaceIndex(trigger);
        }
        //prepered for possible future use
        /*this.options = {
            action: ['string', 'action'],
            command: ['string', 'command'],
            fullscreen: ['boolean', 'fullscreen'],
            ctrl: ['boolean', 'ctrl'],
            workspaceIndex: ['int', 'workspace-index'],
            hExpand: ['boolean', 'h-expand'],
            vExpand: ['boolean', 'v-expand'],
            barrierSizeH: ['int', 'barrier-size-h'],
            barrierSizeV: ['int', 'barrier-size-v'],
            pressureThreshold: ['int', 'pressure-threshold'],
        }*/
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

    _loadSettingsForTrigges() {
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
                        this._writeTimeoutId = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            });
        }
        return gsettings;
    }

    getAction(trigger) {
        return this._gsettings[trigger].get_string('action');
    }

    setAction(trigger, action) {
        this._gsettings[trigger].set_string('action', action);
    }

    getCommand(trigger) {
        return this._gsettings[trigger].get_string('command');
    }

    setCommand(trigger, command) {
        this._gsettings[trigger].set_string('command', command);
    }

    getFullscreen(trigger) {
        return this._gsettings[trigger].get_boolean('fullscreen');
    }

    setFullscreen(trigger, bool_val) {
        this._gsettings[trigger].set_boolean('fullscreen', bool_val);
    }

    getWorkspaceIndex(trigger) {
        return this._gsettings[trigger].get_int('workspace-index');
    }

    setWorkspaceIndex(trigger, index) {
        this._gsettings[trigger].set_int('workspace-index', index);
    }

    getCtrl(trigger) {
        return this._gsettings[trigger].get_boolean('ctrl');
    }

    setCtrl(trigger, ctrl) {
        this._gsettings[trigger].set_boolean('ctrl', ctrl);
    }

    get hExpand() {
        return this._gsettings[Triggers.BUTTON_PRIMARY].get_boolean('h-expand');
    }

    set hExpand(bool_val) {
        this._gsettings[Triggers.BUTTON_PRIMARY].set_boolean('h-expand', bool_val);
    }

    get vExpand() {
        return this._gsettings[Triggers.BUTTON_PRIMARY].get_boolean('v-expand');
    }

    set vExpand(bool_val) {
        this._gsettings[Triggers.BUTTON_PRIMARY].set_boolean('v-expand', bool_val);
    }

    get barrierSizeH() {
        return this._gsettings[Triggers.PRESSURE].get_int('barrier-size-h');
    }

    set barrierSizeH(size) {
        this._gsettings[Triggers.PRESSURE].set_int('barrier-size-h', size);
    }

    get barrierSizeV() {
        return this._gsettings[Triggers.PRESSURE].get_int('barrier-size-v');
    }

    set barrierSizeV(size) {
        this._gsettings[Triggers.PRESSURE].set_int('barrier-size-v', size);
    }

    get pressureThreshold() {
        return this._gsettings[Triggers.PRESSURE].get_int('pressure-threshold');
    }

    set pressureThreshold(threshold) {
        this._gsettings[Triggers.PRESSURE].set_int('pressure-threshold', threshold);
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
function getSettings(schema, path) {
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
        //throw new Error(
        log(
            'Schema ' + schema + ' could not be found for extension ' +
            Me.metadata.uuid + '. Please check your installation.'
        );
        return null;
    }

    const args = {settings_schema: schemaObj};
    if (path) {
        args.path = path;
    }

    return new Gio.Settings(args);
};

