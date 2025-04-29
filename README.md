# Custom Hot Corners - Extended

A GNOME Shell Extension which allows you to control and navigate Gnome Shell environment through the corners and edges of your monitors. But not just that. It also adds many unique actions with custom keyboard shortcuts, so even if you don't like hot corners, this extension may improve your workflow.

This extension is based on the original `Custom Hot Corners` extension, but not much of the original code remains.

[<img alt="" height="100" src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true">](https://extensions.gnome.org/extension/4167/custom-hot-corners-extended/)


## Features:
- Gnome 3.36 - 48 compatibility
- Hot corners with adjustable barrier sizes, both vertical and horizontal independently and usable as hot edges
- Mouse buttons and a scroll wheel can be used as action triggers
- Each trigger can be set to work only if *Ctrl* key is pressed
- Each direction of a scroll wheel rotation is configurable independently
- Each trigger can activate one of many actions including command execution, workspace and window navigation, window control, power manager actions, sound volume control, MPRIS player control, color filters (for windows and global), accessibility features and more.
- Preferences window provides an app chooser dialog for *Run Preset Command/Activate App ...* action configuration. You can choose and modify exec command of chosen application, or app ID which will work the same as when you click an app icon in the Dash or App Grid.
- Each corner's area reactive to mouse clicks and scrolls can be extended both horizontally and/or vertically to cover most length of the monitor's edges. If the adjacent corner is not set to expand in related direction, the corner can be expanded to 7/8 of the monitor's width/height. If two adjacent corners are set to expand to each other's direction, then it is 1/2 of the length for each. You can see the result of expansion settings using the *Make active corners/edges visible* option.
- Fallback hot corner triggers as option - can be used on virtualized systems with mouse pointer integration where pressure barriers do not work.
- Multi-monitor support. If you open preferences window, each monitor shows its index in the top left corner.
- `Monitor 1` settings are always applied on the primary monitor, the rest keep the order as set by GNOME.
- You can set global keyboard shortcuts for any actions on the menu, except for those available natively in GNOME Settings.
- You can create up to 4 Custom Menus with your own selection of actions and use them as a single action.


## Video references:

[![CHC-E on Linux Tex channel](readme-src/CHC-E-Linux-Tex.png)](https://www.youtube.com/watch?v=ayvE_qw0YLk&t=613s)

[![CHC-E on The Linux Experiment channel](readme-src/CHC-E-The-Linux-Experiment.png)](https://www.youtube.com/watch?v=KtjYPMCvQ7Y&t=519s)


## Changelog

[CHANGELOG.md](CHANGELOG.md)

## DND Window Thumbnails

Window thumbnails are scaled-down window clones that can be used to monitor windows not currently visible on the screen. Default position for the thumbnail is bottom right corner of the current monitor. You can create as many clones as you want and place them anywhere on the screen. Each thumbnail can be independently resized, you can adjust its opacity, even change its source window. When the thumbnail's source window close, thumbnail is removed too.

| Control | Action |
| ------- | ------ |
| Double click          | activate source window |
| Primary cLick         | toggle scroll wheel function (resize / source) |
| Scroll wheel          | resize or switch source window |
| Ctrl + Scroll wheel   | switch source window or resize |
| Secondary click       | show full-size window preview and toggle sowing preview on mouse hover |
| Shift + Scroll wheel  | change thumbnail opacity |


![Extension configuration window](screenshot.png)


## Installation

You can install this extension in several ways.

### Installation from extensions.gnome.org

The easiest way to install Custom Hot Corners - Extended: go to [extensions.gnome.org](https://extensions.gnome.org/extension/4167/custom-hot-corners-extended/) and toggle the switch. This installation also gives you automatic updates in the future.

### Installation from the latest Github release

Download the latest release archive using following command:

    wget https://github.com/G-dH/custom-hot-corners-extended/releases/latest/download/custom-hot-corners-extended@G-dH.github.com.zip

Install the extension (`--force` switch needs to be used only if some version of the extension is already installed):

    gnome-extensions install --force custom-hot-corners-extended@G-dH.github.com.zip

### Installation from source

If you want to test the latest version from the Github repository (which is usually working well enough as it's the code I'm currently using on my own system), you can use following guide.

Make sure you have installed packages providing following commands: `glib-compile-resources`, `glib-compile-schemas`, `git`

##### GNOME 45+

    git clone https://github.com/G-dH/custom-hot-corners-extended.git
    cd custom-hot-corners-extended
    make install

##### GMONE 3.36 - 44

    git clone https://github.com/G-dH/custom-hot-corners-extended.git
    cd custom-hot-corners-extended
    git checkout gnome-3.36-44
    make install

### Installation from AUR on Arch based distributions

*Custom Hot Corners - Extended* has also AUR repository maintainer (but I know nothing more about it):
[https://aur.archlinux.org/packages/gnome-shell-extension-custom-hot-corners-extended](https://aur.archlinux.org/packages/gnome-shell-extension-custom-hot-corners-extended)

## Enable installed extension

After installation you need to enable the extension. Only direct installation from extension.gnome.org loads the code and enables the extension immediately.

- First restart GNOME Shell (`ALt` + `F2`, `r`, `Enter`, or log out/log in if you use Wayland)
- Now you should see the new extension in *Extensions* (or *GNOME Tweak Tool* on older systems) application (reopen the app if needed to load new data), where you can enable it and access its Preferences/Settings.
- You can also enable the extension from the command line:

    gnome-extensions enable custom-hot-corners-extended@G-dH.github.com


## Contribution

Contributions are welcome and I will try my best to answer quickly to all suggestions.

### Translations

You can contribute with translation to your language, source `.pot` file can be generated using

    make pot

command within the cloned git repository, then you can use `Poedit` application for translation and export to `.po` file.

### Buy me a coffee

If you like my work and want to keep me motivated, you can also buy me a coffee:
[buymeacoffee.com/georgdh](https://buymeacoffee.com/georgdh)

## Credits

During development of this extension I was inspired by many extensions and other developers, I'll try to name the main contributors to my code:
- [Simon Shneegans](https://schneegans.github.io/) - amazing developer with skill and style who provided me new Make files for my extensions and a lot of inspiration.
- [True Color Invert](https://github.com/jackkenney/gnome-true-color-invert) - useful extension with confusing name, which brought me to shader effects and whose modified code I use for 'Invert Lightness' action and other color filters.
- [GS Connect](https://github.com/GSConnect/gnome-shell-extension-gsconnect/wiki) - CHC-E relies on the keybinding module copied from this great extension.
- And, of course, the original 'Custom Hot Corners' extension, which I forked and upon which this extension was built.

