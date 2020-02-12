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

const {Gtk, Gdk, GLib} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

function _loadUI(file) {
    let path = Me.dir.get_child(file).get_path();
    return Gtk.Builder.new_from_file(path);
}

function init() {
}

function buildPrefsWidget() {
    let prefsUI = _loadUI('prefs-widget.ui');
    let prefsWidget = prefsUI.get_object('prefsGrid');
    let notebook = prefsUI.get_object('notebook');

    const display = Gdk.Display.get_default();
    const num_monitors = display.get_n_monitors();

    for (let monitorIndex = 0; monitorIndex < num_monitors; ++monitorIndex) {
        let grid = new Gtk.Grid({
            expand: true,
            margin: 10,
            row_spacing: 20,
            column_spacing: 20
        });

        const monitor = display.get_monitor(monitorIndex);
        const geometry = monitor.get_geometry();
        const corners = Settings.Corner.forMonitor(monitorIndex, geometry);

        for (let corner of corners) {
            let cwUI = _loadUI('corner-widget.ui');
            let cw = cwUI.get_object('cornerWidget');
            let actionCombo = cwUI.get_object('actionCombo');
            let commandEntry = cwUI.get_object('commandEntry');
            let commandEntryRevealer = cwUI.get_object('commandEntryRevealer');
            let fullscreenSwitch = cwUI.get_object('fullscreenSwitch');
            let barrierSizeSpinButton = cwUI.get_object('barrierSize');
            let pressureThresholdSpinButton = cwUI.get_object('pressureThreshold');

            actionCombo.active_id = corner.action;
            commandEntry.text = corner.command;
            commandEntryRevealer.reveal_child = corner.action === 'runCommand';
            fullscreenSwitch.active = corner.fullscreen;
            barrierSizeSpinButton.value = corner.barrierSize;
            pressureThresholdSpinButton.value = corner.pressureThreshold;

            actionCombo.connect('changed', () => {
                corner.action = actionCombo.active_id;
                commandEntryRevealer.reveal_child = corner.action === 'runCommand';
            });
            commandEntry.connect('changed', () => {
                corner.command = commandEntry.text;
            });
            fullscreenSwitch.connect('notify::active', () => {
                corner.fullscreen = fullscreenSwitch.active;
            });
            barrierSizeSpinButton.timout_id = null;
            barrierSizeSpinButton.connect('changed', () => {
                barrierSizeSpinButton.update();
                // Cancel previous timeout
                if (barrierSizeSpinButton.timeout_id) {
                    GLib.Source.remove(barrierSizeSpinButton.timeout_id);
                }
                barrierSizeSpinButton.timeout_id = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    1000,
                    () => {
                        corner.barrierSize = barrierSizeSpinButton.value;
                        barrierSizeSpinButton.timeout_id = null;
                    }
                );
            });
            pressureThresholdSpinButton.timeout_id = null;
            pressureThresholdSpinButton.connect('changed', () => {
                pressureThresholdSpinButton.update();
                if (pressureThresholdSpinButton.timeout_id) {
                    GLib.Source.remove(pressureThresholdSpinButton.timeout_id);
                }
                pressureThresholdSpinButton.timeout_id = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    1000,
                    () => {
                        corner.pressureThreshold = pressureThresholdSpinButton.value;
                        pressureThresholdSpinButton.timeout_id = null;
                    }
                );
            });

            cw.valign = corner.top ? Gtk.Align.START : Gtk.Align.END;
            let x = corner.left ? 0 : 1;
            let y = corner.top ? 0 : 1;
            grid.attach(cw, x, y, 1, 1);
        }

        let label = new Gtk.Label({ label: 'Monitor ' + (monitorIndex + 1) });
        notebook.append_page(grid, label);
    }

    prefsWidget.show_all();
    return prefsWidget;
}
