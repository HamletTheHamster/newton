import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The identity of THIS build. Netlify sets COMMIT_REF on every deploy; a local build falls back
// to the build time, which is enough to tell two local builds apart. It is baked into the bundle
// as `__BUILD_ID__` and written to `version.json` beside it, and `src/app-version.js` compares
// the two: a session whose baked-in id no longer matches the file the server is serving is
// running code from an earlier deploy and must reload before it writes anything.
const BUILD_ID = (process.env.COMMIT_REF || "").slice(0, 12) || `local-${Date.now().toString(36)}`;

// Emit the manifest as a real build artifact rather than committing it to `public/`, so it cannot
// drift from the bundle it describes: the two are written by the same build or neither is.
const buildManifest = () => ({
  name: 'newton-build-manifest',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId: BUILD_ID }) });
  },
});

export default defineConfig({
  plugins: [react(), buildManifest()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
})
