/**
 * Custom Hot Corners - Extended
 * Hot Corners
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2022
 * @license    GPL-3.0
 */

'use strict';

const { GObject, GLib, Clutter, Meta, Shell } = imports.gi;

const Main                   = imports.ui.main;
const Layout                 = imports.ui.layout;

const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();
const Utils                  = Me.imports.src.common.utils;
const Settings               = Me.imports.src.common.settings;
const ActionTrigger          = Me.imports.src.extension.actionTrigger;
const PanelButton            = Me.imports.src.extension.panelButton;

const listTriggers           = Settings.listTriggers();
const Triggers               = Settings.Triggers;
const _origUpdateHotCorners  = imports.ui.layout.LayoutManager.prototype._updateHotCorners;

let ACTION_TIMEOUT = 100;

let chce;


var CustomHotCornersExtended = class CustomHotCornersExtended {
    constructor() {
        chce                       = this;
        //this._originalHotCornerEnabled;
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
    }

    enable() {
        // delayed start to avoid initial hot corners overrides from other extensions
        // and also to not slowing down the screen unlock animation - the killer is registration of keyboard shortcuts
        //this._originalHotCornerEnabled = Main.layoutManager._interfaceSettings.get_boolean('enable-hot-corners');
        //Main.layoutManager._interfaceSettings.set_boolean('enable-hot-corners', false);
        let enableDelay;
        if (this.actionTrigger) {
            enableDelay = 1;
            this.actionTrigger.actions.resume();
        } else {
            enableDelay = 4;
        }

        this._delayId = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT,
            enableDelay,
            () => {
                //Main.layoutManager._interfaceSettings.set_boolean('enable-hot-corners', false);
                this._extensionEnabled = true;
                this._mscOptions = new Settings.MscOptions();
                if (!this.actionTrigger) {
                    this.actionTrigger = new ActionTrigger.ActionTrigger(this._mscOptions);
                }
                else {
                    this.actionTrigger._bindShortcuts();
                }

                this._updateMscOptions(null, true);
                this._replace_updateHotCornersFunc();
                this._updateWatch();
                this._updateSupportedExtensionsAvailability();
                this._mscOptions.set('showOsdMonitorIndexes', false);
                this._mscOptions.connect('changed', (settings, key) => this._updateMscOptions(key));

                log(`${Me.metadata.name}: enabled`);

                this._panelButton = new PanelButton.MenuButton(this._mscOptions);
                Main.panel.addToStatusArea("CustomHotCorners", this._panelButton, 0, "right");

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
        this._timeoutsCollector.forEach(c => GLib.Source.remove(c));
        this._timeoutsCollector = [];
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
        //Main.layoutManager._interfaceSettings.set_boolean('enable-hot-corners', true);
        Main.layoutManager._updateHotCorners = _origUpdateHotCorners;
        Main.layoutManager._updateHotCorners();

        this._myCorners = [null, null];

        this._panelButton.destroy();

        log(`${Me.metadata.name}: ${fullDisable ? 'disabled' : 'suspended'}`);
    }

    _replace_updateHotCornersFunc() {
        Main.layoutManager._updateHotCorners = this._updateHotCorners;
        Main.layoutManager._updateHotCorners();
    }

    _updateSupportedExtensionsAvailability(reset = false) {
        let supportedExtensions = [];
        if (!reset) {
            // test ArcMenu
            if (global.toggleArcMenu)
                supportedExtensions.push('ArcMenu');
            // test AATWS
            const aatws = imports.ui.altTab.WindowSwitcherPopup.prototype;
            if (aatws._showPopup || aatws.showOrig)
                supportedExtensions.push('AATWS');
            if (global.workspaceManager.layout_rows === -1)
                supportedExtensions.push('VerticalWS')
        }
        this._mscOptions.set('supportedExtensions', supportedExtensions);
    }

    _updateMscOptions(key, doNotUpdateHC = false) {
        const actions = this.actionTrigger.actions;
        if (key === 'show-osd-monitor-indexes') {
            this._updateOsdMonitorIndexes();
        }
        actions.WIN_WRAPAROUND = this._mscOptions.get('winSwitchWrap');
        actions.WIN_SKIP_MINIMIZED  = this._mscOptions.get('winSkipMinimized');
        actions.WIN_STABLE_SEQUENCE = this._mscOptions.get('winStableSequence');
        ACTION_TIMEOUT = this._mscOptions.get('actionEventDelay');
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

        if (key === 'buttons-trigger-on-press') {
            this._updateHotCorners();
        }
    }

    _updateOsdMonitorIndexes() {
        if (this._mscOptions.get('showOsdMonitorIndexes')) {
            this.actionTrigger.actions._showMonitorIndexesOsd();
        }
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

        for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
            // Monitor 1 in preferences will always refer to the primary monitor
            const corners = Settings.Corner.forMonitor(i, monIndexes[i], global.display.get_monitor_geometry(monIndexes[i]));
            chce._setExpansionLimits(corners);

            for (let corner of corners) {
                chce._cornersCollector.push(corner);

                for (let trigger of listTriggers) {
                    // Update hot corner if something changes
                    // corner has it's own connect method defined in settings, this is not direct gsettings connect
                    //corner.connect('changed', (settings, key) => chce._updateCorner(corner, key, trigger), trigger);
                    corner.connect('changed', chce._updateHotCorners, trigger);
                }
                if (chce._shouldExistHotCorner(corner)) {
                    Main.layoutManager.hotCorners.push(new CustomHotCorner(corner, chce));
                    chce._updateWatchedCorners();
                    if (i === 0 && corner.top && !corner.left) {
                        chce._removePanelBarrier();
                    }
                }
            }
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
        for (let trigger of listTriggers)
            answer = answer || (corner.action[trigger] !== 'disabled');

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
                        log(Me.metadata.name, 'Hot Corners had to be updated because of external override');
                        return this._watch.active;
                    }
                    // some extensions (ArcMenu) can modify pressure barrier triggers, which normally just emits a triggered event
                    if ((this._myCorners[1] && Main.layoutManager.hotCorners[0] && Main.layoutManager.hotCorners[0]._pressureBarrier._trigger !== this._myCorners[1])) {
                        this._updateHotCorners();
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
        this._myCorners[0] = [...Main.layoutManager.hotCorners];
        this._myCorners[1] = Main.layoutManager.hotCorners[0] ? Main.layoutManager.hotCorners[0]._pressureBarrier._trigger : null;
    }
}

const CustomHotCorner = GObject.registerClass(
class CustomHotCorner extends Layout.HotCorner {
    _init(corner, chce) {
        this._chce = chce;
        this._lastActionTime = 0;
        this._mscOptions = this._chce._mscOptions;
        let monitor = Main.layoutManager.monitors[corner.monitorIndex];
        super._init(Main.layoutManager, monitor, corner.x, corner.y);
        this._actionTimeoutId = this._chce._actionTimeoutId;
        this._corner  = corner;
        this._monitor = monitor;
        this._actors  = [];
        this._corner.hotCornerExists = true;

        if (this._hotCornerEnabled() && !this._chce.BARRIER_FALLBACK) {
            this._pressureBarrier = new Layout.PressureBarrier(
                corner.get('pressureThreshold'),
                Layout.HOT_CORNER_PRESSURE_TIMEOUT,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW
            );
            this.setBarrierSize([corner.get('barrierSizeH'), corner.get('barrierSizeV')], false);
            this._pressureBarrier.connect('trigger', this._onPressureTriggered.bind(this));
        }
        this._setupCornerActorsIfNeeded(Main.layoutManager);

        let ltr = Clutter.get_default_text_direction() === Clutter.TextDirection.LTR;
        let angle = this._corner.left && ltr ? (this._corner.top ? 0 : 270) : (this._corner.top ? 90 : 180);
        this._ripples._ripple1.rotation_angle_z = angle;
        this._ripples._ripple2.rotation_angle_z = angle;
        this._ripples._ripple3.rotation_angle_z = angle;
    }

    _onDestroy() {
        this.setBarrierSize([0, 0], false);
        this._actors.forEach(actor => {
            chce._actorsCollector.splice(chce._actorsCollector.indexOf(actor), 1);
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
        return {'x': x, 'y': y};
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
            background_color: new Clutter.Color({
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

        Main.layoutManager.addChrome(actorH);
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
            background_color: new Clutter.Color({
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

        Main.layoutManager.addChrome(actorV);
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
        if (this._corner.get('action', Triggers.PRESSURE) !== 'disabled' &&
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
        const mouseBtnEvent = this._mscOptions.get('buttonsTriggerOnPress') ? 'button-press-event' : 'button-release-event';
        if (this._shouldConnect([Triggers.BUTTON_PRIMARY, Triggers.BUTTON_SECONDARY, Triggers.BUTTON_MIDDLE])) {
            actor.connect(mouseBtnEvent, this._onCornerClicked.bind(this));
        }
        if (this._shouldConnect([Triggers.SCROLL_UP, Triggers.SCROLL_DOWN])) {
            actor.connect('scroll-event', this._onCornerScrolled.bind(this));
        }
    }

    _shouldCreateActor() {
        for (let trigger of listTriggers) {
            if (trigger === Triggers.PRESSURE && (global.display.supports_extended_barriers() && !this._chce.BARRIER_FALLBACK))
                continue;
            if (this._corner.get('action', trigger) !== 'disabled')
                return true;
        }
        return false;
    }

    _shouldConnect(signals) {
        for (let trigger of listTriggers) {
            if (signals.includes(trigger))
                if (this._corner.get('action', trigger) !== 'disabled')
                    return true;
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
            return;

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
        if (Date.now() - this._lastActionTime > ACTION_TIMEOUT) {
            this._lastActionTime = Date.now();
            return false;
        }
        return true;
    }
});
