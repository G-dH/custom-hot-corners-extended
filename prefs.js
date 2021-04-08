/* Copyright 2017 Jan Runge <janrunx@gmail.com>
 * Copyright 2021 GdH <georgdh@gmail.com>
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

const {Gtk, Gdk, GLib, GObject} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;
const triggers       = Settings.listTriggers();
const triggerLabels  = Settings.TriggerLabels;
let notebook;

const Gettext = imports.gettext;
      Gettext.textdomain(Me.metadata['gettext-domain']);
      Gettext.bindtextdomain(Me.metadata['gettext-domain'], Me.dir.get_child('locale').get_path());
const _ = Gettext.gettext;
const N_ = function(e) { return e };

function _loadUI(file) {
    const path = Me.dir.get_child(file).get_path();
    let builder = Gtk.Builder.new_from_file(path);
    return builder;
}

function init() {
    log(`initializing ${Me.metadata.name} Preferences`);
}

function buildPrefsWidget() {
    const prefsWidget = new Gtk.Grid();
    notebook = new Gtk.Notebook;
    notebook.tab_pos = Gtk.POS_LEFT;
    prefsWidget.attach(notebook,0,0,1,1);

    const display = Gdk.Display.get_default();
    const num_monitors = display.get_n_monitors();

    const cornerWidgets = [];

    const mscOptions = new Settings.MscOptions();
    const msUI       = _loadUI('misc-settings-widget.ui');
    const miscUI                   = msUI.get_object('miscOptions');
    const delayStartSwitch         = msUI.get_object('delayStartSwitch');
    const fullscreenGlobalSwitch   = msUI.get_object('fullscreenGlobalSwitch');
    const ignoreLastWsSwitch       = msUI.get_object('ignoreLastWsSwitch');
    const wrapWsSwitch             = msUI.get_object('wrapWsSwitch');
    const wsIndicatorSwitch        = msUI.get_object('wsIndicatorSwitch');
    const scrollEventsDelaySpinBtn = msUI.get_object('scrollEventsDelaySpinBtn');
    const cornersVisibleSwitch     = msUI.get_object('cornersVisibleSwitch');
    const rippleAnimationSwitch    = msUI.get_object('rippleAnimationSwitch');
    const winWrapSwitch            = msUI.get_object('winWrapSwitch');
    const winSkipMinimizedSwitch   = msUI.get_object('winSkipMinimizedSwitch');
    const barrierFallbackSwitch    = msUI.get_object('barrierFallbackSwitch');

    delayStartSwitch.active = mscOptions.delayStart;
    delayStartSwitch.connect('notify::active', () => {
                mscOptions.delayStart = delayStartSwitch.active;
    });

    fullscreenGlobalSwitch.active = mscOptions.fullscreenGlobal;
    fullscreenGlobalSwitch.connect('notify::active', () => {
                mscOptions.fullscreenGlobal = fullscreenGlobalSwitch.active;
    });

    cornersVisibleSwitch.active = mscOptions.cornersVisible;
    cornersVisibleSwitch.connect('notify::active', () => {
                mscOptions.cornersVisible = cornersVisibleSwitch.active;
    });

    winWrapSwitch.active = mscOptions.winSwitchWrap;
    winWrapSwitch.connect('notify::active', () =>{
                mscOptions.winSwitchWrap = winWrapSwitch.active;
            });
    winSkipMinimizedSwitch.active = mscOptions.winSkipMinimized;
    winSkipMinimizedSwitch.connect('notify::active', () =>{
                mscOptions.winSkipMinimized = winSkipMinimizedSwitch.active;
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
    barrierFallbackSwitch.active = mscOptions.barrierFallback;
    barrierFallbackSwitch.connect('notify::active', () =>{
                mscOptions.barrierFallback = barrierFallbackSwitch.active;
            });
    scrollEventsDelaySpinBtn.value = mscOptions.actionEventDelay;
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
                        mscOptions.actionEventDelay = scrollEventsDelaySpinBtn.value;
                        scrollEventsDelaySpinBtn.timeout_id = null;
                        return false;
                    }
                );
            });

    rippleAnimationSwitch.active = mscOptions.rippleAnimation;
    rippleAnimationSwitch.connect('notify::active', () =>{
                mscOptions.rippleAnimation = rippleAnimationSwitch.active;
            });

    for (let monitorIndex = 0; monitorIndex < num_monitors; ++monitorIndex) {
        const monitor = display.get_monitor(monitorIndex);
        const geometry = monitor.get_geometry();
        const corners = Settings.Corner.forMonitor(monitorIndex, monitorIndex, geometry);
        let grid = {};
        for (let i =0; i < corners.length; i++) {
            grid[i] = new Gtk.Grid({
                expand: true,
                column_homogeneous: true,
                margin: 10,
                row_spacing: 4,
                column_spacing: 20
            });
        }

        const triggersBook = new Gtk.Notebook();

        for (let i =0; i < corners.length; i++) {
            for (let trigger of triggers) {
                const cw = _buildCornerWidget(corners[i], trigger);
                const trgIcon = new Gtk.Image({
                    //label: `${triggerLabels[trigger]}`,
                    halign: Gtk.Align.START,
                    valign: Gtk.Align.START,
                    vexpand: true,
                    hexpand: true,
                    //pixel_size: 32
                    margin_left: 10
                    //use_markup: true
                });
                let iconPath;
                if (trigger === 0) {
                    iconPath = `${Me.dir.get_path()}/icons/${corners[i].top ? 'Top':'Bottom'}${corners[i].left ? 'Left':'Right'}.svg`
                } else {
                    iconPath = `${Me.dir.get_path()}/icons/Mouse-${trigger}.svg`;
                }
                trgIcon.set_from_file(iconPath);
                trgIcon.set_tooltip_text(triggerLabels[trigger]);
                grid[i].attach(trgIcon, 0, trigger, 1, 1);
                grid[i].attach(cw, 1, trigger, 3, 1);
            }

            const ew = _buildExpandWidget(corners[i]);
            grid[i].attach(ew, 0, 6, 4, 1);

        }
        for (let i =0; i < corners.length; i++){
            //const label = new Gtk.Label({ label: (corners[i].top ? _('Top') + ' ' : _('Bottom') +' ') + (corners[i].left ? _('Left') : _('Right')) });
            const label = new Gtk.Image();
            label.set_from_file(`${Me.dir.get_path()}/icons/${corners[i].top ? 'Top':'Bottom'}${corners[i].left ? 'Left':'Right'}.svg`);
            triggersBook.append_page(grid[i], label);


        }
        const label = new Gtk.Label({ label: _('Monitor') + ' ' + (monitorIndex + 1) });
        notebook.append_page(triggersBook, label);
        
    }
    const label = new Gtk.Label({ label: _('Options'), halign: Gtk.Align.START});
    notebook.append_page(miscUI, label);
    prefsWidget.show_all();
    return prefsWidget;
}

function _buildCornerWidget(corner, trigger) {
    const cwUI = _loadUI('corner-widget.ui');
    const cw = cwUI.get_object('cornerWidget');
    const fullscreenSwitch = cwUI.get_object('fullscreenSwitch');
    const actionCombo = cwUI.get_object('actionCombo');
    const commandEntry = cwUI.get_object('commandEntry');
    const commandEntryRevealer = cwUI.get_object('commandEntryRevealer');
    const wsIndexRevealer = cwUI.get_object('wsIndexRevealer');
    const workspaceIndexSpinButton = cwUI.get_object('workspaceIndex');
    const appButton = cwUI.get_object('appButton');

    fullscreenSwitch.active = corner.getFullscreen(trigger);
    fullscreenSwitch.connect('notify::active', () => {
        corner.setFullscreen(trigger, fullscreenSwitch.active);
    });
    
    let cmdConnected = false;
    actionCombo.connect('changed', () => {
        corner.setAction(trigger, actionCombo.active_id);
        commandEntryRevealer.reveal_child = corner.getAction(trigger) === 'runCommand';
        wsIndexRevealer.reveal_child = corner.getAction(trigger) === 'moveToWorkspace';
        if (corner.getAction(trigger) === 'runCommand' && !cmdConnected) {

            appButton.connect('clicked', () => {
                const dialog = _chooseAppDialog();
                dialog._appChooser.connect('application-activated', () => dialog._addButton.clicked() );
                dialog.connect('response', (dlg, id) => {
                    if (id !== Gtk.ResponseType.OK) {
                        dialog.destroy();
                        return;
                    }
    
                    let appInfo = dialog._appChooser.get_app_info();
                    if (!appInfo) return;
                    commandEntry.text = appInfo.get_commandline();
    
                    dialog.destroy();
                });
            });
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
                        return false;
                    }
                );
            });
            cmdConnected = true;
        }
    });

    wsIndexRevealer.reveal_child = corner.getAction(trigger) === 'moveToWorkspace';

    actionCombo.active_id = corner.getAction(trigger);

    if (trigger === Settings.Triggers.PRESSURE) {
        const barrierLabel = cwUI.get_object('barrierLabel');
        const pressureLabel = cwUI.get_object('pressureLabel');
        const barrierSizeSpinButton = cwUI.get_object('barrierSize');
        const pressureThresholdSpinButton = cwUI.get_object('pressureThreshold');
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
                    return false;
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
                    return false;
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
                    return false;
                }
        );
    });

    return cw;
}

function _buildExpandWidget (corner) {
    const cwUI = _loadUI('corner-widget.ui');
    const ew = cwUI.get_object('expandGrid');
    const hExpandSwitch = cwUI.get_object('hExpandSwitch');
    const vExpandSwitch = cwUI.get_object('vExpandSwitch');
    hExpandSwitch.active = corner.hExpand;
    vExpandSwitch.active = corner.vExpand;
    hExpandSwitch.connect('notify::active', () => {
        corner.hExpand = hExpandSwitch.active;
    });
    vExpandSwitch.connect('notify::active', () => {
        corner.vExpand = vExpandSwitch.active;
    });

    return ew;
}

function _chooseAppDialog() {
        const dialog = new Gtk.Dialog({
            title: (_('Choose Application')),
            transient_for: notebook.get_toplevel(),
            use_header_bar: true,
            modal: true
        });

        dialog.add_button(Gtk.STOCK_CANCEL, Gtk.ResponseType.CANCEL);
        dialog._addButton = dialog.add_button(Gtk.STOCK_ADD, Gtk.ResponseType.OK);
        dialog.set_default_response(Gtk.ResponseType.OK);

        const grid = new Gtk.Grid({
            column_spacing: 10,
            row_spacing: 15,
            margin: 10,
        });

        dialog._appChooser = new Gtk.AppChooserWidget({
            show_all: true
        });
        let appInfo = dialog._appChooser.get_app_info();
        grid.attach(dialog._appChooser, 0, 0, 2, 1);
        const cmdLabel = new Gtk.Label({
            label:"",
            wrap: true
        });
        grid.attach(cmdLabel, 0, 1, 2, 1);
        dialog.get_content_area().add(grid);
        dialog._appChooser.connect('application-selected', (w, appInfo) => {
                cmdLabel.set_text(appInfo.get_commandline());
            }
        );
        dialog.show_all();
        return dialog;
    }