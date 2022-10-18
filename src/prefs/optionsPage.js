/**
 * Custom Hot Corners - Extended
 * OptionsPage
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
const Settings        = Me.imports.src.common.settings;

const optionsFactory = Me.imports.src.prefs.optionsFactory;

var shellVersion = parseFloat(imports.misc.config.PACKAGE_VERSION);

// gettext
const _  = Settings._;

//const OptionList = Me.imports.src.prefs.optionList;


if (Adw) {
    var MscOptionsPageAdw = GObject.registerClass(
    class MscOptionsPageAdw extends optionsFactory.OptionsPageAdw {
        _init(mscOptions, pageProperties = {}) {
            const optionList = getOptionList(mscOptions);
            super._init(optionList, pageProperties);
        }
    });
}

var MscOptionsPageLegacy = GObject.registerClass(
class MscOptionsPageLegacy extends optionsFactory.OptionsPageLegacy {
    _init(mscOptions, pageProperties = {}) {
        const optionList = getOptionList(mscOptions);
        super._init(optionList, pageProperties);
    }
});

function getOptionList(mscOptions) {
    const itemFactory = new optionsFactory.ItemFactory(mscOptions);

    let optionsList = [];
        // options item format:
        // [text, caption, widget, settings-variable, options for combo]

        optionsList.push(
            itemFactory.getRowWidget(
                _('Global options'),
                null, null, null
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Watch hot corners for external overrides'),
                _('Update corners when something (usually other extensions) change them'),
                itemFactory.newSwitch(), 'watchCorners'
            )
        );

        let actionDelayAdjustment = new Gtk.Adjustment({
            upper: 1000,
            step_increment: 10,
            page_increment: 10,
        });

        optionsList.push(
            itemFactory.getRowWidget(
                _('Minimum delay between actions (ms)'),
                _('Prevents accidental double-action. Ignored by volume control'),
                itemFactory.newSpinButton(actionDelayAdjustment),
                'actionEventDelay'
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Show ripple animations'),
                _('When you trigger an action, ripples are animated from the corresponding corner'),
                itemFactory.newSwitch(),
                'rippleAnimation'
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Direct hot corner triggers require Shift'),
                _('All hot corner triggers that are directly accessible (without Ctrl) require the Shift key pressed to be activated. This option is primarily meant as a temporary solution accessible also as an action using a keyboard shortcut or mouse trigger to avoid accidental activation of hot corners in specific situations such as playing full-screen games.'),
                itemFactory.newSwitch(), 'hotCornersRequireShift'
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Mouse buttons trigger on press event'),
                _('Trigger an action when you press the mouse button instead of when you release it.\nTriggering on release event is default because minimizes accidental triggering when dragging objects form areas close to the edge of the monitor (like unmaximize by dragging from the top panel or using scroll bars). Minor disadvantage is longer reaction time which is given by the delay between pressing and releasing the button.'),
                itemFactory.newSwitch(), 'buttonsTriggerOnPress'
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Use fallback hot corner triggers'),
                _("If pressure barriers don't work, this option allows trigger the hot corner action by hovering the corner"),
                itemFactory.newSwitch(),
                'barrierFallback'
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Make active corners / edges visible'),
                _('Shows which corners are active and their size/expansion settings. Pressure barriers are green, clickable areas are orange'),
                itemFactory.newSwitch(),
                'cornersVisible'
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Window switcher'),
                null,
                null
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Wraparound'),
                _('Whether the switcher should continue from the last window to the first and vice versa'),
                itemFactory.newSwitch(),
                'winSwitchWrap'
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Stable sequence'),
                _("By default windows are sorted by the MRU (Most Recently Used) AltTab list, which is given by time stamps that are updated each time the window is activated by the user. The stable sequence is given by the unique ID that each window gets when it's created."),
                itemFactory.newSwitch(),
                'winStableSequence'
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Skip minimized'),
                _('Exclude minimized windows from the switcher list'),
                itemFactory.newSwitch(),
                'winSkipMinimized'
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('DND Window Thumbnails'),
                `${_('Window thumbnails are overlay clones of windows, can be dragged by mouse anywhere on the screen')}\n${
                    _('Thumbnail control:')}\n    ${
                    _('Double click:    \t\tactivate source window')}\n    ${
                    _('Primary click:   \t\ttoggle scroll wheel function (resize / source)')}\n    ${
                    _('Secondary click: \t\tshow full size window preview')}\n    ${
                    _('Middle click:    \t\ttoggle icon view')}\n    ${
                    _('Scroll wheel:    \t\tresize or change source window')}\n    ${
                    _('Ctrl + Scroll wheel: \tchange source window or resize')}\n    ${
                    _('Shift + Scroll wheel: \tadjust opacity')}\n    `
                ,
                null
            )
        );

        let tmbScaleAdjustment = new Gtk.Adjustment({
            lower: 5,
            upper: 50,
            step_increment: 1,
            page_increment: 10,
        });

        optionsList.push(
            itemFactory.getRowWidget(
                _('Thumbnail height scale (%)'),
                _('Height of the thumbnail relative to screen height'),
                itemFactory.newSpinButton(tmbScaleAdjustment),
                'winThumbnailScale'
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Custom Colors for Effects'),
                null,
                null
            )
        );

        optionsList.push(
            itemFactory.getRowWidget(
                _('Tint Color'),
                _("Color for 'Custom Color Tint' action. Lighter color means weaker filter."),
                itemFactory.newColorButton(),
                'customTintColor'
            )
        );

        return optionsList;
}
