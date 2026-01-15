const { ipcRenderer } = require('electron')

window.addEventListener('DOMContentLoaded', () => {
    console.log("im inside")
    console.log(location.protocol)
    if (location.protocol !== 'meow:') return
    console.log("got through")

    ipcRenderer.on('theme:accent', (_, accent) => {
      document.documentElement.style.setProperty('--accent', accent)
      console.log(accent)
    })
})
 