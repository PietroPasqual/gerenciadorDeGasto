/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1400px' } },
    extend: {
      colors: {
        // Todas as cores vem de CSS variables (src/styles/themes.css).
        // Trocar de tema = trocar as variaveis no :root, sem classes duplicadas.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          soft: 'hsl(var(--primary-soft))',
          // primary escurecido o suficiente para passar AA como texto sobre o
          // fundo — e, com o foreground ao lado, como preenchimento EMBAIXO de
          // texto. Ver a explicacao em src/styles/themes.css.
          strong: 'hsl(var(--primary-strong))',
          'strong-foreground': 'hsl(var(--primary-strong-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      boxShadow: {
        // Escala de elevacao unica do app; sombra tingida com o primary.
        1: 'var(--sombra-1)',
        2: 'var(--sombra-2)',
      },
      spacing: {
        linha: 'var(--altura-linha)',
        // Densidade (D3) — ver src/styles/themes.css.
        'linha-y': 'var(--linha-y)',
        card: 'var(--card-padding)',
      },
      height: {
        campo: 'var(--campo-altura)',
      },
      minHeight: {
        campo: 'var(--campo-altura)',
      },
      fontSize: {
        // Escala fixa: display / titulo / secao / corpo / rotulo.
        // Nada de text-[13px] avulso pelas telas.
        display: ['2rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        titulo: ['1.5rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        secao: ['1.125rem', { lineHeight: '1.3' }],
        corpo: ['0.9375rem', { lineHeight: '1.5' }],
        rotulo: ['0.75rem', { lineHeight: '1.3', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', '"Playfair Display"', 'Georgia', 'serif'],
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: { 'fade-up': 'fade-up 0.35s ease-out both' },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // `mouse:` = só onde existe ponteiro de verdade. Usamos isto para as ações
    // que aparecem no hover (D5): `md:` não serviria, porque um tablet em
    // 1024px atende ao `md:` e não tem hover nenhum — as ações ficariam
    // invisíveis e inalcançáveis.
    require('tailwindcss/plugin')(({ addVariant }) => {
      addVariant('mouse', '@media (hover: hover) and (pointer: fine)')
    }),
  ],
}
