# Vite Plugin: JSX Component Tagger

A lightweight **Vite plugin** that automatically injects `data-component-id` attributes into your JSX/TSX components — making debugging, tracking, and testing effortless.

---

## ✨ Features

- 🔍 **Auto-tagging** – Adds a unique `data-component-id` to every JSX/TSX component.
- ⚛️ **Framework-friendly** – Works with React and other JSX-based frameworks.
- 📊 **Debug & Track** – Useful for analytics, user interaction tracking, and E2E testing.
- ⚡ **Zero runtime cost** – Tags are injected at build-time only.
- 🛠 **Developer-friendly** – No manual changes needed to your components.

---

## 📦 Installation

Using **npm**:

```bash
npm install --save-dev react-component-taggers
```

Using **yarn**:

```bash
yarn add -D react-component-taggers
```

Using **pnpm**:

```bash
pnpm add -D react-component-taggers
```

## 🚀 Usage

```bash
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import jsxTagger from "react-component-taggers";

export default defineConfig({
  plugins: [
    react(),
    jsxTagger(),
  ],
});
```
