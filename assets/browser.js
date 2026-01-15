const tabsEl = document.getElementById('tabs2');
const webviewsEl = document.getElementById('webviews');
const newtab = document.getElementById('newtab');
const { ipcRenderer, Menu, MenuItem } = require("electron")
const fs = require('fs');
const path = require("node:path")

const webviews = [];
let selectedTabId = null;
let tabCounter = 0;

function omnibox(input) {
    input = input.trim();
    if (input.includes("!wiki")) {
        // wikipedia search
        input = input.replace(" !wiki", "");
        return `https://en.wikipedia.org/wiki/${encodeURIComponent(input)}`;
    }
    if (input.includes("!duck")) {
        // duckduckgo
        input = input.replace(" !duck", "");
        return `https://duckduckgo.com/?q=${encodeURIComponent(input)}`;
    }
    if (input.includes("!yt")) {
        // youtube search
        input = input.replace(" !yt", "");
        return `https://www.youtube.com/results?search_query=${encodeURIComponent(input)}`;
    }
    if (input.includes("!raw")) {
        // raw url
        input = input.replace(" !raw", "");
        return input;
    }
    if (input.startsWith("https://") || input.startsWith("http://") || input.startsWith("meow://")) {
        return input;
    }
    const urlRegex = /^(https?:\/\/|meow:\/\/|[a-z0-9.-]+\.[a-z]{2,})(:\d+)?(\/.*)?$/i;

    if (urlRegex.test(input)) {
        if (!/^https?:\/\//i.test(input) && !/^meow:\/\//i.test(input)) {
            input = "http://" + input;
        }
        return input;
    } else {
        return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
    }
}

function scanscripts(forurl) {
    // list the userscripts/ directory
    const files = fs.readdirSync('userscripts/');
    const scripts = [];
    for (const file of files) {
        // is it a folder?
        if (fs.statSync(`userscripts/${file}`).isDirectory()) {
            // so, the structure is basically:
            // script/allowedurls.txt
            // script/script.js
            
            // check allowedurls.txt
            const allowedurls = fs.readFileSync(`userscripts/${file}/allowedurls.txt`, 'utf8').split('\n');
            // since its a list of regexes for the url, we can just check if the url matches any of them
            for (const allowedurl of allowedurls) {
                if (new RegExp(allowedurl).test(forurl)) {
                    scripts.push(fs.readFileSync(`userscripts/${file}/script.js`, 'utf8'));
                    break;
                }
            }
        }
    }
    return scripts;
}

function createTab(url) {
    const tabId = `tab-${tabCounter++}`;

    // --- tab element ---
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.id = tabId;
    

    const favicon = document.createElement('img');
    favicon.className = 'favicon';
    favicon.style.display = 'none';
    favicon.onerror = () => (favicon.style.display = 'none');
    favicon.onload = () => (favicon.style.display = '');

    const textcontent = document.createElement("div")
    textcontent.classList.add("textcontent")
    tab.appendChild(textcontent)
    tab.insertBefore(favicon, tab.firstChild);

    tab.onclick = () => setActive(tabId);

    const closebtn = document.createElement('button');
    closebtn.className = 'closebtn';
    closebtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#FFFFFF"><path d="m291-240-51-51 189-189-189-189 51-51 189 189 189-189 51 51-189 189 189 189-51 51-189-189-189 189Z"/></svg>`;
    closebtn.onclick = () => closeTab(tabId);
    tab.appendChild(closebtn);

    tabsEl.appendChild(tab);
    tab.style.transitionDuration = "0ms"
    tab.style.width = "0px"
    tab.style.textOverflow = "clip"
    tab.style.padding = "0"
    tab.style.height = "38px"
    tab.style.overflow = "hidden"
    tab.style.whiteSpace = "nowrap"
    tab.style.marginLeft = "0"
    tab.style.marginRight = "0"
    requestAnimationFrame(function() {
        tab.style.transitionDuration = "200ms"
        tab.style.width = "212px"
        tab.style.textOverflow = ""
        tab.style.padding = "10px"
        tab.style.height = "18px"
        tab.style.overflow = ""
        tab.style.whiteSpace = ""
        tab.style.marginLeft = "10px"
        tab.style.marginRight = "10px"
        
    })

    // --- webview container ---
    const wvcontainer = document.createElement('div');
    wvcontainer.classList.add('page', 'webview');
    wvcontainer.dataset.id = tabId;

    

    const wv = document.createElement('webview');
    wv.classList.add("webv")
    wv.src = url;
    wv.setAttribute(
    'preload',
    path.join(__dirname, 'themeloader.js')
    )


    const bar = document.createElement('div');
    bar.classList.add('bar');

    const addressbar = document.createElement('input');
    addressbar.classList.add('addressbar');
    addressbar.type = 'text';
    addressbar.value = url;
    addressbar.onkeydown = (e) => {
        if (e.key === 'Enter') wv.src = omnibox(addressbar.value);
    };

    const leftbtn = document.createElement('button');
    leftbtn.classList.add('roundbutton');
    leftbtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z"/></svg>`
    leftbtn.onclick = () => wv.canGoBack() && wv.goBack();

    const rightbtn = document.createElement('button');
    rightbtn.classList.add('roundbutton');
    rightbtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M647-440H160v-80h487L423-744l57-56 320 320-320 320-57-56 224-224Z"/></svg>`
    rightbtn.onclick = () => wv.canGoForward() && wv.goForward();

    const refreshbtn = document.createElement('button');
    refreshbtn.classList.add('roundbutton');
    refreshbtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#FFFFFF"><path d="M480-80q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-440h80q0 117 81.5 198.5T480-160q117 0 198.5-81.5T760-440q0-117-81.5-198.5T480-720h-6l62 62-56 58-160-160 160-160 56 58-62 62h6q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-440q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-80Z"/></svg>`;
    refreshbtn.onclick = () => wv.reload();

    bar.append(leftbtn, rightbtn, refreshbtn, addressbar);
    wvcontainer.append(bar, wv);
    hasanicon = false;
    wv.addEventListener('page-title-updated', () => {
        textcontent.textContent = wv.getTitle();
    });
    wv.addEventListener('close', () => {
        closeTab(tabId);
    });
    fav = null;
    wv.addEventListener('page-favicon-updated', (e) => {
        const favs = e.favicons;
        if (!favs || favs.length === 0) {favicon.style.display = 'none'; hasanicon = false; }
        else favicon.src = favs[0]; fav = favs[0]; hasanicon = true;
    });

    wv.addEventListener('did-navigate', (e) => {
        addressbar.value = e.url;
        // get scripts
        const scripts = scanscripts(e.url);
        for (const script of scripts) {
            wv.executeJavaScript(script);
        }
    });
    wv.addEventListener('did-start-loading', () => {
        favicon.style.display = '';
        favicon.src = "loader.gif";
        refreshbtn.disabled = wv.isLoading();
    });


    function stopSpinner() {
        if (hasanicon) {
            favicon.src = fav;
        } else {
            favicon.style.display = 'none';
        }
        leftbtn.disabled = !wv.canGoBack();
        rightbtn.disabled = !wv.canGoForward();
        if (!wv.canGoForward()) {
            rightbtn.style.display = 'none';
        } else {rightbtn.style.display = '';}
        refreshbtn.disabled = wv.isLoading();
    }

    wv.addEventListener('did-finish-load', stopSpinner);
    wv.addEventListener('did-fail-load', stopSpinner);
    wv.addEventListener('did-stop-loading', stopSpinner);


    wv.addEventListener('did-attach', () => {
        const id = wv.getWebContentsId();  // this works in renderer
        ipcRenderer.send('register-webview-context-menu', id);
        ipcRenderer.send('register-window-open', id);
        ipcRenderer.send('webview-request-accent', id)
        
    });
    const etcbutton = document.createElement('button');
    etcbutton.classList.add('roundbutton');
    etcbutton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#ffffffff"><path d="M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z"/></svg>`;
    etcbutton.onclick = () => {
        ipcRenderer.send('open-menu');
    };
    bar.appendChild(etcbutton)
    webviewsEl.appendChild(wvcontainer);
    webviews.push({ id: tabId, element: wvcontainer, webview: wv });

    setActive(tabId);
    return tabId;
}

function setActive(id) {
    webviews.forEach(w => w.element.classList.toggle('active', w.id === id));
    Array.from(tabsEl.children).forEach(tab => tab.classList.toggle('active', tab.dataset.id === id));
    selectedTabId = id;
}

function closeTab(id) {
    // remove tab element
    const tab = Array.from(tabsEl.children).find(t => t.dataset.id === id);
    if (tab) {
        // activate animation
        tab.style.width = "0px"
        tab.style.textOverflow = "clip"
        tab.style.padding = "0"
        tab.style.height = "38px"
        tab.style.overflow = "hidden"
        tab.style.whiteSpace = "nowrap"
        tab.style.marginLeft = "0"
        tab.style.marginRight = "0"
        setTimeout(function() {
            tab.remove()
        },200)
    };

    // find index
    const idx = webviews.findIndex(w => w.id === id);
    if (idx === -1) return;

    // decide which tab to activate next
    let nextId = null;
    if (webviews.length > 1) { 
        // if there are other tabs, pick the next one
        if (idx === webviews.length - 1) {
            // last tab closed → pick previous
            nextId = webviews[idx - 1].id;
        } else {
            // pick the one to the right
            nextId = webviews[idx + 1].id;
        }
    }

    // remove the webview
    webviews[idx].element.remove();
    webviews.splice(idx, 1);

    // activate next tab if any
    requestAnimationFrame(function() {
        if (nextId) setActive(nextId);
        else window.close();
    })
}

ipcRenderer.on('window-open', (event, arg) => {
    createTab(arg.url);
});

ipcRenderer.on('devtools', (event, arg) => {
    webviews.find(w => w.id === selectedTabId).webview.openDevTools();
})

// --- initial tab ---
createTab('meow://newtab');

newtab.onclick = () => {
    createTab('meow://newtab');
};

ipcRenderer.on('theme:accent', (_, accent) => {
    console.log(accent)
    document.documentElement.style.setProperty('--accent', accent)
})
