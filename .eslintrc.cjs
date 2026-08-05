module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
  ],
  ignorePatterns: ["dist", "node_modules", ".eslintrc.cjs"],
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  settings: { react: { version: "18.3" } },
  plugins: ["react-refresh"],
  rules: {
    // Esta es la regla que justifica montar el linter: el gráfico de
    // Reportes se quedaba obsoleto y el refresco de datos no se
    // reejecutaba por dependencias de efecto mal declaradas. Va como
    // error, no como aviso, para que no se vuelva a colar.
    "react-hooks/exhaustive-deps": "error",
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrors: "none" }],
    "react/prop-types": "off",
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.test.jsx"],
      env: { node: true },
      globals: { describe: "readonly", it: "readonly", expect: "readonly", vi: "readonly", beforeEach: "readonly", afterEach: "readonly" },
    },
  ],
};
