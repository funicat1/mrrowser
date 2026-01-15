const { app, BrowserWindow, protocol, ipcMain, Menu, webContents, clipboard, session, dialog, nativeTheme  } = require('electron');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');
const configfile = "config.json"
const config = {}

// does the config exist?
if (fs.existsSync(configfile)) {
	Object.assign(config, JSON.parse(fs.readFileSync(configfile)))
} else {
	Object.assign(config, {
		accent: "#00a1ff",
		enablewindowbuttons: true
	})
	fs.writeFileSync(configfile, JSON.stringify(config))
}


function writeconfig(key,value) {
	config[key] = value
	fs.writeFileSync(configfile,JSON.stringify(config))
}
function readconfig(key) {
	return config[key]
}

function mixcolor(color1_hex, color2_hex, weight = 50) {
  // Convert hex to decimal
  function h2d(h) {
    return parseInt(h, 16);
  }
  // Convert decimal to hex
  function d2h(d) {
    return d.toString(16).padStart(2, '0');
  }

  weight = Math.max(0, Math.min(100, weight)); // Ensure weight is between 0 and 100

  let color = "#";
  for (let i = 1; i <= 5; i += 2) { // Loop through R, G, B hex pairs
    const v1 = h2d(color1_hex.substr(i, 2));
    const v2 = h2d(color2_hex.substr(i, 2));

    // Combine values with weight
    const val = d2h(Math.floor(v2 + (v1 - v2) * (weight / 100.0)));
    color += val;
  }
  return color;
}
function createWindow() {

	const win = new BrowserWindow({
		width: 1000,
		height: 700,
		minHeight: 380,
		minWidth: 540,
		autoHideMenuBar: true,
		icon: path.join(__dirname, 'icon.png'),
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			webviewTag: true,
			
		},
		...readconfig("enablewindowbuttons") ? {titleBarStyle: 'hidden',
		// expose window controls in Windows/Linux
		titleBarOverlay: {
			color: mixcolor(readconfig("accent"),"#000000",60),
			symbolColor: "#fff",
			height: 40
		}} : {}
	}
	)
	win.webContents.on('did-finish-load', () => {
		win.webContents.send('theme:accent', readconfig("accent"))
		win.webContents.send('theme:enablewindowbuttons', readconfig("enablewindowbuttons"))
	})


	nativeTheme.themeSource = 'dark';
	
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
		return callback({ data: fs.readFileSync(path.join(__dirname, 'settings', 'settings.html')), mimeType: 'text/html' });
	}
	if (pathname.startsWith('assets')) {
		return callback({ data: fs.readFileSync(path.join(__dirname, request.url.replace("meow://",""))), mimeType: mime.lookup(request.url) });
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
			{ label: 'Gary', click: () => win.webContents.send('window-open', { "url": 'meow://gary' }) },
			{ label: 'Goober', click: () => win.webContents.send('window-open', { "url": 'meow://goober' }) },
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
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		details.responseHeaders['Access-Control-Allow-Origin'] = ['*']; // this is required for downloading files and the search
		callback({ cancel: false, responseHeaders: details.responseHeaders });
	});
	win.loadFile('assets/index.html');

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
