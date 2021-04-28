/* This is a part of Custom Hot Corners - Extended, the Gnome Shell extension
 * Copyright 2021 GdH <georgdh@gmail.com>
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

const GObject                = imports.gi.GObject;
//const GLib                   = imports.gi.GLib;
const Clutter                = imports.gi.Clutter;
const St                     = imports.gi.St;
const Main                   = imports.ui.main;
const Meta                   = imports.gi.Meta;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const Volume                 = imports.ui.status.volume;
const Util                   = imports.misc.util;
const ExtensionUtils         = imports.misc.extensionUtils;
const SystemActions          = imports.misc.systemActions;
const Me                     = ExtensionUtils.getCurrentExtension();
const Settings               = Me.imports.settings;
const ExtManager             = Main.extensionManager;

//let LOG = print;
let LOG = function() {return;};

var Actions = class {
    constructor() {
        this._signalsCollector      = [];

        this._minimizedWindows      = [];
        this._dimmerActors          = [];

        this._a11yAppsSettings      = null;
        this._a11yMagnifierSettings = null;
        this._interfaceSettings     = null;

        this._wsSwitchIgnoreLast    = false;
        this._wsSwitchWrap          = false;
        this._wsSwitchIndicator     = false;

        this._winSwitchWrap         = false;
        this._winSkipMinimized      = false;

        this._recentWorkspace       = -1;
        this._currentWorkspace      = -1;

        this._mainPanelVisible      = Main.panel.is_visible();

        this._connectRecentWorkspace();
    }

    clean() {
        this._destroyDimmerActors();
        this._removeEffects();
            LOG(`[${Me.metadata.name}]     disable: ${this._signalsCollector.length} signals are being disconnected..`);
        global.workspace_manager.disconnect(this._signalsCollector.pop());
        this._mainPanelVisible ?
            Main.panel.show() :
            Main.panel.hide();
        this._resetSettings();

    }
    _resetSettings() {
        this._a11yAppsSettings      = null;
        this._a11yMagnifierSettings = null;
        this._interfaceSettings     = null;

    }

    _getA11yAppSettings() {
        if (!this._a11yAppsSettings) {
            this._a11yAppsSettings = Settings.getSettings(
                            'org.gnome.desktop.a11y.applications',
                            '/org/gnome/desktop/a11y/applications/');
        }
        return this._a11yAppsSettings;
    }

    _getA11yMagnifierSettings() {
        if (!this._a11yMagnifierSettings) {
            this._a11yMagnifierSettings = Settings.getSettings(
                            'org.gnome.desktop.a11y.magnifier',
                            '/org/gnome/desktop/a11y/magnifier/');
        }
        return this._a11yMagnifierSettings;
    }

    _getInterfaceSettings() {
        if (!this._interfaceSettings) {
            this._interfaceSettings = Settings.getSettings(
                            'org.gnome.desktop.interface',
                            '/org/gnome/desktop/interface/');
        }
        return this._interfaceSettings;
    }

    _connectRecentWorkspace() {
        LOG(`[${Me.metadata.name}] _connectRecentWorkspace`);
        this._signalsCollector.push((global.workspace_manager).connect('workspace-switched', this._onWorkspaceSwitched.bind(this)));
    }
    _onWorkspaceSwitched(display, prev, current, direction) {
        if (current !== this._currentWorkspace) {
            LOG(`[${Me.metadata.name}]     _connectRecentWorkspace callback: setting new recent WS`);
            this._recentWorkspace  = this._currentWorkspace;
            this._currentWorkspace = current;
        }
    }
    _destroyDimmerActors() {
        for (let actor of this._dimmerActors) {
            actor.destroy();
        }
        this._dimmerActors = [];
    }
    _getFocusedWindow() {
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        let focused = null;
        for (let win of windows) {
            if (win.has_focus()) {
                focused = win;
                break;
            }
        }
        return focused;
    }
    _removeEffects() {
        LOG(`[${Me.metadata.name}] _removeEffects`);
        global.get_window_actors().forEach(function(actor) {
                actor.remove_effect_by_name('invert-color');
            });
    }

    toggleOverview() {
            LOG(`[${Me.metadata.name}]   _toggleOverview`);
        Main.overview.toggle();
    }
    showApplications() {
            LOG(`[${Me.metadata.name}]   _showApplications`);
        if (Main.overview.dash.showAppsButton.checked)
            Main.overview.hide();
        else {
            // Pressing the apps btn before overview activation avoids icons animation in GS 3.36/3.38
            Main.overview.dash.showAppsButton.checked = true;
            // in 3.36 pressing the button is usualy enough to activate overview, but not always
            Main.overview.show();
            // pressing apps btn before overview has no effect in GS 40, so once again
            Main.overview.dash.showAppsButton.checked = true;

            // Main.overview.showApps()  // GS 40 only, can show app grid, but not when overview is already active
            // Main.overview.viewSelector._toggleAppsPage();  // GS 36/38
        }
    }
    runCommand(command) {
            LOG(`[${Me.metadata.name}]   _runCommand`);
        Util.spawnCommandLine(command);
    }
    moveToWorkspace(index) {
            LOG(`[${Me.metadata.name}]   _moveToWorkspace`);
        if (index < 0)  return;
        let maxIndex = global.workspaceManager.n_workspaces - 1;
        if (maxIndex < index) {
            index = maxIndex;
        }
            LOG(`[${Me.metadata.name}]   _moveToWorkspace: moving to ${index}`);
        let ws = global.workspaceManager.get_workspace_by_index(index);
        Main.wm.actionMoveWorkspace(ws);
        // another option
        //ws.activate(global.get_current_time());
    }
    moveToRecentWorkspace() {
        this.moveToWorkspace(this._recentWorkspace);
    }
    lockScreen() {
            LOG(`[${Me.metadata.name}]   _lockScreen`);
        //Main.screenShield.lock(true);
        SystemActions.getDefault().activateLockScreen();
    }
    suspendToRam () {
            LOG(`[${Me.metadata.name}]   _suspendToRam`);
        SystemActions.getDefault().activateSuspend();
    }
    powerOff() {
            LOG(`[${Me.metadata.name}]   _powerOff`);
        SystemActions.getDefault().activatePowerOff();
    }
    logOut() {
            LOG(`[${Me.metadata.name}]   _logOut`);
        SystemActions.getDefault().activateLogout();
    }
    switchUser() {
            LOG(`[${Me.metadata.name}]   _switchUser`);
        SystemActions.getDefault().activateSwitchUser();

    }
    toggleLookingGlass() {
            LOG(`[${Me.metadata.name}]   _toggleLookingGlass`);
        if (Main.lookingGlass === null)
            Main.createLookingGlass();
        if (Main.lookingGlass !== null)
            Main.lookingGlass.toggle();
    }
    recentWindow() {
            LOG(`[${Me.metadata.name}]   _recentWindow`);
        global.display.get_tab_list(0, null)[1].activate(global.get_current_time());
    }
    closeWindow() {
            LOG(`[${Me.metadata.name}]   _closeWindow`);
        let win = this._getFocusedWindow();
        if (!win) return;
        win.kill();
    }
    toggleMaximizeWindow() {
            LOG(`[${Me.metadata.name}]   _maximizeWindow`);
        let win = this._getFocusedWindow();
        if (!win) return;
        if (win.maximized_horizontally && win.maximized_vertically)
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        else win.maximize(Meta.MaximizeFlags.BOTH);
    }
    minimizeWindow() {
            LOG(`[${Me.metadata.name}]   _minimizeWindow`);
        global.display.get_tab_list(0, null)[0].minimize();
    }
    toggleFullscreenWindow() {
            LOG(`[${Me.metadata.name}]   _maximizeWindow`);
        let win = this._getFocusedWindow();
        if (!win) return;
        if (win.fullscreen) win.unmake_fullscreen();
        else win.make_fullscreen();
    }
    toggleAboveWindow() {
            LOG(`[${Me.metadata.name}]   _aboveWindow`);
        let win = this._getFocusedWindow();
        if (!win) return;
        if (win.above) {
            win.unmake_above();
            Main.notify(Me.metadata.name, _(`Disabled: Always on Top \n\n${win.title}` ));
        }
        else {
            win.make_above();
            Main.notify(Me.metadata.name, _(`Enabled: Always on Top \n\n${win.title}` ));
        }
    }
    toggleStickWindow() {
            LOG(`[${Me.metadata.name}]   _stickWindow`);
        let win = this._getFocusedWindow();
        if (!win) return;
        if (win.is_on_all_workspaces()){
            win.unstick();
            Main.notify(Me.metadata.name, _(`Disabled: Always on Visible Workspace \n\n${win.title}` ));
        }
        else{
            win.stick();
            Main.notify(Me.metadata.name, _(`Enabled: Always on Visible Workspace \n\n${win.title}` ));
        }
    }
    restartGnomeShell() {
            LOG(`[${Me.metadata.name}]   _restartGnomeShell`);
        if (!Meta.is_wayland_compositor()) {
            Meta.restart(_('Restarting Gnome Shell ...'));
        }
        else {
            Main.notify(Me.metadata.name, _('Gnome Shell - Restart is unavailable in Wayland session' ));
        }
    }
    showPrefs() {
        ExtManager.openExtensionPrefs(Me.metadata.uuid, '', {});
    }
    toggleShowPanel() {
            LOG(`[${Me.metadata.name}]   togglePanel`);
        Main.panel.is_visible() ?
            Main.panel.hide()   :
            Main.panel.show();
    }
    toggleTheme() {
            LOG(`[${Me.metadata.name}]   toggleTheme`);
        let intSettings = this._getInterfaceSettings();
        let theme = intSettings.get_string('gtk-theme');
        switch (theme) {
            case 'Yaru-light':
                intSettings.set_string('gtk-theme', 'Yaru-dark');
                break;
            case 'Yaru-dark':
                intSettings.set_string('gtk-theme', 'Yaru-light');
                break;
            case 'Adwaita':
                intSettings.set_string('gtk-theme', 'Adwaita-dark');
                break;
            case 'Adwaita-dark':
                intSettings.set_string('gtk-theme', 'Adwaita');
                break;
            default:
                Main.notify(Me.metadata.name, _('Theme switcher works with Adwaita/Adwaita-dark and Yaru-light/Yaru-dark themes only'));
        }
    }
    openRunDialog() {
            LOG(`[${Me.metadata.name}]   _runDialog`);
        Main.openRunDialog();
    }

    openPreferences() {
        ExtManager.openExtensionPrefs(Me.metadata.uuid, '', {});
    }

    togleShowDesktop(monitorIdx = -1) {
            LOG(`[${Me.metadata.name}] _togleShowDesktop`);
        if (Main.overview.visible) return;
        let metaWorkspace = global.workspace_manager.get_active_workspace();
        let windows = metaWorkspace.list_windows();
        let wins=[];
        for (let win of windows) {
            let wm_class = win.wm_class ? win.wm_class.toLowerCase() : 'null';
            let window_type = win.window_type ? win.window_type : 'null';
            let title = win.title ? win.title : 'null';
            // if monitorIdx has default value don't filter by monitor
            if ( (monitorIdx < 0 ? true : win.get_monitor() === monitorIdx) &&
                (!(win.minimized ||
                    window_type === Meta.WindowType.DESKTOP ||
                    window_type === Meta.WindowType.DOCK ||
                    // DING is GS extenson providing desktop icons
                    title.startsWith('DING') ||
                    wm_class.endsWith('notejot') ||
                    // conky is a system monitor for Desktop, but not always is its window of type WindowType.DESKTOP
                    wm_class === 'conky' ||
                    ( title.startsWith('@!') && title.endsWith('BDH') ) ))
                ) {
    
                wins.push(win);
            }
        }
        if (wins.length !== 0) {
            for (let win of wins) {
                win.minimize();
            }
            this._minimizedWindows = wins;
        }
        else if (this._minimizedWindows !== 0) {
            for (let win of this._minimizedWindows) {
                if (win) {
                    win.unminimize();
                }
            }
            this._minimizedWindows = [];
        }
    }
    
    switchWorkspace(direction) {
                LOG(`[${Me.metadata.name}] switchWorkspace`);
            let n_workspaces = global.workspaceManager.n_workspaces;
            let lastWsIndex =  n_workspaces - (this._wsSwitchIgnoreLast ? 2 : 1);
            let motion;
    
            let activeWs  = global.workspaceManager.get_active_workspace();
            let activeIdx = activeWs.index();
            let targetIdx = this._wsSwitchWrap ? 
                            (activeIdx + (direction ? 1 : lastWsIndex )) % (lastWsIndex + 1) :
                            activeIdx + (direction ? 1 : -1);
            if (targetIdx < 0 || targetIdx > lastWsIndex) {
                targetIdx = activeIdx;
            }
            let ws = global.workspaceManager.get_workspace_by_index(targetIdx);
            if (!ws || ws.index() === activeIdx) {
                return Clutter.EVENT_STOP;
            }
    
            if (this._wsSwitchIndicator) {
                if (Main.wm._workspaceSwitcherPopup == null)
                    Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
                    Main.wm._workspaceSwitcherPopup.reactive = false;
                    Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
                        Main.wm._workspaceSwitcherPopup = null;
                    });
                // Do not show wokspaceSwithcer in overview
                if (!Main.overview.visible) {
                    let motion = direction ? Meta.MotionDirection.DOWN : Meta.MotionDirection.UP
                    Main.wm._workspaceSwitcherPopup.display(motion, ws.index());
                }
            }
            Main.wm.actionMoveWorkspace(ws);
            return Clutter.EVENT_STOP;
    }
    
    switchWindow(direction, wsOnly = false, monitorIndex = -1) {
            LOG(`[${Me.metadata.name}] _switchWindow`);
        let workspaceManager = global.workspace_manager;
        let workspace = wsOnly ? workspaceManager.get_active_workspace() : null;
        // get all windows, skip-taskbar included
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace);
        if (monitorIndex > -1)
            windows = windows.filter(w => w.get_monitor() === monitorIndex);
        // when window with attached modal window is activated, focus shifts to modal window ...
        //  ... and switcher can stuck trying to activate same window again ...
        //  ... when these windows are next to each other in window list
        // map windows with modals attached ...
        // ... and filter out not modal windows and duplicates
        let modals = windows.map(w => 
            w.get_transient_for() ? w.get_transient_for() : null
            ).filter((w, i, a) => w !==null && a.indexOf(w) == i);
                                                                                    LOG(`[${Me.metadata.name}]     _switchWindow: Modals Parents: ${modals.map(w => w ? w.wm_class:w)}`);
        // filter out skip_taskbar windows and windows with modals
        // top modal windows should stay
        windows = windows.filter( w => modals.indexOf(w) && !w.is_skip_taskbar());
                                                                                    LOG(`[${Me.metadata.name}]     _switchWindow: Windows: ${windows.map(w => w ? w.title:w)}`);
        if (this._winSkipMinimized)
            windows = windows.filter(win => !win.minimized);
    
        if (!windows.length) return;
    
        let currentWin  = windows[0];
        // tab list is sorted by MRU order, active window is allways idx 0
        // each window has index in global stable order list (as launched)
        windows.sort((a, b) => {
                return a.get_stable_sequence() - b.get_stable_sequence();
            });
        const currentIdx = windows.indexOf(currentWin);
        let targetIdx = currentIdx + direction;
        if (targetIdx > windows.length - 1) targetIdx = this._winSwitchWrap ? 0 : currentIdx;
        else if (targetIdx < 0) targetIdx = this._winSwitchWrap ? windows.length - 1 : currentIdx;
            LOG(`[${Me.metadata.name}]     _switchWindow: Current win: ${windows[currentIdx].title} -> Target win: ${windows[targetIdx].title}`);
            LOG(`[${Me.metadata.name}]     _switchWindow: Current idx: ${currentIdx} -> Target idx: ${targetIdx}`);
        windows[targetIdx].activate(global.get_current_time());
    }
    
    adjustVolume(direction) {
            LOG(`[${Me.metadata.name}] _adjustVolume`);
        let mixerControl = Volume.getMixerControl();
        let sink = mixerControl.get_default_sink();
        if (direction === 0) {
            sink.change_is_muted(!sink.is_muted);
        }
        else {
            let volume = sink.volume;
            let max = mixerControl.get_vol_max_norm();
            let step = direction * 2048;
            volume = volume + step;
            if (volume > max) volume = max;
            if (volume <   0) volume = 0;
            LOG(`[${Me.metadata.name}]     _adjustVolume: Adjusting Volume to: ${volume}`);
            sink.volume = volume;
            sink.push_volume();
        }
    }
    
    toggleLightnessInvert() {
        global.get_window_actors().forEach(function(actor) {
            let meta_window = actor.get_meta_window();
            if(meta_window.has_focus()) {
                if(actor.get_effect('invert-color')) {
                    actor.remove_effect_by_name('invert-color');
                    delete meta_window._invert_window_tag;
                }
                else {
                    let effect = new TrueInvertEffect();
                    actor.add_effect_with_name('invert-color', effect);
                    meta_window._invert_window_tag = true;
                }
            }
        });
    }
    
    /////////////////////////////////////////////////////////
    
    toggleDimmMonitors(alpha, text, monitorIdx = -1) {
        LOG(`[${Me.metadata.name}] _toggleDimmMonitors`);
        // reverse order to avoid conflicts after dimmer removed
        let createNew = true;
        if (monitorIdx === -1 && (this._dimmerActors.length === Main.layoutManager.monitors.length)) {
                this._destroyDimmerActors();
                createNew = false;
        }
        for (let i = this._dimmerActors.length - 1; i > -1;  i--) {
    
            if (this._dimmerActors[i].name === `${monitorIdx}`) {
    
                let idx = this._dimmerActors.indexOf(this._dimmerActors[i]);
                if (idx > -1) {
                    this._dimmerActors[i].destroy();
                    this._dimmerActors.splice(idx, 1);
                    createNew = false;
                }
            }
        }
        if (createNew) {
            if (monitorIdx === -1) this._destroyDimmerActors();
            let monitors = [...Main.layoutManager.monitors.keys()];
    
            for (let monitor of monitors) {
    
                if ( (monitorIdx < 0 ? true : monitor === monitorIdx)) {
                    let geometry = global.display.get_monitor_geometry(monitor);
                    let actor = new St.Label ({
                        name: `${monitor}`,
                        text: text,
                        x: geometry.x,
                        y: geometry.y,
                        width: geometry.width,
                        height: geometry.height,
                        style: 'background-color: #000000; color: #444444; font-size: 1em;',
                        opacity: alpha,
                        reactive: true
                    });
                    actor.connect('button-press-event', () => this.toggleDimmMonitors(null, null, monitorIdx));
                    //global.stage.add_actor(actor);  // actor added like this is transparent for the mouse pointer events
                    Main.layoutManager.addChrome(actor);
                    this._dimmerActors.push(actor);
                }
            }
        }
    }
    
    zoom(step = 0) {
        let appSettings = this._getA11yAppSettings();
        let magSettings = this._getA11yMagnifierSettings();

        if (step === 0) {
            if (  ! appSettings.get_boolean('screen-magnifier-enabled')
                 && magSettings.get_double('mag-factor') === 1
                )
                magSettings.set_double('mag-factor', 2);
            appSettings.set_boolean('screen-magnifier-enabled',
                                                !appSettings.get_boolean('screen-magnifier-enabled')
            );
        } else {

            if (!appSettings.get_boolean('screen-magnifier-enabled')) {
               magSettings.set_double('mag-factor', 1);
            }
            let value = magSettings.get_double('mag-factor') + step;
            if (value <= 1) {
                value = 1;
                // when Zoom = 1 enabled, graphics artefacts might follow mouse pointer
                if (appSettings.get_boolean('screen-magnifier-enabled'))
                    appSettings.set_boolean('screen-magnifier-enabled', false);
                    return;
            }
            if (value > 5) value = 5;
            magSettings.set_double('mag-factor', value);
            if (!appSettings.get_boolean('screen-magnifier-enabled'))
               appSettings.set_boolean('screen-magnifier-enabled', true);
        }
        //Main.magnifier.setActive(true); // simple way to activate zoom
    }
    toggleKeyboard(monitorIndex = 0) {
            LOG(`[${Me.metadata.name}]   _toggleKeyboard`);
        let visible = Main.keyboard.visible;
        let appSettings = this._getA11yAppSettings();
        if (visible)
            appSettings.set_boolean('screen-keyboard-enabled', false);
        else {
            if (!appSettings.get_boolean('screen-keyboard-enabled')) {
                appSettings.set_boolean('screen-keyboard-enabled', true);
            }
            Main.keyboard.open(monitorIndex);
        }
    }
    toggleScreenReader() {
            LOG(`[${Me.metadata.name}]   togglescreenReader`);
        let appSettings = this._getA11yAppSettings();
        appSettings.set_boolean(
                        'screen-reader-enabled',
                        !appSettings.get_boolean('screen-reader-enabled')
        );
    }
    toggleLargeText() {
            LOG(`[${Me.metadata.name}]   _largeText`);
        let intSettings = this._getInterfaceSettings();
        if (intSettings.get_double('text-scaling-factor') > 1)
            intSettings.reset('text-scaling-factor');
        else intSettings.set_double('text-scaling-factor', 1.25);
    }

}
//Code taken from (and compatible with) True color invert extension
/////////////////////////////////////////////////////////////////////
const TrueInvertEffect = GObject.registerClass(
class TrueInvertEffect extends Clutter.ShaderEffect {

    vfunc_get_static_shader_source() {
        return `
            uniform bool invert_color;
            uniform float opacity = 1.0;
            uniform sampler2D tex;

            /**
             * based on shift_whitish.glsl https://github.com/vn971/linux-color-inversion
             */
            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
                
                /* shifted */
                float white_bias = .17;
                float m = 1.0 + white_bias;
                
                float shift = white_bias + c.a - min(c.r, min(c.g, c.b)) - max(c.r, max(c.g, c.b));
                
                c = vec4((shift + c.r) / m, 
                        (shift + c.g) / m, 
                        (shift + c.b) / m, 
                        c.a);
                    
                /* non-shifted */
                // float shift = c.a - min(c.r, min(c.g, c.b)) - max(c.r, max(c.g, c.b));
                // c = vec4(shift + c.r, shift + c.g, shift + c.b, c.a);

                cogl_color_out = c;
            }
        `;
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value("tex", 0);
        super.vfunc_paint_target(paint_context);
    }
});