/**
 * Custom sign hook: patch only the main app exe (win-unpacked) with rcedit so the
 * INSTALLED app shows "Salaat Widget" + icon. Do NOT patch the portable or installer
 * exe — modifying those breaks their embedded integrity checks (NSIS error).
 */
const path = require('path');
const fs = require('fs');
const rcedit = require('rcedit');

const projectDir = path.resolve(__dirname, '..');
const winUnpackedExe = path.join(projectDir, 'dist', 'win-unpacked', 'Salaat Widget.exe');

exports.default = async function (configuration) {
  const exePath = configuration.path;
  if (!exePath || !exePath.includes('Salaat Widget')) return;

  if (!fs.existsSync(winUnpackedExe)) return;

  // Use absolute path so icon is found regardless of cwd when electron-builder runs this script
  const icoPath = path.resolve(projectDir, 'icons', 'salaat-icon.ico');
  if (!fs.existsSync(icoPath)) return;

  await rcedit(winUnpackedExe, {
    icon: icoPath,
    'version-string': {
      FileDescription: 'Salaat Widget',
      ProductName: 'Salaat Widget',
      CompanyName: 'Abdulrahman',
    },
  });
};
