# Custom Hot Corners - Extended

A GNOME Shell Extension which allows you to control and navigate Gnome Shell environment through the corners and edges of your monitors. But not just that, it adds many unique actions with keyboard shortcuts too.

This extension is based on the original `Custom Hot Corners` exetension, but not much of the original code remains.

[<img alt="" height="100" src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true">](https://extensions.gnome.org/extension/4167/custom-hot-corners-extended/)


## Features:
- Gnome 3.36, 3.38, 40 and 41 compatibility
- Hot corners with adjustable barrier sizes, both vertical and horizontal independently and usable as hot edges
- Mouse buttons and a scroll wheel can be used as action triggers
- Each trigger can be set to work only when *Ctrl* key is pressed
- Each direcion of a scroll wheel rotation is configurable independently
- Each trigger can activate one of many actions including command execution, workspace and window navigation, window control, power manager actions, sound volume control, MPRIS player control, color filters (for windows and global), accessibility features and more.
- Preferences window provides an app chooser dialog for "Run preset Command" action configuration - easy use as an application launcher
- Each corner's area reactive to mouse clicks and scrolls can be extended both horizontally and/or vertically to cover most lenght of the monitor's edges. If the adjacent corner is not set to expand in related direction, the corner can be expanded to 7/8 of the monitor's width/height. If two adjacents corners are set to expand to each other's direction, then it is 1/2 of the length for each. You can see the result of expansion settings by activation of the *Make active corners/edges visible* option.
- Fallback hot corner triggers as option - can be used on virtualized systems with mouse pointer integration where pressure barriers are being ignored.
- The `Monitor 1` settings are always used on the primary monitor
- Corners can be watched for unwanted overrides from other extensions and automatically updated when needed
- You can set global keyboard shortcuts for any actions on the menu except for those available natively in GNOME Settings.
- You can set up to 4 Custom Menus with your own selection of actions and use them as an single action.

## Changelog:

**v12** (not released yet):

Added actions:

- MPRIS player controls: `Play/Pause`, `Next Track`, `Previous Track`. Works the same way as the keyboard media keys - controls the most recently launched media player
- `Open New window`
- `Move App windows to Prev/Next workspace`, `Move Window to Prev/Next workspace` - allows to move window or all windows of selected application corresponding to the current filter settings to an adjacent workspace
- `Move App windows to Prev/Next New workspace`, `Move Window to Prev/Next New workspace` - similar to the previous one, but first creates new empty workspace to which the window/s will be moved
- workspace switcher options moved to separate extension `Workspace Switcher Manager` which offers more options.
- `Display Brightness Up/Down` in new section `Hardware`.
- `GNOME Shell UI inspector` in `Debug` section - direct activation of the tool that is available in the Looking Glass and allows to inspect GNOME Shell UI elements using a mouse. Big advantage is that this action can be activated using a keayboard shortcut even when a popup menu is open and inspect menu items.
- `Open Panel Aggregate Menu`, `Open Panel Date Menu`, `Open Panel App Menu` in `GNOME` section.

Other changes:

- default value for the triggers fullscreen functinality set to `true`, default value for option `Enable all trigers in fullscreen` to `false` (and will be removed)
- redesigned `Monitor` corner settings page, added toggle button for direct control over `Enable in Fullscreen` option.
- redesigned `Keyboard` and `Custom Menus` Options pages and added butons for control over tree view
- Custom menus adds focused window title as the first item only if the menu contains actions that target the window.

Fixes:

- workspace index position not centered in GS40+
- added gschema paths for not dynamically created settings - now global settings can be backed up using `Extensions Sync` extension. Unfotunately, dynamically created settings directories storing settings of all individual triggers don't have unique schema id, so can not be backed up using mentioned extension.
- GS41 not detected
- Custom Menus - items without its own submenu were added to the previous submenu instead of to the root menu.

**v11**:
- Added action `Open ArcMenu` action, compatible with ArcMenu v.20+
- Added workspace indicator to the `Reorder workspace` actions
- Added support of Ubuntu's 21.10 light Yaru theme in action `Light/Dark Gtk theme toggle`
- Fixed broken Run Command Prompt action
- Layout optimizations in the Preferences window for Gtk 4

**v10**:
- Added actions supporting new AATWS application switcher
- Added action `Quit application`
- Fixed issue with shortcuts accessible from the lock screen

**v9**:
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

### DND Window Thumbnails

Window thumbnails are scaled-down window clones that can be used to monitor windows not currently visible on the screen. Default position for the thumbnail is bottom right corner of the current monitor. You can create as many clones as you want and place them anywhere on the screen. Each thumbnail can be independently resized, you can adjust its opacity, even change its source window. When the thumbnail's source window close, thumbnail is removed too.
The code is based on window preview of *BaBar Task Bar* extension.

    Double click          - activate source window
    Primary cLick         - toggle scroll wheel function (resize / source)
    Scroll wheel          - resize or switch source window
    Ctrl + Scroll wheel   - switch source window or resize
    Secondary click       - remove thumbnail
    Middle click          - close source window
    Shift + Scroll wheel  - change thumbnail opacity

![Extension configuration window](screenshot.png)
![Extension configuration window](screenshot1.png)
![Extension configuration window](screenshot4.png)
![Extension configuration window](screenshot5.png)

### Installation

Install the extension from the from the [GNOME extension website](https://extensions.gnome.org/extension/4167/custom-hot-corners-extended/) or from git repository with the following steps (which require the GNU Build System):

    autoreconf -i
    ./configure
    make local-install
