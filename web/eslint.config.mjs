import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    files: ['**/*.ts', '**/*.tsx'],
    // O plugin já vem registrado por eslint-config-next/typescript.
    rules: {
      /*
       * Todo atributo e todo método de classe declara public ou private.
       *
       * O objetivo é que a superfície pública de cada classe seja uma
       * decisão escrita, não o que sobrou por omissão: em TypeScript o
       * padrão é público, então esquecer o modificador é publicar. Vale
       * também para as propriedades declaradas no construtor, que são onde
       * as dependências injetadas entram.
       */
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'explicit',
          overrides: { parameterProperties: 'explicit' }
        }
      ],
      /* Tipagem explícita onde o retorno atravessa a fronteira de um módulo. */
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      /* Prefixo com sublinhado é a forma de dizer "recebido e ignorado". */
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ]
    }
  }
])

export default eslintConfig
