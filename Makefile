UUID = market-pulse@shahabahreini.github.com
EXT_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SOURCES = metadata.json extension.js prefs.js stylesheet.css schemas icons services components helpers prefs

.PHONY: all compile-schemas check lint install uninstall zip lifecycle-test clean

all: check

compile-schemas:
	glib-compile-schemas --strict schemas/

# Parse every module without executing it — catches syntax errors that would
# otherwise only surface as a Shell stack trace at enable() time.
check: compile-schemas
	@rm -rf .synbuild && mkdir -p .synbuild
	@rc=0; for f in $$(find . -name '*.js' -not -path './.git/*' -not -path './.synbuild/*' -not -path './node_modules/*'); do \
		cp "$$f" .synbuild/module.mjs; \
		node --check .synbuild/module.mjs 2>&1 | sed "s|^|$$f: |" || rc=1; \
	done; rm -rf .synbuild; exit $$rc
	@echo "Syntax and schema check passed."

lint:
	npx eslint .

install: compile-schemas
	mkdir -p $(EXT_DIR)
	cp -r $(SOURCES) $(EXT_DIR)/

uninstall:
	rm -rf $(EXT_DIR)

zip: compile-schemas
	rm -f $(UUID).zip
	zip -r $(UUID).zip $(SOURCES) README.md LICENSE

# Plan §A2: 10x enable/disable must leave no leaked sources, actors or signals.
lifecycle-test:
	@echo "Running 10x enable/disable cycle — watch the journal for [market-pulse] errors."
	@for i in $$(seq 1 10); do \
		gnome-extensions disable $(UUID); sleep 1; \
		gnome-extensions enable $(UUID); sleep 2; \
		echo "  cycle $$i done"; \
	done
	@echo "Now check: journalctl --since '2 min ago' -o cat /usr/bin/gnome-shell | grep market-pulse"

clean:
	rm -rf schemas/gschemas.compiled $(UUID).zip .synbuild
