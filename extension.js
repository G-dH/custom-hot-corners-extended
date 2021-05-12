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
const Clutter                = imports.gi.Clutter;
const Meta                   = imports.gi.Meta;
const Shell                  = imports.gi.Shell;
const GObject                = imports.gi.GObject;
const GLib                   = imports.gi.GLib;
const Gdk                    = imports.gi.Gdk;

const Main                   = imports.ui.main;
const Layout                 = imports.ui.layout;
const Ripples                = imports.ui.ripples;

const ExtensionUtils         = imports.misc.extensionUtils;

const Me                     = ExtensionUtils.getCurrentExtension();
const Settings               = Me.imports.settings;
const ActionLib              = Me.imports.actions;
let   Actions;
let   actionTrigger;

// gettext
const _                      = Settings._;

const listTriggers           = Settings.listTriggers();
const Triggers               = Settings.Triggers;

let _origUpdateHotCorners;
let _cornersCollector;
let _timeoutsCollector;
let _actorsCollector;
let _actionTimeoutId;

let _mscOptions;

let _fullscreenGlobal;
let _cornersVisible;
let _actionEventDelay;
let _rippleAnimation;
let _barrierFallback;

let _extensionEnabled;

let _watchCorners;
let _watch;


function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    _timeoutsCollector    = [];
    _cornersCollector     = [];
    _actorsCollector      = [];
    _actionTimeoutId      = null;
    _extensionEnabled     = false;
    _barrierFallback      = false;
    _watch                = {};
}

function enable() {
    Actions = new ActionLib.Actions();
    _origUpdateHotCorners = Main.layoutManager._updateHotCorners;
    _extensionEnabled = true;
    _initMscOptions();
    actionTrigger = new ActionTrigger(_mscOptions);
    _replaceLayoutManager();
    _updateWatch();
}

function _replaceLayoutManager() {
    Main.layoutManager._updateHotCorners = _updateHotCorners;
    Main.layoutManager._updateHotCorners();
}

function disable() {
    _timeoutsCollector.forEach( c => GLib.Source.remove(c));
    _timeoutsCollector=[];
    _removeActionTimeout();
    _removeHotCorners();
    _mscOptions.destroy();
    Actions.clean();
    actionTrigger.clean();
    // This restores the original hot corners
    _extensionEnabled = false;
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
        if (hc[i]) {
            if (hc[i]._corner) {
               _destroyHotCorner(hc[i]._corner);
           }
        }
    }
    Main.layoutManager.hotCorners = [];
    _updateWatchCorners();
    // when some other extension steal my hot corners I still need to be able to destroy all actors I made
    _actorsCollector.filter(a => a !== null).forEach(a => a.destroy());
    _actorsCollector = [];
}

function _updateMscOptions(doNotUpdateHC = false) {
    Actions._wsSwitchIgnoreLast = _mscOptions.wsSwitchIgnoreLast;
    Actions._wsSwitchWrap       = _mscOptions.wsSwitchWrap;
    Actions._wsSwitchIndicator  = _mscOptions.wsSwitchIndicator;
    Actions._winSwitchWrap      = _mscOptions.winSwitchWrap;
    Actions._winSkipMinimized   = _mscOptions.winSkipMinimized;
    _actionEventDelay   = _mscOptions.actionEventDelay;
    _fullscreenGlobal   = _mscOptions.fullscreenGlobal;
    _rippleAnimation    = _mscOptions.rippleAnimation;
    if (_cornersVisible !== _mscOptions.cornersVisible) {
        _cornersVisible = _mscOptions.cornersVisible;
        if (!doNotUpdateHC) _updateHotCorners();
    }
    if (_barrierFallback !==  _mscOptions.barrierFallback) {
        _barrierFallback = _mscOptions.barrierFallback;
        if (!doNotUpdateHC)
            _updateHotCorners();
    }
    _updateWatch();
}

function _updateHotCorners() {
    _removeHotCorners();
    Main.layoutManager.hotCorners=[];
    _updateWatchCorners();
    let primaryIndex = Main.layoutManager.primaryIndex;
    // avoid creating new corners if this extension is disabled...
    // ...since this method overrides the original one in GS and something can store pointer to this replacement
    if (!_extensionEnabled) return;
    let monIndexes = [...Main.layoutManager.monitors.keys()];
    // index of primary monitor to the first possition
    monIndexes.splice(0, 0, monIndexes.splice(primaryIndex, 1)[0]);

    for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
        // Monitor 1 in preferences will allways refer to primary monitor
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
                _updateWatchCorners();
            }
        }
    }
}

function _setExpansionLimits(corners) {
    const cornerOrder = [0,1,3,2];
    for (let i = 0; i < corners.length; i++) {
        let prevCorner = (i + corners.length-1) % corners.length;
        let nextCorner = (i + 1) % corners.length;
            prevCorner = corners[cornerOrder[prevCorner]];
            nextCorner = corners[cornerOrder[nextCorner]];
        let corner = corners[cornerOrder[i]];
        if ((corner.left && prevCorner.left) || (!corner.left && !prevCorner.left)) {
            corner.fullExpandVertical   = (prevCorner.vExpand) ? false : true;
            corner.fullExpandHorizontal = (nextCorner.hExpand) ? false : true;
        }
        else if ((corner.top && prevCorner.top) || (!corner.top && !prevCorner.top)) {
            corner.fullExpandVertical   = (nextCorner.vExpand) ? false : true;
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
        case 'barrier-size':
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
                        if (Main.layoutManager.hotCorners !== _watchCorners) {
                            _updateHotCorners();
                            //Main.notify(Me.metadata.name, `Hot Corners had to be updated because of external override`);
                        }
                        if (!_watch.active) {
                            _timeoutsCollector.splice(_timeoutsCollector.indexOf(_watch.timeout));
                            _watch.timeout = null;
                        }
                        return _watch.active;
                    }
        );
        _timeoutsCollector.push(_watch.timeout);
    }
}

function _updateWatchCorners() {
    _watchCorners = Main.layoutManager.hotCorners;
}

function _rebuildHotCorner(corner) {
    _destroyHotCorner(corner);
    if (_shouldExistHotCorner(corner)) {
        Main.layoutManager.hotCorners.push(new CustomHotCorner(corner));
        _updateWatchCorners();
    }
}

function _destroyHotCorner(corner) {
    let hc=Main.layoutManager.hotCorners;
    for (let i = 0; i < hc.length; i++) {
        if (hc[i]._corner.top  === corner.top &&
            hc[i]._corner.left === corner.left &&
            hc[i]._corner.monitorIndex === corner.monitorIndex) {
                for (let a of Main.layoutManager.hotCorners[i]._actors) {
                    _actorsCollector.splice(_actorsCollector.indexOf(a));
                    a.destroy();
                }
                Main.layoutManager.hotCorners[i]._actors = [];
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

        if (this._corner.action[Triggers.PRESSURE] !== 'disabled' && !_barrierFallback) {
            this._pressureBarrier.connect('trigger', this._onPressureTriggered.bind(this));

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
        let sizeH = size[0];
        let sizeV = size[1];
        if (sizeH > 0 && sizeV > 0) {
            const BD = Meta.BarrierDirection;
            // for X11 session:
            //  right vertical and bottom horizontal pointer barriers must be 1px further to match the screen edge
            // ...because barriers are actually placed between pixels, along the top/left edge of the addressed pixels
            // ...Wayland behave differently and addressed pixel means the one behind which pointer can't go
            // but avoid barriers that are at the same position
            // ...and block opposite directions. Neither with X nor with Wayland
            // such barriers work.
            let x = this._corner.x + (Meta.is_wayland_compositor() ? 0: ((!this._corner.left && !this._barrierCollision()['x']) ? 1 : 0)); 
            this._verticalBarrier = new Meta.Barrier({
                display: global.display,
                x1: x,
                x2: x,
                y1: this._corner.y,
                y2: this._corner.top ? this._corner.y + sizeV : this._corner.y - sizeV,
                directions: this._corner.left ? BD.POSITIVE_X : BD.NEGATIVE_X
            });
            let y = this._corner.y + (Meta.is_wayland_compositor() ? 0: ((!this._corner.top && !this._barrierCollision()['y']) ? 1 : 0));
            this._horizontalBarrier = new Meta.Barrier({
                display: global.display,
                x1: this._corner.x,
                x2: this._corner.left ? this._corner.x + sizeH : this._corner.x - sizeH,
                y1: y,
                y2: y,
                directions: this._corner.top ? BD.POSITIVE_Y : BD.NEGATIVE_Y
            });

            this._pressureBarrier.addBarrier(this._verticalBarrier);
            this._pressureBarrier.addBarrier(this._horizontalBarrier);
        }
    }

    _barrierCollision() {
        // avoid barrier collisions on multimonitor system under X11 session
        let x = false;
        let y = false;
        for (let c of Main.layoutManager.hotCorners) {
            if (this._corner.x + 1 === c._corner.x) {
                x =  true;
            }
            if (this._corner.y + 1 === c._corner.y) {
                y =  true;
            }
        }
        return {'x': x,'y': y};
    }

    // Overridden original function
    _setupCornerActorsIfNeeded(layoutManager) {
        let shouldCreateActor = this._shouldCreateActor();
        if (!(shouldCreateActor || this._corner.hExpand || this._corner.vExpand)) {
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
        // the corner's reactive area can be expanded horizontaly and/or verticaly
        // if only one expansion is needed, only one actor will be created
        if (v && !h) {
            hSize = aSize;
            aSize = vSize;
        }

        
        // base clickable actor, normal size or expanded
        this._actor = new Clutter.Actor({
            name: 'hot-corner-h',
            x: this._corner.x + (this._corner.left ? 0 : - (hSize - 1)),
            y: this._corner.y + (this._corner.top  ? 0 : - (aSize - 1)),
            width: hSize,
            height: aSize,
            reactive: true,
            background_color: new Clutter.Color({
                red:   255,
                green: 120,
                blue:  0,
                //alpha: _cornersVisible ? ((h || v) ? 50 : 120) : 0
                alpha: _cornersVisible ? 255 : 0
            })

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
            this._actorV = new Clutter.Actor ({
                name: 'hot-corner-v',
                x: this._corner.x + (this._corner.left ? 0 : - (aSize - 1)),
                // avoid overlap with main actor
                y: this._corner.y + (this._corner.top  ? 1 : - (vSize)),
                width: aSize,
                height: vSize,
                reactive: true,
                background_color: new Clutter.Color({
                    red:   255,
                    green: 120,
                    blue:  0,
                    //alpha: _cornersVisible ? ((h || v) ? 50 : 120) : 0
                    alpha: _cornersVisible ? 255 : 0
                })
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
        if ( this._corner.action[Triggers.PRESSURE] !== 'disabled' &&
             (! global.display.supports_extended_barriers() || _barrierFallback) ) {
            let fSize = 3;
            this._cornerActor = new Clutter.Actor({
                name: 'hot-corner',
                x: (this._corner.left ? 0 : (this._actor.width  - 1) - (fSize - 1)),
                y: (this._corner.top  ? 0 : (this._actor.height - 1) - (fSize - 1)),
                width: fSize, height: fSize,
                reactive: true,
                visible: true,
                background_color: new Clutter.Color({
                    red:   0,
                    green: 255,
                    blue:  0,
                    //alpha: _cornersVisible ? ((h || v) ? 50 : 120) : 0
                    alpha: _cornersVisible ? 255 : 0})
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
            if (trigger === Triggers.PRESSURE && (global.display.supports_extended_barriers() && ! _barrierFallback)) {
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

    _ctrlPressed(state) {
        return (state & Clutter.ModifierType.CONTROL_MASK) != 0;
    }

    _onPressureTriggered() {
        if (this._corner.ctrl[Triggers.PRESSURE]) {
            // neither the 'enter' nor pressure 'trigger' events contain modifier state
            if (!Meta.is_wayland_compositor()) {
                // and default keymap modifier state is always 0 on Wayland
                let keymap = Gdk.Keymap.get_for_display(Gdk.Display.get_default());
                let state = keymap.get_modifier_state();
                if (!this._ctrlPressed(state))
                    return;
            } else {
                Main.notify(Me.metadata.name, _(`'Ctrl' option is not Wayland compatible` ));
                return;
            }
        }
        this._runAction(Triggers.PRESSURE);
    }
    _onCornerClicked(actor, event) {
        if (event.get_click_count() > 1) return; // ignore second click of double clicks
        let button = event.get_button();
        let trigger;
        let state = event.get_state();
        switch (button) {
            case Clutter.BUTTON_PRIMARY:
                if (this._corner.ctrl[Triggers.BUTTON_PRIMARY] && !this._ctrlPressed(state))
                    return;
                trigger = Triggers.BUTTON_PRIMARY;
                break;
            case Clutter.BUTTON_SECONDARY:
                if (this._corner.ctrl[Triggers.BUTTON_SECONDARY] && !this._ctrlPressed(state))
                    return;
                trigger = Triggers.BUTTON_SECONDARY;
                break;
            case Clutter.BUTTON_MIDDLE:
                if (this._corner.ctrl[Triggers.BUTTON_MIDDLE] && !this._ctrlPressed(state))
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
        let state = event.get_state();
        if (_notValidScroll(direction)) return;
        let trigger;
        switch (direction) {
            case Clutter.ScrollDirection.UP:
                if (this._corner.ctrl[Triggers.SCROLL_UP] && !this._ctrlPressed(state))
                    return;
                trigger = Triggers.SCROLL_UP;
                break;
            case Clutter.ScrollDirection.DOWN:
                if (this._corner.ctrl[Triggers.SCROLL_DOWN] && !this._ctrlPressed(state))
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
        if ( (_actionTimeoutActive(trigger) && !(['volumeUp','volumeDown'].includes(this._corner.action[trigger])))
            || this._corner.action[trigger] == 'disabled'
            ) return;
        if (    (!this._monitor.inFullscreen) ||
                ( this._monitor.inFullscreen  && (this._corner.fullscreen[trigger] || _fullscreenGlobal))) {
            if (_rippleAnimation) this._rippleAnimation();
            actionTrigger.runAction(  this._corner.action[trigger],
                                      this._corner.monitorIndex,
                                      this._corner.workspaceIndex[trigger],
                                      this._corner.command[trigger]
            );
        }
    }


});

function _removeActionTimeout() {
    _timeoutsCollector.splice(_timeoutsCollector.indexOf(_actionTimeoutId));
    _actionTimeoutId = null;
    return false;
}

function _notValidScroll(direction) {
    if (direction === Clutter.ScrollDirection.SMOOTH) return true;
    return false;
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



const ActionTrigger = class ActionTrigger {

    constructor(mscOptions) {
        this._gsettingsKB = mscOptions._gsettingsKB;
        this._monitorIndex = 0;
        this._workspaceIndex = 0;
        this._command = '';

        this.m = new Map([
            ['toggleOverview',  this._overview                ],
            ['showApplications',this._showAppGrid             ],
            ['showDesktop',     this._showDesktop             ],
            ['showDesktopMon',  this._showDesktopMonitor      ],
            ['blackScreen',     this._blackScreen             ],
            ['blackScreenMon',  this._blackScreenMonitor      ],
            ['runCommand',      this._runCommand              ],
            ['runDialog',       this._runDialog               ],
            ['prevWorkspace',   this._prevWorkspace           ],
            ['nextWorkspace',   this._nextWorkspace           ],
            ['moveToWorkspace', this._moveToWorkspace         ],
            ['recentWS',        this._moveToRecentWorkspace   ],
            ['prevWinAll',      this._prevWindow              ],
            ['prevWinWS',       this._prevWindowWS            ],
            ['prevWinWsMon',    this._prevWinMonitor          ],
            ['nextWinAll',      this._nextWindow              ],
            ['nextWinWS',       this._nextWindowWS            ],
            ['nextWinWsMon',    this._nextWinMonitor          ],
            ['recentWin',       this._recentWindow            ],
            ['closeWin',        this._closeWindow             ],
            ['killApp',         this._killApp                 ],
            ['maximizeWin',     this._maximizeWindow          ],
            ['minimizeWin',     this._minimizeWindow          ],
            ['fullscreenWin',   this._fullscreenWindow        ],
            ['aboveWin',        this._aboveWindow             ],
            ['stickWin',        this._stickWindow             ],
            ['screenLock',      this._lockScreen              ],
            ['suspend',         this._suspendToRam            ],
            ['powerOff',        this._powerOff                ],
            ['logout',          this._logOut                  ],
            ['switchUser',      this._switchUser              ],
            ['volumeUp',        this._volumeUp                ],
            ['volumeDown',      this._volumeDown              ],
            ['muteAudio',       this._mute                    ],
            ['toggleZoom',      this._toggleZoom              ],
            ['zoomIn',          this._zoomIn                  ],
            ['zoomOut',         this._zoomOut                 ],
            ['keyboard',        this._showKeyboard            ],
            ['largeText',       this._largeText               ],
            ['screenReader',    this._screenReader            ],
            ['hidePanel',       this._togglePanel             ],
            ['toggleTheme',     this._toggleTheme             ],
            ['lookingGlass',    this._lookingGlass            ],
            ['restartShell',    this._restartGnomeShell       ],
            ['prefs',           this._showPrefs               ],
            ['invertLightWin',  this._lightnessInvertWindow   ],
            ['invertLightAll',  this._lightnessInvertGlobal   ],
            ['desaturateAll',   this._toggleDesaturateGlobal  ],
            ['desaturateWin',   this._toggleDesaturateWindow  ],
            ['brightUpAll',     this._brightnessUpGlobal      ],
            ['brightDownAll',   this._brightnessDownGlobal    ],
            ['brightUpWin',     this._brightnessUpWindow      ],
            ['brightDownWin',   this._brightnessDownWindow    ],
            ['contrastUpAll',   this._contrastUpGlobal        ],
            ['contrastDownAll', this._contrastDownGlobal      ],
            ['contrastUpWin',   this._contrastUpWindow        ],
            ['contrastDownWin', this._contrastDownWindow      ],
            ['opacityUpWin',    this._opacityUpWindow         ],
            ['opacityDownWin',  this._opacityDownWindow       ],
            ['opacityToggleWin',this._opacityToggleWin        ],
            ['tintRedToggleWin',this._redTintToggleWindow     ],
            ['tintRedToggleAll',this._redTintToggleGlobal     ],
            ['tintGreenToggleWin',this._greenTintToggleWindow ],
            ['tintGreenToggleAll',this._greenTintToggleGlobal ],
            ['toggleNightLight',this._nightLightToggle        ],
            ['removeAllEffects',this._removeAllEffects        ]
        ]);

        this._shortcutsBindingIds=[];
        this._gsettingsKBid = 0;
        this._bindShortcuts();

    }

    runAction(action, monitorIndex = 0, workspaceIndex = 0, command = '') {
        this._monitorIndex = monitorIndex;
        this._command = command;
        this._workspaceIndex = workspaceIndex;
        let actionFunction = this.m.get(action).bind(this) || function () {};
        actionFunction();
    }

    clean() {
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
        Main.wm.addKeybinding(  key,
                                this._gsettingsKB,
                                Meta.KeyBindingFlags.NONE,
                                Shell.ActionMode.ALL,
                                () => {
                                        this.runAction(action);
                                }
        );
    }

    _updateKeyBinding(settings, key) {
        if (settings.get_strv(key)[0]) {
            this._bindShortcut(key, this._translateKeyToAction(key));
        }
    }

    _removeShortcuts() {
        for (let key of this._shortcutsBindingIds) {
            Main.wm.removeKeybinding(key);
        }
        this._shortcutsBindingIds = [];
    }

    _disconnectSettingsKB() {
        this._gsettingsKB.disconnect(this._gsettingsKBid)
    }

    _translateKeyToAction(key) {
        let regex = /-(.)/g;
        return key.replace(regex,function($0,$1) {
            return $0.replace($0, $1.toUpperCase());
        }).replace('Gdh', '');
    }

    _overview() {
        Actions.toggleOverview();
    }
    _showAppGrid() {
        Actions.showApplications();
    }
    _showDesktop() {
        Actions.togleShowDesktop();
    }
    _showDesktopMonitor() {
        Actions.togleShowDesktop(this._monitorIndex);
    }
    _runCommand() {
        Actions.runCommand(this._command);
    }
    _moveToWorkspace() {
        Actions.moveToWorkspace(this._workspaceIndex - 1);
    }
    _prevWorkspace() {
        Actions.switchWorkspace(Clutter.ScrollDirection.UP);
    }
    _nextWorkspace() {
        Actions.switchWorkspace(Clutter.ScrollDirection.DOWN);
    }
    _moveToRecentWorkspace() {
        Actions.moveToRecentWorkspace();
    }
    _prevWindow() {
        Actions.switchWindow( -1, false, -1);
    }
    _nextWindow() {
        Actions.switchWindow( +1, false, -1);
    }
    _prevWindowWS() {
        Actions.switchWindow( -1, true, -1);
    }
    _nextWindowWS() {
        Actions.switchWindow( +1, true, -1);
    }
    _prevWinMonitor() {
        Actions.switchWindow( -1, true, this._monitorIndex);
    }
    _nextWinMonitor() {
        Actions.switchWindow( +1, true, this._monitorIndex);
    }
    _recentWindow() {
        Actions.recentWindow();
    }
    _closeWindow() {
        Actions.closeWindow();
    }
    _killApp() {
        Actions.killApplication();
    }
    _maximizeWindow() {
        Actions.toggleMaximizeWindow();
    }
    _minimizeWindow() {
        Actions.minimizeWindow();
    }
    _fullscreenWindow() {
        Actions.toggleFullscreenWindow();
    }
    _aboveWindow() {
        Actions.toggleAboveWindow();
    }
    _stickWindow() {
        Actions.toggleStickWindow();
    }
    _restartGnomeShell() {
        Actions.restartGnomeShell();
    }
    _volumeUp() {
        Actions.adjustVolume(1);
    }
    _volumeDown() {
        Actions.adjustVolume(-1);
    }
    _mute() {
        Actions.adjustVolume(0);
    }
    _lockScreen() {
        Actions.lockScreen();
    }
    _suspendToRam () {
        Actions.suspendToRam();
    }
    _powerOff() {
        Actions.powerOff();
    }
    _logOut() {
        Actions.logOut();
    }
    _switchUser() {
        Actions.switchUser();
    }
    _lookingGlass() {
        Actions.toggleLookingGlass()
    }
    _showPrefs() {
        Actions.openPreferences();
    }
    _blackScreen() {
        let opacity = 255;
        let note = Me.metadata.name;
        Actions.toggleDimmMonitors(
            opacity,
            note
        );
    }
    _blackScreenMonitor() {
        let opacity = 255;
        let note = Me.metadata.name;
        Actions.toggleDimmMonitors(
            opacity,
            note,
            this._monitorIndex
        );
    }
    _toggleZoom() {
        Actions.zoom(0);
    }
    _zoomIn(){
        Actions.zoom(0.25);
    }
    _zoomOut(){
        Actions.zoom(-0.25);
    }
    _showKeyboard() {
        Actions.toggleKeyboard(this._monitorIndex);
    }
    _screenReader() {
        Actions.toggleScreenReader();
    }
    _largeText() {
        Actions.toggleLargeText()
    }
    _togglePanel() {
        Actions.toggleShowPanel();
    }
    _toggleTheme() {
        Actions.toggleTheme();

    }
    _runDialog() {
        Actions.openRunDialog();
    }
    _lightnessInvertGlobal() {
        Actions.toggleLightnessInvertEffect(false);
    }
    _lightnessInvertWindow() {
        Actions.toggleLightnessInvertEffect(true);
    }
    _toggleDesaturateGlobal() {
        Actions.toggleDesaturateEffect(false);
    }
    _toggleDesaturateWindow() {
        Actions.toggleDesaturateEffect(true);
    }
    _brightnessUpGlobal() {
        Actions.adjustSwBrightnessContrast(+0.025);
    }
    _brightnessDownGlobal() {
        Actions.adjustSwBrightnessContrast(-0.025);
    }
    _brightnessUpWindow() {
        Actions.adjustSwBrightnessContrast(+0.025, true);
    }
    _brightnessDownWindow() {
        Actions.adjustSwBrightnessContrast(-0.025, true);
    }
    _contrastUpGlobal() {
        Actions.adjustSwBrightnessContrast(+0.025, false, false);
    }
    _contrastDownGlobal() {
        Actions.adjustSwBrightnessContrast(-0.025, false, false);
    }
    _contrastUpWindow() {
        Actions.adjustSwBrightnessContrast(+0.025, true, false);
    }
    _contrastDownWindow() {
        Actions.adjustSwBrightnessContrast(-0.025, true, false);
    }
    _opacityUpWindow() {
        Actions.adjustWindowOpacity(+12);
    }
    _opacityDownWindow() {
        Actions.adjustWindowOpacity(-12);
    }
    _opacityToggleWin() {
        Actions.adjustWindowOpacity(0, 200);
    }
    _nightLightToggle() {
        Actions.toggleNightLight();
    }
    _redTintToggleWindow(){
        Actions.toggleRedTintEffect(
            new Clutter.Color({
                red:    255,
                green:  200,
                blue:   146,
            }),
            true);
    }
    _redTintToggleGlobal(){
        Actions.toggleRedTintEffect(
            new Clutter.Color({
                red:    255,
                green:  200,
                blue:   146,
            }),
            false);
    }
    _greenTintToggleWindow(){
        Actions.toggleRedTintEffect(
            new Clutter.Color({
                red:    200,
                green:  255,
                blue:   146,
            }),
            true);
    }
    _greenTintToggleGlobal(){
        Actions.toggleRedTintEffect(
            new Clutter.Color({
                red:    200,
                green:  255,
                blue:   146,
            }),
            false);
    }
    _removeAllEffects() {
        Actions.removeEffects(true);
    }
};