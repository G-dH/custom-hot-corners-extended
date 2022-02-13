ACLOCAL_AMFLAGS = -I m4

SUBDIRS = schemas po icons
EXTRA_DIST = settings.js \
             extension.js \
             keybindings.js \
             metadata.json \
             prefs.js \
             actions.js \
             actionTrigger.js \
             winTmb.js \
             shaders.js \
             stylesheet.css

topextensiondir = $(datadir)/gnome-shell/extensions
extensiondir = $(topextensiondir)/$(uuid)
extension_DATA = settings.js \
                 extension.js \
                 keybindings.js \
                 metadata.json \
                 prefs.js \
                 actions.js \
                 actionTrigger.js \
                 winTmb.js \
                 shaders.js \
                 stylesheet.css \
                 README.md \
                 LICENSE

localprefix = $(HOME)/.local/share/gnome-shell/extensions

local-install: zip-file
	$(MAKE) local-uninstall
	$(MKDIR_P) "$(localprefix)"
	unzip -q "$(abs_builddir)/$(uuid).zip" -d "$(localprefix)/$(uuid)"

local-uninstall:
	-rm -fr "$(localprefix)/$(uuid)"

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
