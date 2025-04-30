## Changelog:
### v48.1 (2025-04-30)
**Fixed:**
- Display redirection cannot be disabled

**Changed:**
- Updated German translation


### v48.0 (2025-03-19)
**Added:**
- GNOME 48 support
- *Display Brightness* action doesn't work


### v47.0 (2024-10-04)
**Added:**
- GNOME 47 support
- Improved fullscreen support by adding a display redirection handler
- Added audio output name to the volume controller OSD
- German translation

**Changed:**
- Redesigned *Monitor* page in the Settings window


### v46.0 (2024-03-25)
**Added:**
- GNOME 46 support

**Changed:**
- Window Thumbnail actions now require the WTMB extension


### v44.2 v45.2 (2024-01-17)
**Fixed:**
- `Move Window to Next Monitor` does not maintain the relative position of the window
- `Watch hot corners for external overrides` not updated after re-enabling the extension


### v29 (29.44, 29.45) (2023-11-06)
**Added:**
- GNOME 45 support - 2 versions of CHC-E are available, 29.44 for GNOME 3.36 - 44 and 29.45 for GNOME 45.
- `Toggle Overview - Current App Windows` action allows to open the overview only for the windows of the currently active application

**Fixed:**
- Panel menu position if panel is hidden
- `Fullscreen window on New WS` action ignores single window
- `Activate ScreenSaver` action doesn't work on GS 3.36
- Opacity adjustments doesn't work on Wayland
- Panel menus position if the panel is hidden


### v28 (2023-04-03)
**Fixed:**
Compatibility with GNOME 3.xx


### v27 (2023-03-30)
**Added:**
- GNOME 44 support
- *GNOME Shell UI Inspector* action has a 1,4 seconds delay now, that allows you to use the inspector in situations where hot corners and keyboard shortcuts don't work because you can activate the inspector action before you open the element you want inspect
- Actions to show overview / app grid now have two variants - *Toggle* - always hides the Overview if it's open and *Show*  - always switch to the respective Overview page if not active and then the second activation closes the Overview

**Changed:**
- Refactored external extension support


### v26 (2023-02-19)
**Fixed:**
- Crash after screen unlocks if panel menu enabled


### v25 (2023-02-19)
**Added:**
- Option `Show Panel Menu`.


### v24 (2023-02-17)
**Added:**
- Panel menu allows disabling and resetting all triggers and also toggling `Hot keys require Shift` option.

**Fixed:**
- Empty secondary monitors settings pages
- First tick of the scroll wheel has no effect if the mouse doesn't support smooth scrolling.
- minor improvements


### v23 (2022-11-24)
**Added:**
- `Open Panel System Menu` action - replaces `Open Panel Aggregate Menu` and now includes both Aggregate and Quick Settings menus depending on the version of GS.
- Swipe gesture actions in `Debug` section - allows developers to test three finger gestures transition animations for workspace switching and Activities state switching.
- Contrast / Brightness / Opacity adjustment actions show OSD scale.

**Fixed:**
- Unfocused window after toggling the `Show Desktop` action on/off.
- Unhandled error when stored action not in the action list.
- Spelling.
- Support of updated AATWS.
- Hot corners don't work in X11 session if VBox Machine window has focus (workaround for upstream bug).


### v21, v22 2022-09-06
**Added:**
- GNOME 43 compatibility
- Action: `Previous/Nex Window - Current App (all)`
- Action: `Unminimize All Windows`
- Action: `Move Window to Next Monitor`
- Option to reset corner settings
- Option to reset all settings to default values
- About page in Preferences window

**Other Changes:**
- Preferences code refactored


### v20 2022-07-11
**Fixed:**
- Hot corners works unreliably after screen unlock in Wayland session

**Other Changes:**
- Preferences refactored


### v18,19 2022-07-03
**Added:**
- DND Window Thumbnails - Secondary mouse button toggles full-size window preview on mouse pointer hover.

**Removed:**
- DND Window Thumbnails - Switching from window clone view to icon view using middle mouse button

**Fixed:**
- DND Window Thumbnails - resize works only in x axis after every other drag-and-drop.

**Other Changes:**
- code structure updates


### v17 2022-06-28
**Added:**
- `Hot Corner` trigger has been split into two independent triggers - `Hot Corner` and `Ctrl + Hot Corner`
- Action `Activate Screenshot Tool` for GNOME 42.
- Actions for direct control of `Spotify` and `Firefox` MPRIS media players.
- Action `Activate Screensaver` to turn off monitor.
- `Toggle Dark Gtk Theme` now supports new Ubuntu accented themes.
- CHC-E preferences window icons follow Ubuntu Yaru theme accents. If Yaru is not detected, blue accent will be used, which is close to the default Adwaita accent.
- DND Window Thumbnail: on-hover overlays - close button and icon indicating current function of the scroll wheel; secondary click shows a full size preview of the window. Still work in progress.
- `Custom Color Tint` action - you can select any color you want on the `Options` page of CHC-E's preferences window.
- Option: `Hot Corners Require Shift` to allow you to inhibit all direct Hot corner triggers at once when needed.

**Fixed:**
- Slow startup of the preferences window and lagging first switch to other corner pages - action menu combo boxes were replaced with buttons + treeview menu which means more than 10x faster startup and no lags in UI
- Missing path for relocatable corner schema not allowing corner settings backup. Now the `Extensions Sync` extension can store all CHC-E settings.
- Custom Menu - actions targeting focused window don't work, menu steals focus from window in GS 40+
- Wrong workspace index limits in `Reorder Workspace` action.
- Window is ready notification when switching windows

**Other changes:**
- TreeView submenus expand on a single-click instead of double-click
- New Make file simplifies installation from source.
- CHC-E `Open Preferences` action can close blocking preferences window of another extension
- Mouse button triggers now react on release event instead of press event. Reasons: 1. top edge press events are sometimes blocked by unknown element in the full-screen mode in Ubuntu 22.04, 2. prevents accidental action triggering when unmaximizing a window by dragging from the top panel, 3. button release event closes Custom Menu in GS 3.xx

### v16
**Added:**
- Action `Close Current Workspace (all its windows)` - allows you to close all windows that belong to the currently active workspace and remove it from the list (if you use dynamic workspaces).
- Action `Switch to Second Last Workspace` - allows you to switch to the last non-empty workspace, if the workspaces are managed dynamically.
- DND Window Thumbnail can be switched to the app icon and back to the window thumbnail using Ctrl + primary click.
- Window Switcher (actions `Previous Window`, `Next Window`) now uses full-size windows previews instead of activating them directly. This change allows you to switch windows in MRU order, not just in stable sequence.
- Option `Sort by Stable Sequence` for the Window Switcher (actions `Previous Window`, `Next Window`) allows you to scroll through windows in a stable order (as they were created) instead of the default Most Recently Used order.
- Action `Rotate Windows Across Workspaces Left/Right/Up/Down` allows you to move all windows that belong to the current monitor (the one with the mouse pointer) one workspace left/right (or up/down) in wraparound cycle. This action allows to fake switch workspace on secondary monitors, if option `Workspaces on primary monitor only` is disabled (you can use GNOME Tweaks app).
- Action `Switch Workspace on Current Monitor Only` allows the same as the previous one, but for the primary monitor it switches workspace as usual and moves windows on other monitors across workspaces in the opposite direction to compensate for the change, so you will see the same windows on secondary monitors, like the workspace didn't change.
- On multi-monitor system when you open preferences window, osd label with monitor index appears on each display

**Fixed:**
- Keyboard shortcuts do not update on-change
- Double-click on window thumbnail don't work in GS 42

**Other changes**
- Action `Switch to Most Recent Workspace` is now based on the AltTab window list instead of workspace change tracking, so you'll get the workspace with the recent user interaction.
- GSettings i/o operations were refactored
- Preferences window now supports new GNOME 42 Adwaita toolkit and also Gtk3 and Gtk4 versions of preferences windows were refactored to get visually closer to the Adwaita version.

### v15
**Fixed:**
- installation using `make local-install` throws error on non ASCII character in `prefs.js` source code.

### v14
**Fixed:**
- Option `Show active items only` on `Keyboard` pages crashes after shortcuts change.

### v13 (12 was skipped due to packaging error):

**Added actions:**
- MPRIS player controls: `Play/Pause`, `Next Track`, `Previous Track`. Works the same way as the keyboard media keys - controls the most recently launched media player
- `Open New window`
- `Move App windows to Prev/Next workspace`, `Move Window to Prev/Next workspace` - allows to move window or all windows of selected application corresponding to the current filter settings to an adjacent workspace
- `Move App windows to Prev/Next New workspace`, `Move Window to Prev/Next New workspace` - similar to the previous one, but first creates new empty workspace to which the window/s will be moved
- workspace switcher options moved to separate extension `Workspace Switcher Manager` which offers more options.
- `Display Brightness Up/Down` in new section `Hardware`.
- `GNOME Shell UI inspector` in `Debug` section - direct activation of the tool that is available in the Looking Glass and allows to inspect GNOME Shell UI elements using a mouse. Big advantage is that this action can be activated using a keyboard shortcut even when a popup menu is open and inspect menu items.
- `Open Panel Aggregate Menu`, `Open Panel Date Menu`, `Open Panel App Menu` in `GNOME` section.

**Fixes:**
- added gschema paths for not dynamically created settings - now global settings can be backed up using `Extensions Sync` extension. Unfortunately, dynamically created settings directories storing settings of all individual triggers don't have unique schema id, so can not be backed up using mentioned extension.
- GS41 not detected
- Custom Menus - items without its own submenu were added to the previous submenu instead of to the root menu.
- Screen keyboard won't show when activated from Custom Menu

**Other changes:**
- added compatibility with GNOME Shell 42.
- default value for `Enable this trigger in full-screen mode` option has been set to `true` and its control has been moved from the settings popup menu to the main page right beside each Action dropdown menu.
- global option `Enable all triggers in full-screen` has been removed.
- redesigned `Monitor` corner settings page, added toggle button for direct control over `Enable in Fullscreen` option.
- redesigned `Keyboard` and `Custom Menus` Options pages and added buttons for control over tree view.
- workspace switcher options have been removed, you can use my `Workspace Switcher Manager` extension to customize workspace switcher behavior globally.
- Custom menu adds title of the focused window as the first item if the menu contains actions that target the window.
- action `Run Preset Command ...` now can activate application by app id (`.desktop` launcher file name) and was renamed to `Run Preset Command / Activate App ...`. App chooser dialog can now produce command or app id and the latter is default (preferred) option as it's native way to launch / activate application in GNOME Shell.
- some actions have been moved to submenus to reduce menu height, some useless actions have been removed
- Action menu was reordered to make the root list shorter, removed actions `Previous/Next Workspace Overview`.

### v11:
- Added action `Open ArcMenu` action, compatible with ArcMenu v.20+
- Added workspace indicator to the `Reorder workspace` actions
- Added support of Ubuntu's 21.10 light Yaru theme in action `Light/Dark Gtk theme toggle`
- Fixed broken Run Command Prompt action
- Layout optimizations in the Preferences window for Gtk 4

### v10:
- Added actions supporting new AATWS application switcher
- Added action `Quit application`
- Fixed issue with shortcuts accessible from the lock screen

### v9:
- *Ctrl* "safety lock" finally works with Wayland
- Pressure barrier sizes are now adjustable by scale controllers on the main corner page along with clickable area expansion for better orientation in settings.
- Barrier size is now adjustable in percentage of the monitor's width/height instead of pixels.
- Option *Make active corners/edges visible* now also shows the pressure barriers.
- Added action **Window Thumbnail (PIP)** - make a thumbnail preview (like Picture in Picture) of the active window which you can drag and drop anywhere on the screen. Thumbnail size can be adjusted by a mouse scroll wheel and you can even change the source window of the thumbnail. You can make as many thumbnails as you want, not just one.
- Added new shader filters - color blind vision simulation and correction filters in Accessibility menu. Inversion filters have been enhanced - Invert Lightness, Invert Lightness - Wite to Grey (for lower contrast at night time) and full color inversion, now all gamma corrected to make deep dark shades distinguishable.
- Added actions to trigger default Window and App Switcher Pop-ups. When you install and enable the **Advanced Alt+TAb Window Switcher** extension you'll be able to use more actions with different settings of this extended window switcher pop-up.
- Added 4 **Custom Menus** to action menu - you can populate up to 4 different menus with actions of your choice and trigger them the same way as other single actions.
- Added **Minimize to thumbnail** action - live window thumbnail of the focused window will be created and window will be minimized.
- Workspace switcher has **new** optional **workspace switcher indicator - overlay index**. Shows a big transparent index number of switched workspace on the bottom half of the screen.

**v8**:
- **Optional keyboard shortcuts for most actions** - CHC-E offers many unique actions which can be now used even without a mouse
- The *Invert Lightness* action is now available in Gnome 40
- Toggle Light/Dark GTK theme action - supports Adwaita and Ubuntu Yaru(Light) themes
- Multiple color effect actions for whole desktop and single windows including **red/green color tint, contrast, brightness, transparency and system Night Light switch**
- *Reorder workspace* action allows you to move whole workspace up/down (left/right in gnome 40) in the workspace list.
