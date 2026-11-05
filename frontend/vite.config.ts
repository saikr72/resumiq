import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Allows the API in the Content Security Policy, so the policy can't disagree with the API the app calls
function apiOriginInHeaders(apiUrl: string): Plugin {
  let outDir = '';
  return {
    name: 'api-origin-in-headers',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const file = path.join(outDir, '_headers');
      // A relative address such as /api is on the site itself, which the policy already allows
      const origin = apiUrl.startsWith('/') ? '' : new URL(apiUrl).origin;
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/__API_ORIGIN__/g, origin));
    },
  };
}

export default defineConfig(({ mode }) => {
  const apiUrl = loadEnv(mode, process.cwd()).VITE_API_URL || process.env.VITE_API_URL || 'http://localhost:5000/api';

  return {
    plugins: [react(), apiOriginInHeaders(apiUrl)],
    server: {
      port: 3000,
      host: true
    }
  };
});
