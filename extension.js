/* Copyright 2017 Jan Runge <janrunx@gmail.com>
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

const Workspace = imports.ui.workspace;

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;

const Main = imports.ui.main;
const Layout = imports.ui.layout;
const Ripples = imports.ui.ripples;
const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;

const triggers = Settings.listTriggers();
const Triggers = Settings.Triggers;

let _origUpdateHotCorners = Main.layoutManager._updateHotCorners;
let _collector = [];
let _spacers = [];

let _mscOptions;
let _wsSwitchIgnoreLast;
let _wsSwitchWrap;
let _scrollEventDelay;
let _wsSwitchIndicator;
let _fullscreenGlobal;

function init() {
}

function enable() {
    _initMscOptions();
    if (_mscOptions.delayStart) {
        GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            5000,
            () => {
                Main.layoutManager._updateHotCorners = _updateHotCorners;
                Main.layoutManager._updateHotCorners();
            }
        )
    } else {
        Main.layoutManager._updateHotCorners = _updateHotCorners;
        Main.layoutManager._updateHotCorners();
    }
}

function disable() {
    // This restores the original hot corners
    _removeHotCorners();
    _removeSpacers();
    Main.layoutManager._updateHotCorners = _origUpdateHotCorners;
    Main.layoutManager._updateHotCorners();
    if (_panelConnection !== null) {
        Main.panel.disconnect(_panelConnection);
        _panelConnection = null;
    }
}

function _initMscOptions() {
    _mscOptions = new Settings.MscOptions();
    _mscOptions.connect('changed::panel-scroll', () => _updatePanelScrollWS(_mscOptions.scrollPanel));
    _mscOptions.connect('changed::fix11', () => _fiX11());
    _mscOptions.connect('changed', _updateMscOptions);
    _updatePanelScrollWS(_mscOptions.scrollPanel);
    _updateMscOptions();
}

function _removeHotCorners() {
    _collector.forEach(c => c.destroy());
    _collector = [];
    // hot corners might be null
    Main.layoutManager.hotCorners.filter(Boolean).forEach(c => c.destroy());
    Main.layoutManager.hotCorners = [];
}


function _updateMscOptions() {
    _wsSwitchIgnoreLast = _mscOptions.wsSwitchIgnoreLast;
    _wsSwitchWrap = _mscOptions.wsSwitchWrap;
    _scrollEventDelay = _mscOptions.scrollEventDelay;
    _wsSwitchIndicator = _mscOptions.wsSwitchIndicator;
    _fullscreenGlobal = _mscOptions.fullscreenGlobal;
}

function _updateHotCorners() {
    _removeHotCorners();
    _fiX11();
    Main.layoutManager.hotCorners=[];
    let primaryIndex = Main.layoutManager.primaryIndex;
    let monIndexes = [...Main.layoutManager.monitors.keys()];
    // index of primary monitor to the first possition
    monIndexes.splice(0, 0, monIndexes.splice(primaryIndex, 1)[0]);

    for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
        // Monitor 1 in preferences will allways refer to primary monitor
        const corners = Settings.Corner.forMonitor(i, monIndexes[i], global.display.get_monitor_geometry(monIndexes[i]));
        for (let corner of corners) {
            _collector.push(corner);

            for (let trigger of triggers) {
                // Update hot corner if something changes
                corner.connect('changed', () => _updateCorner(corner), trigger);
            }
            if (_shouldCreateCorner(corner)) {
                Main.layoutManager.hotCorners.push(new CustomHotCorner(corner));
            }
        }
    }
}

function _shouldCreateCorner(corner) {
    let answer = null;
    for (let trigger of triggers) {
        answer = answer || (corner.getAction(trigger) !== 'disabled');
    }
    return answer;
}

function _updateCorner(corner) {
    _destroyCorner(corner);
    if (_shouldCreateCorner(corner)) {
        Main.layoutManager.hotCorners.push(new CustomHotCorner(corner));
    }
}

function _destroyCorner(corner) {
    let hc=Main.layoutManager.hotCorners;
    for (let i = 0; i < hc.length; i++) {
        if (hc[i]._corner.top === corner.top &&
            hc[i]._corner.left === corner.left &&
            hc[i]._corner.monitorIndex === corner.monitorIndex) {
                if (Main.layoutManager.hotCorners[i]._actor) {
                    Main.layoutManager.hotCorners[i]._actor.destroy();
                }
                Main.layoutManager.hotCorners[i].destroy();
                Main.layoutManager.hotCorners.splice(i, 1);
                break;
        }
    }
}

function _removeSpacers() {
    for (let spacer of _spacers) {
        spacer.destroy();
    }
    _spacers=[];
}

function _fiX11() {
    // workaround for insensitive corners above active windows under X11 session:
    // add 1px high rectangle at the sides of the monitor to move windows from the corners
    _removeSpacers();
    if (! _mscOptions.fiX11 || Meta.is_wayland_compositor()) return;
    for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
        if (i !== Main.layoutManager.primaryIndex) continue;
        let geometry = global.display.get_monitor_geometry(i);
        let leftSpacer = new Clutter.Rectangle({
            name: 'left-spacer',
            // "affectsStruts" property works when object touches the edge of the screen
            // but scale_x/y property cannot be -1
            x: geometry.x,
            y: geometry.y,
            width: 1,
            height: geometry.height,
            reactive: false,
            color: new Clutter.Color({
                red:0,
                green:0,
                blue:0,
                alpha:255
            })
        });
        let rightSpacer = new Clutter.Rectangle({
            name: 'right-spacer',
            x: geometry.x + geometry.width - 1,
            y: geometry.y,
            width: 1,
            height: geometry.height,
            reactive: false,
            color: new Clutter.Color({
                red:0,
                green:0,
                blue:0,
                alpha:255
            })
        });
        _spacers.push(leftSpacer);
        _spacers.push(rightSpacer);
        Main.layoutManager.addChrome(leftSpacer, {
                affectsStruts: true
            });
        Main.layoutManager.addChrome(rightSpacer, {
                affectsStruts: true
            });
    }
}

const CustomHotCorner = GObject.registerClass(
class CustomHotCorner extends Layout.HotCorner {
    _init(corner) {
        let monitor = Main.layoutManager.monitors[corner.monitorIndex];
        super._init(Main.layoutManager, monitor, corner.x, corner.y);
        this._corner = corner;
        this._monitor = monitor;
        this._command = '';
        this._wsIndex = 0

        this.m = new Map([
            ['toggleOverview', this._toggleOverview],
            ['showDesktop', this._showDesktop],
            ['showApplications', this._showApplications],
            ['runCommand', this._runCommand],
            ['moveToWorkspace', this._moveToWorkspace],
            ['prevWorkspace', this._prevWorkspace],
            ['nextWorkspace', this._nextWorkspace]
        ]);
        //this._actionFunction = m.get(this._corner.action) || function () {};

        // Avoid pointer barriers that are at the same position
        // but block opposite directions. Neither with X nor with Wayland
        // such barriers work.
        for (let c of Main.layoutManager.hotCorners) {
            if (this._corner.x === c._corner.x && this._corner.y === c._corner.y) {
                if (this._corner.top === c._corner.top) {
                    this._corner.x += this._corner.left ? 1 : -1;
                } else if (this._corner.left === c._corner.left) {
                    this._corner.y += this._corner.top ? 1 : -1;
                }
            }
        }

        this._enterd = false;
        this._pressureBarrier = new Layout.PressureBarrier(
            corner.pressureThreshold,
            Layout.HOT_CORNER_PRESSURE_TIMEOUT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW
        );
        this.setBarrierSize(corner.barrierSize);

        if (this._corner.getAction(Triggers.PRESSURE) !== 'disabled') {
            this._pressureBarrier.connect('trigger', this._onPressureTriggerd.bind(this));

        } 
        this._setupCornerActorsIfNeeded(Main.layoutManager);

        let ltr = (Clutter.get_default_text_direction() ==
                   Clutter.TextDirection.LTR);
        let angle = (this._corner.left && ltr) ? (this._corner.top ? 0 : 270) : (this._corner.top ? 90 : 180);
        this._ripples._ripple1.rotation_angle_z = angle;
        this._ripples._ripple2.rotation_angle_z = angle;
        this._ripples._ripple3.rotation_angle_z = angle;
    
    }

    // Overridden to allow all 4 monitor corners
    setBarrierSize(size) {
        // Use code of parent class to remove old barriers but new barriers
        // must be created here since the properties are construct only.
        super.setBarrierSize(0);

        if (size > 0) {
            const BD = Meta.BarrierDirection;
            this._verticalBarrier = new Meta.Barrier({
                display: global.display,
                x1: this._corner.x + (Meta.is_wayland_compositor() ? (this._corner.left ? 1 : -1) : 0 ),  // move barier 1px horizontaly because of wayland
                x2: this._corner.x + (Meta.is_wayland_compositor() ? (this._corner.left ? 1 : -1) : 0 ),
                y1: this._corner.y,
                y2: this._corner.top ? this._corner.y + size : this._corner.y - size,
                directions: this._corner.left ? BD.POSITIVE_X : BD.NEGATIVE_X
            });
            this._horizontalBarrier = new Meta.Barrier({
                display: global.display,
                x1: this._corner.x,
                x2: this._corner.left ? this._corner.x + size : this._corner.x - size,
                y1: this._corner.y + (Meta.is_wayland_compositor() ? (this._corner.top ? 1 : -1) : 0 ), // move barier 1px verticaly to be sure
                y2: this._corner.y + (Meta.is_wayland_compositor() ? (this._corner.top ? 1 : -1) : 0 ),
                directions: this._corner.top ? BD.POSITIVE_Y : BD.NEGATIVE_Y
            });

            this._pressureBarrier.addBarrier(this._verticalBarrier);
            this._pressureBarrier.addBarrier(this._horizontalBarrier);
        }
    }

    // Overridden to allow all 4 monitor corners
    _setupCornerActorsIfNeeded(layoutManager) {
         if (!(this._shouldCreateActor() || global.display.supports_extended_barriers())) {
            return;
        }

        this._actor = new Clutter.Actor({
            name: 'hot-corner-environs',
            x: this._corner.x,
            y: this._corner.y,
            width: 4, height: 4,
            reactive: true,
            scale_x: this._corner.left ? 1 : -1,
            scale_y: this._corner.top ? 1 : -1
        });

        if (! global.display.supports_extended_barriers()) {

            this._cornerActor = new Clutter.Actor({
                name: 'hot-corner',
                x: 0, y: 0,
                width: 1, height: 1,
                reactive: true
            });
            this._cornerActor._delegate = this;
            this._actor.add_child(this._cornerActor);
            this._cornerActor.connect('enter-event', this._onCornerEntered.bind(this));
            //this._cornerActor.connect('leave-event', this._onCornerLeft.bind(this));
            this._actor.connect('leave-event', this._onEnvironsLeft.bind(this));
        }

        layoutManager.addChrome(this._actor);

        if (this._shouldConnect([Triggers.BUTTON_PRIMARY, Triggers.BUTTON_SECONDARY, Triggers.BUTTON_MIDDLE])) {
            this._actor.connect('button-press-event', this._onCornerClicked.bind(this));
        }
        if (this._shouldConnect([Triggers.SCROLL_UP, Triggers.SCROLL_DOWN])) {
            this._actor.connect('scroll-event', this._onCornerScrolled.bind(this));
        }
        _collector.push(this._actor);
    }

    _shouldCreateActor() {
        let answer = null;
        for (let trigger of triggers) {
            if (trigger === Triggers.PRESSURE && global.display.supports_extended_barriers()) {
                continue;
            }
            answer = answer || (this._corner.getAction(trigger) !== 'disabled');
        }
        return answer;
    }

    _shouldConnect(signals) {
        let answer = null;
        for (let trigger of triggers) {
            if (signals.includes(trigger)) {
            answer = answer || (this._corner.getAction(trigger) !== 'disabled');
            }
        }
        return answer;
    }

    _rippleAnimation() {
        this._ripples.playAnimation(this._corner.x, this._corner.y);
    }

    // Overridden to allow running custom actions
    _onCornerEntered() {
        if (!this._entered) {
            this._setActionVars(Triggers.PRESSURE);
            this._entered = true;
            this._runAction();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onEnvironsLeft() {
        this._entered = false;
    }

    _setActionVars(trigger) {
        let action = this._corner.getAction(trigger);
        this._actionFunction = this.m.get(action) || function () {};
        if (action === 'moveToWorkspace'){
            this._wsIndex = this._corner.getWorkspaceIndex(trigger);
        } else if (action === 'runCommand') {
            this._command = this._corner.getCommand(trigger);
        }
        this._fullscreen = this._corner.getFullscreen(trigger);
    }

    _onPressureTriggerd (actor, event) {
        this._setActionVars(Triggers.PRESSURE);
        this._runAction();
    }

    _onCornerClicked(actor, event) {
        let button = event.get_button();
        switch (button) {
            case Clutter.BUTTON_PRIMARY:
                this._setActionVars(Triggers.BUTTON_PRIMARY);
                break;
            case Clutter.BUTTON_SECONDARY:
                this._setActionVars(Triggers.BUTTON_SECONDARY);
                break;
            case Clutter.BUTTON_MIDDLE:
                this._setActionVars(Triggers.BUTTON_MIDDLE);
                break;
            default:
                return Clutter.EVENT_PROPAGATE;
        }
        this._runAction();
        return Clutter.EVENT_STOP;
    }

    _onCornerScrolled(actor, event) {
        if (event.get_scroll_direction === Clutter.ScrollDirection.SMOOTH) return;
        let direction = event.get_scroll_direction();
        switch (direction) {
            case Clutter.ScrollDirection.UP:
                this._setActionVars(Triggers.SCROLL_UP);
                break;
            case Clutter.ScrollDirection.DOWN:
                this._setActionVars(Triggers.SCROLL_DOWN);
                break;
            default:
                return Clutter.EVENT_PROPAGATE;
        }
        this._runAction();
        return Clutter.EVENT_STOP;
    }

    _runAction() {
        if (_actionTimeoutActive()) return;
        if (this._monitor.inFullscreen && (this._fullscreen || _fullscreenGlobal)) {
            this._actionFunction();
        } else if (!this._monitor.inFullscreen) {
            this._actionFunction();
        }
        this._actionFunction = null;
    }

    _toggleOverview() {
        if (Main.overview.shouldToggleByCornerOrButton()) {
            this._rippleAnimation();
            Main.overview.toggle();
        }
    }

    _showDesktop() {
        this._rippleAnimation();
        _togleShowDesktop()
    }

    _showApplications() {
        this._rippleAnimation();
        if (Main.overview.viewSelector._showAppsButton.checked) {
            Main.overview.hide();
        } else {
            Main.overview.viewSelector._toggleAppsPage();
        }
    }

    _runCommand() {
        this._rippleAnimation();
        Util.spawnCommandLine(this._command);
    }

    _moveToWorkspace () {
        this._rippleAnimation();
        let idx = this._wsIndex-1;
        let maxIndex = global.workspaceManager.n_workspaces-1;
        if (maxIndex < idx) {
            // last not empty workspace
            idx = maxIndex-1;
        }
        let ws = global.workspaceManager.get_workspace_by_index(idx);
        Main.wm.actionMoveWorkspace(ws);
    }

    _prevWorkspace() {
        _switchWorkspace(Clutter.ScrollDirection.UP);
    }

    _nextWorkspace() {
        _switchWorkspace(Clutter.ScrollDirection.DOWN);
    }
});

let _minimizedWindows = [];
function _togleShowDesktop() {
    if (Main.overview.visible) return;
    let metaWorkspace = global.workspace_manager.get_active_workspace();
    let windows = metaWorkspace.list_windows();
    let wins=[];
    for (let win of windows) {
        let wm_class = win.wm_class ? win.wm_class.toLowerCase() : 'null';
        let window_type = win.window_type ? win.window_type : 'null';
        let title = win.title ? win.title : 'null';
        if (  !(win.minimized ||
                window_type === Meta.WindowType.DESKTOP ||
                window_type === Meta.WindowType.DOCK ||
                title.startsWith('DING') ||
                wm_class.endsWith('notejot') ||
                wm_class === 'conky' ||
                ( title.startsWith('@!') && title.endsWith('BDH') ) )) {

            wins.push(win);
        }
    }
    if (wins.length !== 0) {
        for (let win of wins) {
            win.minimize();
        }
        _minimizedWindows = wins;
    }
    else if (_minimizedWindows !== 0) {
        for (let win of _minimizedWindows) {
            if (win) {
                win.unminimize();
            }
        }
        _minimizedWindows = [];
    }
}

function _switchWorkspace(direction) {
        let lastWsIndex =  global.workspaceManager.n_workspaces - (_wsSwitchIgnoreLast ? 2 : 1);
        let motion;
        switch (direction) {
        case Clutter.ScrollDirection.UP:
            motion = Meta.MotionDirection.UP;
            break;
        case Clutter.ScrollDirection.DOWN:
            motion = Meta.MotionDirection.DOWN;
            break;
        case Clutter.ScrollDirection.LEFT:
            motion = Meta.MotionDirection.LEFT;
            break;
        case Clutter.ScrollDirection.RIGHT:
            motion = Meta.MotionDirection.RIGHT;
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }

        let activeWs = global.workspaceManager.get_active_workspace();
        let ws = activeWs.get_neighbor(motion);
        if (_wsSwitchWrap){
            if (motion === Meta.MotionDirection.DOWN) {
                if (activeWs.index() + 1 > lastWsIndex) {
                    ws = global.workspaceManager.get_workspace_by_index(0);
                }
            } else if (motion === Meta.MotionDirection.UP) {
                if (activeWs.index() - 1 < 0){
                    ws = global.workspaceManager.get_workspace_by_index(lastWsIndex);
                }
            }

        } else if (!ws || ws.index() > lastWsIndex) {
            return Clutter.EVENT_STOP;
        }

        if (_wsSwitchIndicator) {
            if (Main.wm._workspaceSwitcherPopup == null)
                Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
                Main.wm._workspaceSwitcherPopup.reactive = false;
                Main.wm._workspaceSwitcherPopup.connect('destroy', function() {
                    Main.wm._workspaceSwitcherPopup = null;
                });
            // Do not show wokspaceSwithcer in overview
            if(!Main.overview.visible) {
                Main.wm._workspaceSwitcherPopup.display(motion, ws.index());
            }
        }
        Main.wm.actionMoveWorkspace(ws);
        return Clutter.EVENT_STOP;
}

let _actionTimeoutId = null;
function _actionTimeoutActive() {
    if (_actionTimeoutId) {
        return true;
    }
   _actionTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            _scrollEventDelay,
            () => {
                _actionTimeoutId = null;
            }
        );
    return false;
}

let _panelConnection = null;
function _updatePanelScrollWS(active) {
    if (active && _panelConnection === null) {
        _panelConnection = Main.panel.connect('scroll-event', _onPanelScrolled);
    } else if (_panelConnection !== null) {
        Main.panel.disconnect(_panelConnection);
        _panelConnection = null;
    }
}

function _onPanelScrolled(actor, event) {
    if (event.get_scroll_direction === Clutter.ScrollDirection.SMOOTH) return;
    let direction = event.get_scroll_direction();
    if (event.get_source() !== actor) {
        return Clutter.EVENT_PROPAGATE;
    }
    _switchWorkspace(direction);
    return Clutter.EVENT_STOP;
}