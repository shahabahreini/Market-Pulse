UUID = market-pulse@shahabahreini.github.com
EXT_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SOURCES = metadata.json extension.js prefs.js stylesheet.css schemas icons services components helpers prefs

.PHONY: all compile-schemas check lint install uninstall reinstall status pack release zip lifecycle-test clean

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
	@if command -v gnome-extensions >/dev/null 2>&1; then \
		gnome-extensions uninstall $(UUID) 2>/dev/null || true; \
	fi
	rm -rf $(EXT_DIR)
	@echo "Uninstalled $(UUID)."

reinstall: uninstall install
	@if command -v gnome-extensions >/dev/null 2>&1; then \
		gnome-extensions enable $(UUID) 2>/dev/null || true; \
	fi
	@echo "Reinstalled and enabled $(UUID)."

status:
	@echo "=== Extension Status: $(UUID) ==="
	@if [ -d "$(EXT_DIR)" ]; then \
		echo "Installed: Yes ($(EXT_DIR))"; \
	else \
		echo "Installed: No"; \
	fi
	@if command -v gnome-extensions >/dev/null 2>&1; then \
		echo "\n--- gnome-extensions info ---"; \
		gnome-extensions info $(UUID) 2>/dev/null || echo "Extension not recognized by gnome-extensions CLI (may need GNOME Shell restart or login session)"; \
		echo "\n--- Shell state ---"; \
		if gnome-extensions list --enabled 2>/dev/null | grep -q "^$(UUID)$$"; then \
			echo "State: ENABLED"; \
		elif gnome-extensions list --disabled 2>/dev/null | grep -q "^$(UUID)$$"; then \
			echo "State: DISABLED"; \
		else \
			echo "State: NOT LOADED IN CURRENT SESSION"; \
		fi; \
	fi

pack: compile-schemas
	@rm -f $(UUID).shell-extension.zip
	gnome-extensions pack \
		--force \
		--extra-source=stylesheet.css \
		--extra-source=icons \
		--extra-source=services \
		--extra-source=components \
		--extra-source=helpers \
		--extra-source=prefs \
		--schema=schemas/org.gnome.shell.extensions.market-pulse.gschema.xml \
		--out-dir=. .
	@echo "Packaged extension bundle for release: $(UUID).shell-extension.zip"

release: pack

zip: compile-schemas
	rm -f $(UUID).zip
	zip -r $(UUID).zip $(SOURCES) README.md LICENSE

# 10x enable/disable must leave no leaked sources, actors or signals.
lifecycle-test:
	@echo "Running 10x enable/disable cycle — watch the journal for [market-pulse] errors."
	@for i in $$(seq 1 10); do \
		gnome-extensions disable $(UUID); sleep 1; \
		gnome-extensions enable $(UUID); sleep 2; \
		echo "  cycle $$i done"; \
	done
	@echo "Now check: journalctl --since '2 min ago' -o cat /usr/bin/gnome-shell | grep market-pulse"

clean:
	rm -rf schemas/gschemas.compiled $(UUID).zip $(UUID).shell-extension.zip .synbuild
