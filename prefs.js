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
'use strict';
const {Gtk, Gdk, GLib, GObject} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;
const triggers       = Settings.listTriggers();
const triggerLabels  = Settings.TriggerLabels;
let   notebook;
let   mscOptions;


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
    mscOptions = new Settings.MscOptions();
}

function buildPrefsWidget() {
    const prefsWidget = new Gtk.Grid();
    notebook = new Gtk.Notebook({
        tab_pos: Gtk.PositionType.LEFT
    });
    
    prefsWidget.attach(notebook, 0, 0, 1, 1);

    const display = Gdk.Display.get_default();
    let num_monitors = GNOME40 ?
                            display.get_monitors().get_n_items() :
                            display.get_n_monitors();

    let mouseSettings = Settings.getSettings(
                                'org.gnome.desktop.peripherals.mouse',
                                '/org/gnome/desktop/peripherals/mouse/');
    let leftHandMouse = mouseSettings.get_boolean('left-handed');

    for (let monitorIndex = 0; monitorIndex < num_monitors; ++monitorIndex) {
        const monitor = GNOME40 ?
                            display.get_monitors().get_item(monitorIndex) :
                            display.get_monitor(monitorIndex);
        const geometry = monitor.get_geometry();

        let corners = Settings.Corner.forMonitor(monitorIndex, monitorIndex, geometry);

        const monitorPage = new MonitorPage();
        monitorPage._monitor = monitor;
        monitorPage._corners = corners;
        monitorPage._geometry = geometry;
        monitorPage._leftHandMouse = leftHandMouse;

        const label = new Gtk.Label({ label: _('Monitor') + ' ' + (monitorIndex + 1) });
        notebook.append_page(monitorPage, label);
        monitorPage.connect('switch-page', (notebook, page, index) => {
            page.buildPage();
        });
    }
    const optionsPage = new OptionsPage();
          optionsPage.buildPage();
    notebook.append_page(new KeyboardPage(), new Gtk.Label({ label: _('Keyboard')}));
    notebook.append_page(optionsPage , new Gtk.Label({ label: _('Options'), halign: Gtk.Align.START}));

    notebook.connect('switch-page', (notebook, page, index) => {
            page.buildPage();
    });

    notebook.set_current_page(0);
    if (!GNOME40) prefsWidget.show_all();
    return prefsWidget;
}

const MonitorPage
= GObject.registerClass(class MonitorPage extends Gtk.Notebook {
    _init(constructProperties = {tab_pos: Gtk.PositionType.TOP}) {
        super._init(constructProperties);

        this._corners = [];
        this._monitor = null;
        this._geometry = null;
        this._alreadyBuilt = false;
        this._leftHandMouse = false;
    }

    buildPage() {
        if (this._alreadyBuilt) return;

        for (let i = 0; i < this._corners.length; i++){
            const label = new Gtk.Image({
                    halign: Gtk.Align.CENTER,
                    valign: Gtk.Align.START,
                    margin_start: 10,
                    vexpand: true,
                    hexpand: true,
                    pixel_size: 40
                });
            label.set_from_file(`${Me.dir.get_path()}/icons/${this._corners[i].top ? 'Top':'Bottom'}${this._corners[i].left ? 'Left':'Right'}.svg`);
            let cPage = new CornerPage();
            cPage._corner = this._corners[i];
            cPage._geometry = this._geometry;
            cPage._leftHandMouse = this._leftHandMouse;
            this.append_page(cPage, label);
            // Gtk3 notebook emits 'switch-page' signal when showing it's content for the 1. time
            // Gtk4 doesn't, so we have to trigger the build of the first tab malually
            if (i === 0) cPage.buildPage();

        }
        if (!GNOME40) this.show_all();
        this._alreadyBuilt = true;
    }
});


const OptionsPage
= GObject.registerClass(class OptionsPage extends Gtk.Box {
    _init(constructProperties = {   orientation: Gtk.Orientation.VERTICAL,
                                    spacing:       10,
                                    homogeneous: false,
                                    margin_start:  12,
                                    margin_end:    12,
                                    margin_top:    12,
                                    margin_bottom: 12    }) {
        super._init(constructProperties);

        this._alreadyBuilt = false;
    }

    buildPage() {
        if (this._alreadyBuilt) return false;

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
                    this.append(frame);
                    frame.set_child(frameBox);
                } else {
                    this.add(frame);
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
        if (!GNOME40) this.show_all();
        this._alreadyBuilt = true;
    }
});



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

function _makeSmall(label) {
  return '<small>'+label+'</small>';
}
function _makeTitle(label) {
  return '<b>'+label+'</b>';
}
//      [root/submenu, action key,  action name,                         accelerator
const _actions = [
        [   0, 'disabled'        ,   _('-'),                                false],
        [   0, 'toggleOverview'  ,   _('Show Activities (Overview)'),       false],
        [   0, 'showApplications',   _('Show Applications'),                false],

        [null, ''                ,   _('Show / Hide Desktop'),               true],
        [   1, 'showDesktop'     ,   _('Show Desktop (all monitors)'),       true],
        [   1, 'showDesktopMon'  ,   _('Show Desktop (this monitor)'),      false],
        [   1, 'blackScreen'     ,   _('Black Screen (all monitors)'),       true],
        [   1, 'blackScreenMon'  ,   _('Black Screen (this monitor)'),      false],

        [null, ''                ,   _('Run Command'),                      false],
        [   1, 'runCommand'      ,   _('Run Command'),                      false],
        [   1, 'runDialog'       ,   _('Open "Run a Command" Dialog'),      false],

        [null, ''                ,   _('Workspaces'),                       false],
        [   1, 'prevWorkspace'   ,   _('Previous Workspace'),               false],
        [   1, 'nextWorkspace'   ,   _('Next Workspace'),                   false],
        [   1, 'recentWS'        ,   _('Recent Workspace'),                 false],
        [   1, 'moveToWorkspace' ,   _('Move to Workspace #'),              false],

        [null, ''                ,   _('Windows - Navigation'),              true],
        [   1, 'recentWin'       ,   _('Recent Window (Alt+Tab)'),          false],
        [   1, 'prevWinWsMon'    ,   _('Previous Window (this monitor)'),   false],
        [   1, 'prevWinWS'       ,   _('Previous Window (current WS)'),      true],
        [   1, 'prevWinAll'      ,   _('Previous Window (all)'),             true],
        [   1, 'nextWinWsMon'    ,   _('Next Window (this monitor)'),       false],
        [   1, 'nextWinWS'       ,   _('Next Window (current WS)'),          true],
        [   1, 'nextWinAll'      ,   _('Next Window (all)'),                 true],

        [null, ''                ,   _('Windows - Control'),                 true],
        [   1, 'closeWin'        ,   _('Close Window'),                     false],
        [   1, 'killApp'         ,   _('Kill Application'),                  true],
        [   1, 'maximizeWin'     ,   _('Maximize Window'),                  false],
        [   1, 'minimizeWin'     ,   _('Minimize Window'),                  false],
        [   1, 'fullscreenWin'   ,   _('Fullscreen Window'),                false],
        [   1, 'aboveWin'        ,   _('Win Always on Top'),                false],
        [   1, 'stickWin'        ,   _('Win Always on Visible WS'),         false],

        [null, ''                ,   _('Windows - Effects'),                 true],
        [   1, 'invertLightWin'  ,   _('Invert Lightness (window)'),         true],
        [   1, 'tintRedToggleWin',   _('Red Tint Mono (window)'),            true],
        [   1, 'tintGreenToggleWin', _('Green Tint Mono (window)'),          true],
        [   1, 'brightUpWin'     ,   _('Brightness Up (window)'),            true],
        [   1, 'brightDownWin'   ,   _('Brightness Down (window)'),          true],
        [   1, 'contrastUpWin'   ,   _('Contrast Up (window)'),              true],
        [   1, 'contrastDownWin' ,   _('Contrast Down (window)'),            true],
        [   1, 'opacityUpWin'    ,   _('Opacity Up (window)'),               true],
        [   1, 'opacityDownWin'  ,   _('Opacity Down (window)'),             true],
        [   1, 'opacityToggleWin',   _('Toggle Transparency (window)'),      true],
        [   1, 'desaturateWin'   ,   _('Desaturate (window)'),               true],

        [null, ''                ,   _('Global Effects'),                    true],
        [   1, 'toggleNightLight',   _('Toggle Night Light (Display settings)'), true],
        [   1, 'invertLightAll'  ,   _('Invert Lightness (global)'),         true],
        [   1, 'tintRedToggleAll',   _('Red Tint Mono (global)'),            true],
        [   1, 'tintGreenToggleAll', _('Green Tint Mono (global)'),          true],
        [   1, 'brightUpAll'     ,   _('Brightness Up (global)'),            true],
        [   1, 'brightDownAll'   ,   _('Brightness Down (global)'),          true],
        [   1, 'contrastUpAll'   ,   _('Contrast Up (global)'),              true],
        [   1, 'contrastDownAll' ,   _('Contrast Down (global)'),            true],
        [   1, 'desaturateAll'   ,   _('Desaturate (global)'),               true],
        [   1, 'removeAllEffects',   _('Remove All Effects'),                true],

        [null, ''                ,   _('Universal Access'),                 false],
        [   1, 'toggleZoom'      ,   _('Toggle Zoom'),                      false],
        [   1, 'zoomIn'          ,   _('Zoom In'),                          false],
        [   1, 'zoomOut'         ,   _('Zoom Out'),                         false],
        [   1, 'screenReader'    ,   _('Screen Reader'),                    false],
        [   1, 'largeText'       ,   _('Large Text'),                       false],
        [   1, 'keyboard'        ,   _('Screen Keyboard'),                  false],

        [null, ''                ,   _('Gnome Shell'),                       true],
        [   1, 'hidePanel'       ,   _('Hide/Show Main Panel'),              true],
        [   1, 'toggleTheme'     ,   _('Toggle Light/Dark Gtk Theme'),       true],

        [null, ''                ,   _('System'),                            true],
        [   1, 'screenLock'      ,   _('Lock Screen'),                      false],
        [   1, 'suspend'         ,   _('Suspend to RAM'),                    true],
        [   1, 'powerOff'        ,   _('Power Off Dialog'),                 false],
        [   1, 'logout'          ,   _('Log Out Dialog'),                   false],
        [   1, 'switchUser'      ,   _('Switch User (if exists)'),          false],

        [null, ''                ,   _('Sound'),                            false],
        [   1, 'volumeUp'        ,   _('Volume Up'),                        false],
        [   1, 'volumeDown'      ,   _('Volume Down'),                      false],
        [   1, 'muteAudio'       ,   _('Mute'),                             false],

        [null, ''                ,   _('Debug'),                             true],
        [   1, 'lookingGlass'    ,   _('Looking Glass (GS debugger)'),       true],
        [   1, 'restartShell'    ,   _('Restart Gnome Shell (X11 only)'),    true],

        [   0, 'prefs'           ,   _('Open Preferences'),                  true]
    ]; // end

const _d40exclude = [
                        'invertLightAll',
                        'invertLightWin',
];

const CornerPage
= GObject.registerClass(class CornerPage extends Gtk.Grid {
    _init(constructProperties = {
                column_homogeneous: false,
                row_homogeneous: false,
                margin_start:   10,
                margin_end:     10,
                margin_top:     10,
                margin_bottom:  10,
                column_spacing: 10      }) {

        super._init(constructProperties);

        this._alreadyBuilt = false;
        this._corner = null;
        this._geometry = null;
        this._leftHandMouse = false;
    }

    buildPage() {
        if (this._alreadyBuilt) return;
        this._alreadyBuilt = true;
        for (let trigger of triggers) {

            const ctrlBtn = new Gtk.CheckButton(
            //const ctrlBtn = new Gtk.ToggleButton(
                {
                    label: _('Ctrl'),
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
            ctrlBtn.connect('notify::active', ()=> {
                this._corner.setCtrl(trigger, ctrlBtn.active);
            });
            ctrlBtn.set_active(this._corner.getCtrl(trigger));
            const cw = this._buildTriggerWidget(trigger);
            const trgIcon = new Gtk.Image({
                halign: Gtk.Align.START,
                margin_start: 10,
                vexpand: true,
                hexpand: true,
                pixel_size: 40
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
            this.attach(cw, 2, trigger, 1, 1);
        }
        const ew = this._buildExpandWidget(this._corner);
        this.attach(ew, 0, 6, 3, 1);
        if (!GNOME40) this.show_all();
    }

    _buildTriggerWidget(trigger) {
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
        fullscreenSwitch.active = this._corner.getFullscreen(trigger);
        fullscreenSwitch.connect('notify::active', () => {
            this._corner.setFullscreen(trigger, fullscreenSwitch.active);
        });
    
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
            commandEntryRevealer.reveal_child = this._corner.getAction(trigger) === 'runCommand';
            wsIndexRevealer.reveal_child = this._corner.getAction(trigger) === 'moveToWorkspace';
            if (this._corner.getAction(trigger) === 'runCommand' && !cmdConnected) {
                _connectCmdBtn();
                commandEntry.text = this._corner.getCommand(trigger);
                commandEntryRevealer.reveal_child = this._corner.getAction(trigger) === 'runCommand';
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
                            return false;
                        }
                    );
                });
                wsIndexRevealer.reveal_child = this._corner.getAction(trigger) === 'moveToWorkspace';
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
                        return false;
                    }
            );
        });
    
        if (trigger === Settings.Triggers.PRESSURE) {
            this._buildPressureSettings(popupGrid);
        }
   
        if (!GNOME40) cw.show_all();
        return cw;
    }

    _fillCombo(actionTreeStore, actionCombo, trigger) {
        let iterDict = {};
        let iter, iter2;
        for (let i = 0; i < _actions.length; i++){
            let item = _actions[i];
            if (GNOME40 && _d40exclude.indexOf(item[1]) > -1) continue;
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
        if (iterDict[this._corner.getAction(trigger)]) actionCombo.set_active_iter(iterDict[this._corner.getAction(trigger)]);
    }

    _buildPressureSettings(popupGrid) {
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
            upper: this._geometry.width,
            step_increment: 10,
            page_increment: 100
        });
        const barrierAdjustmentV = new Gtk.Adjustment({
            lower: 1,
            upper: this._geometry.height,
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


        barrierSizeSpinButtonH.value = this._corner.barrierSizeH;
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
                    this._corner.barrierSizeH = barrierSizeSpinButtonH.value;
                    barrierSizeSpinButtonH.timeout_id = null;
                    return false;
                }
            );
        });
        barrierSizeSpinButtonV.value = this._corner.barrierSizeV;
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
                    this._corner.barrierSizeV = barrierSizeSpinButtonV.value;
                    barrierSizeSpinButtonV.timeout_id = null;
                    return false;
                }
            );
        });
    
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
                    return false;
                }
            );
        });
    }

    _buildExpandWidget() {
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
              hIcon.set_from_file(`${Me.dir.get_path()}/icons/${this._corner.top ? 'Top':'Bottom'}${this._corner.left ? 'Left':'Right'}HE.svg`);
        const vIcon = new Gtk.Image({
                        halign: Gtk.Align.START,
                        margin_start: 10,
                        //vexpand: true,
                        hexpand: true,
                        pixel_size: 40
                    });
        vIcon.set_from_file(`${Me.dir.get_path()}/icons/${this._corner.top ? 'Top':'Bottom'}${this._corner.left ? 'Left':'Right'}VE.svg`);
    
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
        ew.attach(hIcon,         0, 1, 1, 1);
        ew.attach(hExpandSwitch, 1, 1, 1, 1);
        ew.attach(vIcon,         2, 1, 1, 1);
        ew.attach(vExpandSwitch, 3, 1, 1, 1);
        hExpandSwitch.active = this._corner.hExpand;
        vExpandSwitch.active = this._corner.vExpand;
        hExpandSwitch.connect('notify::active', () => {
            this._corner.hExpand = hExpandSwitch.active;
        });
        vExpandSwitch.connect('notify::active', () => {
            this._corner.vExpand = vExpandSwitch.active;
        });
        GNOME40 ?
            frame.set_child(ew):
            frame.add(ew);
        return frame;
    }

    _chooseAppDialog() {
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
});

const KeyboardPage
= GObject.registerClass(class KeyboardPage extends Gtk.ScrolledWindow {
    _init(params) {
        super._init({margin_start: 12, margin_end: 12, margin_top: 12, margin_bottom: 12});
        this._alreadyBuilt = false;
    }

    buildPage() {
        if (this._alreadyBuilt) return false;

        let add;
        GNOME40 ?
            add = 'set_child':
            add = 'add';
        this.grid = new Gtk.Grid({margin_top: 6, hexpand: true});
        let lbl = new Gtk.Label({
            use_markup: true,
            label: _makeTitle(_("Keyboard Shortcuts:")),
        });
        let frame = new Gtk.Frame({
                label_widget: lbl });
        this[add](frame);
        frame[add](this.grid);
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
                this._storeKeyBind(name, [value]);
                Object.entries(this.keybindings).forEach(([key, value]) => {
                });
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
                this._storeKeyBind(name, []);
            }
        });

        this._populateTreeview();
        //this.treeView.expand_all();

        this.treeView.append_column(actions);
        this.treeView.append_column(accels);

        if (!GNOME40) this.show_all();

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
        for (let i = 0; i < _actions.length; i++){
            let item = _actions[i];
            if ((GNOME40 && _d40exclude.indexOf(item[1]) > -1) || !item[3]) continue;
            let a = [0, 0];
            if (item[1] && (item[1] in this.keybindings && this.keybindings[item[1]][0])) {
                let binding = this.keybindings[item[1]][0];
                let ap = Gtk.accelerator_parse(binding);
                if (ap[0] && ap[1]) a = [ap[1], ap[0]];
                else log ("conversion error");
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

    _storeKeyBind(action, value) {
        let key = this._translateActionToKey(action);
        mscOptions.setKeyBind(key, value);
    }

    // the -gdh extension's purpose is to make key names unique
    // in case of conflict with system shortcut system wins
    _translateKeyToAction(key) {
        let regex = /-(.)/g;
        return key.replace(regex,function($0,$1) {
            return $0.replace($0, $1.toUpperCase());
        }).replace('Gdh', '');
    }

    _translateActionToKey(action) {
        let regex = /([A-Z])/g;
        return action.replace(regex,function($0, $1) {
            return $0.replace($0, `-${$1}`.toLowerCase());
        }) + '-gdh';
    }
});