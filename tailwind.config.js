/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./App.tsx",
        "./index.tsx",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                hard: {
                    black: '#09090b',
                    gold: '#fbbf24',
                    red: '#ef4444',
                    blue: '#3b82f6',
                    purple: '#8b5cf6',
                    zinc: '#18181b',
                },
                matte: {
                    base: '#050505',
                    panel: '#09090b',
                    border: '#27272a',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['Courier Prime', 'monospace'],
                impact: ['Anton', 'sans-serif'],
            },
            backgroundImage: {
                'grid-pattern': "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
                'dot-pattern': "radial-gradient(rgba(255,255,255,0.15) 1px, transparent 1px)",
                'scan-lines': "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255, 255, 255, 0.03) 2px, rgba(255, 255, 255, 0.03) 3px)",
                'topo-pattern': "url(\"data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0 Q 25 25 50 0 T 100 0' stroke='rgba(255,255,255,0.05)' fill='none'/%3E%3Cpath d='M0 20 Q 25 45 50 20 T 100 20' stroke='rgba(255,255,255,0.05)' fill='none'/%3E%3Cpath d='M0 40 Q 25 65 50 40 T 100 40' stroke='rgba(255,255,255,0.05)' fill='none'/%3E%3Cpath d='M0 60 Q 25 85 50 60 T 100 60' stroke='rgba(255,255,255,0.05)' fill='none'/%3E%3Cpath d='M0 80 Q 25 105 50 80 T 100 80' stroke='rgba(255,255,255,0.05)' fill='none'/%3E%3C/svg%3E\")"
            },
            animation: {
                'blob': 'blob 10s infinite',
                'aurora': 'aurora 20s infinite alternate',
                'fade-in': 'fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                'spin-slow': 'spin 12s linear infinite',
                'marquee': 'marquee 25s linear infinite',
                'pulse-glow': 'pulseGlow 4s ease-in-out infinite',
            },
            keyframes: {
                blob: {
                    '0%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
                    '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
                    '100%': { transform: 'translate(0px, 0px) scale(1)' },
                },
                aurora: {
                    '0%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                    '100%': { backgroundPosition: '0% 50%' },
                },
                fadeIn: {
                    '0%': { opacity: '0', filter: 'blur(4px)' },
                    '100%': { opacity: '1', filter: 'blur(0)' }
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(20px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' }
                },
                marquee: {
                    '0%': { transform: 'translateX(0%)' },
                    '100%': { transform: 'translateX(-100%)' }
                },
                pulseGlow: {
                    '0%, 100%': { opacity: '0.6', filter: 'blur(20px)' },
                    '50%': { opacity: '1', filter: 'blur(35px)' }
                }
            }
        },
    },
    plugins: [],
}
