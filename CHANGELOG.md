## Changelog:

### v20 2022-07-11
**Fixed:**
- Hot corners works unreliably after screen unlock in Wayland session

**Other Changes:**
- Settings code refactoring


### v18,19 2022-07-03
**Added:**
- DND Window Thumbnails - Secondary mouse button toggles fullsize window preview on mouse pointer hover.

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
- `Custom Color Tint` action - you can select any color you want on the `Options` page of CHC-E's prferences window.
- Option: `Hot Corners Require Shift` to allow you to inhibit all direct Hot corner triggers at once when needed.

**Fixed:**
- Slow startup of the prferences window and lagging first switch to other corner pages - action menu combo boxes were replaced with buttons + treeview menu which means more than 10x faster startup and no lags in UI
- Missing path for relocatable corner schema not allowing corner settings backup. Now the `Extensions Sync` extension can store all CHC-E settings.
- Custom Menu - actions targetting focused window don't work, menu steals focus from window in GS 40+
- Wrong workspace index limits in `Reorder Workspace` action.
- Window is ready notification when switching windows

**Other changes:**
- TreeView submenus expand on a single-click instead of double-click
- New Make file simplifies installation from source.
- CHC-E `Open Preferences` action can close blocking preferences window of another extension
- Mouse button triggeres now react on release event instead of press event. Reasons: 1. top edge press events are sometimes blocked by unknown element in the fullscreen mode in Ubuntu 22.04, 2. prevents accidental action triggering when unmaximizing a window by dragging from the top panel, 3. button release event closes Custom Menu in GS 3.xx

### v16
**Added:**
- Action `Close Current Workspace (all its windows)` - allows you to close all windows that belong to the currently active workspace and remove it drom the list (if you use dynamic workspaces).
- Action `Switch to Second Last Workspace` - allows you to switch to the last non-empty workspace, if the workspaces are managed dynamically.
- DND Window Thumbnail can be switched to the app icon and back to the window thumbnail using Ctrl + primary click.
- Window Switcher (actions `Previous Window`, `Next Window`) now uses full-size windows previews instead of activating them directly. This change allows you to switch windows in MRU order, not just in stable sequence.
- Option `Sort by Stable Sequence` for the Window Switcher (actions `Previous Window`, `Next Window`) allows you to scroll through windows in a stable order (as they were created) instead of the default Most Recently Used order.
- Action `Rotate Windows Across Workspaces Left/Right/Up/Down` allows you to move all windows that belong to the current monitor (the one with the mouse pointer) one workspace left/right (or up/down) in wraparound cycle. This action allows to fake switch workspace on secondary moniotrs, if option `Workspaces on primary monitor only` is disabled (you can use GNOME Tweaks app).
- Action `Switch Workspace on Current Monitor Only` allows the same as the previous one, but for the primary monitor it switches workspace as usual and moves windows on other monitors across workspaces in the oposite direction to compensate for the change, so you will see the same windows on secondary monitors, like the workspace didn't change.
- On multimonitor system when you open preferences window, osd label with monitor index appears on each display

**Fixed:**
- Keyboard shortcuts do not update on-change
- Double-click on window thumbnail don't work in GS 42

**Other changes**
- Action `Switch to Most Recent Workspace` is now based on the AltTab window list instead of workspace change tracking, so you'll get the workspace with the recent user interaction.
- GSettings i/o operations were refactored
- Preferences window now supports new GNOME 42 Adwaita toolkit and also Gtk3 and Gtk4 versions of prefs windows were refactored to get visually closer to the Adwaita version.

### v15
**Fixed:**
- installation using `make local-install` throws error on non ASCII character in `prefs.js` source code.

### v14
**Fixed:**
- Option `Show active items only` on `Keyboard` pages crashes after shortchuts change.

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
- added gschema paths for not dynamically created settings - now global settings can be backed up using `Extensions Sync` extension. Unfotunately, dynamically created settings directories storing settings of all individual triggers don't have unique schema id, so can not be backed up using mentioned extension.
- GS41 not detected
- Custom Menus - items without its own submenu were added to the previous submenu instead of to the root menu.
- Sceen keyboard won't show when activated from Custom Menu

**Other changes:**
- added compatibility with GNOME Shell 42.
- default value for `Enable this trigger in fullscreen mode` option has been set to `true` and its control has been moved from the settings popup menu to the main page right beside each Action dropdown menu.
- global option `Enable all trigers in fullscreen` has been removed.
- redesigned `Monitor` corner settings page, added toggle button for direct control over `Enable in Fullscreen` option.
- redesigned `Keyboard` and `Custom Menus` Options pages and added butons for control over tree view.
- workspace switcher options have been removed, you can use my `Workspace Switcher Manager` extension to customize workspace switcher behavior globaly.
- Custom menu adds title of the focused window as the first item if the menu contains actions that target the window.
- action `Run Preset Command ...` now can activate application by app id (`.desktop` launcher file name) and was renamed to `Run Preset Command / Activate App ...`. App chooser dialog can now produce command or app id and the latter is default (preffered) option as it's native way to launch / activate application in GNOME Shell.
- some actions have been moved to submenus to reduce menu height, some useless actions heve been removed
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
- Barrier size is now adjustable in percentage of the monitor's width/heigt instead of pixels.
- Option *Make active corners/edges visible* now also shows the pressure barriers.
- Added action **Window Thumbnail (PIP)** - make a thumbnail preview (like Picture in Picture) of the active window which you can drag and drop anywhere on the screen. Thumbnail size can be adjusted by a mouse scroll wheel and you can even change the source window of the thumbnail. You can make as many thumbnails as you want, not just one.
- Added new shader filters - color blind vision simulation and correction filters in Accessibility menu. Inversion filters have been enhanced - Invert Lightness, Invert Lightness - Wite to Grey (for lower contrast at night time) and full color inversion, now all gamma corrected to make deep dark shades distinguishable.
- Added actions to trigger default Window and App Switcher Pop-ups. When you install and enable the **Advanced Alt+TAb Window Switcher** extension you'll be able to use more actions with diffrent settigs of this extended window switcher pop-up.
- Added 4 **Custom Menus** to action menu - you can populate up to 4 different menus with actions of your choice and trigger them the same way as other single actions.
- Added **Minimize to thumbnail** action - live window thumbnail of the focused window will be created and window will be minimized.
- Workspace switcher has **new** optional **workspace switcher indicator - overlay index**. Shows a big transparent index number of switched workspace on the bottom half of the screen.

**v8**:
- **Optional keyboard shortcuts for most actions** - CHC-E offers many unique actions which can be now used even without a mouse
- The *Invert Lightness* action is now available in Gnome 40
- Toggle Light/Dark GTK theme action - supports Adwaita and Ubuntu Yaru(Light) themes
- Multiple color effect actions for whole desktop and single windows including **red/green color tint, contrast, brightness, transparency and system Night Light switch**
- *Reorder workspace* action alows you to move whole workspace up/down (left/right in gnome 40) in the workspace list.