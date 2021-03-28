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

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Lang = imports.lang;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;
const Prefs = Me.imports.prefs;
const Workspace = imports.ui.workspace;
const Main = imports.ui.main;
const Layout = imports.ui.layout;
const Ripples = imports.ui.ripples;
const Util = imports.misc.util;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;
const SystemActions = imports.misc.systemActions;
const Volume = imports.ui.status.volume;
const ExtManager = Main.extensionManager;

const listTriggers = Settings.listTriggers();
const Triggers = Settings.Triggers;

let _origUpdateHotCorners = Main.layoutManager._updateHotCorners;
let _cornersCollector;
let _timeoutsCollector;
let _signalsCollector;

let _mscOptions;
let _wsSwitchIgnoreLast;
let _wsSwitchWrap;
let _actionEventDelay;
let _wsSwitchIndicator;
let _fullscreenGlobal;
let _actionTimeoutId;
let _cornersVisible;
let _minimizedWindows;
let _lastWorkspace;
let _currentWorkspace;
let _rippleAnimation;
let _winSwitchWrap;
let _winSkipMinimized;
let _dimmerActors;


function init() {
    _timeoutsCollector = [];
    _cornersCollector = [];
    _actionTimeoutId = null;
    _minimizedWindows = [];
    _signalsCollector = [];
    _lastWorkspace = -1;
    _currentWorkspace = -1;
    _dimmerActors = [];
}

function enable() {
    _initMscOptions();
    if (_mscOptions.delayStart) {
        let delayID = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            5000,
            () => {
                _replaceLayoutManager();
                _timeoutsCollector.splice(_timeoutsCollector.indexOf(delayID));
                delayID = null;
                return false;
            }
        );
        _timeoutsCollector.push(delayID);
    } else {
        _replaceLayoutManager();
    }
    _connectRecentWorkspace();
}

function _replaceLayoutManager() {
    Main.layoutManager._updateHotCorners = _updateHotCorners;
    Main.layoutManager._updateHotCorners();
}

function disable() {
    // This restores the original hot corners
    _timeoutsCollector.forEach( c => GLib.Source.remove(c));
    _timeoutsCollector=[];
    _removeActionTimeout();
    global.workspace_manager.disconnect(_signalsCollector.pop());
    _removeHotCorners();
    _mscOptions.destroy();
    _disableEffects();
    _destroyDimmerActors();
    Main.layoutManager._updateHotCorners = _origUpdateHotCorners;
    Main.layoutManager._updateHotCorners();
}

function _initMscOptions() {
    _mscOptions = new Settings.MscOptions();
    _mscOptions.connect('changed', ()=> _updateMscOptions());
    _updateMscOptions(true);
}

function _removeHotCorners() {
    _cornersCollector.forEach(c => c.destroy());
    _cornersCollector = [];

    const hc = Main.layoutManager.hotCorners;
    // reverse iteration, objects are being removed from the source during destruction
    for (let i = hc.length-1; i >= 0; i--) {
        _destroyHotCorner(hc[i]._corner);
    }
    Main.layoutManager.hotCorners = [];
}


function _updateMscOptions(doNotUpdateHC = false) {
    _wsSwitchIgnoreLast = _mscOptions.wsSwitchIgnoreLast;
    _wsSwitchWrap       = _mscOptions.wsSwitchWrap;
    _actionEventDelay   = _mscOptions.actionEventDelay;
    _wsSwitchIndicator  = _mscOptions.wsSwitchIndicator;
    _fullscreenGlobal   = _mscOptions.fullscreenGlobal;
    _rippleAnimation    = _mscOptions.rippleAnimation;
    _winSwitchWrap      = _mscOptions.winSwitchWrap;
    _winSkipMinimized   = _mscOptions.winSkipMinimized;
    if (_cornersVisible !== _mscOptions.cornersVisible) {
        _cornersVisible = _mscOptions.cornersVisible;
        if (!doNotUpdateHC) _updateHotCorners();
    }
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
        _setExpansionMeasures(corners);
        for (let corner of corners) {
            _cornersCollector.push(corner);

            for (let trigger of listTriggers) {
                // Update hot corner if something changes
                // corner has it's own connect method defined in settings, this is not direct gsettings connect
                corner.connect('changed', (settings, key) => _updateCorner(corner, key, trigger), trigger);
            }
            if (_shouldExistHotCorner(corner)) {
                Main.layoutManager.hotCorners.push(new CustomHotCorner(corner));
            }
        }
    }
}

function _setExpansionMeasures(corners) {
    const cornerOrder = [0,1,3,2];
    for (let i = 0; i < corners.length; i++) {
        let prevCorner = (i + corners.length-1) % corners.length;
        let nextCorner = (i + 1) % corners.length;
        prevCorner = corners[cornerOrder[prevCorner]];
        nextCorner = corners[cornerOrder[nextCorner]];
        let corner = corners[cornerOrder[i]];
        if ((corner.left && prevCorner.left) || (!corner.left && !prevCorner.left)) {
            corner.fullExpandVertical = (prevCorner.vExpand) ? false : true;
            corner.fullExpandHorizontal = (nextCorner.hExpand) ? false : true;
        }
        else if ((corner.top && prevCorner.top) || (!corner.top && !prevCorner.top)) {
            corner.fullExpandVertical = (nextCorner.vExpand) ? false : true;
            corner.fullExpandHorizontal = (prevCorner.hExpand) ? false : true;          
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
    if (key === 'h-expand' || key === 'v-expand') {
        _updateHotCorners();
        return;
    }
    switch (key) {
        case 'action':
            corner.action[trigger] = corner.getAction(trigger);
            _rebuildHotCorner(corner);
            break;
        case 'command':
            corner.command[trigger] = corner.getCommand(trigger);
            break;
        case 'fullscreen':
            corner.fullscreen[trigger] = corner.getFullscreen(trigger);
            break;
        case 'barrier-size':
            _rebuildHotCorner(corner);
            break;
        case 'pressure-threshold':
            _rebuildHotCorner(corner);
            break;
        case 'workspace-index':
            corner.workspaceIndex[trigger] = corner.getWorkspaceIndex(trigger);
            break;
        default:
            _rebuildHotCorner(corner);
    }
}

function _rebuildHotCorner(corner) {
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
                Main.layoutManager.hotCorners[i]._actors.forEach( a => a.destroy() );
                hc[i].setBarrierSize(0, false);
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
        this._actors = [];

        this.m = new Map([
            ['toggleOverview',  this._toggleOverview          ],
            ['showDesktop',     this._showDesktop             ],
            ['showApplications',this._showApplications        ],
            ['runCommand',      this._runCommand              ],
            ['moveToWorkspace', this._moveToWorkspace         ],
            ['prevWorkspace',   this._prevWorkspace           ],
            ['nextWorkspace',   this._nextWorkspace           ],
            ['screenLock',      this._lockScreen              ],
            ['suspend',         this._suspendToRam            ],
            ['powerOff',        this._powerOff                ],
            ['logout',          this._logOut                  ],
            ['switchUser',      this._switchUser              ],
            ['lookingGlass',    this._toggleLookingGlass      ],
            ['recentWS',        this._moveToRecentWorkspace   ],
            ['prevWinWS',       this._switchPrevWindowWS      ],
            ['nextWinWS',       this._switchNextWindowWS      ],
            ['prevWinAll',      this._switchPrevWindow        ],
            ['nextWinAll',      this._switchNextWindow        ],
            ['recentWin',       this._recentWindow            ],
            ['closeWin',        this._closeWindow             ],
            ['maximizeWin',     this._maximizeWindow          ],
            ['minimizeWin',     this._minimizeWindow          ],
            ['restartShell',    this._restartGnomeShell       ],
            ['volumeUp',        this._volumeUp                ],
            ['volumeDown',      this._volumeDown              ],
            ['muteAudio',       this._toggleMute              ],
            ['prefs',           this._showPrefs               ],
            ['brightnessInvert',this._toggleBrightnessInvert  ],
            ['blackScreen',     this._toggleBlackScreen       ]
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
        this.setBarrierSize(corner.barrierSize, false);

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
    setBarrierSize(size, forignAccess=true) {
        if (forignAccess) return;
        // Use code of parent class to remove old barriers but new barriers
        // must be created here since the properties are construct only.
        super.setBarrierSize(0);
        if (size > 0) {
            const BD = Meta.BarrierDirection;
            this._verticalBarrier = new Meta.Barrier({
                display: global.display,
                x1: this._corner.x, //+ (Meta.is_wayland_compositor() ? (this._corner.left ? 1 : -1) : 0 ),  // move barier 1px horizontaly because of wayland
                x2: this._corner.x, //+ (Meta.is_wayland_compositor() ? (this._corner.left ? 1 : -1) : 0 ),
                y1: this._corner.y,
                y2: this._corner.top ? this._corner.y + size : this._corner.y - size,
                directions: this._corner.left ? BD.POSITIVE_X : BD.NEGATIVE_X
            });
            this._horizontalBarrier = new Meta.Barrier({
                display: global.display,
                x1: this._corner.x,
                x2: this._corner.left ? this._corner.x + size : this._corner.x - size,
                y1: this._corner.y, //+ (Meta.is_wayland_compositor() ? (this._corner.top ? 1 : -1) : 0 ), // move barier 1px verticaly to be sure
                y2: this._corner.y, //+ (Meta.is_wayland_compositor() ? (this._corner.top ? 1 : -1) : 0 ),
                directions: this._corner.top ? BD.POSITIVE_Y : BD.NEGATIVE_Y
            });

            this._pressureBarrier.addBarrier(this._verticalBarrier);
            this._pressureBarrier.addBarrier(this._horizontalBarrier);
        }
    }

    // Overridden to allow all 4 monitor corners
    _setupCornerActorsIfNeeded(layoutManager) {
        let shouldCreateActor = this._shouldCreateActor();
         if (!(shouldCreateActor || this._corner.hExpand || this._corner.vExpand || global.display.supports_extended_barriers())) {
            return;
        }
        let aSize = 3;
        let h = this._corner.hExpand;
        let v = this._corner.vExpand;
        aSize = ((h || v) && shouldCreateActor) ? 1 : aSize;
        let hSize = aSize;
        let vSize = aSize;
        if (( h || v ) && shouldCreateActor) {
            let geometry = global.display.get_monitor_geometry(this._corner.monitorIndex);
            hSize = this._corner.fullExpandHorizontal ? geometry.width / 8 * 7 : geometry.width / 2 - 5;
            vSize = this._corner.fullExpandVertical ? geometry.height / 8 * 7 : geometry.height / 2 - 5;
        }
        // the corner's reactive area can be expanded to the half of the display horizontaly and/or verticaly
        // if only vertical expansion needed, only one actor will be created
        if (v && !h) {
            hSize = aSize;
            aSize = vSize;
        }

        
        // base clickable actor, normal size or expanded
        this._actor = new Clutter.Rectangle({
            name: 'hot-corner-h',
            x: this._corner.x + (this._corner.left ? 0 : - hSize),
            y: this._corner.y + (this._corner.top  ? 0 : - aSize),
            width: hSize,
            height: aSize,
            reactive: true,
            color: new Clutter.Color({
                red:   255,
                green: 120,
                blue:  0,
                //alpha: _cornersVisible ? ((h || v) ? 50 : 120) : 0
                alpha: _cornersVisible ? 150 : 0
            })

        });
        this._connectActorEvents(this._actor);
        layoutManager.addChrome(this._actor);
        this._actors.push(this._actor);

        // to expand clickable area in both axes make second actor
        if (v && h) {
            this._actorV = new Clutter.Rectangle ({
                name: 'hot-corner-v',
                x: this._corner.x + (this._corner.left ? 1 : - aSize +1),
                y: this._corner.y + (this._corner.top  ? 1 : - vSize +1),
                width: aSize,
                height: vSize,
                reactive: true,
                color: new Clutter.Color({
                    red:   255,
                    green: 120,
                    blue:  0,
                    //alpha: _cornersVisible ? ((h || v) ? 50 : 120) : 0
                    alpha: _cornersVisible ? 150 : 0
                })
            });
            this._connectActorEvents(this._actorV);
            layoutManager.addChrome(this._actorV);
            this._actors.push(this._actorV);
        }

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
            this._actors.push(this._cornerActor);
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
        if (_actionTimeoutActive(trigger) && 
            !(['volumeUp','volumeDown'].includes(this._corner.action[trigger]))
            ) return;
        this._actionFunction = this.m.get(this._corner.action[trigger]) || function () {};
        if (this._monitor.inFullscreen && (this._corner.fullscreen || _fullscreenGlobal)) {
            if (_rippleAnimation) this._rippleAnimation();
            this._actionFunction(trigger);
        } else if (!this._monitor.inFullscreen) {
            if (_rippleAnimation) this._rippleAnimation();
            this._actionFunction(trigger);
        }
    }

    _toggleOverview() {
        if (Main.overview.shouldToggleByCornerOrButton()) {
            Main.overview.toggle();
        }
    }
    _showDesktop() {
        _togleShowDesktop()
    }
    _showApplications() {
        if (Main.overview.viewSelector._showAppsButton.checked) {
            Main.overview.hide();
        } else {
            Main.overview.viewSelector._toggleAppsPage();
        }
    }
    _runCommand(trigger) {
        Util.spawnCommandLine(this._corner.command[trigger]);
    }
    _moveToWorkspace (trigger) {
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
    _toggleLookingGlass() {
        if (Main.lookingGlass === null)
            Main.createLookingGlass();
        if (Main.lookingGlass !== null)
            Main.lookingGlass.toggle();
    }
    _moveToRecentWorkspace() {
        if (_lastWorkspace < 0)  return;
        let ws = (global.workspace_manager).get_workspace_by_index(_lastWorkspace);
        ws.activate(global.get_current_time());
    }
    _switchPrevWindow() {
        _switchWindow(-1, false);
    }

    _switchNextWindow() {
        _switchWindow(1, false);
    }
    _switchPrevWindowWS() {
        _switchWindow(-1, true);
    }

    _switchNextWindowWS() {
        _switchWindow(1, true);
    }
    _recentWindow() {
        global.display.get_tab_list(0, null)[1].activate(global.get_current_time());
    }
    _closeWindow() {
        global.display.get_tab_list(0, null)[0].kill();
    }
    _maximizeWindow() {
        let win = global.display.get_tab_list(0, null)[0];
        if (win.maximized_horizontally && win.maximized_vertically)
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        else win.maximize(Meta.MaximizeFlags.BOTH);
    }
    _minimizeWindow() {
        global.display.get_tab_list(0, null)[0].minimize();
    }
    _restartGnomeShell() {
        Meta.restart(_('Restarting Gnome Shell ...'));
    }
    _volumeUp() {
        let volumeControl = Volume.getMixerControl();
        let volume = volumeControl.get_default_sink().volume;
        let max = volumeControl.get_vol_max_norm();
        let step = 2048;
        volume = volume + step > max ? max : volume + step;
        volumeControl.get_default_sink().volume = volume;
        volumeControl.get_default_sink().push_volume();
    }
    _volumeDown() {
        let volumeControl = Volume.getMixerControl();
        let volume = volumeControl.get_default_sink().volume;
        let step = 2048;
        volume = volume - step ? volume - step : 0;
        volumeControl.get_default_sink().volume = volume;
        volumeControl.get_default_sink().push_volume();
    }
    _toggleMute() {
        let sink = Volume.getMixerControl().get_default_sink();
        sink.change_is_muted(!sink.is_muted);
    }
    _showPrefs() {
        ExtManager.openExtensionPrefs(Me.metadata.uuid, '', {});
    }
    _toggleBrightnessInvert() {
        _toggleBrightnessInvert();
    }
    _toggleBlackScreen() {
        let opacity = 255;
        let note = Me.metadata.name;
        _toggleDimmMonitors(opacity, note);
    }
});


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
                // DING is GS extenson providing desktop icons
                title.startsWith('DING') ||
                wm_class.endsWith('notejot') ||
                // conky is system monitor for Desktop, but not allways has it's window WindowType.DESKTOP hint
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
        let n_workspaces = global.workspaceManager.n_workspaces;
        let lastWsIndex =  n_workspaces - (_wsSwitchIgnoreLast ? 2 : 1);
        let motion;

        let activeWs  = global.workspaceManager.get_active_workspace();
        let activeIdx = activeWs.index();
        let targetIdx = _wsSwitchWrap ? 
                        (activeIdx + (direction ? 1 : lastWsIndex )) % (lastWsIndex + 1) :
                        activeIdx + (direction ? 1 : -1);
        if (targetIdx < 0 || targetIdx > lastWsIndex) {
            targetIdx = activeIdx;
        }
        let ws = global.workspaceManager.get_workspace_by_index(targetIdx);
        if (!ws || ws.index() === activeIdx) {
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
                let motion = direction ? Meta.MotionDirection.DOWN : Meta.MotionDirection.UP
                Main.wm._workspaceSwitcherPopup.display(motion, ws.index());
            }
        }
        Main.wm.actionMoveWorkspace(ws);
        return Clutter.EVENT_STOP;
}

function _actionTimeoutActive(trigger) {
    if (_actionTimeoutId)
        return true;

   _actionTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            _actionEventDelay,
            _removeActionTimeout
        );
    _timeoutsCollector.push(_actionTimeoutId);
    return false;
}

function _removeActionTimeout() {
    _timeoutsCollector.splice(_timeoutsCollector.indexOf(_actionTimeoutId));
    _actionTimeoutId = null;
    return false;
}

function _notValidScroll(direction) {
    if (direction === Clutter.ScrollDirection.SMOOTH) return true;
    return false;
}

function _connectRecentWorkspace() {
    _signalsCollector.push((global.workspace_manager).connect('workspace-switched', function(display, prev, current, direction) {
        if (current !== _currentWorkspace) {
            _lastWorkspace = _currentWorkspace;
            _currentWorkspace = current;
    }
  }));
}

function _switchWindow(direction, wsOnly=true) {
    let workspaceManager = global.workspace_manager;
    let workspace = wsOnly ? workspaceManager.get_active_workspace() : null;
    // get all windows, skip-taskbar included
    let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, workspace);
    // when window with attached modal window is activated, focus shifts to modal window
    //  and switcher can stuck trying to activate same window again
    //  when these windows are next to each other in window list
    // map windows with modals attached ...
    // ... and filter out not modal windows and duplicates
    let modals = windows.map(w => 
        w.get_transient_for() ? w.get_transient_for() : null
        ).filter((w, i, a) => w !==null && a.indexOf(w) == i);

    // filter out skip_taskbar windows and windows with modals
    // top modal windows should stay
    windows = windows.filter( w => modals.indexOf(w) && !w.is_skip_taskbar());
    if (_winSkipMinimized)
        windows = windows.filter(win => !win.minimized);

    if (!windows.length) return;

    let currentWin  = windows[0];
    // tab list is sorted by MRU order, active window is allways idx 0
    // each window has index in global stable order list (as launched)
    windows.sort((a, b) => {
            return a.get_stable_sequence() - b.get_stable_sequence();
        });
    const currentIdx = windows.indexOf(currentWin);
    let targetIdx = currentIdx + direction;
    if (targetIdx > windows.length - 1) targetIdx = _winSwitchWrap ? 0 : currentIdx;
    else if (targetIdx < 0) targetIdx = _winSwitchWrap ? windows.length - 1 : currentIdx;
    windows[targetIdx].activate(global.get_current_time());
}

function _setMonitorsContrast(direction) {

}

//Code taken from True color invert extension
//***********************************************************
const TrueInvertEffect = new Lang.Class({
    Name: 'TrueInvertEffect',
    Extends: Clutter.ShaderEffect,

    vfunc_get_static_shader_source() {
        return `
            uniform bool invert_color;
            uniform float opacity = 1.0;
            uniform sampler2D tex;

            /**
             * based on shift_whitish.glsl https://github.com/vn971/linux-color-inversion
             */
            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
                
                /* shifted */
                float white_bias = .17;
                float m = 1.0 + white_bias;
                
                float shift = white_bias + c.a - min(c.r, min(c.g, c.b)) - max(c.r, max(c.g, c.b));
                
                c = vec4((shift + c.r) / m, 
                        (shift + c.g) / m, 
                        (shift + c.b) / m, 
                        c.a);
                    
                /* non-shifted */
                // float shift = c.a - min(c.r, min(c.g, c.b)) - max(c.r, max(c.g, c.b));
                // c = vec4(shift + c.r, shift + c.g, shift + c.b, c.a);

                cogl_color_out = c;
            }
        `;
    },

    vfunc_paint_target(paint_context) {
        this.set_uniform_value("tex", 0);
        this.parent(paint_context);
    }
});

function _toggleBrightnessInvert() {
    global.get_window_actors().forEach(function(actor) {
        let meta_window = actor.get_meta_window();
        if(meta_window.has_focus()) {
            if(actor.get_effect('invert-color')) {
                actor.remove_effect_by_name('invert-color');
                delete meta_window._invert_window_tag;
            }
            else {
                let effect = new TrueInvertEffect();
                actor.add_effect_with_name('invert-color', effect);
                meta_window._invert_window_tag = true;
            }
        }
    });
}

function _disableEffects() {
    global.get_window_actors().forEach(function(actor) {
            actor.remove_effect_by_name('invert-color');
        });
}
//***********************************************************

function _toggleDimmMonitors(alpha, text) {
    if (!_dimmerActors.length) {
        let monitors = [...Main.layoutManager.monitors.keys()];
        for (let monitor of monitors) {
            let geometry = global.display.get_monitor_geometry([monitor]);
            let actor = new St.Label ({
                text: text,
                x: geometry.x,
                y: geometry.y,
                width: geometry.width,
                height: geometry.height,
                style: 'background-color: #000000; font-size: 1em;',
                opacity: alpha,
                reactive: true
            });
            actor.connect('button-press-event', () => _destroyDimmerActors());
            Main.layoutManager.addChrome(actor);
            _dimmerActors.push(actor);
        }
    }
    else {
        _destroyDimmerActors();
}

    }
function _destroyDimmerActors() {
    for (let actor of _dimmerActors) {
        actor.destroy();
    }
    _dimmerActors = [];   
}
