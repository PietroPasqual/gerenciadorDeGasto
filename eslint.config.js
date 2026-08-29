import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'src/lib/database.types.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Desligada de propósito: o projeto co-loca a constante ao lado do
      // componente que a usa (as abas do mês, os itens do índice de
      // configurações), e espalhar isso em arquivos de uma linha só para
      // agradar o fast refresh deixaria o código pior.
      'react-refresh/only-export-components': 'off',

      // Caractere invisível no meio do código é bug; dentro de string, regex,
      // template ou comentário costuma ser proposital e importante — o BOM que
      // o Excel exige no CSV e o NBSP que o Intl põe depois de "R$" são os dois
      // casos que existem aqui.
      'no-irregular-whitespace': [
        'error',
        { skipStrings: true, skipTemplates: true, skipComments: true, skipRegExps: true },
      ],

      // `_` na frente é a convenção de "recebi e não uso de propósito".
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],

      // Promise solta é bug de verdade num app que grava dinheiro: se ninguém
      // espera, ninguém vê o erro. `void` na frente é o jeito de dizer
      // "conscientemente sem esperar" — e o código já usa isso.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Teste pode usar `any` para montar dublê sem arrastar o tipo inteiro.
    files: ['**/*.test.{ts,tsx}', 'src/test/**'],
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
  {
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  // Por último: desliga tudo que brigaria com o Prettier.
  prettier,
)
