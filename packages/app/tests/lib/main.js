try {
  const { app, BrowserWindow } = require('electron')

  let window

  app.once('ready', () => {
    window = new BrowserWindow({
      frame: false,
      width: 1400,
      height: 1050,
      show: false,
      titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
    })

    window.once('ready-to-show', () => {
      // if user ups zoom level, reloads, we're stuck at a higher zoom
      // see https://github.com/electron/electron/issues/10572
      // note that this requires show: false above
      window.webContents.setZoomFactor(1)
      window.setVisibleOnAllWorkspaces(true)
      window.show()
      window.setVisibleOnAllWorkspaces(false)
    })

    window.loadURL('https://localhost:9080/')
  })
} catch (err) {
  console.log('main/fail: Webpack Test')
  console.error(err)
}
