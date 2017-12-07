/* Copyright 2017 Jan Runge <janrunx@gmail.com>
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

const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const Lang = imports.lang;
const Gettext = imports.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

Gettext.textdomain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

let _actions = [];

function init() {
    Convenience.initTranslations();
    _actions = _actions.concat([
        ['disabled', _("-")],
        ['toggleOverview', _("Toggle overview")],
        ['runCommand', _("Run command")]
    ]);
}

function buildPrefsWidget() {
    let widget = new PrefsWidget();
    widget.show_all();
    return widget;
}

const CornerWidget = new GObject.Class({
    // TODO: Is this the correct Name and GTypeName?
    Name: 'Corner.Widget',
    GTypeName: 'CornerWidget',
    Extends: Gtk.Grid,

    _init: function (monitorNumber, top, left) {
        this.parent({
            expand: true,
            halign: Gtk.Align.FILL,
            valign: top ? Gtk.Align.START : Gtk.Align.END
        });
        this.top = top;
        this.left = left;
        this.monitorNumber = monitorNumber;
        this.actionCombo = new Gtk.ComboBoxText({ hexpand: true });

        _actions.forEach(a => this.actionCombo.append(a[0], a[1]));
        this.actionCombo.active_id = 'disabled';
        this.commandEntry = new Gtk.Entry({ margin_top: 8 });

        let revealer = new Gtk.Revealer({
            transition_type: Gtk.RevealerTransitionType.SLIDE_UP,
            reveal_child: false
        });
        revealer.add(this.commandEntry);

        this.actionCombo.connect('changed', ac => {
            revealer.reveal_child = ac.active_id === 'runCommand';
        });

        this.attach(this.actionCombo, 0, 0, 1, 1);
        this.attach(revealer, 0, 1, 1, 1);
    }
});

const PrefsWidget = new GObject.Class({
    Name: 'Prefs.Widget',
    GTypeName: 'PrefsWidget',
    Extends: Gtk.Notebook,

    _init: function () {
        this.parent();
        this.set_tab_pos(Gtk.PositionType.LEFT);

        this._settings = Convenience.getSettings();
        this._cornerWidgets = [];

        let actions = this._settings.get_value('actions').deep_unpack();
        let numberOfMonitors = Gdk.Screen.get_default().get_n_monitors();

        for (let i = 0; i < numberOfMonitors; ++i) {
            let grid = new Gtk.Grid({
                expand: true,
                margin: 10,
                row_spacing: 20,
                column_spacing: 20
            });

            // Add widgets for every corner
            for (let [top, left] of [[true, true], [true, false],
                                     [false, true], [false, false]]) {
                let cw = new CornerWidget(i, top, left);

                for (let a of actions) {
                    if (cw.monitorNumber === a[0] &&
                            cw.top === a[1] &&
                            cw.left === a[2]) {
                        cw.actionCombo.active_id = a[3];
                        cw.commandEntry.text = a[4];
                    }
                }

                let f = Lang.bind(this, this._saveSettings);
                cw.actionCombo.connect('changed', f);
                cw.commandEntry.connect('changed', f);

                this._cornerWidgets.push(cw);
                let x = left ? 0 : 1;
                let y = top ? 0 : 1;
                grid.attach(cw, x, y, 1, 1);
            }

            this.append_page(grid, new Gtk.Label({ label: 'Monitor ' + 1 }));
        }
    },

    _saveSettings: function () {
        let actions = [];
        for (let cw of this._cornerWidgets) {
            let id = cw.actionCombo.active_id;
            let cmd = cw.commandEntry.text;
            if (id !== 'disabled' || cmd.length > 0) {
                actions.push([cw.monitorNumber, cw.top, cw.left, id, cmd]);
            }
        }
        let val = new GLib.Variant('a(ibbss)', actions);
        this._settings.set_value('actions', val);
    }
});
