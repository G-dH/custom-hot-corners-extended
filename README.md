# Custom Hot Corners - Extended version

A GNOME Shell Extension for customizable hot corners and edges.

Features:

- Hot corners with adjustable barrier size (and so usable as hot edges)
- Mouse buttons and wheel rotation can be used as triggers in addition to hot corners. Each direcion of a mouse wheel is configurable separately.
- Each trigger can activate one of many actions including commands execution, workspace and window navigation,  power manager actions, sound volume control, window colors inversion and more
- Preferences window provides app chooser dialog for Run Command action configuration - easy use as application launcher
- Each corner's area reactive to mouse clicks/scrolls can be extended both horizontaly and/or verticaly to cover most of the monitor's edges. If neighbour corner doesn't expand in related direction, the corner can be expanded to 7/8 of the monitor's width/height. If two corners expand to each other's direction, than it's 1/2 for each. You can see the result by activation of the *Make active corners/edges visible* option.
- Various options for windows and workspaces switchers

![Extension configuration window](screenshot.png)
![Extension configuration window](screenshot1.png)
![Extension configuration window](screenshot2.png)

## Installation

Install the extension from the git repository with the following steps (which
require the GNU Build System):

    autoreconf -i
    ./configure
    make local-install
