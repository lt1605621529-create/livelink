import { Tray, Menu, nativeImage } from 'electron'

export function createTray(show: () => void, quit: () => void): Tray {
  // Embedded PNG avoids depending on unpacked resources or the current working directory.
  const image = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAALUlEQVR4nGMQ6Mn4TwlmGFwGfPj/C4zRFeESHzVgeBuAjPGJU98AipPygBgAAPwsZaPu08QxAAAAAElFTkSuQmCC')
  const tray = new Tray(image)
  tray.setToolTip('LiveLink · 后台运行（关闭窗口不停止直播助手）')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 LiveLink', click: show },
    { type: 'separator' },
    { label: '退出并停止所有服务', click: quit }
  ]))
  tray.on('double-click', show)
  return tray
}
