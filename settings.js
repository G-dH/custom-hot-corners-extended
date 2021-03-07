/* Copyright 2020 Jan Runge <janrunx@gmail.com>
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

const {GLib, Gio} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var Triggers ={
    PRESSURE: 0,
    BUTTON_PRIMARY: 1,
    BUTTON_SECONDARY: 2,
    BUTTON_MIDDLE: 3,
    SCROLL_UP: 4,
    SCROLL_DOWN:5
}
Object.freeze(Triggers);

var TriggerLabels = [   
    'Pressure',
    'Primary Button',
    'Secondary Button',
    'Middle Button',
    'Scroll Up',
    'Scroll Down'
];

function listTriggers() {
    return Object.values(Triggers);
}

var MscOptions = class MscOptions {
    constructor() {
        this._gsettings = this._loadSettings();
        this._connectionIds = [];
    }

    connect(name, callback) {
        let id = this._gsettings.connect(name, callback);
        this._connectionIds.push(id);
        return id;
    }

    destroy() {
        this._connectionIds.forEach(id => this._gsettings.disconnect(id));
    }

    _loadSettings() {
        let schema = 'org.gnome.shell.extensions.custom-hot-corners.misc';
        let path = '/org/gnome/shell/extensions/custom-hot-corners/misc/';
        return getSettings(schema, path);
    }


    get scrollPanel() {
        return this._gsettings.get_boolean('panel-scroll');
    }

    set scrollPanel(bool_val) {
        this._gsettings.set_boolean('panel-scroll', bool_val);
    }

    get wsSwitchIgnoreLast() {
        return this._gsettings.get_boolean('ws-switch-ignore-last');
    }

    set wsSwitchIgnoreLast(bool_val) {
        this._gsettings.set_boolean('ws-switch-ignore-last', bool_val);
    }
    get wsSwitchWrap() {
        return this._gsettings.get_boolean('ws-switch-wrap');
    }

    set wsSwitchWrap(bool_val) {
        this._gsettings.set_boolean('ws-switch-wrap', bool_val);
    }
    get wsSwitchIndicator() {
        return this._gsettings.get_boolean('ws-switch-indicator');
    }

    set wsSwitchIndicator(bool_val) {
        this._gsettings.set_boolean('ws-switch-indicator', bool_val);
    }
    get scrollEventDelay() {
        return this._gsettings.get_int('scroll-event-delay');
    }

    set scrollEventDelay(delay) {
        this._gsettings.set_int('scroll-event-delay', delay);
    }
}

var Corner = class Corner {
    constructor(monitorIndex, top, left, x, y) {
        this._gsettings = {};
        this.monitorIndex = monitorIndex;
        this.top = top;
        this.left = left;
        this.x = x;
        this.y = y;
        this._gsettings = this._loadSettingsForTrigges();
        this._connectionIds = [];
    }

    static forMonitor(index, geometry) {
        let corners = [];
        for (let top of [true, false]) {
            for (let left of [true, false]) {
                let x = left ? geometry.x : geometry.x + geometry.width;
                let y = top ? geometry.y : geometry.y + geometry.height;
                let c = new Corner(index, top, left, x, y);
                corners.push(c);
            }
        }
        return corners;
    }

    connect(name, callback, trigger) {
        let id = this._gsettings[trigger].connect(name, callback);
        this._connectionIds.push([this._gsettings[trigger],id]);
        return id;
    }

    destroy() {
        this._connectionIds.forEach(id => id[0].disconnect(id[1]));
    }

    _loadSettingsForTrigges() {
        let gsettings = {};
        for (let trigger of listTriggers()) {
            gsettings[trigger]= this._loadSettings(trigger);
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
        return this._gsettings.get_boolean('fullscreen');
    }

    setFullscreen(trigger, bool_val) {
        this._gsettings.set_boolean('fullscreen', bool_val);
    }

    getWorkspaceIndex(trigger) {
        return this._gsettings[trigger].get_int('workspace-index');
    }

    setWorkspaceIndex(trigger, index) {
        this._gsettings[trigger].set_int('workspace-index', index);
    }

    get barrierSize() {
        return this._gsettings[Triggers.PRESSURE].get_int('barrier-size');
    }

    set barrierSize(size) {
        this._gsettings[Triggers.PRESSURE].set_int('barrier-size', size);
    }

    get pressureThreshold() {
        return this._gsettings[Triggers.PRESSURE].get_int('pressure-threshold');
    }

    set pressureThreshold(threshold) {
        this._gsettings[Triggers.PRESSURE].set_int('pressure-threshold', threshold);
    }

    _loadSettings(trigger) {
        let label = (TriggerLabels[trigger].replace(' ', '-')).toLowerCase();
        let schema = 'org.gnome.shell.extensions.custom-hot-corners.corner';
        let v = this.top ? 'top' : 'bottom';
        let h = this.left ? 'left' : 'right';
        let path = '/org/gnome/shell/extensions/custom-hot-corners/';
        path += `monitor-${this.monitorIndex}-${v}-${h}-${label}/`;
        return getSettings(schema, path);
    }
}

/**
 * Copied from Gnome Shells extensionUtils.js and adapted to allow
 * loading the setting with a specific path.
 */
function getSettings(schema, path) {
    let schemaDir = Me.dir.get_child('schemas');
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

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj) {
        throw new Error(
            'Schema' + schema + ' could not be found for extension ' +
            Me.metadata.uuid + '. Please check your installation.'
        );
    }

    let args = { settings_schema: schemaObj };
    if (path) {
        args.path = path;
    }

    return new Gio.Settings(args);
}
