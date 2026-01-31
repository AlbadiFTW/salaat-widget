/**
 * afterPack hook: patch the Windows exe with rcedit so Task Manager / Startup apps
 * show "Salaat Widget" and the correct icon (avoids winCodeSign symlink issues).
 */
const path = require('path');
const fs = require('fs');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;

  const exeName = context.packager.executableName + '.exe';
  const exePath = path.join(context.appOutDir, exeName);

  if (!fs.existsSync(exePath)) return;

  const rcedit = require('rcedit');
  const projectDir = path.join(__dirname, '..');
  const icoPath = path.join(projectDir, 'icons', 'salaat-icon.ico');

  await rcedit(exePath, {
    'version-string': {
      FileDescription: 'Salaat Widget',
      ProductName: 'Salaat Widget',
      CompanyName: context.packager.config.author || 'Abdulrahman',
    },
    icon: fs.existsSync(icoPath) ? icoPath : undefined,
  });
};
