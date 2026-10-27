# 🍳 FlavorForge - Smart AI Cookbook & Kitchen Assistant

FlavorForge is a feature-rich, single-file web application designed to help you manage your recipe library, track your fridge inventory, maintain smart shopping lists, and instantly import recipes from links or text using **Gemini AI**.

## 🌐 Live Demo & Website
* **Live Website Link:** [Insert your deployed URL here, e.g., https://your-username.github.io/flavorforge]
* **Local Run:** Download `index.html` and double-click it to open directly in any browser.

---

## ✨ Key Features

1. **✨ Gemini AI Recipe Importer:**
   - Paste any YouTube Short, Instagram Reel, TikTok, or food blog link.
   - The app fetches the page content and utilizes **Gemini AI** (`gemini-1.5-flash` / `gemini-1.5-pro`) to automatically extract the recipe title, description, ingredients list, and cooking directions into an editable form.
   - Also supports pasting raw text or captions directly.

2. **📖 Recipe Library & Search:**
   - Organize all your recipes in a clean card grid with photos.
   - Filter by **★ Favorites** or **Ready to Cook** (recipes you can make right now based on what's in your fridge).
   - Instant search across recipe titles and ingredients.

3. **🥦 Fridge Inventory & Smart Check:**
   - Keep track of what ingredients you currently have in your kitchen.
   - FlavorForge automatically cross-references your fridge inventory with your recipes to highlight missing ingredients in red.
   - One-click button to **"Add Missing Items to Shopping List"**.

4. **🛒 Multiple Shopping Lists:**
   - Create and manage custom shopping lists (e.g., *Grocery Store*, *Farmers Market*).
   - Check off bought items and move them directly into your fridge inventory with a single click.

5. **⚡ Full Local Persistence & Image Support:**
   - All recipes, fridge inventory, and shopping lists are saved locally in your browser (`localStorage`).
   - Press `Ctrl + S` (or `Cmd + S`) inside the editor to instantly save changes.
   - Upload custom recipe photos or paste image URLs.

---

## ⚠️ Known Limitations

* **Website Scraping Restrictions:** The link importer relies on a web-scraping proxy (`Jina Reader`) to read public URLs. Certain websites with strict bot-detection, paywalls, or JavaScript-heavy rendering (such as protected recipe blogs or private social media posts) may fail to fetch automatically. If a link fails to import, you can easily copy the recipe text or caption and use the **"Paste Raw Text"** tab to parse it with AI instead.

---

## 🚀 Getting Started & Setup

1. **Clone or Download:** Save the `index.html` file to your computer.
2. **Open in Browser:** Double-click `index.html` to open it in Chrome, Safari, or Firefox.
3. **Configure Gemini API Key:** 
   - Click the **✨ AI Import** button in the top navigation bar.
   - Enter your Google Gemini API Key when prompted (keys are saved securely in your browser's local storage). You can get a free key from [Google AI Studio](https://aistudio.google.com/).

---

## 🛠️ Tech Stack
* **Frontend:** Vanilla HTML5, CSS3, and JavaScript (Single-File Architecture).
* **AI Integration:** Google Gemini API (`v1beta/models/gemini-1.5-flash`).
* **Web Scraping Proxy:** Jina Reader API (`r.jina.ai`) for CORS-free URL content fetching.
* **Storage:** Browser `localStorage`.