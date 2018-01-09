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
const Lang = imports.lang;

const Main = imports.ui.main;
const Layout = imports.ui.layout;
const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

let _settings = Convenience.getSettings();
let _updateHotCornersId = null;
let _origUpdateHotCorners = Main.layoutManager._updateHotCorners;

function init() {
}

function enable() {
    Main.layoutManager._updateHotCorners = _updateHotCorners;
    Main.layoutManager._updateHotCorners();
    _updateHotCornersId = _settings.connect(
        'changed::actions',
        Main.layoutManager._updateHotCorners
    );
}

function disable() {
    _settings.disconnect(_updateHotCornersId);
    // This restores the original hot corners
    _removeHotCorners();
    Main.layoutManager._updateHotCorners = _origUpdateHotCorners;
    Main.layoutManager._updateHotCorners();
}

function _removeHotCorners() {
    // hot corners might be null
    Main.layoutManager.hotCorners.filter(Boolean).forEach(c => c.destroy());
    Main.layoutManager.hotCorners = [];
}

function _updateHotCorners() {
    _removeHotCorners();
    let actions = _settings.get_value('actions').deep_unpack();
    for (let [monitorNumber, top, left, id, cmd] of actions) {
        let monitor = Main.layoutManager.monitors[monitorNumber];
        if (monitor && id !== 'disabled') {
            let c = new CustomHotCorner(monitor, top, left, id, cmd);
            c.setBarrierSize(20);
            Main.layoutManager.hotCorners.push(c);
        }
    }
}

const CustomHotCorner = new Lang.Class({
    Name: 'CustomHotCorner',
    Extends: Layout.HotCorner,

    _init: function (monitor, top, left, action, command) {
        this._top = top;
        this._left = left;
        this._action = action;
        this._command = command;

        let m = new Map([
            ['toggleOverview', this._toggleOverview],
            ['showDesktop', this._showDesktop],
            ['showApplications', this._showApplications],
            ['runCommand', this._runCommand]
        ]);
        this._actionFunction = m.get(action) || function () {};

        this._x = left ? monitor.x : monitor.x + monitor.width;
        this._y = top ? monitor.y : monitor.y + monitor.height;

        // Avoid pointer barriers that are at the same position
        // but block opposite directions. Neither with X nor with Wayland
        // such barriers work.
        for (let c of Main.layoutManager.hotCorners) {
            if (this._x === c._x && this._y === c._y) {
                if (this._top === c._top) {
                    this._x += this._left ? 1 : -1;
                } else if (this._left === c._left) {
                    this._y += this._top ? 1 : -1;
                }
            }
        }

        this._enterd = false;
        this._monitor = monitor;
        this._pressureBarrier = new Layout.PressureBarrier(
            Layout.HOT_CORNER_PRESSURE_THRESHOLD,
            Layout.HOT_CORNER_PRESSURE_TIMEOUT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW
        );

        this._pressureBarrier.connect('trigger', this._runAction.bind(this));

        this._setupFallbackCornerIfNeeded(Main.layoutManager);

        // Rotate the ripple actors according to the corner.
        // Negative scaling doesn't work here because that property is used
        // in the _animRipple function of the parent class.
        let ltr = (Clutter.get_default_text_direction() ==
                   Clutter.TextDirection.LTR);
        let angle = (left && ltr) ? (top ? 0 : 270) : (top ? 90 : 180);
        let properties = {
            style_class: 'ripple-box',
            opacity: 0,
            visible: false,
            rotation_angle_z: angle
        };
        this._ripple1 = new St.BoxLayout(properties);
        this._ripple2 = new St.BoxLayout(properties);
        this._ripple3 = new St.BoxLayout(properties);

        Main.layoutManager.uiGroup.add_actor(this._ripple1);
        Main.layoutManager.uiGroup.add_actor(this._ripple2);
        Main.layoutManager.uiGroup.add_actor(this._ripple3);
    },

    destroy: function () {
        Main.layoutManager.uiGroup.remove_actor(this._ripple1);
        Main.layoutManager.uiGroup.remove_actor(this._ripple2);
        Main.layoutManager.uiGroup.remove_actor(this._ripple3);
        this._ripple1.destroy();
        this._ripple2.destroy();
        this._ripple3.destroy();
        this.parent();
    },

    // Overridden to allow all 4 monitor corners
    setBarrierSize: function (size) {
        // Use code of parent class to remove old barriers but new barriers
        // must be created here since the properties are construct only.
        this.parent(0);

        if (size > 0) {
            const BD = Meta.BarrierDirection;
            this._verticalBarrier = new Meta.Barrier({
                display: global.display,
                x1: this._x,
                x2: this._x,
                y1: this._y,
                y2: this._top ? this._y + size : this._y - size,
                directions: this._left ? BD.POSITIVE_X : BD.NEGATIVE_X
            });
            this._horizontalBarrier = new Meta.Barrier({
                display: global.display,
                x1: this._x,
                x2: this._left ? this._x + size : this._x - size,
                y1: this._y,
                y2: this._y,
                directions: this._top ? BD.POSITIVE_Y : BD.NEGATIVE_Y
            });

            this._pressureBarrier.addBarrier(this._verticalBarrier);
            this._pressureBarrier.addBarrier(this._horizontalBarrier);
        }
    },

    // Overridden to allow all 4 monitor corners
    _setupFallbackCornerIfNeeded: function (layoutManager) {
        if (global.display.supports_extended_barriers())
            return;

        this.actor = new Clutter.Actor({
            name: 'hot-corner-environs',
            x: this._x, y: this._y,
            width: 3, height: 3,
            reactive: true,
            scale_x: this._left ? 1 : -1,
            scale_y: this._top ? 1 : -1
        });

        this._corner = new Clutter.Actor({
            name: 'hot-corner',
            x: 0, y: 0,
            width: 1, height: 1,
            reactive: true
        });

        this._corner._delegate = this;
        this.actor.add_child(this._corner);
        layoutManager.addChrome(this.actor);

        this.actor.connect('leave-event', this._onEnvironsLeft.bind(this));
        this._corner.connect('enter-event', this._onCornerEntered.bind(this));
        this._corner.connect('leave-event', this._onCornerLeft.bind(this));
    },

    // Overridden to allow running custom actions
    _onCornerEntered: function () {
        if (!this._entered) {
            this._entered = true;
            this._runAction();
        }
        return Clutter.EVENT_PROPAGATE;
    },

    _runAction: function () {
        if (!this._monitor.inFullscreen) {
            this._actionFunction();
        }
    },

    _toggleOverview: function () {
        if (Main.overview.shouldToggleByCornerOrButton()) {
            this._rippleAnimation();
            Main.overview.toggle();
        }
    },

    _showDesktop: function () {
        this._rippleAnimation();
        Util.spawn([
            'sh',
            '-c',
            ('if wmctrl -m | grep -q -e "mode: OFF" -e "mode: N/A"; ' +
             'then wmctrl -k on; else wmctrl -k off; fi')
        ]);
    },

    _showApplications: function () {
        this._rippleAnimation();
        Main.overview.viewSelector._toggleAppsPage();
    },

    _runCommand: function () {
        this._rippleAnimation();
        Util.spawnCommandLine(this._command);
    }
});
