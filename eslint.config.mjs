import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = [
	{
		ignores: [".next/**", "node_modules/**", ".history/**"],
	},
	...nextVitals,
	...nextTs,
	{
		rules: {
			"react-hooks/set-state-in-effect": "warn",
			"react-hooks/purity": "warn",
			"react/no-unescaped-entities": "warn",
		},
	},
	{
		files: ["components/ui/use-toast.ts"],
		rules: {
			"@typescript-eslint/no-unused-vars": "off",
		},
	},
]

export default eslintConfig
