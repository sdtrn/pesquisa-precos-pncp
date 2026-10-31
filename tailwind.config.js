/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#f0f4fa",
          100: "#dce5f3",
          200: "#bfd0ea",
          300: "#93b2dc",
          400: "#608bc9",
          500: "#3c6cb5",
          600: "#2b5498",
          700: "#23437b",
          800: "#1B365D",
          900: "#122440",
          950: "#0a1528",
        },
        brass: {
          50: "#fbf8eb",
          100: "#f6eecb",
          200: "#eedc99",
          300: "#e4c45f",
          400: "#dbae35",
          500: "#B59410",
          600: "#96750c",
          700: "#78580e",
          800: "#654712",
          900: "#563c15",
          950: "#322008",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
