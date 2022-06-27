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

const { GObject, Clutter }     = imports.gi;
const ExtensionUtils         = imports.misc.extensionUtils;

var   InvertLightnessEffect = GObject.registerClass(
class InvertLightnessEffect extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getInversion(0);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   InvertLightnessShiftEffect = GObject.registerClass(
class InvertLightnessShiftEffect extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getInversion(1);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   ColorInversionEffect = GObject.registerClass(
class ColorInversionEffect extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getInversion(2);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   ColorMixerEffect1 = GObject.registerClass(
class ColorMixerEffect1 extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getChanellMix(1);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   ColorMixerEffect2 = GObject.registerClass(
class ColorMixerEffect2 extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getChanellMix(2);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   ColorMixerProtan = GObject.registerClass(
class ColorMixerProtan extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getDaltonism(1);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   ColorMixerDeuter = GObject.registerClass(
class ColorMixerDeuter extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getDaltonism(2);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   ColorMixerTritan = GObject.registerClass(
class ColorMixerTritan extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getDaltonism(3);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   ColorMixerProtanSimulation = GObject.registerClass(
class ColorMixerProtanSimulation extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getDaltonism(1);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   ColorMixerDeuterSimulation = GObject.registerClass(
class ColorMixerDeuterSimulation extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getDaltonism(2);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});

var   ColorMixerTritanSimulation = GObject.registerClass(
class ColorMixerTritanSimulation extends Clutter.ShaderEffect {
    vfunc_get_static_shader_source() {
        return ShaderLib.getDaltonism(3);
    }

    vfunc_paint_target(node, paint_context) {
        this.set_uniform_value('tex', 0);
        if (paint_context === undefined)
            super.vfunc_paint_target(node);
        else
            super.vfunc_paint_target(node, paint_context);
    }
});


var ShaderLib = class {
    constructor() {
        this.daltonSimulation = 0;
        this.invertWhiteBias = 1;
    }

    static getDaltonism(mode = 1) {
        return `
            uniform sampler2D tex;
            #define COLORBLIND_MODE ${mode}
            #define SIMULATE ${this.daltonSimulation}
            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
            // RGB to LMS matrix
                float L = (17.8824f * c.r) + (43.5161f * c.g) + (4.11935f * c.b);
                float M = (3.45565f * c.r) + (27.1554f * c.g) + (3.86714f * c.b);
                float S = (0.0299566f * c.r) + (0.184309f * c.g) + (1.46709f * c.b);
            // Simulate color blindness
                #if ( COLORBLIND_MODE == 1) // Protanope - reds are greatly reduced (1% men)
                    float l = 0.0f * L + 2.02344f * M + -2.52581f * S;
                    float m = 0.0f * L + 1.0f * M + 0.0f * S;
                    float s = 0.0f * L + 0.0f * M + 1.0f * S;
                #endif
                #if ( COLORBLIND_MODE == 2) // Deuteranope - greens are greatly reduced (1% men)
                    float l = 1.0f * L + 0.0f * M + 0.0f * S;
                    float m = 0.494207f * L + 0.0f * M + 1.24827f * S;
                    float s = 0.0f * L + 0.0f * M + 1.0f * S;
                #endif
                #if ( COLORBLIND_MODE == 3) // Tritanope - blues are greatly reduced (0.003% population)
                    float l = 1.0f * L + 0.0f * M + 0.0f * S;
                    float m = 0.0f * L + 1.0f * M + 0.0f * S;
                    //float s = -0.237454f * L + 1.237458f * M + 0.0f * S;
                    // GdH - This vector is calculated by me
                    float s = -0.012491378299329402f * L + 0.07203451899279534f * M + 0.0f * S;
                #endif
            // LMS to RGB matrix conversion
                vec4 error;
                error.r = (0.0809444479f * l) + (-0.130504409f * m) + (0.116721066f * s);
                error.g = (-0.0102485335f * l) + (0.0540193266f * m) + (-0.113614708f * s);
                error.b = (-0.000365296938f * l) + (-0.00412161469f * m) + (0.693511405f * s);
                error.a = 1;

            // The error is what they see
                #if (SIMULATE == 1)
                    error.a = c.a;
                    cogl_color_out = error.rgba;
                    return;
                #endif
                #if (SIMULATE == 0)
            // Isolate invisible colors to color vision deficiency (calculate error matrix)
                    error = (c - error);
            // Shift colors towards visible spectrum (apply error modifications)
                    vec4 correction;
                #if ( COLORBLIND_MODE == 1 )
                    correction.r = 0;//-error.r;
                    correction.g = (((error.r > 0 ? error.r : error.r/2) * 0.9 + (error.g > 0 ? error.g : 0))* 0.6 );
                    correction.b = (((error.r > 0 ? error.r : error.r/2) * 0.1 + (error.b > 0 ? error.b : 0))* 0.1 );
                #elif ( COLORBLIND_MODE == 2 )
                    correction.r = 0;//-error.r;
                    correction.g = (((error.r > 0 ? error.r : error.r/2) * 0.9 + (error.g > 0 ? error.g : 0))* 0.6 );
                    correction.b = (((error.r > 0 ? error.r : error.r/2) * 0.1 + (error.b > 0 ? error.b : 0))* 0.1 );
                #elif ( COLORBLIND_MODE == 3 )
                    correction.r = (((error.b > 0 ? error.b : 0) + (error.r > 0 ? error.r : 0)) * 0.3);
                    correction.g = (((error.b > 0 ? error.b : 0) + (error.g > 0 ? error.g : 0)) * 0.3);
                    correction.b = (-error.b * 0.7);
                #endif
            // Add compensation to original values
                    correction = c + correction;
                    correction.a = c.a;
                    cogl_color_out = correction.rgba;
                #endif
            }
        `;
    }

    static getChanellMix(mode) {
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

            // based on shift_whitish.glsl https://github.com/vn971/linux-color-inversion

            void main() {
                vec4 c = texture2D(tex, cogl_tex_coord_in[0].st);
                #if (INVERSION_MODE < 2)
                    /* INVERSION_MODE ? shifted : non-shifted */
                    float white_bias = INVERSION_MODE * c.a * .02;
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
