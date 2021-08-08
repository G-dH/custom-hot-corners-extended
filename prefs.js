/* Copyright 2021 GdH <georgdh@gmail.com>
 * This is a part of Custom Hot Corners - Extended, the Gnome Shell extension
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
const {Gtk, Gdk, GLib, GObject} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;
const triggers       = Settings.listTriggers();
const triggerLabels  = Settings.TriggerLabels;
const actionList     = Settings.actionList;
let   mscOptions;
let   _excludedItems = [];
let   notebook;

// gettext
const _  = Settings._;

let GNOME40;
let WAYLAND;

function init() {
    //log(`initializing ${Me.metadata.name} Preferences`);
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    GNOME40 = Settings.GNOME40;
    WAYLAND = GLib.getenv('XDG_SESSION_TYPE') === 'wayland';
    const AATWS = Settings.extensionEnabled('advanced-alt-tab@G-dH.github.com') || Settings.extensionEnabled('advanced-alt-tab@G-dH.github.com-dev');
    mscOptions = new Settings.MscOptions();
    if (!AATWS) {
        _excludedItems.push('win-switcher-popup-ws');
        _excludedItems.push('win-switcher-popup-mon');
        _excludedItems.push('win-switcher-popup-ws-first');
        _excludedItems.push('win-switcher-popup-apps');
        _excludedItems.push('win-switcher-popup-class');
        _excludedItems.push('win-switcher-popup-search');
        _excludedItems.push('prev-workspace-popup');
        _excludedItems.push('next-workspace-popup');
    }
}

function buildPrefsWidget() {
    const prefsWidget = new Gtk.Grid({visible: true});
    notebook = new Gtk.Notebook({
        tab_pos: Gtk.PositionType.LEFT,
        visible: true
    });
    
    prefsWidget.attach(notebook, 0, 0, 1, 1);

    const display = Gdk.Display.get_default();
    let num_monitors = display.get_monitors ?
                            display.get_monitors().get_n_items() :
                            display.get_n_monitors();

    let mouseSettings = Settings.getSettings(
                                'org.gnome.desktop.peripherals.mouse',
                                '/org/gnome/desktop/peripherals/mouse/');
    let leftHandMouse = mouseSettings.get_boolean('left-handed');

    for (let monitorIndex = 0; monitorIndex < num_monitors; ++monitorIndex) {
        const monitor = display.get_monitors ?
                            display.get_monitors().get_item(monitorIndex) :
                            display.get_monitor(monitorIndex);
        const geometry = monitor.get_geometry();

        let corners = Settings.Corner.forMonitor(monitorIndex, monitorIndex, geometry);

        const monitorPage = new MonitorPage();
        monitorPage._monitor = monitor;
        monitorPage._corners = corners;
        monitorPage._geometry = geometry;
        monitorPage._leftHandMouse = leftHandMouse;

        let labelText = _('Monitor') + ' ' + (monitorIndex + 1) + (monitorIndex === 0? '\n' + _('(primary)') : '');
        const label = new Gtk.Label({ label: labelText, halign: Gtk.Align.START });
        notebook.append_page(monitorPage, label);
        monitorPage.connect('switch-page', (notebook, page, index) => {
            page.buildPage();
        });
    }
    const optionsPage = new OptionsPage();
    notebook.append_page(new CustomMenusPage, new Gtk.Label({ label: _('Custom')+'\n'+_('Menus'), halign: Gtk.Align.START}));
    notebook.append_page(new KeyboardPage(), new Gtk.Label({ label: _('Keyboard'), halign: Gtk.Align.START}));
    notebook.append_page(optionsPage , new Gtk.Label({ label: _('Options'), halign: Gtk.Align.START}));


    notebook.get_nth_page(0).buildPage();
    notebook.set_current_page(0);
    notebook.connect('switch-page', (notebook, page, index) => {
            page.buildPage();
    });
    /*if (!GNOME40) {
        //prefsWidget.connect('destroy', Gtk.main_quit);
    }*/
    return prefsWidget;
}

const MonitorPage = GObject.registerClass(
class MonitorPage extends Gtk.Notebook {

    _init(constructProperties = {tab_pos: Gtk.PositionType.TOP, visible: true}) {
        super._init(constructProperties);

        this._corners = [];
        this._monitor = null;
        this._geometry = null;
        this._alreadyBuilt = false;
        this._leftHandMouse = false;
    }

    buildPage() {
        if (this._alreadyBuilt) return;
        //for (let i = 0; i < this._corners.length; i++){
        for (let i = 0; i < 4; i++){
            const label = new Gtk.Image({
                    halign: Gtk.Align.CENTER,
                    valign: Gtk.Align.START,
                    margin_start: 10,
                    vexpand: true,
                    hexpand: true,
                    pixel_size: 40,
                });
            label.set_from_file(`${Me.dir.get_path()}/icons/${this._corners[i].top ? 'Top':'Bottom'}${this._corners[i].left ? 'Left':'Right'}.svg`);
            let cPage = new CornerPage();
            cPage._corner = this._corners[i];
            cPage._geometry = this._geometry;
            cPage._leftHandMouse = this._leftHandMouse;
            this.append_page(cPage, label);
            // Gtk3 notebook emits 'switch-page' signal when showing it's content for the 1. time
            // Gtk4 doesn't. Just a note, irrelevant to the actual program.

        }
        this.show_all && this.show_all();
        this._alreadyBuilt = true;
    }
});

const CornerPage = GObject.registerClass(
class CornerPage extends Gtk.Grid {

    _init(constructProperties = {
                column_homogeneous: false,
                row_homogeneous: false,
                margin_start:   10,
                margin_end:     10,
                margin_top:     20,
                margin_bottom:  10,
                column_spacing: 10,
                row_spacing:    10,
          }) {

        super._init(constructProperties);

        this._alreadyBuilt = false;
        this._corner = null;
        this._geometry = null;
        this._leftHandMouse = false;
    }

    buildPage() {
        if (this._alreadyBuilt) return false;
        this._alreadyBuilt = true;
        for (let trigger of triggers) {

            const ctrlBtn = new Gtk.CheckButton({
            //const ctrlBtn = new Gtk.ToggleButton(
                    label: _('Ctrl'),
                    halign: Gtk.Align.START,
                    valign: Gtk.Align.CENTER,
                    vexpand: false,
                    hexpand: false,
                    tooltip_text: _('When checked, pressed Ctrl key is needed to trigger the action'),
                    margin_bottom : 10,
            });

            ctrlBtn.connect('notify::active', ()=> {
                this._corner.setCtrl(trigger, ctrlBtn.active);
            });
            ctrlBtn.set_active(this._corner.getCtrl(trigger));
            const cw = this._buildTriggerWidget(trigger);
            const trgIcon = new Gtk.Image({
                halign: Gtk.Align.START,
                margin_start: 10,
                margin_bottom : 10,
                vexpand: true,
                hexpand: true,
                pixel_size: 40,
            });
            let iconPath;
            if (trigger === 0) {
                iconPath = `${Me.dir.get_path()}/icons/${this._corner.top ? 'Top':'Bottom'}${this._corner.left ? 'Left':'Right'}.svg`
            } else {
                let iconIdx = trigger;
                if (this._leftHandMouse) {
                    if (trigger === 1) iconIdx = 2;
                    if (trigger === 2) iconIdx = 1;
                }
                iconPath = `${Me.dir.get_path()}/icons/Mouse-${iconIdx}.svg`;
            }
            trgIcon.set_from_file(iconPath);
            trgIcon.set_tooltip_text(triggerLabels[trigger]);
            this.attach(trgIcon, 0, trigger, 1, 1);
            this.attach(ctrlBtn, 1, trigger, 1, 1);
            this.attach(cw,      2, trigger, 1, 1);
        }
        const ew = this._buildExpandsionWidget();
        this.attach(ew, 0, 7, 3, 1);
        this.show_all && this.show_all();

        this._alreadyBuilt = true;
    }

    _buildTriggerWidget(trigger) {
        const cw = new Gtk.Grid({
            valign: Gtk.Align.CENTER,
            margin_bottom : 10,
        });
    
        const popupGrid = new Gtk.Grid({
            margin_start:  10,
            margin_end:    10,
            margin_top:    10,
            margin_bottom: 10,
            column_spacing: 12,
            row_spacing: 8,
            visible: true
        });
    
        const comboGrid = new Gtk.Grid();
        const cmdGrid = new Gtk.Grid({
            margin_top: 8,
            visible: true
        });
    
        const commandEntryRevealer = new Gtk.Revealer({
            child: cmdGrid,
            visible: true
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

        // Gtk3 implements button icon as an added Gtk.Image child, Gtk4 does not
        if (settingsBtn.set_icon_name) {
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
    
        cw.attach(comboGrid, 0, 0, 1, 1);
        cw.attach(commandEntryRevealer, 0, 1, 1, 1);
        cw.attach(wsIndexRevealer, 0, 2, 1, 1);

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
        let cmdBtnConnected = false;
        let _connectCmdBtn = function() {
                if (cmdBtnConnected) return;
                appButton.connect('clicked', () => {
                    function fillCmdEntry () {
                        let appInfo = dialog._appChooser.get_app_info();
                            if (!appInfo) return;
                            commandEntry.text = appInfo.get_commandline().replace(/ %.$/, '');
                            dialog.destroy();
                    }
                    const dialog = this._chooseAppDialog();
                    dialog._appChooser.connect('application-activated', () => {
                        fillCmdEntry(dialog, commandEntry);
                    });
                    dialog.connect('response', (dlg, id) => {
                        if (id !== Gtk.ResponseType.OK) {
                            dialog.destroy();
                            return;
                        }
                        fillCmdEntry();
                    cmdBtnConnected = true;
                    });
                });
        }.bind(this);
        //commandEntryRevealer.reveal_child = this._corner.getAction(trigger) === 'runCommand';
        //if (commandEntryRevealer.reveal_child) _connectCmdBtn();
        //commandEntry.text = this._corner.getCommand(trigger);
    

        actionCombo.connect('changed', () => {
            this._corner.setAction(trigger, actionCombo.get_active_id());
            commandEntryRevealer.reveal_child = this._corner.getAction(trigger) === 'run-command';
            wsIndexRevealer.reveal_child = this._corner.getAction(trigger) === 'move-to-workspace';
            if (this._corner.getAction(trigger) === 'run-command' && !cmdConnected) {
                _connectCmdBtn();
                commandEntry.text = this._corner.getCommand(trigger);
                commandEntryRevealer.reveal_child = this._corner.getAction(trigger) === 'run-command';
                commandEntry.timeout_id = null;
                commandEntry.connect('changed', () => {
                    if (commandEntry.timeout_id) {
                        GLib.Source.remove(commandEntry.timeout_id);
                    }
                    commandEntry.timeout_id = GLib.timeout_add(
                        GLib.PRIORITY_DEFAULT,
                        500,
                        () => {
                            this._corner.setCommand(trigger, commandEntry.text);
                            commandEntry.timeout_id = null;
                            return GLib.SOURCE_REMOVE;
                        }
                    );
                });
                wsIndexRevealer.reveal_child = this._corner.getAction(trigger) === 'move-to-workspace';
                cmdConnected = true;
            }
        });
        this._fillCombo(actionTreeStore, actionCombo, trigger);
        workspaceIndexSpinButton.value = this._corner.getWorkspaceIndex(trigger);
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
                        this._corner.setWorkspaceIndex(trigger, workspaceIndexSpinButton.value);
                        workspaceIndexSpinButton.timeout_id = null;
                        return GLib.SOURCE_REMOVE;
                    }
            );
        });
    

        const fullscreenLabel = new Gtk.Label({
            label: _('Enable in fullscreen mode'),
            halign: Gtk.Align.START
        });
        const fullscreenSwitch = _newGtkSwitch();
    
        popupGrid.attach(fullscreenLabel, 0, 0, 1, 1);
        popupGrid.attach(fullscreenSwitch, 1, 0, 1, 1);

        popupGrid.show_all && popupGrid.show_all();
        cornerPopover[cornerPopover.add?'add':'set_child'](popupGrid);

        fullscreenSwitch.active = this._corner.getFullscreen(trigger);
        fullscreenSwitch.connect('notify::active', () => {
            this._corner.setFullscreen(trigger, fullscreenSwitch.active);
        });

        if (trigger === Settings.Triggers.PRESSURE) {
            this._buildPressureSettings(popupGrid);
        }
   
        cw.show_all && cw.show_all();
        return cw;
    }

    _fillCombo(actionTreeStore, actionCombo, trigger) {
        let iterDict = {};
        let iter, iter2;
        for (let i = 0; i < actionList.length; i++){
            let item = actionList[i];
            if (_excludedItems.indexOf(item[1]) > -1) continue;
            if (!item[0]){
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
        // action keys has been changed, translate old keys to new and store them
        // will be removed from the next version
        let action = this._corner.getAction(trigger);
        if (Settings.transitionMap.has(action)) {
            action = Settings.transitionMap.get(action);
        }
        if (iterDict[action]) {
            actionCombo.set_active_iter(iterDict[action]);
        }
    }


    _buildPressureSettings(popupGrid) {
        const pressureLabel = new Gtk.Label({
            label: _('Pressure Threshold'),
            halign: Gtk.Align.START
        });
        const pressureThresholdAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 800,
            step_increment: 10,
            page_increment: 100
        });
        const pressureThresholdSpinButton = new Gtk.SpinButton({
            adjustment: pressureThresholdAdjustment,
            numeric: true,
            xalign: 0.5,
            halign: Gtk.Align.END,
            hexpand: true
        });
        popupGrid.attach(pressureLabel,               0, 3, 1, 1);
        popupGrid.attach(pressureThresholdSpinButton, 1, 3, 1, 1);

        popupGrid.show_all && popupGrid.show_all();

        pressureThresholdSpinButton.value = this._corner.pressureThreshold;
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
                    this._corner.pressureThreshold = pressureThresholdSpinButton.value;
                    pressureThresholdSpinButton.timeout_id = null;
                    return GLib.SOURCE_REMOVE;
                }
            );
        });
    }

    _buildExpandsionWidget() {
        const grid = new Gtk.Grid({
            row_spacing:     8,
            column_spacing:  8,
            margin_start:   10,
            margin_end:     10,
            margin_top:     10,
            margin_bottom:  10,
            halign: Gtk.Align.FILL,
            visible: true
        });
        const expTitle = new Gtk.Label({
            use_markup: true,
            label: _makeTitle(_("Corner to edge expansions: ")),
            tooltip_text: _("You can activate 'Make active corners/edges visible' option in Options page to see the results of this settings.")
            
        });
        const frame = new Gtk.Frame({
            
        });

        frame.set_label_widget(expTitle);

        const hIcon = new Gtk.Image({
                        halign: Gtk.Align.START,
                        tooltip_text: _('Horizontal size/expansion'),
                        hexpand: true,
                        pixel_size: 40,
                        margin_start: 10,
                    });
              hIcon.set_from_file(`${Me.dir.get_path()}/icons/${this._corner.top ? 'Top':'Bottom'}${this._corner.left ? 'Left':'Right'}HE.svg`);
        const vIcon = new Gtk.Image({
                        halign: Gtk.Align.START,
                        tooltip_text: _('Vertical size/expansion'),
                        hexpand: true,
                        pixel_size: 40,
                        margin_start: 10,
                    });
        vIcon.set_from_file(`${Me.dir.get_path()}/icons/${this._corner.top ? 'Top':'Bottom'}${this._corner.left ? 'Left':'Right'}VE.svg`);

        const b = this._buildBarrierSizeAdjustment();
        const c = this._buildClickExpansionAdjustment();

        grid.attach(b[0],   0, 0,  1, 1);
        grid.attach(hIcon,  1, 0,  1, 2);
        grid.attach(b[1],   2, 0, 10, 1);
        grid.attach(vIcon, 12, 0,  1, 2);
        grid.attach(b[2],  13, 0, 10, 1);

        grid.attach(c[0],  0, 1,  1, 1);
        grid.attach(c[1],  2, 1, 10, 1);
        grid.attach(c[2], 13, 1, 10, 1);
        

        frame[frame.add?'add':'set_child'](grid);
        return frame;
    }

    _buildBarrierSizeAdjustment() {
        const label = new Gtk.Label({
                        label: _('Barrier size:'),
                        tooltip_text: _('Set horizontal and vertical size of the barrier that reacts to the mouse pointer pressure (hot corner).') + '\n' +
                                      _('Size can be set in percentage of the screen width and height.'),
                        halign: Gtk.Align.START
        })
        const barrierLabelH = new Gtk.Label({
            label: _('Barrier Size - Horizontal'),
            halign: Gtk.Align.START,
            margin_bottom : 10
        });

        const barrierAdjustmentH = new Gtk.Adjustment({
            lower: 1,
            //upper: this._geometry.width,
            upper: 98,
            step_increment: 1,
            page_increment: 1
        });
        const barrierAdjustmentV = new Gtk.Adjustment({
            lower: 1,
            //upper: this._geometry.height,
            upper: 98,
            step_increment: 1,
            page_increment: 1
        });
        const barrierSizeSliderH = new Gtk.Scale({
            adjustment: barrierAdjustmentH,
            digits: 0,
            draw_value: true,
            has_origin: true,
            tooltip_text: _('Horizontal pressure barrier size in % of monitor width'),
            halign: Gtk.Align.FILL,
            hexpand: true
        });
        barrierSizeSliderH.add_mark(25, Gtk.PositionType.BOTTOM, null);
        barrierSizeSliderH.add_mark(50, Gtk.PositionType.BOTTOM, null);
        barrierSizeSliderH.add_mark(75, Gtk.PositionType.BOTTOM, null);

        const barrierSizeSliderV = new Gtk.Scale({
            adjustment: barrierAdjustmentV,
            digits: 0,
            draw_value: true,
            has_origin: true,
            tooltip_text: _('Vertical pressure barrier size in % of monitor height'),
            halign: Gtk.Align.FILL,
            hexpand: true
        });
        barrierSizeSliderV.add_mark(25, Gtk.PositionType.BOTTOM, null);
        barrierSizeSliderV.add_mark(50, Gtk.PositionType.BOTTOM, null);
        barrierSizeSliderV.add_mark(75, Gtk.PositionType.BOTTOM, null);

        barrierSizeSliderH.set_value(this._corner.barrierSizeH);
        barrierSizeSliderH.timout_id = null;
        barrierSizeSliderH.connect('value-changed', () => {
            // Cancel previous timeout
            if (barrierSizeSliderH.timeout_id) {
                GLib.Source.remove(barrierSizeSliderH.timeout_id);
            }
            barrierSizeSliderH.timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
                () => {
                    this._corner.barrierSizeH = barrierSizeSliderH.get_value();
                    barrierSizeSliderH.timeout_id = null;
                    return GLib.SOURCE_REMOVE;
                }
            );
        });
        barrierSizeSliderV.set_value(this._corner.barrierSizeV);
        barrierSizeSliderV.timout_id = null;
        barrierSizeSliderV.connect('value-changed', () => {
            // Cancel previous timeout
            if (barrierSizeSliderV.timeout_id) {
                GLib.Source.remove(barrierSizeSliderV.timeout_id);
            }
            barrierSizeSliderV.timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
                () => {
                    this._corner.barrierSizeV = barrierSizeSliderV.get_value();
                    barrierSizeSliderV.timeout_id = null;
                    return GLib.SOURCE_REMOVE;
                }
            );
        });

        return [label, barrierSizeSliderH, barrierSizeSliderV];
    }

    _buildClickExpansionAdjustment() {
        const label = new Gtk.Label({
                        label: _('Expand click area:'),
                        tooltip_text:
                          _('Expand the area reactive to mouse clicks and scrolls along the edge of the monitor.') + '\n'
                        + _('When adjacent corners are set to expand along the same edge, each of them allocate a half of the edge'),
                        halign: Gtk.Align.START
        });

        const hExpandSwitch = new Gtk.Switch({
            tooltip_text: _('Expand horizonatally'),
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER
        });
        const vExpandSwitch = new Gtk.Switch({
            tooltip_text: _('Expand vertically'),
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER
        });

        hExpandSwitch.active = this._corner.hExpand;
        vExpandSwitch.active = this._corner.vExpand;
        hExpandSwitch.connect('notify::active', () => {
            this._corner.hExpand = hExpandSwitch.active;
        });
        vExpandSwitch.connect('notify::active', () => {
            this._corner.vExpand = vExpandSwitch.active;
        });
        return [label, hExpandSwitch, vExpandSwitch];
    }

    _chooseAppDialog() {
        const dialog = new Gtk.Dialog({
            title: (_('Choose Application')),
            transient_for:      notebook.get_root   ?
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
            row_spacing:    15,
            visible: true
        });
        dialog._appChooser = new Gtk.AppChooserWidget({
            show_all: true,
            hexpand: true,
            visible :true
        });
        let appInfo = dialog._appChooser.get_app_info();
        grid.attach(dialog._appChooser, 0, 0, 2, 1);
        const cmdLabel = new Gtk.Label({
            label:"",
            wrap: true,
            visible :true
        });
        grid.attach(cmdLabel, 0, 1, 2, 1);
        dialog.get_content_area()[dialog.get_content_area().add ? 'add' : 'append'](grid);
        dialog._appChooser.connect('application-selected', (w, appInfo) => {
                cmdLabel.set_text(appInfo.get_commandline());
            }
        );
        dialog.show();
        return dialog;
    }
});

const KeyboardPage = GObject.registerClass(
class KeyboardPage extends Gtk.ScrolledWindow {

    _init(params) {
        super._init({margin_start: 12, margin_end: 12, margin_top: 12, margin_bottom: 12, visible: true});
        this._alreadyBuilt = false;
    }

    buildPage() {
        if (this._alreadyBuilt) return false;

        this.grid = new Gtk.Grid({margin_top: 6, hexpand: true, visible: true});
        let lbl = new Gtk.Label({
            use_markup: true,
            label: _makeTitle(_("Keyboard Shortcuts:")),
            tooltip_text: _("Click on the Shortcut Key cell to set new shortcut.") + "\n"
                        + _("Press Backspace key instead of the new shortcut to disable shortcut.") + "\n"
                        + _("Warning: Some system shortcuts can NOT be overriden here.") + "\n"
                        + _("Warning: Shortcuts, already used in this extension, will be ignored.")
        });
        let frame = new Gtk.Frame({
                label_widget: lbl });
        this[this.add?'add':'set_child'](frame);
        frame[frame.add?'add':'set_child'](this.grid);
        this.treeView = new Gtk.TreeView({hexpand: true});
        this.grid.attach(this.treeView, 0,0,1,1);
        let model = new Gtk.TreeStore();
        model.set_column_types([ GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_INT, GObject.TYPE_INT]);
        this.treeView.model = model;
        this.keybindings = this._getKeybindingSettings();

        // Hotkey
        const actions     = new Gtk.TreeViewColumn({ title: _('Action'), expand: true });
        const nameRender  = new Gtk.CellRendererText();

        const accels      = new Gtk.TreeViewColumn({ title: _('Shortcut Key'), min_width: 150 });
        const accelRender = new Gtk.CellRendererAccel({
                                    editable: true,
                                    accel_mode: Gtk.CellRendererAccelMode.GTK, });

        actions.pack_start(nameRender, true);
        accels.pack_start(accelRender, true);

        actions.add_attribute(nameRender, 'text', 1);
        accels.add_attribute(accelRender, 'accel-mods', 2);
        accels.add_attribute(accelRender, 'accel-key', 3);

        actions.set_cell_data_func(nameRender, (column, cell, model, iter) => {
            if (!model.get_value(iter, 0)) {

            }
        });

        accels.set_cell_data_func(accelRender, (column, cell, model, iter) => {
            if (!model.get_value(iter, 0)) {
               [ cell.accel_key, cell.accel_mods ] = [45,0];
            }

        });

        accelRender.connect('accel-edited', (rend, path, key, mods) => {
            // Don't allow single key accels
            if (!mods) return;
            const value = Gtk.accelerator_name(key, mods);
            const [succ, iter] = model.get_iter_from_string(path);
            if (!succ) {
                throw new Error('Error updating keybinding');
            }
            const name = model.get_value(iter, 0);
            // exclude group items and avoid duplicate accels
            if (name && !(value in this.keybindings) && uniqueVal(this.keybindings, value)) {
                model.set(iter, [2,3], [mods, key]);
                this.keybindings[name] = [value];
                this._storeKeyBinding(name, [value]);
                Object.entries(this.keybindings).forEach(([key, value]) => {
                });
            } else {
                log(`${Me.metadata.name} This keyboard shortcut is invalid or already in use!`);
            }
        });
        const uniqueVal = function (dict, value) {
            let unique = true;
            Object.entries(dict).forEach(([key, val]) => {
                    if (value == val) {
                        unique = false;
                    }
                }
            );
            return unique;
        };

        accelRender.connect('accel-cleared', (rend, path, key, mods) => {
            const [succ, iter] = model.get_iter_from_string(path);
            if (!succ) {
                throw new Error('Error clearing keybinding');
            }
            model.set(iter, [2, 3], [0, 0]);
            const name = model.get_value(iter, 0);

            if (name in this.keybindings) {
                delete this.keybindings[name];
                this._storeKeyBinding(name, []);
            }
        });

        this._populateTreeview();
        //this.treeView.expand_all();

        this.treeView.append_column(actions);
        this.treeView.append_column(accels);

        this.show_all && this.show_all();

        return this._alreadyBuilt = true;
    }

    _getKeybindingSettings() {
        let kb = {};
        let settings = mscOptions._gsettingsKB;
        for (let key of settings.list_keys()) {
            let action = this._translateKeyToAction(key);
            kb[action] = mscOptions.getKeyBind(key);
        }
        return kb;
    }

    _populateTreeview() {
        let iter, iter2;
        for (let i = 0; i < actionList.length; i++){
            let item = actionList[i];
            if ((_excludedItems.indexOf(item[1]) > -1) || !item[3]) continue;
            let a = [0, 0];
            if (item[1] && (item[1] in this.keybindings && this.keybindings[item[1]][0])) {
                let binding = this.keybindings[item[1]][0];
                let ap = Gtk.accelerator_parse(binding);
                // Gtk4 accelerator_parse returns 3 values - the first one is bool ok/failed
                if (ap.length === 3) ap.splice(0, 1);
                if (ap[0] && ap[1]) a = [ap[1], ap[0]];
                else log (`[${Me.metadata.name}] Error: Gtk keybind conversion failed`);
            }
            if (!item[0]){
                iter  = this.treeView.model.append(null);
                if (item[0] === 0) {
                    this.treeView.model.set(iter, [0, 1, 2, 3], [item[1],item[2], ...a]);
                }
                else {
                    //this.treeView.model.set(iter, [1, 2, 3], [item[2], ...a]);
                    this.treeView.model.set(iter, [1], [item[2]]);
                }
            } else {
                iter2  = this.treeView.model.append(iter);
                this.treeView.model.set(iter2, [0, 1, 2, 3], [item[1], item[2], ...a]);
            }
        }
    }

    _storeKeyBinding(action, value) {
        let key = this._translateActionToKey(action);
        mscOptions.setKeyBind(key, value);
    }

    // the -ce extension's purpose is to make key names unique
    // in case of conflict with system shortcut, system wins
    _translateKeyToAction(key) {
        /*let regex = /-(.)/g;
        return key.replace(regex,function($0,$1) {
            return $0.replace($0, $1.toUpperCase());
        }).replace('Ce', '');*/
        let regex = /-ce$/
        return key.replace(regex, '');
    }

    _translateActionToKey(action) {
        /*let regex = /([A-Z])/g;
        return action.replace(regex,function($0, $1) {
            return $0.replace($0, `-${$1}`.toLowerCase());
        }) + '-ce';*/
        return action + '-ce';
    }
});

const OptionsPage = GObject.registerClass(
class OptionsPage extends Gtk.ScrolledWindow {

    _init(constructProperties = {   hscrollbar_policy: Gtk.PolicyType.NEVER,
                                    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                                    visible: true
                                }) {
        super._init(constructProperties);

        this._alreadyBuilt = false;
    }

    buildPage() {
        if (this._alreadyBuilt) return false;
        const mainBox = new Gtk.Box({     orientation: Gtk.Orientation.VERTICAL,
                                    spacing:       10,
                                    homogeneous:   false,
                                    margin_start:  12,
                                    margin_end:    20,
                                    margin_top:    12,
                                    margin_bottom: 12,
                                    visible: true    })

        let optionsList = [];
        // options item format:
        // [text, tooltip, widget, settings-variable, options for combo]
    
        optionsList.push(
            _optionsItem(
                _makeTitle(_('Global options:')),
                null, null, null
            )
        );
    
        optionsList.push(
            _optionsItem(
                _('Watch hot corners for external overrides'),
                _('Update corners when something (usualy other extensions) change them'),
                _newGtkSwitch(), 'watchCorners'
            )
        );
    
        optionsList.push(
            _optionsItem(
                    _('Enable all triggers in fullscreen mode'),
                    _('When off, each trigger can be enabled independently'),
                    _newGtkSwitch(), 'fullscreenGlobal'
            )
        );
    
        let actionDelayAdjustment = new Gtk.Adjustment({
                upper:          1000,
                step_increment:   10,
                page_increment:   10 });
    
        optionsList.push(
            _optionsItem(
                _('Minimum delay between actions (ms)'),
                _('Prevents accidental double-action. Ignored by volume control'),
                _newSpinButton(actionDelayAdjustment),
                'actionEventDelay'
            )
        );
    
        optionsList.push(
            _optionsItem(
                _('Show ripple animations'),
                _('When you trigger an action, ripples are animated in the corner'),
                _newGtkSwitch(),
                'rippleAnimation'
            )
        );
    
        optionsList.push(
            _optionsItem(
                _('Use fallback hot corner triggers'),
                _('When pressure barriers don`t work, on virtual systems for example'),
                _newGtkSwitch(),
                'barrierFallback'
            )
        );
        
        optionsList.push(
            _optionsItem(
                _('Make active corners / edges visible'),
                _('Pressure barriers are green, clickable areas are orange'),
                _newGtkSwitch(),
                'cornersVisible'
            )
        );
    
        optionsList.push(
            _optionsItem(
                _makeTitle(_('Workspace switcher:')),
                null,
                null
            )
        );
    
        optionsList.push(
            _optionsItem(
                _('Wraparound'),
                null,
                _newGtkSwitch(),
                'wsSwitchWrap'
            )
        );
    
        optionsList.push(
            _optionsItem(
                _('Ignore last (empty) workspace'),
                null,
                _newGtkSwitch(),
                'wsSwitchIgnoreLast'
            )
        );
    
        optionsList.push(
            _optionsItem(
                _('Show workspace indicator while switching'),
                null,
                _newComboBox(),
                'wsSwitchIndicatorMode',
                [   [ _('None'),           0],
                    [ _('Default popup'),  1],
                    [ _('Overlay Index'),  2]
                ]
            )
        );
    
        optionsList.push(
            _optionsItem(
                _makeTitle(_('Window switcher:')),
                null,
                null
            )
        );
    
        optionsList.push(
            _optionsItem(
                _('Wraparound'),
                null,
                _newGtkSwitch(),
                'winSwitchWrap'
            )
        );
    
        optionsList.push(
            _optionsItem(
                _('Skip minimized'),
                null,
                _newGtkSwitch(),
                'winSkipMinimized'
            )
        );

        optionsList.push(
            _optionsItem(
                _makeTitle(_('DND Window Thumbnails:')),
                _('Window thumbnails are overlay clones of windows, can be draged by mouse anywhere on the screen.') + '\n'
                + _('Thumbnail control:') + '\n    '
                + _('Double click:    \t\tactivate source window') +  '\n    '
                + _('Primary click:   \t\ttoggle scroll wheel function (resize / source)') + '\n    '
                + _('Secondary click: \t\tremove thumbnail') + '\n    '
                + _('Middle click:    \t\tclose source window') + '\n    '
                + _('Scroll wheel:    \t\tresize or change source window') +  '\n    '
                + _('Ctrl + Scroll wheel: \tchange source window or resize') +  '\n    '
                + _('Shift + Scroll wheel: \tadjust opacity') +  '\n    '
                ,
                null
            )
        );

        let tmbScaleAdjustment = new Gtk.Adjustment({
                lower:           5,
                upper:          50,
                step_increment:  1,
                page_increment: 10 
            }
        );
    
        optionsList.push(
            _optionsItem(
                _('Thumbnail height scale (%)'),
                _('Height of the thumbnail relative to screen height'),
                _newSpinButton(tmbScaleAdjustment),
                'winThumbnailScale'
            )
        );


        let frame;
        let frameBox;
        for (let item of optionsList) {
            if (!item[0][1]) {
                let lbl = new Gtk.Label();
                    lbl.set_markup(item[0][0]);
                    if (item[1])
                        lbl.set_tooltip_text(item[1]);
                frame = new Gtk.Frame({
                    label_widget: lbl
                });
                frameBox = new Gtk.ListBox({
                    selection_mode: null,
                    can_focus: false,
                });
                mainBox[mainBox.add?'add':'append'](frame);
                frame[frame.add?'add':'set_child'](frameBox);
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
                visible: true
            });
            for (let i of item[0]) {
                box[box.add?'add':'append'](i);
            }
            if (item.length === 2) box.set_tooltip_text(item[1]);

            frameBox[frameBox.add?'add':'append'](box);
        }
        this[this.add? 'add' : 'set_child'](mainBox);
        this.show_all && this.show_all();
        this._alreadyBuilt = true;
    }
});



function _newGtkSwitch() {
    let sw = new Gtk.Switch({
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
    });
    sw.is_switch = true;
    return sw;
}

function _newSpinButton(adjustment) {
    let spinButton = new Gtk.SpinButton({
            halign: Gtk.Align.END,
            hexpand: true,
            xalign: 0.5
    });
    spinButton.set_adjustment(adjustment);
    spinButton.is_spinbutton = true;
    return spinButton;
}

function _newComboBox() {
        const model = new Gtk.ListStore();
        const Columns = { LABEL: 0, VALUE: 1 };
        model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT]);
        const comboBox = new Gtk.ComboBox({ model: model,
                                            halign: Gtk.Align.END,
                                            valign: Gtk.Align.CENTER,
                                            hexpand: true,
        });
        const renderer = new Gtk.CellRendererText();
        comboBox.pack_start(renderer, true);
        comboBox.add_attribute(renderer, 'text', 0);
        comboBox.is_combo_box = true;
        return comboBox;
    }

function _optionsItem(text, tooltip, widget, variable, options=[]) {
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

    if (widget && widget.is_switch) {
        widget.active = mscOptions[variable];
        widget.connect('notify::active', () => {
                    mscOptions[variable] = widget.active;
        });
    }

    else if (widget && widget.is_spinbutton) {
        widget.value = mscOptions[variable];
        widget.timeout_id = null;
        widget.connect('value-changed', () => {
            widget.update();
            if (widget.timeout_id) {
                GLib.Source.remove(widget.timeout_id);
            }
            widget.timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
                () => {
                    mscOptions[variable] = widget.value;
                    widget.timeout_id = null;
                    return 0;
                }
            );
        });
    }

    else if (widget && widget.is_combo_box) {
        let model = widget.get_model();
        for (const [label, value] of options) {
            let iter;
            model.set((iter = model.append()), [0, 1], [label, value]);
            if (value === mscOptions[variable]) {
                widget.set_active_iter(iter);
            }
        }
        widget.connect('changed', (item) => {
            const [success, iter] = widget.get_active_iter();
            if (!success) return;

            mscOptions[variable] = model.get_value(iter, 1);
        });
    }

    return item;
}

function _makeSmall(label) {
  return '<small>'+label+'</small>';
}
function _makeTitle(label) {
  return '<b>'+label+'</b>';
}

const CustomMenusPage = GObject.registerClass(
class CustomMenusPage extends Gtk.Notebook {
    _init() {
        super._init({tab_pos: Gtk.PositionType.TOP, visible: true});
        this._menusCount = 4;
        this._alreadyBuilt = false;
        this.buildPage();
    }

    buildPage() {
        if (this._alreadyBuilt) return;
        for (let i = 1; i <= this._menusCount; i++) {
            let menu = new CustomMenuPage(i);
            let label = new Gtk.Label({ label: _('Custom Menu ') + `${i}`, halign: Gtk.Align.CENTER, hexpand: true});
            this.append_page(menu, label);
            if (i === 1) menu.buildPage();
        }
        this.connect('switch-page', (notebook, page, index) => {
            page.buildPage();
        });
        this.show_all && this.show_all();
        this._alreadyBuilt = true;
    }
});


const CustomMenuPage = GObject.registerClass(
class CustomMenuPage extends Gtk.ScrolledWindow {
    _init(menuIndex) {
        super._init({margin_start: 12, margin_end: 12, margin_top: 12, margin_bottom: 12, visible: true});
        this._alreadyBuilt= false;
        this._menuIndex = menuIndex;
    }

    buildPage() {
        if (this._alreadyBuilt) return;

        this.menuItems = mscOptions[`customMenu${this._menuIndex}`];
        this.grid = new Gtk.Grid({margin_top: 6, hexpand: true, visible: true});
        let lbl = new Gtk.Label({
            use_markup: true,
            label: _makeTitle(_('Select Custom Menu Items:')),
            tooltip_text: _('Check items you want to have in the Custom Menu action.')+'\n'+_('You can decide whether the action menu items will be in its section submenu or in the root of the menu by checking/unchecking the section item')
        });
        let frame = new Gtk.Frame({
                label_widget: lbl });
        this[this.add?'add':'set_child'](frame);
        frame[frame.add?'add':'set_child'](this.grid);
        this.treeView = new Gtk.TreeView({hexpand: true});
        this.grid.attach(this.treeView, 0,0,1,1);
        let model = new Gtk.TreeStore();
        model.set_column_types([ GObject.TYPE_STRING, GObject.TYPE_STRING, GObject.TYPE_BOOLEAN]);
        this.treeView.model = model;

        // Menu items
        const actions     = new Gtk.TreeViewColumn({ title: _('Menu Item'), expand: true });
        const nameRender  = new Gtk.CellRendererText();

        const toggles      = new Gtk.TreeViewColumn({ title: _('Show in Menu'), min_width: 150 });
        const toggleRender = new Gtk.CellRendererToggle({
                                    activatable: true,
                                    active : false, });

        actions.pack_start(nameRender, true);
        toggles.pack_start(toggleRender, true);

        actions.add_attribute(nameRender, 'text', 1);
        toggles.add_attribute(toggleRender, 'active', 2);

        actions.set_cell_data_func(nameRender, (column, cell, model, iter) => {
            if (!model.get_value(iter, 0)) {

            }
        });

        toggles.set_cell_data_func(toggleRender, (column, cell, model, iter) => {
            if (!model.get_value(iter, 0)) {

            }
        });

        toggleRender.connect('toggled', (rend, path) => {
            const [succ, iter] = model.get_iter_from_string(path);
            model.set_value(iter, 2, !model.get_value(iter, 2));
            let item  = model.get_value(iter, 0);
            let value = model.get_value(iter, 2);
            let index = this.menuItems.indexOf(item);
            if (index > -1) {
                if (value === false) {
                    this.menuItems.splice(index, 1);
                }
            }
            else if (value === true)
                this.menuItems.push(item);
            mscOptions[`customMenu${this._menuIndex}`] = this.menuItems;
        });

        this._populateTreeview();
        this.treeView.expand_all();

        this.treeView.append_column(actions);
        this.treeView.append_column(toggles);

        this.show_all && this.show_all();

        return this._alreadyBuilt = true;
    }

    _populateTreeview(model) {
        let iter, iter1, iter2;
        for (let i = 0; i < actionList.length; i++){
            let item = actionList[i];
            if ((_excludedItems.indexOf(item[1]) > -1) || !item[3]) continue;

            if (!item[0]){
                iter1 = this.treeView.model.append(null);
                if (item[0] === 0) {
                    this.treeView.model.set(iter1, [0, 1], [item[1],item[2]]);
                }
                else {
                    this.treeView.model.set(iter1, [0, 1], [item[1], item[2]]);
                }
                iter = iter1;
            } else {
                iter2  = this.treeView.model.append(iter1);
                this.treeView.model.set(iter2, [0, 1], [item[1], item[2]]);
                iter = iter2;
            }
            this.treeView.model.set_value(iter, 2, this.menuItems.indexOf(item[1]) > -1);
        }
    }
});