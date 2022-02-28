#!/bin/bash

#find ./ -name '*.ui' -exec intltool-extract --type=gettext/glade {} \;
#find ./ -regex '\(.*\.js\|.*\.h\)' -exec xgettext --keyword=_ --keyword=N_ --output=custom-hot-corners-extended.pot {} \+
find ./ -regex '.*\.js' -exec xgettext --keyword=_ --output=custom-hot-corners-extended.pot {} \+

#rm -f *.h
