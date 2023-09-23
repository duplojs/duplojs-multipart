import {defineConfig} from "rollup";
import esbuild from "rollup-plugin-esbuild";

export default defineConfig([
	{
		input: "scripts/multipart.ts",
		output: [
			{
				file: "dist/multipart.mjs",
				format: "esm"
			},
			{
				file: "dist/multipart.cjs",
				format: "cjs",
			}
		],
		plugins: [
			esbuild({
				include: /\.[jt]sx?$/,
				exclude: /node_modules/,
				tsconfig: "tsconfig.json",
			})
		]
	},
]);
