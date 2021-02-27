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

const Main = imports.ui.main;
const Layout = imports.ui.layout;
const Ripples = imports.ui.ripples;
const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Settings = Me.imports.settings;

let _origUpdateHotCorners = Main.layoutManager._updateHotCorners;
let _corners = [];

function init() {
}

function enable() {
    Main.layoutManager._updateHotCorners = _updateHotCorners;
    Main.layoutManager._updateHotCorners();
}

function disable() {
    // This restores the original hot corners
    _removeHotCorners();
    Main.layoutManager._updateHotCorners = _origUpdateHotCorners;
    Main.layoutManager._updateHotCorners();
}

function _removeHotCorners() {
    _corners.forEach(c => c.destroy());
    _corners = [];
    // hot corners might be null
    Main.layoutManager.hotCorners.filter(Boolean).forEach(c => c.destroy());
    Main.layoutManager.hotCorners = [];
}

function _updateHotCorners() {
    _removeHotCorners();

    for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
        const corners = Settings.Corner.forMonitor(i, global.display.get_monitor_geometry(i));
        for (let corner of corners) {
            _corners.push(corner);
            // Update all hot corners if something changes
            corner.connect('changed', () => _updateHotCorners());
            if (corner.action !== 'disabled') {
                Main.layoutManager.hotCorners.push(new CustomHotCorner(corner));
            }
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

        let m = new Map([
            ['toggleOverview', this._toggleOverview],
            ['showDesktop', this._showDesktop],
            ['showApplications', this._showApplications],
            ['runCommand', this._runCommand]
        ]);
        this._actionFunction = m.get(this._corner.action) || function () {};

        // Avoid pointer barriers that are at the same position
        // but block opposite directions. Neither with X nor with Wayland
        // such barriers work.
        for (let c of Main.layoutManager.hotCorners) {
            if (this._corner.x === c._x && this._corner.y === c._y) {
                if (this._corner.top === c._top) {
                    this._corner.x += this._corner.left ? 1 : -1;
                } else if (this._corner.left === c._left) {
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

        if (! this._corner.click) {
            this._pressureBarrier.connect('trigger', this._runAction.bind(this));
            this._setupFallbackCornerIfNeeded(Main.layoutManager);

            this.setBarrierSize(corner.barrierSize);

        } else {
            this.cActor = new Clutter.Actor({
                name: 'hot-corner',
                x: this._corner.x, y: this._corner.y,
                width: 4, height: 4,
                reactive: true,
                scale_x: this._corner.left ? 1 : -1,
                scale_y: this._corner.top ? 1 : -1
            });
            this.cActor._delegate = this;
            this.cActor.connect('button-press-event', this._onCornerClicked.bind(this));
            Main.layoutManager.addChrome(this.cActor);
            _corners.push(this.cActor);
        }

        // Rotate the ripple actors according to the corner.
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
                x1: this._corner.x,
                x2: this._corner.x,
                y1: this._corner.y,
                y2: this._corner.top ? this._corner.y + size : this._corner.y - size,
                directions: this._corner.left ? BD.POSITIVE_X : BD.NEGATIVE_X
            });
            this._horizontalBarrier = new Meta.Barrier({
                display: global.display,
                x1: this._corner.x,
                x2: this._corner.left ? this._corner.x + size : this._corner.x - size,
                y1: this._corner.y,
                y2: this._corner.y,
                directions: this._corner.top ? BD.POSITIVE_Y : BD.NEGATIVE_Y
            });

            this._pressureBarrier.addBarrier(this._verticalBarrier);
            this._pressureBarrier.addBarrier(this._horizontalBarrier);
        }
    }

    // Overridden to allow all 4 monitor corners
    _setupFallbackCornerIfNeeded(layoutManager) {
        if (global.display.supports_extended_barriers() || this._corner.click)
            return;
        this.actor = new Clutter.Actor({
            name: 'hot-corner-environs',
            x: this._corner.x, y: this._corner.y,
            width: 3, height: 3,
            reactive: true,
            scale_x: this._corner.left ? 1 : -1,
            scale_y: this._corner.top ? 1 : -1
        });

        this._cornerActor = new Clutter.Actor({
            name: 'hot-corner',
            x: 0, y: 0,
            width: 1, height: 1,
            reactive: true
        });

        this._cornerActor._delegate = this;
        this.actor.add_child(this._cornerActor);
        layoutManager.addChrome(this.actor);

        this.actor.connect('leave-event', this._onEnvironsLeft.bind(this));
        this._cornerActor.connect('enter-event', this._onCornerEntered.bind(this));
        this._cornerActor.connect('leave-event', this._onCornerLeft.bind(this));
    }

    _rippleAnimation() {
        this._ripples.playAnimation(this._corner.x, this._corner.y);
    }

    // Overridden to allow running custom actions
    _onCornerEntered() {
        if (!this._entered) {
            this._entered = true;
            this._runAction();
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onCornerClicked(actor, event) {
        this._runAction();
        return Clutter.EVENT_STOP;   
    }

    _runAction() {
        if (this._monitor.inFullscreen && this._corner.fullscreen) {
            this._actionFunction();
        } else if (!this._monitor.inFullscreen) {
            this._actionFunction();
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
        Util.spawn([
            'sh',
            '-c',
            ('if wmctrl -m | grep -q -e "mode: OFF" -e "mode: N/A"; ' +
             'then wmctrl -k on; else wmctrl -k off; fi')
        ]);
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
        Util.spawnCommandLine(this._corner.command);
    }
});
