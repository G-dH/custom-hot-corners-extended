/**
 * Custom Hot Corners - Extended
 * Utils
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2022
 * @license    GPL-3.0
 */

'use strict';

let Me;

import Gtk from 'gi://Gtk';

export function init(extension) {
    Me = extension;
}

export function cleanGlobals() {
    Me = null;
}


export function _newImageFromIconName(name) {
    return Gtk.Image.new_from_icon_name(name);
}

export function _setImageFromIconName(widget, name) {
    widget.set_from_icon_name(name);
}

export function _setBtnFromIconName(btnWidget, iconName, size) {
    if (btnWidget.set_icon_name)
        btnWidget.set_icon_name(iconName);
    else
        btnWidget.add(Gtk.Image.new_from_icon_name(iconName, size));
}

// this module must be compatible with prefs, so Main.extensionManager is not usable
// This function is only needed when prefs window is opened while extension is disabled
export function extensionEnabled(uuid = Me.metadata.uuid) {
    const settings = Me.getSettings('org.gnome.shell');

    let enabled = false;
    settings.get_strv('enabled-extensions').forEach(e => {
        if (e.includes(uuid))
            enabled = true;
    });
    /* let disabled = false;
    settings.get_strv('disabled-extensions').forEach(e => {
        if (e.includes(uuid))
            disabled = true;
    });*/
    let disableUser = settings.get_boolean('disable-user-extensions');
    return enabled/* && !disabled*/ && !disableUser;
}

export function isSupportedExtensionDetected(extensionName) {
    return Me.getSettings('org.gnome.shell.extensions.custom-hot-corners-extended.misc').get_strv('supported-active-extensions').includes(extensionName);
}

export function bold(label) {
    return `<b>${label}</b>`;
}

export function getIconPath() {
    const colorAccents = ['red', 'bark', 'sage', 'olive', 'viridian', 'prussiangreen', 'blue', 'purple', 'magenta'];
    const theme = Me.getSettings('org.gnome.desktop.interface').get_string('gtk-theme');
    const themeSplit = theme.split('-');
    let accent = 'blue';
    if (themeSplit.length > 1 && themeSplit[0] === 'Yaru') {
        accent = themeSplit[1];
        if (colorAccents.indexOf(accent) < 0)
            accent = 'orange';
    } else if (themeSplit[0] === 'Yaru') {
        accent = 'orange';
    } else if (themeSplit[0] === 'Pop') {
        accent = 'prussiangreen';
    }

    // return `${Me.dir.get_path()}/resources/icons/${accent}`;
    return `/icons/${accent}`;

    /* using set_from_icon_name is slow compared to set_from_file or set_from_resource
    const iconTheme = Gtk.IconTheme.get_for_display
        ? Gtk.IconTheme.get_for_display(Gdk.Display.get_default())
        : Gtk.IconTheme.get_for_screen(Gdk.Screen.get_default());
    iconTheme.add_search_path
        ? iconTheme.add_search_path(GLib.build_filenamev([Me.path, `resources/icons/${accent}`]))
        : iconTheme.append_search_path(GLib.build_filenamev([Me.path, `resources/icons/${accent}`]));*/
}
