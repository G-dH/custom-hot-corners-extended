/**
 * Custom Hot Corners - Extended
 * AboutPage
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2022
 * @license    GPL-3.0
 */

'use strict';
const { Gtk, GObject } = imports.gi;

let Adw = null;
try { Adw = imports.gi.Adw; } catch (e) {}

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Me.imports.src.common.settings;

const optionsFactory = Me.imports.src.prefs.optionsFactory;

// gettext
const _  = Settings._;

var shellVersion = parseFloat(imports.misc.config.PACKAGE_VERSION);


if (Adw) {
var AboutPageAdw = GObject.registerClass(
    class AboutPageAdw extends optionsFactory.OptionsPageAdw {
        _init(mscOptions, pageProperties = {}) {
            const optionList = getOptionList(mscOptions);
            super._init(optionList, pageProperties);
        }
    });
}

var AboutPageLegacy = GObject.registerClass(
class AboutPageLegacy extends optionsFactory.OptionsPageLegacy {
    _init(mscOptions, pageProperties = {}) {
        const optionList = getOptionList(mscOptions);
        super._init(optionList, pageProperties);
    }
});

function getOptionList(mscOptions) {
    const itemFactory = new optionsFactory.ItemFactory(mscOptions);
    const optionList = [];

    optionList.push(itemFactory.getRowWidget(
        Me.metadata.name
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Version'),
        null,
        itemFactory.newLabel(Me.metadata.version.toString()),
    ));

    /*optionList.push(itemFactory.getRowWidget(
        _('Reset all options'),
        _('Set all options to default values.'),
        itemFactory.newOptionsResetButton(),
    ));*/


    optionList.push(itemFactory.getRowWidget(
        _('Links')
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Homepage'),
        _('Source code and more info about this extension'),
        itemFactory.newLinkButton('https://github.com/G-dH/custom-hot-corners-extended'),
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Gome Extensions'),
        _('Rate and comment the extension on GNOME Extensions site.'),
        itemFactory.newLinkButton('https://extensions.gnome.org/extension/4467'),
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Report a bug or suggest new feature'),
        null,
        itemFactory.newLinkButton('https://github.com/G-dH/custom-hot-corners-extended'),
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Buy Me a Coffee'),
        _('If you like this extension, you can help me with my coffee expenses.'),
        itemFactory.newLinkButton('https://buymeacoffee.com/georgdh'),
    ));

    return optionList;
}
