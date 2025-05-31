import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';


export default eslint .config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn', // You can set this to 'error' if you prefer errors
        {
          argsIgnorePattern: '^_', // Ignore unused function arguments starting with '_'
          varsIgnorePattern: '^_', // Ignore unused variables starting with '_'
          caughtErrorsIgnorePattern: '^_', // Ignore unused catch arguments starting with '_'
          destructuredArrayIgnorePattern: '^_', // Ignore unused destructured array elements starting with '_'
          ignoreRestSiblings: true, // Useful for object destructuring where you only need some properties
        },  
      ],
    },
  }
);
