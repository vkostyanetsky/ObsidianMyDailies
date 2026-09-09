import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	{ ignores: ["node_modules/**", "main.js"] },
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: "./tsconfig.json",
				sourceType: "module",
			},
		},
	},
	{
		/*
		 * The build and deploy scripts run under Node, never inside Obsidian, so
		 * the rules about mobile compatibility, the vault config folder and
		 * console output are not about them.
		 */
		files: ["esbuild.config.mjs", "scripts/**/*.mjs"],
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
			"obsidianmd/hardcoded-config-path": "off",
			"obsidianmd/rule-custom-message": "off",
		},
	},
	{
		/*
		 * The one place in the plugin allowed to write to the console; see the
		 * file itself for what the output is for.
		 */
		files: ["src/log.ts"],
		rules: {
			"obsidianmd/rule-custom-message": "off",
		},
	},
]);
