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