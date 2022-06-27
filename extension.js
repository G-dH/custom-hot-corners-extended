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

const { GObject, GLib, Clutter, Meta, Shell } = imports.gi;

const Main                   = imports.ui.main;
const Layout                 = imports.ui.layout;

const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();
const Utils                  = Me.imports.src.common.utils;
const Settings               = Me.imports.src.common.settings;
const ActionTriger           = Me.imports.src.extension.actionTrigger;

let   actionTrigger;

// gettext
const _                      = Settings._;

const listTriggers           = Settings.listTriggers();
const Triggers               = Settings.Triggers;

let chce = null;
let _origUpdateHotCorners;
let _originalHotCornerEnabled;


function init() {
    _origUpdateHotCorners = imports.ui.layout.LayoutManager.prototype._updateHotCorners;
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    chce = new CustomHotCornersExtended();
    // chce delegates 'this' in _updateHotCorners() function when called from Gnome Shell
    return chce;
}

class CustomHotCornersExtended {
    constructor() {
        this._mscOptions           = null;
        this.CORNERS_VISIBLE       = false;
        this.ACTION_TIMEOUT        = 0;
        this.RIPPLE_ANIMATION      = true;
        this.BARRIER_FALLBACK      = false;
        this._myCorners            = [null, null];
        this._delayId              = 0;
        this._delaySupportId       = 0;
        this._timeoutsCollector    = [];
        this._cornersCollector     = [];
        this._actorsCollector      = [];
        this._actionTimeoutId      = null;
        this._extensionEnabled     = false;
        this._watch                = {};
        this._hotCornerEnabledOrig = Main.layoutManager._interfaceSettings.get_boolean('enable-hot-corners');
    }

    enable() {
        // delayed start to avoid initial hot corners overrides from other extensions
        // and also to not slowing down the screen unlock animation - the killer is registration of keyboard shortcuts
        this._delayId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            500,
            () => {
                _originalHotCornerEnabled = Main.layoutManager._interfaceSettings.get_boolean('enable-hot-corners');
                Main.layoutManager._interfaceSettings.set_boolean('enable-hot-corners', false);
                this._extensionEnabled = true;
                this._mscOptions = new Settings.MscOptions();
                if (!this.actionTrigger) {
                    this.actionTrigger = new ActionTriger.ActionTrigger(this._mscOptions);
                }
                else {
                    this.actionTrigger._bindShortcuts();
                    this.actionTrigger.actions.resume();
                }

                this._updateMscOptions(null, true);
                this._replace_updateHotCornersFunc();
                this._updateWatch();
                this._delaySupportId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    500,
                    () => {
                        // delay to be sure that all extensions are loaded and active
                        this._updateSupportedExtensionsAvailability();
                        this._delaySupportId = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                );
                this._mscOptions.connect('changed', (settings, key) => this._updateMscOptions(key));

                log(`${Me.metadata.name}: enabled`);

                this._delayId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    disable() {
        if (this._delayId) {
            GLib.source_remove(this._delayId);
            this._delayId = 0;
        }
        if (this._delaySupportId) {
            GLib.source_remove(this._delaySupportId);
            this._delaySupportId = 0;
        }
        this._timeoutsCollector.forEach(c => GLib.Source.remove(c));
        this._timeoutsCollector = [];
        //this._removeActionTimeout();
        this._removeHotCorners();
        if (this._mscOptions) {
            this._mscOptions.destroy();
            this._updateSupportedExtensionsAvailability(true);
            this._mscOptions = null;
        }

        // don't destroy Actions and lose effects and thumbnails because of the screen lock, for example
        let fullDisable = !Utils.extensionEnabled();
        if (fullDisable) {
            if (this.actionTrigger) {
                this.actionTrigger.clean(true);
            }
            this.actionTrigger = null;
        } else {
            if (this.actionTrigger) {
                this.actionTrigger.clean(false);
            }
        }
        this._extensionEnabled = false;
        // restore original hot corners
        // some extensions also modify Main.layoutManager._updateHotCorners._updateHotCorners()
        //   and so it'll be more secure to take the function from the source (which could be altered too but less likely)
        Main.layoutManager._interfaceSettings.set_boolean('enable-hot-corners', true); //this._hotCornerEnabledOrig);
        Main.layoutManager._updateHotCorners = _origUpdateHotCorners;
        Main.layoutManager._updateHotCorners();

        log(`${Me.metadata.name}: ${fullDisable ? 'disabled' : 'suspended'}`);

        return fullDisable;
    }

    _replace_updateHotCornersFunc() {
        Main.layoutManager._updateHotCorners = this._updateHotCorners.bind(this);
        Main.layoutManager._updateHotCorners();
    }

    _updateSupportedExtensionsAvailability(reset = false) {
        let supportedExetensions = [];
        if (!reset) {
            // test ArcMenu
            if (global.toggleArcMenu)
                supportedExetensions.push('ArcMenu');
            // test AATWS
            if (imports.ui.altTab.WindowSwitcherPopup.prototype.showOrig)
                supportedExetensions.push('AATWS');
        }
        this._mscOptions.set('supportedExetensions', supportedExetensions);
    }

    _removeHotCorners() {
        this._cornersCollector.forEach(c => c.destroy());
        this._cornersCollector = [];

        const hc = Main.layoutManager.hotCorners;
        // reverse iteration, objects are being removed from the source during destruction
        for (let i = hc.length - 1; i >= 0; i--) {
            if (hc[i]) {
                if (hc[i]._corner)
                    this._destroyHotCorner(hc[i]._corner);
            }
        }
        Main.layoutManager.hotCorners = [];
        this._updateWatchedCorners();
        // when some other extension steal my hot corners I still need to be able to destroy all actors I made
        this._actorsCollector.filter(a => a !== null).forEach(a => a.destroy());
        this._actorsCollector = [];
    }

    _updateMscOptions(key, doNotUpdateHC = false) {
        /*if (!actionTrigger.actions._mscOptions)
            actions._mscOptions = _mscOptions;*/
        const actions = this.actionTrigger.actions;
        if (key === 'show-osd-monitor-indexes') {
            this._updateOsdMonitorIndexes();
        }
        actions.WIN_WRAPAROUND      = this._mscOptions.get('winSwitchWrap');
        actions.WIN_SKIP_MINIMIZED  = this._mscOptions.get('winSkipMinimized');
        actions.WIN_STABLE_SEQUENCE = this._mscOptions.get('winStableSequence');
        this.ACTION_TIMEOUT    = this._mscOptions.get('actionEventDelay');
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
    }

    _updateOsdMonitorIndexes() {
        if (this._mscOptions.get('showOsdMonitorIndexes')) {
            this.actionTrigger.actions._showMonitorIndexesOsd();
        }
    }

    _updateHotCorners() {
        // when the layout manager calls this function as a callback with its own 'this', we need to override it by chce
        chce._removeHotCorners();
        Main.layoutManager.hotCorners = [];
        chce._updateWatchedCorners();

        let primaryIndex = Main.layoutManager.primaryIndex;
        // avoid creating new corners if this extension is disabled...
        // ...since this method overrides the original one in GS and something can store pointer to this replacement
        if (!chce._extensionEnabled)
            return;

        let monIndexes = [...Main.layoutManager.monitors.keys()];
        // index of the primary monitor to the first possition
        monIndexes.splice(0, 0, monIndexes.splice(primaryIndex, 1)[0]);

        for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
            // Monitor 1 in preferences will allways refer to the primary monitor
            const corners = Settings.Corner.forMonitor(i, monIndexes[i], global.display.get_monitor_geometry(monIndexes[i]));
            chce._setExpansionLimits(corners);

            for (let corner of corners) {
                chce._cornersCollector.push(corner);

                for (let trigger of listTriggers) {
                    // Update hot corner if something changes
                    // corner has it's own connect method defined in settings, this is not direct gsettings connect
                    corner.connect('changed', (settings, key) => chce._updateCorner(corner, key, trigger), trigger);
                }
                if (chce._shouldExistHotCorner(corner)) {
                    Main.layoutManager.hotCorners.push(new CustomHotCorner(corner, chce));
                    //this._rebuildHotCorner(corner);
                    chce._updateWatchedCorners();
                }
            }
        }
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
                corner.fullExpandVertical   = !prevCorner.vExpand;
                corner.fullExpandHorizontal = !nextCorner.hExpand;
            } else if ((corner.top && prevCorner.top) || (!corner.top && !prevCorner.top)) {
                corner.fullExpandVertical   = !nextCorner.vExpand;
                corner.fullExpandHorizontal = !prevCorner.hExpand;
            }
        }
    }

    _shouldExistHotCorner(corner) {
        let answer = false;
        for (let trigger of listTriggers)
            answer = answer || (corner.action[trigger] !== 'disabled');

        return answer;
    }

    _updateCorner(corner, key, trigger) {
        switch (key) {
            case 'action':
                corner.action[trigger] = corner.getAction(trigger);
                this._rebuildHotCorner(corner);
                break;
            case 'ctrl':
                corner.ctrl[trigger] = corner.getCtrl(trigger);
                break;
            case 'command':
                corner.command[trigger] = corner.getCommand(trigger);
                break;
            case 'fullscreen':
                corner.fullscreen[trigger] = corner.getFullscreen(trigger);
                break;
            case 'workspace-index':
                corner.workspaceIndex[trigger] = corner.getWorkspaceIndex(trigger);
                break;
            case 'h-expand':
            case 'v-expand':
                this._updateHotCorners();
                break;
            default:
                this._rebuildHotCorner(corner);
        }
    }

    _updateWatch() {
        this._watch.active = this._mscOptions.get('watchCorners');
        if (this._watch.active && !this._watch.timeout) {
            this._watch.timeout = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                3000,
                () => {
                    // some extensions can replace the function (Dash to Panel)
                    if (Main.layoutManager._updateHotCorners !== this._updateHotCorners)
                        Main.layoutManager._updateHotCorners = this._updateHotCorners;

                    if (Main.layoutManager.hotCorners !== this._myCorners[0] ||
                        // some extensions (ArcMenu) can modify pressure barrier triggers, which normaly just emits a triggered event
                        (this._myCorners[1] && Main.layoutManager.hotCorners[0]._pressureBarrier._trigger !== this._myCorners[1])
                    ) {
                        this._updateHotCorners();
                        // Main.notify(Me.metadata.name, `Hot Corners had to be updated because of external override`);
                        log(Me.metadata.name, 'Hot Corners had to be updated because of external override');
                    }
                    if (!this._watch.active) {
                        this._timeoutsCollector.splice(_timeoutsCollector.indexOf(this._watch.timeout), 1);
                        this._watch.timeout = null;
                    }
                    return this._watch.active;
                }
            );
            this._timeoutsCollector.push(this._watch.timeout);
        }
    }

    _updateWatchedCorners() {
        this._myCorners[0] = Main.layoutManager.hotCorners;
        this._myCorners[1] = Main.layoutManager.hotCorners[0] ? Main.layoutManager.hotCorners[0]._pressureBarrier._trigger : null;
    }

    _rebuildHotCorner(corner) {
        this._destroyHotCorner(corner);
        if (this._shouldExistHotCorner(corner)) {
            Main.layoutManager.hotCorners.push(new CustomHotCorner(corner, this, this._mscOptions));
            this._updateWatchedCorners();
        }
    }

    _destroyHotCorner(corner) {
        let hc = Main.layoutManager.hotCorners;
        for (let i = 0; i < hc.length; i++) {
            if (hc[i] && !hc[i]._corner) {
                if (hc[i].destroy)
                    hc[i].destroy();
            }
            else if (hc[i]._corner.top  === corner.top &&
                hc[i]._corner.left === corner.left &&
                hc[i]._corner.monitorIndex === corner.monitorIndex) {
                for (let a of Main.layoutManager.hotCorners[i]._actors) {
                    this._actorsCollector.splice(this._actorsCollector.indexOf(a), 1);
                    a.destroy();
                }
                Main.layoutManager.hotCorners[i]._actors = [];
                hc[i].setBarrierSize([0, 0], false);
                Main.layoutManager.hotCorners[i].destroy();
                Main.layoutManager.hotCorners.splice(i, 1);
                corner.hotCornerExists = false;
                break;
            }
        }
    }

    _removeActionTimeout() {
        this._timeoutsCollector.splice(this._timeoutsCollector.indexOf(this._actionTimeoutId), 1);
        this._actionTimeoutId = null;
        return false;
    }
}

const CustomHotCorner = GObject.registerClass(
class CustomHotCorner extends Layout.HotCorner {
    _init(corner, chce) {
        this._chce = chce;
        this._mscOptions = this._chce._mscOptions;
        let monitor = Main.layoutManager.monitors[corner.monitorIndex];
        super._init(Main.layoutManager, monitor, corner.x, corner.y);
        this._actionTimeoutId = this._chce._actionTimeoutId;
        this._corner  = corner;
        this._monitor = monitor;
        this._actors  = [];
        this._corner.hotCornerExists = true;
        this._enterd = false;
        this._pressureBarrier = new Layout.PressureBarrier(
            corner.pressureThreshold,
            Layout.HOT_CORNER_PRESSURE_TIMEOUT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW
        );

        if (this._hotCornerEnabled() && !this._chce.BARRIER_FALLBACK) {
            this.setBarrierSize([corner.barrierSizeH, corner.barrierSizeV], false);
            this._pressureBarrier.connect('trigger', this._onPressureTriggered.bind(this));
        }
        this._setupCornerActorsIfNeeded(Main.layoutManager);

        let ltr = Clutter.get_default_text_direction() === Clutter.TextDirection.LTR;
        let angle = this._corner.left && ltr ? (this._corner.top ? 0 : 270) : (this._corner.top ? 90 : 180);
        this._ripples._ripple1.rotation_angle_z = angle;
        this._ripples._ripple2.rotation_angle_z = angle;
        this._ripples._ripple3.rotation_angle_z = angle;
    }

    // Overridden to allow all 4 monitor corners
    setBarrierSize(size, forignAccess = true) {
        if (forignAccess)
            return;
        // Use code of parent class to remove old barriers but new barriers
        // must be created here since the properties are construct only.
        super.setBarrierSize(0);
        let geometry = global.display.get_monitor_geometry(this._corner.monitorIndex);
        let sizeH = Math.floor(size[0] / 100 * geometry.width);
        let sizeV = Math.floor(size[1] / 100 * geometry.height);
        if (sizeH > 0 && sizeV > 0) {
            const BD = Meta.BarrierDirection;
            // for X11 session:
            //  right vertical and bottom horizontal pointer barriers must be 1px further to match the screen edge
            // ...because barriers are actually placed between pixels, along the top/left edge of the addressed pixels
            // ...Wayland behave differently and addressed pixel means the one behind which pointer can't go
            // but avoid barriers that are at the same position
            // ...and block opposite directions. Neither with X nor with Wayland
            // ...such barriers work.
            let x = this._corner.x + (Meta.is_wayland_compositor() ? 0 : ((!this._corner.left && !this._barrierCollision()['x']) ? 1 : 0));
            this._verticalBarrier = new Meta.Barrier({
                display: global.display,
                x1: x,
                x2: x,
                y1: this._corner.y,
                y2: this._corner.top ? this._corner.y + sizeV : this._corner.y - sizeV,
                directions: this._corner.left ? BD.POSITIVE_X : BD.NEGATIVE_X,
            });
            let y = this._corner.y + (Meta.is_wayland_compositor() ? 0 : ((!this._corner.top && !this._barrierCollision()['y']) ? 1 : 0));
            this._horizontalBarrier = new Meta.Barrier({
                display: global.display,
                x1: this._corner.x,
                x2: this._corner.left ? this._corner.x + sizeH : this._corner.x - sizeH,
                y1: y,
                y2: y,
                directions: this._corner.top ? BD.POSITIVE_Y : BD.NEGATIVE_Y,
            });

            this._pressureBarrier.addBarrier(this._verticalBarrier);
            this._pressureBarrier.addBarrier(this._horizontalBarrier);

            if (this._chce.CORNERS_VISIBLE && this._hotCornerEnabled() && !this._chce.BARRIER_FALLBACK)
                this._drawBarriers(sizeH, sizeV);
        }
    }

    _hotCornerEnabled() {
        return this._corner.action[Triggers.PRESSURE] !== 'disabled' || this._corner.action[Triggers.CTRL_PRESSURE] !== 'disabled';
    }

    _barrierCollision() {
        // avoid barrier collisions on multimonitor system under X11 session
        let x = false;
        let y = false;
        for (let c of Main.layoutManager.hotCorners) {
            if (this._corner.x + 1 === c._corner.x)
                x =  true;

            if (this._corner.y + 1 === c._corner.y)
                y =  true;
        }
        return {'x': x, 'y': y};
    }

    _drawBarriers(sizeH, sizeV) {
        // show horizontal barrier
        this._actor = new Clutter.Actor({
            name: 'barrier-h',
            x: this._corner.x - (this._corner.left ? 0 : sizeH),
            y: this._corner.y + (this._corner.top ? 1 : -1),
            width: sizeH,
            height: 1,
            reactive: false,
            background_color: new Clutter.Color({
                red:   0,
                green: 255,
                blue:  0,
                alpha: 180,
            }),

        });

        this._connectActorEvents(this._actor);
        this._actor.connect('destroy', () => {
            this._actor = null;
        });

        Main.layoutManager.addChrome(this._actor);
        this._chce._actorsCollector.push(this._actor);
        this._actors.push(this._actor);

        // show vertical barrier
        this._actor = new Clutter.Actor({
            name: 'barrier-h',
            x: this._corner.x + (this._corner.left ? 1 : -1),
            y: this._corner.y - (this._corner.top ? 0 : sizeV),
            width: 1,
            height: sizeV,
            reactive: false,
            background_color: new Clutter.Color({
                red:   0,
                green: 255,
                blue:  0,
                alpha: 180,
            }),
        });

        this._connectActorEvents(this._actor);
        this._actor.connect('destroy', () => {
            this._actor = null;
        });

        Main.layoutManager.addChrome(this._actor);
        this._chce._actorsCollector.push(this._actor);
        this._actors.push(this._actor);
    }

    _setupCornerActorsIfNeeded(layoutManager) {
        let shouldCreateActor = this._shouldCreateActor();
        if (!(shouldCreateActor || this._corner.hExpand || this._corner.vExpand))
            return;

        let aSize = 3;
        let h = this._corner.hExpand;
        let v = this._corner.vExpand;
        aSize = (h || v) && shouldCreateActor ? 1 : aSize;
        let hSize = aSize;
        let vSize = aSize;

        if ((h || v) && shouldCreateActor) {
            let geometry = global.display.get_monitor_geometry(this._corner.monitorIndex);
            hSize = this._corner.fullExpandHorizontal ? geometry.width / 8 * 7 : geometry.width / 2 - 5;
            vSize = this._corner.fullExpandVertical ? geometry.height / 8 * 7 : geometry.height / 2 - 5;
        }
        // the corner's reactive area can be expanded horizontaly and/or verticaly
        // if only one expansion is needed, only one actor will be created
        if (v && !h) {
            hSize = aSize;
            aSize = vSize;
        }

        // base clickable actor, normal size or expanded
        this._actor = new Clutter.Actor({
            name: 'hot-corner-primary',
            x: this._corner.x + (this._corner.left ? 0 : -(hSize - 1)),
            y: this._corner.y + (this._corner.top  ? 0 : -(aSize - 1)),
            width: hSize,
            height: aSize,
            reactive: true,
            background_color: new Clutter.Color({
                red:   255,
                green: 120,
                blue:  0,
                // alpha: this._chce.CORNERS_VISIBLE ? ((h || v) ? 50 : 120) : 0
                alpha: this._chce.CORNERS_VISIBLE ? 255 : 0,
            }),

        });
        this._connectActorEvents(this._actor);
        this._actor.connect('destroy', () => {
            this._actor = null;
        });
        layoutManager.addChrome(this._actor);
        this._chce._actorsCollector.push(this._actor);
        this._actors.push(this._actor);

        // to expand clickable area in both axis make second actor
        if (v && h) {
            this._actorV = new Clutter.Actor({
                name: 'hot-corner-secondary',
                x: this._corner.x + (this._corner.left ? 0 : -(aSize - 1)),
                // avoid overlap with main actor
                y: this._corner.y + (this._corner.top  ? 1 : -(vSize)),
                width: aSize,
                height: vSize,
                reactive: true,
                background_color: new Clutter.Color({
                    red:   255,
                    green: 120,
                    blue:  0,
                    // alpha: this._chce.CORNERS_VISIBLE ? ((h || v) ? 50 : 120) : 0
                    alpha: this._chce.CORNERS_VISIBLE ? 255 : 0,
                }),
            });
            this._connectActorEvents(this._actorV);
            this._actorV.connect('destroy', () => {
                this._actorV = null;
            });
            layoutManager.addChrome(this._actorV);
            this._chce._actorsCollector.push(this._actorV);
            this._actors.push(this._actorV);
        }
        // Fallback hot corners as a part of base actor
        if (this._corner.action[Triggers.PRESSURE] !== 'disabled' &&
            (!global.display.supports_extended_barriers() || this._chce.BARRIER_FALLBACK)) {
            let fSize = 3;
            this._cornerActor = new Clutter.Actor({
                name:     'hot-corner',
                x:        (this._corner.left ? 0 : (this._actor.width  - 1) - (fSize - 1)),
                y:        (this._corner.top  ? 0 : (this._actor.height - 1) - (fSize - 1)),
                width:    fSize,
                height:   fSize,
                reactive: true,
                visible:  true,
                background_color: new Clutter.Color({
                    red:   0,
                    green: 255,
                    blue:  0,
                    // alpha: this._chce.CORNERS_VISIBLE ? ((h || v) ? 50 : 120) : 0
                    alpha: this._chce.CORNERS_VISIBLE ? 255 : 0,
                }),
            });
            this._actor.add_child(this._cornerActor);
            this._cornerActor.connect('enter-event', this._onPressureTriggered.bind(this));
        }
    }

    _connectActorEvents(actor) {
        if (this._shouldConnect([Triggers.BUTTON_PRIMARY, Triggers.BUTTON_SECONDARY, Triggers.BUTTON_MIDDLE])) {
            actor.connect('button-release-event', this._onCornerClicked.bind(this));
        }
        if (this._shouldConnect([Triggers.SCROLL_UP, Triggers.SCROLL_DOWN])) {
            actor.connect('scroll-event', this._onCornerScrolled.bind(this));
        }
    }

    _shouldCreateActor() {
        let answer = false;
        for (let trigger of listTriggers) {
            if (trigger === Triggers.PRESSURE && (global.display.supports_extended_barriers() && !this._chce.BARRIER_FALLBACK))
                continue;
            answer = answer || (this._corner.action[trigger] !== 'disabled');
        }
        return answer;
    }

    _shouldConnect(signals) {
        let answer = null;
        for (let trigger of listTriggers) {
            if (signals.includes(trigger))
                answer = answer || (this._corner.action[trigger] !== 'disabled');
        }
        return answer;
    }

    _rippleAnimation() {
        this._ripples.playAnimation(this._corner.x, this._corner.y);
    }

    _ctrlPressed() {
        const mods = global.get_pointer()[2];
        return (mods & Clutter.ModifierType.CONTROL_MASK) !== 0;
    }

    _shiftPressed() {
        const mods = global.get_pointer()[2];
        return (mods & Clutter.ModifierType.SHIFT_MASK) !== 0;
    }

    _onPressureTriggered() {
        // neither the 'enter' nor pressure 'trigger' events contain modifier state
        let trg;
        if (!this._ctrlPressed()) {
            // if direct hot corners require Shift and Shift not pressed, do nothing
            if (this._mscOptions.get('hotCornersRequireShift') && !this._shiftPressed()) return;
            trg = Triggers.PRESSURE;
        } else {
            trg = Triggers.CTRL_PRESSURE;
        }
        
        this._runAction(trg);
    }

    _onCornerClicked(actor, event) {
        // if (event.get_click_count() > 1) return; // ignore second click of double clicks
        let button = event.get_button();
        let trigger = null;
        switch (button) {
            case Clutter.BUTTON_PRIMARY:
                if (!(this._corner.ctrl[Triggers.BUTTON_PRIMARY] && !this._ctrlPressed()))
                    trigger = Triggers.BUTTON_PRIMARY;
                break;
            case Clutter.BUTTON_SECONDARY:
                if (!(this._corner.ctrl[Triggers.BUTTON_SECONDARY] && !this._ctrlPressed()))
                    trigger = Triggers.BUTTON_SECONDARY;
                break;
            case Clutter.BUTTON_MIDDLE:
                if (!(this._corner.ctrl[Triggers.BUTTON_MIDDLE] && !this._ctrlPressed()))
                    trigger = Triggers.BUTTON_MIDDLE;
                break;
            default:
                return Clutter.EVENT_PROPAGATE;
        }
        if (trigger !== null && this._runAction(trigger))
            return Clutter.EVENT_STOP;
        else
            return Clutter.EVENT_PROPAGATE;
    }

    _onCornerScrolled(actor, event) {
        let direction = event.get_scroll_direction();
        if (this._notValidScroll(direction))
            return;

        let trigger = null;
        switch (direction) {
            case Clutter.ScrollDirection.UP:
            case Clutter.ScrollDirection.LEFT:
                if (!(this._corner.ctrl[Triggers.SCROLL_UP] && !this._ctrlPressed()))
                    trigger = Triggers.SCROLL_UP;
                break;
            case Clutter.ScrollDirection.DOWN:
            case Clutter.ScrollDirection.RIGHT:
                if (!(this._corner.ctrl[Triggers.SCROLL_DOWN] && !this._ctrlPressed()))
                    trigger = Triggers.SCROLL_DOWN;
                break;
            default:
                return Clutter.EVENT_PROPAGATE;
        }
        if (trigger !== null && this._runAction(trigger))
            return Clutter.EVENT_STOP;
        else
            return Clutter.EVENT_PROPAGATE;
    }

    _runAction(trigger) {
        const timeoutWhitelist = ['volume-up', 'volume-down', 'display-brightness-up', 'display-brightness-down'];
        if ((this._actionTimeoutActive(trigger) && !timeoutWhitelist.includes(this._corner.action[trigger])) ||
            this._corner.action[trigger] === 'disabled')
            return false;
        if (!this._monitor.inFullscreen ||
            (this._monitor.inFullscreen && this._corner.fullscreen[trigger])) {
            if (this._chce.RIPPLE_ANIMATION)
                this._rippleAnimation();
            this._chce.actionTrigger.runActionData.action = this._corner.action[trigger];
            this._chce.actionTrigger.runActionData.monitorIndex = this._corner.monitorIndex;
            this._chce.actionTrigger.runActionData.workspaceIndex = this._corner.workspaceIndex[trigger];
            this._chce.actionTrigger.runActionData.command = this._corner.command[trigger];
            this._chce.actionTrigger.runActionData.keyboard = false;
            return this._chce.actionTrigger.runAction();
        }
        return false;
    }

    _actionTimeoutActive() {
        if (this._actionTimeoutId)
            return true;

        this._actionTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this._chce.ACTION_TIMEOUT,
                this._removeActionTimeout.bind(this)
        );
        this._chce._timeoutsCollector.push(this._actionTimeoutId);
        return false;
    }

    _notValidScroll(direction) {
        if (direction === Clutter.ScrollDirection.SMOOTH)
            return true;
        return false;
    }

    _removeActionTimeout() {
        this._chce._timeoutsCollector.splice(this._chce._timeoutsCollector.indexOf(this._actionTimeoutId), 1);
        this._actionTimeoutId = null;
        return false;
    }
});
