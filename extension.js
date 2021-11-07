/* Copyright 2017 Jan Runge <janrunx@gmail.com>
 * Copyright 2021 GdH <georgdh@gmail.com>
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

const {GObject, GLib, Clutter, Meta, Shell} = imports.gi;

const Main                   = imports.ui.main;
const Layout                 = imports.ui.layout;
// const Ripples                = imports.ui.ripples;

const ExtensionUtils         = imports.misc.extensionUtils;

const Me                     = ExtensionUtils.getCurrentExtension();
const Settings               = Me.imports.settings;
const ActionLib              = Me.imports.actions;
var   actions;
let   actionTrigger;

// gettext
const _                      = Settings._;

const listTriggers           = Settings.listTriggers();
const Triggers               = Settings.Triggers;

// const Performance = Me.imports.performance;

let _origUpdateHotCorners;
let _cornersCollector;
let _timeoutsCollector;
let _actorsCollector;
let _actionTimeoutId;

let _mscOptions;

let FULLSCREEN_GLOBAL;
let CORNERS_VISIBLE;
let ACTION_TIMEOUT;
let RIPPLE_ANIMATION;
let BARRIER_FALLBACK;

let _extensionEnabled;

let _myCorners = [null, null];
let _watch;
let _delayId;


function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    _timeoutsCollector    = [];
    _cornersCollector     = [];
    _actorsCollector      = [];
    _actionTimeoutId      = null;
    _extensionEnabled     = false;
    _watch                = {};
}

function enable() {
    // delayed start because of aggresive beasts that steal my corners even under my watch
    // and don't slow down the screen unlock animation - the killer are keyboard shortcuts
    _delayId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        500,
        () => {
            _delayId = 0;
            if (!actions)
                actions = new ActionLib.Actions();
            else
                actions.resume();
            _origUpdateHotCorners = Main.layoutManager._updateHotCorners;
            _initMscOptions();
            _extensionEnabled = true;
            if (!actionTrigger)
                actionTrigger = new ActionTrigger(_mscOptions);
            else
                actionTrigger._bindShortcuts();
            _replace_updateHotCornersFunc();
            _updateWatch();
            return false;
        }
    );
}

function _replace_updateHotCornersFunc() {
    Main.layoutManager._updateHotCorners = _updateHotCorners;
    Main.layoutManager._updateHotCorners();
}

function disable() {
    if (_delayId)
        GLib.source_remove(_delayId);
    _timeoutsCollector.forEach(c => GLib.Source.remove(c));
    _timeoutsCollector = [];
    _removeActionTimeout();
    _removeHotCorners();
    _mscOptions.destroy();
    // don't destroy Actions and lose effects and thumbnails because of the screen lock, for example
    let fullDisable = !actions.extensionEnabled();
    if (fullDisable) {
        actions.clean(true);
        actions = null;
        actionTrigger.clean(true);
        actionTrigger = null;
    } else {
        actions.clean(false);
        actionTrigger.clean(false);
    }
    // This restores the original hot corners
    _extensionEnabled = false;
    Main.layoutManager._updateHotCorners = _origUpdateHotCorners;
    // Update corners with the original function can be problem when some other extension changed the code before and calls its own objects (lake Dash to Panel)
    // Main.layoutManager._updateHotCorners();
    log(`[${Me.metadata.name}] extension ${fullDisable ? 'disabled' : 'suspended'}`);
}

function _initMscOptions() {
    _mscOptions = new Settings.MscOptions();
    _mscOptions.connect('changed', (settings, key) => _updateMscOptions(key));
    _updateMscOptions(null, true);
}

function _removeHotCorners() {
    _cornersCollector.forEach(c => c.destroy());
    _cornersCollector = [];

    const hc = Main.layoutManager.hotCorners;
    // reverse iteration, objects are being removed from the source during destruction
    for (let i = hc.length - 1; i >= 0; i--) {
        if (hc[i]) {
            if (hc[i]._corner)
                _destroyHotCorner(hc[i]._corner);
        }
    }
    Main.layoutManager.hotCorners = [];
    _updateWatchedCorners();
    // when some other extension steal my hot corners I still need to be able to destroy all actors I made
    _actorsCollector.filter(a => a !== null).forEach(a => a.destroy());
    _actorsCollector = [];
}

function _updateMscOptions(key, doNotUpdateHC = false) {
    if (!actions._mscOptions)
        actions._mscOptions = _mscOptions;

    actions.WS_IGNORE_LAST      = _mscOptions.wsSwitchIgnoreLast;
    actions.WS_WRAPAROUND       = _mscOptions.wsSwitchWrap;
    actions.WS_INDICATOR_MODE   = _mscOptions.wsSwitchIndicatorMode;
    actions.WIN_WRAPAROUND      = _mscOptions.winSwitchWrap;
    actions.WIN_SKIP_MINIMIZED  = _mscOptions.winSkipMinimized;
    ACTION_TIMEOUT        = _mscOptions.actionEventDelay;
    FULLSCREEN_GLOBAL     = _mscOptions.fullscreenGlobal;
    RIPPLE_ANIMATION      = _mscOptions.rippleAnimation;

    if (CORNERS_VISIBLE !== _mscOptions.cornersVisible) {
        CORNERS_VISIBLE = _mscOptions.cornersVisible;

        if (!doNotUpdateHC)
            _updateHotCorners();
    }

    if (BARRIER_FALLBACK !==  _mscOptions.barrierFallback) {
        BARRIER_FALLBACK = _mscOptions.barrierFallback;
        if (!doNotUpdateHC)
            _updateHotCorners();
    }

    _updateWatch();
}

function _updateHotCorners() {
    _removeHotCorners();
    Main.layoutManager.hotCorners = [];
    _updateWatchedCorners();

    let primaryIndex = Main.layoutManager.primaryIndex;
    // avoid creating new corners if this extension is disabled...
    // ...since this method overrides the original one in GS and something can store pointer to this replacement
    if (!_extensionEnabled)
        return;

    let monIndexes = [...Main.layoutManager.monitors.keys()];
    // index of the primary monitor to the first possition
    monIndexes.splice(0, 0, monIndexes.splice(primaryIndex, 1)[0]);

    for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
        // Monitor 1 in preferences will allways refer to the primary monitor
        const corners = Settings.Corner.forMonitor(i, monIndexes[i], global.display.get_monitor_geometry(monIndexes[i]));
        _setExpansionLimits(corners);

        for (let corner of corners) {
            _cornersCollector.push(corner);

            for (let trigger of listTriggers) {
                // Update hot corner if something changes
                // corner has it's own connect method defined in settings, this is not direct gsettings connect
                corner.connect('changed', (settings, key) => _updateCorner(corner, key, trigger), trigger);
            }

            if (_shouldExistHotCorner(corner)) {
                Main.layoutManager.hotCorners.push(new CustomHotCorner(corner));
                _updateWatchedCorners();
            }
        }
    }
}

function _setExpansionLimits(corners) {
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

function _shouldExistHotCorner(corner) {
    let answer = false;
    for (let trigger of listTriggers)
        answer = answer || (corner.action[trigger] !== 'disabled');

    return answer;
}

function _updateCorner(corner, key, trigger) {
    switch (key) {
        case 'action':
            corner.action[trigger] = corner.getAction(trigger);
            _rebuildHotCorner(corner);
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
        case 'barrier-size-h':
        case 'barrier-size-v':
            _rebuildHotCorner(corner);
            break;
        case 'pressure-threshold':
            _rebuildHotCorner(corner);
            break;
        case 'workspace-index':
            corner.workspaceIndex[trigger] = corner.getWorkspaceIndex(trigger);
            break;
        case 'h-expand':
            _updateHotCorners();
            break;
        case 'v-expand':
            _updateHotCorners();
            break;
        default:
            _rebuildHotCorner(corner);
    }
}

function _updateWatch() {
    _watch.active = _mscOptions.watchCorners;
    if (_watch.active && !_watch.timeout) {
        _watch.timeout = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            3000,
            () => {
                // some extensions can replace the function f.e. Dash to Panel
                if (Main.layoutManager._updateHotCorners !== _updateHotCorners)
                    Main.layoutManager._updateHotCorners = _updateHotCorners;

                if (Main.layoutManager.hotCorners !== _myCorners[0] ||
                    // some extensions (ArcMenu) can modify pressure barrier triggers, which normaly just emits a triggered event
                    (_myCorners[1] && Main.layoutManager.hotCorners[0]._pressureBarrier._trigger !== _myCorners[1])
                    ) {
                    _updateHotCorners();
                    // Main.notify(Me.metadata.name, `Hot Corners had to be updated because of external override`);
                    log(Me.metadata.name, 'Hot Corners had to be updated because of external override');
                }

                if (!_watch.active) {
                    _timeoutsCollector.splice(_timeoutsCollector.indexOf(_watch.timeout), 1);
                    _watch.timeout = null;
                }

                return _watch.active;
            }
        );
        _timeoutsCollector.push(_watch.timeout);
    }
}

function _updateWatchedCorners() {
    _myCorners[0] = Main.layoutManager.hotCorners;
    _myCorners[1] = Main.layoutManager.hotCorners[0] ? Main.layoutManager.hotCorners[0]._pressureBarrier._trigger : null;
}

function _rebuildHotCorner(corner) {
    _destroyHotCorner(corner);
    if (_shouldExistHotCorner(corner)) {
        Main.layoutManager.hotCorners.push(new CustomHotCorner(corner));
        _updateWatchedCorners();
    }
}

function _destroyHotCorner(corner) {
    let hc = Main.layoutManager.hotCorners;
    for (let i = 0; i < hc.length; i++) {
        if (hc[i]._corner.top  === corner.top &&
            hc[i]._corner.left === corner.left &&
            hc[i]._corner.monitorIndex === corner.monitorIndex) {
            for (let a of Main.layoutManager.hotCorners[i]._actors) {
                _actorsCollector.splice(_actorsCollector.indexOf(a), 1);
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

const CustomHotCorner = GObject.registerClass(
class CustomHotCorner extends Layout.HotCorner {
    _init(corner) {
        let monitor = Main.layoutManager.monitors[corner.monitorIndex];
        super._init(Main.layoutManager, monitor, corner.x, corner.y);
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
        this.setBarrierSize([corner.barrierSizeH, corner.barrierSizeV], false);

        if (this._corner.action[Triggers.PRESSURE] !== 'disabled' && !BARRIER_FALLBACK) {
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

            if (CORNERS_VISIBLE)
                this._drawBarriers(sizeH, sizeV);
        }
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
        _actorsCollector.push(this._actor);
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
        _actorsCollector.push(this._actor);
        this._actors.push(this._actor);
    }

    // Overridden original function
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
            name: 'hot-corner-h',
            x: this._corner.x + (this._corner.left ? 0 : -(hSize - 1)),
            y: this._corner.y + (this._corner.top  ? 0 : -(aSize - 1)),
            width: hSize,
            height: aSize,
            reactive: true,
            background_color: new Clutter.Color({
                red:   255,
                green: 120,
                blue:  0,
                // alpha: CORNERS_VISIBLE ? ((h || v) ? 50 : 120) : 0
                alpha: CORNERS_VISIBLE ? 255 : 0,
            }),

        });
        this._connectActorEvents(this._actor);
        this._actor.connect('destroy', () => {
            this._actor = null;
        });
        layoutManager.addChrome(this._actor);
        _actorsCollector.push(this._actor);
        this._actors.push(this._actor);

        // to expand clickable area in both axis make second actor
        if (v && h) {
            this._actorV = new Clutter.Actor({
                name: 'hot-corner-v',
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
                    // alpha: CORNERS_VISIBLE ? ((h || v) ? 50 : 120) : 0
                    alpha: CORNERS_VISIBLE ? 255 : 0,
                }),
            });
            this._connectActorEvents(this._actorV);
            this._actorV.connect('destroy', () => {
                this._actorV = null;
            });
            layoutManager.addChrome(this._actorV);
            _actorsCollector.push(this._actorV);
            this._actors.push(this._actorV);
        }
        // Fallback hot corners as a part of base actor
        if (this._corner.action[Triggers.PRESSURE] !== 'disabled' &&
            (!global.display.supports_extended_barriers() || BARRIER_FALLBACK)) {
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
                    // alpha: CORNERS_VISIBLE ? ((h || v) ? 50 : 120) : 0
                    alpha: CORNERS_VISIBLE ? 255 : 0,
                }),
            });
            this._actor.add_child(this._cornerActor);
            this._cornerActor.connect('enter-event', this._onPressureTriggered.bind(this));
        }
    }

    _connectActorEvents(actor) {
        if (this._shouldConnect([Triggers.BUTTON_PRIMARY, Triggers.BUTTON_SECONDARY, Triggers.BUTTON_MIDDLE])) {
            actor.connect('button-press-event', this._onCornerClicked.bind(this));
        }
        if (this._shouldConnect([Triggers.SCROLL_UP, Triggers.SCROLL_DOWN])) {
            actor.connect('scroll-event', this._onCornerScrolled.bind(this));
        }

    }

    _shouldCreateActor() {
        let answer = false;
        for (let trigger of listTriggers) {
            if (trigger === Triggers.PRESSURE && (global.display.supports_extended_barriers() && !BARRIER_FALLBACK))
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

    _ctrlPressed(mods) {
        return (mods & Clutter.ModifierType.CONTROL_MASK) !== 0;
    }

    _onPressureTriggered() {
        if (this._corner.ctrl[Triggers.PRESSURE]) {
            // neither the 'enter' nor pressure 'trigger' events contain modifier state
            let mods = global.get_pointer()[2];
            if (!this._ctrlPressed(mods))
                return;
        }
        this._runAction(Triggers.PRESSURE);
    }

    _onCornerClicked(actor, event) {
        // if (event.get_click_count() > 1) return; // ignore second click of double clicks
        let button = event.get_button();
        let trigger;
        let mods = event.get_state();
        switch (button) {
            case Clutter.BUTTON_PRIMARY:
                if (this._corner.ctrl[Triggers.BUTTON_PRIMARY] && !this._ctrlPressed(mods))
                    return;
                trigger = Triggers.BUTTON_PRIMARY;
                break;
            case Clutter.BUTTON_SECONDARY:
                if (this._corner.ctrl[Triggers.BUTTON_SECONDARY] && !this._ctrlPressed(mods))
                    return;
                trigger = Triggers.BUTTON_SECONDARY;
                break;
            case Clutter.BUTTON_MIDDLE:
                if (this._corner.ctrl[Triggers.BUTTON_MIDDLE] && !this._ctrlPressed(mods))
                    return;
                trigger = Triggers.BUTTON_MIDDLE;
                break;
            default:
                return Clutter.EVENT_PROPAGATE;
        }
        this._runAction(trigger);
        return Clutter.EVENT_STOP;
    }

    _onCornerScrolled(actor, event) {
        let direction = event.get_scroll_direction();
        let mods = event.get_state();

        if (_notValidScroll(direction))
            return;

        let trigger;
        switch (direction) {
            case Clutter.ScrollDirection.UP:
            case Clutter.ScrollDirection.LEFT:
                if (this._corner.ctrl[Triggers.SCROLL_UP] && !this._ctrlPressed(mods))
                    return;
                trigger = Triggers.SCROLL_UP;
                break;
            case Clutter.ScrollDirection.DOWN:
            case Clutter.ScrollDirection.RIGHT:
                if (this._corner.ctrl[Triggers.SCROLL_DOWN] && !this._ctrlPressed(mods))
                    return;
                trigger = Triggers.SCROLL_DOWN;
                break;
            default:
                return Clutter.EVENT_PROPAGATE;
        }

        this._runAction(trigger);
        return Clutter.EVENT_STOP;
    }

    _runAction(trigger) {
        if ((_actionTimeoutActive(trigger) && !['volumeUp', 'volumeDown'].includes(this._corner.action[trigger])) ||
            this._corner.action[trigger] === 'disabled')
            return;
        if (!this._monitor.inFullscreen ||
            (this._monitor.inFullscreen && (this._corner.fullscreen[trigger] || FULLSCREEN_GLOBAL))) {
            if (RIPPLE_ANIMATION)
                this._rippleAnimation();
            actionTrigger.runAction(this._corner.action[trigger],
                                    this._corner.monitorIndex,
                                    this._corner.workspaceIndex[trigger],
                                    this._corner.command[trigger]
            );
        }
    }
});

function _removeActionTimeout() {
    _timeoutsCollector.splice(_timeoutsCollector.indexOf(_actionTimeoutId), 1);
    _actionTimeoutId = null;
    return false;
}

function _notValidScroll(direction) {
    if (direction === Clutter.ScrollDirection.SMOOTH)
        return true;
    return false;
}

function _actionTimeoutActive() {
    if (_actionTimeoutId)
        return true;

    _actionTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            ACTION_TIMEOUT,
            _removeActionTimeout
        );
    _timeoutsCollector.push(_actionTimeoutId);
    return false;
}



const ActionTrigger = class ActionTrigger {
    constructor(mscOptions) {
        this._gsettingsKB = mscOptions._gsettingsKB;
        this._monitorIndex = 0;
        this._workspaceIndex = 0;
        this._command = '';
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
    }

    runAction(action, monitorIndex = 0, workspaceIndex = 0, command = '', keyboard = false) {
        this._monitorIndex = monitorIndex;
        this._command = command;
        this._workspaceIndex = workspaceIndex;
        this._triggeredByKeyboard = keyboard;
        let actionFunction = this.m.get(action).bind(this) || function () {};
        actionFunction();
    }

    clean(full = true) {
        /* if (full) {
        } */
        this._removeShortcuts();
        this._disconnectSettingsKB();
    }

    _bindShortcuts() {
        for (let key of this._gsettingsKB.list_keys()) {
            let action = this._translateKeyToAction(key);
            if (this._gsettingsKB.get_strv(key)[0]) {
                this._bindShortcut(key, action);
                this._shortcutsBindingIds.push(key);
            }
        }
        this._gsettingsKBid = this._gsettingsKB.connect('changed', this._updateKeyBinding.bind(this));
    }

    _bindShortcut(key, action) {
        Main.wm.addKeybinding(key,
                              this._gsettingsKB,
                              Meta.KeyBindingFlags.NONE,
                              Shell.ActionMode.ALL,
                              () => {
                                    this._runKeyAction(action);
                              }
        );
    }

    _runKeyAction(action) {
        // notify the trigger that the action was invoked by the keyboard
        this.runAction(action, 0, 0, '', true);
    }

    _updateKeyBinding(settings, key) {
        if (settings.get_strv(key)[0])
            this._bindShortcut(key, this._translateKeyToAction(key));
    }

    _removeShortcuts() {
        for (let key of this._shortcutsBindingIds)
            Main.wm.removeKeybinding(key);
        this._shortcutsBindingIds = [];
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
        actions.toggleOverview();
    }

    _showApplications() {
        actions.showApplications();
    }

    _showDesktop() {
        actions.togleShowDesktop();
    }

    _showDesktopMon() {
        actions.togleShowDesktop(global.display.get_current_monitor());
    }

    _blackScreen() {
        let opacity = 255;
        let note = Me.metadata.name;
        actions.toggleDimmMonitors(
            opacity,
            note
        );
    }

    _blackScreenMon() {
        let opacity = 255;
        let note = Me.metadata.name;
        actions.toggleDimmMonitors(
            opacity,
            note,
            global.display.get_current_monitor()
        );
    }

    _runCommand() {
        actions.runCommand(this._command);
    }

    _runDialog() {
        actions.openRunDialog();
    }

    _moveToWorkspace() {
        actions.moveToWorkspace(this._workspaceIndex - 1);
    }

    _prevWorkspace() {
        actions.switchWorkspace(Clutter.ScrollDirection.UP);
    }

    _nextWorkspace() {
        actions.switchWorkspace(Clutter.ScrollDirection.DOWN);
    }

    _prevWorkspaceOverview() {
        actions.switchWorkspace(Clutter.ScrollDirection.UP);
        Main.overview.dash.showAppsButton.checked = false;
        Main.overview.show();
    }

    _nextWorkspaceOverview() {
        actions.switchWorkspace(Clutter.ScrollDirection.DOWN);
        Main.overview.dash.showAppsButton.checked = false;
        Main.overview.show();
    }

    _recentWorkspace() {
        actions.moveToRecentWorkspace();
    }

    _reorderWsPrev() {
        actions.reorderWorkspace(-1);
    }

    _reorderWsNext() {
        actions.reorderWorkspace(+1);
    }

    _prevWinAll() {
        actions.switchWindow(-1, false, -1);
    }

    _nextWinAll() {
        actions.switchWindow(+1, false, -1);
    }

    _prevWinWs() {
        actions.switchWindow(-1, true, -1);
    }

    _nextWinWs() {
        actions.switchWindow(+1, true, -1);
    }

    _prevWinMon() {
        actions.switchWindow(-1, true, global.display.get_current_monitor());
    }

    _nextWinMon() {
        actions.switchWindow(+1, true, global.display.get_current_monitor());
    }

    _recentWin() {
        actions.switchToRecentWindow();
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
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-all-ce'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupWs() {
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        2,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-ws-ce'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupMon() {
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        3,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-mon-ce'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupApps() {
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         3,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-apps-ce'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupClass() {
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-class-ce'),
            'filter-focused-app': true,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupWsFirst() {
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         2,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-ws-first-ce'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _prevWorkspacePopup() {
        actions.switchWorkspace(Clutter.ScrollDirection.UP, false);
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   false,
            'filter-mode':        2,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           null,
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _nextWorkspacePopup() {
        actions.switchWorkspace(Clutter.ScrollDirection.DOWN, false);
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   false,
            'filter-mode':        2,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           null,
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _winSwitcherPopupSearch() {
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           this._getShortcut('win-switcher-popup-all-ce'),
            'filter-focused-app': false,
            'filter-pattern':     null,
        });
    }

    _appSwitcherPopupAll() {
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        1,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           this._getShortcut('app-switcher-popup-all-ce'),
            'filter-focused-app': false,
            'filter-pattern':     null,
            'apps':               true,
        });
    }

    _appSwitcherPopupWs() {
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        2,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           this._getShortcut('app-switcher-popup-ws-ce'),
            'filter-focused-app': false,
            'filter-pattern':     null,
            'apps':               true,
        });
    }

    _appSwitcherPopupMon() {
        actions.showWindowSwitcherPopup({
            'monitor-index':      -1,
            'position-pointer':   null,
            'filter-mode':        3,
            'group-mode':         0,
            'timeout':            0,
            'triggered-keyboard': this._triggeredByKeyboard,
            'shortcut':           this._getShortcut('app-switcher-popup-mon-ce'),
            'filter-focused-app': false,
            'filter-pattern':     null,
            'apps':               true,
        });
    }

    _closeWin() {
        actions.closeWindow();
    }

    _quitApp() {
        actions.quitApplication();
    }

    _killApp() {
        actions.killApplication();
    }

    _maximizeWin() {
        actions.toggleMaximizeWindow();
    }

    _minimizeWin() {
        actions.minimizeWindow();
    }

    _fullscreenOnEmptyWs() {
        actions.fullscreenWinOnEmptyWs();
    }

    _unminimizeAllWs() {
        actions.unminimizeAll(true);
    }

    _fullscreenWin() {
        actions.toggleFullscreenWindow();
    }

    _aboveWin() {
        actions.toggleAboveWindow();
    }

    _stickWin() {
        actions.toggleStickWindow();
    }

    _restartShell() {
        actions.restartGnomeShell();
    }

    _volumeUp() {
        actions.adjustVolume(1);
    }

    _volumeDown() {
        actions.adjustVolume(-1);
    }

    _muteSound() {
        actions.adjustVolume(0);
    }

    _lockScreen() {
        actions.lockScreen();
    }

    _suspend() {
        actions.suspendToRam();
    }

    _powerOff() {
        actions.powerOff();
    }

    _logOut() {
        actions.logOut();
    }

    _switchUser() {
        actions.switchUser();
    }

    _lookingGlass() {
        actions.toggleLookingGlass();
    }

    _prefs() {
        actions.openPreferences();
    }

    _toggleZoom() {
        actions.zoom(0);
    }

    _zoomIn() {
        actions.zoom(0.25);
    }

    _zoomOut() {
        actions.zoom(-0.25);
    }

    _keyboard() {
        actions.toggleKeyboard(global.display.get_current_monitor());
    }

    _screenReader() {
        actions.toggleScreenReader();
    }

    _largeText() {
        actions.toggleLargeText();
    }

    _hidePanel() {
        actions.toggleShowPanel();
    }

    _toggleTheme() {
        actions.toggleTheme();

    }

    _invertLightAll() {
        actions.toggleLightnessInvertEffect(false, false);
    }

    _invertLightWin() {
        actions.toggleLightnessInvertEffect(true, false);
    }

    _invertLightShiftAll() {
        actions.toggleLightnessInvertEffect(false, true);
    }

    _invertLightShiftWin() {
        actions.toggleLightnessInvertEffect(true, true);
    }

    _invertColorsWin() {
        actions.toggleColorsInvertEffect(true);
    }

    _protanToggleAll() {
        actions.toggleColorBlindShaderEffect(true, 1, false);
    }

    _deuterToggleAll() {
        actions.toggleColorBlindShaderEffect(true, 2, false);
    }

    _tritanToggleAll() {
        actions.toggleColorBlindShaderEffect(true, 3, false);
    }

    _protanSimToggleAll() {
        actions.toggleColorBlindShaderEffect(true, 1, true);
    }

    _deuterSimToggleAll() {
        actions.toggleColorBlindShaderEffect(true, 2, true);
    }

    _tritanSimToggleAll() {
        actions.toggleColorBlindShaderEffect(true, 3, true);
    }

    _mixerGbrToggleAll() {
        actions.toggleColorMixerEffect(true, 1);
    }

    _desaturateAll() {
        actions.toggleDesaturateEffect(false);
    }

    _desaturateWin() {
        actions.toggleDesaturateEffect(true);
    }

    _brightUpAll() {
        actions.adjustSwBrightnessContrast(+0.025);
    }

    _brightDownAll() {
        actions.adjustSwBrightnessContrast(-0.025);
    }

    _brightUpWin() {
        actions.adjustSwBrightnessContrast(+0.025, true);
    }

    _brightDownWin() {
        actions.adjustSwBrightnessContrast(-0.025, true);
    }

    _contrastUpAll() {
        actions.adjustSwBrightnessContrast(+0.025, false, false);
    }

    _contrastDownAll() {
        actions.adjustSwBrightnessContrast(-0.025, false, false);
    }

    _contrastUpWin() {
        actions.adjustSwBrightnessContrast(+0.025, true, false);
    }

    _contrastDownWin() {
        actions.adjustSwBrightnessContrast(-0.025, true, false);
    }

    _contrastHighWin() {
        actions.adjustSwBrightnessContrast(null, true, false, 0.2);
    }

    _contrastHighAll() {
        actions.adjustSwBrightnessContrast(null, false, false, 0.2);
    }

    _contrastLowWin() {
        actions.adjustSwBrightnessContrast(null, true, false, -0.1);
    }

    _contrastLowAll() {
        actions.adjustSwBrightnessContrast(null, false, false, -0.1);
    }

    _opacityUpWin() {
        actions.adjustWindowOpacity(+12);
    }

    _opacityDownWin() {
        actions.adjustWindowOpacity(-12);
    }

    _opacityToggleWin() {
        actions.adjustWindowOpacity(0, 200);
    }

    _opacityToggleHcWin() {
        actions.adjustWindowOpacity(0, 200);
        actions.adjustSwBrightnessContrast(null, true, false, 0.2);
    }

    _opacityToggleLcWin() {
        actions.adjustWindowOpacity(0, 240);
        actions.adjustSwBrightnessContrast(null, true, false, 0.05);
    }

    _nightLightToggle() {
        actions.toggleNightLight();
    }

    _tintRedToggleWin() {
        actions.toggleColorTintEffect(
            new Clutter.Color({
                red:    255,
                green:  200,
                blue:   146,
            }),
            true);
    }

    _tintRedToggleAll() {
        actions.toggleColorTintEffect(
            new Clutter.Color({
                red:    255,
                green:  200,
                blue:   146,
            }),
            false);
    }

    _tintGreenToggleWin() {
        actions.toggleColorTintEffect(
            new Clutter.Color({
                red:    200,
                green:  255,
                blue:   146,
            }),
            true);
    }

    _tintGreenToggleAll() {
        actions.toggleColorTintEffect(
            new Clutter.Color({
                red:    200,
                green:  255,
                blue:   146,
            }),
            false);
    }

    _removeEffectsWin() {
        actions.removeWinEffects(true);
    }

    _removeEffectsAll() {
        actions.removeAllEffects(true);
    }

    _makeThumbnailWin() {
        actions.makeThumbnailWindow();
    }

    _minimizeToThumbnail() {
        actions.makeThumbnailWindow();
        actions.minimizeWindow();
    }

    _removeWinThumbnails() {
        actions._removeThumbnails(true);
    }

    _showCustomMenu1() {
        actions.showCustomMenu(this, 1);
    }

    _showCustomMenu2() {
        actions.showCustomMenu(this, 2);
    }

    _showCustomMenu3() {
        actions.showCustomMenu(this, 3);
    }

    _showCustomMenu4() {
        actions.showCustomMenu(this, 4);
    }
};