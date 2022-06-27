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

const { Gtk, Gdk, GLib, Gio, GObject } = imports.gi;

let Adw = null;
try { Adw = imports.gi.Adw; } catch (e) {}

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();

const Utils          = Me.imports.src.common.utils;
const _newImageFromIconName = Utils._newImageFromIconName;
const _setImageFromIconName = Utils._setImageFromIconName;
const _setBtnFromIconName   = Utils._setBtnFromIconName;
// conversion of Gtk3 / Gtk4 widgets add methods
const append         = Utils.append;
const set_child      = Utils.set_child;

const Settings       = Me.imports.src.common.settings;
const Triggers       = Settings.Triggers;
const triggers       = Settings.listTriggers();
const triggerLabels  = Settings.TriggerLabels;
const actionList     = Settings.actionList;
const actionDict     = Settings.actionDict;

const ActionChooserDialog = Me.imports.src.prefs.actionChooserDialog.ActionChooserDialog;

const _              = Settings._;
const shellVersion   = Settings.shellVersion;

const MONITOR_TITLE  = Settings.MONITOR_TITLE;
const MONITOR_ICON   = Settings.MONITOR_ICON;

const TRANSITION_DURATION = Settings.TRANSITION_DURATION;

function getMonitorPages(mscOptions) {
    let pages = [];

    const display = Gdk.Display.get_default();
    let nMonitors = display.get_monitors
        ? display.get_monitors().get_n_items()
        : display.get_n_monitors();

    let mouseSettings = Settings.getSettings(
        'org.gnome.desktop.peripherals.mouse',
        '/org/gnome/desktop/peripherals/mouse/');
    let leftHandMouse = mouseSettings.get_boolean('left-handed');

    for (let monitorIndex = 0; monitorIndex < nMonitors; ++monitorIndex) {
        const monitor = display.get_monitors
            ? display.get_monitors().get_item(monitorIndex)
            : display.get_monitor(monitorIndex);
        const geometry = monitor.get_geometry();

        let corners = Settings.Corner.forMonitor(monitorIndex, monitorIndex, geometry);

        const monitorPage = new MonitorPage();
        monitorPage._monitor = monitor;
        monitorPage._corners = corners;
        monitorPage._geometry = geometry;
        monitorPage._leftHandMouse = leftHandMouse;

        let labelText = `${MONITOR_TITLE}`;
        if (nMonitors > 1) {
            labelText += ` ${monitorIndex + 1} ${monitorIndex === 0 ? _('(primary)') : ''}`;
            mscOptions.set('showOsdMonitorIndexes', true);
        }
        pages.push([monitorPage, labelText]);
    }

    if (nMonitors)
        return pages;
}

const MonitorPage = GObject.registerClass(
class MonitorPage extends Gtk.Box {
    _init(widgetProperties = {
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 6
    }) {
        super._init(widgetProperties);

        this._corners = [];
        this._monitor = null;
        this._geometry = null;
        this._alreadyBuilt = false;
        this._leftHandMouse = false;
        this._iconPath = Utils.getIconPath();
    }

    buildPage() {
        if (this._alreadyBuilt)
            return;

        const context = this.get_style_context();
        context.add_class('background');
        const margin = 16;
        const stackSwitcher = new Gtk.StackSwitcher({
            halign: Gtk.Align.CENTER,
            hexpand: true,
            margin_top: Adw ? 0 : margin,
            margin_bottom: Adw ? margin : 0
        });

        const stack = new Gtk.Stack({
            hexpand: true
        });

        stack.connect('notify::visible-child', () => {
            if (stack.get_visible_child().buildPage)
                stack.get_visible_child().buildPage();
        });

        stackSwitcher.set_stack(stack);
        stack.set_transition_duration(TRANSITION_DURATION);
        stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT);

        let icons = [];
        for (let i = 0; i < 4; i++) {
            const image = new Gtk.Image({
                halign: Gtk.Align.CENTER,
                valign: Gtk.Align.CENTER,
                margin_start: 15,
                margin_end: 15,
                pixel_size: 36,
            });

            if (shellVersion < 40) image.icon_size = Gtk.IconSize.DND;

            image.set_from_resource(`${this._iconPath}/${this._corners[i].top ? 'Top' : 'Bottom'}${this._corners[i].left ? 'Left' : 'Right'}.svg`);

            icons.push(image);

            const cPage = new CornerPage();
            cPage._corner = this._corners[i];
            cPage._geometry = this._geometry;
            cPage._leftHandMouse = this._leftHandMouse;
            if (i === 0)
                cPage.buildPage();
            const pName = `corner ${i}`;
            const title = `${this._corners[i].top ? _('Top') : _('Bottom')}-${this._corners[i].left ? _('Left') : _('Right')}`;
            image.set_tooltip_text(title);
            stack.add_named(cPage, pName);
        }

        let stBtn = stackSwitcher.get_first_child ? stackSwitcher.get_first_child() : null;
        for (let i = 0; i < 4; i++) {
            if (stackSwitcher.get_children) {
                stBtn = stackSwitcher.get_children()[i];
                stBtn.add(icons[i]);
            } else {
                stBtn.set_child(icons[i]);
                stBtn.visible = true;
                stBtn = stBtn.get_next_sibling();
            }
        }

        this[append](stackSwitcher);
        this[append](stack);
        this.show_all && this.show_all();
        this._alreadyBuilt = true;
    }
});

const CornerPage = GObject.registerClass(
class CornerPage extends Gtk.Box {
    _init(widgetProperties = {
        //selection_mode: null,
        orientation: Gtk.Orientation.VERTICAL,
        margin_start: Adw ? 0 : 16,
        margin_end: Adw ? 0 : 16,
        margin_top: Adw ? 0 : 16,
        margin_bottom: Adw ? 0 : 16,
        vexpand: true,
        visible: true
    }) {
        super._init(widgetProperties);

        this._alreadyBuilt = false;
        this._corner = null;
        this._geometry = null;
        this._leftHandMouse = false;
        this._iconPath = Utils.getIconPath();
    }

    buildPage() {
        if (this._alreadyBuilt)
            return false;
        this._alreadyBuilt = true;
        const trgOrder = [0, 6, 1, 2, 3, 4, 5];
        //for (let trigger of triggers) {
        for (let trigger of trgOrder) {
            const grid = new Gtk.Grid({
                column_spacing: 5,
                margin_top: shellVersion >= 40 ? 5 : 10,
                margin_bottom: shellVersion >= 40 ? 5 : 10,

            });
            let ctrlBtn = new Gtk.CheckButton({
            //const ctrlBtn = new Gtk.ToggleButton({
                label: 'Ctrl',
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
                vexpand: false,
                hexpand: false,
                tooltip_text: _('If checked this trigger will work only when Ctrl key is pressed'),
                visible: true
            });

            this._corner._gsettings[trigger].bind('ctrl', ctrlBtn, 'active', Gio.SettingsBindFlags.DEFAULT);

            let iconName;
            let settingsBtn = null;
            if (trigger === 0 || trigger === 6) {
                iconName = `${this._corner.top ? 'Top' : 'Bottom'}${this._corner.left ? 'Left' : 'Right'}.svg`;
                if (trigger === 6) {
                    ctrlBtn.set_visible(true);
                    ctrlBtn.set_active(true);
                    ctrlBtn.set_sensitive(false);
                    ctrlBtn.set_tooltip_text(_('This trigger works only when Ctrl key is pressed'));
                } else {
                    ctrlBtn.set_active(false);
                    ctrlBtn.set_sensitive(false);
                    ctrlBtn.opacity = 0;
                    //ctrlBtn.set_tooltip_text(_('This trigger works only when Ctrl key is NOT pressed'));
                    //ctrlBtn.set_visible(false);
                    if (trigger === Triggers.PRESSURE) {
                        const cornerPopover = new Gtk.Popover();
                        const popupGrid = new Gtk.Grid({
                            margin_start: 10,
                            margin_end: 10,
                            margin_top: 10,
                            margin_bottom: 10,
                            column_spacing: 12,
                            row_spacing: 8,
                        });

                        popupGrid.show_all && popupGrid.show_all();
                        cornerPopover[set_child](popupGrid);

                        this._buildPressureSettings(popupGrid);
                        settingsBtn = new Gtk.MenuButton({
                            popover: cornerPopover,
                            valign: Gtk.Align.CENTER,
                            //margin_end: Adw ? 20 : 16
                        });

                        // Gtk3 implements button icon as an added Gtk.Image child, Gtk4 does not
                        _setBtnFromIconName(settingsBtn, 'emblem-system-symbolic', Gtk.IconSize.BUTTON);
                    }
                }
            } else {
                let iconIdx = trigger;
                if (this._leftHandMouse) {
                    if (trigger === 1)
                        iconIdx = 2;
                    if (trigger === 2)
                        iconIdx = 1;
                }
                iconName = `Mouse-${iconIdx}.svg`;
            }

            const trgIcon = new Gtk.Image({
                //icon_name: iconName,
                halign: Gtk.Align.START,
                margin_start: 10,
                margin_end: 15,
                vexpand: true,
                hexpand: false,
                pixel_size: 40,
                // pixel_size has no effect in Gtk3, the size is the same as declared in svg image
                // in Gtk4 image has always some extra margin and therefore it's tricky to adjust row height
            });

            //trgIcon.set_from_file(`${this._iconPath}/${iconName}`);
            trgIcon.set_from_resource(`${this._iconPath}/${iconName}`);
            trgIcon.set_tooltip_text(triggerLabels[trigger]);

            const fsBtn = new Gtk.ToggleButton({
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
                vexpand: false,
                hexpand: false,
                tooltip_text: _("Enable this trigger in fullscreen mode"),
            });

            _setBtnFromIconName(fsBtn, 'view-fullscreen-symbolic', Gtk.IconSize.BUTTON);

            fsBtn.set_active(this._corner.getFullscreen(trigger));
            this._corner._gsettings[trigger].bind('fullscreen', fsBtn, 'active', Gio.SettingsBindFlags.DEFAULT);

            const cw = this._buildTriggerWidget(trigger, iconName);

            grid.attach(trgIcon, 1, trigger, 1, 1);
            if (ctrlBtn.visible)
                grid.attach(ctrlBtn, 0, trigger, 1, 1);
            /*else if (settingsBtn) {
                grid.attach(settingsBtn, 0, trigger, 1, 1);
            }*/
            if (trigger === Triggers.PRESSURE) {
                grid.attach(cw,      2, trigger, 1, 1);
                grid.attach(settingsBtn, 3, trigger, 1, 1);
                grid.attach(fsBtn,   4, trigger, 1, 1);
            } else {
                grid.attach(cw,      2, trigger, 1, 1);
                grid.attach(fsBtn,   3, trigger, 2, 1);
            }
            this[append](grid);
        }
        const ew = this._buildExpandsionWidget();
        const ewFrame = new Gtk.Frame({
            margin_top: 10,
        });
        ewFrame[set_child](ew);
        this[append](ewFrame);
        this.show_all && this.show_all();

        this._alreadyBuilt = true;
    }

    _buildTriggerWidget(trigger, iconName) {
        const cw = new Gtk.Grid({
            valign: Gtk.Align.CENTER,
        });

        const comboGrid = new Gtk.Grid({
            column_spacing: 4,
        });
        const cmdGrid = new Gtk.Grid({
            column_spacing: 4,
            margin_top: 4,
        });

        const commandEntryRevealer = new Gtk.Revealer({
            child: cmdGrid,
        });

        const wsIndexAdjustment = new Gtk.Adjustment({
            lower: 1,
            upper: 256,
            step_increment: 1,
            page_increment: 10,
        });
        const workspaceIndexSpinButton = new Gtk.SpinButton({
            margin_top: 4,
            xalign: 0.5,
        });
        const wsIndexRevealer = new Gtk.Revealer({
            child: workspaceIndexSpinButton,
        });
        workspaceIndexSpinButton.set_adjustment(wsIndexAdjustment);
        const commandEntry = new Gtk.Entry({hexpand: true});
        commandEntry.set_placeholder_text(_('Enter command or choose app ID'));
        commandEntry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'edit-clear-symbolic');
        commandEntry.set_icon_activatable(Gtk.EntryIconPosition.SECONDARY, true);
        commandEntry.connect('icon-press', (e) => e.set_text(''));
        const appButton = new Gtk.Button();

        const actionButton = new Gtk.Button({
            //label: ' ', // string would create the label widget, we'll build a custom one
            hexpand: true
        })

        const actBtnContentBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            hexpand: true
        });

        const actBtnIcon = new Gtk.Image();
        const actBtnLabel = new Gtk.Label({
            xalign: 0,
            hexpand: true
        })
        actBtnContentBox[append](actBtnIcon);
        actBtnContentBox[append](actBtnLabel);
        actionButton[set_child](actBtnContentBox);

        actionButton.connect('clicked', widget => {
            const actionChooserTree = new ActionChooserDialog(widget, this._corner, trigger, iconName, cw);
            actionChooserTree.dialog.show();
        });

        _setBtnFromIconName(appButton, 'find-location-symbolic', Gtk.IconSize.BUTTON);

        cmdGrid.attach(commandEntry, 0, 0, 1, 1);
        cmdGrid.attach(appButton, 1, 0, 1, 1);

        comboGrid.attach(actionButton, 1, 0, 1, 1,);

        cw.attach(comboGrid, 0, 0, 1, 1);
        cw.attach(commandEntryRevealer, 0, 1, 1, 1);
        cw.attach(wsIndexRevealer, 0, 2, 1, 1);

        let cmdConnected = false;
        let cmdBtnConnected = false;
        let _connectCmdBtn = function () {
            if (cmdBtnConnected)
                return;
            appButton.connect('clicked', () => {
                function fillCmdEntry(cmd) {
                    let appInfo = dialog._appChooser.get_app_info();
                    if (!appInfo) return;

                    if (cmd)
                        commandEntry.text = appInfo.get_commandline().replace(/ %.$/, '');
                    else
                        commandEntry.text = appInfo.get_id();

                    dialog.destroy();
                }

                const dialog = this._chooseAppDialog();
                dialog._appChooser.connect('application-activated', () => {
                    fillCmdEntry(false); // double-click adds app id
                });

                dialog.connect('response', (dlg, id) => {
                    if (!(id === Gtk.ResponseType.OK || id === Gtk.ResponseType.APPLY)) {
                        dialog.destroy();
                        return;
                    }
                    // OK means command, APPLY means app id
                    const cmd = id === Gtk.ResponseType.OK;
                    fillCmdEntry(cmd);
                    cmdBtnConnected = true;
                });
            });
        }.bind(this);

        // bold action titles like GNOME 42 Adw has. But I prefer normal font
        /*const context = actionButton.get_style_context();
        context.add_class('heading');*/

        const updateActBtnLbl = () => {
            const action = this._corner.getAction(trigger);
            let actionTitle;
            if (!action) {
                actionTitle = _("Error: Stored action doesn't exist!!!");
            } else {
                actionTitle = actionDict[this._corner.getAction(trigger)].title
                const iconName = actionDict[this._corner.getAction(trigger)].icon;
                _setImageFromIconName(actBtnIcon, iconName, Gtk.IconSize.BUTTON);
            }
            actBtnLabel.set_label(actionTitle);
        }

        this._corner.connect('changed::action', updateActBtnLbl, trigger);

        actBtnLabel.connect('notify::label', () => {
            commandEntryRevealer.reveal_child = this._corner.getAction(trigger) === 'run-command';
            wsIndexRevealer.reveal_child = this._corner.getAction(trigger) === 'move-to-workspace';
            if (this._corner.getAction(trigger) === 'run-command' && !cmdConnected) {
                _connectCmdBtn();
                this._corner._gsettings[trigger].bind('command', commandEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
                commandEntryRevealer.reveal_child = this._corner.getAction(trigger) === 'run-command';

                wsIndexRevealer.reveal_child = this._corner.getAction(trigger) === 'move-to-workspace';
                cmdConnected = true;
            }
        });

        updateActBtnLbl();

        this._corner._gsettings[trigger].bind('workspace-index', workspaceIndexSpinButton, 'value', Gio.SettingsBindFlags.DEFAULT);

        cw.show_all && cw.show_all();
        return cw;
    }

    _buildPressureSettings(popupGrid) {
        const pressureLabel = new Gtk.Label({
            label: _('Pressure Threshold'),
            halign: Gtk.Align.START,
        });
        const pressureThresholdAdjustment = new Gtk.Adjustment({
            lower: 0,
            upper: 800,
            step_increment: 10,
            page_increment: 100,
        });
        const pressureThresholdSpinButton = new Gtk.SpinButton({
            adjustment: pressureThresholdAdjustment,
            numeric: true,
            xalign: 0.5,
            halign: Gtk.Align.END,
            hexpand: true,
        });

        this._corner._gsettings[Triggers.PRESSURE].bind('pressure-threshold', pressureThresholdAdjustment, 'value', Gio.SettingsBindFlags.DEFAULT);

        popupGrid.attach(pressureLabel,               0, 3, 1, 1);
        popupGrid.attach(pressureThresholdSpinButton, 1, 3, 1, 1);

        popupGrid.show_all && popupGrid.show_all();
    }

    _buildExpandsionWidget() {
        const grid = new Gtk.Grid({
            row_spacing: shellVersion >= 40 ? 0 : 10,
            column_spacing: 8,
            margin_start: 10,
            margin_end: 10,
            margin_top: 20,
            margin_bottom: 20,
            halign: Gtk.Align.FILL,
            tooltip_text: _("You can activate 'Make active corners/edges visible' option on 'Options' page to see the results of these settings."),
        });

        const barrier = this._buildBarrierSizeAdjustment();
        const click = this._buildClickExpansionAdjustment();
        //                      x, y, w, h
        grid.attach(click[0],   0, 1, 1, 1);
        grid.attach(click[1],   1, 1, 1, 1);
        grid.attach(click[2],   2, 1, 1, 1);
        grid.attach(barrier[0], 0, 2, 1, 1);
        grid.attach(barrier[1], 1, 2, 1, 1);
        grid.attach(barrier[2], 2, 2, 1, 1);

        return grid;
    }

    _buildBarrierSizeAdjustment() {
        const label = new Gtk.Label({
            label: _('Hot corner barrier size:'),
            tooltip_text: `${_('Set horizontal and vertical size of the barrier that reacts to the mouse pointer pressure (part of hot corner).')}\n${
                _('Size can be set in percentage of the screen width and height.')}`,
            halign: Gtk.Align.START,
            hexpand: false,
        });

        const barrierAdjustmentH = new Gtk.Adjustment({
            lower: 1,
            upper: 98,
            step_increment: 1,
            page_increment: 5,
        });

        const barrierAdjustmentV = new Gtk.Adjustment({
            lower: 1,
            upper: 98,
            step_increment: 1,
            page_increment: 5,
        });

        const barrierSizeSliderH = new Gtk.Scale({
            adjustment: barrierAdjustmentH,
            digits: 0,
            draw_value: true,
            has_origin: true,
            tooltip_text: _('Horizontal pressure barrier size in % of monitor width'),
            halign: Gtk.Align.FILL,
            hexpand: true,
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
            hexpand: true,
        });
        barrierSizeSliderV.add_mark(25, Gtk.PositionType.BOTTOM, null);
        barrierSizeSliderV.add_mark(50, Gtk.PositionType.BOTTOM, null);
        barrierSizeSliderV.add_mark(75, Gtk.PositionType.BOTTOM, null);

        this._corner._gsettings[Triggers.PRESSURE].bind('barrier-size-h', barrierAdjustmentH, 'value', Gio.SettingsBindFlags.DEFAULT);
        this._corner._gsettings[Triggers.PRESSURE].bind('barrier-size-v', barrierAdjustmentV, 'value', Gio.SettingsBindFlags.DEFAULT);

        return [label, barrierSizeSliderH, barrierSizeSliderV];
    }

    _buildClickExpansionAdjustment() {
        const label = new Gtk.Label({
            label: _('Expand clickable corner:'),
            tooltip_text:
                          `${_('Expand the area reactive to mouse clicks and scrolls along the edge of the monitor.')}\n${
                              _('If adjacent corners are set to expand along the same edge, each of them allocates a half of the edge')}`,
            halign: Gtk.Align.START,
            hexpand: false,
        });

        const hExpandSwitch = new Gtk.ToggleButton({
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            vexpand: false,
            hexpand: false,
            tooltip_text: _('Expand horizonatally'),
        });

        const hImage = Gtk.Image.new_from_resource(`${this._iconPath}/${this._corner.top ? 'Top' : 'Bottom'}${this._corner.left ? 'Left' : 'Right'}HE.svg`);
        hImage.pixel_size = 40;
        hExpandSwitch[set_child](hImage);

        const vExpandSwitch = new Gtk.ToggleButton({
            halign: Gtk.Align.CENTER,
            valign: Gtk.Align.CENTER,
            vexpand: false,
            hexpand: false,
            tooltip_text: _('Expand vertically'),
        });

        const vImage = Gtk.Image.new_from_resource(`${this._iconPath}/${this._corner.top ? 'Top' : 'Bottom'}${this._corner.left ? 'Left' : 'Right'}VE.svg`);
        vImage.pixel_size = 40;
        vExpandSwitch[set_child](vImage);

        this._corner._gsettings[Triggers.BUTTON_PRIMARY].bind('h-expand', hExpandSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._corner._gsettings[Triggers.BUTTON_PRIMARY].bind('v-expand', vExpandSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        return [label, hExpandSwitch, vExpandSwitch];
    }

    _chooseAppDialog() {
        const dialog = new Gtk.Dialog({
            title: _('Choose Application'),
            transient_for: this.get_root
                ? this.get_root()
                : this.get_toplevel(),
            use_header_bar: true,
            modal: true,
        });

        dialog.add_button(_('_Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('_Add ID'), Gtk.ResponseType.APPLY);
        dialog.add_button(_('_Add Command'), Gtk.ResponseType.OK);
        dialog.set_default_response(Gtk.ResponseType.APPLY);

        const grid = new Gtk.Grid({
            margin_start: 10,
            margin_end: 10,
            margin_top: 10,
            margin_bottom: 10,
            column_spacing: 10,
            row_spacing: 15,
        });

        dialog._appChooser = new Gtk.AppChooserWidget({
            show_all: true,
            hexpand: true,
        });

        grid.attach(dialog._appChooser, 0, 0, 2, 1);
        const cmdLabel = new Gtk.Label({
            label: '',
            wrap: true,
        });
        grid.attach(cmdLabel, 0, 1, 2, 1);
        dialog.get_content_area()[append](grid);
        dialog._appChooser.connect('application-selected', (w, appInfo) => {
            cmdLabel.set_text(`App ID:  \t\t${appInfo.get_id()}\nCommand: \t${appInfo.get_commandline()}`);
        }
        );
        dialog.show_all && dialog.show_all();
        dialog.show();
        return dialog;
    }
});
