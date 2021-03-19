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

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const Workspace = imports.ui.workspace;
const Main = imports.ui.main;
const Layout = imports.ui.layout;
const Ripples = imports.ui.ripples;
const Util = imports.misc.util;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const SystemActions = imports.misc.systemActions;

const listTriggers = Settings.listTriggers();
const Triggers = Settings.Triggers;

let _origUpdateHotCorners = Main.layoutManager._updateHotCorners;
let _collector;
let _timeouts;

let _mscOptions;
let _wsSwitchIgnoreLast;
let _wsSwitchWrap;
let _actionEventDelay;
let _wsSwitchIndicator;
let _fullscreenGlobal;
let _panelConnection;
let _actionTimeoutId;


function init() {
    _timeouts = [];
    _collector = [];
    _actionTimeoutId = null;
    _panelConnection = null;
}

function enable() {
    _initMscOptions();
    _removeActionTimeout();
    if (_mscOptions.delayStart) {
        let delayID = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            5000,
            () => {
                _replaceLayoutManager();
                _timeouts.splice(_timeouts.indexOf(delayID));
                delayID = null;
                return false;
            }
        );
        _timeouts.push(delayID);
    } else {
        _replaceLayoutManager();
    }
}

function _replaceLayoutManager() {
    Main.layoutManager._updateHotCorners = _updateHotCorners;
    Main.layoutManager._updateHotCorners();
}

function disable() {
    // This restores the original hot corners
    _timeouts.forEach( c => GLib.Source.remove(c));
    _timeouts=[];
    _removeHotCorners();
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
    _mscOptions.connect('changed', _updateMscOptions);
    _updatePanelScrollWS(_mscOptions.scrollPanel);
    _updateMscOptions();
}

function _removeHotCorners() {
    // hot corners might be null
    _collector.forEach(c => c.destroy());
    _collector = [];
    Main.layoutManager.hotCorners.filter(Boolean).forEach(c => c.destroy());
    Main.layoutManager.hotCorners = [];
}


function _updateMscOptions() {
    _wsSwitchIgnoreLast = _mscOptions.wsSwitchIgnoreLast;
    _wsSwitchWrap = _mscOptions.wsSwitchWrap;
    _actionEventDelay = _mscOptions.actionEventDelay;
    _wsSwitchIndicator = _mscOptions.wsSwitchIndicator;
    _fullscreenGlobal = _mscOptions.fullscreenGlobal;
}

function _updateHotCorners() {
    _removeHotCorners();
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

            for (let trigger of listTriggers) {
                // Update hot corner if something changes
                // corner has own connect method defined in settings, this is not direct gsettings connect
                corner.connect('changed', (settings, key) => _updateCorner(corner, key, trigger), trigger);
            }
            if (_shouldExistHotCorner(corner)) {
                Main.layoutManager.hotCorners.push(new CustomHotCorner(corner));
            }
        }
    }
}

function _shouldExistHotCorner(corner) {
    let answer = false;
    for (let trigger of listTriggers) {
        answer = answer || (corner.action[trigger] !== 'disabled');
    }
    return answer;
}

function _updateCorner(corner, key, trigger) {
    switch (key) {
        case 'action':
            corner.action[trigger] = corner.getAction(trigger);
            _updateHotCorner(corner);
            break;
        case 'command':
            corner.command[trigger] = corner.getCommand(trigger);
            break;
        case 'fullscreen':
            corner.fullscreen[trigger] = corner.getFullscreen(trigger);
            break;
        case 'barrier-size':
            _updateHotCorner(corner);
            break;
        case 'pressure-threshold':
            _updateHotCorner(corner);
            break;
        case 'workspace-index':
            corner.workspaceIndex[trigger] = corner.getWorkspaceIndex(trigger);
            break;
    }
}

function _updateHotCorner(corner) {
    _destroyHotCorner(corner);
    if (_shouldExistHotCorner(corner)) {
        Main.layoutManager.hotCorners.push(new CustomHotCorner(corner));
    }
}

function _destroyHotCorner(corner) {
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
        this._corner = corner;
        this._monitor = monitor;
        this._corner.hotCornerExists = true;

        this.m = new Map([
            ['toggleOverview', this._toggleOverview],
            ['showDesktop', this._showDesktop],
            ['showApplications', this._showApplications],
            ['runCommand', this._runCommand],
            ['moveToWorkspace', this._moveToWorkspace],
            ['prevWorkspace', this._prevWorkspace],
            ['nextWorkspace', this._nextWorkspace],
            ['screenLock', this._lockScreen],
            ['suspend', this._suspendToRam],
            ['powerOff', this._powerOff],
            ['logout', this._logOut],
            ['switchUser', this._switchUser]
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

        if (this._corner.action[Triggers.PRESSURE] !== 'disabled') {
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
        let aSize = 4;
        this._actor = new Clutter.Actor({
            name: 'hot-corner-environs',
            x: this._corner.x + (this._corner.left ? 0 : - aSize),
            y: this._corner.y + (this._corner.top  ? 0 : - aSize),
            width: aSize, height: aSize,
            reactive: true
            // when negative scale is used, such actors are acting weirdly under X11 (tested on GS 3.36 Ubunru 20.04):
            //  - no events catched when overlayed by active window
            //  - affectsStruts propertie doesn't work
            //scale_x: this._corner.left ? 1 : -1,
            //scale_y: this._corner.top ? 1 : -1
        });

        if (! global.display.supports_extended_barriers()) {
            this._cornerActor = new Clutter.Actor({
                name: 'hot-corner',
                x: 0 + (this._corner.left ? 0 : aSize), y: 0 + (this._corner.top ? 0 : aSize),
                width: 1, height: 1,
                reactive: true
            });
            this._cornerActor._delegate = this;
            this._actor.add_child(this._cornerActor);
            this._cornerActor.connect('enter-event', this._onCornerEntered.bind(this));
            //this._cornerActor.connect('leave-event', this._onCornerLeft.bind(this));
            this._actor.connect('leave-event', this._onEnvironsLeft.bind(this));
            _collector.push(_cornerActor);
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
        for (let trigger of listTriggers) {
            if (trigger === Triggers.PRESSURE && global.display.supports_extended_barriers()) {
                continue;
            }
            answer = answer || (this._corner.action[trigger] !== 'disabled');
        }
        return answer;
    }

    _shouldConnect(signals) {
        let answer = null;
        for (let trigger of listTriggers) {
            if (signals.includes(trigger)) {
            answer = answer || (this._corner.action[trigger] !== 'disabled');
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

    _onPressureTriggerd (actor, event) {
        this._runAction(Triggers.PRESSURE);
    }

    _onCornerClicked(actor, event) {
        let button = event.get_button();
        let trigger;
        switch (button) {
            case Clutter.BUTTON_PRIMARY:
                trigger = Triggers.BUTTON_PRIMARY;
                break;
            case Clutter.BUTTON_SECONDARY:
                trigger = Triggers.BUTTON_SECONDARY;
                break;
            case Clutter.BUTTON_MIDDLE:
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
        if (_notValidScroll(direction)) return;
        let trigger;
        switch (direction) {
            case Clutter.ScrollDirection.UP:
                trigger = Triggers.SCROLL_UP;
                break;
            case Clutter.ScrollDirection.DOWN:
                trigger = Triggers.SCROLL_DOWN;
                break;
            default:
                return Clutter.EVENT_PROPAGATE;
        }
        this._runAction(trigger);
        return Clutter.EVENT_STOP;
    }

    _runAction(trigger) {
        if (_actionTimeoutActive(trigger)) return;
        this._actionFunction = this.m.get(this._corner.action[trigger]) || function () {};
        if (this._monitor.inFullscreen && (this._corner.fullscreen || _fullscreenGlobal)) {
            this._actionFunction(trigger);
        } else if (!this._monitor.inFullscreen) {
            this._actionFunction(trigger);
        }
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

    _runCommand(trigger) {
        this._rippleAnimation();
        Util.spawnCommandLine(this._corner.command[trigger]);
    }

    _moveToWorkspace (trigger) {
        this._rippleAnimation();
        let idx = this._corner.workspaceIndex[trigger] - 1;
        let maxIndex = global.workspaceManager.n_workspaces - 1;
        if (maxIndex < idx) {
            idx = maxIndex;
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

    _lockScreen() {
        //Main.screenShield.lock(true);
        SystemActions.getDefault().activateLockScreen();
    }

    _suspendToRam () {
        SystemActions.getDefault().activateSuspend();
    }

    _powerOff() {
        SystemActions.getDefault().activatePowerOff();
    }

    _logOut() {
        SystemActions.getDefault().activateLogout();
    }

    _switchUser() {
        SystemActions.getDefault().activateSwitchUser();
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
                Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
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

function _actionTimeoutActive() {
    if (_actionTimeoutId) {
        return true;
    }
   _actionTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            _actionEventDelay,
            _removeActionTimeout
        );
    _timeouts.push(_actionTimeoutId);
    return false;
}

function _removeActionTimeout() {
    _timeouts.splice(_timeouts.indexOf(_actionTimeoutId));
    _actionTimeoutId = null;
    return false;
}

function _updatePanelScrollWS(active) {
    if (active && _panelConnection === null) {
        _panelConnection = Main.panel.connect('scroll-event', _onPanelScrolled);
    } else if (_panelConnection !== null) {
        Main.panel.disconnect(_panelConnection);
        _panelConnection = null;
    }
}

function _onPanelScrolled(actor, event) {
    let direction = event.get_scroll_direction();
    if (_notValidScroll(direction)) return;
    if (event.get_source() !== actor) {
        return Clutter.EVENT_PROPAGATE;
    }
    _switchWorkspace(direction);
    return Clutter.EVENT_STOP;
}

function _notValidScroll(direction) {
    if (direction === Clutter.ScrollDirection.SMOOTH) return true;
    return false;
}