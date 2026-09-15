/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--eco-radius)',
  			md: 'calc(var(--eco-radius) - 2px)',
  			sm: 'calc(var(--eco-radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--eco-background))',
  			foreground: 'hsl(var(--eco-foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--eco-card))',
  				foreground: 'hsl(var(--eco-card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--eco-popover))',
  				foreground: 'hsl(var(--eco-popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--eco-primary))',
  				foreground: 'hsl(var(--eco-primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--eco-secondary))',
  				foreground: 'hsl(var(--eco-secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--eco-muted))',
  				foreground: 'hsl(var(--eco-muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--eco-accent))',
  				foreground: 'hsl(var(--eco-accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--eco-destructive))',
  				foreground: 'hsl(var(--eco-destructive-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--eco-success))',
  				foreground: 'hsl(var(--eco-success-foreground))'
  			},
  			border: 'hsl(var(--eco-border))',
  			input: 'hsl(var(--eco-input))',
  			ring: 'hsl(var(--eco-ring))',
  			chart: {
  				'1': 'hsl(var(--eco-chart-1))',
  				'2': 'hsl(var(--eco-chart-2))',
  				'3': 'hsl(var(--eco-chart-3))',
  				'4': 'hsl(var(--eco-chart-4))',
  				'5': 'hsl(var(--eco-chart-5))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--eco-sidebar-background))',
  				foreground: 'hsl(var(--eco-sidebar-foreground))',
  				primary: 'hsl(var(--eco-sidebar-primary))',
  				'primary-foreground': 'hsl(var(--eco-sidebar-primary-foreground))',
  				accent: 'hsl(var(--eco-sidebar-accent))',
  				'accent-foreground': 'hsl(var(--eco-sidebar-accent-foreground))',
  				border: 'hsl(var(--eco-sidebar-border))',
  				ring: 'hsl(var(--eco-sidebar-ring))'
  			}
  		},
  		fontFamily: {
  			heading: ['var(--font-heading)'],
  			body: ['var(--font-body)'],
  			display: ['var(--font-display)'],
  			mono: ['var(--font-mono)']
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
  plugins: [require("tailwindcss-animate")],
}
