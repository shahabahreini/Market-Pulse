UUID = market-pulse@shahabahreini.github.com
EXT_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all compile-schemas install uninstall zip clean

all: compile-schemas

compile-schemas:
	glib-compile-schemas schemas/

install: compile-schemas
	mkdir -p $(EXT_DIR)
	cp -r metadata.json extension.js prefs.js stylesheet.css schemas icons services components helpers prefs $(EXT_DIR)/ 2>/dev/null || true

uninstall:
	rm -rf $(EXT_DIR)

zip: compile-schemas
	rm -f $(UUID).zip
	zip -r $(UUID).zip metadata.json extension.js prefs.js stylesheet.css schemas icons services components helpers prefs README.md LICENSE

clean:
	rm -f schemas/gschemas.compiled
	rm -f $(UUID).zip
