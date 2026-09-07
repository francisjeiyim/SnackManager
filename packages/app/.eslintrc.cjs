/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: false,
  extends: ["../../.eslintrc.cjs"],
  plugins: ["react-hooks", "react-refresh"],
  env: { browser: true },
  rules: {
    ...require("eslint-plugin-react-hooks").configs.recommended.rules,
    "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
  },
};
