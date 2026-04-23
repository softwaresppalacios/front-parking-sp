/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef2f2",
          100: "#fee2e2",
          600: "#dc2626",
          800: "#991b1b"
        }
      },
      fontFamily: {
        heading: ["Barlow Condensed", "sans-serif"],
        body: ["Barlow", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"]
      },
      boxShadow: {
        panel: "0 1px 3px rgba(15,23,42,.06)",
        soft: "0 4px 20px rgba(0,0,0,.08)"
      }
    }
  },
  plugins: []
};
