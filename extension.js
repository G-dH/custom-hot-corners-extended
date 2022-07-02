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

const { GLib } = imports.gi;

const Main                   = imports.ui.main;
//const Layout                 = imports.ui.layout;

const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();
const HotCorners             = Me.imports.src.extension.hotCorners;

let _origUpdateHotCorners;
let _originalHotCornerEnabled;
let _delayId;

function init() {
    _origUpdateHotCorners = imports.ui.layout.LayoutManager.prototype._updateHotCorners;
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function enable() {
    // delayed start to avoid initial hot corners overrides from other extensions
    // and also to not slowing down the screen unlock animation - the killer is registration of keyboard shortcuts
    _delayId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        500,
        () => {
            _originalHotCornerEnabled = Main.layoutManager._interfaceSettings.get_boolean('enable-hot-corners');
            Main.layoutManager._interfaceSettings.set_boolean('enable-hot-corners', false);

            if (!HotCorners.chce)
                HotCorners.chce = new HotCorners.CustomHotCornersExtended();
            // chce delegates 'this' in _updateHotCorners() function when called from Gnome Shell
            HotCorners.chce.enable();

            log(`${Me.metadata.name}: enabled`);

            _delayId = 0;
            return GLib.SOURCE_REMOVE;
        }
    );
}

function disable() {
    if (_delayId) {
        GLib.source_remove(_delayId);
        _delayId = 0;
    }

    // restore original hot corners
    // some extensions also modify Main.layoutManager._updateHotCorners._updateHotCorners()
    //   and so it'll be more secure to take the function from the source (which could be altered too but less likely)
    Main.layoutManager._interfaceSettings.set_boolean('enable-hot-corners', true); //this._hotCornerEnabledOrig);
    Main.layoutManager._updateHotCorners = _origUpdateHotCorners;
    Main.layoutManager._updateHotCorners();

    let fullDisable;
    if (HotCorners.chce) {
        fullDisable = chce.disable();
        if (fullDisable) {
            HotCorners.chce = null;
        }
    }
    log(`${Me.metadata.name}: ${fullDisable ? 'disabled' : 'suspended'}`);
}
