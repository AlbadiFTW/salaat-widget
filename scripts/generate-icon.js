/**
 * Generates icons/salaat-icon.ico from the 256px PNG for Windows (Apps, shortcuts, exe).
 * Run before build so the installer and exe get the correct icon everywhere.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const iconsDir = path.join(__dirname, '..', 'icons');
const pngPath = path.join(iconsDir, 'salaat-icon-256 (1).png');
const icoPath = path.join(iconsDir, 'salaat-icon.ico');

if (!fs.existsSync(pngPath)) {
  console.warn('generate-icon: source PNG not found at', pngPath);
  process.exit(0);
}

try {
  const buf = execSync(`npx png-to-ico "${pngPath}"`, { encoding: null, maxBuffer: 10 * 1024 * 1024 });
  fs.writeFileSync(icoPath, buf);
  console.log('Generated', icoPath);
  // Also copy to build/ so electron-builder finds it as default app icon
  const buildDir = path.join(__dirname, '..', 'build');
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });
  fs.copyFileSync(icoPath, path.join(buildDir, 'icon.ico'));
  console.log('Copied to build/icon.ico');
} catch (err) {
  console.error('generate-icon failed:', err.message);
  process.exit(1);
}
