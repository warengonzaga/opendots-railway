import { chownSync, mkdirSync } from 'node:fs';

// Railway mounts a fresh volume as root. Drop privileges before loading the app.
mkdirSync('/data', { recursive: true });
if (process.getuid() === 0) {
  chownSync('/data', 1000, 1000);
  process.setgroups([]);
  process.setgid(1000);
  process.setuid(1000);
}
await import('./dist/server/server/index.js');
