#                                               -*- Autoconf -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.69])
AC_INIT([custom-hot-corners], [0.4], [janrunx@gmail.com])
AM_INIT_AUTOMAKE([foreign])

AC_SUBST([uuid], [$PACKAGE_NAME@janrunx.gmail.com])
AC_SUBST([gschemaname], [org.gnome.shell.extensions.$PACKAGE_NAME.gschema.xml])

# https://wiki.gnome.org/HowDoI/GSettings
GLIB_GSETTINGS

# Gettext support
AM_GNU_GETTEXT([external])
AM_GNU_GETTEXT_VERSION([0.19])

# Checks for programs, libraries, header files
# Checks for typedefs, structures, and compiler characteristics.
# Checks for library functions.

AC_CONFIG_FILES([Makefile metadata.json schemas/Makefile po/Makefile.in])
AC_OUTPUT
