import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react-hooks/set-state-in-effect": "off",
    "react-hooks/preserve-manual-memoization": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // ─── Secret-leak prevention (Risk 4: build-time secret exposure) ──────────
    // Bans logging or serializing process.env — which contains STRIPE_SECRET_KEY,
    // JWT_SECRET, DATABASE_URL, MISTRAL_API_KEY, etc. At Vercel BUILD time these
    // are all present in the build env; a console.log(process.env) or
    // JSON.stringify(process.env) leaks every secret into build logs (visible to
    // anyone with dashboard access) or into runtime response bodies.
    //
    // The rule is a hard ERROR so CI lint fails on any violation. Two selectors:
    //   (1) console.*(…process.env…) — descendant match, catches ANY process.env
    //       access inside a console call (whole-env OR named var). Refactor to a
    //       local const if you need to log a non-secret value.
    //   (2) JSON.stringify(process.env) — direct-argument match ONLY, so it does
    //       NOT flag legitimate patterns like JSON.stringify({ client_id:
    //       process.env.GITHUB_CLIENT_ID }) (OAuth token-exchange bodies).
    "no-restricted-syntax": ["error",
      {
        // Catches console.log(process.env), console.log(process.env.STRIPE_SECRET_KEY),
        // console.log(JSON.stringify(process.env)) — the primary build-log leak vector.
        // The descendant match means ANY process.env access inside a console.* call
        // is flagged. Named access like process.env.NODE_ENV is intentionally also
        // caught (logging env values is an antipattern; refactor to a local const).
        selector: "CallExpression[callee.object.name='console'] MemberExpression[object.name='process'][property.name='env']",
        message: "Do not log process.env — it contains STRIPE_SECRET_KEY, JWT_SECRET, DATABASE_URL etc. and will leak to build/runtime logs. Access only the specific named env var you need (e.g. process.env.NODE_ENV)."
      },
      {
        // Catches ONLY JSON.stringify(process.env) — serializing the ENTIRE env
        // object. The arguments[0] direct-match means we do NOT flag legitimate
        // patterns like JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID })
        // (GitHub OAuth token-exchange body — needs client_id + client_secret).
        selector: "CallExpression[callee.object.name='JSON'][callee.property.name='stringify'][arguments.0.object.name='process'][arguments.0.property.name='env']",
        message: "Do not JSON.stringify(process.env) — serializes ALL env vars (including secrets) into one string. Serialize a specific object with named vars instead (e.g. JSON.stringify({ id: process.env.GITHUB_CLIENT_ID }))."
      }
    ],

    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", "*.js", "serve-download.ts", "serve.ts", "hf-deploy/**", "upload/**", "generate-report/**", "scripts/**", "*.py", "*.sh"]
}];

export default eslintConfig;
