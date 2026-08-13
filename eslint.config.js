/**
 * Market Pulse — ESLint flat config for GJS / GNOME Shell extensions.
 * GPL-3.0 License
 */

export default [
    {
        ignores: ['node_modules/**', '.synbuild/**', 'schemas/**', 'docs/**']
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'module',
            globals: {
                // GJS runtime globals
                console: 'readonly',
                globalThis: 'readonly',
                imports: 'readonly',
                pkg: 'readonly',
                print: 'readonly',
                printerr: 'readonly',
                log: 'readonly',
                logError: 'readonly',
                TextDecoder: 'readonly',
                TextEncoder: 'readonly',
                Intl: 'readonly',
                Promise: 'readonly',
                Date: 'readonly',
                Math: 'readonly',
                JSON: 'readonly',
                Set: 'readonly',
                Map: 'readonly',
                Array: 'readonly',
                Object: 'readonly',
                Number: 'readonly',
                String: 'readonly',
                Boolean: 'readonly',
                Error: 'readonly',
                isNaN: 'readonly',
                parseFloat: 'readonly',
                parseInt: 'readonly',
                encodeURIComponent: 'readonly',
                RegExp: 'readonly'
            }
        },
        rules: {
            // Correctness — these are the classes of bug that reach the Shell.
            'no-undef': 'error',
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                caughtErrors: 'none'
            }],
            'no-redeclare': 'error',
            'no-dupe-keys': 'error',
            'no-dupe-class-members': 'error',
            'no-unreachable': 'error',
            'no-fallthrough': 'error',
            'no-self-assign': 'error',
            'no-constant-condition': ['error', { checkLoops: false }],
            'valid-typeof': 'error',
            'use-isnan': 'error',

            // Style consistency
            'prefer-const': 'error',
            'no-var': 'error',
            eqeqeq: ['error', 'smart'],
            semi: ['error', 'always']
        }
    }
];
