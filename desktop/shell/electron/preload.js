const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  appName: 'cloud-offer-watch-desktop',
  version: '0.1.0',
});
