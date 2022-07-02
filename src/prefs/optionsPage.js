/**
 * Custom Hot Corners - Extended
 * OptionsPage
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2022
 * @license    GPL-3.0
 */

'use strict';

const { Gtk, Gio, GObject } = imports.gi;
const Me = imports.misc.extensionUtils.getCurrentExtension();

const Config = imports.misc.config;
var shellVersion = parseFloat(Config.PACKAGE_VERSION);

const OptionList = Me.imports.src.prefs.optionList;

// conversion of Gtk3 / Gtk4 widgets add methods
const append = shellVersion < 40 ? 'add' : 'append';
const set_child = shellVersion < 40 ? 'add' : 'set_child';

var OptionsPage;

let Adw = null;
try { Adw = imports.gi.Adw; } catch (e) {}

const OptionsPageLegacy = GObject.registerClass(
class OptionsPageLegacy extends Gtk.ScrolledWindow {
    _init(mscOptions, widgetProperties = {
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
    }) {
        super._init(widgetProperties);
        this._optionList = OptionList.getOptionList(mscOptions);

        this._alreadyBuilt = false;
    }

    buildPage() {
        if (this._alreadyBuilt)
            return false;
        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5,
            homogeneous: false,
            margin_start: 16,
            margin_end: 16,
            margin_top: 16,
            margin_bottom: 16
        });

        const context = this.get_style_context();
        context.add_class('background');

        let optionsList = this._optionList;

        let frame;
        let frameBox;
        for (let item of optionsList) {
            const option = item[0];
            const widget = item[1];
            if (!widget) {
                let lbl = new Gtk.Label({
                    label: option, // option is a plain text if item is section title
                    xalign: 0,
                    margin_top: 4,
                    margin_bottom: 2
                });
                const context = lbl.get_style_context();
                context.add_class('heading');

                mainBox[append](lbl);

                frame = new Gtk.Frame({
                    margin_bottom: 10,
                });
                frameBox = new Gtk.ListBox({
                    selection_mode: null,
                });
                mainBox[append](frame);
                frame[set_child](frameBox);
                continue;
            }
            let box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                margin_start: 4,
                margin_end: 4,
                margin_top: 4,
                margin_bottom: 4,
                hexpand: true,
                spacing: 20,
            });

            box[append](option);
            if (widget)
                box[append](widget);

            frameBox[append](box);
        }
        this[set_child](mainBox);
        this.show_all && this.show_all();
        this._alreadyBuilt = true;
    }
});

if (Adw) {
    OptionsPage = Me.imports.src.prefs.optionsPageAdw.OptionsPageAdw;
} else {
    OptionsPage = OptionsPageLegacy;
}