// @ts-check
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
	{
		ignores: ['out/**', 'view/**', '.vscode-test/**', '.vscode-test-web/**'],
	},
	{
		files: ['**/*.ts', '**/*.js'],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: 'latest',
			sourceType: 'module',
		},
		plugins: {
			'@typescript-eslint': tsPlugin,
		},
		rules: {
			curly: 'warn',
			eqeqeq: 'warn',
			'no-throw-literal': 'warn',
		},
	},
];
