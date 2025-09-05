const { app, BrowserWindow, protocol, ipcMain, Menu, webContents, clipboard, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {

  const win = new BrowserWindow({
	width: 1000,
	height: 700,
	minHeight: 480,
	minWidth: 640,
	autoHideMenuBar: true,
	icon: path.join(__dirname, 'icon.png'),
	webPreferences: {
	  nodeIntegration: true,
	  contextIsolation: false,
	  webviewTag: true,
	}
	}
	)
  
  protocol.registerBufferProtocol('meow', (request, callback) => {
	// request.url will look like "meow://something"
	const pathname = request.url.replace('meow://', '');
	if (pathname === 'newtab') {
	  return callback({ data: fs.readFileSync(path.join(__dirname, 'newtab', 'index.html')), mimeType: 'text/html' });
	}
	if (pathname === 'about') {
	  return callback({ data: fs.readFileSync(path.join(__dirname, 'about', 'index.html')), mimeType: 'text/html' });
	}
	if (pathname === "gary") {
		return callback({ data: fs.readFileSync(path.join(__dirname, 'Gary64.jpg')), mimeType: 'image/jpeg' });
	}
	if (pathname === "goober") {
		return callback({ data: fs.readFileSync(path.join(__dirname, 'Goober18.jpg')), mimeType: 'image/jpeg' });
	}
	if (pathname === 'settings') {
	  return callback({ data: new Buffer.from('placeholder'), mimeType: 'text/html' });
	}
	if (pathname === 'newtab/productsans.ttf') {
		try {
			return callback({ 
				data: fs.readFileSync(path.join(__dirname, 'newtab', 'productsans.ttf')), 
				mimeType: 'font/ttf' 
			});
		} catch (e) {
			console.error('font missing', e);
			return callback({ error: -6 }); // file not found
		}
	}

  });
  ipcMain.on('register-window-open', (event, wcId) => {
	  const wc = webContents.fromId(wcId);
	  if (!wc) return;

	  wc.setWindowOpenHandler(({ url }) => {
			win.webContents.send('window-open', { "url": url });
			return { action: 'deny' }; // block opening, handle manually
	  });
  });

  ipcMain.on('open-menu', (event) => {
	  template = [
		  { label: 'New Tab', click: () => win.webContents.send('window-open', { "url": 'meow://newtab' }) },
		  { label: 'Settings', click: () => win.webContents.send('window-open', { "url": 'meow://settings' }) },
		  { label: 'About', click: () => win.webContents.send('window-open', { "url": 'meow://about' }) },
		  { label: 'Devtools', click: () => win.webContents.send('devtools') },
		  
		  { type: 'separator' },
		  { label: 'Exit', click: () => app.quit() }
	  ]
	  const menu = Menu.buildFromTemplate(template);
	  menu.popup({ window: win });
  });

  ipcMain.on('register-webview-context-menu', (event, wcId) => {
	  const wc = webContents.fromId(wcId);
	  if (!wc) return;

	  wc.on('context-menu', async (e, params) => {
		  const template = [];

		  // ---- link actions ----
		  if (params.linkURL) {
			  template.push(
				  { label: 'Open Link in new tab', click: () => win.webContents.send('window-open', { "url": params.linkURL }) },
				  { label: 'Copy Link Address', click: () => clipboard.writeText(params.linkURL) },
				  { type: 'separator' }
			  );
		  }

		  // ---- image actions ----
		  if (params.hasImageContents && params.srcURL) {
			  template.push(
				  { 
					  label: 'Save Image As...', 
					  click: async () => {
						  const { filePath } = await dialog.showSaveDialog({
							  title: 'Save Image',
							  defaultPath: 'image.png'
						  });
						  if (!filePath) return;

						  // download the image
						  const file = fs.createWriteStream(filePath);
						  https.get(params.srcURL, (res) => res.pipe(file));
					  }
				  },
				  { label: 'Copy Image', click: () => clipboard.writeImage(params.srcURL) },
				  { type: 'separator' }
			  );
		  }

		  // ---- text selection ----
		  if (params.isEditable) {
			  template.push(
				  { label: 'Cut', role: 'cut' },
				  { label: 'Copy', role: 'copy' },
				  { label: 'Paste', role: 'paste' },
				  { type: 'separator' }
			  );
		  } else if (params.selectionText) {
			  template.push(
				  { label: 'Copy', role: 'copy' },
				  { type: 'separator' }
			  );
		  }

		  // ---- navigation ----
		  template.push(
			  { label: 'Back', click: () => wc.goBack(), enabled: wc.canGoBack() },
			  { label: 'Forward', click: () => wc.goForward(), enabled: wc.canGoForward() },
			  { label: 'Reload', click: () => wc.reload() },
			  { type: 'separator' },
			  { label: 'Inspect Element', click: () => wc.inspectElement(params.x, params.y) }
		  );

		  const menu = Menu.buildFromTemplate(template);
		  menu.popup({ window: wc.getOwnerBrowserWindow() });
	  });
  });
  win.loadFile('assets/index.html');
  fetch('https://easylist.to/easylist/easylist.txt')
  .then(response => response.text())
  .then(text => {
    const blocker = ElectronBlocker.parse(text);
    blocker.enableBlockingInSession(win.webContents.session);
    
    // 可选：记录被阻止的请求
    blocker.on('request-blocked', (request) => {
      console.log(`Blocked ${request.url}`);
    });
  })
  .catch(error => {
    console.error('Error loading EasyList:', error);
  });

}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
	if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
