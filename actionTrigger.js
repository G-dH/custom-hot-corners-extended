'use strict';

const { Clutter } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Actions        = Me.imports.actions;
const Settings       = Me.imports.settings;
const Keybindings    = Me.imports.keybindings;

// let LOG = print;
function LOG() {}

const ActionTrigger = class ActionTrigger {
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
        print('binding shortcuts');
        let keybindings = {};
        let shortcuts = this._mscOptions._gsettings.get_strv('keyboard-shortcuts');

        // transition code from separately stored shortcuts to single gsetting key
        // should be removed in the next version
        // copy all separately stored shortcuts to the new key if it's empty
        const internalFlags = this._mscOptions._gsettings.get_strv('internal-flags');
        if (!internalFlags.includes('shortcuts-moved')) {
            const settingsKB = this._mscOptions._loadSettings('shortcuts');
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
            let [action, accelerator] = sc.split('→');
            let callback = () => {
                this._runKeyAction(action);
            };
            manager.add(accelerator, action, callback);
        });

        if (!this._gsettingsKBid)
            this._gsettingsKBid = this._gsettingsKB.connect('changed::keyboard-shortcuts', this._updateKeyBinding.bind(this));
    }

    runAction() {
        const action = this.runActionData.action;
        let actionFunction = this.m.get(action).bind(this);
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
        print('updating');
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

    _translateKeyToAction(key) {
        let regex = /-ce$/;
        return key.replace(regex, '');
    }

    _toggleOverview() {
        LOG(`[${Me.metadata.name}]   _toggleOverview`);
        this.actions.toggleOverview();
    }

    _showApplications() {
        LOG(`[${Me.metadata.name}]   _showAppGrid`);
        this.actions.showApplications();
    }

    _showDesktop() {
        LOG(`[${Me.metadata.name}]   _showDesktop`);
        this.actions.togleShowDesktop();
    }

    _showDesktopMon() {
        LOG(`[${Me.metadata.name}]   _showDesktopMonitor`);
        this.actions.togleShowDesktop(global.display.get_current_monitor());
    }

    _blackScreen() {
        LOG(`[${Me.metadata.name}]   _toggleBlackScreen`);
        let opacity = 255;
        let note = Me.metadata.name;
        this.actions.toggleDimmMonitors(
            opacity,
            note
        );
    }

    _blackScreenMon() {
        LOG(`[${Me.metadata.name}]   _toggleBlackScreenMonitor`);
        let opacity = 255;
        let note = Me.metadata.name;
        this.actions.toggleDimmMonitors(
            opacity,
            note,
            global.display.get_current_monitor()
        );
    }

    _runCommand() {
        LOG(`[${Me.metadata.name}]   _runCommand`);
        this.actions.runCommand(this.runActionData.command);
    }

    _runPrompt() {
        LOG(`[${Me.metadata.name}]   _runPrompt`);
        this.actions.openRunDialog();
    }

    _moveToWorkspace() {
        LOG(`[${Me.metadata.name}]   _moveToWorkspace`);
        this.actions.moveToWorkspace(this.runActionData.workspaceIndex - 1);
    }

    _prevWorkspace() {
        LOG(`[${Me.metadata.name}]   _prevWorkspace`);
        this.actions.switchWorkspace(Clutter.ScrollDirection.UP);
    }

    _nextWorkspace() {
        LOG(`[${Me.metadata.name}]   _nextWorkspace`);
        this.actions.switchWorkspace(Clutter.ScrollDirection.DOWN);
    }

    _prevWorkspaceOverview() {
        LOG(`[${Me.metadata.name}]   _prevWorkspace`);
        this.actions.switchWorkspace(Clutter.ScrollDirection.UP);
        Main.overview.dash.showAppsButton.checked = false;
        Main.overview.show();
    }

    _nextWorkspaceOverview() {
        LOG(`[${Me.metadata.name}]   _nextWorkspace`);
        this.actions.switchWorkspace(Clutter.ScrollDirection.DOWN);
        Main.overview.dash.showAppsButton.checked = false;
        Main.overview.show();
    }

    _recentWorkspace() {
        LOG(`[${Me.metadata.name}]   _moveToRecentWorkspace`);
        this.actions.moveToRecentWorkspace();
    }

    _reorderWsPrev() {
        this.actions.reorderWorkspace(-1);
    }

    _reorderWsNext() {
        this.actions.reorderWorkspace(+1);
    }

    _prevWinAll() {
        LOG(`[${Me.metadata.name}]   _prevWindow`);
        this.actions.switchWindow(-1, false, -1);
    }

    _nextWinAll() {
        LOG(`[${Me.metadata.name}]   _nextWindow`);
        this.actions.switchWindow(+1, false, -1);
    }

    _prevWinWs() {
        LOG(`[${Me.metadata.name}]   _prevWindowWS`);
        this.actions.switchWindow(-1, true, -1);
    }

    _nextWinWs() {
        LOG(`[${Me.metadata.name}]   _nextWindowWS`);
        this.actions.switchWindow(+1, true, -1);
    }

    _prevWinMon() {
        LOG(`[${Me.metadata.name}]   _prevWinMonitor`);
        this.actions.switchWindow(-1, true, global.display.get_current_monitor());
    }

    _nextWinMon() {
        LOG(`[${Me.metadata.name}]   _nextWinMonitor`);
        this.actions.switchWindow(+1, true, global.display.get_current_monitor());
    }

    _recentWin() {
        LOG(`[${Me.metadata.name}]   _recentWindow`);
        this.actions.switchToRecentWindow();
    }

    _getShortcut(key) {
        let settings = Settings.getSettings(
            'org.gnome.shell.extensions.custom-hot-corners-extended.shortcuts',
            '/org/gnome/shell/extensions/custom-hot-corners-extended/shortcuts/');
        return settings.get_strv(key).toString();
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
            'shortcut':           this._getShortcut('win-switcher-popup-all-ce'),
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
            'shortcut':           this._getShortcut('win-switcher-popup-ws-ce'),
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
            'shortcut':           this._getShortcut('win-switcher-popup-mon-ce'),
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
            'shortcut':           this._getShortcut('win-switcher-popup-apps-ce'),
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
            'shortcut':           this._getShortcut('win-switcher-popup-class-ce'),
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
            'shortcut':           this._getShortcut('win-switcher-popup-ws-first-ce'),
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
            'shortcut':           this._getShortcut('win-switcher-popup-all-ce'),
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
            'shortcut':           this._getShortcut('app-switcher-popup-all-ce'),
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
            'shortcut':           this._getShortcut('app-switcher-popup-ws-ce'),
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
            'shortcut':           this._getShortcut('app-switcher-popup-mon-ce'),
            'filter-focused-app': false,
            'filter-pattern':     null,
            'apps':               true,
        });
    }

    _closeWin() {
        LOG(`[${Me.metadata.name}]   _closeWindow`);
        this.actions.closeWindow();
    }

    _quitApp() {
        LOG(`[${Me.metadata.name}]   _quitApp`);
        this.actions.quitApplication();
    }

    _killApp() {
        LOG(`[${Me.metadata.name}]   _killApp`);
        this.actions.killApplication();
    }

    _maximizeWin() {
        LOG(`[${Me.metadata.name}]   _maximizeWindow`);
        this.actions.toggleMaximizeWindow();
    }

    _minimizeWin() {
        LOG(`[${Me.metadata.name}]   _minimizeWindow`);
        this.actions.minimizeWindow();
    }

    _fullscreenOnEmptyWs() {
        this.actions.fullscreenWinOnEmptyWs();
    }

    _unminimizeAllWs() {
        this.actions.unminimizeAll(true);
    }

    _fullscreenWin() {
        LOG(`[${Me.metadata.name}]   _maximizeWindow`);
        this.actions.toggleFullscreenWindow();
    }

    _aboveWin() {
        LOG(`[${Me.metadata.name}]   _aboveWindow`);
        this.actions.toggleAboveWindow();
    }

    _stickWin() {
        LOG(`[${Me.metadata.name}]   _stickWindow`);
        this.actions.toggleStickWindow();
    }

    _openNewWindow() {
        this.actions.openNewWindow();
    }

    _restartShell() {
        LOG(`[${Me.metadata.name}]   _restartGnomeShell`);
        this.actions.restartGnomeShell();
    }

    _volumeUp() {
        LOG(`[${Me.metadata.name}]   _volumeUp`);
        this.actions.adjustVolume(1);
    }

    _volumeDown() {
        LOG(`[${Me.metadata.name}]   _volumeDown`);
        this.actions.adjustVolume(-1);
    }

    _muteSound() {
        LOG(`[${Me.metadata.name}]   _mute`);
        this.actions.adjustVolume(0);
    }

    _lockScreen() {
        LOG(`[${Me.metadata.name}]   _lockScreen`);
        this.actions.lockScreen();
    }

    _suspend() {
        LOG(`[${Me.metadata.name}]   _suspendToRam`);
        this.actions.suspendToRam();
    }

    _powerOff() {
        LOG(`[${Me.metadata.name}]   _powerOff`);
        this.actions.powerOff();
    }

    _logOut() {
        LOG(`[${Me.metadata.name}]   _logOut`);
        this.actions.logOut();
    }

    _switchUser() {
        LOG(`[${Me.metadata.name}]   _switchUser`);
        this.actions.switchUser();
    }

    _lookingGlass() {
        LOG(`[${Me.metadata.name}]   _toggleLookingGlass`);
        this.actions.toggleLookingGlass();
    }

    _prefs() {
        this.actions.openPreferences();
    }

    _toggleZoom() {
        LOG(`[${Me.metadata.name}]   _toggleZoom`);
        this.actions.zoom(0);
    }

    _zoomIn() {
        LOG(`[${Me.metadata.name}]   _zoomIn`);
        this.actions.zoom(0.25);
    }

    _zoomOut() {
        LOG(`[${Me.metadata.name}]   _zoomOut`);
        this.actions.zoom(-0.25);
    }

    _keyboard() {
        LOG(`[${Me.metadata.name}]   _toggleKeyboard`);
        this.actions.toggleKeyboard(global.display.get_current_monitor());
    }

    _screenReader() {
        LOG(`[${Me.metadata.name}]   _toggleScreenReader`);
        this.actions.toggleScreenReader();
    }

    _largeText() {
        LOG(`[${Me.metadata.name}]   _largeText`);
        this.actions.toggleLargeText();
    }

    _hidePanel() {
        LOG(`[${Me.metadata.name}]   _togglePanel`);
        this.actions.toggleShowPanel();
    }

    _toggleTheme() {
        LOG(`[${Me.metadata.name}]   _toggleTheme`);
        this.actions.toggleTheme();
    }

    _invertLightAll() {
        LOG(`[${Me.metadata.name}]   _toggleLightnessInvertGlobal`);
        this.actions.toggleLightnessInvertEffect(false, false);
    }

    _invertLightWin() {
        LOG(`[${Me.metadata.name}]   _toggleLightnessInvertWindow`);
        this.actions.toggleLightnessInvertEffect(true, false);
    }

    _invertLightShiftAll() {
        LOG(`[${Me.metadata.name}]   _toggleLightnessInvertGlobal`);
        this.actions.toggleLightnessInvertEffect(false, true);
    }

    _invertLightShiftWin() {
        LOG(`[${Me.metadata.name}]   _toggleLightnessInvertWindow`);
        this.actions.toggleLightnessInvertEffect(true, true);
    }

    _invertColorsWin() {
        LOG(`[${Me.metadata.name}]   _toggleColorsInvertWindow`);
        this.actions.toggleColorsInvertEffect(true);
    }

    _protanToggleAll() {
        this.actions.toggleColorBlindShaderEffect(true, 1, false);
    }

    _deuterToggleAll() {
        this.actions.toggleColorBlindShaderEffect(true, 2, false);
    }

    _tritanToggleAll() {
        this.actions.toggleColorBlindShaderEffect(true, 3, false);
    }

    _protanSimToggleAll() {
        this.actions.toggleColorBlindShaderEffect(true, 1, true);
    }

    _deuterSimToggleAll() {
        this.actions.toggleColorBlindShaderEffect(true, 2, true);
    }

    _tritanSimToggleAll() {
        this.actions.toggleColorBlindShaderEffect(true, 3, true);
    }

    _mixerGbrToggleAll() {
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
};