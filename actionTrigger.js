'use strict';

const { Clutter, Meta } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Actions        = Me.imports.actions;
const Settings       = Me.imports.settings;
const Keybindings    = Me.imports.keybindings;


var ActionTrigger = class ActionTrigger {
    constructor(mscOptions) {
        this.actions = new Actions.Actions(mscOptions);
        this._mscOptions = mscOptions;
        this._gsettingsKB = mscOptions._gsettings;
        this.runActionData = {
            action: null,
            monitorIndex: 0,
            workspaceIndex: 0,
            command: null,
            keyboard: false
        }
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
        this._bindShortcuts();

        this._keybindingsManager;
    }

    clean(full = true) {
        this._removeShortcuts();
        this._disconnectSettingsKB();
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
        const keybindings = {};
        const shortcuts = this._mscOptions._gsettings.get_strv('keyboard-shortcuts');
        const settingsKB = this._mscOptions._loadSettings('shortcuts');

        // transition code from separately stored shortcuts to single gsetting key
        // should be removed in the next version
        // copy all separately stored shortcuts to the new key if it's empty
        const internalFlags = this._mscOptions._gsettings.get_strv('internal-flags');
        if (settingsKB && !internalFlags.includes('shortcuts-moved')) {
            if (!shortcuts.length && settingsKB && settingsKB.list_keys().length) {
                for (let key of settingsKB.list_keys()) {
                    const action = key.replace(/-ce$/, '');
                    const accelerator = settingsKB.get_strv(key)[0];
                    if (accelerator)
                        keybindings[action] = accelerator;
                }
                const list = [];
                Object.keys(keybindings).forEach(s => {
                    list.push(`${s}→${keybindings[s]}`);
                });
                if (list.length)
                    this._mscOptions._gsettings.set_strv('keyboard-shortcuts', list);
            }
            internalFlags.push('shortcuts-moved');
            this._mscOptions._gsettings.set_strv('internal-flags', internalFlags);
        }
        // end of transition code

        const list = this._mscOptions._gsettings.get_strv('keyboard-shortcuts');
        if (!list.length)
            return;

        const manager = this._getKeybindingsManager();
        list.forEach(sc => {
            const [action, accelerator] = sc.split('→');
            const callback = () => {
                this._runKeyAction(action);
            };
            manager.add(accelerator, action, callback);
        });

        if (!this._gsettingsKBid)
            this._gsettingsKBid = this._gsettingsKB.connect('changed::keyboard-shortcuts', this._updateKeyBinding.bind(this));
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
        if (this._keybindingsManager) {
            this._keybindingsManager.removeAll();
        }
    }

    _disconnectSettingsKB() {
        this._gsettingsKB.disconnect(this._gsettingsKBid);
    }

    // translates key to action function
    _translateActionToFunction(key) {
        let regex = /-(.)/g;
        return key.replace(regex, function ($0, $1) {
            return $0.replace($0, $1.toUpperCase());
        });
    }

    _toggleOverview() {
        this.actions.toggleOverview();
    }

    _showApplications() {
        this.actions.showApplications();
    }

    _showDesktop() {
        this.actions.togleShowDesktop();
    }

    _showDesktopMon() {
        this.actions.togleShowDesktop(global.display.get_current_monitor());
    }

    _blackScreen() {
        let opacity = 255;
        let note = Me.metadata.name;
        this.actions.toggleDimmMonitors(
            opacity,
            note
        );
    }

    _blackScreenMon() {
        let opacity = 255;
        let note = Me.metadata.name;
        this.actions.toggleDimmMonitors(
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

    _prevWorkspace() {
        this.actions.switchWorkspace(Meta.MotionDirection.UP);
    }

    _nextWorkspace() {
        this.actions.switchWorkspace(Meta.MotionDirection.DOWN);
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

    _recentWin() {
        this.actions.switchToRecentWindow();
    }

    _getShortcut(key) {
        /*let settings = Settings.getSettings(
            'org.gnome.shell.extensions.custom-hot-corners-extended.shortcuts',
            '/org/gnome/shell/extensions/custom-hot-corners-extended/shortcuts/');
        return settings.get_strv(key).toString();*/
        const sc = this._keybindingsManager._keybindings[key];
        return sc ? sc : null;
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
            'switch-ws':          Clutter.ScrollDirection.UP,
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
            'switch-ws':          Clutter.ScrollDirection.DOWN,
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

    _lockScreen() {
        this.actions.lockScreen();
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

    _prefs() {
        this.actions.openPreferences();
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
            new Clutter.Color({
                red:    255,
                green:  200,
                blue:   146,
            }),
            true);
    }

    _tintRedToggleAll() {
        this.actions.toggleColorTintEffect(
            new Clutter.Color({
                red:    255,
                green:  200,
                blue:   146,
            }),
            false);
    }

    _tintGreenToggleWin() {
        this.actions.toggleColorTintEffect(
            new Clutter.Color({
                red:    200,
                green:  255,
                blue:   146,
            }),
            true);
    }

    _tintGreenToggleAll() {
        this.actions.toggleColorTintEffect(
            new Clutter.Color({
                red:    200,
                green:  255,
                blue:   146,
            }),
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
        this.actions.makeThumbnailWindow();
        this.actions.minimizeWindow();
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
            Main.notify(Me.metadata.name, `Error: ArcMenu trigger not available...`);
    }

    _mprisPlayPause() {
        this.actions.mprisPlayerControler(0);
    }

    _mprisNext() {
        this.actions.mprisPlayerControler(1);
    }

    _mprisPrev() {
        this.actions.mprisPlayerControler(2);
    }

    _moveWinToPrevWs() {
        this.actions.moveWinToAdjacentWs(Clutter.ScrollDirection.UP);
    }

    _moveWinToNextWs() {
        this.actions.moveWinToAdjacentWs(Clutter.ScrollDirection.DOWN);
    }

    _moveWinToPrevNewWs() {
        this.actions.moveWinToNewWs(Clutter.ScrollDirection.UP);
    }

    _moveWinToNextNewWs() {
        this.actions.moveWinToNewWs(Clutter.ScrollDirection.DOWN);
    }

    _moveAppToPrevWs() {
        this.actions.moveWinToAdjacentWs(Clutter.ScrollDirection.UP, this.actions._getWindowsOfFocusedAppOnActiveWs());
    }

    _moveAppToNextWs() {
        this.actions.moveWinToAdjacentWs(Clutter.ScrollDirection.DOWN, this.actions._getWindowsOfFocusedAppOnActiveWs());
    }

    _moveAppToPrevNewWs() {
        this.actions.moveWinToNewWs(Clutter.ScrollDirection.UP, this.actions._getWindowsOfFocusedAppOnActiveWs());
    }

    _moveAppToNextNewWs() {
        this.actions.moveWinToNewWs(Clutter.ScrollDirection.DOWN, this.actions._getWindowsOfFocusedAppOnActiveWs());
    }

    _displayBrightnessUp() {
        this.actions.setDisplayBrightness(Clutter.ScrollDirection.UP);
    }

    _displayBrightnessDown() {
        this.actions.setDisplayBrightness(Clutter.ScrollDirection.DOWN);
    }
};