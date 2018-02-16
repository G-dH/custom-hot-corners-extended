# Custom Hot Corners

A GNOME Shell Extension for customizable hot corners.

![Extension configuration window](screenshot.png)

## Installation

Download the zip archive from the [release page](https://github.com/janxyz/custom-hot-corners/releases) and extract the files directly into the directory `~/.local/share/gnome-shell/extensions/custom-hot-corners@janrunx.gmail.com`. After that you have to restart GNOME Shell (`ALT+F2 r Enter`) and enable the extension with `gnome-shell-extension-prefs` or `gnome-tweak-tool`.

Alternatively you can install the extension from the git repository with the following steps (which require the GNU Build System):

    autoreconf -vi
    ./configure
    make local-install
