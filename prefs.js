/* Copyright 2021 GdH <georgdh@gmail.com>
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
'use strict'
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
    prefsWidget.attach(notebook, 0, 0, 1, 1);

    const display = Gdk.Display.get_default();
    let num_monitors = GNOME40 ?
                            display.get_monitors().get_n_items() :
                            display.get_n_monitors();

    const cornerWidgets = [];

    for (let monitorIndex = 0; monitorIndex < num_monitors; ++monitorIndex) {
        const monitor = GNOME40 ?
                            display.get_monitors().get_item(monitorIndex) :
                            display.get_monitor(monitorIndex);
        const geometry = monitor.get_geometry();

        let mouseSettings = Settings.getSettings(
                                'org.gnome.desktop.peripherals.mouse',
                                '/org/gnome/desktop/peripherals/mouse/');
        let leftHandMouse = mouseSettings.get_boolean('left-handed');

        let corners = Settings.Corner.forMonitor(monitorIndex, monitorIndex, geometry);
        let grid = [];
        for (let i =0; i < corners.length; i++) {
            grid[i] = new Gtk.Grid({
                column_homogeneous: false,
                row_homogeneous: false,
                margin_start:   10,
                margin_end:     10,
                margin_top:     10,
                margin_bottom:  10,
                column_spacing: 10
            });
        }

        const triggersBook = new Gtk.Notebook();

        for (let i =0; i < corners.length; i++) {
            // bacause of thousands of items total in combo boxes, prefs window start was very slow
            // therefore render just the first corner page before the window is shown to user
            // the rest of pages will be rendered little bit later, but all the user will notice is 4*monitors times faster start
            GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                        i*300+(300*corners[i].monitorIndex),
                () => {
                    _buildCorner(corners[i], grid[i], geometry, leftHandMouse);
                    return false;
                });
        }
        for (let i = 0; i < corners.length; i++){
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
    let label = new Gtk.Label({ label: _('Options'), halign: Gtk.Align.START});
    notebook.append_page(_buildMscOptions(), label);

    if (!GNOME40) prefsWidget.show_all();
    return prefsWidget;
}

function _buildCorner(corner, grid, geometry, leftHandMouse) {
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
                if (WAYLAND && (trigger === Settings.Triggers.PRESSURE)) {
                    ctrlBtn.tooltip_text = ('Doesn\'t work with Wayland for Hot triggers\n') + 
                                            ctrlBtn.tooltip_text;
                }
                ctrlBtn.connect('notify::active', () =>{
                    corner.setCtrl(trigger, ctrlBtn.active);
                });
                ctrlBtn.set_active(corner.getCtrl(trigger));

                const cw = _buildCornerWidget(corner, trigger, geometry);
                const trgIcon = new Gtk.Image({
                    halign: Gtk.Align.START,
                    margin_start: 10,
                    vexpand: true,
                    hexpand: true,
                    pixel_size: 40
                });
                let iconPath;
                if (trigger === 0) {
                    iconPath = `${Me.dir.get_path()}/icons/${corner.top ? 'Top':'Bottom'}${corner.left ? 'Left':'Right'}.svg`
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
                grid.attach(trgIcon, 0, trigger, 1, 1);
                grid.attach(ctrlBtn, 1, trigger, 1, 1);
                grid.attach(cw, 2, trigger, 1, 1);
            }

            const ew = _buildExpandWidget(corner);
            grid.attach(ew, 0, 6, 3, 1);
            if (!GNOME40) grid.show_all();
}

function _buildMscOptions() {
    const mscOptions = new Settings.MscOptions();

    let miscUI = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing:       10,
        homogeneous: false,
        margin_start:  12,
        margin_end:    12,
        margin_top:    12,
        margin_bottom: 12
    });

    let optionsList = [];

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Global options:')),
            null,
            null));

    let watchCornersSwitch = _newGtkSwitch();
    optionsList.push(
        _optionsItem(
            _('Watch hot corners for external overrides'),
            _('Update corners when something (usualy other extensions) change them'),
            watchCornersSwitch)
    );

    let fullscreenGlobalSwitch = _newGtkSwitch();
    optionsList.push(
        _optionsItem(
                _('Enable all corner triggers in fullscreen mode'),
                _('When off, each trigger can be set independently'),
                fullscreenGlobalSwitch)
    );

    let actionDelayAdjustment = new Gtk.Adjustment({
            upper:          1000,
            step_increment:   10,
            page_increment:   10 });
    let actionDelaySpinBtn = new Gtk.SpinButton({
        halign: Gtk.Align.END,
        hexpand: true,
        xalign: 0.5
    });
        actionDelaySpinBtn.set_adjustment(actionDelayAdjustment);

    optionsList.push(
        _optionsItem(
            _('Minimum delay between actions (ms)'),
            _('Prevents accidental double-action. Ignored by volume control'),
            actionDelaySpinBtn));

    let rippleAnimationSwitch = _newGtkSwitch();
    optionsList.push(
        _optionsItem(
            _('Show ripple animations'),
            _('When you trigger an action, ripples are animated in the corner'),
            rippleAnimationSwitch));

    let barrierFallbackSwitch = _newGtkSwitch();
    optionsList.push(
        _optionsItem(
            _('Use fallback hot corner triggers'),
            _('When pressure barriers don`t work, on virtual systems for example'),
            barrierFallbackSwitch));
    
    let cornersVisibleSwitch = _newGtkSwitch();
    optionsList.push(
        _optionsItem(
            _('Make active corners / edges visible'),
            _('Pressure barriers are not included'),
            cornersVisibleSwitch));

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Workspace switcher:')),
            null,
            null));

    let wrapWsSwitch = _newGtkSwitch();
    optionsList.push(
        _optionsItem(
            _('Wraparound'),
            null,
            wrapWsSwitch));

    let ignoreLastWsSwitch = _newGtkSwitch();
    optionsList.push(
        _optionsItem(
            _('Ignore last (empty) workspace'),
            null,
            ignoreLastWsSwitch));

    let wsIndicatorSwitch = _newGtkSwitch();
    optionsList.push(
        _optionsItem(
            _('Show workspace indicator while switching'),
            null,
            wsIndicatorSwitch));

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Window switcher:')),
            null,
            null));

    let winWrapSwitch = _newGtkSwitch();
    optionsList.push(
        _optionsItem(
            _('Wraparound'),
            null,
            winWrapSwitch));

    let winSkipMinimizedSwitch = _newGtkSwitch();
    optionsList.push(
        _optionsItem(
            _('Skip minimized'),
            null,
            winSkipMinimizedSwitch));
    let frame;
    let frameBox;
    for (let item of optionsList) {
        if (!item[0][1]) {
            let lbl = new Gtk.Label();
                lbl.set_markup(item[0][0]);
            frame = new Gtk.Frame({
                label_widget: lbl
            });
            frameBox = new Gtk.ListBox({
                selection_mode: null,
                can_focus: false,
            });
            if (GNOME40) {
                miscUI.append(frame);
                frame.set_child(frameBox);
            } else {
                miscUI.add(frame);
                frame.add(frameBox);
            }
            continue;
        }
        let box = new Gtk.Box({
            can_focus: false,
            orientation: Gtk.Orientation.HORIZONTAL,
            margin_start: 4,
            margin_end:   4,
            margin_top:   4,
            margin_bottom:4,
            hexpand: true,
            spacing: 20,
        });
        for (let i of item[0]) {
            GNOME40 ?
                box.append(i) :
                box.add(i);
        }
        if (item.length === 2) box.set_tooltip_text(item[1]);
        GNOME40 ?
            frameBox.append(box):
            frameBox.add(box);
    }

    watchCornersSwitch.active = mscOptions.watchCorners;
    watchCornersSwitch.connect('notify::active', () => {
                mscOptions.watchCorners = watchCornersSwitch.active;
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
    actionDelaySpinBtn.value = mscOptions.actionEventDelay;
    actionDelaySpinBtn.timeout_id = null;
    actionDelaySpinBtn.connect('value-changed', () => {
                actionDelaySpinBtn.update();
                if (actionDelaySpinBtn.timeout_id) {
                    GLib.Source.remove(actionDelaySpinBtn.timeout_id);
                }
                actionDelaySpinBtn.timeout_id = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    500,
                    () => {
                        mscOptions.actionEventDelay = actionDelaySpinBtn.value;
                        actionDelaySpinBtn.timeout_id = null;
                        return false;
                    }
                );
            });

    rippleAnimationSwitch.active = mscOptions.rippleAnimation;
    rippleAnimationSwitch.connect('notify::active', () =>{
                mscOptions.rippleAnimation = rippleAnimationSwitch.active;
            });

    return miscUI;
}

function _buildCornerWidget(corner, trigger, geometry) {

    const cw = new Gtk.Grid({
        valign: Gtk.Align.CENTER
    });

    const popupGrid = new Gtk.Grid({
        margin_start:  10,
        margin_end:    10,
        margin_top:    10,
        margin_bottom: 10,
        column_spacing: 12,
        row_spacing: 8
    });

    const comboGrid = new Gtk.Grid();
    const cmdGrid = new Gtk.Grid({
        margin_top: 8
    });

    const commandEntryRevealer = new Gtk.Revealer({
        child: cmdGrid
    });

    const wsIndexAdjustment = new Gtk.Adjustment({
        lower:           1,
        upper:         256,
        step_increment:  1,
        page_increment: 10
    });
    const workspaceIndexSpinButton = new Gtk.SpinButton({
        margin_top: 8,
        xalign: 0.5
    });
    const wsIndexRevealer = new Gtk.Revealer({
        child: workspaceIndexSpinButton
    });
    workspaceIndexSpinButton.set_adjustment(wsIndexAdjustment);
    const commandEntry = new Gtk.Entry({
        hexpand: true});
    const appButton = new Gtk.Button({
        valign: Gtk.Align.END,
        margin_start: 4
    });

    const actionTreeStore = new Gtk.TreeStore();
    actionTreeStore.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_STRING
    ]);

    const actionCombo = new Gtk.ComboBox({
        model: actionTreeStore,
        id_column: 0,
        hexpand: true
    });

    const cornerPopover = new Gtk.Popover();
    const settingsBtn = new Gtk.MenuButton({
        popover: cornerPopover,
        valign: Gtk.Align.CENTER,
        margin_start: 4
    });


    if (GNOME40) {
        // Gtk3 implement button icon as added Gtk.Image child, Gtk4 does not
        settingsBtn.set_icon_name('emblem-system-symbolic');
        appButton.set_icon_name('find-location-symbolic');
    } else {
        settingsBtn.add(Gtk.Image.new_from_icon_name('emblem-system-symbolic', Gtk.IconSize.BUTTON));
        appButton.add(Gtk.Image.new_from_icon_name('find-location-symbolic', Gtk.IconSize.BUTTON));
    }

    cmdGrid.attach(commandEntry, 0, 0, 1, 1);
    cmdGrid.attach(appButton, 1, 0, 1, 1);

    comboGrid.attach(actionCombo, 0, 0, 1, 1);
    comboGrid.attach(settingsBtn, 1, 0, 1, 1);

    const fullscreenLabel = new Gtk.Label({
        label: _('Enable in fullscreen mode'),
        halign: Gtk.Align.START
    });
    const fullscreenSwitch = _newGtkSwitch();

    popupGrid.attach(fullscreenLabel, 0, 0, 1, 1);
    popupGrid.attach(fullscreenSwitch, 1, 0, 1, 1);
    if (!GNOME40) {
        popupGrid.show_all();
        cornerPopover.add(popupGrid);
    } else cornerPopover.set_child(popupGrid);
    fullscreenSwitch.active = corner.getFullscreen(trigger);
    fullscreenSwitch.connect('notify::active', () => {
        corner.setFullscreen(trigger, fullscreenSwitch.active);
    });

    cw.attach(comboGrid, 0, 0, 1, 1);
    cw.attach(commandEntryRevealer, 0, 1, 1, 1);
    cw.attach(wsIndexRevealer, 0, 2, 1, 1);

    _fillCombo(actionTreeStore, actionCombo, corner, trigger);

    let comboRenderer = new Gtk.CellRendererText();

    actionCombo.pack_start(comboRenderer, true);
    actionCombo.add_attribute(comboRenderer, "text", 1);
    actionCombo.set_cell_data_func(comboRenderer,
        (clayout, cell, model, iter) => {
            let sensitive = !model.iter_has_child(iter);
            cell.set_sensitive(sensitive);
        }
    );

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
            wsIndexRevealer.reveal_child = corner.getAction(trigger) === 'moveToWorkspace';
        }
    });

    if (trigger === Settings.Triggers.PRESSURE) {
        const barrierLabelH = new Gtk.Label({
            label: _('Barrier size - Horizontal'),
            halign: Gtk.Align.START
        });
        const barrierLabelV = new Gtk.Label({
            label: _('Barrier size - Vertical'),
            halign: Gtk.Align.START
        });
        const pressureLabel = new Gtk.Label({
            label: _('Pressure Threshold'),
            halign: Gtk.Align.START
        });
        const barrierAdjustmentH = new Gtk.Adjustment({
            lower: 1,
            upper: geometry.width,
            step_increment: 10,
            page_increment: 100
        });
        const barrierAdjustmentV = new Gtk.Adjustment({
            lower: 1,
            upper: geometry.height,
            step_increment: 10,
            page_increment: 100
        });
        const pressureThresholdAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 800,
            step_increment: 10,
            page_increment: 100
        });
        const barrierSizeSpinButtonH = new Gtk.SpinButton({
            adjustment: barrierAdjustmentH,
            numeric: true,
            xalign: 0.5,
            halign: Gtk.Align.END,
            hexpand: true
        });
        const barrierSizeSpinButtonV = new Gtk.SpinButton({
            adjustment: barrierAdjustmentV,
            numeric: true,
            xalign: 0.5,
            halign: Gtk.Align.END,
            hexpand: true
        });
        const pressureThresholdSpinButton = new Gtk.SpinButton({
            adjustment: pressureThresholdAdjustment,
            numeric: true,
            xalign: 0.5,
            halign: Gtk.Align.END,
            hexpand: true
        });
        popupGrid.attach(barrierLabelH,               0, 1, 1, 1);
        popupGrid.attach(barrierSizeSpinButtonH,      1, 1, 1, 1);
        popupGrid.attach(barrierLabelV,               0, 2, 1, 1);
        popupGrid.attach(barrierSizeSpinButtonV,      1, 2, 1, 1);
        popupGrid.attach(pressureLabel,               0, 3, 1, 1);
        popupGrid.attach(pressureThresholdSpinButton, 1, 3, 1, 1);

        if (!GNOME40) popupGrid.show_all();


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

    if (!GNOME40) cw.show_all();
    return cw;
}

function _fillCombo(actionTreeStore, actionCombo, corner, trigger) {
    let iterDict = {};
    let iter, iter2;
    for (let i = 0; i < _actions.length; i++){
        let item = _actions[i];
        if (GNOME40 && _d40exclude.indexOf(item[1]) > -1) continue;
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

    if (iterDict[corner.getAction(trigger)]) actionCombo.set_active_iter(iterDict[corner.getAction(trigger)]);
}

function _buildExpandWidget (corner) {
    const ew = new Gtk.Grid({
        row_spacing:     8,
        column_spacing: 40,
        margin_start:   10,
        margin_end:     10,
        margin_top:     10,
        margin_bottom:  10,
        halign: Gtk.Align.END
    });
    const expTitle = new Gtk.Label({
        use_markup: true,
        label: _makeTitle(_("Expand clickable corner along edges:")),
        
    });
    const frame = new Gtk.Frame({
        tooltip_text: 
                      _('When adjacent corners are set to expand along the same edge, each of them allocate a half of the edge') + '\n'
                    + _("Activate 'Make active corners/edges visible' option to see it") + '\n'
                    + _('Hot corner pressure barriers can be set independently')
    });
          frame.set_label_widget(expTitle);
    const hIcon = new Gtk.Image({
                    halign: Gtk.Align.START,
                    margin_start: 10,
                    //vexpand: true,
                    hexpand: true,
                    pixel_size: 40
                });
          hIcon.set_from_file(`${Me.dir.get_path()}/icons/${corner.top ? 'Top':'Bottom'}${corner.left ? 'Left':'Right'}HE.svg`);
    const vIcon = new Gtk.Image({
                    halign: Gtk.Align.START,
                    margin_start: 10,
                    //vexpand: true,
                    hexpand: true,
                    pixel_size: 40
                });
    vIcon.set_from_file(`${Me.dir.get_path()}/icons/${corner.top ? 'Top':'Bottom'}${corner.left ? 'Left':'Right'}VE.svg`);

    const hExpandSwitch = new Gtk.Switch({
        tooltip_text: _('Expand horizonatally'),
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER
    });
    const vExpandSwitch = new Gtk.Switch({
        tooltip_text: _('Expand vertically'),
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER
    });
    ew.attach(hIcon, 0, 1, 1, 1);
    ew.attach(hExpandSwitch, 1, 1, 1, 1);
    ew.attach(vIcon, 2, 1, 1, 1);
    ew.attach(vExpandSwitch, 3, 1, 1, 1);
    hExpandSwitch.active = corner.hExpand;
    vExpandSwitch.active = corner.vExpand;
    hExpandSwitch.connect('notify::active', () => {
        corner.hExpand = hExpandSwitch.active;
    });
    vExpandSwitch.connect('notify::active', () => {
        corner.vExpand = vExpandSwitch.active;
    });
    GNOME40 ?
        frame.set_child(ew):
        frame.add(ew)
    return frame;
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

function _newGtkSwitch() {
    return new Gtk.Switch({
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true
    });
}

function _optionsItem(text, tooltip, widget) {
    let item = [[],];
    let label;
    if (widget) {
        label = new Gtk.Label({
                    halign: Gtk.Align.START
        });
        label.set_markup(text);
    } else label = text;
    item[0].push(label);
    if (widget) item[0].push(widget);
    if (tooltip) item.push(tooltip);

    return item;
}

function _buildShortcusPage() {
    let model = new Gtk.ListStore();
    model.set_column_types([
            GObject.TYPE_STRING,
            GObject.TYPE_STRING,
            GObject.TYPE_INT,
            GObject.TYPE_INT
        ]);
    let treeview = new Gtk.TreeView({
            vexpand: false,
            hexpand: true,
            margin: 10,
            model: model
        });

    let cell = new Gtk.CellRendererAccel({
            editable: true,
            accel_mode: Gtk.CellRendererAccelMode.GTK
        });
        cell.connect('accel-edited', (rend, colname, key, mods) => {
            let value = Gtk.accelerator_name(key, mods);
            let [success, iter] = model.get_iter_from_string(colname);
            model.set(iter, [ 2, 3 ], [ mods, key ]);
            corner.setAccel(trigger, [value]);
            
        });
    cell.connect('accel-cleared', (rend, colname) => {
            let [success, iter] = model.get_iter_from_string(colname);
            model.set(iter, [2, 3], [0, 0]);
            corner.setAccel(trigger, []);
            
        });

    let col = new Gtk.TreeViewColumn({
            title: 'Click on line below twice and press shortcut'
        });
    col.pack_start(cell, false);
    col.add_attribute(cell, 'accel-mods', 2);
    col.add_attribute(cell, 'accel-key', 3);
    treeview.append_column(col);
    accelRevealer.add(treeview);
    let accel = corner.getAccel(trigger)[0];
    let key, mods;
    if (accel) {
        [key, mods] = Gtk.accelerator_parse(accel);
    } else {
        [key, mods] = [0, 0];
    }

    let row = model.insert(10);
    model.set(row, [0, 1, 2, 3], ['CHCE', 'CHCE', mods, key ]);
}

function _makeSmall(label) {
  return '<small>'+label+'</small>';
}
function _makeTitle(label) {
  return '<b>'+label+'</b>';
}

const _actions = [
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
        [   1, 'prevWinWsMon'    ,   _('Previous Window (this monitor)')],
        [   1, 'prevWinWS'       ,   _('Previous Window (current WS)')],
        [   1, 'prevWinAll'      ,   _('Previous Window (all)')],
        [   1, 'nextWinWsMon'    ,   _('Next Window (this monitor)')],
        [   1, 'nextWinWS'       ,   _('Next Window (current WS)')],
        [   1, 'nextWinAll'      ,   _('Next Window (all)')],

        [null, ''                ,   _('Windows - Control')],
        [   1, 'closeWin'        ,   _('Close Window')],
        [   1, 'maximizeWin'     ,   _('Maximize Window')],
        [   1, 'minimizeWin'     ,   _('Minimize Window')],
        [   1, 'fullscreenWin'   ,   _('Fullscreen Window')],
        [   1, 'aboveWin'        ,   _('Win Always on Top')],
        [   1, 'stickWin'        ,   _('Win Always on Visible WS')],

        [null, ''                ,   _('Windows - Effects')],
        [   1, 'invertLightWin'  ,   _('Invert Lightness (window)')],
        [   1, 'tintRedToggleWin',   _('Red Tint Mono (window)')],
        [   1, 'tintGreenToggleWin', _('Green Tint Mono (window)')],
        [   1, 'brightUpWin'     ,   _('Brightness Up (window)')],
        [   1, 'brightDownWin'   ,   _('Brightness Down (window)')],
        [   1, 'contrastUpWin'   ,   _('Contrast Up (window)')],
        [   1, 'contrastDownWin' ,   _('Contrast Down (window)')],
        [   1, 'opacityUpWin'    ,   _('Opacity Up (window)')],
        [   1, 'opacityDownWin'  ,   _('Opacity Down (window)')],
        [   1, 'opacityToggleWin',   _('Toggle Transparency (window)')],
        [   1, 'desaturateWin'   ,   _('Desaturate (window)')],

        [null, ''                ,   _('Global Effects')],
        [   1, 'toggleNightLight',   _('Toggle Night Light (Display settings)')],
        [   1, 'invertLightAll'  ,   _('Invert Lightness (global)')],
        [   1, 'tintRedToggleAll',   _('Red Tint Mono (global)')],
        [   1, 'tintGreenToggleAll', _('Green Tint Mono (global)')],
        [   1, 'brightUpAll'     ,   _('Brightness Up (global)')],
        [   1, 'brightDownAll'   ,   _('Brightness Down (global)')],
        [   1, 'contrastUpAll'   ,   _('Contrast Up (global)')],
        [   1, 'contrastDownAll' ,   _('Contrast Down (global)')],
        [   1, 'desaturateAll'   ,   _('Desaturate (global)')],
        [   1, 'removeAllEffects',   _('Remove All Effects')],

        [null, ''                ,   _('Universal Access')],
        [   1, 'toggleZoom'      ,   _('Toggle Zoom')],
        [   1, 'zoomIn'          ,   _('Zoom In')],
        [   1, 'zoomOut'         ,   _('Zoom Out')],
        [   1, 'screenReader'    ,   _('Screen Reader')],
        [   1, 'largeText'       ,   _('Large Text')],
        [   1, 'keyboard'        ,   _('Screen Keyboard')],

        [null, ''                ,   _('Gnome Shell')],
        [   1, 'hidePanel'       ,   _('Hide/Show Main Panel')],
        [   1, 'toggleTheme'     ,   _('Toggle Light/Dark Theme')],

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

const _d40exclude = [
                        'invertLightAll',
                        'invertLightWin',
]





