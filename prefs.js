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
const Gtk = imports.gi.Gtk;
const Gettext = imports.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

Gettext.textdomain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

let _actions = [];
let _wmctrlInfo = '';

function init() {
    ExtensionUtils.initTranslations();
    _actions = _actions.concat([
        ['disabled', _("-")],
        ['toggleOverview', _("Toggle overview")],
        ['showDesktop', _("Show desktop")],
        ['showApplications', _("Show applications")],
        ['runCommand', _("Run command")]
    ]);
    _wmctrlInfo = _("Show desktop requires wmctrl to be installed");
}

function buildPrefsWidget() {
    let widget = new PrefsWidget();
    widget.show_all();
    return widget;
}

const CornerWidget = new GObject.Class({
    Name: 'Corner.Widget',
    GTypeName: 'CornerWidget',
    Extends: Gtk.Grid,

    _init: function (corner) {
        this.parent({
            expand: true,
            halign: Gtk.Align.FILL,
            valign: corner.top ? Gtk.Align.START : Gtk.Align.END
        });
        this.corner = corner;
        this.actionCombo = new Gtk.ComboBoxText({ hexpand: true });
        this.commandEntry = new Gtk.Entry({ margin_top: 8 });

        _actions.forEach(a => this.actionCombo.append(a[0], a[1]));

        this.actionCombo.active_id = this.corner.action;
        this.commandEntry.text = this.corner.command;

        let revealer = new Gtk.Revealer({
            transition_type: Gtk.RevealerTransitionType.SLIDE_UP,
            reveal_child: this.actionCombo.active_id === 'runCommand'
        });
        revealer.add(this.commandEntry);

        this.actionCombo.connect('changed', () => {
            revealer.reveal_child = this.actionCombo.active_id === 'runCommand';
            this.corner.action = this.actionCombo.active_id;
        });
        this.commandEntry.connect('changed', () => {
            this.corner.command = this.commandEntry.text;
        });

        this.attach(this.actionCombo, 0, 0, 1, 1);
        this.attach(revealer, 0, 1, 1, 1);
    }
});

const PrefsWidget = new GObject.Class({
    Name: 'Prefs.Widget',
    GTypeName: 'PrefsWidget',
    Extends: Gtk.Grid,

    _init: function () {
        this.parent();

        this.infoBarLabel = new Gtk.Label({ label: '' });
        this.infoBar = new Gtk.InfoBar();
        this.infoBar.get_content_area().add(this.infoBarLabel);
        this.infoBarRevealer = new Gtk.Revealer({
            transition_type: Gtk.RevealerTransitionType.SLIDE_UP
        });
        this.infoBarRevealer.add(this.infoBar);
        this.attach(this.infoBarRevealer, 0, 0, 1, 1);

        this.notebook = new Gtk.Notebook();
        this.notebook.set_tab_pos(Gtk.PositionType.LEFT);
        this.attach(this.notebook, 0, 1, 1, 1);

        this._cornerWidgets = [];

        let monitors = Settings.Monitor.all();

        for (let monitor of monitors) {
            let grid = new Gtk.Grid({
                expand: true,
                margin: 10,
                row_spacing: 20,
                column_spacing: 20
            });

            // Add widgets for every corner
            for (let corner of monitor.corners) {
                let cw = new CornerWidget(corner);
                this._cornerWidgets.push(cw);
                let x = corner.left ? 0 : 1;
                let y = corner.top ? 0 : 1;
                grid.attach(cw, x, y, 1, 1);
            }

            let label = new Gtk.Label({ label: 'Monitor ' + (monitor.index + 1) });
            this.notebook.append_page(grid, label);
        }
        this._showWmctrlInfo();
    },

    _showWmctrlInfo: function () {
        if (GLib.find_program_in_path("wmctrl")) {
            this.infoBarRevealer.reveal_child = false;
        } else {
            for (let cw of this._cornerWidgets) {
                if (cw.actionCombo.active_id === 'showDesktop') {
                    this.infoBarLabel.label = _wmctrlInfo;
                    this.infoBarRevealer.reveal_child = true;
                    return;
                }
            }
            this.infoBarRevealer.reveal_child = false;
        }
    }
});
