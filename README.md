# Custom Hot Corners - Extended version

A GNOME Shell Extension for customizable hot corners and edges.

Features:

- Gnome 3.36, 3.38 and 40 compatibility
- Hot corners with adjustable barrier size (usable as hot edges)
- Mouse buttons and wheel can be used as triggers in addition to hot corners. Each direcion of a mouse wheel rotation is configurable separately.
- Each trigger can activate one of the many actions including command execution, workspace and window navigation, power manager actions, sound volume control, window colors inversion and more
- Preferences window provides an app chooser dialog for Run Command action configuration - easy use as an application launcher
- Each corner's area reactive to mouse clicks and scrolls can be extended both horizontaly and/or verticaly to cover most lenght of the monitor's edges. If the adjacent corner is not set to expand in related direction, the corner can be expanded to 7/8 of the monitor's width/height. If two adjacents corners are set to expand to each other's direction, than it is 1/2 of the length for each. You can see the result of expansion settings by activation of the *Make active corners/edges visible* option.
- Fallback hot corner triggers as option - useful on virtualized systems where pressure barriers are supported by the system but ignored by the pointer.
- Various options for window and workspace switchers
- The *Invert Window* action is compatible with the *True Color Invert* Gnome extension.
- The `Monitor 1` settings are always used on the primary monitor

![Extension configuration window](screenshot.png)
![Extension configuration window](screenshot1.png)
![Extension configuration window](screenshot2.png)
![Extension configuration window](screenshot3.png)

## Installation

Install the extension from the git repository with the following steps (which require the GNU Build System):

    autoreconf -i
    ./configure
    make local-install
