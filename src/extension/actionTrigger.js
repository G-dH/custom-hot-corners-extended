/**
 * Custom Hot Corners - Extended
 * ActionTrigger
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Settings from '../common/settings.js';
import * as Actions from './actions.js';
import * as Keybindings from './keybindings.js';

// Cogl.Color replaces Clutter.Color in GS 47
const Color = Clutter.Color ? Clutter.Color : Cogl.Color;

// gettext
let _;
let Me;

export function init(extension) {
    _ = extension.gettext.bind(extension);
    Me = extension;
}

export function cleanGlobals() {
    _ = null;
    Me = null;
}

export const ActionTrigger = class ActionTrigger {
    constructor(mscOptions) {
        this.actions = new Actions.Actions(mscOptions);
        this._mscOptions = mscOptions;
        this.runActionData = {
            action: null,
            monitorIndex: 0,
            workspaceIndex: 0,
            command: null,
            keyboard: false,
        };
        this.m = new Map();
        let actionList = Settings.actionList;

        for (let action of actionList) {
            if (action[1] !== '') {
                let func = this[`_${this._translateActionToFunction(action[1])}`];
                this.m.set(action[1], func);
            }
        }
        this._shortcutsBindingIds = [];
        this._gsettingsKBid = 0;
    }

    clean(full = true) {
        this._removeShortcuts();
        // gsettingsKB signal is removed by mscOptions.destroy()
        this._gsettingsKBid = 0;

        if (this._keybindingsManager) {
            this._keybindingsManager.destroy();
            this._keybindingsManager = null;
        }
        if (full) {
            this.actions.clean(true);
            this.actions = null;
        } else {
            this.actions.clean(false);
        }
    }

    _getKeybindingsManager() {
        if (!this._keybindingsManager)
            this._keybindingsManager = new Keybindings.Manager();
        return this._keybindingsManager;
    }

    _bindShortcuts() {
        if (!this._gsettingsKBid)
            this._gsettingsKBid = this._mscOptions.connect('changed::keyboard-shortcuts', this._updateKeyBinding.bind(this));

        const list = this._mscOptions.get('keyboardShortcuts');
        if (!list.length)
            return;

        const manager = this._getKeybindingsManager();
        list.forEach(sc => {
            // action, accelerator pairs are separated by a space
            // todo - data validation to avoid errors
            const [action, accelerator] = sc.split(' ');
            const callback = () => {
                this._runKeyAction(action);
            };
            manager.add(accelerator, action, callback);
        });
    }

    runAction(actionData = null) {
        const runActionData = actionData ? actionData : this.runActionData;
        const action = runActionData.action;
        const actionFunction = this.m.get(action).bind(this);
        if (actionFunction) {
            actionFunction();
            return true;
        } else {
            return false;
        }
    }

    _runKeyAction(action) {
        // notify the trigger that the action was invoked by the keyboard
        this.runActionData.action = action;
        this.runActionData.keyboard = true;
        this.runAction();
    }

    _updateKeyBinding() {
        const manager = this._getKeybindingsManager();
        manager.removeAll();
        this._bindShortcuts();
    }

    _removeShortcuts() {
        if (this._keybindingsManager)
            this._keybindingsManager.removeAll();
    }

    // translates key to action function
    _translateActionToFunction(key) {
        let regex = /-(.)/g;
        return key.replace(regex, ($0, $1) => {
            return $0.replace($0, $1.toUpperCase());
        });
    }

    _toggleOverview() {
        this.actions.toggleOverview(true);
    }

    _showOverview() {
        this.actions.toggleOverview();
    }

    _toggleApplications() {
        this.actions.showApplications(true);
    }

    _showApplications() {
        this.actions.showApplications();
    }

    _toggleOverviewApp() {
        this.actions.toggleOverviewAppWindows();
    }

    _showDesktop() {
        this.actions.toggleShowDesktop();
    }

    _showDesktopMon() {
        this.actions.toggleShowDesktop(global.display.get_current_monitor());
    }

    _blackScreen() {
        let opacity = 255;
        let note = Me.metadata.name;
        this.actions.toggleDimMonitors(
            opacity,
            note
        );
    }

    _blackScreenMon() {
        let opacity = 255;
        let note = Me.metadata.name;
        this.actions.toggleDimMonitors(
            opacity,
            note,
            global.display.get_current_monitor()
        );
    }

    _runCommand() {
        this.actions.runCommand(this.runActionData.command);
    }

    _runPrompt() {
        this.actions.openRunDialog();
    }

    _moveToWorkspace() {
        this.actions.moveToWorkspace(this.runActionData.workspaceIndex - 1);
    }

    _moveToSecondLastWs() {
        this.actions.moveToWorkspace(global.workspaceManager.get_n_workspaces() - 2);
    }

    _prevWorkspace() {
        this.actions.switchWorkspace(Meta.MotionDirection.UP);
    }

    _nextWorkspace() {
        this.actions.switchWorkspace(Meta.MotionDirection.DOWN);
    }

    _prevWorkspaceCurrentMon() {
        this.actions.switchWorkspaceCurrentMonitor(Meta.MotionDirection.UP);
    }

    _nextWorkspaceCurrentMon() {
        this.actions.switchWorkspaceCurrentMonitor(Meta.MotionDirection.DOWN);
    }

    _prevWorkspaceOverview() {
        this.actions.switchWorkspace(Meta.MotionDirection.UP);
        Main.overview.dash.showAppsButton.checked = false;
        Main.overview.show();
    }

    _nextWorkspaceOverview() {
        this.actions.switchWorkspace(Meta.MotionDirection.DOWN);
        Main.overview.dash.showAppsButton.checked = false;
        Main.overview.show();
    }

    _recentWorkspace() {
        this.actions.moveToRecentWorkspace();
    }

    _reorderWsPrev() {
        this.actions.reorderWorkspace(-1);
    }

    _reorderWsNext() {
        this.actions.reorderWorkspace(+1);
    }

    _rotateWsPrevMon() {
        this.actions.rotateWorkspaces(Meta.MotionDirection.UP);
    }

    _rotateWsNextMon() {
        this.actions.rotateWorkspaces(Meta.MotionDirection.DOWN);
    }

    _closeWorkspace() {
        this.actions.closeWorkspace();
    }

    _prevWinAll() {
        this.actions.switchWindow(-1, false, -1);
    }

    _nextWinAll() {
        this.actions.switchWindow(+1, false, -1);
    }

    _prevWinWs() {
        this.actions.switchWindow(-1, true, -1);
    }

    _nextWinWs() {
        this.actions.switchWindow(+1, true, -1);
    }

    _prevWinMon() {
        this.actions.switchWindow(-1, true, global.display.get_current_monitor());
    }

    _nextWinMon() {
        this.actions.switchWindow(+1, true, global.display.get_current_monitor());
    }

    // ------------------------------------
    _prevWinAllApp() {
        this.actions.switchWindow(-1, false, -1, true);
    }

    _nextWinAllApp() {
        this.actions.switchWindow(+1, false, -1, true);
    }

    // -------------------------------------
    _recentWin() {
        this.actions.switchToRecentWindow();
    }

    _getShortcut(action) {
        const settings = Me.getSettings('org.gnome.shell.extensions.custom-hot-corners-extended.misc');
        const shortcuts = settings.get_strv('keyboard-shortcuts');
        const scIndex = shortcuts.findIndex(s => s.includes(`${action} `));
        let sc = null;
        if (scIndex > -1)
            sc = shortcuts[scIndex].split(' ')[1].replace(/<.+>/, '');

        return sc;
    }

    _winSwitcherPopupAll() {
        // arguments: monitor-index        = -1/index
        //            position-pointer     = null-> gsettings/true/false,
        //            filter-mode          = 1 - all windows, 2 - current ws, 3 - current monitor
        //            group-mode           = 0 -> default, 1 - None, 2 - currentMonFirst, 3 - Apps, 4 - Workspaces
        //            timeout              = int (ms)
        //            triggered-keyboard   = true/false
        //            shortcut             = null/shortcut from gsettings to string
        //            filter-focused-app   = true/false
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-all'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupWs() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        2,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-ws'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupMon() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        3,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-mon'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupApps() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         3,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-apps'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupClass() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-class'),
            'filter-focused-app': true,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupWsFirst() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         2,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-ws-first'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _prevWorkspacePopup() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   false,
            'filter-mode':        2,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           null,
            'filter-focused-app': false,
            'filter-pattern':     null,
            'switch-ws':          Meta.MotionDirection.UP,
        });
    }

    _nextWorkspacePopup() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   false,
            'filter-mode':        2,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           null,
            'filter-focused-app': false,
            'filter-pattern':     null,
            'switch-ws':          Meta.MotionDirection.DOWN,
        });
    }

    _winSwitcherPopupSearch() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-all'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _appSwitcherPopupAll() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           this._getShortcut('app-switcher-popup-all'),
            'filter-focused-app': false,
            'filter-pattern':     null,
            'apps':               true,
        });
    }

    _appSwitcherPopupWs() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        2,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           this._getShortcut('app-switcher-popup-ws'),
            'filter-focused-app': false,
            'filter-pattern':     null,
            'apps':               true,
        });
    }

    _appSwitcherPopupMon() {
        this.actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        3,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this.runActionData.keyboard,
            'shortcut':           this._getShortcut('app-switcher-popup-mon'),
            'filter-focused-app': false,
            'filter-pattern':     null,
            'apps':               true,
        });
    }

    _closeWin() {
        this.actions.closeWindow();
    }

    _quitApp() {
        this.actions.quitApplication();
    }

    _killApp() {
        this.actions.killApplication();
    }

    _maximizeWin() {
        this.actions.toggleMaximizeWindow();
    }

    _minimizeWin() {
        this.actions.minimizeWindow();
    }

    _fullscreenOnEmptyWs() {
        this.actions.fullscreenWinOnEmptyWs();
    }

    _unminimizeAllWs() {
        this.actions.unminimizeAll(true);
    }

    _unminimizeAll() {
        this.actions.unminimizeAll(false);
    }

    _fullscreenWin() {
        this.actions.toggleFullscreenWindow();
    }

    _aboveWin() {
        this.actions.toggleAboveWindow();
    }

    _stickWin() {
        this.actions.toggleStickWindow();
    }

    _openNewWindow() {
        this.actions.openNewWindow();
    }

    _restartShell() {
        this.actions.restartGnomeShell();
    }

    _volumeUp() {
        this.actions.adjustVolume(1);
    }

    _volumeDown() {
        this.actions.adjustVolume(-1);
    }

    _muteSound() {
        this.actions.adjustVolume(0);
    }

    _showScreenshotUi() {
        this.actions.showScreenshotUi();
    }

    _lockScreen() {
        this.actions.lockScreen();
    }

    _screensaver() {
        this.actions.screensaver();
    }

    _suspend() {
        this.actions.suspendToRam();
    }

    _powerOff() {
        this.actions.powerOff();
    }

    _logOut() {
        this.actions.logOut();
    }

    _switchUser() {
        this.actions.switchUser();
    }

    _lookingGlass() {
        this.actions.toggleLookingGlass();
    }

    _lgInspector() {
        this.actions.activateUiInspector();
    }

    _swipeWsUp() {
        this.actions.touchSwipeSimulator(-1, true);
    }

    _swipeWsDown() {
        this.actions.touchSwipeSimulator(1, true);
    }

    _swipeOverviewUp() {
        this.actions.touchSwipeSimulator(-1, false);
    }

    _swipeOverviewDown() {
        this.actions.touchSwipeSimulator(1, false);
    }

    _prefs() {
        this.actions.openPreferences();
    }

    _hotCornersRequireShift() {
        const key = 'hotCornersRequireShift';
        const state = this._mscOptions.get(key);
        this._mscOptions.set(key, !state);
        Main.notify(Me.metadata.name, _(`Option 'Hot Corners Require Shift' ${state ? 'disabled' : 'enabled'}`));
    }

    _updateHotCorners() {
        Main.layoutManager._updateHotCorners();
        Main.notify(Me.metadata.name, _('Hot corners were updated.'));
    }

    _toggleZoom() {
        this.actions.zoom(0);
    }

    _zoomIn() {
        this.actions.zoom(0.25);
    }

    _zoomOut() {
        this.actions.zoom(-0.25);
    }

    _keyboard() {
        this.actions.toggleKeyboard(global.display.get_current_monitor());
    }

    _screenReader() {
        this.actions.toggleScreenReader();
    }

    _largeText() {
        this.actions.toggleLargeText();
    }

    _hidePanel() {
        this.actions.toggleShowPanel();
    }

    _openPanelSystemMenu() {
        this.actions.openPanelSystemMenu();
    }

    _openPanelDateMenu() {
        this.actions.openPanelDateMenu();
    }

    _toggleTheme() {
        this.actions.toggleTheme();
    }

    _invertLightAll() {
        this.actions.toggleLightnessInvertEffect(false, false);
    }

    _invertLightWin() {
        this.actions.toggleLightnessInvertEffect(true, false);
    }

    _invertLightShiftAll() {
        this.actions.toggleLightnessInvertEffect(false, true);
    }

    _invertLightShiftWin() {
        this.actions.toggleLightnessInvertEffect(true, true);
    }

    _invertColorsWin() {
        this.actions.toggleColorsInvertEffect(true);
    }

    _protanToggle() {
        this.actions.toggleColorBlindShaderEffect(true, 1, false);
    }

    _deuterToggle() {
        this.actions.toggleColorBlindShaderEffect(true, 2, false);
    }

    _tritanToggle() {
        this.actions.toggleColorBlindShaderEffect(true, 3, false);
    }

    _protanSimToggle() {
        this.actions.toggleColorBlindShaderEffect(true, 1, true);
    }

    _deuterSimToggle() {
        this.actions.toggleColorBlindShaderEffect(true, 2, true);
    }

    _tritanSimToggle() {
        this.actions.toggleColorBlindShaderEffect(true, 3, true);
    }

    _mixerGbrToggle() {
        this.actions.toggleColorMixerEffect(true, 1);
    }

    _desaturateAll() {
        this.actions.toggleDesaturateEffect(false);
    }

    _desaturateWin() {
        this.actions.toggleDesaturateEffect(true);
    }

    _brightUpAll() {
        this.actions.adjustSwBrightnessContrast(+0.025);
    }

    _brightDownAll() {
        this.actions.adjustSwBrightnessContrast(-0.025);
    }

    _brightUpWin() {
        this.actions.adjustSwBrightnessContrast(+0.025, true);
    }

    _brightDownWin() {
        this.actions.adjustSwBrightnessContrast(-0.025, true);
    }

    _contrastUpAll() {
        this.actions.adjustSwBrightnessContrast(+0.025, false, false);
    }

    _contrastDownAll() {
        this.actions.adjustSwBrightnessContrast(-0.025, false, false);
    }

    _contrastUpWin() {
        this.actions.adjustSwBrightnessContrast(+0.025, true, false);
    }

    _contrastDownWin() {
        this.actions.adjustSwBrightnessContrast(-0.025, true, false);
    }

    _contrastHighWin() {
        this.actions.adjustSwBrightnessContrast(null, true, false, 0.1);
    }

    _contrastHighAll() {
        this.actions.adjustSwBrightnessContrast(null, false, false, 0.1);
    }

    _contrastLowWin() {
        this.actions.adjustSwBrightnessContrast(null, true, false, -0.1);
    }

    _contrastLowAll() {
        this.actions.adjustSwBrightnessContrast(null, false, false, -0.1);
    }

    _opacityUpWin() {
        this.actions.adjustWindowOpacity(+12);
    }

    _opacityDownWin() {
        this.actions.adjustWindowOpacity(-12);
    }

    _opacityToggleWin() {
        this.actions.adjustWindowOpacity(0, 200);
    }

    _opacityToggleHcWin() {
        this.actions.adjustWindowOpacity(0, 200);
        this.actions.adjustSwBrightnessContrast(null, true, false, 0.2);
    }

    _opacityToggleLcWin() {
        this.actions.adjustWindowOpacity(0, 240);
        this.actions.adjustSwBrightnessContrast(null, true, false, 0.05);
    }

    _nightLightToggle() {
        this.actions.toggleNightLight();
    }

    _tintRedToggleWin() {
        this.actions.toggleColorTintEffect(
            new Color({
                red:    255,
                green:  200,
                blue:   146,
            }),
            true);
    }

    _tintRedToggleAll() {
        this.actions.toggleColorTintEffect(
            new Color({
                red:    255,
                green:  200,
                blue:   146,
            }),
            false);
    }

    _tintGreenToggleWin() {
        this.actions.toggleColorTintEffect(
            new Color({
                red:    200,
                green:  255,
                blue:   146,
            }),
            true);
    }

    _tintGreenToggleAll() {
        this.actions.toggleColorTintEffect(
            new Color({
                red:    200,
                green:  255,
                blue:   146,
            }),
            false);
    }

    _tintCustomToggleWin() {
        this.actions.toggleColorTintEffect(
            null,
            true);
    }

    _tintCustomToggleAll() {
        this.actions.toggleColorTintEffect(
            null,
            false);
    }

    _removeEffectsWin() {
        this.actions.removeWinEffects(true);
    }

    _removeEffectsAll() {
        this.actions.removeAllEffects(true);
    }

    _makeThumbnailWin() {
        this.actions.makeThumbnailWindow();
    }

    _minimizeToThumbnail() {
        const metaWindow = null;
        const minimize = true;
        this.actions.makeThumbnailWindow(metaWindow, minimize);
    }

    _removeWinThumbnails() {
        this.actions._removeThumbnails(true);
    }

    _showCustomMenu1() {
        this.actions.showCustomMenu(this, 1);
    }

    _showCustomMenu2() {
        this.actions.showCustomMenu(this, 2);
    }

    _showCustomMenu3() {
        this.actions.showCustomMenu(this, 3);
    }

    _showCustomMenu4() {
        this.actions.showCustomMenu(this, 4);
    }

    _toggleArcmenu() {
        if (global.toggleArcMenu)
            global.toggleArcMenu();
        else
            Main.notify(Me.metadata.name, _('Error: ArcMenu trigger not available...'));
    }

    _mprisPlayPause() {
        this.actions.mprisPlayerController(0);
    }

    _mprisNext() {
        this.actions.mprisPlayerController(1);
    }

    _mprisPrev() {
        this.actions.mprisPlayerController(2);
    }

    _mprisPlayPauseSpotify() {
        this.actions.mprisPlayerController(0, 'org.mpris.MediaPlayer2.spotify');
    }

    _mprisNextSpotify() {
        this.actions.mprisPlayerController(1, 'org.mpris.MediaPlayer2.spotify');
    }

    _mprisPrevSpotify() {
        this.actions.mprisPlayerController(2, 'org.mpris.MediaPlayer2.spotify');
    }

    _mprisPlayPauseFirefox() {
        this.actions.mprisPlayerController(0, 'org.mpris.MediaPlayer2.firefox');
    }

    _mprisNextFirefox() {
        this.actions.mprisPlayerController(1, 'org.mpris.MediaPlayer2.firefox');
    }

    _mprisPrevFirefox() {
        this.actions.mprisPlayerController(2, 'org.mpris.MediaPlayer2.firefox');
    }

    _moveWinToPrevWs() {
        this.actions.moveWinToAdjacentWs(Meta.MotionDirection.UP);
    }

    _moveWinToNextWs() {
        this.actions.moveWinToAdjacentWs(Meta.MotionDirection.DOWN);
    }

    _moveWinToPrevNewWs() {
        this.actions.moveWinToNewWs(Meta.MotionDirection.UP);
    }

    _moveWinToNextNewWs() {
        this.actions.moveWinToNewWs(Meta.MotionDirection.DOWN);
    }

    _moveAppToPrevWs() {
        this.actions.moveWinToAdjacentWs(Meta.MotionDirection.UP, this.actions._getWindowsOfFocusedAppOnActiveWs());
    }

    _moveAppToNextWs() {
        this.actions.moveWinToAdjacentWs(Meta.MotionDirection.DOWN, this.actions._getWindowsOfFocusedAppOnActiveWs());
    }

    _moveAppToPrevNewWs() {
        this.actions.moveWinToNewWs(Meta.MotionDirection.UP, this.actions._getWindowsOfFocusedAppOnActiveWs());
    }

    _moveAppToNextNewWs() {
        this.actions.moveWinToNewWs(Meta.MotionDirection.DOWN, this.actions._getWindowsOfFocusedAppOnActiveWs());
    }

    _moveWinToNextMonitor() {
        this.actions.moveWinToNextMonitor();
    }

    _displayBrightnessUp() {
        this.actions.setDisplayBrightness(Meta.MotionDirection.UP);
    }

    _displayBrightnessDown() {
        this.actions.setDisplayBrightness(Meta.MotionDirection.DOWN);
    }

    _searchOpenWindows() {
        this.actions.searchOpenWindows();
    }
};
