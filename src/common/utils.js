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

const { Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils
const Me             = ExtensionUtils.getCurrentExtension();

const Config         = imports.misc.config;
const shellVersion   = parseFloat(Config.PACKAGE_VERSION);


// conversion of Gtk3 / Gtk4 widgets add methods
var append = shellVersion < 40 ? 'add' : 'append';
var set_child = shellVersion < 40 ? 'add' : 'set_child';

function _newImageFromIconName(name, size = null) {
    const args = shellVersion >= 40 ? [name] : [name, size];
    return Gtk.Image.new_from_icon_name(...args);
}

function _setImageFromIconName(widget, name, size = null) {
    const args = shellVersion >= 40 ? [name] : [name, size];
    widget.set_from_icon_name(...args);
}

function _setBtnFromIconName(btnWidget, iconName, size) {
    if (btnWidget.set_icon_name) {
        btnWidget.set_icon_name(iconName);
    } else {
        btnWidget.add(Gtk.Image.new_from_icon_name(iconName, size));
    }
}

function extensionEnabled(uuid = null) {
    const settings = ExtensionUtils.getSettings( 'org.gnome.shell');

    uuid = uuid ? uuid : Me.metadata.uuid;

    let enabled = settings.get_strv('enabled-extensions');
    enabled = enabled.includes(uuid);
    let disabled = settings.get_strv('disabled-extensions');
    disabled = disabled.includes(uuid);
    let disableUser = settings.get_boolean('disable-user-extensions');
    if(enabled && !disabled && !disableUser)
        return true;
    return false;
}

function isSupportedExtensionDetected(extensionName) {
    return ExtensionUtils.getSettings('org.gnome.shell.extensions.custom-hot-corners-extended.misc').get_strv('supported-active-extensions').includes(extensionName);
}

function bold(label) {
    return `<b>${label}</b>`;
}

function getIconPath() {
    const colorAccents = ['red', 'bark', 'sage', 'olive', 'viridian', 'prussiangreen', 'blue', 'purple', 'magenta'];
    const theme = this._interfaceSettings = ExtensionUtils.getSettings('org.gnome.desktop.interface').get_string('gtk-theme');
    const themeSplit = theme.split('-');
    let accent = 'blue';
    if (themeSplit.length > 1 && themeSplit[0] === 'Yaru') {
        accent = themeSplit[1];
        if (colorAccents.indexOf(accent) < 0) {
            accent = 'orange';
        }
    } else if (themeSplit[0] === 'Yaru') {
        accent = 'orange';
    } else if (themeSplit[0] === 'Pop') {
        accent = 'prussiangreen';
    }

    //return `${Me.dir.get_path()}/resources/icons/${accent}`;
    return `/icons/${accent}`;

    /* using set_from_icon_name is slow compared to set_from_file or set_from_resource
    const iconTheme = Gtk.IconTheme.get_for_display
                        ? Gtk.IconTheme.get_for_display(Gdk.Display.get_default())
                        : Gtk.IconTheme.get_for_screen(Gdk.Screen.get_default());
    iconTheme.add_search_path
                        ? iconTheme.add_search_path(GLib.build_filenamev([Me.path, `resources/icons/${accent}`]))
                        : iconTheme.append_search_path(GLib.build_filenamev([Me.path, `resources/icons/${accent}`]));*/
}