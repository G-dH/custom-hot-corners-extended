/**
 * Custom Hot Corners - Extended
 * Hot Corners
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Layout from 'resource:///org/gnome/shell/ui/layout.js';

import * as Settings from '../common/settings.js';

// Cogl.Color replaces Clutter.Color in GS 47
const Color = Clutter.Color ? Clutter.Color : Cogl.Color;

const Triggers               = Settings.Triggers;

const HOT_CORNER_PRESSURE_TIMEOUT = 1000; // ms

let _chce;

export function init(chce) {
    _chce = chce;
}

export function cleanGlobals() {
    _chce = null;
}

export const CustomHotCorner = GObject.registerClass(
class CustomHotCorner extends Layout.HotCorner {
    _init(corner) {
        this._chce = _chce;
        this._lastActionTime = 0;
        this._mscOptions = this._chce._mscOptions;
        let monitor = Main.layoutManager.monitors[corner.monitorIndex];
        super._init(Main.layoutManager, monitor, corner.x, corner.y);
        this._actionTimeoutId = this._chce._actionTimeoutId;
        this._corner  = corner;
        this._monitor = monitor;
        this._actors  = [];
        this._corner.hotCornerExists = true;
        this._listTriggers = Settings.listTriggers();

        if (this._hotCornerEnabled() && !this._chce.BARRIER_FALLBACK) {
            this._pressureBarrier = new Layout.PressureBarrier(
                corner.get('pressureThreshold'),
                HOT_CORNER_PRESSURE_TIMEOUT,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW
            );
            this.setBarrierSize([corner.get('barrierSizeH'), corner.get('barrierSizeV')], false);
            this._pressureBarrier.connect('trigger', this._onPressureTriggered.bind(this));
        }
        this._setupCornerActorsIfNeeded(Main.layoutManager);

        let ltr = Clutter.get_default_text_direction() === Clutter.TextDirection.LTR;

        let angle;
        if (this._corner.left && ltr)
            angle = this._corner.top ? 0 : 270;
        else
            angle = this._corner.top ? 90 : 180;

        this._ripples._ripple1.rotation_angle_z = angle;
        this._ripples._ripple2.rotation_angle_z = angle;
        this._ripples._ripple3.rotation_angle_z = angle;
    }

    _onDestroy() {
        this.setBarrierSize([0, 0], false);
        this._actors.forEach(actor => {
            _chce._actorsCollector.splice(_chce._actorsCollector.indexOf(actor), 1);
            actor.destroy();
        });

        this._ripples.destroy();
        this._pressureBarrier.destroy();
        this._pressureBarrier = null;
    }

    // Overridden to allow all 4 monitor corners
    setBarrierSize(size, foreignAccess = true) {
        if (foreignAccess)
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
            let x = this._corner.x;
            if (!Meta.is_wayland_compositor() && !this._corner.left && !this._barrierCollision()['x'])
                x += 1;

            // GS 46+ replaced the Meta.Barrier.display property with backend
            if (Meta.Barrier.prototype.backend) {
                this._verticalBarrier = new Meta.Barrier({
                    backend: global.backend,
                    x1: x,
                    x2: x,
                    y1: this._corner.y,
                    y2: this._corner.top ? this._corner.y + sizeV : this._corner.y - sizeV,
                    directions: this._corner.left ? BD.POSITIVE_X : BD.NEGATIVE_X,
                });
            } else {
                this._verticalBarrier = new Meta.Barrier({
                    display: global.display,
                    x1: x,
                    x2: x,
                    y1: this._corner.y,
                    y2: this._corner.top ? this._corner.y + sizeV : this._corner.y - sizeV,
                    directions: this._corner.left ? BD.POSITIVE_X : BD.NEGATIVE_X,
                });
            }
            let y = this._corner.y;
            if (!Meta.is_wayland_compositor() && !this._corner.top && !this._barrierCollision()['y'])
                y += 1;

            if (Meta.Barrier.prototype.backend) {
                this._horizontalBarrier = new Meta.Barrier({
                    backend: global.backend,
                    x1: this._corner.x,
                    x2: this._corner.left ? this._corner.x + sizeH : this._corner.x - sizeH,
                    y1: y,
                    y2: y,
                    directions: this._corner.top ? BD.POSITIVE_Y : BD.NEGATIVE_Y,
                });
            } else {
                this._horizontalBarrier = new Meta.Barrier({
                    display: global.display,
                    x1: this._corner.x,
                    x2: this._corner.left ? this._corner.x + sizeH : this._corner.x - sizeH,
                    y1: y,
                    y2: y,
                    directions: this._corner.top ? BD.POSITIVE_Y : BD.NEGATIVE_Y,
                });
            }

            this._pressureBarrier.addBarrier(this._verticalBarrier);
            this._pressureBarrier.addBarrier(this._horizontalBarrier);

            if (this._chce.CORNERS_VISIBLE && this._hotCornerEnabled() && !this._chce.BARRIER_FALLBACK)
                this._drawBarriers(sizeH, sizeV);
        }
    }

    _hotCornerEnabled() {
        return this._corner.get('action', Triggers.PRESSURE) !== 'disabled' || this._corner.get('action', Triggers.CTRL_PRESSURE) !== 'disabled';
    }

    _barrierCollision() {
        // avoid barrier collisions on multi-monitor system under X11 session
        let x = false;
        let y = false;
        for (let c of Main.layoutManager.hotCorners) {
            if (this._corner.x + 1 === c._corner.x)
                x =  true;

            if (this._corner.y + 1 === c._corner.y)
                y =  true;
        }
        return { x, y };
    }

    _drawBarriers(sizeH, sizeV) {
        // show horizontal barrier
        let actorH = new Clutter.Actor({
            name: 'barrier-h',
            x: this._corner.x - (this._corner.left ? 0 : sizeH),
            y: this._corner.y + (this._corner.top ? 1 : -1),
            width: sizeH,
            height: 1,
            reactive: false,
            background_color: new Color({
                red:   0,
                green: 255,
                blue:  0,
                alpha: 180,
            }),

        });

        this._connectActorEvents(actorH);
        actorH.connect('destroy', () => {
            actorH = null;
        });

        Main.layoutManager.addTopChrome(actorH);
        this._chce._actorsCollector.push(actorH);
        this._actors.push(actorH);

        // show vertical barrier
        let actorV = new Clutter.Actor({
            name: 'barrier-h',
            x: this._corner.x + (this._corner.left ? 1 : -1),
            y: this._corner.y - (this._corner.top ? 0 : sizeV),
            width: 1,
            height: sizeV,
            reactive: false,
            background_color: new Color({
                red:   0,
                green: 255,
                blue:  0,
                alpha: 180,
            }),
        });

        this._connectActorEvents(actorV);
        actorV.connect('destroy', () => {
            actorV = null;
        });

        Main.layoutManager.addTopChrome(actorV);
        this._chce._actorsCollector.push(actorV);
        this._actors.push(actorV);
    }

    _setupCornerActorsIfNeeded(layoutManager) {
        let shouldCreateActor = this._shouldCreateActor();
        if (!(shouldCreateActor || this._corner.get('hExpand') || this._corner.get('vExpand')))
            return;
        let aSize = 3;
        let h = this._corner.get('hExpand');
        let v = this._corner.get('vExpand');
        aSize = (h || v) && shouldCreateActor ? 1 : aSize;
        let hSize = aSize;
        let vSize = aSize;

        if ((h || v) && shouldCreateActor) {
            let geometry = global.display.get_monitor_geometry(this._corner.monitorIndex);
            hSize = this._corner.fullExpandHorizontal ? geometry.width / 8 * 7 : geometry.width / 2 - 5;
            vSize = this._corner.fullExpandVertical ? geometry.height / 8 * 7 : geometry.height / 2 - 5;
        }
        // the corner's reactive area can be expanded horizontally and/or vertically
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
            background_color: new Color({
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
        layoutManager.addTopChrome(this._actor);
        this._chce._actorsCollector.push(this._actor);
        this._actors.push(this._actor);

        // to expand clickable area in both axis make second actor
        if (v && h) {
            this._actorV = new Clutter.Actor({
                name: 'hot-corner-secondary',
                x: this._corner.x + (this._corner.left ? 0 : -(aSize - 1)),
                // avoid overlap with main actor
                y: this._corner.y + (this._corner.top  ? 1 : -vSize),
                width: aSize,
                height: vSize,
                reactive: true,
                background_color: new Color({
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
            layoutManager.addTopChrome(this._actorV);
            this._chce._actorsCollector.push(this._actorV);
            this._actors.push(this._actorV);
        }
        // Fallback hot corners as a part of base actor
        if (this._corner.get('action', Triggers.PRESSURE) !== 'disabled' && this._chce.BARRIER_FALLBACK) {
            let fSize = 3;
            this._cornerActor = new Clutter.Actor({
                name:     'hot-corner',
                x:        this._corner.left ? 0 : (this._actor.width  - 1) - (fSize - 1),
                y:        this._corner.top  ? 0 : (this._actor.height - 1) - (fSize - 1),
                width:    fSize,
                height:   fSize,
                reactive: true,
                visible:  true,
                background_color: new Color({
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
        const mouseBtnEvent = this._mscOptions.get('buttonsTriggerOnPress') ? 'button-press-event' : 'button-release-event';
        if (this._shouldConnect([Triggers.BUTTON_PRIMARY, Triggers.BUTTON_SECONDARY, Triggers.BUTTON_MIDDLE]))
            actor.connect(mouseBtnEvent, this._onCornerClicked.bind(this));

        if (this._shouldConnect([Triggers.SCROLL_UP, Triggers.SCROLL_DOWN]))
            actor.connect('scroll-event', this._onCornerScrolled.bind(this));
    }

    _shouldCreateActor() {
        for (let trigger of this._listTriggers) {
            if (trigger === Triggers.PRESSURE && !this._chce.BARRIER_FALLBACK)
                continue;
            if (this._corner.get('action', trigger) !== 'disabled')
                return true;
        }
        return false;
    }

    _shouldConnect(signals) {
        for (let trigger of this._listTriggers) {
            if (signals.includes(trigger)) {
                if (this._corner.get('action', trigger) !== 'disabled')
                    return true;
            }
        }
        return false;
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
            if (this._mscOptions.get('hotCornersRequireShift') && !this._shiftPressed())
                return;
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
            if (!(this._corner.get('ctrl', Triggers.BUTTON_PRIMARY) && !this._ctrlPressed()))
                trigger = Triggers.BUTTON_PRIMARY;
            break;
        case Clutter.BUTTON_SECONDARY:
            if (!(this._corner.get('ctrl', Triggers.BUTTON_SECONDARY) && !this._ctrlPressed()))
                trigger = Triggers.BUTTON_SECONDARY;
            break;
        case Clutter.BUTTON_MIDDLE:
            if (!(this._corner.get('ctrl', Triggers.BUTTON_MIDDLE) && !this._ctrlPressed()))
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
        const direction = this._getScrollDirection(event);
        if (direction === null)
            return Clutter.EVENT_PROPAGATE;

        let trigger = null;
        switch (direction) {
        case Clutter.ScrollDirection.UP:
        case Clutter.ScrollDirection.LEFT:
            if (!(this._corner.get('ctrl', Triggers.SCROLL_UP) && !this._ctrlPressed()))
                trigger = Triggers.SCROLL_UP;
            break;
        case Clutter.ScrollDirection.DOWN:
        case Clutter.ScrollDirection.RIGHT:
            if (!(this._corner.get('ctrl', Triggers.SCROLL_DOWN) && !this._ctrlPressed()))
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

    _getScrollDirection(event) {
        // scroll wheel provides two types of direction information:
        // 1. Clutter.ScrollDirection.DOWN / Clutter.ScrollDirection.UP
        // 2. Clutter.ScrollDirection.SMOOTH + event.get_scroll_delta()
        // first SMOOTH event returns 0 delta,
        //  so we need to always read event.direction
        //  since mouse without smooth scrolling provides exactly one SMOOTH event on one wheel rotation click
        // on the other hand, under X11, one wheel rotation click sometimes doesn't send direction event, only several SMOOTH events
        // so we also need to convert the delta to direction
        let direction = event.get_scroll_direction();

        if (direction !== Clutter.ScrollDirection.SMOOTH)
            return direction;

        let [, delta] = event.get_scroll_delta();

        if (!delta)
            return null;

        direction = delta > 0 ? Clutter.ScrollDirection.DOWN : Clutter.ScrollDirection.UP;

        return direction;
    }

    _runAction(trigger) {
        const timeoutWhitelist = ['volume-up', 'volume-down', 'display-brightness-up', 'display-brightness-down', 'swipe-ws-up', 'swipe-ws-down', 'swipe-overview-up', 'swipe-overview-down'];
        if ((this._actionTimeoutActive(trigger) && !timeoutWhitelist.includes(this._corner.get('action', trigger))) ||
            this._corner.get('action', trigger) === 'disabled')
            return false;
        if (!(this._monitor.inFullscreen && !this._corner.get('fullscreen', trigger))) {
            if (this._chce.RIPPLE_ANIMATION)
                this._rippleAnimation();
            this._chce.actionTrigger.runActionData.action = this._corner.get('action', trigger);
            this._chce.actionTrigger.runActionData.monitorIndex = this._corner.monitorIndex;
            this._chce.actionTrigger.runActionData.workspaceIndex = this._corner.get('workspaceIndex', trigger);
            this._chce.actionTrigger.runActionData.command = this._corner.get('command', trigger);
            this._chce.actionTrigger.runActionData.keyboard = false;
            return this._chce.actionTrigger.runAction();
        }
        return false;
    }

    _actionTimeoutActive() {
        if (Date.now() - this._lastActionTime > this._mscOptions.get('actionEventDelay')) {
            this._lastActionTime = Date.now();
            return false;
        }
        return true;
    }
});
