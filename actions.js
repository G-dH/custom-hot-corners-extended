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

const {GLib, Clutter, St, Meta, Shell} = imports.gi;

const Main                   = imports.ui.main;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const Volume                 = imports.ui.status.volume;
const PopupMenu              = imports.ui.popupMenu;
const BoxPointer             = imports.ui.boxpointer;
const AltTab                 = imports.ui.altTab;

const Util                   = imports.misc.util;
const SystemActions          = imports.misc.systemActions;
const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();
const Settings               = Me.imports.settings;

// gettext
const _                      = Settings._;

let WindowSwitcherPopup      = null;
let Shaders                  = null;
let WinTmb                   = null;
let _origAltTabWSP           = null;

let GNOME40;

const ws_indicator_mode = {
    'DISABLE': 0,
    'DEFAULT': 1,
    'INDEX':   2,
};

function get_current_monitor_geometry() {
    return global.display.get_monitor_geometry(global.display.get_current_monitor());
}

var Actions = class {
    constructor() {
        this._signalsCollector      = [];

        this._minimizedWindows      = [];
        this._dimmerActors          = [];

        this._a11yAppsSettings      = null;
        this._a11yMagnifierSettings = null;
        this._interfaceSettings     = null;
        this._shellSettings         = null;

        this.WS_IGNORE_LAST         = false;
        this.WS_WRAPAROUND          = false;
        this.WS_INDICATOR_MODE      = false;

        this.WIN_WRAPAROUND         = false;
        this.WIN_SKIP_MINIMIZED     = false;

        this._recentWorkspace       = -1;
        this._currentWorkspace      = -1;

        this.windowThumbnails       = [];
        this.tmbConnected           = false;

        this._mainPanelVisible      = Main.panel.is_visible();

        this.customMenu             = [];

        this._connectRecentWorkspace();

        GNOME40 = Settings.GNOME40;
        this._mscOptions = null;
    }

    clean(full = true) {
        // don't reset effects and destroy thumbnails if extension is enabled (GS calls ext. disable() before locking the screen f.e.)
        if (full) {
            this._mainPanelVisible
                ? Main.panel.show()
                : Main.panel.hide();
            this.removeAllEffects();
            this._resetSettings();

            for (let sig of this._signalsCollector)
                sig[0].disconnect(sig[1]);

            this.Shaders   = null;
        }
        // global.workspace_manager.disconnect(this._signalsCollector.pop());
        this._removeThumbnails(full);
        this._destroyDimmerActors();
        this._removeCustomMenus();
    }

    resume() {
        this._resumeThumbnailsIfExist();
    }

    _resumeThumbnailsIfExist() {
        this.windowThumbnails.forEach(
            t => {
                if (t)
                    t.show();
            }
        );
    }

    _removeThumbnails(full = true) {
        if (full) {
            this.windowThumbnails.forEach(
                t => {
                    if (t)
                        t.destroy();
                }
            );
            this.windowThumbnails = [];
        } else {
            this.windowThumbnails.forEach(
                t => {
                    if (t)
                        t.hide();
                }
            );
        }
    }

    _resetSettings() {
        this._a11yAppsSettings      = null;
        this._a11yMagnifierSettings = null;
        this._interfaceSettings     = null;
        this._shellSettings         = null;
        this._colorSettings         = null;
    }

    removeAllEffects(full = false) {
        for (let actor of global.get_window_actors())
            this._removeEffects(actor);
        // remove global effect
        this._removeEffects(Main.uiGroup, true); // .remove_effect_by_name(effect);
    }

    removeWinEffects() {
        this._removeEffects(this._getFocusedActor());
    }

    _removeEffects(actor = null, glob = false) {
        if (actor === null)
            return;
        let effects = [
            'brightness',
            'contrast',
            'inversion',
            'desaturate',
            'color-tint',
            'color-blind',
        ];

        for (let effect of effects)
            actor.remove_effect_by_name(effect);
        if (!glob && actor.metaWindow._opacityCE)
            this._getWindowSurface(actor.get_meta_window()).opacity = 255;
    }

    _removeCustomMenus() {
        for (let i = 1; i < 5; i++) {
            if (this.customMenu[i]) {
                this.customMenu[i].destroy();
                this.customMenu[i] = null;
            }
        }
    }

    extensionEnabled(uuid = null) {
        this._getShellSettings();
        let enabled = this._shellSettings.get_strv('enabled-extensions');
        enabled = enabled.indexOf(Me.metadata.uuid) > -1;
        let disabled = this._shellSettings.get_strv('disabled-extensions');
        disabled = disabled.indexOf(Me.metadata.uuid) > -1;
        let disableUser = this._shellSettings.get_boolean('disable-user-extensions');

        if (enabled && !disabled && !disableUser)
            return true;
        return false;
    }

    _getShellSettings() {
        if (!this._shellSettings) {
            this._shellSettings = Settings.getSettings(
                'org.gnome.shell',
                '/org/gnome/shell/'
            );
        }
        return this._shellSettings;
    }

    _getA11yAppSettings() {
        if (!this._a11yAppsSettings) {
            this._a11yAppsSettings = Settings.getSettings(
                'org.gnome.desktop.a11y.applications',
                '/org/gnome/desktop/a11y/applications/'
            );
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
        let actor = global.workspace_manager;
        let connection = actor.connect('workspace-switched', this._onWorkspaceSwitched.bind(this));
        this._signalsCollector.push([actor, connection]);
    }

    _onWorkspaceSwitched(display, prev, current, direction) {
        if (current !== this._currentWorkspace) {
            this._recentWorkspace  = this._currentWorkspace;
            this._currentWorkspace = current;
        }
    }

    _destroyDimmerActors() {
        for (let actor of this._dimmerActors)
            actor.destroy();
        this._dimmerActors = [];
    }

    _getFocusedWindow(sameWorkspace = false) {
        let win = global.display.get_focus_window();
        if (!win || (sameWorkspace && (global.workspace_manager.get_active_workspace() !== win.get_workspace())))
            return null;
        return win;
        /* let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (let win of windows) {
            if (win.has_focus()) {
                return win;
            }
        }
        log (`[${Me.metadata.name}] Warning: no focused window found`);
        return null;*/
    }

    _getWindowSurface(metaWindow) {
        let windowActor = metaWindow.get_compositor_private();
        for (let child of windowActor.get_children()) {
            if (child.constructor.name.indexOf('MetaSurfaceActor') > -1)
                return child;
        }
        return null;
    }

    _getFocusedActor() {
        let actor = null;
        for (let act of global.get_window_actors()) {
            let meta_window = act.get_meta_window();
            if (meta_window.has_focus())
                actor = act;
        }

        /* if (!actor)
            log (`[${Me.metadata.name}] Warning: no focused window found`); */
        return actor;
    }

    _getActorByMetaWin(metaWindow) {
        for (let act of global.get_window_actors()) {
            if (act.get_meta_window() === metaWindow)
                return act;
        }
        return null;
    }

    _getShaders() {
        if (!Shaders)
            Shaders = Me.imports.shaders;
    }

    /////////////////////////////////////////////////////////////////////////////
    toggleOverview() {
        Main.overview.toggle();
    }

    showApplications() {
        if (Main.overview.dash.showAppsButton.checked) {
            Main.overview.hide();
        } else {
            // Pressing the apps btn before overview activation avoids icons animation in GS 3.36/3.38
            // but in GS40 with Dash to Dock and its App button set to "no animation", this whole sequence is problematic
            if (!GNOME40)
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
        if (index < 0)
            return;
        let maxIndex = global.workspaceManager.n_workspaces - 1;
        if (maxIndex < index)
            index = maxIndex;
        let ws = global.workspaceManager.get_workspace_by_index(index);
        Main.wm.actionMoveWorkspace(ws);
        // another option
        // ws.activate(global.get_current_time());
    }

    moveToRecentWorkspace() {
        this.moveToWorkspace(this._recentWorkspace);
    }

    reorderWorkspace(direction = 0) {
        if (!Main.overview.visible)
            return;
        let activeWs = global.workspace_manager.get_active_workspace();
        let activeWsIdx = activeWs.index();
        let targetIdx = activeWsIdx + direction;
        if (targetIdx < 0 || targetIdx > (global.workspace_manager.get_n_workspaces() - 1))
            return;
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

    switchToRecentWindow() {
        global.display.get_tab_list(0, null)[1].activate(global.get_current_time());
    }

    closeWindow() {
        let win = this._getFocusedWindow(true);
        if (!win)
            return;
        win.delete(global.get_current_time());
    }

    quitApplication() {
        let win = this._getFocusedWindow(true);
        if (!win)
            return;
        Shell.WindowTracker.get_default().get_window_app(win).request_quit();
    }

    killApplication() {
        let win = this._getFocusedWindow(true);
        if (!win)
            return;
        win.kill();
    }

    toggleMaximizeWindow() {
        let win = this._getFocusedWindow(true);
        if (!win)
            return;
        if (win.maximized_horizontally && win.maximized_vertically)
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        else win.maximize(Meta.MaximizeFlags.BOTH);
    }

    minimizeWindow() {
        let win = this._getFocusedWindow(true);
        if (!win)
            return;
        win.minimize();
        //global.display.get_tab_list(0, null)[0].minimize();
    }

    unminimizeAll(workspace = true) {
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        let activeWorkspace = global.workspaceManager.get_active_workspace();
        for (let win of windows) {
            if (workspace && (activeWorkspace !== win.get_workspace()))
                continue;
            win.unminimize();
        }
    }

    toggleFullscreenWindow() {
        let win = this._getFocusedWindow(true);
        if (!win)
            return;
        if (win.fullscreen)
            win.unmake_fullscreen();
        else
            win.make_fullscreen();
    }

    fullscreenWinOnEmptyWs(metaWindow = null) {
        let win;
        if (!metaWindow)
            win = this._getFocusedWindow(true);
        else
            win = metaWindow;

        if (!win)
            return;
        if (win.fullscreen) {
            win.unmake_fullscreen();
            if (win._originalWS) {
                win.change_workspace(win._originalWS);
                Main.wm.actionMoveWorkspace(win._originalWS);
                win._originalWS = null;
            }
        } else {
            let ws = win.get_workspace();
            win.make_fullscreen();
            if (ws.n_windows > 1) {
                win._originalWS = ws;
                let lastWs = global.workspaceManager.n_workspaces - 1;
                lastWs = global.workspaceManager.get_workspace_by_index(lastWs);
                //Main.wm.actionMoveWorkspace(lastWs);
                win.change_workspace(lastWs);
                global.workspace_manager.reorder_workspace(lastWs, ws.index() + 1);
            }
            win.activate(global.get_current_time());
        }
    }

    toggleAboveWindow(metaWindow) {
        let win = metaWindow || this._getFocusedWindow(true);
        if (!win)
            return;
        if (win.is_above()) {
            win.unmake_above();
            //Main.notify(Me.metadata.name, _(`Disabled: Always on Top \n\n${win.title}` ));
        } else {
            win.make_above();
            //Main.notify(Me.metadata.name, _(`Enabled: Always on Top \n\n${win.title}` ));
        }
    }

    toggleStickWindow(metaWindow) {
        let win = metaWindow || this._getFocusedWindow(true);
        if (!win)
            return;
        if (win.is_on_all_workspaces()) {
            win.unstick();
            //Main.notify(Me.metadata.name, _(`Disabled: Always on Visible Workspace \n\n${win.title}` ));
        } else{
            win.stick();
            //Main.notify(Me.metadata.name, _(`Enabled: Always on Visible Workspace \n\n${win.title}` ));
        }
    }

    restartGnomeShell() {
        if (!Meta.is_wayland_compositor())
            Meta.restart(_('Restarting Gnome Shell...'));
        else
            Main.notify(Me.metadata.name, _('Gnome Shell - Restart is unavailable in Wayland session' ));
    }

    toggleShowPanel() {
        if (Main.panel.is_visible())
            Main.panel.hide()
        else
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
        Main.extensionManager.openExtensionPrefs(Me.metadata.uuid, '', {});
    }

    togleShowDesktop(monitorIndex = -1) {
        if (Main.overview.visible)
            return;
        let metaWorkspace = global.workspace_manager.get_active_workspace();
        let windows = metaWorkspace.list_windows();
        let wins = [];
        for (let win of windows) {
            if ((monitorIndex < 0 ? true : win.get_monitor() === monitorIndex) &&
                    (!(win.minimized ||
                    win.window_type === Meta.WindowType.DESKTOP ||
                    win.window_type === Meta.WindowType.DOCK ||
                    win.skip_taskbar
                ))) {
                wins.push(win);
            }
        }

        if (wins.length !== 0) {
            for (let win of wins)
                win.minimize();
            this._minimizedWindows = wins;
        } else if (this._minimizedWindows !== 0) {
            for (let win of this._minimizedWindows) {
                if (win)
                    win.unminimize();
            }

            this._minimizedWindows = [];
        }
    }

    // direction 0/1
    switchWorkspace(direction, noIndicator = false) {
            let n_workspaces = global.workspaceManager.n_workspaces;
            let lastWsIndex =  n_workspaces - (this.WS_IGNORE_LAST ? 2 : 1);
            let motion;
    
            let activeWs  = global.workspaceManager.get_active_workspace();
            let activeIdx = activeWs.index();
            let targetIdx = this.WS_WRAPAROUND ? 
                            (activeIdx + (direction ? 1 : lastWsIndex )) % (lastWsIndex + 1) :
                            activeIdx + (direction ? 1 : -1);
            if (targetIdx < 0 || targetIdx > lastWsIndex) {
                targetIdx = activeIdx;
            }
            let ws = global.workspaceManager.get_workspace_by_index(targetIdx);
            /*if (!ws || ws.index() === activeIdx) {
                return Clutter.EVENT_STOP;
            }*/

            const showIndicator = !noIndicator && this.WS_INDICATOR_MODE > 0;

            // show default workspace indicator popup
            if (showIndicator && this.WS_INDICATOR_MODE === ws_indicator_mode.DEFAULT) {
                const vertical = global.workspaceManager.layout_rows === -1;
                if (Main.wm._workspaceSwitcherPopup == null) {
                    Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
                    Main.wm._workspaceSwitcherPopup.reactive = false;
                    Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
                        Main.wm._workspaceSwitcherPopup = null;
                    });
                }

/*                if (this.WS_INDICATOR_MODE !== ws_indicator_mode.DEFAULT) {
                    const WS_INDICATOR_MODE = this.WS_INDICATOR_MODE;
                    const func = function() {
                        let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
                        let [, containerNatHeight] = Main.wm._workspaceSwitcherPopup._container.get_preferred_height(global.screen_width);
                        let [, containerNatWidth] = Main.wm._workspaceSwitcherPopup._container.get_preferred_width(containerNatHeight);
                        let offsetX;
                        let offsetY;
                        if (WS_INDICATOR_MODE === ws_indicator_mode.DEFAULT_LEFT) {
                            if (vertical) {
                                offsetX = 80;
                                offsetY = Math.floor((workArea.height - containerNatHeight) / 2);
                            } else {
                                offsetX = Math.floor((workArea.width - containerNatWidth) / 2);
                                offsetY = 80;
                            }
                        } else {
                            if (vertical) {
                                offsetX = Math.floor((workArea.width - containerNatWidth) - 80);
                                offsetY = Math.floor((workArea.height - containerNatHeight) / 2);
                            } else {
                                offsetX = Math.floor((workArea.width - containerNatWidth) / 2);
                                offsetY = Math.floor((workArea.height - containerNatHeight) - 80);
                            }
                        }
                        this._container.x = workArea.x + offsetX;
                        this._container.y = workArea.y + offsetY;
                    }
                    let origin = Main.wm._workspaceSwitcherPopup['_redisplay'];
                    Main.wm._workspaceSwitcherPopup['_redisplay'] = function() {
                        let ret;
                        ret = origin.apply(this, arguments);
                        if (ret === undefined)
                            ret = func.apply(this, arguments);
                        return ret;
                    }

                }
*/
                // Do not show wokspaceSwithcer in overview
                if (!Main.overview.visible) {
                    let motion = direction ? (vertical ? Meta.MotionDirection.DOWN : Meta.MotionDirection.RIGHT)
                                           : (vertical ? Meta.MotionDirection.UP   : Meta.MotionDirection.LEFT);
                    Main.wm._workspaceSwitcherPopup.display(motion, ws.index());
                }
            }

            Main.wm.actionMoveWorkspace(ws);

            // show workspace index overlay if wanted
            if (this.WS_INDICATOR_MODE === ws_indicator_mode.INDEX && showIndicator)
                this.showWorkspaceIndex();
    }

    showWorkspaceIndex(position = [], timeout = 600, names = {}) {

        let wsIndex = global.workspace_manager.get_active_workspace().index();
        let text = names[wsIndex];
        if (!text) text = `${wsIndex + 1}`;

        if (!this._wsOverlay) {

            //let monitorIndex = global.display.get_current_monitor();
            //let geometry = global.display.get_monitor_geometry(monitorIndex);
            let geometry = get_current_monitor_geometry();


            this._wsOverlay = new St.Label ({
                        name: 'ws-index',
                        text: text,
                        x: position.length ? position[0] : geometry.x,
                        y: position.length ? position[1] : geometry.y + (geometry.height / 2),
                        width: geometry.width,
                        style_class: 'workspace-overlay',
                        reactive: true,
            });
            Main.layoutManager.addChrome(this._wsOverlay);
        } else if (this._wsOverlay) {
            this._wsOverlay.set_text(text);
            if (this._wsOverlay._timeoutId) {
                GLib.source_remove(this._wsOverlay._timeoutId);
                this._wsOverlay._timeoutId = 0;
            }
        }

        if (timeout) {

            this._wsOverlay._timeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                timeout,
                () => {
                    if (this._wsOverlay !== null) {
                        Main.layoutManager.removeChrome(this._wsOverlay);
                        this._wsOverlay.destroy();
                        this._wsOverlay = null;
                    }
                    return GLib.SOURCE_REMOVE;
            });
        }

        return this._wsOverlay;
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
            ).filter((w, i, a) => w !== null && a.indexOf(w) == i);
        // filter out skip_taskbar windows and windows with modals
        // top modal windows should stay
        windows = windows.filter( w => modals.indexOf(w) && !w.is_skip_taskbar());
        if (this.WIN_SKIP_MINIMIZED)
            windows = windows.filter(win => !win.minimized);
    
        if (!windows.length)
            return;
    
        let currentWin  = windows[0];
        // tab list is sorted by MRU order, active window is allways idx 0
        // each window has index in global stable order list (as launched)
        windows.sort((a, b) => {
                return a.get_stable_sequence() - b.get_stable_sequence();
            });
        const currentIdx = windows.indexOf(currentWin);
        let targetIdx = currentIdx + direction;
        if (targetIdx > windows.length - 1)
            targetIdx = this.WIN_WRAPAROUND ? 0 : currentIdx;
        else if (targetIdx < 0)
            targetIdx = this.WIN_WRAPAROUND ? windows.length - 1 : currentIdx;
        windows[targetIdx].activate(global.get_current_time());
    }
    
    adjustVolume(direction) {
        let mixerControl = Volume.getMixerControl();
        let sink = mixerControl.get_default_sink();
        if (direction === 0) {
            sink.change_is_muted(!sink.is_muted);
        } else {
            let volume = sink.volume;
            let max = mixerControl.get_vol_max_norm();
            let step = direction * 2048;
            volume = volume + step;
            if (volume > max)
                volume = max;
            if (volume <   0)
                volume = 0;
            sink.volume = volume;
            sink.push_volume();
        }
    }

    toggleNightLight() {
        let settings = this._getColorSettings();
        settings.set_boolean('night-light-enabled', !settings.get_boolean('night-light-enabled'));
    }

    adjustWindowOpacity(step = 0, toggleValue = 0) {
        let metaWindow = this._getFocusedWindow(true);
        if (!metaWindow)
            return;

        let windowSurface = this._getWindowSurface(metaWindow);
        if (!windowSurface)
            return;

        if (!metaWindow._opacityCE)
            metaWindow._opacityCE = true;

        let value;
        if (toggleValue) {
            value = windowSurface.opacity === 255
                        ? toggleValue
                        : 255;
        } else {
            value = windowSurface.opacity;
            value += step;
            if (value > 255)
                value = 255;
            if (value < 32)
                value = 32;
        }

        windowSurface.opacity = value;
    }

    adjustSwBrightnessContrast(step = 0, window = false, brightness = true, valueO = null) {
        // brightness/contrast range: -1 all black/gray, 0 normal, 1 all white/extreme contrast
        // step with +/- value from range
        let name = brightness ? 'brightness' : 'contrast';
        let brightnessContrast, value;

        const getBCValue = function () {
            return brightness ?
                            brightnessContrast.get_brightness()[0] : // Clutter returns value in [r,g,b] format
                            brightnessContrast.get_contrast()[0];
        };

        const setBCValue = function (val) {
            return brightness ?
                            brightnessContrast.set_brightness(val) :
                            brightnessContrast.set_contrast(val);
        };

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
            value = Math.round((value * 1000) + (step * 1000));
            let max = brightness ? 0 : 300;
            if (value > max) value = max;
            if (value < -750) value = -750;
            value /= 1000;
        } else {
            value = valueO;
            if (valueO === Math.round(getBCValue() * 1000) / 1000)
                value = 0;
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

    toggleColorTintEffect(color, window = true) {
        let name = 'color-tint';
        let effect = Clutter.ColorizeEffect;
        if (window)
            this._toggleWindowEffect(name, effect, ['tint', color]);
        else
            this._toggleGlobalEffect(name, effect, ['tint', color]);
    }

    toggleLightnessInvertEffect(window = true, whiteShift = true) {
        let name = 'inversion';
        this._getShaders();
        let effect;
        whiteShift ? effect = Shaders.InvertLightnessShiftEffect
                   : effect = Shaders.InvertLightnessEffect;
        if (window)
            this._toggleWindowEffect(name, effect);
        else
            this._toggleGlobalEffect(name, effect);
    }
    
    toggleColorsInvertEffect(window = true) {
        let name = 'inversion';
        this._getShaders();
        let effect;
        effect = Shaders.ColorInversionEffect;
        if (window)
            this._toggleWindowEffect(name, effect);
        else
            this._toggleGlobalEffect(name, effect);
    }

    toggleColorBlindShaderEffect(window = true, mode = 0, simulate = false) {
        let name = 'color-blind';
        this._getShaders();
        Shaders.ShaderLib.daltonSimulation = simulate ? 1 : 0;
        let effect;
        if (mode === 1 && !simulate)
            effect = Shaders.ColorMixerProtan;
        if (mode === 2 && !simulate)
            effect = Shaders.ColorMixerDeuter;
        if (mode === 3 && !simulate)
            effect = Shaders.ColorMixerTritan;
        if (mode === 1 && simulate)
            effect = Shaders.ColorMixerProtanSimulation;
        if (mode === 2 && simulate)
            effect = Shaders.ColorMixerDeuterSimulation;
        if (mode === 3 && simulate)
            effect = Shaders.ColorMixerTritanSimulation;
        if (window)
            this._toggleWindowEffect(name, effect);
        else
            this._toggleGlobalEffect(name, effect);
    }

    toggleColorMixerEffect(window = true, mode = 1) {
        let name = 'color-mixer';
        this._getShaders();
        let effect = Shaders.ColorMixerEffect2;
        if (window)
            this._toggleWindowEffect(name, effect);
        else
            this._toggleGlobalEffect(name, effect);
    }

    _toggleGlobalEffect(name, effect, property = []) {
        if (Main.uiGroup.get_effect(name)) {
            Main.uiGroup.remove_effect_by_name(name);
        } else {
            let eff = new effect();
            if (property.length)
                eff[property[0]] = property[1];
            Main.uiGroup.add_effect_with_name(name, eff);
        }
    }

    _toggleWindowEffect(name, effect, property = []) {
        global.get_window_actors().forEach( (actor) => {
            let meta_window = actor.get_meta_window();
            if (meta_window.has_focus()) {
                if (actor.get_effect(name)) {
                    actor.remove_effect_by_name(name);
                }
                else {
                    let eff = new effect();
                    if (property.length)
                       eff[property[0]] = property[1];
                    actor.add_effect_with_name(name, eff);
                }
            }
        });
    }
    
    toggleDimmMonitors(alpha, text, monitorIndex = -1) {
        // reverse order to avoid conflicts after dimmer removed
        let createNew = true;
        if (monitorIndex === -1 && (this._dimmerActors.length === Main.layoutManager.monitors.length)) {
                this._destroyDimmerActors();
                createNew = false;
        }
        for (let i = this._dimmerActors.length - 1; i > -1;  i--) {
    
            if (this._dimmerActors[i].name === `${monitorIndex}`) {
    
                let idx = this._dimmerActors.indexOf(this._dimmerActors[i]);
                if (idx > -1) {
                    this._dimmerActors[i].destroy();
                    this._dimmerActors.splice(idx, 1);
                    createNew = false;
                }
            }
        }
        if (createNew) {
            if (monitorIndex === -1) this._destroyDimmerActors();
            let monitors = [...Main.layoutManager.monitors.keys()];
    
            for (let monitor of monitors) {
    
                if ( (monitorIndex < 0 ? true : monitor === monitorIndex)) {
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
                        reactive: true,
                    });
                    actor.connect('button-press-event', () => this.toggleDimmMonitors(null, null, monitorIndex));
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

            if (!appSettings.get_boolean('screen-magnifier-enabled'))
               magSettings.set_double('mag-factor', 1);
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
        // Main.magnifier.setActive(true); // simple way to activate zoom
    }

    toggleKeyboard(monitorIndex = -1) {
        if (monitorIndex < 0)
            monitorIndex = global.display.get_current_monitor();
        let visible = Main.keyboard.visible;
        let appSettings = this._getA11yAppSettings();
        if (visible)
            appSettings.set_boolean('screen-keyboard-enabled', false);
        else {
            if (!appSettings.get_boolean('screen-keyboard-enabled'))
                appSettings.set_boolean('screen-keyboard-enabled', true);
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

    makeThumbnailWindow(metaWindow = null) {
        if (!WinTmb)
            WinTmb = Me.imports.winTmb;

        let metaWin;
        if (metaWindow) {
            metaWin = metaWindow;
        } else {
            let actor = this._getFocusedActor();
            metaWin = actor ? actor.get_meta_window() : null;
        }

        if (!metaWin)
            return;

        if (!this.tmbConnected) {
            let conS = Main.overview.connect('showing', () => { this.windowThumbnails.forEach((t) => {t.hide();}); });
            let conH = Main.overview.connect('hiding',  () => { this.windowThumbnails.forEach((t) => {t.show();}); });
            this._signalsCollector.push([Main.overview, conS]);
            this._signalsCollector.push([Main.overview, conH]);
            this.tmbConnected = true;
        }

        let monitorHeight = get_current_monitor_geometry().height;
        let scale = this._mscOptions.winThumbnailScale;
        this.windowThumbnails.push(new WinTmb.WindowThumbnail(metaWin, this, {
            'actionTimeout': this._mscOptions.actionEventDelay,
            'height' : Math.floor(scale / 100 * monitorHeight),
            'thumbnailsOnScreen' : this.windowThumbnails.length,
            })
        );
    }

    showAppSwitcherPopup() {
        let appSwitcher = new AltTab.AppSwitcherPopup();
        appSwitcher._resetNoModsTimeout = () => {};
        appSwitcher.show(0,0,0);
    }

    showWindowSwitcherPopup( args = {
        'monitor-index':     -1,
        'position-pointer':   null,
        'filter-mode':       -1,
        'group-mode':         0,
        'timeout':            0,
        'triggered-keyboard': false,
        'shortcut':           '',
        'filter-focused-app': false,
        'filter-pattern':     null,
        'apps':               false,
    }) {
        const WindowSwitcherPopup = AltTab.WindowSwitcherPopup;
        let altTabPopup = new WindowSwitcherPopup();
        const advancedSwitcherEnabled = altTabPopup.showOrig ? true : false;

        if (advancedSwitcherEnabled) {
            // behaviour variables
            altTabPopup.KEYBOARD_TRIGGERED = args['triggered-keyboard'];
            altTabPopup._singleApp         = args['filter-focused-app'] ? Shell.WindowTracker.get_default().get_window_app(this._getFocusedWindow()).get_id() : null;
            if ( args['timeout'])
                altTabPopup.NO_MODS_TIMEOUT  = args['timeout'];
            if ( args['position-pointer'] !== null)
                altTabPopup.POSITION_POINTER = args['position-pointer'];
            if ( args['group-mode']       !== 0)
                altTabPopup.GROUP_MODE       = args['group-mode'];
            if ( args['filter-mode']       > -1)
                altTabPopup.WIN_FILTER_MODE  = args['filter-mode'];
            if ( args['monitor-index']     > -1)
                altTabPopup._monitorIndex    = args['monitor-index'];
            if ( args['filter-pattern']   !== null)
                altTabPopup._searchEntry     = args['filter-pattern'];
            if (!args['triggered-keyboard'])
                altTabPopup._modifierMask    = 0;
            if ( args['apps']) {
                altTabPopup._switcherMode   = 1; //SwitcherModes.APPS;
                altTabPopup.SHOW_APPS       = true;
            }
            altTabPopup.connect('destroy', () => altTabPopup = null);
            altTabPopup._keyBind = args['shortcut'] ? args['shortcut'].replace(/<.+>/, '') : '';
            altTabPopup.show();
        // if Advanced Alt+Tab Window Switcher not available, use default popup
        } else {
            if (args['apps'])
               altTabPopup = new AltTab.AppSwitcherPopup();
            altTabPopup._resetNoModsTimeout = () => {};
            altTabPopup.show(0, 0, 0);
        }
    }

    showCustomMenu(actionTrigger, menuIndex) {
        if (!this._mscOptions[`customMenu${menuIndex}`].length)
            return;
        if (!this.customMenu[menuIndex]) {
            this.customMenu[menuIndex] = new CustomMenuPopup(Main.layoutManager);
            this.customMenu[menuIndex].act.connect('destroy', () => {
                Main.layoutManager.uiGroup.remove_actor(this.customMenu[menuIndex].actor);    
            });
            Main.layoutManager.uiGroup.add_actor(this.customMenu[menuIndex].actor);
        }
        this.customMenu[menuIndex].menuItems      = this._mscOptions[`customMenu${menuIndex}`];
        this.customMenu[menuIndex].actionList     = Settings.actionList;
        this.customMenu[menuIndex].actionTrigger  = actionTrigger;
        this.customMenu[menuIndex].removeAll();
        this.customMenu[menuIndex].buildMenu();

        Main.layoutManager.setDummyCursorGeometry(global.get_pointer()[0], global.get_pointer()[1], 0, 0);

        //Main.osdWindowManager.hideAll();
        let firstItem = this.customMenu[menuIndex]._getMenuItems()[0];
        if (firstItem) {
            this.customMenu[menuIndex].open(BoxPointer.PopupAnimation.FULL);
            this.customMenu[menuIndex]._getMenuItems()[0].active = true;
        }
    }
};

var CustomMenuPopup = class CustomMenuPopup extends PopupMenu.PopupMenu {
    constructor(layoutManager) {
        super(layoutManager.dummyCursor, 0, St.Side.TOP);
        this.menuItems = [];
        this.actionList = [];
        this.actionTrigger = null;
        this.actor.add_style_class_name('background-menu');

        this.act = new Clutter.Actor();
        this.act.reactive = true;
        this.act.menu = this;
        this.act.manager = new PopupMenu.PopupMenuManager(this.act);
        this.act.manager.addMenu(this.act.menu);
        
        // this.actor.connect('hide', this.destroy.bind(this));
    }

    destroy() {
        this.removeAll();
        this.act.destroy();
        this.act.menu = null;
        this.act.manager = null;
        super.destroy();
    }

    buildMenu() {
        let submenu = null;
        for (let i = 0; i < this.actionList.length; i++) {
            let item = this.actionList[i];

            let action  = item[1];
            let section = item[0] === null;

            if (this.menuItems.indexOf(action) < 0) {
                if (section) submenu = null;
                continue;
            }

            let name = item[2];
            let icon = item[4];

            if (item[0] === 0) submenu = null;
            if (section) {
                submenu = new PopupMenu.PopupSubMenuMenuItem(name, true);
                submenu.icon.icon_name = icon;
                this.addMenuItem(submenu);
            } else if (submenu) {
                submenu.menu.addAction(name, () => this.actionTrigger.runAction(action), icon);
            } else {
                this.addAction(name, () => this.actionTrigger.runAction(action), icon);
            }
        }
    }
};
