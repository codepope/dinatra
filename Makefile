SHELL=/bin/bash
TARGET_SRC=$(shell shopt -s globstar && ls ./**/*.{ts,js,tsx} | grep -v ./vendor | grep -v ./testdata)

test:
	deno run --allow-net serve_test.ts
	deno run --allow-net --allow-read static_test.ts
	deno run --allow-net helpers_test.ts

lint:
	deno fmt --check $(TARGET_SRC)

fmt:
	deno fmt $(TARGET_SRC)

.PHONY: test lint format