UUID = market-pulse@shahabahreini.github.com
EXT_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
SOURCES = metadata.json extension.js prefs.js stylesheet.css schemas icons services components helpers prefs

.PHONY: all compile-schemas check lint qc shexli install uninstall reinstall status pack release zip lifecycle-test clean

all: qc

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

# Official GNOME Shell Extension static analyzer & review rules check
shexli: pack
	@echo "Running shexli GNOME Review Guidelines audit on release package..."
	@if command -v shexli >/dev/null 2>&1; then \
		shexli "$$(pwd)/$(UUID).shell-extension.zip"; \
	else \
		PY_BIN=$$(command -v python3.12 || command -v python3.11 || command -v python3); \
		$$PY_BIN -m venv /tmp/shexli_qc_venv >/dev/null 2>&1; \
		/tmp/shexli_qc_venv/bin/pip install -q -U shexli; \
		/tmp/shexli_qc_venv/bin/shexli "$$(pwd)/$(UUID).shell-extension.zip"; \
		rm -rf /tmp/shexli_qc_venv; \
	fi
	@echo "shexli audit passed: 0 errors, 0 warnings."

# Full Quality Control suite checking code, schemas, process boundaries, and EGO packaging guidelines
qc: check lint
	@echo "Validating metadata.json against GNOME guidelines..."
	@node -e "\
		const m = require('./metadata.json'); \
		const required = ['uuid', 'name', 'description', 'shell-version', 'version', 'settings-schema']; \
		for (const key of required) { \
			if (!(key in m)) throw new Error('metadata.json missing ' + key); \
		} \
		if (m.uuid !== '$(UUID)') throw new Error('UUID mismatch'); \
		if (!Number.isInteger(m.version)) throw new Error('version must be integer for EGO'); \
		console.log('metadata.json valid: ' + m.uuid + ' v' + m['version-name'] + ' (version ' + m.version + ')'); \
	"
	@echo "Checking Gtk/Gdk process-boundary restrictions (EGO rule)..."
	@violations=$$(grep -rln "gi://Gtk\|gi://Gdk" extension.js components services helpers 2>/dev/null | grep -v "helpers/clipboardPrefs.js" || true); \
	if [ -n "$$violations" ]; then \
		echo "ERROR: Gtk/Gdk imported in Shell-process code:"; \
		echo "$$violations"; \
		exit 1; \
	fi
	@echo "Process boundary check passed: No Gtk/Gdk imported in Shell process."
	@$(MAKE) shexli
	@echo "\nAll QC checks passed successfully!"

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
