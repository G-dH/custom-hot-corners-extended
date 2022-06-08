'use strict'

const Config         = imports.misc.config;
var shellVersion     = parseFloat(Config.PACKAGE_VERSION);
const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const _              = imports.gettext.domain(Me.metadata['gettext-domain']).gettext;
const Utils          = Me.imports.src.prefs.utils;

const AATWS_enabled = Utils.extensionEnabled('advanced-alt-tab@G-dH.github.com') || Utils.extensionEnabled('advanced-alt-tab@G-dH.github.com-dev');
const AATWS_detected = Utils.isSupportedExtensionDetected('AATWS');
// in gsettings enabled-extension key can remain unistalled extensions
var excludedItems = [];
if (!AATWS_enabled || (AATWS_enabled && !AATWS_detected)) {
    excludedItems.push('win-switcher-popup-ws');
    excludedItems.push('win-switcher-popup-mon');
    excludedItems.push('win-switcher-popup-ws-first');
    excludedItems.push('win-switcher-popup-apps');
    excludedItems.push('win-switcher-popup-class');
    excludedItems.push('win-switcher-popup-search');
    excludedItems.push('app-switcher-popup-ws');
    excludedItems.push('app-switcher-popup-mon');
    excludedItems.push('prev-workspace-popup');
    excludedItems.push('next-workspace-popup');
}
const ArcMenu_enabled = Utils.extensionEnabled('arcmenu@arcmenu.com');
const ArcMenu_detected = Utils.isSupportedExtensionDetected('ArcMenu');
if (!ArcMenu_enabled || (ArcMenu_enabled && !ArcMenu_detected)) {
    excludedItems.push('toggle-arcmenu');
}
if (shellVersion < 42) {
    excludedItems.push('show-screenshot-ui');
}

// in extension itself I'd test real workspace configuration
// but settings.js is also used by prefs from which the GS code is unaccessible
const horizontal = shellVersion >= 40;
//      [0.root/submenu, 1.action key,      2.action name,                       3.accelerator allowed,    4.icon name                                5.action needs window
var actionList = [
        [   0, 'disabled'                   , _('-'),                                       false,  '',                                                       false],
        [null, 'core-submenu'               , _('Core Actions'),                             true,  'video-display-symbolic',                                 false],
        [   1, 'toggle-arcmenu'             , _('Open ArcMenu'),                            false,  'view-grid-symbolic',                                     false],
        [   1, 'toggle-overview'            , _('Show Activities Overview'),                false,  'view-grid-symbolic',                                     false],
        [   1, 'show-applications'          , _('Show Application Grid'),                   false,  'view-app-grid-symbolic',                                 false],
        [   1, 'run-command'                , _('Run Preset Command / Activate App ...'),   false,  'utilities-terminal-symbolic',                            false],
        [   1, 'show-desktop'               , _('Show Desktop (all monitors)'),              true,  'preferences-desktop-wallpaper-symbolic',                 false],
        [   1, 'show-desktop-mon'           , _('Show Desktop (current monitor)'),           true,  'preferences-desktop-wallpaper-symbolic',                 false],
        [   1, 'show-screenshot-ui'         , _('Activate Screenshot Tool'),                false,  'media-record-symbolic',                                  false],
        [   1, 'black-screen'               , _('Hide Screen Content (all monitors)'),       true,  'video-display-symbolic',                                 false],
        [   1, 'black-screen-mon'           , _('Hide Screen Content (current monitor)'),    true,  'video-display-symbolic',                                 false],

        //[null, 'desktop-submenu'            , _('Desktop'),                                  true,  'video-display-symbolic',                                 false],
        //[null, 'run-submenu'                , _('Run Command'),                             false,  'utilities-terminal-symbolic',                            false],

        [null, 'workspaces-submenu'         , _('Workspaces'),                               true,  'video-display-symbolic',                                 false],
        [   1, 'prev-workspace'             , _('Previous Workspace'),                      false,   horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  , false],
        [   1, 'next-workspace'             , _('Next Workspace'),                          false,   horizontal ? 'go-next-symbolic'    : 'go-down-symbolic', false],
        [   1, 'prev-workspace-popup'       , _('Previous Workspace with Window Switcher'),  true,   horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  , false],
        [   1, 'next-workspace-popup'       , _('Next Workspace with Window Switcher'),      true,   horizontal ? 'go-next-symbolic'    : 'go-down-symbolic', false],
        [   1, 'prev-workspace-current-mon' , _('Previous Workspace - Current Monitor Only'), true, horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  , false],
        [   1, 'next-workspace-current-mon' , _('Next Workspace - Current Monitor Only'),    true,   horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  , false],
        //[   1, 'prev-workspace-overview'    , _('Previous Workspace Overview'),              true,   horizontal ? 'go-previous-symbolic': 'go-up-symbolic'  , false],
        //[   1, 'next-workspace-overview'    , _('Next Workspace Overview'),                  true,   horizontal ? 'go-next-symbolic'    : 'go-down-symbolic', false],
        [   1, 'recent-workspace'           , _('Switch to Most Recent Workspace'),          true,  'document-open-recent-symbolic',                          false],
        [   1, 'move-to-workspace'          , _('Switch to Preset Workspace ...'),          false,  'go-jump-symbolic',                                       false],
        [   1, 'move-to-second-last-ws'     , _('Switch to Second Last Workspace'),          true,  'go-jump-symbolic',                                       false],
        [   1, 'reorder-ws-prev'            , _(`Reorder Workspace - ${horizontal? _('Left') : _('Up')}`),  true,  horizontal ? 'go-previous-symbolic':'go-up-symbolic', false],
        [   1, 'reorder-ws-next'            , _(`Reorder Workspace - ${horizontal? _('Right'): _('Down')}`),true,  horizontal ? 'go-next-symbolic':'go-down-symbolic',   false],
        [   1, 'rotate-ws-prev-mon'         , _(`Rotate Windows Across Workspaces ${horizontal? _('Left') : _('Up')} (monitor)`),  true,  horizontal ? 'go-previous-symbolic':'go-up-symbolic', false],
        [   1, 'rotate-ws-next-mon'         , _(`Rotate Windows Across Workspaces ${horizontal? _('Right'): _('Down')} (monitor)`),  true,  horizontal ? 'go-previous-symbolic':'go-up-symbolic', false],
        [   1, 'close-workspace'            , _('Close Current Workspace (and its windows)'),true,  'window-close-symbolic',                                  false],

        [null, 'win-navigation-submenu'     , _('Windows - Navigation'),                     true,  'focus-windows-symbolic',                                 false],
        [   1, 'recent-win'                 , _('Switch to Most Recent Window'),             true,  'document-open-recent-symbolic',                          false],
        [   1, 'prev-win-mon'               , _('Previous Window (current monitor)'),        true,  'go-previous-symbolic',                                   false],
        [   1, 'prev-win-ws'                , _('Previous Window (current WS)'),             true,  'go-previous-symbolic',                                   false],
        [   1, 'prev-win-all'               , _('Previous Window (all)'),                    true,  'go-previous-symbolic',                                   false],
        [   1, 'next-win-mon'               , _('Next Window (current monitor)'),            true,  'go-next-symbolic',                                       false],
        [   1, 'next-win-ws'                , _('Next Window (current WS)'),                 true,  'go-next-symbolic',                                       false],
        [   1, 'next-win-all'               , _('Next Window (all)'),                        true,  'go-next-symbolic',                                       false],

        [null, 'win-switcher-popup-submenu' , _('Windows/App - Switcher Popups'),            true,  'focus-windows-symbolic',                                 false],
        [   1, 'win-switcher-popup-all'     , _('Window Switcher Popup (all/default)'),      true,  'focus-windows-symbolic',                                 false],
        [   1, 'win-switcher-popup-ws'      , _('Window Switcher Popup (current ws)'),       true,  'focus-windows-symbolic',                                 false],
        [   1, 'win-switcher-popup-mon'     , _('Window Switcher Popup (current monitor)'),  true,  'focus-windows-symbolic',                                 false],
        [   1, 'win-switcher-popup-ws-first', _('Window Switcher Popup (current ws first)'), true,  'focus-windows-symbolic',                                 false],
        [   1, 'win-switcher-popup-apps'    , _('Window Switcher Popup (sorted by apps)'),   true,  'focus-windows-symbolic',                                 false],
        [   1, 'win-switcher-popup-class'   , _('Window Switcher Popup (focused app only)'), true,  'focus-windows-symbolic',                                 false],
        //[   1, 'win-switcher-popup-search', _('Window Switcher Popup (type to search)'),   true,  'focus-windows-symbolic'],
        [   1, 'app-switcher-popup-all'     , _('App Switcher Popup (all/default)'),         true,  'focus-windows-symbolic',                                 false],
        [   1, 'app-switcher-popup-ws'      , _('App Switcher Popup (current ws)'),          true,  'focus-windows-symbolic',                                 false],
        [   1, 'app-switcher-popup-mon'     , _('App Switcher Popup (current monitor)'),     true,  'focus-windows-symbolic',                                 false],
        //[   1, 'app-switcher-popup-all-fav',_('App Switcher Popup (current monitor)'),     true,  'focus-windows-symbolic'],

        [null, 'win-control-submenu'        , _('Windows - Control'),                        true,  'focus-windows-symbolic',                                 false],
        [   1, 'minimize-win'               , _('Minimize Window'),                         false,  'window-minimize-symbolic',                                true],
        [   1, 'maximize-win'               , _('Maximize Window (toggle)'),                false,  'window-maximize-symbolic',                                true],
        [   1, 'close-win'                  , _('Close Window'),                            false,  'window-close-symbolic',                                   true],
        [   1, 'fullscreen-win'             , _('Fullscreen Window (toggle)'),              false,  'view-fullscreen-symbolic',                                true],
        [   1, 'fullscreen-on-empty-ws'     , _('Fullscreen Window on New WS (toggle)'),     true,  'view-fullscreen-symbolic',                                true],
        [   1, 'above-win'                  , _('Always on Top Window (toggle)'),           false,  'go-top-symbolic',                                         true],
        [   1, 'stick-win'                  , _('Always on Visible WS Window (toggle)'),    false,  'view-pin-symbolic',                                       true],
        [   1, 'open-new-window'            , _('Open New Window (if supported)'),           true,  'media-playback-start-symbolic',                           true],
        [   1, 'quit-app'                   , _('Quit Focused Application'),                 true,  'window-close-symbolic',                                   true],
        [   1, 'kill-app'                   , _('Force Quit Focused Application'),           true,  'process-stop-symbolic',                                   true],
        [   1, 'unminimize-all-ws'          , _('Unminimize All Windows (workspace)'),       true,  'window-restore-symbolic',                                 true],

        [null, 'win-reloc-submenu'          , _('Windows - Relocations'),                    true,  'focus-windows-symbolic',                                 false],
        [   1, 'move-win-to-prev-ws'        , _('Move Window to Previous workspace'),        true,  horizontal ? 'go-previous-symbolic': 'go-up-symbolic',     true],
        [   1, 'move-win-to-prev-new-ws'    , _('Move Window to New workspace Prev'),        true,  horizontal ? 'go-previous-symbolic': 'go-up-symbolic',     true],
        [   1, 'move-win-to-next-ws'        , _('Move Window to Next workspace'),            true,  horizontal ? 'go-next-symbolic'    : 'go-down-symbolic',   true],
        [   1, 'move-win-to-next-new-ws'    , _('Move Window to New workspace Next'),        true,  horizontal ? 'go-next-symbolic'    : 'go-down-symbolic',   true],
        [   1, 'move-app-to-prev-ws'        , _('Move App windows to Prev Workspace'),       true,  horizontal ? 'go-previous-symbolic': 'go-up-symbolic',     true],
        [   1, 'move-app-to-prev-new-ws'    , _('Move App windows to New Workspace Prev'),   true,  horizontal ? 'go-previous-symbolic': 'go-up-symbolic',     true],
        [   1, 'move-app-to-next-ws'        , _('Move App windows to Next Workspace'),       true,  horizontal ? 'go-next-symbolic'    : 'go-down-symbolic',   true],
        [   1, 'move-app-to-next-new-ws'    , _('Move App windows to New Workspace Next'),   true,  horizontal ? 'go-next-symbolic'    : 'go-down-symbolic',   true],

        [null, 'win-thumbnails-submenu'     , _('DND Window Thumbnails (PIP)'),              true,  '',                                                       false],
        [   1, 'make-thumbnail-win'         , _('Create Window Thumbnail (at bottom-right)'),true,  'insert-image-symbolic',                                   true],
        [   1, 'minimize-to-thumbnail'      , _('Minimize Window to Thumbnail'),             true,  'insert-image-symbolic',                                   true],
        [   1, 'remove-win-thumbnails'      , _('Remove All Window Thumbnails'),             true,  'window-close-symbolic',                                  false],

        [null, 'win-adjust-submenu'         , _('Windows - Visual Adjustments'),             true,  'view-reveal-symbolic',                                   false],
        [   1, 'bright-up-win'              , _('Brightness Up (window)'),                   true,  'display-brightness-symbolic',                             true],
        [   1, 'bright-down-win'            , _('Brightness Down (window)'),                 true,  'display-brightness-symbolic',                             true],
        [   1, 'contrast-up-win'            , _('Contrast Up (window)'),                     true,  'view-reveal-symbolic',                                    true],
        [   1, 'contrast-down-win'          , _('Contrast Down (window)'),                   true,  'view-reveal-symbolic',                                    true],
        [   1, 'contrast-high-win'          , _('High Contrast (window)'),                   true,  'view-reveal-symbolic',                                    true],
        [   1, 'contrast-low-win'           , _('Low Contrast (window)'),                    true,  'view-reveal-symbolic',                                    true],
        [   1, 'opacity-up-win'             , _('Opacity Up (window)'),                      true,  'view-reveal-symbolic',                                    true],
        [   1, 'opacity-down-win'           , _('Opacity Down (window)'),                    true,  'view-reveal-symbolic',                                    true],
        [   1, 'opacity-toggle-win'         , _('Opacity 78% (window)'),                     true,  'view-reveal-symbolic',                                    true],
        [   1, 'opacity-toggle-hc-win'      , _('Opacity 78% for dark themes (window)'),     true,  'view-reveal-symbolic',                                    true],
        [   1, 'opacity-toggle-lc-win'      , _('Opacity 94% + bit of contrast (window)'),   true,  'view-reveal-symbolic',                                    true],

        [null, 'win-effects-submenu'        , _('Windows - Color Effects'),                  true,  'view-reveal-symbolic',                                    true],
        [   1, 'invert-light-win'           , _('Invert Lightness (window)'),                true,  'view-reveal-symbolic',                                    true],
        [   1, 'invert-light-shift-win'     , _('Invert Lightness - White to Grey (window)'),true,  'view-reveal-symbolic',                                    true],
        [   1, 'invert-colors-win'          , _('Invert Colors (window)'),                   true,  'view-reveal-symbolic',                                    true],
        [   1, 'tint-red-toggle-win'        , _('Red Tint Monochrome (window)'),             true,  'view-reveal-symbolic',                                    true],
        [   1, 'tint-green-toggle-win'      , _('Green Tint Monochrome (window)'),           true,  'view-reveal-symbolic',                                    true],
        [   1, 'tint-custom-toggle-win'     , _('Custom Tint Monochrome (window)'),          true,  'view-reveal-symbolic',                                    true],
        [   1, 'desaturate-win'             , _('Desaturate (window)'),                      true,  'view-reveal-symbolic',                                    true],
        [   1, 'remove-effects-win'         , _('Remove All Effects (window)'),              true,  'window-close-symbolic',                                   true],

        [null, 'global-effects-submenu'     , _('Global Visual Effects'),                    true,  'view-reveal-symbolic',                                   false],
        [   1, 'bright-up-all'              , _('Brightness Up (global)'),                   true,  'display-brightness-symbolic',                            false],
        [   1, 'bright-down-all'            , _('Brightness Down (global)'),                 true,  'display-brightness-symbolic',                            false],
        [   1, 'contrast-up-all'            , _('Contrast Up (global)'),                     true,  'view-reveal-symbolic',                                   false],
        [   1, 'contrast-down-all'          , _('Contrast Down (global)'),                   true,  'view-reveal-symbolic',                                   false],
        [   1, 'contrast-high-all'          , _('High Contrast (global)'),                   true,  'view-reveal-symbolic',                                   false],
        [   1, 'contrast-low-all'           , _('Low Contrast (global)'),                    true,  'view-reveal-symbolic',                                   false],
        [   1, 'invert-light-all'           , _('Invert Lightness (global)'),                true,  'view-reveal-symbolic',                                   false],
        [   1, 'invert-light-shift-all'     , _('Invert Lightness - White to Grey (global)'),true,  'view-reveal-symbolic',                                   false],
        [   1, 'tint-red-toggle-all'        , _('Red Tint (global)'),                        true,  'view-reveal-symbolic',                                   false],
        [   1, 'tint-green-toggle-all'      , _('Green Tint (global)'),                      true,  'view-reveal-symbolic',                                   false],
        [   1, 'tint-custom-toggle-all'     , _('Custom Color Tint (global)'),               true,  'view-reveal-symbolic',                                   false],
        [   1, 'desaturate-all'             , _('Desaturate (global)'),                      true,  'view-reveal-symbolic',                                   false],
        [   1, 'remove-effects-all'         , _('Remove All Effects (global)'),              true,  'window-close-symbolic',                                  false],

        [null, 'access-submenu'             , _('Universal Access'),                         true,  'preferences-desktop-accessibility-symbolic',             false],
        [   1, 'toggle-zoom'                , _('Magnifier - Zoom 2x (toggle)'),             true,  'zoom-in-symbolic',                                       false],
        [   1, 'zoom-in'                    , _('Magnifier - Zoom In'),                      true,  'zoom-in-symbolic',                                       false],
        [   1, 'zoom-out'                   , _('Magnifier - Zoom Out'),                     true,  'zoom-out-symbolic',                                      false],
        [   1, 'screen-reader'              , _('Screen Reader (toggle)'),                   true,  'audio-speakers-symbolic',                                false],
        [   1, 'large-text'                 , _('Large Text (toggle)'),                      true,  'insert-text-symbolic',                                   false],
        [   1, 'keyboard'                   , _('Screen Keyboard (toggle)'),                 true,  'input-keyboard-symbolic',                                false],
        [   1, 'invert-light-all'           , _('Invert Lightness (global)'),                true,  'view-reveal-symbolic',                                   false],
        [   1, 'protan-toggle'              , _('Color Correction - Protanopia (window)'),   true,  'view-reveal-symbolic',                                    true],
        [   1, 'deuter-toggle'              , _('Color Correction - Deuteranopia (window)'), true,  'view-reveal-symbolic',                                    true],
        [   1, 'tritan-toggle'              , _('Color Correction - Tritanopia (window)'),   true,  'view-reveal-symbolic',                                    true],
        [   1, 'protan-sim-toggle'          , _('Color Simulation - Protanopia (window)'),   true,  'view-reveal-symbolic',                                    true],
        [   1, 'deuter-sim-toggle'          , _('Color Simulation - Deuteranopia (window)'), true,  'view-reveal-symbolic',                                    true],
        [   1, 'tritan-sim-toggle'          , _('Color Simulation - Tritanopia (window)'),   true,  'view-reveal-symbolic',                                    true],
        [   1, 'mixer-gbr-toggle'           , _('Color Mixer GBR'),                          true,  'view-reveal-symbolic',                                    true],

        [null, 'gnome-submenu'              , _('GNOME'),                                    true,  'start-here-symbolic',                                    false],
        [   1, 'night-light-toggle'         , _('Toggle Night Light'),                       true,  'night-light-symbolic',                                   false],
        [   1, 'toggle-theme'               , _('Toggle Dark Gtk Theme'),                    true,  'view-reveal-symbolic',                                   false],
        [   1, 'hide-panel'                 , _('Hide/Show Main Panel'),                     true,  'focus-top-bar-symbolic',                                 false],
        [   1, 'open-panel-aggregate-menu'  , _('Open Panel Aggregate Menu'),                true,  'open-menu-symbolic',                                     false],
        [   1, 'open-panel-date-menu'       , _('Open Panel Date Menu'),                     true,  'open-menu-symbolic',                                     false],
        [   1, 'open-panel-app-menu'        , _('Open Panel App Menu'),                      true,  'open-menu-symbolic',                                     false],

        [null, 'system-submenu'             , _('System'),                                   true,  'system-run-symbolic',                                    false],
        [   1, 'lock-screen'                , _('Lock Screen'),                             false,  'changes-prevent-symbolic',                               false],
        [   1, 'screensaver'                , _('Activate ScreenSaver'),                     true,  'preferences-desktop-screensaver-symbolic',               false],
        [   1, 'suspend'                    , _('Suspend to RAM'),                           true,  'weather-clear-night-symbolic',                           false],
        [   1, 'power-off'                  , _('Power Off Dialog'),                         true,  'system-shutdown-symbolic',                               false],
        [   1, 'log-out'                    , _('Log Out Dialog'),                           true,  'system-log-out-symbolic',                                false],
        [   1, 'switch-user'                , _('Switch User (if exists)'),                  true,  'system-switch-user-symbolic',                            false],

        [null, 'media-submenu'              , _('Sound / Media'),                           true,  'audio-volume-medium-symbolic',                           false],
        [   1, 'volume-up'                  , _('Volume Up'),                               false,  'audio-volume-high-symbolic',                             false],
        [   1, 'volume-down'                , _('Volume Down'),                             false,  'audio-volume-low-symbolic',                              false],
        [   1, 'mute-sound'                 , _('Mute Audio (toggle)'),                     false,  'audio-volume-muted-symbolic',                            false],
        [   1, 'mpris-play-pause'           , _('Media Key - Play/Pause'),                  false,  'media-playback-start-symbolic',                          false],
        [   1, 'mpris-next'                 , _('Media Key - Next Track'),                  false,  'media-skip-forward-symbolic',                            false],
        [   1, 'mpris-prev'                 , _('Media Key - Previous Track'),              false,  'media-skip-backward-symbolic',                           false],
        [   1, 'mpris-play-pause-spotify'   , _('Spotify - Play/Pause'),                    false,  'media-playback-start-symbolic',                          false],
        [   1, 'mpris-next-spotify'         , _('Spotify - Next Track'),                    false,  'media-skip-forward-symbolic',                            false],
        [   1, 'mpris-prev-spotify'         , _('Spotify - Previous Track'),                false,  'media-skip-backward-symbolic',                           false],
        [   1, 'mpris-play-pause-firefox'   , _('Firefox - Play/Pause'),                    false,  'media-playback-start-symbolic',                          false],
        [   1, 'mpris-next-firefox'         , _('Firefox - Next Track'),                    false,  'media-skip-forward-symbolic',                            false],
        [   1, 'mpris-prev-firefox'         , _('Firefox - Previous Track'),                false,  'media-skip-backward-symbolic',                           false],

        [null, 'debug-submenu'              , _('Debug'),                                    true,  'edit-find-symbolic',                                     false],
        [   1, 'looking-glass'              , _('Looking Glass (GNOME Shell debugger)'),     true,  'edit-find-symbolic',                                     false],
        [   1, 'lg-inspector'               , _('GNOME Shell UI Inspector'),                 true,  'find-location-symbolic',                                 false],
        [   1, 'restart-shell'              , _('Restart GNOME Shell (X11 only)'),           true,  'view-refresh-symbolic',                                  false],
        [   1, 'run-prompt'                 , _('Show Run Command Prompt'),                 false,  'utilities-terminal-symbolic',                            false],

        [null, 'custom-menus-submenu'       , _('Custom Menus'),                             true,  'open-menu-symbolic',                                     false],
        [   1, 'show-custom-menu-1'         , _('Show Custom Menu 1'),                       true,  'open-menu-symbolic',                                     false],
        [   1, 'show-custom-menu-2'         , _('Show Custom Menu 2'),                       true,  'open-menu-symbolic',                                     false],
        [   1, 'show-custom-menu-3'         , _('Show Custom Menu 3'),                       true,  'open-menu-symbolic',                                     false],
        [   1, 'show-custom-menu-4'         , _('Show Custom Menu 4'),                       true,  'open-menu-symbolic',                                     false],

        [null, 'hardware-submenu'           , _('Hardware Control'),                         true,  'system-run-symbolic',                                    false],
        [   1, 'display-brightness-up'      , _('Display Brightness Up (HW)'),              false,  'display-brightness-symbolic',                            false],
        [   1, 'display-brightness-down'    , _('Display Brightness Down (HW)'),            false,  'display-brightness-symbolic',                            false],

        [null, 'prefs-submenu'              , _('CHC-E Preferences'),                        true,  'preferences-system-symbolic',                            false],
        [   1, 'prefs'                      , _('Open CHC-E Preferences'),                   true,  'preferences-system-symbolic',                            false],
        [   1, 'hot-corners-require-shift'  , _('Toggle Hot Corners Require Shift'),         true,  'input-mouse-symbolic',                                   false],
    ]; // end
