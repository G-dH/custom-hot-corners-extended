/**
 * Custom Hot Corners - Extended
 * Shaders
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';

export const   InvertLightnessEffect = GObject.registerClass(
class InvertLightnessEffect extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getInversion(0);
    }

    vfunc_paint_target(node, paintContext) {
        this.set_uniform_value('tex', 0);
        if (paintContext === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paintContext);
    }
});

export const   InvertLightnessShiftEffect = GObject.registerClass(
class InvertLightnessShiftEffect extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getInversion(1);
    }

    vfunc_paint_target(node, paintContext) {
        this.set_uniform_value('tex', 0);
        if (paintContext === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paintContext);
    }
});

export const   ColorInversionEffect = GObject.registerClass(
class ColorInversionEffect extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getInversion(2);
    }

    vfunc_paint_target(node, paintContext) {
        this.set_uniform_value('tex', 0);
        if (paintContext === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paintContext);
    }
});

export const   ColorMixerEffect1 = GObject.registerClass(
class ColorMixerEffect1 extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getChannelMix(1);
    }

    vfunc_paint_target(node, paintContext) {
        this.set_uniform_value('tex', 0);
        if (paintContext === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paintContext);
    }
});

export const   ColorMixerEffect2 = GObject.registerClass(
class ColorMixerEffect2 extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getChannelMix(2);
    }

    vfunc_paint_target(node, paintContext) {
        this.set_uniform_value('tex', 0);
        if (paintContext === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paintContext);
    }
});

export const   DaltonismEffect = GObject.registerClass(
class DaltonismEffect extends Clutter.ShaderEffect {
    _init(properties) {
        super._init();
        this._mode = properties.mode;
        this._simulation = properties.simulate;

        this.set_shader_source(ShaderLib.getDaltonism(this._mode, this._simulation));
    }

    vfunc_get_static_shader_source() {
        return ShaderLib.getDaltonism(this._mode, this._simulation);
    }

    vfunc_paint_target(node, paintContext) {
        this.set_uniform_value('tex', 0);
        if (paintContext === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paintContext);
    }
});


export const ShaderLib = class {
    static getDaltonism(mode = 1, simulate) {
        return `
            uniform sampler2D tex;
            #define COLORBLIND_MODE ${mode}
            #define SIMULATE ${simulate}
            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);

                // RGB to LMS matrix
                float L = (17.8824 * c.r) + (43.5161 * c.g) + (4.11935 * c.b);
                float M = (3.45565 * c.r) + (27.1554 * c.g) + (3.86714 * c.b);
                float S = (0.0299566 * c.r) + (0.184309 * c.g) + (1.46709 * c.b);

                // Remove invisible colors
                #if ( COLORBLIND_MODE == 1) // Protanopia - reds are greatly reduced
                    float l = 0.0 * L + 2.02344 * M + -2.52581 * S;
                    float m = 0.0 * L + 1.0 * M + 0.0 * S;
                    float s = 0.0 * L + 0.0 * M + 1.0 * S;
                #endif
                #if ( COLORBLIND_MODE == 2) // Deuteranopia - greens are greatly reduced
                    float l = 1.0 * L + 0.0 * M + 0.0 * S;
                    float m = 0.494207 * L + 0.0 * M + 1.24827 * S;
                    float s = 0.0 * L + 0.0 * M + 1.0 * S;
                #endif
                #if ( COLORBLIND_MODE == 3) // Tritanopia - blues are greatly reduced (1 of 10 000)
                    float l = 1.0 * L + 0.0 * M + 0.0 * S;
                    float m = 0.0 * L + 1.0 * M + 0.0 * S;
                    // GdH - trinatopia vector calculated by me, all public sources were off
                    float s = -0.012491378299329402 * L + 0.07203451899279534 * M + 0.0 * S;
                #endif

                // LMS to RGB matrix conversion
                vec4 error;
                error.r = (0.0809444479 * l) + (-0.130504409 * m) + (0.116721066 * s);
                error.g = (-0.0102485335 * l) + (0.0540193266 * m) + (-0.113614708 * s);
                error.b = (-0.000365296938 * l) + (-0.00412161469 * m) + (0.693511405 * s);
                error.a = 1.0;

                // The error is what they see
                #if (SIMULATE == 1)
                    error.a = c.a;
                    cogl_color_out = error.rgba;
                    return;
                #endif
                #if (SIMULATE == 0)
                    // Isolate invisible colors to color vision deficiency (calculate error matrix)
                    error = (c - error);
                    
                    // Shift colors
                    vec4 correction;
                    // protanopia / protanomaly corrections (kwin effect values)
                    #if ( COLORBLIND_MODE == 1 )
                        correction.r = error.r * 0.56667 + error.g * 0.43333 + error.b * 0.00000;
                        correction.g = error.r * 0.55833 + error.g * 0.44267 + error.b * 0.00000;
                        correction.b = error.r * 0.00000 + error.g * 0.24167 + error.b * 0.75833;

                    // deuteranopia / deuteranomaly corrections (tries to mimic Android, GdH)
                    #elif ( COLORBLIND_MODE == 2 )
                        correction.r = error.r * -0.7; // + error.g * 0.0 + error.b * 0.0;
                        correction.g = error.r *  0.5 + error.g; // * 1.0 + error.b * 0.0;
                        correction.b = error.r * -0.3 + error.b; // + error.g * 0.0;

                    // tritanopia / tritanomaly corrections (GdH)
                    #elif ( COLORBLIND_MODE == 3 )
                        correction.r = error.r * 0.3 + error.g * 0.5 + error.b * 0.4;
                        correction.g = error.r * 0.5 + error.g * 0.7 + error.b * 0.3;
                        correction.b = error.r * 0.0 + error.g * 0.0 + error.b * 1.0;
                    #endif

                    // Add compensation to original values
                    correction = c + correction;
                    correction.a = c.a;
                    cogl_color_out = correction.rgba;
                #endif
            }
        `;
    }

    static getChannelMix(mode) {
        return `
            uniform sampler2D tex;
            #define MIX_MODE ${mode}
            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
                #if (MIX_MODE == 1)
                    c = vec4(c.g, c.b, c.r, c.a);
                #elif (MIX_MODE == 2)
                    c = vec4(c.g, c.b, c.r, c.a);
                #elif (MIX_MODE == 3)
                    c = vec4(c.b, c.g, c.r, c.a);
                #endif
                cogl_color_out = c;
            }
        `;
    }

    static getInversion(mode) {
        return `
            uniform sampler2D tex;
            // Modes: 0 = Lightness
            //        1 = Lightness - white bias
            //        2 = Color
            #define INVERSION_MODE ${mode}
            #define BIAS float(INVERSION_MODE)

            // based on shift_whitish.glsl https://github.com/vn971/linux-color-inversion

            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
                #if (INVERSION_MODE < 2)
                    /* INVERSION_MODE ? shifted : non-shifted */
                    float white_bias = BIAS * c.a * .02;
                    float m = 1.0 + white_bias;
                    float shift = white_bias + c.a - min(c.r, min(c.g, c.b)) - max(c.r, max(c.g, c.b));
                    c = vec4(  ((shift + c.r) / m), 
                               ((shift + c.g) / m), 
                               ((shift + c.b) / m), 
                               c.a);

                #elif (INVERSION_MODE == 2)
                    c = vec4(c.a * 1 - c.r, c.a * 1 - c.g, c.a * 1 - c.b, c.a);
                #endif

                // gamma has to be compensated to maintain perceived differences in lightness on dark and light ends of the lightness scale
                float gamma = 1.8;
                c.rgb = pow(c.rgb, vec3(1.0/gamma));

                cogl_color_out = c;
            }
        `;
    }
};
