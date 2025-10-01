/**
 * Custom Hot Corners - Extended
 * Actions
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2025
 * @license    GPL-3.0
 */

'use strict';

import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import St from 'gi://St';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as WorkspaceSwitcherPopup from 'resource:///org/gnome/shell/ui/workspaceSwitcherPopup.js';
import * as Volume from 'resource:///org/gnome/shell/ui/status/volume.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';
import * as FileUtils from 'resource:///org/gnome/shell/misc/fileUtils.js';
import * as LookingGlass from 'resource:///org/gnome/shell/ui/lookingGlass.js';

import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';

import * as Settings from '../common/settings.js';
import * as Shaders from './shaders.js';

// gettext
let _;
let Me;

// let _origAltTabWSP           = null;

export function init(extension) {
    _ = extension.gettext.bind(extension);
    Me = extension;
}

export function cleanGlobals() {
    _ = null;
    Me = null;
}

function getCurrentMonitorGeometry() {
    return global.display.get_monitor_geometry(global.display.get_current_monitor());
}

export const Actions = class {
    constructor(mscOptions) {
        this._signalsCollector      = [];
        this._timeouts              = {};

        this._minimizedWindows      = [];
        this._dimmerActors          = [];

        this._a11yAppsSettings      = null;
        this._a11yMagnifierSettings = null;
        this._interfaceSettings     = null;
        this._shellSettings         = null;
        this._soundSettings         = null;
        this._displayBrightnessProxy = null;

        this.WS_IGNORE_LAST         = false;
        this.WS_WRAPAROUND          = false;

        this.WIN_WRAPAROUND         = false;
        this.WIN_SKIP_MINIMIZED     = false;
        this.WIN_STABLE_SEQUENCE    = false;

        this._tmbConnected          = false;

        this._mainPanelVisible      = Main.panel.is_visible();

        this.customMenu             = [];
        this._winPreview            = null;

        this._mscOptions = mscOptions;
    }

    clean(full = true) {
        if (full) {
            if (this._mainPanelVisible)
                Main.panel.show();
            else
                Main.panel.hide();
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
        this._destroyDimmerActors();
        this._removeCustomMenus();
        this._destroyWindowPreview();
        this._removeOsdMonitorIndexes();

        Object.values(this._timeouts).forEach(t => {
            if (t)
                GLib.source_remove(t);
        });
    }

    _removeOsdMonitorIndexes(keepConnection = false) {
        if (this._osdMonitorLabels) {
            this._osdMonitorLabels.forEach(w => {
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

    removeAllEffects() {
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
        if (!glob && actor.metaWindow._opacityCE) {
            this._getWindowSurface(actor.get_meta_window()).forEach(s => {
                s.opacity = 255;
            });
        }
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
            this._shellSettings = new Gio.Settings({
                schema_id: 'org.gnome.shell',
            });
        }
        return this._shellSettings;
    }

    _getA11yAppSettings() {
        if (!this._a11yAppsSettings) {
            this._a11yAppsSettings = new Gio.Settings({
                schema_id: 'org.gnome.desktop.a11y.applications',
            });
        }
        return this._a11yAppsSettings;
    }

    _getA11yMagnifierSettings() {
        if (!this._a11yMagnifierSettings) {
            this._a11yMagnifierSettings = new Gio.Settings({
                schema_id: 'org.gnome.desktop.a11y.magnifier',
            });
        }
        return this._a11yMagnifierSettings;
    }

    _getInterfaceSettings() {
        if (!this._interfaceSettings) {
            this._interfaceSettings = new Gio.Settings({
                schema_id: 'org.gnome.desktop.interface',
            });
        }
        return this._interfaceSettings;
    }

    _getColorSettings() {
        if (!this._colorSettings) {
            this._colorSettings = new Gio.Settings({
                schema_id: 'org.gnome.settings-daemon.plugins.color',
            });
        }
        return this._colorSettings;
    }

    _getWsNamesSettings() {
        if (!this._wsNamesSettings) {
            this._wsNamesSettings = new Gio.Settings({
                schema_id: 'org.gnome.desktop.wm.preferences',
            });
        }
        return this._wsNamesSettings;
    }

    _getSoundSettings() {
        if (!this._soundSettings) {
            this._soundSettings = new Gio.Settings({
                schema_id: 'org.gnome.desktop.sound',
            });
        }
        return this._soundSettings;
    }

    _getDisplayBrightnessProxy() {
        if (!this._displayBrightnessProxy) {
            const BUS_NAME = 'org.gnome.SettingsDaemon.Power';
            const OBJECT_PATH = '/org/gnome/SettingsDaemon/Power';

            const BrightnessInterface = FileUtils.loadInterfaceXML('org.gnome.SettingsDaemon.Power.Screen');
            const BrightnessProxy = Gio.DBusProxy.makeProxyWrapper(BrightnessInterface);
            this._displayBrightnessProxy = new BrightnessProxy(Gio.DBus.session, BUS_NAME, OBJECT_PATH,
                (proxy, error) => {
                    if (error)
                        log(error.message);
                }
            );
        }
        return this._displayBrightnessProxy;
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
        if (!metaWindow)
            return null;
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
        if (!metaWindow)
            return null;

        const actor = metaWindow.get_compositor_private();
        return this._findSurfaces(actor);
    }

    _findSurfaces(actor) {
        if (actor.constructor.name.indexOf('MetaSurfaceActor') > -1)
            return [actor];

        const surfaces = [];
        for (const child of actor.get_children()) {
            const result = this._findSurfaces(child);
            if (result.length)
                surfaces.push(...result);
        }

        return surfaces;
    }

    _getFocusedActor() {
        let actor = null;
        for (let act of global.get_window_actors()) {
            let metaWin = act.get_meta_window();
            if (metaWin.has_focus())
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

    _isWsOrientationHorizontal() {
        if (global.workspace_manager.layout_rows === -1)
            return false;
        return true;
    }

    _translateDirectionIfNeeded(direction) {
        if (this._isWsOrientationHorizontal()) {
            if (direction === Meta.MotionDirection.UP)
                direction = Meta.MotionDirection.LEFT;
            else
                direction = Meta.MotionDirection.RIGHT;
        }
        return direction;
    }

    _showMonitorIndexesOsd() {
        this._removeOsdMonitorIndexes();
        const success = this._buildMonitorIndexesOsd();
        if (!success)
            return;

        this._osdMonitorsConnection = global.display.connect('notify::focus-window', () => {
            // destroy osd when the preferences window lost focus
            if (global.display.focus_window && !global.display.focus_window.get_title().includes(Me.metadata.name)) {
                this._removeOsdMonitorIndexes(true); // remove labels, keep this connection
                // this._mscOptions.set('showOsdMonitorIndexes', false);
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
        // index of the primary monitor to the first position
        // Monitor 1 in preferences will always refer to the primary monitor
        monIndexes.splice(0, 0, monIndexes.splice(primaryIndex, 1)[0]);

        for (let i = 0; i < nMonitors; ++i) {
            const label = new OsdMonitorLabel(monIndexes[i], `${i + 1}`);
            label._label.style_class = '';
            label._label.set_style(`background-color: rgba(35, 35, 35, 1.0);
                                    color: rgba(255, 255, 255, 1.0);
                                    border-radius: 12px;
                                    font-size: 3em;
                                    font-weight: bold;
                                    margin: 12px;
                                    padding: 0.2em;
                                    text-align: center;
                                    min-width: 1.3em;
                                    border: solid, 1px, rgba(83, 83, 83, 1.0);`);
            this._osdMonitorLabels.push(label);
        }
        return true;
    }

    _getOpenPrefsWindow() {
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (let win of windows) {
            if (win.get_title().includes(Me.metadata.name) && this._getWindowApp(win).get_name() === 'Extensions')
                return { metaWin: win, isCHCE: true };
            else if (win.wm_class && win.wm_class.includes('org.gnome.Shell.Extensions'))
                return { metaWin: win, isCHCE: false };
        }
        return { metaWin: null, isCHCE: null };
    }

    // ///////////////////////////////////////////////////////////////////////////

    _shouldUseGrabWorkaround(focusWindow) {
        return !Meta.is_wayland_compositor() && focusWindow && focusWindow.wm_class && focusWindow.wm_class.includes('VirtualBox Machine');
    }

    toggleOverview(leaveOverview = false) {
        if (Main.overview._shown && (leaveOverview || !Main.overview.dash.showAppsButton.checked)) {
            Main.overview.hide();
        } else if (Main.overview.dash.showAppsButton.checked) {
            Main.overview.dash.showAppsButton.checked = false;
        } else {
            const focusWindow = global.display.get_focus_window();
            // at least GS 42 is unable to show overview in X11 session if VirtualBox Machine window grabbed keyboard
            if (this._shouldUseGrabWorkaround(focusWindow)) {
                // following should help when windowed VBox Machine has focus.
                global.stage.set_key_focus(Main.panel);
                // key focus doesn't take the effect immediately, we must wait for it
                // still looking for better solution!
                this._timeouts.releaseKeyboardTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    // delay cannot be too short
                    200,
                    () => {
                        Main.overview.show();

                        this._timeouts.releaseKeyboardTimeoutId = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            } else {
                Main.overview.show();
            }
        }
    }

    showApplications(leaveOverview = false) {
        if ((leaveOverview && Main.overview._shown) || Main.overview.dash.showAppsButton.checked) {
            Main.overview.hide();
        } else {
            const focusWindow = global.display.get_focus_window();
            // at least GS 42 is unable to show overview in X11 session if VirtualBox Machine window grabbed keyboard
            if (this._shouldUseGrabWorkaround(focusWindow)) {
                // following should help when windowed VBox Machine has focus.
                global.stage.set_key_focus(Main.panel);
                // key focus doesn't take the effect immediately, we must wait for it
                // still looking for better solution!
                this._timeouts.releaseKeyboardTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    // delay cannot be too short
                    200,
                    () => {
                        Main.overview.show(2);

                        this._timeouts.releaseKeyboardTimeoutId = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            } else if (Main.overview._shown) {
                Main.overview.dash.showAppsButton.checked = true;
            } else {
                Main.overview.show(2); // 2 for App Grid
            }
            // Main.overview.showApps()  // GS 40 only, can show app grid, but not when overview is already active
            // Main.overview.viewSelector._toggleAppsPage();  // GS 36/38
        }
    }

    searchOpenWindows() {
        if (!Main.overview._overview._controls._searchController._searchActive) {
            Main.overview.show();
            const prefix = 'wq// ';
            const position = prefix.length;
            const searchEntry = Main.overview.searchEntry;
            searchEntry.set_text(prefix);
            // searchEntry.grab_key_focus();
            searchEntry.get_first_child().set_cursor_position(position);
            searchEntry.get_first_child().set_selection(position, position);
        } else {
            // Main.overview.searchEntry.text = '';
            Main.overview.hide();
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
        const tabList = _getWindows(null);
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
        // if (!Main.overview.visible)
        //    return;
        let activeWs = global.workspace_manager.get_active_workspace();
        let activeWsIdx = activeWs.index();
        let targetIdx = activeWsIdx + direction;
        if (targetIdx > -1 && targetIdx < global.workspace_manager.get_n_workspaces())
            global.workspace_manager.reorder_workspace(activeWs, targetIdx);

        // this.showWorkspaceIndex();
        direction = direction > 0 ? Meta.MotionDirection.DOWN : Meta.MotionDirection.UP;
        this._showWsSwitcherPopup(direction, targetIdx);
    }

    rotateWorkspaces(direction = 0, monitorIndex = -1, step = 1) {
        step = direction === Meta.MotionDirection.UP ? Number(step) : -step;
        const monitor = monitorIndex > -1 ? monitorIndex : global.display.get_current_monitor();
        const dynamicWs = Meta.prefs_get_dynamic_workspaces();
        const lastIndex = global.workspaceManager.get_n_workspaces() - (dynamicWs ? 1 : 0);
        let windows = _getWindows(null);
        for (let win of windows.reverse()) {
            // avoid moving modal windows as they move their parents (and vice versa) immediately, before we move the parent window.
            if (win.get_monitor() === monitor && !win.is_always_on_all_workspaces() && !win.is_attached_dialog() && !win.get_transient_for()) {
                let wWs = win.get_workspace().index();
                wWs += step;
                if (wWs < 0)
                    wWs = lastIndex - 1;
                if (wWs > lastIndex - 1)
                    wWs = 0;
                const ws = global.workspaceManager.get_workspace_by_index(wWs);
                win.change_workspace(ws);
            }
        }
    }

    switchWorkspaceCurrentMonitor(direction) {
        // const focusedWindow = global.display.get_focus_window();
        // const currentMonitor = focusedWindow ? focusedWindow.get_monitor() : global.display.get_current_monitor();
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
        if (!(Math.abs(diff) !== 1 && diff !== 0))
            step = Math.abs(diff);


        if (neighbor !== activeWs && (neighbor.index() !== lastIndex || activeWs !== lastIndex)) {
            for (let i = 0; i < nMonitors; i++) {
                if (i !== currentMonitor) {
                    const oppositeDirection = direction === Meta.MotionDirection.UP ? Meta.MotionDirection.DOWN : Meta.MotionDirection.UP;
                    this.rotateWorkspaces(oppositeDirection, i, step);
                }
            }
        }
        this.switchWorkspace(direction);
    }

    closeWorkspace() {
        const activeWs = global.workspace_manager.get_active_workspace();
        const windows = _getWindows(activeWs);
        for (let i = 0; i < windows.length; i++) {
            if (!windows[i].is_on_all_workspaces())
                windows[i].delete(global.get_current_time() + i);
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
        if (direction === Meta.MotionDirection.UP)
            value += STEP;
        else
            value -= STEP;


        if (value > 100)
            value = 100;
        if (value < 0)
            value = 0;

        proxy.Brightness = value;
    }

    lockScreen() {
        // Main.screenShield.lock(true);
        SystemActions.getDefault().activateLockScreen();
    }

    suspendToRam() {
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
            null, Gio.DBusCallFlags.NONE, -1, null
        );
    }

    showScreenshotUi() {
        Screenshot.showScreenshotUI();
    }

    toggleLookingGlass() {
        if (Main.lookingGlass === null)
            Main.createLookingGlass();
        if (Main.lookingGlass !== null)
            Main.lookingGlass.toggle();
    }

    activateUiInspector() {
        this._timeouts.uiInspectorTimeoutId = GLib.timeout_add(0, 1400, () => {
            if (Main.lookingGlass === null)
                Main.createLookingGlass();
            const lg = Main.lookingGlass;
            lg.open();
            lg.openInspector = () => {
                let inspector = new LookingGlass.Inspector(lg);
                inspector.connect('target', (i, target, stageX, stageY) => {
                    lg._pushResult(`inspect(${Math.round(stageX)}, ${Math.round(stageY)})`, target);
                });
                inspector.connect('closed', () => {
                    lg.show();
                    global.stage.set_key_focus(lg._entry);
                });
                lg.hide();
                return Clutter.EVENT_STOP;
            };

            lg.openInspector();
            this._timeouts.uiInspectorTimeoutId = 0;
            return GLib.SOURCE_REMOVE;
        });
    }

    switchToRecentWindow() {
        _getWindows(null)[1].activate(global.get_current_time());
        // global.display.get_tab_list(0, null)[1].activate(global.get_current_time());
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
        if (win.maximized_horizontally && win.maximized_vertically) {
            if (win.get_maximized)
                win.unmaximize(Meta.MaximizeFlags.BOTH);
            else
                win.unmaximize();
        } else if (win.get_maximized) {
            win.maximize(Meta.MaximizeFlags.BOTH);
        } else {
            win.maximize();
        }
    }

    minimizeWindow() {
        let win = this._getFocusedWindow(true);
        if (!win)
            return;
        win.minimize();
        // global.display.get_tab_list(0, null)[0].minimize();
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
        app.open_new_window(-1);
    }

    _shiftPressed() {
        const mods = global.get_pointer()[2];
        return (mods & Clutter.ModifierType.SHIFT_MASK) !== 0;
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
            // move window to its original ws if any
            if (win._originalWS) {
                for (let i = 0; i < global.workspaceManager.n_workspaces; i++) {
                    let w = global.workspaceManager.get_workspace_by_index(i);
                    if (w === win._originalWS) {
                        win.change_workspace(win._originalWS);
                        Main.wm.actionMoveWorkspace(win._originalWS);
                        break;
                    }
                }
                // show workspace switcher popup to show the user which workspace is now active
                this._showWsSwitcherPopup(0, win._originalWS.index());
                win._originalWS = null;
            }
        } else {
            let ws = win.get_workspace();
            let nWindows = ws.list_windows().filter(
                w =>
                // w.get_window_type() === Meta.WindowType.NORMAL &&
                    !w.is_on_all_workspaces()
            ).length;

            if (nWindows)
                win.make_fullscreen();
                // only move window to the new workspace if it's not the only window on the current workspace
            if (nWindows > 1) {
                const newWsIndex = ws.index() + 1;
                Main.wm.insertWorkspace(newWsIndex);
                const newWs = global.workspaceManager.get_workspace_by_index(newWsIndex);
                // this.moveWinToAdjacentWs(1, [win]);
                // changing the window workspace first and then move to the workspace makes the transition visually better
                win.change_workspace(newWs);

                // Don't switch to the new workspace if Shift key is held down
                if (!this._shiftPressed()) {
                    // activate the window to switch to the new workspace
                    win.activate(global.get_current_time());
                    // show workspace switcher popup to show the user which workspace is now active
                    this._showWsSwitcherPopup(0, newWsIndex);
                }
                win._originalWS = ws;
            }
        }
    }

    moveWinToNewWs(direction, windows = null) {
        let selected;
        if (!windows)
            selected = [this._getFocusedWindow(true)];
        else
            selected = windows;
        if (!selected)
            return;

        let wsIndex = global.workspace_manager.get_active_workspace_index();
        wsIndex += direction === Meta.MotionDirection.UP ? 0 : 1;
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
        wsIndex += direction === Meta.MotionDirection.UP ? -1 : 1;
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
            win.move_to_monitor(targetMonitorIndex);
        }
    }

    moveWinToNextMonitor(metaWindow = null) {
        let win;
        if (!metaWindow)
            win = this._getFocusedWindow(true);
        else
            win = metaWindow;
        if (!win)
            return;

        const nMonitors = Main.layoutManager.monitors.length;
        const currentMonitorIndex = win.get_monitor();
        if (nMonitors) {
            const targetMonitorIndex = (currentMonitorIndex + 1) % nMonitors;
            win.move_to_monitor(targetMonitorIndex);
        }
    }

    toggleAboveWindow(metaWindow) {
        let win = metaWindow || this._getFocusedWindow(true);
        if (!win)
            return;
        if (win.is_above())
            win.unmake_above();
            // Main.notify(Me.metadata.name, _(`Disabled: Always on Top \n\n${win.title}` ));
        else
            win.make_above();
            // Main.notify(Me.metadata.name, _(`Enabled: Always on Top \n\n${win.title}` ));
    }

    toggleStickWindow(metaWindow) {
        let win = metaWindow || this._getFocusedWindow(true);
        if (!win)
            return;
        if (win.is_on_all_workspaces())
            win.unstick();
            // Main.notify(Me.metadata.name, _(`Disabled: Always on Visible Workspace \n\n${win.title}` ));
        else
            win.stick();
            // Main.notify(Me.metadata.name, _(`Enabled: Always on Visible Workspace \n\n${win.title}` ));
    }

    restartGnomeShell() {
        if (!Meta.is_wayland_compositor())
            Meta.restart(_('Restarting Gnome Shell...'), global.context);
        else
            Main.notify(Me.metadata.name, _('Gnome Shell - Restart is not available in Wayland session'));
    }

    toggleShowPanel() {
        if (Main.panel.is_visible()) {
            Main.panel.hide();
        } else {
            Main.panel.show();
            this._timeouts.panelBarrierTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                1000,
                () => {
                    Main.layoutManager._updateHotCorners();
                    this._timeouts.panelBarrierTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );
        }
    }

    openPanelSystemMenu() {
        // Move the dummy source widget to the current pinter position
        Main.layoutManager.setDummyCursorGeometry(global.get_pointer()[0], global.get_pointer()[1], 0, 0);
        if (Main.panel.statusArea.quickSettings) {
            Main.panel.statusArea.quickSettings.menu._arrowAlignment = 0.5;
            Main.panel.statusArea.quickSettings.menu.toggle();
            // change menu position by replacing the source actor with dummy widget
            Main.panel.statusArea.quickSettings.menu._boxPointer._sourceActor = Main.layoutManager.dummyCursor;
        }
    }

    openPanelDateMenu() {
        // Move the dummy source widget to the current pinter position
        Main.layoutManager.setDummyCursorGeometry(global.get_pointer()[0], global.get_pointer()[1], 0, 0);
        Main.panel.statusArea.dateMenu.menu.toggle();
        // change menu position by replacing the source actor with dummy widget
        Main.panel.statusArea.dateMenu.menu._boxPointer._sourceActor = Main.layoutManager.dummyCursor;
    }

    toggleTheme() {
        const intSettings = this._getInterfaceSettings();
        const theme = intSettings.get_string('gtk-theme');
        const themeSplit = theme.split('-');
        let yaruAccent = '';
        if (themeSplit[0] === 'Yaru' && themeSplit.length > 1) {
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
            newTheme = 'Yaru';
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

        dark = !(intSettings.get_string('color-scheme') === 'prefer-dark');
        if (dark)
            intSettings.set_string('color-scheme', 'prefer-dark');
        else
            intSettings.set_string('color-scheme', 'prefer-light');

        if (newTheme) {
            const shellThemeSettings = this._getShellThemeSettings('org.gnome.shell.extensions.user-theme');// , '/org/gnome/shell/extensions/user-theme/');
            if (dark) {
                intSettings.set_string('gtk-theme', `${newTheme}-dark`);
                if (shellThemeSettings)
                    shellThemeSettings.set_string('name', `${newTheme}-dark`);
            } else {
                intSettings.set_string('gtk-theme', newTheme);
                if (shellThemeSettings)
                    shellThemeSettings.set_string('name', newTheme);
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
            // throw new Error(
            log(
                `Schema ${schema} could not be found for extension. Please check your installation.`
            );
            return null;
        }

        const args = { settings_schema: schemaObj };
        if (path)
            args.path = path;


        return new Gio.Settings(args);
    }

    openRunDialog() {
        Main.openRunDialog();
    }

    openPreferences() {
        const metadata = Me.metadata;
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        let tracker = Shell.WindowTracker.get_default();
        let metaWin, isMe = null;

        for (let win of windows) {
            const app = tracker.get_window_app(win);
            if (win.get_title()?.includes(metadata.name) && app.get_name() === 'Extensions') {
            // this is our existing window
                metaWin = win;
                isMe = true;
                break;
            } else if (win.wm_class?.includes('org.gnome.Shell.Extensions')) {
            // this is prefs window of another extension
                metaWin = win;
                isMe = false;
            }
        }

        if (metaWin && !isMe) {
        // other prefs window blocks opening another prefs window, so close it
            metaWin.delete(global.get_current_time());
        } else if (metaWin && isMe) {
        // if prefs window already exist, move it to the current WS and activate it
            metaWin.change_workspace(global.workspace_manager.get_active_workspace());
            metaWin.activate(global.get_current_time());
        }

        if (!metaWin || (metaWin && !isMe)) {
        // delay to avoid errors if previous prefs window has been colsed
            GLib.idle_add(GLib.PRIORITY_LOW, () => {
                try {
                    Main.extensionManager.openExtensionPrefs(metadata.uuid, '', {});
                } catch (e) {
                    console.error(e);
                }
            });
        }
    }

    toggleShowDesktop(monitorIndex = -1) {
        if (Main.overview.visible)
            return;
        let metaWorkspace = global.workspace_manager.get_active_workspace();
        let windows = metaWorkspace.list_windows();
        let wins = [];
        for (let win of windows) {
            if ((monitorIndex < 0 ? true : win.get_monitor() === monitorIndex) &&
                    !(win.minimized ||
                    win.window_type === Meta.WindowType.DESKTOP ||
                    win.window_type === Meta.WindowType.DOCK ||
                    win.skip_taskbar
                    )) {
                win._focusedBeforeShowDesktop = false;
                wins.push(win);
                if (win === global.display.get_focus_window())
                    win._focusedBeforeShowDesktop = true;
            }
        }

        if (wins.length !== 0) {
            for (let win of wins)
                win.minimize();
            this._minimizedWindows = wins;
        } else if (this._minimizedWindows !== 0) {
            for (let win of this._minimizedWindows) {
                win.unminimize();
                if (win._focusedBeforeShowDesktop) {
                    win.activate(global.get_current_time());
                    win._focusedBeforeShowDesktop = false;
                }
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
    }

    _showWsSwitcherPopup(direction, wsIndex) {
        if (!Main.overview.visible) {
            if (Main.wm._workspaceSwitcherPopup === null) {
                Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
                Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
                    Main.wm._workspaceSwitcherPopup = null;
                });
            }

            Main.wm._workspaceSwitcherPopup.display(wsIndex);
        }
    }


    touchSwipeSimulator(direction, workspace) {
        if (!workspace && !this._timeouts.swipeOverviewTimeoutId)
            Main.overview._swipeTracker._beginTouchSwipe(null, global.get_current_time(), 200, 150);
        if (workspace && !this._timeouts.swipeWsTimeoutId)
            Main.wm._workspaceAnimation._swipeTracker._beginTouchSwipe(null, global.get_current_time(), 200, 150);

        const state = global.get_pointer()[2];
        const distance = 100;
        const step = state & Clutter.ModifierType.SHIFT_MASK ? 1 : 10; // 1% / 10% when distance == 100
        const delta = direction * step;
        const time = global.get_current_time();
        if (workspace) {
            Main.wm._workspaceAnimation._swipeTracker._updateGesture(null, time, delta, distance);
            if (!this._timeouts.swipeWsTimeoutId) {
                this._timeouts.swipeWsTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    300,
                    () => {
                        // if the mouse pointer is still over the edge of the current monitor, we assume that the user has not yet finished the selection
                        const [x, y] = global.get_pointer();
                        if (!this._isPointerOnEdge(x, y)) {
                            Main.wm._workspaceAnimation._swipeTracker._endGesture(global.get_current_time(), 700, true);
                            this._timeouts.swipeWsTimeoutId = 0;
                            return GLib.SOURCE_REMOVE;
                        }
                        return GLib.SOURCE_CONTINUE;
                    }
                );
            }
        } else {
            Main.overview._swipeTracker._updateGesture(null, time, delta, distance);
            if (!this._timeouts.swipeOverviewTimeoutId) {
                this._timeouts.swipeOverviewTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    300,
                    () => {
                        // if the mouse pointer is still over the edge of the current monitor, we assume that the user has not yet finished the selection
                        const [x, y] = global.get_pointer();
                        if (!this._isPointerOnEdge(x, y)) {
                            Main.overview._swipeTracker._endGesture(global.get_current_time(), 700, true);
                            this._timeouts.swipeOverviewTimeoutId = 0;
                            return GLib.SOURCE_REMOVE;
                        }
                        return GLib.SOURCE_CONTINUE;
                    }
                );
            }
        }
    }

    toggleOverviewAppWindows() {
        const isOverviewWindow = Workspace.Workspace.prototype._isOverviewWindow;
        Workspace.Workspace.prototype._isOverviewWindow = win => {
            const activeWindow = global.display.focus_window;
            return !activeWindow
                ? isOverviewWindow(win)
                : activeWindow.wm_class === win.wm_class;
        };
        Main.overview.toggle();
        Workspace.Workspace.prototype._isOverviewWindow = isOverviewWindow;
    }

    switchWindow(direction, wsOnly = false, monitorIndex = -1, app = false) {
        let workspaceManager = global.workspace_manager;

        let workspace = null;
        let windows = _getWindows(workspace);
        if (monitorIndex > -1)
            windows = windows.filter(w => w.get_monitor() === monitorIndex);

        if (wsOnly) {
            workspace = workspaceManager.get_active_workspace();
            windows = windows.filter(w => w.get_workspace() === workspace);
        }

        if (this.WIN_SKIP_MINIMIZED)
            windows = windows.filter(win => !win.minimized);

        if (app) {
            app = this._getWindowApp(this._getFocusedWindow());
            windows = windows.filter(win => this._getWindowApp(win) === app);
        }

        if (!windows.length)
            return;

        // if window selection is in the process, the previewed window must be the current one
        let currentWin  = this._winPreview ? this._winPreview._window : windows[0];
        if (this.WIN_STABLE_SEQUENCE) {
            // tab list is sorted by MRU order, active window is always idx 0
            // each window has index in global stable order list (as launched)
            windows.sort((a, b) => {
                return a.get_stable_sequence() - b.get_stable_sequence();
            }).reverse(); // reverse the list to get the same sequence direction as MRU list has
        }
        const currentIdx = windows.indexOf(currentWin);
        let targetIdx = currentIdx +  -direction; // reverse the direction to follow MRU ordered list

        if (targetIdx > windows.length - 1)
            targetIdx = this.WIN_WRAPAROUND ? 0 : currentIdx;
        else if (targetIdx < 0)
            targetIdx = this.WIN_WRAPAROUND ? windows.length - 1 : currentIdx;


        this._showWindowPreview(windows[targetIdx]);
        if (this._timeouts.winSwitcherTimeoutId) {
            GLib.source_remove(this._timeouts.winSwitcherTimeoutId);
            this._timeouts.winSwitcherTimeoutId = 0;
        }
        this._timeouts.winSwitcherTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            300,
            () => {
                // if the mouse pointer is still over the edge of the current monitor, we assume that the user has not yet finished the selection
                if (this._winPreview && !this._isPointerOnEdge(this._winPreview._xPointer, this._winPreview._yPointer)) {
                    const metaWin = this._winPreview._window;
                    const switchWS = metaWin.get_workspace() !== global.workspace_manager.get_active_workspace();
                    if (switchWS)
                        this.moveToWorkspace(this._winPreview._window.get_workspace().index());
                    this._winPreview._window.activate(global.get_current_time());
                    this._destroyWindowPreview();
                    this._timeouts.winSwitcherTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    // returns true if the mouse pointer is at the edge of the current monitor and not further than 100px on the other axis
    // xPointer/yPointer hold pointer position in time of action activation
    _isPointerOnEdge(xPointer, yPointer) {
        let [x, y] = global.get_pointer();
        const geometry = getCurrentMonitorGeometry();
        if ([geometry.x, geometry.x + geometry.width - 1].includes(x) && Math.abs(yPointer - y) < 100)
            return true;
        if ([geometry.y, geometry.y + geometry.height - 1].includes(y) && Math.abs(xPointer - x) < 100)
            return true;

        return false;
    }

    _showWindowPreview(metaWin) {
        if (!metaWin)
            return;

        /* if (this._winPreview) {
            this._destroyWindowPreview();
        }*/

        if (!this._winPreview) {
            this._winPreview = new CyclerHighlight();
            global.window_group.add_child(this._winPreview);
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

    // direction +1 / -1, 0 for toggle mute
    adjustVolume(direction) {
        let mixerControl = Volume.getMixerControl();
        let sink = mixerControl.get_default_sink();

        if (!sink)
            return;

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

        volume += step;
        if (volume > maxLevel)
            volume = maxLevel;
        if (volume < 0)
            volume = 0;

        sink.volume = volume;
        sink.push_volume();

        // OSD
        let icons = ['audio-volume-muted-symbolic',
            'audio-volume-low-symbolic',
            'audio-volume-medium-symbolic',
            'audio-volume-high-symbolic',
            'audio-volume-overamplified-symbolic'];

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
        const label = sink.get_port().human_port;
        if (Main.osdWindowManager.showAll) // // Since GNOME 49
            Main.osdWindowManager.showAll(gicon, label, level, ampScale);
        else
            Main.osdWindowManager.show(-1, gicon, label, level, ampScale);
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
            value = windowSurface[0].opacity === 255
                ? toggleValue
                : 255;
        } else {
            value = windowSurface[0].opacity;
            value += step;
            if (value > 255)
                value = 255;
            if (value < 32)
                value = 32;
        }

        windowSurface.forEach(s => {
            s.opacity = value;
        });

        if (toggleValue)
            return;

        const focusWin = this._getWindowApp(global.display.get_focus_window());
        const winTitle = focusWin ? focusWin.get_name() : '';
        let title = `${_('Opacity')}  (${winTitle})`;
        const maxLevel = 255;
        const ampScale = 1;
        const gicon = new Gio.ThemedIcon({ name: 'view-reveal-symbolic' });
        const level = value / maxLevel;
        if (Main.osdWindowManager.showAll) // // Since GNOME 49
            Main.osdWindowManager.showAll(gicon, title, level, ampScale);
        else
            Main.osdWindowManager.show(-1, gicon, title, level, ampScale);
    }

    adjustSwBrightnessContrast(step = 0, window = false, brightness = true, valueO = null) {
        // brightness/contrast range: -1 all black/gray, 0 normal, 1 all white/extreme contrast
        // step with +/- value from range
        let name = brightness ? 'brightness' : 'contrast';
        let brightnessContrast, value;

        const getBCValue = () => {
            return brightness
                ? brightnessContrast.get_brightness()[0] // Clutter returns value in [r,g,b] format
                : brightnessContrast.get_contrast()[0];
        };

        const setBCValue = val => {
            return brightness
                ? brightnessContrast.set_brightness(val)
                : brightnessContrast.set_contrast(val);
        };

        if (window) {
            let actor = this._getFocusedActor();
            if (!actor)
                return;
            if (!actor.get_effect(name))
                actor.add_effect_with_name(name, new Clutter.BrightnessContrastEffect());

            brightnessContrast = actor.get_effect(name);
        } else {
            if (!Main.uiGroup.get_effect(name))
                Main.uiGroup.add_effect_with_name(name, new Clutter.BrightnessContrastEffect());

            brightnessContrast = Main.uiGroup.get_effect(name);
        }

        if (!valueO) {
            value = getBCValue();
            // multiply to avoid value shifting
            value = Math.round((value * 1000) + (step * 1000));
            let max = brightness ? 0 : 300;
            if (value > max)
                value = max;
            if (value < -750)
                value = -750;
            value /= 1000;
        } else {
            value = valueO;
            if (valueO === Math.round(getBCValue() * 1000) / 1000)
                value = 0;
        }

        setBCValue(value);
        if (!value)
            brightnessContrast.set_enabled(false);
        else
            brightnessContrast.set_enabled(true);


        if (valueO)
            return;

        const focusWin = this._getWindowApp(global.display.get_focus_window());
        const winTitle = window && focusWin ? focusWin.get_name() : '';
        const suffix = window ? _(`(${winTitle})`) : _('(global)');
        let title = brightness ? _('Brightness') : _('Contrast');
        title = `${title} ${suffix}`;
        const maxLevelNorm = 100;
        const maxLevel = brightness ? 100 : 130;
        const ampScale = maxLevel / maxLevelNorm;
        const gicon = new Gio.ThemedIcon({ name: brightness ? 'display-brightness-symbolic' : 'view-reveal-symbolic' });
        const level = (value * 100 + 100) / maxLevel * ampScale;
        if (Main.osdWindowManager.showAll) // // Since GNOME 49
            Main.osdWindowManager.showAll(gicon, title, level, ampScale);
        else
            Main.osdWindowManager.show(-1, gicon, title, level, ampScale);
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
            const Color = Clutter.Color ? Clutter.Color : Cogl.Color;
            const [success, col] = Color.from_string(this._mscOptions.get('customTintColor'));
            if (!success)
                return;
            else
                color = col;
        }
        let name = 'color-tint';
        let effect = Clutter.ColorizeEffect;
        if (window)
            this._toggleWindowEffect(name, effect, { tint: color });
        else
            this._toggleGlobalEffect(name, effect, { tint: color });
    }

    toggleLightnessInvertEffect(window = true, whiteShift = true) {
        let name = 'inversion';
        let effect = whiteShift
            ? Shaders.InvertLightnessShiftEffect
            : Shaders.InvertLightnessEffect;
        if (window)
            this._toggleWindowEffect(name, effect);
        else
            this._toggleGlobalEffect(name, effect);
    }

    toggleColorsInvertEffect(window = true) {
        let name = 'inversion';
        let effect;
        effect = Shaders.ColorInversionEffect;
        if (window)
            this._toggleWindowEffect(name, effect);
        else
            this._toggleGlobalEffect(name, effect);
    }

    toggleColorBlindShaderEffect(window = true, mode = 0, simulate = false) {
        let name = 'color-blind';
        const effect = Shaders.DaltonismEffect;

        simulate = simulate ? 1 : 0;
        if (window)
            this._toggleWindowEffect(name, effect, { mode, simulate });
        else
            this._toggleGlobalEffect(name, effect, { mode, simulate });
    }

    toggleColorMixerEffect(window = true) {
        let name = 'color-mixer';
        let effect = Shaders.ColorMixerEffect2;
        if (window)
            this._toggleWindowEffect(name, effect);
        else
            this._toggleGlobalEffect(name, effect);
    }

    _toggleGlobalEffect(name, effect, properties = {}) {
        if (Main.uiGroup.get_effect(name)) {
            Main.uiGroup.remove_effect_by_name(name);
        } else {
            let eff = new effect(properties);
            Main.uiGroup.add_effect_with_name(name, eff);
        }
    }

    _toggleWindowEffect(name, effect, properties = {}) {
        global.get_window_actors().forEach(actor => {
            let metaWindow = actor.get_meta_window();
            if (metaWindow.has_focus()) {
                if (actor.get_effect(name)) {
                    actor.remove_effect_by_name(name);
                } else {
                    let eff = new effect(properties);
                    actor.add_effect_with_name(name, eff);
                }
            }
        });
    }

    toggleDimMonitors(alpha, text, monitorIndex = -1) {
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
            if (monitorIndex === -1)
                this._destroyDimmerActors();
            let monitors = [...Main.layoutManager.monitors.keys()];

            for (let monitor of monitors) {
                if (monitorIndex < 0 ? true : monitor === monitorIndex) {
                    let geometry = global.display.get_monitor_geometry(monitor);
                    let actor = new St.Label({
                        name: `${monitor}`,
                        text,
                        x: geometry.x,
                        y: geometry.y,
                        width: geometry.width,
                        height: geometry.height,
                        style: 'background-color: #000000; color: #444444; font-size: 1em;',
                        opacity: alpha,
                        reactive: true,
                    });
                    actor.connect('button-press-event', () => this.toggleDimMonitors(null, null, monitorIndex));
                    // Main.layoutManager.addChrome(actor);
                    global.stage.add_child(actor);
                    this._dimmerActors.push(actor);
                }
            }
        }
    }

    zoom(step = 0) {
        let appSettings = this._getA11yAppSettings();
        let magSettings = this._getA11yMagnifierSettings();

        if (step === 0) {
            if (!appSettings.get_boolean('screen-magnifier-enabled') &&
                 magSettings.get_double('mag-factor') === 1
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
                // when Zoom = 1 enabled, graphics artifacts might follow mouse pointer
                if (appSettings.get_boolean('screen-magnifier-enabled'))
                    appSettings.set_boolean('screen-magnifier-enabled', false);
                return;
            }

            if (value > 5)
                value = 5;
            magSettings.set_double('mag-factor', value);

            if (!appSettings.get_boolean('screen-magnifier-enabled'))
                appSettings.set_boolean('screen-magnifier-enabled', true);
        }
        // Main.magnifier.setActive(true); // simple way to activate zoom
    }

    toggleKeyboard(monitorIndex = -1) {
        // timeout added because of activation from menu, keyboard doesn't show up if menu is up
        this._timeouts.keyboardTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            200,
            () => {
                if (monitorIndex < 0)
                    monitorIndex = global.display.get_current_monitor();
                let visible = Main.keyboard.visible;
                let appSettings = this._getA11yAppSettings();
                if (visible) {
                    appSettings.set_boolean('screen-keyboard-enabled', false);
                } else {
                    if (!appSettings.get_boolean('screen-keyboard-enabled'))
                        appSettings.set_boolean('screen-keyboard-enabled', true);
                    // open the keyboard even if incompatible input is currently in focus
                    Main.keyboard.open(monitorIndex);
                }

                this._timeouts.keyboardTimeoutId = 0;
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
        else
            intSettings.set_double('text-scaling-factor', 1.25);
    }

    makeThumbnailWindow(metaWindow = null, minimize = false) {
        if (global.windowThumbnails)
            global.windowThumbnails.createThumbnail(metaWindow, minimize);
        else
            Main.notify(Me.metadata.name, _('This action requires the "WTMB (Window Thumbnails)" extension installed on your system'));
    }

    showAppSwitcherPopup() {
        let appSwitcher = new AltTab.AppSwitcherPopup();
        appSwitcher._resetNoModsTimeout = () => {};
        appSwitcher.show(0, 0, 0);
    }

    showWindowSwitcherPopup(args = {
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
        let altTabPopup = new AltTab.WindowSwitcherPopup();
        const advancedSwitcherEnabled = !!(altTabPopup.showOrig || altTabPopup._showPopup);

        if (advancedSwitcherEnabled) {
            // behavior variables
            altTabPopup.CHCE_TRIGGERED = true;
            altTabPopup.KEYBOARD_TRIGGERED = args['triggered-keyboard'];
            altTabPopup._keyBind = args['shortcut']; // shortcut without modifiers
            altTabPopup._singleApp         = args['filter-focused-app']
                ? Shell.WindowTracker.get_default().get_window_app(this._getFocusedWindow()).get_id()
                : null;
            if (args['timeout'])
                altTabPopup.NO_MODS_TIMEOUT  = args['timeout'];
            if (args['position-pointer'] !== null)
                altTabPopup.POSITION_POINTER = args['position-pointer'];
            if (args['group-mode']       !== 0)
                altTabPopup.GROUP_MODE       = args['group-mode'];
            if (args['filter-mode']       > -1)
                altTabPopup.WIN_FILTER_MODE  = args['filter-mode'];
            if (args['monitor-index']     > -1)
                altTabPopup._monitorIndex    = args['monitor-index'];
            if (args['filter-pattern']   !== null)
                altTabPopup._searchEntry     = args['filter-pattern'];
            if (!args['triggered-keyboard'])
                altTabPopup._modifierMask    = 0;
            if (args['apps']) {
                altTabPopup._switcherMode   = 1; // SwitcherModes.APPS;
                altTabPopup.SHOW_APPS       = true;
            }
            altTabPopup.connect('destroy', () => {
                altTabPopup = null;
            });
            altTabPopup.show();
            if (args['switch-ws'] !== undefined && args['switch-ws'] !== false)
                altTabPopup._switchWorkspace(args['switch-ws']);

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
                Main.layoutManager.uiGroup.remove_child(this.customMenu[menuIndex].actor);
            });
            Main.layoutManager.uiGroup.add_child(this.customMenu[menuIndex].actor);
        }
        this.customMenu[menuIndex].menuItems      = this._mscOptions.get(`customMenu${menuIndex}`);
        this.customMenu[menuIndex].actionList     = Settings.actionList;
        let focusedWin = this._getFocusedWindow() ? this._getFocusedWindow().get_title() : null;
        if (focusedWin && focusedWin.length > 40)
            focusedWin = `${focusedWin.substring(0, 40)}...`;
        this.customMenu[menuIndex].focusedWindow  = focusedWin;
        this.customMenu[menuIndex].actionTrigger  = actionTrigger;
        this.customMenu[menuIndex].removeAll();
        this.customMenu[menuIndex].buildMenu();

        Main.layoutManager.setDummyCursorGeometry(global.get_pointer()[0], global.get_pointer()[1], 0, 0);

        // Main.osdWindowManager.hideAll();
        const focusedWinItem = this.customMenu[menuIndex].windowNeeded;
        const firstItem = this.customMenu[menuIndex]._getMenuItems()[focusedWinItem ? 1 : 0];
        this.customMenu[menuIndex].open(BoxPointer.PopupAnimation.FULL);
        firstItem.active = true;
    }

    // actions 0 - PlayPause, 1 - Next, 2 - Prev
    mprisPlayerController(action = 0, playerID = 'org.mpris.MediaPlayer2') {
        const Methods = [
            'PlayPause',
            'Next',
            'Previous',
        ];
        let method = Methods[action];
        let session = Gio.DBus.session;
        session.call(
            'org.freedesktop.DBus',
            '/org/freedesktop',
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
                    if (e instanceof Gio.DBusError)
                        Gio.DBusError.strip_remote_error(e);

                    logError(e);
                }
            }
        );
    }

    _executeMprisPlayerCommand(session, player, method) {
        if (!player)
            return;
        try {
            session.call(
                player,
                '/org/mpris/MediaPlayer2',
                'org.mpris.MediaPlayer2.Player',
                method,
                null, null, Gio.DBusCallFlags.NONE, -1, null
            );
        } catch (e) {
            log(e);
        }
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

            if (item[0] === 0)
                submenu = null;
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

function _getWindows(workspace) {
    // We ignore skip-taskbar windows in switchers, but if they are attached
    // to their parent, their position in the MRU list may be more appropriate
    // than the parent; so start with the complete list ...
    let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace);
    // ... map windows to their parent where appropriate ...
    return windows.map(w => {
        return w.is_attached_dialog() ? w.get_transient_for() : w;
    // ... and filter out skip-taskbar windows and duplicates
    }).filter((w, i, a) => !w.skip_taskbar && a.indexOf(w) === i);
}

const CyclerHighlight = GObject.registerClass(
class CyclerHighlight extends St.Widget {
    _init() {
        super._init({ layout_manager: new Clutter.BinLayout() });
        this._window = null;

        this._clone = new Clutter.Clone();
        this.add_child(this._clone);

        this._highlight = new St.Widget({ style_class: 'cycler-highlight' });
        this.add_child(this._highlight);

        let coordinate = Clutter.BindCoordinate.ALL;
        let constraint = new Clutter.BindConstraint({ coordinate });
        this._clone.bind_property('source', constraint, 'source', 0);

        this.add_constraint(constraint);

        this.connect('destroy', this._onDestroy.bind(this));
    }

    set window(w) {
        if (this._window === w)
            return;

        this._window?.disconnectObject(this);

        this._window = w;

        if (this._clone.source)
            this._clone.source.sync_visibility();

        const windowActor = this._window?.get_compositor_private() ?? null;

        if (windowActor)
            windowActor.hide();

        this._clone.source = windowActor;

        if (this._window) {
            this._onSizeChanged();
            this._window.connectObject('size-changed',
                this._onSizeChanged.bind(this), this);
        } else {
            this._highlight.set_size(0, 0);
            this._highlight.hide();
        }
    }

    _onSizeChanged() {
        const bufferRect = this._window.get_buffer_rect();
        const rect = this._window.get_frame_rect();
        this._highlight.set_size(rect.width, rect.height);
        this._highlight.set_position(
            rect.x - bufferRect.x,
            rect.y - bufferRect.y);
        this._highlight.show();
    }

    _onDestroy() {
        this.window = null;
    }
});

const OsdMonitorLabel = GObject.registerClass(
class OsdMonitorLabel extends St.Widget {
    _init(monitor, label) {
        super._init({ x_expand: true, y_expand: true });

        this._monitor = monitor;

        this._box = new St.BoxLayout({
            vertical: true,
        });
        this.add_child(this._box);

        this._label = new St.Label({
            style_class: 'osd-monitor-label',
            text: label,
        });
        this._box.add_child(this._label);

        Main.uiGroup.add_child(this);
        Main.uiGroup.set_child_above_sibling(this, null);
        this._position();

        if (Meta.disable_unredirect_for_display)
            Meta.disable_unredirect_for_display(global.display);
        else // since GS 48
            global.compositor.disable_unredirect();
        this.connect('destroy', () => {
            if (Meta.enable_unredirect_for_display)
                Meta.enable_unredirect_for_display(global.display);
            else // since GS 48
                global.compositor.enable_unredirect();
        });
    }

    _position() {
        let workArea = Main.layoutManager.getWorkAreaForMonitor(this._monitor);

        if (Clutter.get_default_text_direction() === Clutter.TextDirection.RTL)
            this._box.x = workArea.x + (workArea.width - this._box.width);
        else
            this._box.x = workArea.x;

        this._box.y = workArea.y;
    }
});
