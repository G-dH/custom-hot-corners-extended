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

const { GLib, Clutter, St, Meta, Shell, Gio } = imports.gi;

const Main                   = imports.ui.main;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const Volume                 = imports.ui.status.volume;
const PopupMenu              = imports.ui.popupMenu;
const BoxPointer             = imports.ui.boxpointer;
const AltTab                 = imports.ui.altTab;
const OsdMonitorLabeler      = imports.ui.osdMonitorLabeler;

const Util                   = imports.misc.util;
const SystemActions          = imports.misc.systemActions;
const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();
const Settings               = Me.imports.src.common.settings;
const shellVersion           = Settings.shellVersion;

// gettext
const _                      = Settings._;

let WindowSwitcherPopup      = null;
let Shaders                  = null;
let WinTmb                   = null;
let _origAltTabWSP           = null;

function get_current_monitor_geometry() {
    return global.display.get_monitor_geometry(global.display.get_current_monitor());
}

var Actions = class {
    constructor(mscOptions) {
        this._signalsCollector      = [];

        this._minimizedWindows      = [];
        this._dimmerActors          = [];

        this._a11yAppsSettings      = null;
        this._a11yMagnifierSettings = null;
        this._interfaceSettings     = null;
        this._shellSettings         = null;
        this._soundSettings         = null;

        this.keyboardTimeoutId      = 0;

        this.WS_IGNORE_LAST         = false;
        this.WS_WRAPAROUND          = false;

        this.WIN_WRAPAROUND         = false;
        this.WIN_SKIP_MINIMIZED     = false;
        this.WIN_STABLE_SEQUENCE    = false;

        this.windowThumbnails       = [];
        this._tmbConnected          = false;

        this._mainPanelVisible      = Main.panel.is_visible();

        this.customMenu             = [];
        this._winPreview            = null

        this._mscOptions = mscOptions;
    }

    clean(full = true) {
        // don't reset effects and destroy thumbnails if extension is enabled (GS calls ext. disable() before locking the screen f.e.)
        if (full) {
            this._mainPanelVisible
                ? Main.panel.show()
                : Main.panel.hide();
            this.removeAllEffects();
            this._resetSettings();

            for (let sig of this._signalsCollector) {
                if (sig[1])
                    sig[0].disconnect(sig[1]);
            }

            this.Shaders   = null;
        }

        if (this._osdMonitorsConnection) {
            global.display.disconnect(this._osdMonitorsConnection);
            this._osdMonitorsConnection = 0;
        }
        this._removeThumbnails(full);
        this._destroyDimmerActors();
        this._removeCustomMenus();
        this._destroyWindowPreview();
        this._removeOsdMonitorIndexes();

        if (this.keyboardTimeoutId) {
            GLib.source_remove(this.keyboardTimeoutId);
            this.keyboardTimeoutId = 0;
        }
        if (this._winSwitcherTimeoutId) {
            GLib.source_remove(this._winSwitcherTimeoutId);
            this._winSwitcherTimeoutId = 0;
        }
        if (this._setBCTimeoutId) {
            GLib.source_remove(this._setBCTimeoutId);
            this._setBCTimeoutId = 0;
        }

        if (this._osdMonitorsTimeoutId) {
            GLib.source_remove(this._osdMonitorsTimeoutId);
            this._osdMonitorsTimeoutId
        }
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

    _removeOsdMonitorIndexes(keepConnection = false) {
        if (this._osdMonitorLabels) {
            this._osdMonitorLabels.forEach((w) => {
                w.destroy();
            });
            this._osdMonitorLabels = null;
        }
        if (this._osdMonitorsConnection && !keepConnection) {
            global.display.disconnect(this._osdMonitorsConnection);
            this._osdMonitorsConnection = 0;
        }
    }

    _resetSettings() {
        this._a11yAppsSettings      = null;
        this._a11yMagnifierSettings = null;
        this._interfaceSettings     = null;
        this._shellSettings         = null;
        this._colorSettings         = null;
        this._wsNamesSettings       = null;
        this._soundSettings         = null;
        this._mutterSettings        = null;
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

    _getShellSettings() {
        if (!this._shellSettings) {
            this._shellSettings = ExtensionUtils.getSettings(
                            'org.gnome.shell'
            );
        }
        return this._shellSettings;
    }

    _getMutterSettings() {
        if (!this._mutterSettings) {
            this._mutterSettings = ExtensionUtils.getSettings(
                            'org.gnome.mutter'
            )
        }
        return this._mutterSettings;
    }

    _getA11yAppSettings() {
        if (!this._a11yAppsSettings) {
            this._a11yAppsSettings = ExtensionUtils.getSettings(
                            'org.gnome.desktop.a11y.applications'
            );
        }
        return this._a11yAppsSettings;
    }

    _getA11yMagnifierSettings() {
        if (!this._a11yMagnifierSettings) {
            this._a11yMagnifierSettings = ExtensionUtils.getSettings(
                            'org.gnome.desktop.a11y.magnifier'
            );
        }
        return this._a11yMagnifierSettings;
    }

    _getInterfaceSettings() {
        if (!this._interfaceSettings) {
            this._interfaceSettings = ExtensionUtils.getSettings(
                            'org.gnome.desktop.interface'
            );
        }
        return this._interfaceSettings;
    }

    _getColorSettings() {
        if (!this._colorSettings) {
            this._colorSettings = ExtensionUtils.getSettings(
                            'org.gnome.settings-daemon.plugins.color'
            );
        }
        return this._colorSettings;
    }

    _getWsNamesSettings() {
        if (!this._wsNamesSettings) {
            this._wsNamesSettings = ExtensionUtils.getSettings(
                            'org.gnome.desktop.wm.preferences'
            );
        }
        return this._wsNamesSettings;
    }

    _getSoundSettings() {
        if (!this._soundSettings) {
            this._soundSettings = ExtensionUtils.getSettings(
                            'org.gnome.desktop.sound'
            );
        }
        return this._soundSettings;
    }

    _getDisplayBrightnessProxy() {
        if (!this._dispalyBrightnessProxy) {
            const { loadInterfaceXML } = imports.misc.fileUtils;
            const BUS_NAME = 'org.gnome.SettingsDaemon.Power';
            const OBJECT_PATH = '/org/gnome/SettingsDaemon/Power';

            const BrightnessInterface = loadInterfaceXML('org.gnome.SettingsDaemon.Power.Screen');
            const BrightnessProxy = Gio.DBusProxy.makeProxyWrapper(BrightnessInterface);
            this._dispalyBrightnessProxy = new BrightnessProxy(Gio.DBus.session, BUS_NAME, OBJECT_PATH,
                (proxy, error) => {
                    if (error) {
                        log(error.message);
                        return;
                    }
                }
            );
        }
        return this._dispalyBrightnessProxy;
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

    _getWindowApp(metaWindow) {
        if (!metaWindow) return null;
        let tracker = Shell.WindowTracker.get_default();
        return tracker.get_window_app(metaWindow);
    }

    _getWindowsOfFocusedAppOnActiveWs() {
        let win = this._getFocusedWindow();
        let app = this._getWindowApp(win);
        let ws = global.workspaceManager.get_active_workspace();
        let wsWidows = ws.list_windows();
        let result = [];
        wsWidows.forEach(w => {
           if (this._getWindowApp(w).get_id() === app.get_id())
                result.push(w);
        });
        return result;
    }

    _getWindowSurface(metaWindow) {
        let windowActor = metaWindow.get_compositor_private();
        for (let child of windowActor.get_children()) {
            if (child.constructor.name.includes('MetaSurfaceActor'))
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

    _getMonitorByIndex(monitorIndex) {
        let monitors = Main.layoutManager.monitors;
        for (let monitor of monitors) {
            if (monitor.index === monitorIndex)
                return monitor;
        }
        return -1;
    }

    _getShaders() {
        if (!Shaders)
            Shaders = Me.imports.src.extension.shaders;
    }

    _isWsOrientationHorizontal() {
        if (global.workspace_manager.layout_rows == -1)
			return false;
        return true;
    }

    _translateDirectionIfNeeded(direction) {
        if (this._isWsOrientationHorizontal()) {
            if (direction == Meta.MotionDirection.UP) {
                direction = Meta.MotionDirection.LEFT;
            } else {
                direction = Meta.MotionDirection.RIGHT;
            }
        }
        return direction;
    }

    _showMonitorIndexesOsd() {
        this._removeOsdMonitorIndexes();
        const success = this._buildMonitorIndexesOsd();
        if (!success) return;

        this._osdMonitorsConnection = global.display.connect('notify::focus-window', () =>{
            // destroy osd when the preferences window lost focus
            if (global.display.focus_window && !global.display.focus_window.get_title().includes(Me.metadata.name)) {
                this._removeOsdMonitorIndexes(true); // remove labeles, keep this connection
                //this._mscOptions.set('showOsdMonitorIndexes', false);
            } else {
                this._removeOsdMonitorIndexes(true);
                this._buildMonitorIndexesOsd();
            }
            // disconnect this signal if prefs window was closed
            if (!this._getOpenPrefsWindow().isCHCE) {
                if (this._osdMonitorsConnection) {
                    global.display.disconnect(this._osdMonitorsConnection);
                    this._osdMonitorsConnection = 0;
                }
                this._mscOptions.set('showOsdMonitorIndexes', false);
                this._removeOsdMonitorIndexes();
            }
        });
    }

    _buildMonitorIndexesOsd() {
        this._osdMonitorLabels = [];
        const nMonitors = Main.layoutManager.monitors.length;

        if (nMonitors === 1) {
            this._mscOptions.set('showOsdMonitorIndexes', false);
            return false;
        }

        const primaryIndex = Main.layoutManager.primaryIndex;
        let monIndexes = [...Main.layoutManager.monitors.keys()];
        // index of the primary monitor to the first possition
        // Monitor 1 in preferences will allways refer to the primary monitor
        monIndexes.splice(0, 0, monIndexes.splice(primaryIndex, 1)[0]);

        for (let i = 0; i < nMonitors; ++i) {
            const label = new OsdMonitorLabeler.OsdMonitorLabel(monIndexes[i], `${i + 1}`);
            this._osdMonitorLabels.push(label);
        }
        return true;
    }

    _getOpenPrefsWindow() {
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (let win of windows) {
            if (win.get_title().includes(Me.metadata.name) && this._getWindowApp(win).get_name() === 'Extensions') {
                return { metaWin: win, isCHCE: true };
            } else if (win.wm_class.includes('org.gnome.Shell.Extensions')) {
                return { metaWin: win, isCHCE: false };
            }
        }
        return { metaWin: null, isCHCE: null };
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
            if (shellVersion < 40)
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
        if (command.match(/\.desktop$/)) {
            const appId = command;
            const appSystem = Shell.AppSystem.get_default();
            const app = appSystem.lookup_app(appId);
            if (app) {
                app.activate();
            } else {
                Main.notify(Me.metadata.name, _(`Application ID not found: ${appId}`));
                log(Me.metadata.name, _(`Application ID not found: ${appId}`));
            }
            return;
        }

        Util.spawnCommandLine(command);
    }

    moveToWorkspace(index) {
        if (index < 0)
            return;
        const maxIndex = global.workspaceManager.n_workspaces - 1;
        if (maxIndex < index)
        index = maxIndex;
        const ws = global.workspaceManager.get_workspace_by_index(index);

        const direction = global.workspaceManager.get_active_workspace_index() > index
                    ? Meta.MotionDirection.UP
                    : Meta.MotionDirection.Down;

        Main.wm.actionMoveWorkspace(ws);

        this._showWsSwitcherPopup(direction, index);
        // another option
        // ws.activate(global.get_current_time());
    }

    moveToRecentWorkspace() {
        // find the first window in the AltTab list (sorted by the most recently used) with different workspace and switch to it
        const tabList = AltTab.getWindows(null);
        const currentWs = global.workspaceManager.get_active_workspace();
        for (let win of tabList) {
            const ws = win.get_workspace();
            if (ws !== currentWs) {
                this.moveToWorkspace(ws.index());
                return;
            }
        }
    }

    reorderWorkspace(direction = 0) {
        //if (!Main.overview.visible)
        //    return;
        let activeWs = global.workspace_manager.get_active_workspace();
        let activeWsIdx = activeWs.index();
        let targetIdx = activeWsIdx + direction;
        if (targetIdx > -1 && targetIdx < (global.workspace_manager.get_n_workspaces())) {
            global.workspace_manager.reorder_workspace(activeWs, targetIdx);
        }
        //this.showWorkspaceIndex();
        direction = direction > 0 ? Meta.MotionDirection.DOWN : Meta.MotionDirection.UP;
        this._showWsSwitcherPopup(direction, targetIdx);
    }

    rotateWorkspaces(direction = 0, monitorIndex = -1, step = 1) {
        step = direction === Meta.MotionDirection.UP ? +step : -step;
        const monitor = monitorIndex > -1 ? monitorIndex : global.display.get_current_monitor();
        const dynamicWs = this._getMutterSettings().get_boolean('dynamic-workspaces');
        const lastIndex = global.workspaceManager.get_n_workspaces() - (dynamicWs ? 1 : 0);
        //let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        let windows = AltTab.getWindows(null);
        for (let win of windows.reverse()) {
            // avoid moving modal windows as they move their parents (and vice versa) immediately, before we move the parent window.
            if (win.get_monitor() === monitor && !win.is_always_on_all_workspaces() && !win.is_attached_dialog() && !win.get_transient_for()) {
                let wWs = win.get_workspace().index();
                wWs += step;
                if (wWs < 0) wWs = (lastIndex - 1);
                if (wWs > lastIndex - 1) wWs = 0;
                const ws = global.workspaceManager.get_workspace_by_index(wWs);
                win.change_workspace(ws);
            }
        }
    }

    switchWorkspaceCurrentMonitor(direction) {
        //const focusedWindow = global.display.get_focus_window();
        //const currentMonitor = focusedWindow ? focusedWindow.get_monitor() : global.display.get_current_monitor();
        // using focused window to determine current monitor can lead to inconsistent behavior and switching monitors between switches
        // depending on which window takes focus on each workspace
        // mouse pointer is more stable source in this case
        const currentMonitor = global.display.get_current_monitor();
        const primaryMonitor = currentMonitor === Main.layoutManager.primaryIndex;
        const nMonitors = Main.layoutManager.monitors.length;
        const lastIndex = global.workspaceManager.get_n_workspaces() - 1;
        const activeWs = global.workspaceManager.get_active_workspace();
        const neighbor = activeWs.get_neighbor(this._translateDirectionIfNeeded(direction));

        if (!primaryMonitor) {
            this.rotateWorkspaces(direction, currentMonitor);
            return;
        }

        // for case that workspace switcher is in wraparound mode
        let diff = neighbor.index() - activeWs.index();
        let step = 1;
        if (!(Math.abs(diff) !== 1 && diff !== 0)) {
            step = Math.abs(diff);
        }

        if (neighbor !== activeWs && (neighbor.index() !== lastIndex || activeWs !== lastIndex)) {
            for (let i = 0; i < nMonitors; i++) {
                if (i !== currentMonitor) {
                    const opositeDirection = direction === Meta.MotionDirection.UP ? Meta.MotionDirection.DOWN : Meta.MotionDirection.UP;
                    this.rotateWorkspaces(opositeDirection, i, step);
                }
            }
        }
        this.switchWorkspace(direction);
    }

    closeWorkspace() {
        const activeWs = global.workspace_manager.get_active_workspace();
        const windows = AltTab.getWindows(activeWs);
        for (let i = 0; i < windows.length; i++) {
            if (!windows[i].is_on_all_workspaces()) {
                windows[i].delete(global.get_current_time()+i);
            }
        }
        const vertical = global.workspaceManager.layout_rows === -1;
        const direction = vertical ? Meta.MotionDirection.DOWN : Meta.MotionDirection.RIGHT;
        this.switchWorkspace(direction, true);
    }

    setDisplayBrightness(direction) {
        const proxy = this._getDisplayBrightnessProxy();
        let value = proxy.Brightness;
        if (value === null)
            return;
        const STEP = 5;
        if (direction === Meta.MotionDirection.UP) {
            value += STEP;
        } else {
            value -= STEP;
        }

        if (value > 100)
            value = 100;
        if (value < 0)
            value = 0;

        proxy.Brightness = value;
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

    screensaver() {
        let session = Gio.DBus.session;
        session.call(
            'org.gnome.Shell.ScreenShield',
            '/org/gnome/ScreenSaver',
            'org.gnome.ScreenSaver',
            'SetActive',
            new GLib.Variant('(b)', [GLib.Variant.new_boolean(true)]),
            null, Gio.DBusCallFlags.NONE,-1,null,
         );
    }

    showScreenshotUi() {
        if (shellVersion >= 42)
            imports.ui.screenshot.showScreenshotUI();
    }

    toggleLookingGlass() {
        if (Main.lookingGlass === null)
            Main.createLookingGlass();
        if (Main.lookingGlass !== null)
            Main.lookingGlass.toggle();
    }

    activateUiInspector() {
        if (Main.lookingGlass === null)
            Main.createLookingGlass();
        const lg = Main.lookingGlass;
        lg.open();
        const Inspector = imports.ui.lookingGlass.Inspector;
        lg.openInspector = () => {
            let inspector = new Inspector(lg);
            inspector.connect('target', (i, target, stageX, stageY) => {
                lg._pushResult(`inspect(${Math.round(stageX)}, ${Math.round(stageY)})`, target);
            });
            inspector.connect('closed', () => {
                lg.show();
                global.stage.set_key_focus(lg._entry);
            });
            lg.hide();
            return Clutter.EVENT_STOP;
        }

        lg.openInspector();
    }

    switchToRecentWindow() {
        AltTab.getWindows(null)[1].activate(global.get_current_time());
        //global.display.get_tab_list(0, null)[1].activate(global.get_current_time());
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

    openNewWindow() {
        let win = this._getFocusedWindow();
        if (!win)
            return;
        let app = Shell.WindowTracker.get_default().get_window_app(win);
        app.open_new_window(global.get_current_time());
    }

    fullscreenWinOnEmptyWs(metaWindow = null) {
        let win;
        if (!metaWindow)
            win = this._getFocusedWindow(true);
        else
            win = metaWindow;
        if (!win)
            return;

        // if property fullscreen === true, win was already maximized on new ws
        if (win.fullscreen) {
            win.unmake_fullscreen();
            if (win._originalWS) {
                for(let i = 0; i < global.workspaceManager.n_workspaces; i++) {
                    let w = global.workspaceManager.get_workspace_by_index(i);
                    if (w === win._originalWS) {
                        win.change_workspace(win._originalWS);
                        Main.wm.actionMoveWorkspace(win._originalWS);
                        break;
                    }
                }
                this._showWsSwitcherPopup(0, win._originalWS.index());
                win._originalWS = null;
            }
        } else {
            let ws = win.get_workspace();
            let nWindows = ws.list_windows().filter(
                w =>
                    //w.get_window_type() === Meta.WindowType.NORMAL &&
                    !w.is_on_all_workspaces()
                ).length;
            if (nWindows > 1) {
                win._originalWS = ws;
                let newWsIndex = ws.index() + 1;
                Main.wm.insertWorkspace(newWsIndex);
                let newWs = global.workspace_manager.get_workspace_by_index(newWsIndex);
                //win.change_workspace(newWs);
                this.moveWinToAdjacentWs(1, [win]);
                win.make_fullscreen();
                win.activate(global.get_current_time());
            }
        }
    }

    moveWinToNewWs(direction, windows = null) {
        let selected
        if (!windows)
            selected = [this._getFocusedWindow(true)];
        else
            selected = windows;
        if (!selected)
            return;

        let wsIndex = global.workspace_manager.get_active_workspace_index();
            wsIndex = wsIndex + (direction === Meta.MotionDirection.UP ? 0 : 1);
            Main.wm.insertWorkspace(wsIndex);
            this.moveWinToAdjacentWs(direction, selected);
    }

    moveWinToAdjacentWs(direction, windows = null) {
        let selected = [];
        if (!windows) {
            const focused = this._getFocusedWindow(true);
            if (focused)
                selected.push(focused);
        } else if (windows && windows.length) {
            selected = windows;
        }

        if (!selected.length)
            return;

        let wsIndex = global.workspace_manager.get_active_workspace_index();
        wsIndex = wsIndex + (direction === Meta.MotionDirection.UP ? -1 : 1);
        wsIndex = Math.min(wsIndex, global.workspace_manager.get_n_workspaces() - 1);
        if (wsIndex < 0) {
            this.moveWinToNewWs(direction, selected);
            return;
        }

        let ws = global.workspace_manager.get_workspace_by_index(wsIndex);
        if (selected.length > 1) {
            this._moveWindowsToWS(selected, ws);
            this.switchWorkspace(direction, true);
        } else {
            Main.wm.actionMoveWindow(selected[0], ws);
        }
        Main.wm.actionMoveWorkspace(ws);

        this._showWsSwitcherPopup(direction, wsIndex);
    }

    _moveWindowsToWS(windows, workspace) {
        let winList = windows;
        winList.forEach(win => {
            this._moveWindowToWs(win, workspace);
        });
    }

    _moveWindowToWs(metaWindow, workspace = null, monitorIndex = -1) {
        let ws = workspace ? workspace : global.workspace_manager.get_active_workspace();
        let win = metaWindow;
        win.change_workspace(ws);
        let targetMonitorIndex = monitorIndex > -1 ? monitorIndex : global.display.get_current_monitor();
        let currentMonitorIndex = win.get_monitor();
        if (currentMonitorIndex !== targetMonitorIndex) {
            // move window to target monitor
            let actor = win.get_compositor_private();
            let targetMonitor  = this._getMonitorByIndex(targetMonitorIndex);

            let x = targetMonitor.x + Math.max(Math.floor(targetMonitor.width - actor.width) / 2, 0);
            let y = targetMonitor.y + Math.max(Math.floor(targetMonitor.height - actor.height) / 2, 0);
            win.move_frame(true, x, y);
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
        } else {
            win.stick();
            //Main.notify(Me.metadata.name, _(`Enabled: Always on Visible Workspace \n\n${win.title}` ));
        }
    }

    restartGnomeShell() {
        if (!Meta.is_wayland_compositor())
            Meta.restart(_('Restarting Gnome Shell...'));
        else
            Main.notify(Me.metadata.name, _('Gnome Shell - Restart is not available in Wayland session' ));
    }

    toggleShowPanel() {
        if (Main.panel.is_visible()) {
            Main.panel.hide()
        }
        else {
            Main.panel.show();
        }
    }

    openPanelAggregateMenu() {
        Main.panel.statusArea.aggregateMenu.menu.toggle();
    }

    openPanelDateMenu() {
        Main.panel.statusArea.dateMenu.menu.toggle();
    }

    openPanelAppMenu() {
        Main.panel.statusArea.appMenu.menu.toggle();
    }

    toggleTheme() {
        const intSettings = this._getInterfaceSettings();
        const theme = intSettings.get_string('gtk-theme');
        const themeSplit = theme.split('-');
        let yaruAccent = '';
        if (themeSplit[0] == 'Yaru' && themeSplit.length > 1) {
            yaruAccent = themeSplit[1];
            if (['light', 'dark'].includes(yaruAccent)) {
                // this means default accent active
                yaruAccent = '';
            }
        }
        let newTheme;
        let dark;

        switch (theme) {
            case `Yaru-${yaruAccent}`:
                newTheme = `Yaru-${yaruAccent}`;
                dark = true;
                break;
            case `Yaru-${yaruAccent}-dark`:
                newTheme = `Yaru-${yaruAccent}`;
                dark = false;
                break;
            case 'Yaru-light':
            case 'Yaru':
                newTheme = 'Yaru';
                dark = true;
                break;
            case 'Yaru-dark':
                newTheme = shellVersion >= 40 ? 'Yaru' : 'Yaru-light'
                dark = false;
                break;
            case 'Adwaita':
                newTheme = 'Adwaita';
                dark = true;
                break;
            case 'Adwaita-dark':
                newTheme = 'Adwaita';
                dark = false;
                break;
            default:
                Main.notify(Me.metadata.name, _('Theme switcher works with Adwaita/Adwaita-dark and Yaru(-light)/Yaru-dark themes only'));
        }

        if (shellVersion >= 42) {
            dark = !(intSettings.get_string('color-scheme') === 'prefer-dark');
            if (dark) {
                intSettings.set_string('color-scheme', 'prefer-dark');
            } else {
                intSettings.set_string('color-scheme', 'prefer-light');
            }
        }

        if (newTheme) {
            const shellThemeSettings = this._getShellThemeSettings('org.gnome.shell.extensions.user-theme');//, '/org/gnome/shell/extensions/user-theme/');
            if (dark) {
                intSettings.set_string('gtk-theme', `${newTheme}-dark`);
                if (shellThemeSettings) {
                    shellThemeSettings.set_string('name', `${newTheme}-dark`);
                }
            } else {
                intSettings.set_string('gtk-theme', newTheme);
                if (shellThemeSettings) {
                    shellThemeSettings.set_string('name', newTheme);
                }
            }
        }

    }

    // user Shell themes are supported via 'User Themes' extension which must be installed
    _getShellThemeSettings(schema, path) {
        const schemaDir = Me.dir.get_parent().get_child('user-theme@gnome-shell-extensions.gcampax.github.com/schemas');
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
            //throw new Error(
            log(
                'Schema ' + schema + ' could not be found for extension. Please check your installation.'
            );
            return null;
        }

        const args = {settings_schema: schemaObj};
        if (path) {
            args.path = path;
        }

        return new Gio.Settings(args);
    };

    openRunDialog() {
        Main.openRunDialog();
    }

    openPreferences() {
        // if prefs window already exist, move it to the current WS and activate it
        const { metaWin, isCHCE } = this._getOpenPrefsWindow();
        if (metaWin) {
            if (!isCHCE) {
                metaWin.delete(global.get_current_time());
            } else {
                this._moveWindowToWs(metaWin);
                metaWin.activate(global.get_current_time());
                return;
            }
        }

        try {
            Main.extensionManager.openExtensionPrefs(Me.metadata.uuid, '', {});
        } catch (e) {
            log(e);
        }
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

    // direction: Meta.MotionDirection
    switchWorkspace(direction, showPopup = true) {
        direction = this._translateDirectionIfNeeded(direction);
        const targetWs = global.workspaceManager.get_active_workspace().get_neighbor(direction);
        Main.wm.actionMoveWorkspace(targetWs);
        if (showPopup)
            this._showWsSwitcherPopup(direction, targetWs.index());
        /*
            let n_workspaces = global.workspaceManager.n_workspaces;
            let lastWsIndex =  n_workspaces - (this.WS_IGNORE_LAST ? 2 : 1);

            let activeWs  = global.workspaceManager.get_active_workspace();
            let activeIdx = activeWs.index();
            let targetIdx = this.WS_WRAPAROUND ?
                            (activeIdx + (direction ? 1 : lastWsIndex )) % (lastWsIndex + 1) :
                            activeIdx + (direction ? 1 : -1);
            if (targetIdx < 0 || targetIdx > lastWsIndex) {
                targetIdx = activeIdx;
            }
            let ws = global.workspaceManager.get_workspace_by_index(targetIdx);

            Main.wm.actionMoveWorkspace(ws);

            // show default workspace indicator popup
            if (this.WS_INDICATOR_MODE === ws_indicator_mode.DEFAULT) {
                this._showWsSwitcherPopup(direction, ws.index());
            } else if (this.WS_INDICATOR_MODE > ws_indicator_mode.DEFAULT)
        */
    }

    _showWsSwitcherPopup(direction, wsIndex) {
        if (!Main.overview.visible) {
            if (Main.wm._workspaceSwitcherPopup == null) {
                Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
                Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
                    Main.wm._workspaceSwitcherPopup = null;
                });
            }

            let motion = this._translateDirectionIfNeeded(direction);

            if (shellVersion >= 42) {
                Main.wm._workspaceSwitcherPopup.display(wsIndex);
            } else {
                Main.wm._workspaceSwitcherPopup.display(motion, wsIndex);
            }
        }
    }

    switchWindow(direction, wsOnly = false, monitorIndex = -1) {
        let workspaceManager = global.workspace_manager;

        const workspace = null;
        let windows = AltTab.getWindows(workspace);
        if (monitorIndex > -1)
            windows = windows.filter(w => w.get_monitor() === monitorIndex);

        if (wsOnly) {
            const workspace = workspaceManager.get_active_workspace();
            windows = windows.filter(w => w.get_workspace() === workspace);
        }

        if (this.WIN_SKIP_MINIMIZED)
            windows = windows.filter(win => !win.minimized);

        if (!windows.length) return;

        // if window selection is in the process, the previewd window must be the current one
        let currentWin  = this._winPreview ? this._winPreview._window : windows[0];
        if (this.WIN_STABLE_SEQUENCE) {
            // tab list is sorted by MRU order, active window is allways idx 0
            // each window has index in global stable order list (as launched)
            windows.sort((a, b) => {
                    return a.get_stable_sequence() - b.get_stable_sequence();
                }).reverse(); // reverse the list to get the same sequence direction as MRU list has
        }
        const currentIdx = windows.indexOf(currentWin);
        let targetIdx = currentIdx + ( - direction); // reverse the direction to follow MRU ordered list

        if (targetIdx > windows.length - 1) {
            targetIdx = this.WIN_WRAPAROUND ? 0 : currentIdx;
        } else if (targetIdx < 0) {
            targetIdx = this.WIN_WRAPAROUND ? windows.length - 1 : currentIdx;
        }

        this._showWindowPreview(windows[targetIdx]);
        if (this._winSwitcherTimeoutId) {
            GLib.source_remove(this._winSwitcherTimeoutId);
            this._winSwitcherTimeoutId = 0;
        }
        this._winSwitcherTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            300,
            () => {
                // if the mouse pointer is still over the edge of the current monitor, we assume that the user has not yet finished the selection
                if (this._winPreview && !this._isPointerOnEdge()) {
                    const metaWin = this._winPreview._window;
                    const switchWS = metaWin.get_workspace() !== global.workspace_manager.get_active_workspace();
                    if (switchWS)
                        this.moveToWorkspace(this._winPreview._window.get_workspace().index());
                    this._winPreview._window.activate(global.get_current_time());
                    this._destroyWindowPreview();
                    this._winSwitcherTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    // returns true if the mouse pointer is at the edge of the current monitor and not further than 100px on the other axis
    _isPointerOnEdge() {
        let [x, y] = global.get_pointer();
        const geometry = global.display.get_monitor_geometry(global.display.get_current_monitor());
        if ([geometry.x, geometry.x + geometry.width -1].includes(x) && Math.abs(this._winPreview._yPointer - y) < 100)
            return true;
        if ([geometry.y, geometry.y + geometry.height - 1].includes(y) && Math.abs(this._winPreview._xPointer - x) < 100)
            return true;

        return false;
    }

    _showWindowPreview(metaWin) {
        if (!metaWin) return;

        /*if (this._winPreview) {
            this._destroyWindowPreview();
        }*/

        if (!this._winPreview) {
            this._winPreview = new AltTab.CyclerHighlight();
            global.window_group.add_actor(this._winPreview);
            [this._winPreview._xPointer, this._winPreview._yPointer] = global.get_pointer();
        }

        this._winPreview.window = metaWin;
        this._winPreview._window = metaWin;
        global.window_group.set_child_above_sibling(this._winPreview, null);
    }

    _destroyWindowPreview() {
        if (this._winPreview) {
            this._winPreview.destroy();
            this._winPreview = null;
        }
    }

    //direction +1 / -1, 0 for toggle mute
    adjustVolume(direction) {
        let mixerControl = Volume.getMixerControl();
        let sink = mixerControl.get_default_sink();

        if (!sink) return;

        const soundSettings = this._getSoundSettings();
        const alowOverAmplification = soundSettings.get_boolean('allow-volume-above-100-percent');

        if (direction === 0) {
            sink.change_is_muted(!sink.is_muted);
            return;
        }

        let volume = sink.volume;
        const maxLevelNorm = mixerControl.get_vol_max_norm();
        const maxLevel = alowOverAmplification ? mixerControl.get_vol_max_amplified() : maxLevelNorm;
        const ampScale = maxLevel / maxLevelNorm;

        const step = direction * 2048;

        volume = volume + step;
        if (volume > maxLevel)
            volume = maxLevel;
        if (volume < 0)
            volume = 0;

        sink.volume = volume;
        sink.push_volume();

        // OSD
        let icons = ["audio-volume-muted-symbolic",
                     "audio-volume-low-symbolic",
                     "audio-volume-medium-symbolic",
                     "audio-volume-high-symbolic",
                     "audio-volume-overamplified-symbolic"];

                     let n;
        if (sink.is_muted || volume <= 0) {
            n = 0;
        } else {
            n = Math.ceil(3 * volume / maxLevelNorm);
            if (n < 1)
                n = 1;
            else if (n > 3)
                n = 4;
        }

        const gicon = new Gio.ThemedIcon({ name: icons[n] });
        const level = volume / maxLevel * ampScale;
        Main.osdWindowManager.show(-1, gicon, null, level, ampScale);
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
            return brightness
                            ? brightnessContrast.get_brightness()[0] // Clutter returns value in [r,g,b] format
                            : brightnessContrast.get_contrast()[0];
        };

        const setBCValue = function (val) {
            return brightness
                            ? brightnessContrast.set_brightness(val)
                            : brightnessContrast.set_contrast(val);
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
            brightness
                ? brightnessContrast.set_brightness(-0.3)
                : brightnessContrast.set_contrast(-0.1);
            this._setBCTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                100,
                () => {
                    setBCValue(value);
                    this._setBCTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
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
        if (!color) {
            const [success, col] = Clutter.Color.from_string(this._mscOptions.get('customTintColor'));
            if (!success) return;
            else color = col;
        }
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
                } else {
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
        // timeout added because of activation from menu, keyboard doesn't show up if menu is up
        this.keyboardTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            200,
            () => {
                if (monitorIndex < 0)
                    monitorIndex = global.display.get_current_monitor();
                let visible = Main.keyboard.visible;
                let appSettings = this._getA11yAppSettings();
                if (visible)
                    appSettings.set_boolean('screen-keyboard-enabled', false);
                else {
                    if (!appSettings.get_boolean('screen-keyboard-enabled'))
                        appSettings.set_boolean('screen-keyboard-enabled', true);
                    // open the keyboard even if incompatible input is currently in focus
                    Main.keyboard.open(monitorIndex);
                }

                this.keyboardTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
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
            WinTmb = Me.imports.src.extension.winTmb;

        let metaWin;
        if (metaWindow) {
            metaWin = metaWindow;
        } else {
            let actor = this._getFocusedActor();
            metaWin = actor ? actor.get_meta_window() : null;
        }

        if (!metaWin)
            return;

        if (!this._tmbConnected) {
            let conS = Main.overview.connect('showing', () => { this.windowThumbnails.forEach((t) => {t.hide();}); });
            let conH = Main.overview.connect('hiding',  () => { this.windowThumbnails.forEach((t) => {t.show();}); });
            this._signalsCollector.push([Main.overview, conS]);
            this._signalsCollector.push([Main.overview, conH]);
            this._tmbConnected = true;
        }

        let monitorHeight = get_current_monitor_geometry().height;
        let scale = this._mscOptions.get('winThumbnailScale');
        this.windowThumbnails.push(new WinTmb.WindowThumbnail(metaWin, this, {
            'actionTimeout': this._mscOptions.get('actionEventDelay'),
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
        'switch-ws':          false,
    }) {
        const WindowSwitcherPopup = AltTab.WindowSwitcherPopup;
        let altTabPopup = new WindowSwitcherPopup();
        const advancedSwitcherEnabled = altTabPopup.showOrig ? true : false;

        if (advancedSwitcherEnabled) {
            // behavior variables
            altTabPopup.KEYBOARD_TRIGGERED = args['triggered-keyboard'];
            altTabPopup._keyBind = args['shortcut']; // shortcut without modifiers
            altTabPopup._singleApp         = args['filter-focused-app']
                                                    ? Shell.WindowTracker.get_default().get_window_app(this._getFocusedWindow()).get_id()
                                                    : null;
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
            altTabPopup.show();
            if ( args['switch-ws'] !== undefined && args['switch-ws'] !== false) {
                altTabPopup._switchWorkspace(args['switch-ws']);
            }
        // if Advanced Alt+Tab Window Switcher not available, use default popup
        } else {
            if (args['apps'])
               altTabPopup = new AltTab.AppSwitcherPopup();
            altTabPopup._resetNoModsTimeout = () => {};
            altTabPopup.show(0, 0, 0);
        }
    }

    showCustomMenu(actionTrigger, menuIndex) {
        if (!this._mscOptions.get(`customMenu${menuIndex}`).length)
            return;
        if (!this.customMenu[menuIndex]) {
            this.customMenu[menuIndex] = new CustomMenuPopup(Main.layoutManager);
            this.customMenu[menuIndex].act.connect('destroy', () => {
                Main.layoutManager.uiGroup.remove_actor(this.customMenu[menuIndex].actor);
            });
            Main.layoutManager.uiGroup.add_actor(this.customMenu[menuIndex].actor);
        }
        this.customMenu[menuIndex].menuItems      = this._mscOptions.get(`customMenu${menuIndex}`);
        this.customMenu[menuIndex].actionList     = Settings.actionList;
        let focusedWin = this._getFocusedWindow() ? this._getFocusedWindow().get_title() : null
        if (focusedWin && focusedWin.length > 40)
            focusedWin = `${focusedWin.substring(0, 40)}...`;
        this.customMenu[menuIndex].focusedWindow  = focusedWin;
        this.customMenu[menuIndex].actionTrigger  = actionTrigger;
        this.customMenu[menuIndex].removeAll();
        this.customMenu[menuIndex].buildMenu();

        Main.layoutManager.setDummyCursorGeometry(global.get_pointer()[0], global.get_pointer()[1], 0, 0);

        //Main.osdWindowManager.hideAll();
        const focusedWinItem = this.customMenu[menuIndex].windowNeeded;
        const firstItem = this.customMenu[menuIndex]._getMenuItems()[focusedWinItem ? 1 : 0];
        this.customMenu[menuIndex].open(BoxPointer.PopupAnimation.FULL);
        firstItem.active = true;
    }

    // actions 0 - PlayPause, 1 - Next, 2 - Prev
    mprisPlayerControler(action = 0, playerID = 'org.mpris.MediaPlayer2') {
        const Methods = [
            'PlayPause',
            'Next',
            'Previous'
        ]
        let method = Methods[action];
        let session = Gio.DBus.session;
        session.call(
            'org.freedesktop.DBus',
            "/org/freedesktop",
            'org.freedesktop.DBus',
            'ListNames',
            null, null, Gio.DBusCallFlags.NONE, -1, null,
            (connection, res) => {
                try {
                    let reply = connection.call_finish(res);
                    let value = reply.get_child_value(0);
                    let mprisServices = value.get_strv().filter(n => n.includes(playerID));
                    // first in the list is usually the last created player, media keys in GNOME works the same way
                    let player = mprisServices[0];
                    this._executeMprisPlayerCommand(session, player, method);
                } catch (e) {
                    if (e instanceof Gio.DBusError) {
                        Gio.DBusError.strip_remote_error(e);
                    }
                    logError(e);
                }
            }
        );
    }

    _executeMprisPlayerCommand(session, player, method) {
        session.call(
            player,
            "/org/mpris/MediaPlayer2",
            'org.mpris.MediaPlayer2.Player',
            method,
            null, null, Gio.DBusCallFlags.NONE,-1,null
        );
    }
};

var CustomMenuPopup = class CustomMenuPopup extends PopupMenu.PopupMenu {
    constructor(layoutManager) {
        super(layoutManager.dummyCursor, 0, St.Side.TOP);
        this.menuItems = [];
        this.actionList = [];
        this.focusedWindow = null;
        this.windowNeeded = false;
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
        const runActionData = this.actionTrigger.runActionData;
        runActionData.keyboard = false;

        this.windowNeeded = false;
        let submenu = null;

        for (let i = 0; i < this.actionList.length; i++) {
            const item = this.actionList[i];
            const section = item[0] === null;

            if (!this.menuItems.includes(item[1])) {
                // reset submenu if it shouldn't be used
                if (section)
                    submenu = null;
                continue;
            }

            const action  = item[1];
            // add space between icon and name
            const name = ` ${item[2]}`;
            const icon = item[4];
            const needsWin = item[5];
            if (needsWin)
                this.windowNeeded = true;

            if (item[0] === 0) submenu = null;
            if (section) {
                submenu = new PopupMenu.PopupSubMenuMenuItem(name, true);
                submenu.icon.icon_name = icon;
                this.addMenuItem(submenu);
            } else if (submenu) {
                submenu.menu.addAction(name, () => {
                    // open menu steal focus from focused window, so close it before calling the action
                    this.act.menu.close();
                    runActionData.action = action;
                    this.actionTrigger.runAction();
                }, icon);
            } else {
                this.addAction(name, () => {
                    this.act.menu.close();
                    runActionData.action = action;
                    this.actionTrigger.runAction();
                }, icon);
            }
        }

        if (this.windowNeeded) {
            if (this.focusedWindow === null)
                this.focusedWindow = _('No window has focus!');
            let win = new PopupMenu.PopupMenuItem(this.focusedWindow);
            win.sensitive = false;
            this.addMenuItem(win, 0);
        }
    }
};
