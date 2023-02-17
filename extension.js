/**
 * Custom Hot Corners - Extended
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

'use strict';

const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();
const HotCorners             = Me.imports.src.extension.hotCorners;

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    return new HotCorners.CustomHotCornersExtended();
}
