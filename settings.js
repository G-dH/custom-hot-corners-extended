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

const {GLib, Gio, Gdk} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

var Monitor = class Monitor {
    constructor(index, geometry, primary) {
        this.index = index;
        this.x = geometry.x;
        this.y = geometry.y;
        this.width = geometry.width;
        this.height = geometry.height;
        this.corners = this.createCorners();
    }

    destroy() {
        this.corners.forEach(c => c.destroy());
        this.corners = [];
    }

    createCorners() {
        let corners = [];
        for (let top of [true, false]) {
            for (let left of [true, false]) {
                let x = left ? this.x : this.x + this.width;
                let y = top ? this.y : this.y + this.height;
                let c = new Corner(this.index, top, left, x, y);
                corners.push(c);
            }
        }
        return corners;
    }

    /**
     * Return array of all active monitors. If there is a primary monitor
     * it will be the first in the array.
     */
    static all() {
        const display = Gdk.Display.get_default();
        const num_monitors = display.get_n_monitors();
        const primary_monitor = display.get_primary_monitor();

        const monitors = [];

        for (let i = 0; i < num_monitors; ++i) {
            let m = display.get_monitor(i);
            if (m === primary_monitor) {
                monitors.unshift(new Monitor(i, m.get_geometry(), true));
            } else {
                monitors.push(new Monitor(i, m.get_geometry(), false));
            }
        }

        return monitors;
    }
}

var Corner = class Corner {
    constructor(monitorIndex, top, left, x, y) {
        this.monitorIndex = monitorIndex;
        this.top = top;
        this.left = left;
        this.x = x;
        this.y = y;
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

    get action() {
        return this._gsettings.get_string('action');
    }

    set action(action) {
        this._gsettings.set_string('action', action);
    }

    get command() {
        return this._gsettings.get_string('command');
    }

    set command(command) {
        this._gsettings.set_string('command', command);
    }

    get fullscreen() {
        return this._gsettings.get_boolean('fullscreen');
    }

    set fullscreen(bool_val) {
        this._gsettings.set_boolean('fullscreen', bool_val);
    }

    _loadSettings() {
        let schema = 'org.gnome.shell.extensions.custom-hot-corners.corner';
        let v = this.top ? 'top' : 'bottom';
        let h = this.left ? 'left' : 'right';
        let path = '/org/gnome/shell/extensions/custom-hot-corners/';
        path += `monitor-${this.monitorIndex}-${v}-${h}/`;
        return getSettings(schema, path);
    }
}

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
