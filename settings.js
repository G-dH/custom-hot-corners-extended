/* Copyright 2020 Jan Runge <janrunx@gmail.com>
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
'use strict';
const {GLib, Gio} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Config = imports.misc.config;
var   shellVersion = Config.PACKAGE_VERSION;
var   GNOME40 = shellVersion.startsWith("40")?
                    GNOME40 = true:
                    GNOME40 = false;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
var _ = Gettext.gettext;

var Triggers ={
    PRESSURE:         0,
    BUTTON_PRIMARY:   1,
    BUTTON_SECONDARY: 2,
    BUTTON_MIDDLE:    3,
    SCROLL_UP:        4,
    SCROLL_DOWN:      5
}
Object.freeze(Triggers);

var TriggerLabels = [   
    _('Hot Corner'),
    _('Primary Button'),
    _('Secondary Button'),
    _('Middle Button'),
    _('Scroll Up'),
    _('Scroll Down')
];

const _schema = 'org.gnome.shell.extensions.custom-hot-corners-extended';
const _path = '/org/gnome/shell/extensions/custom-hot-corners-extended';

function listTriggers() {
    return Object.values(Triggers);
}

var MscOptions = class MscOptions {
    constructor() {
        this._gsettings = this._loadSettings('misc');
        this._gsettingsKB = this._loadSettings('shortcuts');
        this._connectionIds = [];
    }

    connect(name, callback) {
        const id = this._gsettings.connect(name, callback);
        this._connectionIds.push(id);
        return id;
    }

    destroy() {
        this._connectionIds.forEach(id => this._gsettings.disconnect(id));
    }

    _loadSettings(schm) {
        const schema = `${_schema}.${schm}`;
        const path = `${_path}/${schm}/`;
        return getSettings(schema, path);
    }
    get watchCorners() {
        return this._gsettings.get_boolean('watch-corners');
    }
    set watchCorners(bool_val) {
        this._gsettings.set_boolean('watch-corners', bool_val);
    }
    get fullscreenGlobal() {
        return this._gsettings.get_boolean('fullscreen-global');
    }
    set fullscreenGlobal(bool_val) {
        this._gsettings.set_boolean('fullscreen-global', bool_val);
    }
    get cornersVisible() {
        return this._gsettings.get_boolean('corners-visible');
    }
    set cornersVisible(bool_val) {
        this._gsettings.set_boolean('corners-visible', bool_val);
    }
    get winSwitchWrap() {
        return this._gsettings.get_boolean('win-switch-wrap');
    }
    set winSwitchWrap(bool_val) {
        this._gsettings.set_boolean('win-switch-wrap', bool_val);
    }
    get winSkipMinimized() {
        return this._gsettings.get_boolean('win-switch-skip-minimized');
    }
    set winSkipMinimized(bool_val) {
        this._gsettings.set_boolean('win-switch-skip-minimized', bool_val);
    }
    get wsSwitchIgnoreLast() {
        return this._gsettings.get_boolean('ws-switch-ignore-last');
    }
    set wsSwitchIgnoreLast(bool_val) {
        this._gsettings.set_boolean('ws-switch-ignore-last', bool_val);
    }
    get wsSwitchWrap() {
        return this._gsettings.get_boolean('ws-switch-wrap');
    }
    set wsSwitchWrap(bool_val) {
        this._gsettings.set_boolean('ws-switch-wrap', bool_val);
    }
    get wsSwitchIndicator() {
        return this._gsettings.get_boolean('ws-switch-indicator');
    }
    set wsSwitchIndicator(bool_val) {
        this._gsettings.set_boolean('ws-switch-indicator', bool_val);
    }
    get actionEventDelay() {
        return this._gsettings.get_int('action-event-delay');
    }
    set actionEventDelay(delay) {
        this._gsettings.set_int('action-event-delay', delay);
    }
    get rippleAnimation() {
        return this._gsettings.get_boolean('ripple-animation');
    }
    set rippleAnimation(bool_val) {
        this._gsettings.set_boolean('ripple-animation', bool_val);
    }
    get barrierFallback() {
        return this._gsettings.get_boolean('barrier-fallback');
    }
    set barrierFallback(bool_val) {
        this._gsettings.set_boolean('barrier-fallback', bool_val);
    }
    getKeyBind(key) {
        return this._gsettingsKB.get_strv(key);
    }
    setKeyBind(key, value) {
        this._gsettingsKB.set_strv(key, value);
    }
}

var Corner = class Corner {
    constructor(loadIndex, monitorIndex, top, left, x, y) {
        this._gsettings = {};
        this.monitorIndex = monitorIndex;
        this._loadIndex = loadIndex;
        this.top = top;
        this.left = left;
        this.x = x;
        this.y = y;
        this._gsettings = this._loadSettingsForTrigges();
        this._connectionIds = [];
        this.hotCornerExists = false;
        this.fullExpandHorizontal = false;
        this.fullExpandVertical = false;

        this.action = {};
        this.ctrl ={};
        this.command = {};
        this.fullscreen = {};
        this.workspaceIndex = {};
        for (let trigger of listTriggers()) {
            this.action[trigger] = this.getAction(trigger);
            this.ctrl[trigger] = this.getCtrl(trigger);
            this.command[trigger] = this.getCommand(trigger);
            this.fullscreen[trigger] = this.getFullscreen(trigger);
            this.workspaceIndex[trigger] = this.getWorkspaceIndex(trigger);
        }
    }

    static forMonitor(loadIndex, index, geometry) {
        let corners = [];
        for (let top of [true, false]) {
            for (let left of [true, false]) {
                let x = left ? geometry.x : geometry.x + geometry.width - 1;
                let y = top ? geometry.y : geometry.y + geometry.height - 1;
                let c = new Corner(loadIndex, index, top, left, x, y);
                corners.push(c);
            }
        }
        return corners;
    }

    connect(name, callback, trigger) {
        const id = this._gsettings[trigger].connect(name, callback);
        this._connectionIds.push([this._gsettings[trigger],id]);
        return id;
    }

    destroy() {
        //log(`[${Me.metadata.name}] Settings.Corner.destroy: Disconnecting corner gsettings..`);
        this._connectionIds.forEach(id => id[0].disconnect(id[1]));
    }

    _loadSettingsForTrigges() {
        let gsettings = {};
        for (let trigger of listTriggers()) {
            gsettings[trigger]= this._loadSettings(trigger);
        }
        return gsettings;
    }


    getAction(trigger) {
        return this._gsettings[trigger].get_string('action');
    }

    setAction(trigger, action) {
        this._gsettings[trigger].set_string('action', action);
    }

    getCommand(trigger) {
        return this._gsettings[trigger].get_string('command');
    }

    setCommand(trigger, command) {
        this._gsettings[trigger].set_string('command', command);
    }

    getFullscreen(trigger) {
        return this._gsettings[trigger].get_boolean('fullscreen');
    }

    setFullscreen(trigger, bool_val) {
        this._gsettings[trigger].set_boolean('fullscreen', bool_val);
    }

    getWorkspaceIndex(trigger) {
        return this._gsettings[trigger].get_int('workspace-index');
    }

    setWorkspaceIndex(trigger, index) {
        this._gsettings[trigger].set_int('workspace-index', index);
    }

    getCtrl(trigger) {
        return this._gsettings[trigger].get_boolean('ctrl');
    }

    setCtrl(trigger, ctrl) {
        this._gsettings[trigger].set_boolean('ctrl', ctrl);
    }

    get hExpand() {
        return this._gsettings[Triggers.BUTTON_PRIMARY].get_boolean('h-expand');
    }

    set hExpand(bool_val) {
        this._gsettings[Triggers.BUTTON_PRIMARY].set_boolean('h-expand', bool_val);
    }

    get vExpand() {
        return this._gsettings[Triggers.BUTTON_PRIMARY].get_boolean('v-expand');
    }

    set vExpand(bool_val) {
        this._gsettings[Triggers.BUTTON_PRIMARY].set_boolean('v-expand', bool_val);
    }

    get barrierSizeH() {
        return this._gsettings[Triggers.PRESSURE].get_int('barrier-size-h');
    }

    set barrierSizeH(size) {
        this._gsettings[Triggers.PRESSURE].set_int('barrier-size-h', size);
    }
    get barrierSizeV() {
        return this._gsettings[Triggers.PRESSURE].get_int('barrier-size-v');
    }

    set barrierSizeV(size) {
        this._gsettings[Triggers.PRESSURE].set_int('barrier-size-v', size);
    }

    get pressureThreshold() {
        return this._gsettings[Triggers.PRESSURE].get_int('pressure-threshold');
    }

    set pressureThreshold(threshold) {
        this._gsettings[Triggers.PRESSURE].set_int('pressure-threshold', threshold);
    }

    _loadSettings(trigger) {
        const schema = `${_schema}.corner`;
        const v = this.top ? 'top' : 'bottom';
        const h = this.left ? 'left' : 'right';
        let path = `${_path}/`;
        path += `monitor-${this._loadIndex}-${v}-${h}-${trigger}/`;
        return getSettings(schema, path);
    }
}

/**
 * Copied from Gnome Shells extensionUtils.js and adapted to allow
 * loading the setting with a specific path.
 */
function getSettings(schema, path) {
    const schemaDir = Me.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir.get_path(),
            Gio.SettingsSchemaSource.get_default(),
            false
        );
    } else {
        schemaSource = Gio.SettingsSchemaSource.get_default();
    }

    const schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj) {
        throw new Error(
            'Schema' + schema + ' could not be found for extension ' +
            Me.metadata.uuid + '. Please check your installation.'
        );
    }

    const args = { settings_schema: schemaObj };
    if (path) {
        args.path = path;
    }

    return new Gio.Settings(args);
}

//      [root/submenu, action key,  action name,                         accelerator
var actionList = [
        [   0, 'disabled'              ,   _('-'),                                false],
        [   0, 'toggle-overview'       ,   _('Show Activities Overview'),         false],
        [   0, 'show-applications'     ,   _('Show All Applications'),            false],

        [null, ''                      ,   _('Show / Hide Desktop'),               true],
        [   1, 'show-desktop'          ,   _('Show Desktop (all monitors)'),       true],
        [   1, 'show-desktop-mon'      ,   _('Show Desktop (this monitor)'),      false],
        [   1, 'black-screen'          ,   _('Black Screen (all monitors)'),       true],
        [   1, 'black-screen-mon'      ,   _('Black Screen (this monitor)'),      false],

        [null, ''                      ,   _('Run Command'),                      false],
        [   1, 'run-command'           ,   _('Run the preset Command'),           false],
        [   1, 'run-prompt'            ,   _('Show the Run Command Prompt'),      false],

        [null, ''                      ,   _('Workspaces'),                        true],
        [   1, 'prev-workspace'        ,   _('Previous Workspace'),               false],
        [   1, 'next-workspace'        ,   _('Next Workspace'),                   false],
        [   1, 'recent-workspace'      ,   _('Recent Workspace'),                  true],
        [   1, 'move-to-workspace'     ,   _('Move to Workspace #'),              false],
        [   1, 'reorder-ws-prev'       ,   _(`Reorder Workspace - ${GNOME40? _('Left') : _('Up')}`),  true],
        [   1, 'reorder-ws-next'       ,   _(`Reorder Workspace - ${GNOME40? _('Right') : _('Down')}`),true],

        [null, ''                      ,   _('Windows - Navigation'),              true],
        [   1, 'recent-win'            ,   _('Recent Window (Alt+Tab)'),          false],
        [   1, 'prev-win-mon'          ,   _('Previous Window (this monitor)'),   false],
        [   1, 'prev-win-ws'           ,   _('Previous Window (current WS)'),      true],
        [   1, 'prev-win-all'          ,   _('Previous Window (all)'),             true],
        [   1, 'next-win-mon'          ,   _('Next Window (this monitor)'),       false],
        [   1, 'next-win-ws'           ,   _('Next Window (current WS)'),          true],
        [   1, 'next-win-all'          ,   _('Next Window (all)'),                 true],

        [null, ''                      ,   _('Windows - Control'),                 true],
        [   1, 'make-thumbnail-win'    ,   _('Make draggable Window Thumbnail'),   true],
        [   1, 'close-win'             ,   _('Close Window'),                     false],
        [   1, 'kill-app'              ,   _('Kill Application'),                  true],
        [   1, 'maximize-win'          ,   _('Maximize Window'),                  false],
        [   1, 'minimize-win'          ,   _('Minimize Window'),                  false],
        [   1, 'unminimize-all-ws'     ,   _('Unminimize All (workspace)'),        true],
        [   1, 'fullscreen-win'        ,   _('Fullscreen Window'),                false],
        [   1, 'above-win'             ,   _('Win Always on Top'),                false],
        [   1, 'stick-win'             ,   _('Win Always on Visible WS'),         false],

        [null, ''                      ,   _('Windows - Visual Adjustments'),      true],
        [   1, 'bright-up-win'         ,   _('Brightness Up (window)'),            true],
        [   1, 'bright-down-win'       ,   _('Brightness Down (window)'),          true],
        [   1, 'contrast-up-win'       ,   _('Contrast Up (window)'),              true],
        [   1, 'contrast-down-win'     ,   _('Contrast Down (window)'),            true],
        [   1, 'contrast-high-win'     ,   _('High Contrast (window)'),            true],
        [   1, 'contrast-low-win'      ,   _('Low Contrast (window)'),             true],
        [   1, 'opacity-up-win'        ,   _('Opacity Up (window)'),               true],
        [   1, 'opacity-down-win'      ,   _('Opacity Down (window)'),             true],
        [   1, 'opacity-toggle-win'    ,   _('Transparency o200 (window)'),        true],
        [   1, 'opacity-toggle-hc-win' ,   _('Transparency o200/c0.20 (window)'),  true],
        [   1, 'opacity-toggle-lc-win' ,   _('Transparency o240/c0.05 (window)'),  true],

        [null, ''                      ,   _('Windows - Color Effects'),           true],
        [   1, 'invert-light-win'      ,   _('Invert Lightness (window)'),         true],
        [   1, 'invert-light-shift-win',   _('Invert Lightness - White to Grey (window)'), true],
        [   1, 'invert-colors-win'     ,   _('Invert Colors (window)'),            true],
        [   1, 'tint-red-toggle-win'   ,   _('Red Tint Mono (window)'),            true],
        [   1, 'tint-green-toggle-win' ,   _('Green Tint Mono (window)'),          true],
        [   1, 'desaturate-win'        ,   _('Desaturate (window)'),               true],
        [   1, 'remove-effects-win'    ,   _('Remove All Effects (window)'),       true],

        [null, ''                      ,   _('Global Effects'),                    true],
        [   1, 'bright-up-all'         ,   _('Brightness Up (global)'),            true],
        [   1, 'bright-down-all'       ,   _('Brightness Down (global)'),          true],
        [   1, 'contrast-up-all'       ,   _('Contrast Up (global)'),              true],
        [   1, 'contrast-down-all'     ,   _('Contrast Down (global)'),            true],
        [   1, 'contrast-high-all'     ,   _('High Contrast (global)'),            true],
        [   1, 'contrast-low-all'      ,   _('Low Contrast (global)'),             true],
        [   1, 'invert-light-all'      ,   _('Invert Lightness (global)'),         true],
        [   1, 'invert-light-shift-all',  _('Invert Lightness Shifted (global)'), true],
        [   1, 'night-light-toggle'    ,   _('Toggle Night Light (Display settings)'), true],
        [   1, 'tint-red-toggle-all'   ,   _('Red Tint Mono (global)'),            true],
        [   1, 'tint-green-toggle-all' ,   _('Green Tint Mono (global)'),          true],
        [   1, 'desaturate-all'        ,   _('Desaturate (global)'),               true],
        [   1, 'remove-effects-all'    ,   _('Remove All Effects (global)'),       true],

        [null, ''                      ,   _('Universal Access'),                  true],
        [   1, 'toggle-zoom'           ,   _('Toggle Zoom'),                       true],
        [   1, 'zoom-in'               ,   _('Zoom In'),                           true],
        [   1, 'zoom-out'              ,   _('Zoom Out'),                          true],
        [   1, 'screen-reader'         ,   _('Screen Reader'),                     true],
        [   1, 'large-text'            ,   _('Large Text'),                        true],
        [   1, 'keyboard'              ,   _('Screen Keyboard'),                   true],
        [   1, 'invert-light-all'      ,   _('Invert Lightness (global)'),         true],
        [   1, 'protan-toggle-all'     ,   _('Color Correction - Protanopia'),     true],
        [   1, 'deuter-toggle-all'     ,   _('Color Correction - Deuteranopia'),   true],
        [   1, 'tritan-toggle-all'     ,   _('Color Correction - Tritanopia'),     true],
        [   1, 'protan-sim-toggle-all' ,   _('Color Simulation - Protanopia'),     true],
        [   1, 'deuter-sim-toggle-all' ,   _('Color Simulation - Deuteranopia'),   true],
        [   1, 'tritan-sim-toggle-all' ,   _('Color Simulation - Tritanopia'),     true],
        [   1, 'mixer-gbr-toggle-all'  ,   _('Color Mixer GBR'),                   true],

        [null, ''                      ,   _('Gnome Shell'),                       true],
        [   1, 'hide-panel'            ,   _('Hide/Show Main Panel'),              true],
        [   1, 'toggle-theme'          ,   _('Toggle Light/Dark Gtk Theme'),       true],

        [null, ''                      ,   _('System'),                            true],
        [   1, 'lock-screen'           ,   _('Lock Screen'),                      false],
        [   1, 'suspend'               ,   _('Suspend to RAM'),                    true],
        [   1, 'power-off'             ,   _('Power Off Dialog'),                  true],
        [   1, 'log-out'               ,   _('Log Out Dialog'),                    true],
        [   1, 'switch-user'           ,   _('Switch User (if exists)'),           true],

        [null, ''                      ,   _('Sound'),                            false],
        [   1, 'volume-up'             ,   _('Volume Up'),                        false],
        [   1, 'volume-down'           ,   _('Volume Down'),                      false],
        [   1, 'mute-sound'            ,   _('Volume mute/unmute'),               false],

        [null, ''                      ,   _('Debug'),                             true],
        [   1, 'looking-glass'         ,   _('Looking Glass (GS debugger)'),       true],
        [   1, 'restart-shell'         ,   _('Restart Gnome Shell (X11 only)'),    true],

        [   0, 'prefs'                 ,   _('Open Preferences'),                  true]
    ]; // end


var transitionMap = new Map([
        ['toggleOverview',    'toggle-overview'],
        ['showApplications',  'show-applications'],
        ['showDesktop',       'show-desktop'],
        ['showDesktopMon',    'show-desktop-mon'],
        ['blackScreen',       'black-screen'],
        ['blackScreenMon',    'black-screen-mon'],
        ['runCommand',        'run-command'],
        ['runDialog',         'run-prompt'],
        ['prevWorkspace',     'prev-workspace'],
        ['nextWorkspace',     'next-workspace'],
        ['moveToWorkspace',   'move-to-workspace'],
        ['reorderWsPrev',     'reorder-ws-prev'],
        ['reorderWsNext',     'reorder-ws-next'],
        ['recentWorkspace',   'recent-workspace'],
        ['prevWinAll',        'prev-win-all'],
        ['prevWinWS',         'prev-win-ws'],
        ['prevWinWsMon',      'prev-win-mon'],
        ['nextWinAll',        'next-win-all'],
        ['nextWinWS',         'next-win-ws'],
        ['nextWinWsMon',      'next-win-mon'],
        ['recentWin',         'recent-win'],
        ['closeWin',          'close-win'],
        ['killApp',           'kill-app'],
        ['maximizeWin',       'maximize-win'],
        ['minimizeWin',       'minimize-win'],
        ['fullscreenWin',     'fullscreen-win'],
        ['aboveWin',          'above-win'],
        ['stickWin',          'stick-win'],
        ['screenLock',        'lock-screen'],
        ['suspend',           'suspend'],
        ['powerOff',          'power-off'],
        ['logout',            'log-out'],
        ['switchUser',        'switch-user'],
        ['volumeUp',          'volume-up'],
        ['volumeDown',        'volume-down'],
        ['muteAudio',         'mute-sound'],
        ['toggleZoom',        'toggle-zoom'],
        ['zoomIn',            'zoom-in'],
        ['zoomOut',           'zoom-out'],
        ['largeText',         'large-text'],
        ['screenReader',      'screen-reader'],
        ['hidePanel',         'hide-panel'],
        ['toggleTheme',       'toggle-theme'],
        ['lookingGlass',      'looking-glass'],
        ['restartShell',      'restart-shell'],
        ['invertLightWin',    'invert-light-win'],
        ['invertLightAll',    'invert-light-all'],
        ['desaturateAll',     'desaturate-all'],
        ['desaturateWin',     'desaturate-win'],
        ['brightUpAll',       'bright-up-all'],
        ['brightDownAll',     'bright-down-all'],
        ['brightUpWin',       'bright-up-win'],
        ['brightDownWin',     'bright-down-win'],
        ['contrastUpAll',     'contrast-up-all'],
        ['contrastDownAll',   'contrast-down-all'],
        ['contrastUpWin',     'contrast-up-win'],
        ['contrastDownWin',   'contrast-down-win'],
        ['contrastHighAll',   'contrast-high-all'],
        ['contrastHighWin',   'contrast-high-win'],
        ['contrastLowAll',    'contrast-low-all'],
        ['contrastLowWin',    'contrast-low-win'],
        ['opacityUpWin',      'opacity-up-win'],
        ['opacityDownWin',    'opacity-down-win'],
        ['opacityToggleWin',  'opacity-toggle-win'],
        ['tintRedToggleWin',  'tint-red-toggle-win'],
        ['tintRedToggleAll',  'tint-red-toggle-all'],
        ['tintGreenToggleWin','tint-green-toggle-win'],
        ['tintGreenToggleAll','tint-green-toggle-all'],
        ['toggleNightLight',  'night-light-toggle'],
        ['removeAllEffects',  'remove-effects-all'],
        ['removeWinEffects',  'remove-effects-win']
    ]);
