/**
 * Custom Hot Corners - Extended
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Settings from './src/common/settings.js';
import * as HotCorners from './src/extension/hotCorners.js';
import * as PanelButton from './src/extension/panelButton.js';
import * as ActionTrigger from './src/extension/actionTrigger.js';
import * as ActionList from './src/prefs/actionList.js';

import * as Actions from './src/extension/actions.js';
import * as Utils from './src/common/utils.js';


let chce;

export default class CustomHotCornersExtended extends Extension {
    _init() {
        chce = this;

        Utils.init(this);
        ActionList.init(this);
        HotCorners.init(this);
        ActionTrigger.init(this);
        Actions.init(this);
        PanelButton.init(this);
        Settings.init(this);

        this._mscOptions           = null;
        this.CORNERS_VISIBLE       = false;
        this.RIPPLE_ANIMATION      = true;
        this.BARRIER_FALLBACK      = false;
        this._myCorners            = [null, null];
        this._delayId              = 0;
        this._timeoutsCollector    = [];
        this._cornersCollector     = [];
        this._actorsCollector      = [];
        this._actionTimeoutId      = null;
        this._extensionEnabled     = false;
        this._watch                = {};
        this._listTriggers           = Settings.listTriggers();
    }

    enable() {
        this._init();
        this._origUpdateHotCorners = Main.layoutManager._updateHotCorners;
        this._extensionEnabled = true;
        this._mscOptions = new Settings.MscOptions();

        if (!this.actionTrigger)
            this.actionTrigger = new ActionTrigger.ActionTrigger(this._mscOptions);
        this._updateMscOptions(null, true);
        this._replace_updateHotCornersFunc();
        this._updateWatch();
        this._updateSupportedExtensionsAvailability();
        this._mscOptions.set('showOsdMonitorIndexes', false);
        this._mscOptions.connect('changed', (settings, key) => this._updateMscOptions(key));

        // this._originalHotCornerEnabled = Main.layoutManager._interfaceSettings.get_boolean('enable-hot-corners');

        let enableDelay;
        if (this.actionTrigger)
            enableDelay = 1;
        else
            enableDelay = 4;

        // delay binding shortcuts that slows down the unlock animation and rebasing extensions
        // also reset hot corners to be sure they weren't overridden by another extension
        if (this._delayId)
            GLib.source_remove(this._delayId);

        this._delayId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            enableDelay,
            () => {
                this.actionTrigger._bindShortcuts();
                this._replace_updateHotCornersFunc();
                this._delayId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );

        console.log(`${this.metadata.name}: enabled`);
    }

    disable() {
        if (this._delayId) {
            GLib.source_remove(this._delayId);
            this._delayId = 0;
        }
        this._timeoutsCollector.forEach(c => GLib.Source.remove(c));
        this._timeoutsCollector = [];
        this._watch.timeout = 0;

        this._removeHotCorners();
        if (this._mscOptions) {
            this._mscOptions.destroy();
            this._updateSupportedExtensionsAvailability(true);
            this._mscOptions = null;
        }

        // effects should survive screen lock
        let fullDisable = !(Main.sessionMode.isLocked && Utils.extensionEnabled());
        if (fullDisable) {
            if (this.actionTrigger)
                this.actionTrigger.clean(true);
            this.actionTrigger = null;
        } else if (this.actionTrigger) {
            this.actionTrigger.clean(false);
        }

        this._extensionEnabled = false;

        // restore original hot corners
        Main.layoutManager._updateHotCorners = this._origUpdateHotCorners;
        Main.layoutManager._updateHotCorners();

        this._myCorners = [null, null];

        if (this._panelButton) {
            this._panelButton.destroy();
            this._panelButton = null;
        }

        HotCorners.cleanGlobals();
        ActionTrigger.cleanGlobals();
        Utils.cleanGlobals();
        Actions.cleanGlobals();
        PanelButton.cleanGlobals();
        Settings.cleanGlobals();
        ActionList.cleanGlobals();

        if (this._displayRedirectionDisabled) {
            if (Meta.disable_unredirect_for_display)
                Meta.disable_unredirect_for_display(global.display);
            else // since GS 48
                global.compositor.disable_unredirect();
            this._displayRedirectionDisabled = false;
        }

        chce = null;

        console.log(`${this.metadata.name}: ${fullDisable ? 'disabled' : 'suspended'}`);
    }

    _replace_updateHotCornersFunc() {
        Main.layoutManager._updateHotCorners = this._updateHotCorners;
        Main.layoutManager._updateHotCorners();
    }

    _getEnabledExtensions(uuid = this.metadata.uuid) {
        let extensions = [];
        Main.extensionManager._extensions.forEach(e => {
            if (e.state === 1 && e.uuid.includes(uuid))
                extensions.push(e);
        });
        return !!extensions.length;
    }

    _updateSupportedExtensionsAvailability(reset = false) {
        let supportedExtensions = [];
        if (!reset) {
            // test ArcMenu
            if (global.toggleArcMenu)
                supportedExtensions.push('arcmenu');
            // test AATWS
            const aatws = AltTab.WindowSwitcherPopup.prototype;
            if (aatws._showPopup || aatws.showOrig)
                supportedExtensions.push('aatws');

            let windowSearchProviderEnabled = false;
            if (Main.overview._overview._controls.layoutManager._searchController._searchResults._providers) {
                Main.overview._overview._controls.layoutManager._searchController._searchResults._providers.forEach(p => {
                    if (p.id.includes('open-windows'))
                        windowSearchProviderEnabled = true;
                });
            }
            if (windowSearchProviderEnabled)
                supportedExtensions.push('window-search-provider');
        }
        this._mscOptions.set('supportedExtensions', supportedExtensions);
    }

    _updateMscOptions(key, doNotUpdateHC = false) {
        const actions = this.actionTrigger.actions;
        if (key === 'show-osd-monitor-indexes')
            this._updateOsdMonitorIndexes();

        actions.WIN_WRAPAROUND = this._mscOptions.get('winSwitchWrap');
        actions.WIN_SKIP_MINIMIZED  = this._mscOptions.get('winSkipMinimized');
        actions.WIN_STABLE_SEQUENCE = this._mscOptions.get('winStableSequence');
        this.RIPPLE_ANIMATION  = this._mscOptions.get('rippleAnimation');

        if (this.CORNERS_VISIBLE !== this._mscOptions.get('cornersVisible')) {
            this.CORNERS_VISIBLE = this._mscOptions.get('cornersVisible');

            if (!doNotUpdateHC)
                this._updateHotCorners();
        }

        if (this.BARRIER_FALLBACK !==  this._mscOptions.get('barrierFallback')) {
            this.BARRIER_FALLBACK = this._mscOptions.get('barrierFallback');
            if (!doNotUpdateHC)
                this._updateHotCorners();
        }
        this._updateWatch();

        if (key === 'buttons-trigger-on-press')
            this._updateHotCorners();

        if (this._mscOptions.get('enablePanelMenu')) {
            if (!this._panelButton) {
                this._panelButton = new PanelButton.MenuButton(this._mscOptions);
                Main.panel.addToStatusArea('CustomHotCorners', this._panelButton, 0, 'right');
            }
        } else if (this._panelButton) {
            this._panelButton.destroy();
            this._panelButton = null;
        }
    }

    _updateOsdMonitorIndexes() {
        if (this._mscOptions.get('showOsdMonitorIndexes'))
            this.actionTrigger.actions._showMonitorIndexesOsd();
    }

    _removePanelBarrier() {
        if (Main.layoutManager._rightPanelBarrier) {
            Main.layoutManager._rightPanelBarrier.destroy();
            Main.layoutManager._rightPanelBarrier = null;
        }
    }

    _updateHotCorners() {
        // when the layout manager calls this function as a callback with its own 'this', we need to override it by chce
        chce._removeHotCorners();
        Main.layoutManager.hotCorners = [];
        chce._updateWatchedCorners();

        // corners can be temporarily disabled from panel menu
        const cornersDisabled = !chce._mscOptions.get('hotCornersEnabled', true);
        if (cornersDisabled)
            return;

        let primaryIndex = Main.layoutManager.primaryIndex;
        // avoid creating new corners if this extension is disabled...
        // ...since this method overrides the original one in GS and something can call it
        if (!chce._extensionEnabled)
            return;

        let monIndexes = [...Main.layoutManager.monitors.keys()];
        // index of the primary monitor to the first position
        monIndexes.splice(0, 0, monIndexes.splice(primaryIndex, 1)[0]);

        chce._fullscreenRequired = false;
        for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
            // Monitor 1 in preferences will always refer to the primary monitor
            const corners = Settings.Corner.forMonitor(i, monIndexes[i], global.display.get_monitor_geometry(monIndexes[i]));
            chce._setExpansionLimits(corners);

            for (let corner of corners) {
                chce._cornersCollector.push(corner);

                for (let trigger of chce._listTriggers) {
                    // Update hot corner if something changes
                    // corner has it's own connect method defined in settings, this is not direct gsettings connect
                    // corner.connect('changed', (settings, key) => chce._updateCorner(corner, key, trigger), trigger);
                    corner.connect('changed', chce._updateHotCorners, trigger);
                }
                if (chce._shouldExistHotCorner(corner)) {
                    Main.layoutManager.hotCorners.push(new HotCorners.CustomHotCorner(corner, chce));
                    chce._updateWatchedCorners();
                    if (i === 0 && corner.top && !corner.left)
                        chce._removePanelBarrier();
                }
            }
        }

        // If any corner action should be available in fullscreen mode,
        // disable bypassing the compositor when the display switches to fullscreen mode
        // and keep track of its state - each disable has to be enabled, it works as a stack
        if (chce._fullscreenRequired && !chce._displayRedirectionDisabled) {
            if (Meta.disable_unredirect_for_display)
                Meta.disable_unredirect_for_display(global.display);
            else // new in GS 48
                global.compositor.disable_unredirect();
            chce._displayRedirectionDisabled = true;
        }
    }

    _removeHotCorners() {
        this._cornersCollector.forEach(c => c.destroy());
        this._cornersCollector = [];

        Main.layoutManager.hotCorners.forEach(c => c && c.destroy());
        Main.layoutManager.hotCorners = [];
        this._updateWatchedCorners();

        // when some other extension steal my hot corners I still need to be able to destroy all actors I made
        this._actorsCollector.filter(a => a).forEach(a => a.destroy());
        this._actorsCollector = [];
    }

    _setExpansionLimits(corners) {
        const cornerOrder = [0, 1, 3, 2];
        for (let i = 0; i < corners.length; i++) {
            let prevCorner = (i + corners.length - 1) % corners.length;
            let nextCorner = (i + 1) % corners.length;
            prevCorner = corners[cornerOrder[prevCorner]];
            nextCorner = corners[cornerOrder[nextCorner]];
            let corner = corners[cornerOrder[i]];

            if ((corner.left && prevCorner.left) || (!corner.left && !prevCorner.left)) {
                corner.fullExpandVertical   = !prevCorner.get('vExpand');
                corner.fullExpandHorizontal = !nextCorner.get('hExpand');
            } else if ((corner.top && prevCorner.top) || (!corner.top && !prevCorner.top)) {
                corner.fullExpandVertical   = !nextCorner.get('vExpand');
                corner.fullExpandHorizontal = !prevCorner.get('hExpand');
            }
        }
    }

    _shouldExistHotCorner(corner) {
        let answer = false;
        for (let trigger of chce._listTriggers) {
            const cornerActive = corner.action[trigger] !== 'disabled';
            answer = answer || cornerActive;
            chce._fullscreenRequired = chce._fullscreenRequired || (cornerActive && corner.get('fullscreen', trigger));
        }

        return answer;
    }

    _updateWatch() {
        this._watch.active = this._mscOptions.get('watchCorners');
        if (this._watch.active && !this._watch.timeout) {
            this._watch.timeout = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                3000,
                () => {
                    // some extensions can replace the function (Dash to Panel)
                    if (Main.layoutManager._updateHotCorners !== this._updateHotCorners) {
                        Main.layoutManager._updateHotCorners = this._updateHotCorners;
                        this._updateHotCorners();
                        log('_updateWatch: updateHotCorners function had to be updated because of external override');
                    }

                    let cornersChanged = false;
                    this._myCorners[0].forEach(c => {
                        cornersChanged = cornersChanged || !Main.layoutManager.hotCorners.includes(c);
                    });
                    if (cornersChanged) {
                        this._updateHotCorners();
                        log(this.metadata.name, 'Hot Corners had to be updated because of external override');
                        return this._watch.active;
                    }
                    // some extensions (ArcMenu) can modify pressure barrier triggers, which normally just emits a triggered event
                    if (this._myCorners[1] && Main.layoutManager.hotCorners[0] && Main.layoutManager.hotCorners[0]._pressureBarrier._trigger !== this._myCorners[1]) {
                        this._updateHotCorners();
                        log(this.metadata.name, 'Hot Corners had to be updated because of external override');
                    }
                    if (!this._watch.active) {
                        this._timeoutsCollector.splice(this._timeoutsCollector.indexOf(this._watch.timeout), 1);
                        this._watch.timeout = null;
                    }

                    return this._watch.active;
                }
            );
            this._timeoutsCollector.push(this._watch.timeout);
        }
    }

    _updateWatchedCorners() {
        this._myCorners[0] = [...Main.layoutManager.hotCorners];
        this._myCorners[1] = Main.layoutManager.hotCorners[0] ? Main.layoutManager.hotCorners[0]._pressureBarrier._trigger : null;
    }
}

