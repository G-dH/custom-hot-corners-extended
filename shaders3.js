/* This is a part of Custom Hot Corners - Extended, the Gnome Shell extension
 * Copyright 2021 GdH <georgdh@gmail.com>
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
const GObject                = imports.gi.GObject;
const Clutter                = imports.gi.Clutter;
const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();
const ShaderLib              = Me.imports.shaderLib.ShaderLib;
var   shaderLib              = new ShaderLib();

var   InvertLightnessEffect = GObject.registerClass(
class InvertLightnessEffect extends Clutter.ShaderEffect {

    vfunc_get_static_shader_source() {
        return shaderLib.getInversion(0);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value("tex", 0);
        super.vfunc_paint_target(paint_context);
    }
});

var   InvertLightnessShiftEffect = GObject.registerClass(
class InvertLightnessShiftEffect extends Clutter.ShaderEffect {

    vfunc_get_static_shader_source() {
        return shaderLib.getInversion(1);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value("tex", 0);
        super.vfunc_paint_target(paint_context);
    }
});

var   ColorInversionEffect = GObject.registerClass(
class ColorInversionEffect extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return shaderLib.getInversion(2);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value("tex", 0);
        super.vfunc_paint_target(paint_context);
    }
});

var   ColorMixerEffect1 = GObject.registerClass(
class ColorMixerEffect1 extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return shaderLib.getChanellMix(1);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value("tex", 0);
        super.vfunc_paint_target(paint_context);
    }
});

var   ColorMixerEffect2 = GObject.registerClass(
class ColorMixerEffect2 extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return shaderLib.getChanellMix(2);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value("tex", 0);
        super.vfunc_paint_target(paint_context);
    }
});

var   ColorMixerProtan = GObject.registerClass(
class ColorMixerProtan extends Clutter.ShaderEffect {

    vfunc_get_static_shader_source() {
        return shaderLib.getDaltonism(1);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value('tex', 0);
        super.vfunc_paint_target(paint_context);
    }
});

var   ColorMixerDeuter = GObject.registerClass(
class ColorMixerDeuter extends Clutter.ShaderEffect {

    vfunc_get_static_shader_source() {
        return shaderLib.getDaltonism(2);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value('tex', 0);
        super.vfunc_paint_target(paint_context);
    }
});

var   ColorMixerTritan = GObject.registerClass(
class ColorMixerTritan extends Clutter.ShaderEffect {

    vfunc_get_static_shader_source() {
        return shaderLib.getDaltonism(3);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value('tex', 0);
        super.vfunc_paint_target(paint_context);
    }
});

var   ColorMixerProtanSimulation = GObject.registerClass(
class ColorMixerProtanSimulation extends Clutter.ShaderEffect {

    vfunc_get_static_shader_source() {
        return shaderLib.getDaltonism(1);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value('tex', 0);
        super.vfunc_paint_target(paint_context);
    }
});

var   ColorMixerDeuterSimulation = GObject.registerClass(
class ColorMixerDeuterSimulation extends Clutter.ShaderEffect {

    vfunc_get_static_shader_source() {
        return shaderLib.getDaltonism(2);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value('tex', 0);
        super.vfunc_paint_target(paint_context);
    }
});

var   ColorMixerTritanSimulation = GObject.registerClass(
class ColorMixerTritanSimulation extends Clutter.ShaderEffect {

    vfunc_get_static_shader_source() {
        return shaderLib.getDaltonism(3);
    }

    vfunc_paint_target(paint_context) {
        this.set_uniform_value('tex', 0);
        super.vfunc_paint_target(paint_context);
    }
});