import { mkdir, copyFile, cp } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await copyFile('clone-poem-game.html', 'dist/index.html');
await copyFile('clone-poem-game.html', 'dist/clone-poem-game.html');
await cp('public', 'dist/public', { recursive: true });
await cp('public/admin', 'dist/admin', { recursive: true });
console.log('Built game, telemetry and administrator page in dist/');
