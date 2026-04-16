import type { Config } from 'tailwindcss'

/**
 * Paleta "Barco Pirata" — tres colores maestros con buen contraste
 * ────────────────────────────────────────────────────────────────
 *   navy   → azul marino profundo (mar nocturno, dominante, seriedad)
 *   gold   → amarillo-dorado (oro pirata, acento, CTAs, success)
 *   pirate → rojo bandera (peligro, cancelar, errores)
 *
 * Regla: navy = 70 % · gold = 20 % · pirate ≤ 10 %
 * Contrastes validados WCAG AAA para combinaciones críticas.
 */
const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ─── Azul marino pirata (dominante) ────────────────────────────
        navy: {
          50:  '#EFF5FB',
          100: '#D9E5F2',
          200: '#B3CBE6',
          300: '#7FA4D0',
          400: '#4C7DB9',
          500: '#2A5E9E',
          600: '#1E4882',
          700: '#173869',
          800: '#122B51',
          900: '#0D2040',   // navy profundo — fondos, navbar
          950: '#081630',   // casi negro azulado
        },

        // ─── Oro pirata (acento principal = success) ───────────────────
        gold: {
          50:  '#FFFBEA',
          100: '#FFF3C4',
          200: '#FCE588',
          300: '#FADB5F',
          400: '#F7C948',   // gold vibrante — CTAs, precios
          500: '#F0B429',   // gold sólido
          600: '#DE911D',
          700: '#CB6E17',
          800: '#B44D12',
          900: '#8D2B0B',
          950: '#5C1A05',
        },

        // ─── Rojo pirata (danger, cancelar, errores) ──────────────────
        pirate: {
          50:  '#FEF2F2',
          100: '#FCE4E4',
          200: '#F9C2C2',
          300: '#F49494',
          400: '#EC5353',
          500: '#DC2626',   // rojo sólido — danger
          600: '#B91C1C',
          700: '#991B1B',
          800: '#7F1D1D',
          900: '#5C1414',
          950: '#3D0A0A',
        },

        // ─── Alias retrocompatibles (se resuelven al mismo color) ─────
        // Permite que clases históricas sigan funcionando sin refactor.
        brand: {
          50:  '#FFFBEA',
          100: '#FFF3C4',
          200: '#FCE588',
          300: '#FADB5F',
          400: '#F7C948',
          500: '#F0B429',
          600: '#DE911D',
          700: '#CB6E17',
          800: '#B44D12',
          900: '#8D2B0B',
          950: '#5C1A05',
        },
        ocean: {
          50:  '#EFF5FB',
          100: '#D9E5F2',
          200: '#B3CBE6',
          300: '#7FA4D0',
          400: '#4C7DB9',
          500: '#2A5E9E',
          600: '#1E4882',
          700: '#173869',
          800: '#122B51',
          900: '#0D2040',
          950: '#081630',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Pirata One"', 'Playfair Display', 'Georgia', 'serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      boxShadow: {
        card:    '0 2px 12px 0 rgba(13, 32, 64, 0.08)',
        'card-lg':'0 8px 32px 0 rgba(13, 32, 64, 0.16)',
        modal:   '0 20px 60px 0 rgba(8, 22, 48, 0.35)',
        gold:    '0 4px 14px 0 rgba(240, 180, 41, 0.35)',   // glow dorado
        pirate:  '0 4px 14px 0 rgba(220, 38, 38, 0.30)',    // glow rojo
      },
      backgroundImage: {
        'wave-gradient':     'linear-gradient(135deg, #0D2040 0%, #173869 60%, #2A5E9E 100%)',
        'gold-gradient':     'linear-gradient(135deg, #F7C948 0%, #F0B429 55%, #DE911D 100%)',
        'pirate-gradient':   'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
        'treasure-glow':     'radial-gradient(circle at 30% 30%, rgba(247,201,72,0.25), transparent 60%)',
      },
      animation: {
        'fade-in':  'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        wave:       'wave 3s ease-in-out infinite',
        shimmer:    'shimmer 2.4s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        wave: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
