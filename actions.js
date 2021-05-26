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
'use strict';

const GObject                = imports.gi.GObject;
const GLib                   = imports.gi.GLib;
const Clutter                = imports.gi.Clutter;
const St                     = imports.gi.St;
const Shell                  = imports.gi.Shell;
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

let GNOME40;


var Actions = class {
    constructor() {
        this._signalsCollector      = [];

        this._minimizedWindows      = [];
        this._dimmerActors          = [];

        this._a11yAppsSettings      = null;
        this._a11yMagnifierSettings = null;
        this._interfaceSettings     = null;
        this._shellSettings         = null;

        this._wsSwitchIgnoreLast    = false;
        this._wsSwitchWrap          = false;
        this._wsSwitchIndicator     = false;

        this._winSwitchWrap         = false;
        this._winSkipMinimized      = false;

        this._recentWorkspace       = -1;
        this._currentWorkspace      = -1;

        this._mainPanelVisible      = Main.panel.is_visible();

        this._connectRecentWorkspace();

        GNOME40 = Settings.GNOME40;
    }

    clean() {
        this._destroyDimmerActors();
        this.removeAllEffects();
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
        this._shellSettings         = null;
        this._colorSettings         = null;

    }

    removeAllEffects(force = false) {
        this._getShellSettings();
        let enabled = this._shellSettings.get_strv('enabled-extensions');
        // don't reset effects if extension is enabled (GS calls ext. disable() before locking screen f.e.)
        if (!force && enabled.indexOf(Me.metadata.uuid) > -1)
            return;
        for (let actor of global.get_window_actors()) {
                this._removeEffects(actor);
        }
            // remove global effect
        this._removeEffects(Main.uiGroup, true);//.remove_effect_by_name(effect);
    }

    removeWinEffects() {
        this._removeEffects(this._getFocusedActor());
    }

    _removeEffects(obj = null, glob = false) {
        let effects = [ 'brightness',
                        'contrast',
                        'lightness-invert',
                        'desaturate',
                        'color-tint' ];
        for (let effect of effects) {
            obj.remove_effect_by_name(effect);
        }
        if (!glob) {
            let winActor = obj.get_meta_window().get_compositor_private();
            this._getWindowSurface(winActor).opacity = 255;
        }
    }

    _getShellSettings() {
        if (!this._shellSettings) {
            this._shellSettings = Settings.getSettings(
                            'org.gnome.shell',
                            '/org/gnome/shell/');
        }
        return this._shellSettings;
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

    _getColorSettings() {
        if (!this._colorSettings) {
            this._colorSettings = Settings.getSettings(
                            'org.gnome.settings-daemon.plugins.color',
                            '/org/gnome/settings-daemon/plugins/color/');
        }
        return this._colorSettings;
    }

    _connectRecentWorkspace() {
        this._signalsCollector.push((global.workspace_manager).connect('workspace-switched', this._onWorkspaceSwitched.bind(this)));
    }
    _onWorkspaceSwitched(display, prev, current, direction) {
        if (current !== this._currentWorkspace) {
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
        return global.display.focus_window;

        /*let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (let win of windows) {
            if (win.has_focus()) {
                return win;
            }
        }
        log (`[${Me.metadata.name}] Warning: no focused window found`);
        return null;*/
    }

    _getWindowSurface(windowActor) {
        for (let child of windowActor.get_children()) {
            if (child.constructor.name.indexOf('MetaSurfaceActor') > -1) {
                return child;
            }
        }
        return null;
    }

    toggleOverview() {
        Main.overview.toggle();
    }
    showApplications() {
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
        Util.spawnCommandLine(command);
    }
    moveToWorkspace(index) {
        if (index < 0)  return;
        let maxIndex = global.workspaceManager.n_workspaces - 1;
        if (maxIndex < index) {
            index = maxIndex;
        }
        let ws = global.workspaceManager.get_workspace_by_index(index);
        Main.wm.actionMoveWorkspace(ws);
        // another option
        //ws.activate(global.get_current_time());
    }
    moveToRecentWorkspace() {
        this.moveToWorkspace(this._recentWorkspace);
    }
    reorderWorkspace(direction = 0) {
        let activeWs = global.workspace_manager.get_active_workspace();
        let activeWsIdx = activeWs.index();
        let targetIdx = activeWsIdx + direction;
        if (targetIdx < 0 || targetIdx > (global.workspace_manager.get_n_workspaces() - 1)) return;
        global.workspace_manager.reorder_workspace(activeWs, targetIdx);
    }
    lockScreen() {
        //Main.screenShield.lock(true);
        SystemActions.getDefault().activateLockScreen();
    }
    suspendToRam () {
        SystemActions.getDefault().activateSuspend();
    }
    powerOff() {
        SystemActions.getDefault().activatePowerOff();
    }
    logOut() {
        SystemActions.getDefault().activateLogout();
    }
    switchUser() {
        SystemActions.getDefault().activateSwitchUser();

    }
    toggleLookingGlass() {
        if (Main.lookingGlass === null)
            Main.createLookingGlass();
        if (Main.lookingGlass !== null)
            Main.lookingGlass.toggle();
    }
    recentWindow() {
        global.display.get_tab_list(0, null)[1].activate(global.get_current_time());
    }
    closeWindow() {
        let win = this._getFocusedWindow();
        if (!win) return;
        win.delete(global.get_current_time());
    }
    killApplication() {
        let win = this._getFocusedWindow();
        if (!win) return;
        win.kill();
    }
    toggleMaximizeWindow() {
        let win = this._getFocusedWindow();
        if (!win) return;
        if (win.maximized_horizontally && win.maximized_vertically)
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        else win.maximize(Meta.MaximizeFlags.BOTH);
    }
    minimizeWindow() {
        global.display.get_tab_list(0, null)[0].minimize();
    }
    toggleFullscreenWindow() {
        let win = this._getFocusedWindow();
        if (!win) return;
        if (win.fullscreen) win.unmake_fullscreen();
        else win.make_fullscreen();
    }
    toggleAboveWindow() {
        let win = this._getFocusedWindow();
        if (!win) return;
        if (win.above) {
            win.unmake_above();
            //Main.notify(Me.metadata.name, _(`Disabled: Always on Top \n\n${win.title}` ));
        }
        else {
            win.make_above();
            //Main.notify(Me.metadata.name, _(`Enabled: Always on Top \n\n${win.title}` ));
        }
    }
    toggleStickWindow() {
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
        if (!Meta.is_wayland_compositor()) {
            Meta.restart(_('Restarting Gnome Shell...'));
        }
        else {
            Main.notify(Me.metadata.name, _('Gnome Shell - Restart is unavailable in Wayland session' ));
        }
    }
    showPrefs() {
        ExtManager.openExtensionPrefs(Me.metadata.uuid, '', {});
    }
    toggleShowPanel() {
        Main.panel.is_visible() ?
            Main.panel.hide()   :
            Main.panel.show();
    }
    toggleTheme() {
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
        Main.openRunDialog();
    }

    openPreferences() {
        ExtManager.openExtensionPrefs(Me.metadata.uuid, '', {});
    }

    togleShowDesktop(monitorIdx = -1) {
        if (Main.overview.visible) return;
        let metaWorkspace = global.workspace_manager.get_active_workspace();
        let windows = metaWorkspace.list_windows();
        let wins=[];
        for (let win of windows) {
            if ( (monitorIdx < 0 ? true : win.get_monitor() === monitorIdx) &&
                    (!(win.minimized ||
                    win.window_type === Meta.WindowType.DESKTOP ||
                    win.window_type === Meta.WindowType.DOCK ||
                    win.skip_taskbar
                ))) {
    
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
        // filter out skip_taskbar windows and windows with modals
        // top modal windows should stay
        windows = windows.filter( w => modals.indexOf(w) && !w.is_skip_taskbar());
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
        windows[targetIdx].activate(global.get_current_time());
    }
    
    adjustVolume(direction) {
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
            sink.volume = volume;
            sink.push_volume();
        }
    }

    _getFocusedActor() {
        let actor = null;
        for (let act of global.get_window_actors()) {
            let meta_window = act.get_meta_window();
            if(meta_window.has_focus())
                actor = act;
        }
        if (!actor) log (`[${Me.metadata.name}] Warning: no focused window found`);
        return actor;
    }

    adjustWindowOpacity(step = 0, toggleValue = 0) {
        let metaWindow = this._getFocusedWindow();
        let windowActor = metaWindow.get_compositor_private();
        let windowSurface = this._getWindowSurface(windowActor);

        let value;
        if (toggleValue) {
            value = windowSurface.opacity === 255 ?
                        toggleValue : 255;
        } else {
            value = windowSurface.opacity;
            value += step;
            if (value > 255) value = 255;
            if (value < 32) value = 32;
        }
        windowSurface.opacity = value;
    }

    adjustSwBrightnessContrast(step = 0, window=false, brightness = true, valueO = null) {
        // brightness/contrast range: -1 all black/gray, 0 normal, 1 all white/extreme contrast
        // step with +/- value from range
        let name = brightness ?
                        'brightness':
                        'contrast';
        let brightnessContrast, value;
        const getBCValue = function() {
            return brightness ?
                            brightnessContrast.get_brightness()[0] : // Clutter returns value in [r,g,b] format
                            brightnessContrast.get_contrast()[0];
        }
        const setBCValue = function(val) {
            return brightness ?
                            brightnessContrast.set_brightness(val) :
                            brightnessContrast.set_contrast(val);
        }
        if (window) {
            let actor = this._getFocusedActor();
            if (!actor) return;
            if (!actor.get_effect(name)) {
                actor.add_effect_with_name(name, new Clutter.BrightnessContrastEffect());
            }
            brightnessContrast = actor.get_effect(name);
        } else {
            if (!Main.uiGroup.get_effect(name)) {
                Main.uiGroup.add_effect_with_name( name, new Clutter.BrightnessContrastEffect());
            }
            brightnessContrast = Main.uiGroup.get_effect(name);
        }
        if (!valueO) {
            value = getBCValue();
            // multiply to avoid value shifting
            value = Math.round((value * 1000) + (step *1000));
            let max = brightness ? 0 : 300;
            if (value > max) value = max;
            if (value < -750) value = -750;
            value /= 1000;
        } else {
            value = valueO;
            if (valueO === Math.round(getBCValue()*1000)/1000) {
                value = 0;
            }
        }
        setBCValue(value);
        // notify when normal contrast is reached
        if (!valueO && value === 0) {
            brightness ?
                brightnessContrast.set_brightness(-0.3) :
                brightnessContrast.set_contrast(-0.1);
            GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                100,
                () => {
                    setBCValue(value);
                    return false;
                }
            );
        }

    }
    
    toggleDesaturateEffect(window = true) {
        let name = 'desaturate';
        let effect = Clutter.DesaturateEffect;
        if (window)
            this._toggleWindowEffect(name, effect);
        else
            this._toggleGlobalEffect(name, effect);

    }

    toggleNightLight() {
        let settings = this._getColorSettings();
        settings.set_boolean('night-light-enabled', !settings.get_boolean('night-light-enabled'));
    }

    toggleColorTintEffect(color, window = true) {
        let name = 'color-tint';
        let effect = Clutter.ColorizeEffect;
        if (window)
            this._toggleWindowEffect(name, effect, color);
        else
            this._toggleGlobalEffect(name, effect, color);
    }

    toggleLightnessInvertEffect(window = true) {
        let name = 'lightness-invert';
        let effect;
        if (GNOME40) effect = Shell.InvertLightnessEffect;
        else         effect = InvertLightnessEffect;
        if (window)
            this._toggleWindowEffect(name, effect);
        else
            this._toggleGlobalEffect(name, effect);
    }
    
    _toggleGlobalEffect(name, effect, tint = null) {
        if (Main.uiGroup.get_effect(name))
            Main.uiGroup.remove_effect_by_name(name);
        else
            if (tint)
                Main.uiGroup.add_effect_with_name(name, new effect({tint:tint}));
            else
                Main.uiGroup.add_effect_with_name(name, new effect());
    }

    _toggleWindowEffect(name, effect, tint = null) {
        global.get_window_actors().forEach(function(actor) {
            let meta_window = actor.get_meta_window();
            if(meta_window.has_focus()) {
                if(actor.get_effect(name))
                    actor.remove_effect_by_name(name);
                else
                    if (tint)
                        actor.add_effect_with_name(name, new effect({tint:tint}));    
                    else
                        actor.add_effect_with_name(name, new effect());
            }
        });
    }
    
    toggleDimmMonitors(alpha, text, monitorIdx = -1) {
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
        let appSettings = this._getA11yAppSettings();
        appSettings.set_boolean(
                        'screen-reader-enabled',
                        !appSettings.get_boolean('screen-reader-enabled')
        );
    }
    toggleLargeText() {
        let intSettings = this._getInterfaceSettings();
        if (intSettings.get_double('text-scaling-factor') > 1)
            intSettings.reset('text-scaling-factor');
        else intSettings.set_double('text-scaling-factor', 1.25);
    }

}
//Code taken from True color invert extension
/////////////////////////////////////////////////////////////////////
const InvertLightnessEffect = GObject.registerClass(
class InvertLightnessEffect extends Clutter.ShaderEffect {

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

