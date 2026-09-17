.PHONY: build-ApiServiceFunction

build-ApiServiceFunction:
	cp -r . $(ARTIFACTS_DIR)/
	npm install --omit=dev --prefix $(ARTIFACTS_DIR)
	npm install typescript --prefix $(ARTIFACTS_DIR)
	cd $(ARTIFACTS_DIR) && npx tsc
	find $(ARTIFACTS_DIR) -type f -name "*.ts" ! -name "*.d.ts" -delete
