import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			// Marken-Palette aus den Hex-Werten — semantische Klassen wie
  			//   bg-income, text-expense, border-highlight
  			// Die jeweiligen Hex-Werte stehen auch in globals.css als
  			// --brand-* zur direkten CSS-Nutzung.
  			income: {
  				DEFAULT: '#00D3FF',
  				soft:    '#DFF7FE',
  				strong:  '#00A8CC',
  			},
  			expense: {
  				DEFAULT: '#F5009B',
  				soft:    '#FDE0F1',
  				strong:  '#C8007A',
  			},
  			highlight: {
  				DEFAULT: '#FFD900',
  				soft:    '#FFF6CC',
  				strong:  '#CCAF00',
  			},
  			brand: {
  				violet: '#7C3AED',
  				yellow: '#FFD900',
  				cyan:   '#00D3FF',
  				cerise: '#F5009B',
  				shaft:  '#333333',
  				gray:   '#999898',
  			},
  			// Tints (~22-25%) — Sektions-Hintergruende, KPI-Bloecke, Card-Wash.
  			// Werte lesen aus CSS-Variablen, damit Light/Dark automatisch
  			// umschalten. Border-Stufen separat fuer praesente Kanten.
  			tint: {
  				violet: 'var(--tint-violet)',
  				yellow: 'var(--tint-yellow)',
  				cyan:   'var(--tint-cyan)',
  				cerise: 'var(--tint-cerise)',
  				gray:   'var(--tint-gray)',
  				'violet-border': 'var(--tint-violet-border)',
  				'yellow-border': 'var(--tint-yellow-border)',
  				'cyan-border':   'var(--tint-cyan-border)',
  				'cerise-border': 'var(--tint-cerise-border)',
  			},
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		fontFamily: {
  			sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
  			mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
  			display: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif']
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [],
};
export default config;
