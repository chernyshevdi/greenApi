import js from '@eslint/js'
import boundaries from 'eslint-plugin-boundaries'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// FSD: слой может импортировать только слои ниже себя.
const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']
// Слои со слайсами (app и shared — без слайсов).
const sliced = layers.slice(1, -1)
const allowedDeps = Object.fromEntries(layers.map((layer, i) => [layer, layers.slice(i + 1)]))

export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: { boundaries },
    settings: {
      'import/resolver': { typescript: { project: './tsconfig.app.json' } },
      'boundaries/elements': [
        ...layers.slice(0, 1).map((type) => ({ type, pattern: `src/${type}` })),
        ...sliced.map((type) => ({
          type,
          pattern: `src/${type}/*`,
          capture: ['slice'],
        })),
        { type: 'shared', pattern: 'src/shared' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        2,
        {
          default: 'disallow',
          policies: layers.flatMap((layer) => [
            // Слой видит только слои ниже себя.
            {
              from: { element: { type: layer } },
              allow: { to: { element: { types: { anyOf: allowedDeps[layer] } } } },
            },
            // Внутри слоя: слайсы изолированы друг от друга (app и shared — один элемент).
            {
              from: { element: { type: layer } },
              allow: {
                to: {
                  element: {
                    type: layer,
                    ...(sliced.includes(layer)
                      ? { captured: { slice: '{{ from.element.captured.slice }}' } }
                      : {}),
                  },
                },
              },
            },
          ]),
        },
      ],
    },
  },
)
