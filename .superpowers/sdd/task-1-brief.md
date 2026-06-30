### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `.gitignore`
- Create: `src/core/` (empty)
- Create: `src/gui/` (empty)
- Create: `src/cli/` (empty)

**Interfaces:**
- Consumes: nothing
- Produces: project skeleton, installed deps, initialized git repo

- [ ] **Step 1: Create package.json**

```json
{
  "name": "pixel-art-generator",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test src/",
    "cli": "node cli.js"
  },
  "dependencies": {
    "sharp": "^0.34.0"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Create .gitignore**

```
node_modules/
dist/
.DS_Store
*.local
```

- [ ] **Step 3: Create vite.config.js**

```js
import { defineConfig } from 'vite';
export default defineConfig({
  root: '.',
  build: { outDir: 'dist' }
});
```

- [ ] **Step 4: Create directory structure and install deps**

```bash
cd "D:/persenal program/像素画生成"
mkdir -p src/core src/gui src/cli
npm install
```

Expected: `npm install` completes with no errors, `node_modules/` and `package-lock.json` appear.

- [ ] **Step 5: Initialize git repo and commit**

```bash
git init
git add -A
git commit -m "chore: scaffold project structure with Vite + Sharp"
```

Expected: `git log` shows the initial commit.
