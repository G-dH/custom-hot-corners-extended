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
let triggers = Settings.listTriggers();
let triggerLabels = Settings.TriggerLabels;
let notebook;

function _loadUI(file) {
    let path = Me.dir.get_child(file).get_path();
    return Gtk.Builder.new_from_file(path);
}

function init() {
    log(`initializing ${Me.metadata.name} Preferences`);
}

function buildPrefsWidget() {
    let prefsWidget = new Gtk.Grid();
    notebook = new Gtk.Notebook;
    notebook.tab_pos = Gtk.POS_LEFT;
    prefsWidget.attach(notebook,0,0,1,1);

    const display = Gdk.Display.get_default();
    const num_monitors = display.get_n_monitors();

    const cornerWidgets = [];

    let mscOptions = new Settings.MscOptions();
    let msUI = _loadUI('misc-settings-widget.ui');
    let miscUI = msUI.get_object('miscOptions');
    let fiX11Switch = msUI.get_object('fiX11Switch');
    let delayStartSwitch = msUI.get_object('delayStartSwitch');
    let fullscreenGlobalSwitch = msUI.get_object('fullscreenGlobalSwitch');
    let scrollPanelSwitch = msUI.get_object('scrollPanelSwitch');
    let ignoreLastWsSwitch = msUI.get_object('ignoreLastWsSwitch');
    let wrapWsSwitch = msUI.get_object('wrapWsSwitch');
    let wsIndicatorSwitch = msUI.get_object('wsIndicatorSwitch');
    let scrollEventsDelaySpinBtn = msUI.get_object('scrollEventsDelaySpinBtn');

    fiX11Switch.active = mscOptions.fiX11;
    fiX11Switch.connect('notify::active', () => {
                mscOptions.fiX11 = fiX11Switch.active;
    })

    delayStartSwitch.active = mscOptions.delayStart;
    delayStartSwitch.connect('notify::active', () => {
                mscOptions.delayStart = delayStartSwitch.active;
    })

    fullscreenGlobalSwitch.active = mscOptions.fullscreenGlobal;
    fullscreenGlobalSwitch.connect('notify::active', () => {
                mscOptions.fullscreenGlobal = fullscreenGlobalSwitch.active;
    })
    scrollPanelSwitch.active = mscOptions.scrollPanel;
    scrollPanelSwitch.connect('notify::active', () => {
                mscOptions.scrollPanel = scrollPanelSwitch.active;
            });
    ignoreLastWsSwitch.active = mscOptions.wsSwitchIgnoreLast;
    ignoreLastWsSwitch.connect('notify::active', () =>{
                mscOptions.wsSwitchIgnoreLast = ignoreLastWsSwitch.active;
            });
    wrapWsSwitch.active = mscOptions.wsSwitchWrap;
    wrapWsSwitch.connect('notify::active', () =>{
                mscOptions.wsSwitchWrap = wrapWsSwitch.active;
            });
    wsIndicatorSwitch.active = mscOptions.wsSwitchIndicator;
    wsIndicatorSwitch.connect('notify::active', () =>{
                mscOptions.wsSwitchIndicator = wsIndicatorSwitch.active;
            });
    scrollEventsDelaySpinBtn.value = mscOptions.scrollEventDelay;
    scrollEventsDelaySpinBtn.timeout_id = null;
    scrollEventsDelaySpinBtn.connect('changed', () => {
                scrollEventsDelaySpinBtn.update();
                if (scrollEventsDelaySpinBtn.timeout_id) {
                    GLib.Source.remove(scrollEventsDelaySpinBtn.timeout_id);
                }
                scrollEventsDelaySpinBtn.timeout_id = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    1000,
                    () => {
                        mscOptions.scrollEventDelay = scrollEventsDelaySpinBtn.value;
                        scrollEventsDelaySpinBtn.timeout_id = null;
                    }
                );
            });

    for (let monitorIndex = 0; monitorIndex < num_monitors; ++monitorIndex) {
        let grid = {};
        for (let trigger of triggers) {

            grid[trigger] = new Gtk.Grid({
                expand: true,
                margin: 10,
                row_spacing: 20,
                column_spacing: 20
            });
        }

        let triggersBook = new Gtk.Notebook();

        const monitor = display.get_monitor(monitorIndex);
        const geometry = monitor.get_geometry();
        const corners = Settings.Corner.forMonitor(monitorIndex, monitorIndex, geometry);

        for (let corner of corners) {
            for (let trigger of triggers) {
                let cw = _buildCornerWidget(corner, trigger);
                cw.valign = corner.top ? Gtk.Align.START : Gtk.Align.END;
                let x = corner.left ? 0 : 1;
                let y = corner.top ? 0 : 1;
                grid[trigger].attach(cw, x, y, 1, 1);
            }
        }
        for (let trigger of triggers){
            let label = new Gtk.Label({ label: Settings.TriggerLabels[trigger]});
            triggersBook.append_page(grid[trigger], label);


        }
        let label = new Gtk.Label({ label: 'Monitor ' + (monitorIndex + 1) });
        notebook.append_page(triggersBook, label);
        
    }
    let label = new Gtk.Label({ label: 'Options', halign: Gtk.Align.START});
    notebook.append_page(miscUI, label);
    prefsWidget.show_all();
    return prefsWidget;
}

function _buildCornerWidget(corner, trigger) {
    let cwUI = _loadUI('corner-widget.ui');
    let cw = cwUI.get_object('cornerWidget');
    let fullscreenSwitch = cwUI.get_object('fullscreenSwitch');
    let actionCombo = cwUI.get_object('actionCombo');
    let commandEntry = cwUI.get_object('commandEntry');
    let commandEntryRevealer = cwUI.get_object('commandEntryRevealer');
    let wsIndexRevealer = cwUI.get_object('wsIndexRevealer');
    let workspaceIndexSpinButton = cwUI.get_object('workspaceIndex');
    let appButton = cwUI.get_object('appButton');

    fullscreenSwitch.active = corner.getFullscreen(trigger);
    fullscreenSwitch.connect('notify::active', () => {
        corner.setFullscreen(trigger, fullscreenSwitch.active);
    });
    
    actionCombo.active_id = corner.getAction(trigger);
    actionCombo.connect('changed', () => {
        corner.setAction(trigger, actionCombo.active_id);
        commandEntryRevealer.reveal_child = corner.getAction(trigger) === 'runCommand';
        wsIndexRevealer.reveal_child = corner.getAction(trigger) === 'moveToWorkspace';
    });
    //if (commandEntryRevealer.reveal_child) {
    appButton.connect('clicked', () => {
        let dialog = _chooseAppDialog();
        dialog.connect('response', (dlg, id) => {
            if (id !== Gtk.ResponseType.OK) {
                dialog.destroy();
                return;
            }

            appInfo = dialog._appChooser.get_app_info();
            if (!appInfo) return;
            commandEntry.text = appInfo.get_commandline();

            dialog.destroy();
        });
    });
    //}
    wsIndexRevealer.reveal_child = corner.getAction(trigger) === 'moveToWorkspace';

    commandEntry.text = corner.getCommand(trigger);
    commandEntryRevealer.reveal_child = corner.getAction(trigger) === 'runCommand';
    commandEntry.timeout_id = null;
    commandEntry.connect('changed', () => {
        if (commandEntry.timeout_id) {
            GLib.Source.remove(commandEntry.timeout_id);
        }
        commandEntry.timeout_id = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            1000,
            () => {
                corner.setCommand(trigger, commandEntry.text);
                commandEntry.timeout_id = null;
            }
        );
    });

    if (trigger === Settings.Triggers.PRESSURE) {
        let barrierLabel = cwUI.get_object('barrierLabel');
        let pressureLabel = cwUI.get_object('pressureLabel');
        let barrierSizeSpinButton = cwUI.get_object('barrierSize');
        let pressureThresholdSpinButton = cwUI.get_object('pressureThreshold');
        barrierLabel.show();
        barrierSizeSpinButton.show();
        pressureLabel.show();
        pressureThresholdSpinButton.show();

        barrierSizeSpinButton.value = corner.barrierSize;
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
    
        pressureThresholdSpinButton.value = corner.pressureThreshold;
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

    }

    workspaceIndexSpinButton.value = corner.getWorkspaceIndex(trigger);
    workspaceIndexSpinButton.timeout_id = null;
    workspaceIndexSpinButton.connect('changed', () => {
        workspaceIndexSpinButton.update();
        if (workspaceIndexSpinButton.timeout_id) {
            GLib.Source.remove(workspaceIndexSpinButton.timeout_id);
        }
        workspaceIndexSpinButton.timeout_id = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
                1000,
                () => {
                    corner.setWorkspaceIndex(trigger, workspaceIndexSpinButton.value);
                    workspaceIndexSpinButton.timeout_id = null;
                }
        );
    });
    return cw;
}

function _chooseAppDialog() {
        let dialog = new Gtk.Dialog({
            title: ('Choose Application'),
            transient_for: notebook.get_toplevel(),
            use_header_bar: true,
            modal: true,
        });

        dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
        let addButton = dialog.add_button('Select', Gtk.ResponseType.OK);
        dialog.set_default_response(Gtk.ResponseType.OK);

        let grid = new Gtk.Grid({
            column_spacing: 10,
            row_spacing: 15,
            margin: 10,
        });

        dialog._appChooser = new Gtk.AppChooserWidget({ show_all: true });
        let appInfo = dialog._appChooser.get_app_info();
        grid.attach(dialog._appChooser, 0, 0, 2, 1);
        dialog.get_content_area().add(grid);

        dialog.show_all();
        return dialog;
    }