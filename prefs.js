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
"use strict"
const {Gtk, Gdk, GLib, GObject} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;
const triggers       = Settings.listTriggers();
const triggerLabels  = Settings.TriggerLabels;
let   notebook;

// gettext
const _  = Settings._;

let GNOME40;
let WAYLAND;


function _loadUI(file) {
    const path = Me.dir.get_child(file).get_path();
    let builder = Gtk.Builder.new_from_file(path);
    return builder;
}

function init() {
    log(`initializing ${Me.metadata.name} Preferences`);
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    if (Settings.shellVersion.startsWith("40"))
        GNOME40 = true;
    else GNOME40 = false;
    WAYLAND = GLib.getenv('XDG_SESSION_TYPE') === 'wayland';
}

function buildPrefsWidget() {
    const prefsWidget = new Gtk.Grid();
    notebook = new Gtk.Notebook();
    notebook.tab_pos = Gtk.POS_LEFT;
    prefsWidget.attach(notebook,0,0,1,1);

    const display = Gdk.Display.get_default();
    const num_monitors = GNOME40 ?
                            display.get_monitors().get_n_items() :
                            display.get_n_monitors();

    const cornerWidgets = [];

    const mscOptions = new Settings.MscOptions();
    const msUI       = GNOME40 ?
                        _loadUI('misc-settings-widget-40.ui') :
                        _loadUI('misc-settings-widget.ui');
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
    scrollEventsDelaySpinBtn.connect('value-changed', () => {
                scrollEventsDelaySpinBtn.update();
                if (scrollEventsDelaySpinBtn.timeout_id) {
                    GLib.Source.remove(scrollEventsDelaySpinBtn.timeout_id);
                }
                scrollEventsDelaySpinBtn.timeout_id = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    500,
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
        const monitor = GNOME40 ?
                            display.get_monitors().get_item(monitorIndex) :
                            display.get_monitor(monitorIndex);
        const geometry = monitor.get_geometry();
        const corners = Settings.Corner.forMonitor(monitorIndex, monitorIndex, geometry);
        let grid = {};
        for (let i =0; i < corners.length; i++) {
            grid[i] = new Gtk.Grid({
                //expand: true,
                column_homogeneous: false,
                row_homogeneous: false,
                margin_start:   10,
                margin_end:     10,
                margin_top:     10,
                margin_bottom:  10,
                //row_spacing: 4,
                column_spacing: 10
            });
        }

        const triggersBook = new Gtk.Notebook();

        let mouseSettings = Settings.getSettings(
                                    'org.gnome.desktop.peripherals.mouse',
                                    '/org/gnome/desktop/peripherals/mouse/');
        let leftHandMouse = mouseSettings.get_boolean('left-handed');

        for (let i =0; i < corners.length; i++) {
            for (let trigger of triggers) {

                const ctrlBtn = new Gtk.CheckButton(
                //const ctrlBtn = new Gtk.ToggleButton(
                    {
                        label: 'Ctrl',
                        halign: Gtk.Align.START,
                        valign: Gtk.Align.CENTER,
                        vexpand: false,
                        hexpand: false,
                        tooltip_text: _('When checked, pressed Ctrl key is needed to trigger the action'),
                    });
                if ((WAYLAND) && (trigger === Settings.Triggers.PRESSURE)) {
                    ctrlBtn.tooltip_text = ('Doesn\'t work with Wayland for Hot triggers\n') + 
                                            ctrlBtn.tooltip_text;
                }
                ctrlBtn.connect('notify::active', () =>{
                    corners[i].setCtrl(trigger, ctrlBtn.active);
                });
                ctrlBtn.set_active(corners[i].getCtrl(trigger));

                const cw = _buildCornerWidget(corners[i], trigger, geometry);
                const trgIcon = new Gtk.Image({
                    halign: Gtk.Align.START,
                    margin_start: 10,
                    vexpand: true,
                    hexpand: true,
                    pixel_size: 40
                });
                let iconPath;
                if (trigger === 0) {
                    iconPath = `${Me.dir.get_path()}/icons/${corners[i].top ? 'Top':'Bottom'}${corners[i].left ? 'Left':'Right'}.svg`
                } else {
                    let iconIdx = trigger;
                    if (leftHandMouse) {
                        if (trigger === 1) iconIdx = 2;
                        if (trigger === 2) iconIdx = 1;
                    }
                    iconPath = `${Me.dir.get_path()}/icons/Mouse-${iconIdx}.svg`;
                }
                trgIcon.set_from_file(iconPath);
                trgIcon.set_tooltip_text(triggerLabels[trigger]);
                grid[i].attach(trgIcon, 0, trigger, 1, 1);
                grid[i].attach(ctrlBtn, 1, trigger, 1, 1);
                grid[i].attach(cw, 2, trigger, 1, 1);
            }

            const ew = _buildExpandWidget(corners[i]);
            grid[i].attach(ew, 0, 6, 3, 1);

        }
        for (let i =0; i < corners.length; i++){
            const label = new Gtk.Image({
                    halign: Gtk.Align.CENTER,
                    valign: Gtk.Align.START,
                    margin_start: 10,
                    vexpand: true,
                    hexpand: true,
                    pixel_size: 40
                });
            label.set_from_file(`${Me.dir.get_path()}/icons/${corners[i].top ? 'Top':'Bottom'}${corners[i].left ? 'Left':'Right'}.svg`);
            triggersBook.append_page(grid[i], label);


        }
        const label = new Gtk.Label({ label: _('Monitor') + ' ' + (monitorIndex + 1) });
        notebook.append_page(triggersBook, label);
        
    }
    const label = new Gtk.Label({ label: _('Options'), halign: Gtk.Align.START});
    notebook.append_page(miscUI, label);
    if (!GNOME40) prefsWidget.show_all();
    return prefsWidget;
}

function _buildCornerWidget(corner, trigger, geometry) {
    const cwUI = GNOME40 ?
                    _loadUI('corner-widget-40.ui') :
                    _loadUI('corner-widget.ui');
    const cw = cwUI.get_object('cornerWidget');
    const fullscreenSwitch = cwUI.get_object('fullscreenSwitch');
    const actionCombo = cwUI.get_object('actionCombo');
    const actionTreeStore = cwUI.get_object('treestore');
    const commandEntry = cwUI.get_object('commandEntry');
    const commandEntryRevealer = cwUI.get_object('commandEntryRevealer');
    const wsIndexRevealer = cwUI.get_object('wsIndexRevealer');
    const workspaceIndexSpinButton = cwUI.get_object('workspaceIndex');
    const appButton = cwUI.get_object('appButton');
    if (GNOME40) {
        // Gtk3 implement button icon as added Gtk.Image child, Gtk4 does not
        const settingsBtn = cwUI.get_object('settingsButton');
              settingsBtn.set_icon_name('emblem-system-symbolic');
    }

    fullscreenSwitch.active = corner.getFullscreen(trigger);
    fullscreenSwitch.connect('notify::active', () => {
        corner.setFullscreen(trigger, fullscreenSwitch.active);
    });
    
    const actions = [
        [null, 'disabled'        ,   _('-')],
        [null, 'toggleOverview'  ,   _('Show Activities (Overview)')],
        [null, 'showApplications',   _('Show Applications')],
        [null, ''                ,   _('Show / Hide Desktop')],
        [   1, 'showDesktop'     ,   _('Show Desktop (all monitors)')],
        [   1, 'showDesktopMon'  ,   _('Show Desktop (this monitor)')],
        [   1, 'blackScreen'     ,   _('Black Screen (all monitors)')],
        [   1, 'blackScreenMon'  ,   _('Black Screen (this monitor)')],
        [null, ''                ,   _('Run Command')],
        [   1, 'runCommand'      ,   _('Run Command')],
        [   1, 'runDialog'       ,   _('Open "Run a Command" Dialog')],
        [null, ''                ,   _('Workspaces')],
        [   1, 'prevWorkspace'   ,   _('Previous Workspace')],
        [   1, 'nextWorkspace'   ,   _('Next Workspace')],
        [   1, 'recentWS'        ,   _('Recent Workspace')],
        [   1, 'moveToWorkspace' ,   _('Move to Workspace #')],
        [null, ''                ,   _('Windows - Navigation')],
        [   1, 'recentWin'       ,   _('Recent Window (Alt+Tab)')],
        [   1, 'prevWinWsMon'    ,   _('Previous Window (current monitor)')],
        [   1, 'prevWinWS'       ,   _('Previous Window (current WS)')],
        [   1, 'prevWinAll'      ,   _('Previous Window (all)')],
        [   1, 'nextWinWsMon'    ,   _('Next Window (current monitor)')],
        [   1, 'nextWinWS'       ,   _('Next Window (current WS)')],
        [   1, 'nextWinAll'      ,   _('Next Window (all)')],
        [null, ''                ,   _('Windows - Control')],
        [   1, 'closeWin'        ,   _('Close Window')],
        [   1, 'maximizeWin'     ,   _('Maximize')],
        [   1, 'minimizeWin'     ,   _('Minimize')],
        [   1, 'fullscreenWin'   ,   _('Fullscreen')],
        [   1, 'aboveWin'        ,   _('Always on Top')],
        [   1, 'stickWin'        ,   _('Always on Visible Workspace')],
        [   1, 'invertLightness' ,   _('Invert Lightness')],
        [null, ''                ,   _('Universal Access')],
        [   1, 'toggleZoom'      ,   _('Toggle Zoom')],
        [   1, 'zoomIn'          ,   _('Zoom In')],
        [   1, 'zoomOut'         ,   _('Zoom Out')],
        [   1, 'screenReader'    ,   _('Screen Reader')],
        [   1, 'largeText'       ,   _('Large Text')],
        [   1, 'keyboard'        ,   _('Screen Keyboard')],
        [null, ''                ,   _('Gnome Shell')],
        [   1, 'hidePanel'       ,   _('Hide/Show Main Panel')],
        [null, ''                ,   _('System')],
        [   1, 'screenLock'      ,   _('Lock Screen')],
        [   1, 'suspend'         ,   _('Suspend to RAM')],
        [   1, 'powerOff'        ,   _('Power Off Dialog')],
        [   1, 'logout'          ,   _('Log Out Dialog')],
        [   1, 'switchUser'      ,   _('Switch User (if exists)')],
        [null, ''                ,   _('Sound')],
        [   1, 'volumeUp'        ,   _('Volume Up')],
        [   1, 'volumeDown'      ,   _('Volume Down')],
        [   1, 'muteAudio'       ,   _('Mute')],
        [null, ''                ,   _('Debug')],
        [   1, 'lookingGlass'    ,   _('Looking Glass (GS debugger)')],
        [   1, 'restartShell'    ,   _('Restart Gnome Shell (X11 only)')],
        [null, 'prefs'           ,   _('Open Preferences')]
    ]
    let comboRenderer = new Gtk.CellRendererText();
    actionCombo.pack_start(comboRenderer, true);
    actionCombo.add_attribute(comboRenderer, "text", 1);
    actionCombo.set_cell_data_func(comboRenderer,
        (clayout, cell, model, iter) => {
            let sensitive = !model.iter_has_child(iter);
            cell.set_sensitive(sensitive);
        }
    );
    let iterDict = {};
    let iter, iter2;
    for (let i = 0; i < actions.length; i++){
        let item = actions[i];
        if (GNOME40 && item[1] === 'invertLightness') continue;
        if (item[0] === null){
            iter  = actionTreeStore.append(null);
            actionTreeStore.set(iter, [0], [item[1]]);
            actionTreeStore.set(iter, [1], [item[2]]);
            // map items on iters to address them later
            iterDict[item[1]] = iter;
        } else {
            iter2  = actionTreeStore.append(iter);
            actionTreeStore.set(iter2, [0], [item[1]]);
            actionTreeStore.set(iter2, [1], [item[2]]);
            iterDict[item[1]] = iter2;
        }
    }

    let cmdConnected = false;
    commandEntryRevealer.reveal_child = corner.getAction(trigger) === 'runCommand';
    commandEntry.text = corner.getCommand(trigger);

    actionCombo.connect('changed', () => {
        corner.setAction(trigger, actionCombo.get_active_id());
        commandEntryRevealer.reveal_child = corner.getAction(trigger) === 'runCommand';
        wsIndexRevealer.reveal_child = corner.getAction(trigger) === 'moveToWorkspace';
        if (corner.getAction(trigger) === 'runCommand' && !cmdConnected) {
            appButton.connect('clicked', () => {
                function fillCmdEntry () {
                    let appInfo = dialog._appChooser.get_app_info();
                        if (!appInfo) return;
                        commandEntry.text = appInfo.get_commandline().replace(/ %.$/, '');
                        dialog.destroy();
                }
                const dialog = _chooseAppDialog();
                dialog._appChooser.connect('application-activated', () => {
                    fillCmdEntry(dialog, commandEntry);
                });
                dialog.connect('response', (dlg, id) => {
                    if (id !== Gtk.ResponseType.OK) {
                        dialog.destroy();
                        return;
                    }
                    fillCmdEntry();
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
                    500,
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

    if (iterDict[corner.getAction(trigger)]) actionCombo.set_active_iter(iterDict[corner.getAction(trigger)]);
    wsIndexRevealer.reveal_child = corner.getAction(trigger) === 'moveToWorkspace';

    if (trigger === Settings.Triggers.PRESSURE) {
        const barrierLabelH = cwUI.get_object('barrierLabelH');
        const barrierLabelV = cwUI.get_object('barrierLabelV');
        cwUI.get_object('barrierAdjustmentH').set_upper(geometry.width);
        cwUI.get_object('barrierAdjustmentV').set_upper(geometry.height);
        const barrierAdjustmentV = cwUI.get_object('barrierAdjustmentV');
        const pressureLabel = cwUI.get_object('pressureLabel');
        const barrierSizeSpinButtonH = cwUI.get_object('barrierSizeH');
        const barrierSizeSpinButtonV = cwUI.get_object('barrierSizeV');
        const pressureThresholdSpinButton = cwUI.get_object('pressureThreshold');
        barrierLabelH.show();
        barrierLabelV.show();
        barrierSizeSpinButtonH.show();
        barrierSizeSpinButtonV.show();
        pressureLabel.show();
        pressureThresholdSpinButton.show();

        barrierSizeSpinButtonH.value = corner.barrierSizeH;
        barrierSizeSpinButtonH.timout_id = null;
        barrierSizeSpinButtonH.connect('value-changed', () => {
            barrierSizeSpinButtonH.update();
            // Cancel previous timeout
            if (barrierSizeSpinButtonH.timeout_id) {
                GLib.Source.remove(barrierSizeSpinButtonH.timeout_id);
            }
            barrierSizeSpinButtonH.timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
                () => {
                    corner.barrierSizeH = barrierSizeSpinButtonH.value;
                    barrierSizeSpinButtonH.timeout_id = null;
                    return false;
                }
            );
        });
        barrierSizeSpinButtonV.value = corner.barrierSizeV;
        barrierSizeSpinButtonV.timout_id = null;
        barrierSizeSpinButtonV.connect('value-changed', () => {
            barrierSizeSpinButtonV.update();
            // Cancel previous timeout
            if (barrierSizeSpinButtonV.timeout_id) {
                GLib.Source.remove(barrierSizeSpinButtonV.timeout_id);
            }
            barrierSizeSpinButtonV.timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
                () => {
                    corner.barrierSizeV = barrierSizeSpinButtonV.value;
                    barrierSizeSpinButtonV.timeout_id = null;
                    return false;
                }
            );
        });
    
        pressureThresholdSpinButton.value = corner.pressureThreshold;
        pressureThresholdSpinButton.timeout_id = null;
        pressureThresholdSpinButton.connect('value-changed', () => {
            pressureThresholdSpinButton.update();
            if (pressureThresholdSpinButton.timeout_id) {
                GLib.Source.remove(pressureThresholdSpinButton.timeout_id);
            }
            pressureThresholdSpinButton.timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
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
    workspaceIndexSpinButton.connect('value-changed', () => {
        workspaceIndexSpinButton.update();
        if (workspaceIndexSpinButton.timeout_id) {
            GLib.Source.remove(workspaceIndexSpinButton.timeout_id);
        }
        workspaceIndexSpinButton.timeout_id = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
                500,
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
    const cwUI = GNOME40 ?
                    _loadUI('corner-widget-40.ui') :
                    _loadUI('corner-widget.ui')
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
            transient_for: GNOME40 ?
                                notebook.get_root() :
                                notebook.get_toplevel(),
            use_header_bar: true,
            modal: true
        });

        dialog.add_button(_('_Cancel'), Gtk.ResponseType.CANCEL);
        dialog._addButton = dialog.add_button(_('_Add'), Gtk.ResponseType.OK);
        dialog.set_default_response(Gtk.ResponseType.OK);

        const grid = new Gtk.Grid({
            margin_start:   10,
            margin_end:     10,
            margin_top:     10,
            margin_bottom:  10,
            column_spacing: 10,
            row_spacing:    15
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
        GNOME40 ?
            dialog.get_content_area().append(grid) :
            dialog.get_content_area().add(grid);
        dialog._appChooser.connect('application-selected', (w, appInfo) => {
                cmdLabel.set_text(appInfo.get_commandline());
            }
        );
        GNOME40 ? dialog.show()
                : dialog.show_all();
        return dialog;
    }