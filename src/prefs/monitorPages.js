/**
 * Custom Hot Corners - Extended
 * MonitorPages
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';

import * as Settings from '../common/settings.js';
import * as Utils from '../common/utils.js';
import { ActionChooserDialog } from './actionChooserDialog.js';

const Triggers       = Settings.Triggers;
let actionDict;


let _;
let TriggerLabels;

const TRANSITION_TIME = Settings.TRANSITION_TIME;

export function init(extension) {
    _ = extension.gettext.bind(extension);
    TriggerLabels = [
        _('Hot Corner'),
        _('Primary Button'),
        _('Secondary Button'),
        _('Middle Button'),
        _('Scroll Up'),
        _('Scroll Down'),
        _('Ctrl + Hot Corner'),
    ];

    actionDict = Settings.actionDict;
}

export function cleanGlobals() {
    _ = null;
    TriggerLabels = null;
}

export function getMonitorPages(mscOptions) {
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

        const monitorPage = new MonitorPage(monitor, monitorIndex, corners, leftHandMouse);

        let labelText = `  ${_('Monitor')}`;
        if (nMonitors > 1) {
            labelText += ` ${monitorIndex + 1} ${monitorIndex === 0 ? _('(primary)') : ''}  `;
            mscOptions.set('showOsdMonitorIndexes', true);
        }
        pages.push([monitorPage, labelText]);
    }

    if (nMonitors)
        return pages;

    return null;
}

const MonitorPage = GObject.registerClass(
class MonitorPage extends Gtk.Box {
    _init(monitor, monitorIndex, corners, leftHandMouse, widgetProperties = {
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 16,
        margin_start: 0,
        margin_end: 0,
        margin_top: 0,
        margin_bottom: 0,
    }) {
        super._init(widgetProperties);

        this._corners = corners;
        this._monitor = monitor;
        this._monitorIndex = monitorIndex;
        this._geometry = monitor.get_geometry();

        this._alreadyBuilt = false;
        this._leftHandMouse = false;
        this._iconPath = Utils.getIconPath();
        this.buildPage();
    }

    buildPage() {
        if (this._alreadyBuilt)
            return;

        let context = this.get_style_context();
        context.add_class('background');
        const stackSwitcher = new Gtk.StackSwitcher({
            halign: Gtk.Align.CENTER,
            hexpand: true,
        });

        const stackGrid = new Gtk.Grid({
            row_spacing: 8,
        });

        const monitorLabel = new Gtk.Label({
            valign: Gtk.Align.START,
            label: `${_('Monitor')} ${this._monitorIndex + 1}`,
        });
        context = monitorLabel.get_style_context();
        context.add_class('heading');

        const resetBtn = new Gtk.Button({
            tooltip_text: _('Disable all triggers and reset settings of this corner'),
            vexpand: false,
            hexpand: true,
            halign: Gtk.Align.END,
            valign: Gtk.Align.START,
        });

        resetBtn.connect('clicked', () => Settings.resetCorner(this._monitorIndex, stack.get_visible_child_name()));

        resetBtn.icon_name = 'view-refresh-symbolic';

        context = resetBtn.get_style_context();
        context.add_class('destructive-action');

        stackGrid.attach(monitorLabel, 0, 0, 1, 1);
        stackGrid.attach(stackSwitcher, 1, 0, 4, 1);
        stackGrid.attach(resetBtn, 5, 0, 1, 1);

        const stack = new Gtk.Stack({
            hexpand: true,
        });

        stack.connect('notify::visible-child', () => {
            if (stack.get_visible_child().buildPage)
                stack.get_visible_child().buildPage();
        });

        stackSwitcher.set_stack(stack);
        stack.set_transition_duration(TRANSITION_TIME);
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

            image.set_from_resource(`${this._iconPath}/${this._corners[i].top ? 'Top' : 'Bottom'}${this._corners[i].left ? 'Left' : 'Right'}.svg`);

            icons.push(image);

            const cPage = new CornerPage();
            cPage._corner = this._corners[i];
            cPage._geometry = this._geometry;
            cPage._leftHandMouse = this._leftHandMouse;
            if (i === 0)
                cPage.buildPage();
            const pName = `${this._corners[i].top ? 'top' : 'bottom'}-${this._corners[i].left ? 'left' : 'right'}`;
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

        this.append(stackGrid);
        this.append(stack);

        this._alreadyBuilt = true;
    }
});

const CornerPage = GObject.registerClass(
class CornerPage extends Gtk.Box {
    _init(widgetProperties = {
        orientation: Gtk.Orientation.VERTICAL,
        vexpand: true,
        visible: true,
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
            return;
        this._alreadyBuilt = true;

        const hotFrame = new Gtk.Frame({
            label: `<b>${_('Hot Corner')}</b>`,
            margin_top: 10,
        });
        hotFrame.get_label_widget().use_markup = true;

        this.append(hotFrame);
        const hotBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            vexpand: false,
            visible: true,
            margin_start: 12,
            margin_end: 12,
        });
        hotFrame.set_child(hotBox);

        const clickFrame = new Gtk.Frame({
            label: `<b>${_('Click/Scroll Corner')}</b>`,
            margin_top: 10,
        });
        clickFrame.get_label_widget().use_markup = true;

        this.append(clickFrame);
        const clickBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            vexpand: false,
            visible: true,
            margin_start: 12,
            margin_end: 12,
        });
        clickFrame.set_child(clickBox);

        const trgOrder = [0, 6, 1, 2, 3, 4, 5];
        for (let trigger of trgOrder) {
            const grid = new Gtk.Grid({
                column_spacing: 5,
                margin_top: 5,
                margin_bottom: 5,

            });
            let ctrlBtn = new Gtk.CheckButton({
                label: _('Ctrl'),
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
                vexpand: false,
                hexpand: false,
                tooltip_text: _('If checked this trigger will only work when the Ctrl key is pressed'),
                visible: true,
            });

            this._corner._gsettings[trigger].bind('ctrl', ctrlBtn, 'active', Gio.SettingsBindFlags.DEFAULT);

            let iconName;
            if (trigger === 0 || trigger === 6) {
                iconName = `${this._corner.top ? 'Top' : 'Bottom'}${this._corner.left ? 'Left' : 'Right'}.svg`;
                if (trigger === 6) {
                    ctrlBtn.set_visible(true);
                    ctrlBtn.set_active(true);
                    ctrlBtn.set_sensitive(false);
                    ctrlBtn.set_tooltip_text(_('This trigger only works when the Ctrl key is pressed'));
                } else {
                    ctrlBtn.set_active(false);
                    ctrlBtn.set_sensitive(false);
                    ctrlBtn.opacity = 0;
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
                halign: Gtk.Align.START,
                margin_start: 10,
                margin_end: 15,
                vexpand: true,
                hexpand: false,
                pixel_size: 40,
                // pixel_size has no effect in Gtk3, the size is the same as declared in svg image
                // in Gtk4 image has always some extra margin and therefore it's tricky to adjust row height
            });

            trgIcon.set_from_resource(`${this._iconPath}/${iconName}`);
            trgIcon.set_tooltip_text(TriggerLabels[trigger]);

            const fsBtn = new Gtk.ToggleButton({
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
                vexpand: false,
                hexpand: false,
                tooltip_text: _('Enable this trigger in fullscreen mode'),
            });

            fsBtn.set_icon_name('view-fullscreen-symbolic');

            fsBtn.set_active(this._corner.get('fullscreen', trigger));
            this._corner._gsettings[trigger].bind('fullscreen', fsBtn, 'active', Gio.SettingsBindFlags.DEFAULT);

            const cw = this._buildTriggerWidget(trigger, iconName);

            grid.attach(trgIcon, 1, trigger, 1, 1);
            if (ctrlBtn.visible)
                grid.attach(ctrlBtn, 0, trigger, 1, 1);
            grid.attach(cw,      2, trigger, 1, 1);
            grid.attach(fsBtn,   3, trigger, 2, 1);

            if ([0, 6].includes(trigger))
                hotBox.append(grid);
            else
                clickBox.append(grid);
        }

        const hew = this._buildHotCornerExpansionWidget();
        hotBox.append(hew);

        const cew = this._buildClickableCornerExpansionWidget();
        clickBox.append(cew);

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
        const commandEntry = new Gtk.Entry({ hexpand: true });
        commandEntry.set_placeholder_text(_('Enter command or choose app ID'));
        commandEntry.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'edit-clear-symbolic');
        commandEntry.set_icon_activatable(Gtk.EntryIconPosition.SECONDARY, true);
        commandEntry.connect('icon-press', e => e.set_text(''));
        const appButton = new Gtk.Button();

        const actionButton = new Gtk.Button({
            // label: ' ', // string would create the label widget, we'll build a custom one
            hexpand: true,
        });

        const actBtnContentBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 8,
            hexpand: true,
        });

        const actBtnIcon = new Gtk.Image();
        const actBtnLabel = new Gtk.Label({
            xalign: 0,
            hexpand: true,
        });
        actBtnContentBox.append(actBtnIcon);
        actBtnContentBox.append(actBtnLabel);
        actionButton.set_child(actBtnContentBox);

        actionButton.connect('clicked', widget => {
            const actionChooserTree = new ActionChooserDialog(widget, this._corner, trigger, iconName, cw);
            actionChooserTree.dialog.show();
        });

        appButton.set_icon_name('find-location-symbolic');

        cmdGrid.attach(commandEntry, 0, 0, 1, 1);
        cmdGrid.attach(appButton, 1, 0, 1, 1);

        comboGrid.attach(actionButton, 1, 0, 1, 1);

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
                    if (!appInfo)
                        return;

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

        const updateActBtnLbl = () => {
            const action = this._corner.get('action', trigger);
            let actionTitle;
            if (!actionDict[action]) {
                actionTitle = _("Error: Stored action doesn't exist!!!");
            } else {
                actionTitle = actionDict[action].title;
                const actBtnIconName = actionDict[action].icon;
                actBtnIcon.set_from_icon_name(actBtnIconName);
            }
            actBtnLabel.set_label(actionTitle);
        };

        this._corner.connect('changed::action', updateActBtnLbl, trigger);

        actBtnLabel.connect('notify::label', () => {
            const action = this._corner.get('action', trigger);
            commandEntryRevealer.reveal_child = action === 'run-command';
            wsIndexRevealer.reveal_child = action === 'move-to-workspace';
            if (action === 'run-command' && !cmdConnected) {
                _connectCmdBtn();
                this._corner._gsettings[trigger].bind('command', commandEntry, 'text', Gio.SettingsBindFlags.DEFAULT);
                commandEntryRevealer.reveal_child = action === 'run-command';

                wsIndexRevealer.reveal_child = action === 'move-to-workspace';
                cmdConnected = true;
            }
        });

        updateActBtnLbl();

        this._corner._gsettings[trigger].bind('workspace-index', workspaceIndexSpinButton, 'value', Gio.SettingsBindFlags.DEFAULT);

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
    }

    _buildHotCornerExpansionWidget() {
        const grid = new Gtk.Grid({
            row_spacing: 0,
            column_spacing: 8,
            margin_top: 20,
            margin_bottom: 8,
            halign: Gtk.Align.FILL,
            tooltip_text: _("You can activate 'Make active corners/edges visible' option on 'Options' page to see the results of these settings."),
        });

        const hImage = Gtk.Image.new_from_resource(`${this._iconPath}/${this._corner.top ? 'Top' : 'Bottom'}${this._corner.left ? 'Left' : 'Right'}HE.svg`);
        hImage.pixel_size = 40;
        hImage.margin_start = 100;
        const vImage = Gtk.Image.new_from_resource(`${this._iconPath}/${this._corner.top ? 'Top' : 'Bottom'}${this._corner.left ? 'Left' : 'Right'}VE.svg`);
        vImage.pixel_size = 40;

        const label = new Gtk.Label({
            wrap: true,
            label: _('Pressure threshold and barrier sizes:\n(Enlarge the barrier size to convert the hot corner into a hot edge)'),
            tooltip_text: `${_('Set horizontal and vertical size of the barrier that reacts to the mouse pointer pressure.')}\n${
                _('The sizes are set in percentage of the screen width and height.')}`,
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
            tooltip_text: _('Horizontal pressure barrier size in percentage of the monitor width'),
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
            tooltip_text: _('Vertical pressure barrier size in percentage of the monitor height'),
            halign: Gtk.Align.FILL,
            hexpand: true,
        });
        barrierSizeSliderV.add_mark(25, Gtk.PositionType.BOTTOM, null);
        barrierSizeSliderV.add_mark(50, Gtk.PositionType.BOTTOM, null);
        barrierSizeSliderV.add_mark(75, Gtk.PositionType.BOTTOM, null);

        this._corner._gsettings[Triggers.PRESSURE].bind('barrier-size-h', barrierAdjustmentH, 'value', Gio.SettingsBindFlags.DEFAULT);
        this._corner._gsettings[Triggers.PRESSURE].bind('barrier-size-v', barrierAdjustmentV, 'value', Gio.SettingsBindFlags.DEFAULT);

        const cornerPopover = new Gtk.Popover();
        const popupGrid = new Gtk.Grid({
            margin_start: 10,
            margin_end: 10,
            margin_top: 10,
            margin_bottom: 10,
            column_spacing: 12,
            row_spacing: 8,
        });

        cornerPopover.set_child(popupGrid);

        this._buildPressureSettings(popupGrid);
        const settingsBtn = new Gtk.MenuButton({
            popover: cornerPopover,
            valign: Gtk.Align.CENTER,
        });

        settingsBtn.set_icon_name('emblem-system-symbolic');

        //                              x, y, w, h
        grid.attach(label,              0, 0, 5, 1);
        grid.attach(hImage,             1, 1, 1, 1);
        grid.attach(barrierSizeSliderH, 2, 1, 1, 1);
        grid.attach(vImage,             3, 1, 1, 1);
        grid.attach(barrierSizeSliderV, 4, 1, 1, 1);
        grid.attach(settingsBtn,        0, 1, 1, 1);

        return grid;
    }

    _buildClickableCornerExpansionWidget() {
        const grid = new Gtk.Grid({
            row_spacing: 0,
            column_spacing: 8,
            margin_top: 20,
            margin_bottom: 8,
            halign: Gtk.Align.FILL,
            tooltip_text: _("You can activate 'Make active corners/edges visible' option on 'Options' page to see the results of these settings."),
        });

        const label = new Gtk.Label({
            label: _('Expand clickable area - corner to edge:'),
            tooltip_text:
                          `${_('Expand the area reactive to mouse clicks and scrolls along the edge of the monitor in selected axis.')}\n${
                              _('If an adjacent corner is set to expand along the same edge, each of them allocates a half of the edge')}`,
            halign: Gtk.Align.START,
            hexpand: true,
        });

        const hExpandSwitch = new Gtk.Switch({
            halign: Gtk.Align.START,
            valign: Gtk.Align.CENTER,
            vexpand: false,
            hexpand: false,
            tooltip_text: _('Expand horizonatally'),
        });

        const hImage = Gtk.Image.new_from_resource(`${this._iconPath}/${this._corner.top ? 'Top' : 'Bottom'}${this._corner.left ? 'Left' : 'Right'}HE.svg`);
        hImage.pixel_size = 40;
        hImage.margin_start = 50;

        const vExpandSwitch = new Gtk.Switch({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            vexpand: false,
            hexpand: false,
            tooltip_text: _('Expand vertically'),
        });

        const vImage = Gtk.Image.new_from_resource(`${this._iconPath}/${this._corner.top ? 'Top' : 'Bottom'}${this._corner.left ? 'Left' : 'Right'}VE.svg`);
        vImage.pixel_size = 40;
        vImage.margin_start = 50;
        vImage.halign = Gtk.Align.END;

        this._corner._gsettings[Triggers.BUTTON_PRIMARY].bind('h-expand', hExpandSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._corner._gsettings[Triggers.BUTTON_PRIMARY].bind('v-expand', vExpandSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);

        //                         x, y, w, h
        grid.attach(label,         0, 1, 1, 1);
        grid.attach(hImage,        1, 1, 1, 1);
        grid.attach(hExpandSwitch, 2, 1, 1, 1);
        grid.attach(vImage,        3, 1, 1, 1);
        grid.attach(vExpandSwitch, 4, 1, 1, 1);

        return grid;
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
        dialog.get_content_area().append(grid);
        dialog._appChooser.connect('application-selected', (w, appInfo) => {
            cmdLabel.set_text(`App ID:  \t\t${appInfo.get_id()}\nCommand: \t${appInfo.get_commandline()}`);
        }
        );

        dialog.show();
        return dialog;
    }
});
