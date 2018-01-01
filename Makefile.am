ACLOCAL_AMFLAGS = -I m4

SUBDIRS = schemas po
EXTRA_DIST = convenience.js extension.js metadata.json prefs.js

topextensiondir = $(datadir)/gnome-shell/extensions
extensiondir = $(topextensiondir)/$(uuid)
extension_DATA = convenience.js extension.js metadata.json prefs.js

localprefix = $(HOME)/.local/share/gnome-shell/extensions

local-install: zip-file
	-rm -fr "$(localprefix)/$(uuid)"
	unzip -q "$(abs_builddir)/$(uuid).zip" -d "$(localprefix)/$(uuid)"

tmpinst = $(abs_builddir)/_tmpinst

zip-file: all
	cd po && $(MAKE) update-gmo
	$(MKDIR_P) "$(tmpinst)"
	$(MAKE) install DESTDIR="$(tmpinst)"
	glib-compile-schemas "$(tmpinst)$(gsettingsschemadir)"
	mv "$(tmpinst)$(gsettingsschemadir)" "$(tmpinst)$(extensiondir)/"
	mv "$(tmpinst)$(localedir)" "$(tmpinst)$(extensiondir)/"
	cd "$(tmpinst)$(topextensiondir)/$(uuid)" && \
	zip -qr "$(abs_builddir)/$(uuid).zip" .
	-rm -fr "$(tmpinst)"
