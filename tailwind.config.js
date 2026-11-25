/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hitamdov: "#131B2B",
        abubiru: "#2F4A63",
        biruabu: "#5B91A3",
        cyanterang: "CFEAE0",
        paper: "#FFFFFF",
        mist: "#F5F8FA",
        mistline: "#E3EAF0",
        coral: "#FF8F78",
      },
    },
  },
};
