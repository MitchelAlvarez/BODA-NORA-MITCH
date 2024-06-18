import "/node_modules/vite/dist/client/env.mjs";

class HMRContext {
    constructor(hmrClient, ownerPath) {
        this.hmrClient = hmrClient;
        this.ownerPath = ownerPath;
        if (!hmrClient.dataMap.has(ownerPath)) {
            hmrClient.dataMap.set(ownerPath, {});
        }
        // when a file is hot updated, a new context is created
        // clear its stale callbacks
        const mod = hmrClient.hotModulesMap.get(ownerPath);
        if (mod) {
            mod.callbacks = [];
        }
        // clear stale custom event listeners
        const staleListeners = hmrClient.ctxToListenersMap.get(ownerPath);
        if (staleListeners) {
            for (const [event, staleFns] of staleListeners) {
                const listeners = hmrClient.customListenersMap.get(event);
                if (listeners) {
                    hmrClient.customListenersMap.set(event, listeners.filter((l) => !staleFns.includes(l)));
                }
            }
        }
        this.newListeners = new Map();
        hmrClient.ctxToListenersMap.set(ownerPath, this.newListeners);
    }
    get data() {
        return this.hmrClient.dataMap.get(this.ownerPath);
    }
    accept(deps, callback) {
        if (typeof deps === 'function' || !deps) {
            // self-accept: hot.accept(() => {})
            this.acceptDeps([this.ownerPath], ([mod]) => deps === null || deps === void 0 ? void 0 : deps(mod));
        }
        else if (typeof deps === 'string') {
            // explicit deps
            this.acceptDeps([deps], ([mod]) => callback === null || callback === void 0 ? void 0 : callback(mod));
        }
        else if (Array.isArray(deps)) {
            this.acceptDeps(deps, callback);
        }
        else {
            throw new Error(`invalid hot.accept() usage.`);
        }
    }
    // export names (first arg) are irrelevant on the client side, they're
    // extracted in the server for propagation
    acceptExports(_, callback) {
        this.acceptDeps([this.ownerPath], ([mod]) => callback === null || callback === void 0 ? void 0 : callback(mod));
    }
    dispose(cb) {
        this.hmrClient.disposeMap.set(this.ownerPath, cb);
    }
    prune(cb) {
        this.hmrClient.pruneMap.set(this.ownerPath, cb);
    }
    // Kept for backward compatibility (#11036)
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    decline() { }
    invalidate(message) {
        this.hmrClient.notifyListeners('vite:invalidate', {
            path: this.ownerPath,
            message,
        });
        this.send('vite:invalidate', { path: this.ownerPath, message });
        this.hmrClient.logger.debug(`[vite] invalidate ${this.ownerPath}${message ? `: ${message}` : ''}`);
    }
    on(event, cb) {
        const addToMap = (map) => {
            const existing = map.get(event) || [];
            existing.push(cb);
            map.set(event, existing);
        };
        addToMap(this.hmrClient.customListenersMap);
        addToMap(this.newListeners);
    }
    off(event, cb) {
        const removeFromMap = (map) => {
            const existing = map.get(event);
            if (existing === undefined) {
                return;
            }
            const pruned = existing.filter((l) => l !== cb);
            if (pruned.length === 0) {
                map.delete(event);
                return;
            }
            map.set(event, pruned);
        };
        removeFromMap(this.hmrClient.customListenersMap);
        removeFromMap(this.newListeners);
    }
    send(event, data) {
        this.hmrClient.messenger.send(JSON.stringify({ type: 'custom', event, data }));
    }
    acceptDeps(deps, callback = () => { }) {
        const mod = this.hmrClient.hotModulesMap.get(this.ownerPath) || {
            id: this.ownerPath,
            callbacks: [],
        };
        mod.callbacks.push({
            deps,
            fn: callback,
        });
        this.hmrClient.hotModulesMap.set(this.ownerPath, mod);
    }
}
class HMRMessenger {
    constructor(connection) {
        this.connection = connection;
        this.queue = [];
    }
    send(message) {
        this.queue.push(message);
        this.flush();
    }
    flush() {
        if (this.connection.isReady()) {
            this.queue.forEach((msg) => this.connection.send(msg));
            this.queue = [];
        }
    }
}
class HMRClient {
    constructor(logger, connection, 
    // This allows implementing reloading via different methods depending on the environment
    importUpdatedModule) {
        this.logger = logger;
        this.importUpdatedModule = importUpdatedModule;
        this.hotModulesMap = new Map();
        this.disposeMap = new Map();
        this.pruneMap = new Map();
        this.dataMap = new Map();
        this.customListenersMap = new Map();
        this.ctxToListenersMap = new Map();
        this.updateQueue = [];
        this.pendingUpdateQueue = false;
        this.messenger = new HMRMessenger(connection);
    }
    async notifyListeners(event, data) {
        const cbs = this.customListenersMap.get(event);
        if (cbs) {
            await Promise.allSettled(cbs.map((cb) => cb(data)));
        }
    }
    clear() {
        this.hotModulesMap.clear();
        this.disposeMap.clear();
        this.pruneMap.clear();
        this.dataMap.clear();
        this.customListenersMap.clear();
        this.ctxToListenersMap.clear();
    }
    // After an HMR update, some modules are no longer imported on the page
    // but they may have left behind side effects that need to be cleaned up
    // (.e.g style injections)
    async prunePaths(paths) {
        await Promise.all(paths.map((path) => {
            const disposer = this.disposeMap.get(path);
            if (disposer)
                return disposer(this.dataMap.get(path));
        }));
        paths.forEach((path) => {
            const fn = this.pruneMap.get(path);
            if (fn) {
                fn(this.dataMap.get(path));
            }
        });
    }
    warnFailedUpdate(err, path) {
        if (!err.message.includes('fetch')) {
            this.logger.error(err);
        }
        this.logger.error(`[hmr] Failed to reload ${path}. ` +
            `This could be due to syntax errors or importing non-existent ` +
            `modules. (see errors above)`);
    }
    /**
     * buffer multiple hot updates triggered by the same src change
     * so that they are invoked in the same order they were sent.
     * (otherwise the order may be inconsistent because of the http request round trip)
     */
    async queueUpdate(payload) {
        this.updateQueue.push(this.fetchUpdate(payload));
        if (!this.pendingUpdateQueue) {
            this.pendingUpdateQueue = true;
            await Promise.resolve();
            this.pendingUpdateQueue = false;
            const loading = [...this.updateQueue];
            this.updateQueue = [];
            (await Promise.all(loading)).forEach((fn) => fn && fn());
        }
    }
    async fetchUpdate(update) {
        const { path, acceptedPath } = update;
        const mod = this.hotModulesMap.get(path);
        if (!mod) {
            // In a code-splitting project,
            // it is common that the hot-updating module is not loaded yet.
            // https://github.com/vitejs/vite/issues/721
            return;
        }
        let fetchedModule;
        const isSelfUpdate = path === acceptedPath;
        // determine the qualified callbacks before we re-import the modules
        const qualifiedCallbacks = mod.callbacks.filter(({ deps }) => deps.includes(acceptedPath));
        if (isSelfUpdate || qualifiedCallbacks.length > 0) {
            const disposer = this.disposeMap.get(acceptedPath);
            if (disposer)
                await disposer(this.dataMap.get(acceptedPath));
            try {
                fetchedModule = await this.importUpdatedModule(update);
            }
            catch (e) {
                this.warnFailedUpdate(e, acceptedPath);
            }
        }
        return () => {
            for (const { deps, fn } of qualifiedCallbacks) {
                fn(deps.map((dep) => (dep === acceptedPath ? fetchedModule : undefined)));
            }
            const loggedPath = isSelfUpdate ? path : `${acceptedPath} via ${path}`;
            this.logger.debug(`[vite] hot updated: ${loggedPath}`);
        };
    }
}

const hmrConfigName = "vite.config.js";
const base$1 = "/" || '/';
// Create an element with provided attributes and optional children
function h(e, attrs = {}, ...children) {
    const elem = document.createElement(e);
    for (const [k, v] of Object.entries(attrs)) {
        elem.setAttribute(k, v);
    }
    elem.append(...children);
    return elem;
}
// set :host styles to make playwright detect the element as visible
const templateStyle = /*css*/ `
:host {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 99999;
  --monospace: 'SFMono-Regular', Consolas,
  'Liberation Mono', Menlo, Courier, monospace;
  --red: #ff5555;
  --yellow: #e2aa53;
  --purple: #cfa4ff;
  --cyan: #2dd9da;
  --dim: #c9c9c9;

  --window-background: #181818;
  --window-color: #d8d8d8;
}

.backdrop {
  position: fixed;
  z-index: 99999;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  margin: 0;
  background: rgba(0, 0, 0, 0.66);
}

.window {
  font-family: var(--monospace);
  line-height: 1.5;
  max-width: 80vw;
  color: var(--window-color);
  box-sizing: border-box;
  margin: 30px auto;
  padding: 2.5vh 4vw;
  position: relative;
  background: var(--window-background);
  border-radius: 6px 6px 8px 8px;
  box-shadow: 0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22);
  overflow: hidden;
  border-top: 8px solid var(--red);
  direction: ltr;
  text-align: left;
}

pre {
  font-family: var(--monospace);
  font-size: 16px;
  margin-top: 0;
  margin-bottom: 1em;
  overflow-x: scroll;
  scrollbar-width: none;
}

pre::-webkit-scrollbar {
  display: none;
}

pre.frame::-webkit-scrollbar {
  display: block;
  height: 5px;
}

pre.frame::-webkit-scrollbar-thumb {
  background: #999;
  border-radius: 5px;
}

pre.frame {
  scrollbar-width: thin;
}

.message {
  line-height: 1.3;
  font-weight: 600;
  white-space: pre-wrap;
}

.message-body {
  color: var(--red);
}

.plugin {
  color: var(--purple);
}

.file {
  color: var(--cyan);
  margin-bottom: 0;
  white-space: pre-wrap;
  word-break: break-all;
}

.frame {
  color: var(--yellow);
}

.stack {
  font-size: 13px;
  color: var(--dim);
}

.tip {
  font-size: 13px;
  color: #999;
  border-top: 1px dotted #999;
  padding-top: 13px;
  line-height: 1.8;
}

code {
  font-size: 13px;
  font-family: var(--monospace);
  color: var(--yellow);
}

.file-link {
  text-decoration: underline;
  cursor: pointer;
}

kbd {
  line-height: 1.5;
  font-family: ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 0.75rem;
  font-weight: 700;
  background-color: rgb(38, 40, 44);
  color: rgb(166, 167, 171);
  padding: 0.15rem 0.3rem;
  border-radius: 0.25rem;
  border-width: 0.0625rem 0.0625rem 0.1875rem;
  border-style: solid;
  border-color: rgb(54, 57, 64);
  border-image: initial;
}
`;
// Error Template
const template = h('div', { class: 'backdrop', part: 'backdrop' }, h('div', { class: 'window', part: 'window' }, h('pre', { class: 'message', part: 'message' }, h('span', { class: 'plugin', part: 'plugin' }), h('span', { class: 'message-body', part: 'message-body' })), h('pre', { class: 'file', part: 'file' }), h('pre', { class: 'frame', part: 'frame' }), h('pre', { class: 'stack', part: 'stack' }), h('div', { class: 'tip', part: 'tip' }, 'Click outside, press ', h('kbd', {}, 'Esc'), ' key, or fix the code to dismiss.', h('br'), 'You can also disable this overlay by setting ', h('code', { part: 'config-option-name' }, 'server.hmr.overlay'), ' to ', h('code', { part: 'config-option-value' }, 'false'), ' in ', h('code', { part: 'config-file-name' }, hmrConfigName), '.')), h('style', {}, templateStyle));
const fileRE = /(?:[a-zA-Z]:\\|\/).*?:\d+:\d+/g;
const codeframeRE = /^(?:>?\s*\d+\s+\|.*|\s+\|\s*\^.*)\r?\n/gm;
// Allow `ErrorOverlay` to extend `HTMLElement` even in environments where
// `HTMLElement` was not originally defined.
const { HTMLElement = class {
} } = globalThis;
class ErrorOverlay extends HTMLElement {
    constructor(err, links = true) {
        var _a;
        super();
        this.root = this.attachShadow({ mode: 'open' });
        this.root.appendChild(template);
        codeframeRE.lastIndex = 0;
        const hasFrame = err.frame && codeframeRE.test(err.frame);
        const message = hasFrame
            ? err.message.replace(codeframeRE, '')
            : err.message;
        if (err.plugin) {
            this.text('.plugin', `[plugin:${err.plugin}] `);
        }
        this.text('.message-body', message.trim());
        const [file] = (((_a = err.loc) === null || _a === void 0 ? void 0 : _a.file) || err.id || 'unknown file').split(`?`);
        if (err.loc) {
            this.text('.file', `${file}:${err.loc.line}:${err.loc.column}`, links);
        }
        else if (err.id) {
            this.text('.file', file);
        }
        if (hasFrame) {
            this.text('.frame', err.frame.trim());
        }
        this.text('.stack', err.stack, links);
        this.root.querySelector('.window').addEventListener('click', (e) => {
            e.stopPropagation();
        });
        this.addEventListener('click', () => {
            this.close();
        });
        this.closeOnEsc = (e) => {
            if (e.key === 'Escape' || e.code === 'Escape') {
                this.close();
            }
        };
        document.addEventListener('keydown', this.closeOnEsc);
    }
    text(selector, text, linkFiles = false) {
        const el = this.root.querySelector(selector);
        if (!linkFiles) {
            el.textContent = text;
        }
        else {
            let curIndex = 0;
            let match;
            fileRE.lastIndex = 0;
            while ((match = fileRE.exec(text))) {
                const { 0: file, index } = match;
                if (index != null) {
                    const frag = text.slice(curIndex, index);
                    el.appendChild(document.createTextNode(frag));
                    const link = document.createElement('a');
                    link.textContent = file;
                    link.className = 'file-link';
                    link.onclick = () => {
                        fetch(new URL(`${base$1}__open-in-editor?file=${encodeURIComponent(file)}`, import.meta.url));
                    };
                    el.appendChild(link);
                    curIndex += frag.length + file.length;
                }
            }
        }
    }
    close() {
        var _a;
        (_a = this.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(this);
        document.removeEventListener('keydown', this.closeOnEsc);
    }
}
const overlayId = 'vite-error-overlay';
const { customElements } = globalThis; // Ensure `customElements` is defined before the next line.
if (customElements && !customElements.get(overlayId)) {
    customElements.define(overlayId, ErrorOverlay);
}

var _a;
console.debug('[vite] connecting...');
const importMetaUrl = new URL(import.meta.url);
// use server configuration, then fallback to inference
const serverHost = "localhost:undefined/";
const socketProtocol = null || (importMetaUrl.protocol === 'https:' ? 'wss' : 'ws');
const hmrPort = null;
const socketHost = `${null || importMetaUrl.hostname}:${hmrPort || importMetaUrl.port}${"/"}`;
const directSocketHost = "localhost:undefined/";
const base = "/" || '/';
let socket;
try {
    let fallback;
    // only use fallback when port is inferred to prevent confusion
    if (!hmrPort) {
        fallback = () => {
            // fallback to connecting directly to the hmr server
            // for servers which does not support proxying websocket
            socket = setupWebSocket(socketProtocol, directSocketHost, () => {
                const currentScriptHostURL = new URL(import.meta.url);
                const currentScriptHost = currentScriptHostURL.host +
                    currentScriptHostURL.pathname.replace(/@vite\/client$/, '');
                console.error('[vite] failed to connect to websocket.\n' +
                    'your current setup:\n' +
                    `  (browser) ${currentScriptHost} <--[HTTP]--> ${serverHost} (server)\n` +
                    `  (browser) ${socketHost} <--[WebSocket (failing)]--> ${directSocketHost} (server)\n` +
                    'Check out your Vite / network configuration and https://vitejs.dev/config/server-options.html#server-hmr .');
            });
            socket.addEventListener('open', () => {
                console.info('[vite] Direct websocket connection fallback. Check out https://vitejs.dev/config/server-options.html#server-hmr to remove the previous connection error.');
            }, { once: true });
        };
    }
    socket = setupWebSocket(socketProtocol, socketHost, fallback);
}
catch (error) {
    console.error(`[vite] failed to connect to websocket (${error}). `);
}
function setupWebSocket(protocol, hostAndPath, onCloseWithoutOpen) {
    const socket = new WebSocket(`${protocol}://${hostAndPath}`, 'vite-hmr');
    let isOpened = false;
    socket.addEventListener('open', () => {
        isOpened = true;
        notifyListeners('vite:ws:connect', { webSocket: socket });
    }, { once: true });
    // Listen for messages
    socket.addEventListener('message', async ({ data }) => {
        handleMessage(JSON.parse(data));
    });
    // ping server
    socket.addEventListener('close', async ({ wasClean }) => {
        if (wasClean)
            return;
        if (!isOpened && onCloseWithoutOpen) {
            onCloseWithoutOpen();
            return;
        }
        notifyListeners('vite:ws:disconnect', { webSocket: socket });
        console.log(`[vite] server connection lost. polling for restart...`);
        await waitForSuccessfulPing(protocol, hostAndPath);
        location.reload();
    });
    return socket;
}
function cleanUrl(pathname) {
    const url = new URL(pathname, 'http://vitejs.dev');
    url.searchParams.delete('direct');
    return url.pathname + url.search;
}
let isFirstUpdate = true;
const outdatedLinkTags = new WeakSet();
const debounceReload = (time) => {
    let timer;
    return () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        timer = setTimeout(() => {
            location.reload();
        }, time);
    };
};
const pageReload = debounceReload(50);
const hmrClient = new HMRClient(console, {
    isReady: () => socket && socket.readyState === 1,
    send: (message) => socket.send(message),
}, async function importUpdatedModule({ acceptedPath, timestamp, explicitImportRequired, isWithinCircularImport, }) {
    const [acceptedPathWithoutQuery, query] = acceptedPath.split(`?`);
    const importPromise = import(
    /* @vite-ignore */
    base +
        acceptedPathWithoutQuery.slice(1) +
        `?${explicitImportRequired ? 'import&' : ''}t=${timestamp}${query ? `&${query}` : ''}`);
    if (isWithinCircularImport) {
        importPromise.catch(() => {
            console.info(`[hmr] ${acceptedPath} failed to apply HMR as it's within a circular import. Reloading page to reset the execution order. ` +
                `To debug and break the circular import, you can run \`vite --debug hmr\` to log the circular dependency path if a file change triggered it.`);
            pageReload();
        });
    }
    return await importPromise;
});
async function handleMessage(payload) {
    switch (payload.type) {
        case 'connected':
            console.debug(`[vite] connected.`);
            hmrClient.messenger.flush();
            // proxy(nginx, docker) hmr ws maybe caused timeout,
            // so send ping package let ws keep alive.
            setInterval(() => {
                if (socket.readyState === socket.OPEN) {
                    socket.send('{"type":"ping"}');
                }
            }, 30000);
            break;
        case 'update':
            notifyListeners('vite:beforeUpdate', payload);
            // if this is the first update and there's already an error overlay, it
            // means the page opened with existing server compile error and the whole
            // module script failed to load (since one of the nested imports is 500).
            // in this case a normal update won't work and a full reload is needed.
            if (isFirstUpdate && hasErrorOverlay()) {
                window.location.reload();
                return;
            }
            else {
                clearErrorOverlay();
                isFirstUpdate = false;
            }
            await Promise.all(payload.updates.map(async (update) => {
                if (update.type === 'js-update') {
                    return hmrClient.queueUpdate(update);
                }
                // css-update
                // this is only sent when a css file referenced with <link> is updated
                const { path, timestamp } = update;
                const searchUrl = cleanUrl(path);
                // can't use querySelector with `[href*=]` here since the link may be
                // using relative paths so we need to use link.href to grab the full
                // URL for the include check.
                const el = Array.from(document.querySelectorAll('link')).find((e) => !outdatedLinkTags.has(e) && cleanUrl(e.href).includes(searchUrl));
                if (!el) {
                    return;
                }
                const newPath = `${base}${searchUrl.slice(1)}${searchUrl.includes('?') ? '&' : '?'}t=${timestamp}`;
                // rather than swapping the href on the existing tag, we will
                // create a new link tag. Once the new stylesheet has loaded we
                // will remove the existing link tag. This removes a Flash Of
                // Unstyled Content that can occur when swapping out the tag href
                // directly, as the new stylesheet has not yet been loaded.
                return new Promise((resolve) => {
                    const newLinkTag = el.cloneNode();
                    newLinkTag.href = new URL(newPath, el.href).href;
                    const removeOldEl = () => {
                        el.remove();
                        console.debug(`[vite] css hot updated: ${searchUrl}`);
                        resolve();
                    };
                    newLinkTag.addEventListener('load', removeOldEl);
                    newLinkTag.addEventListener('error', removeOldEl);
                    outdatedLinkTags.add(el);
                    el.after(newLinkTag);
                });
            }));
            notifyListeners('vite:afterUpdate', payload);
            break;
        case 'custom': {
            notifyListeners(payload.event, payload.data);
            break;
        }
        case 'full-reload':
            notifyListeners('vite:beforeFullReload', payload);
            if (payload.path && payload.path.endsWith('.html')) {
                // if html file is edited, only reload the page if the browser is
                // currently on that page.
                const pagePath = decodeURI(location.pathname);
                const payloadPath = base + payload.path.slice(1);
                if (pagePath === payloadPath ||
                    payload.path === '/index.html' ||
                    (pagePath.endsWith('/') && pagePath + 'index.html' === payloadPath)) {
                    pageReload();
                }
                return;
            }
            else {
                pageReload();
            }
            break;
        case 'prune':
            notifyListeners('vite:beforePrune', payload);
            await hmrClient.prunePaths(payload.paths);
            break;
        case 'error': {
            notifyListeners('vite:error', payload);
            const err = payload.err;
            if (enableOverlay) {
                createErrorOverlay(err);
            }
            else {
                console.error(`[vite] Internal Server Error\n${err.message}\n${err.stack}`);
            }
            break;
        }
        default: {
            const check = payload;
            return check;
        }
    }
}
function notifyListeners(event, data) {
    hmrClient.notifyListeners(event, data);
}
const enableOverlay = true;
function createErrorOverlay(err) {
    clearErrorOverlay();
    document.body.appendChild(new ErrorOverlay(err));
}
function clearErrorOverlay() {
    document.querySelectorAll(overlayId).forEach((n) => n.close());
}
function hasErrorOverlay() {
    return document.querySelectorAll(overlayId).length;
}
async function waitForSuccessfulPing(socketProtocol, hostAndPath, ms = 1000) {
    const pingHostProtocol = socketProtocol === 'wss' ? 'https' : 'http';
    const ping = async () => {
        // A fetch on a websocket URL will return a successful promise with status 400,
        // but will reject a networking error.
        // When running on middleware mode, it returns status 426, and an cors error happens if mode is not no-cors
        try {
            await fetch(`${pingHostProtocol}://${hostAndPath}`, {
                mode: 'no-cors',
                headers: {
                    // Custom headers won't be included in a request with no-cors so (ab)use one of the
                    // safelisted headers to identify the ping request
                    Accept: 'text/x-vite-ping',
                },
            });
            return true;
        }
        catch { }
        return false;
    };
    if (await ping()) {
        return;
    }
    await wait(ms);
    // eslint-disable-next-line no-constant-condition
    while (true) {
        if (document.visibilityState === 'visible') {
            if (await ping()) {
                break;
            }
            await wait(ms);
        }
        else {
            await waitForWindowShow();
        }
    }
}
function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function waitForWindowShow() {
    return new Promise((resolve) => {
        const onChange = async () => {
            if (document.visibilityState === 'visible') {
                resolve();
                document.removeEventListener('visibilitychange', onChange);
            }
        };
        document.addEventListener('visibilitychange', onChange);
    });
}
const sheetsMap = new Map();
// collect existing style elements that may have been inserted during SSR
// to avoid FOUC or duplicate styles
if ('document' in globalThis) {
    document
        .querySelectorAll('style[data-vite-dev-id]')
        .forEach((el) => {
        sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
    });
}
const cspNonce = 'document' in globalThis
    ? (_a = document.querySelector('meta[property=csp-nonce]')) === null || _a === void 0 ? void 0 : _a.nonce
    : undefined;
// all css imports should be inserted at the same position
// because after build it will be a single css file
let lastInsertedStyle;
function updateStyle(id, content) {
    let style = sheetsMap.get(id);
    if (!style) {
        style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.setAttribute('data-vite-dev-id', id);
        style.textContent = content;
        if (cspNonce) {
            style.setAttribute('nonce', cspNonce);
        }
        if (!lastInsertedStyle) {
            document.head.appendChild(style);
            // reset lastInsertedStyle after async
            // because dynamically imported css will be splitted into a different file
            setTimeout(() => {
                lastInsertedStyle = undefined;
            }, 0);
        }
        else {
            lastInsertedStyle.insertAdjacentElement('afterend', style);
        }
        lastInsertedStyle = style;
    }
    else {
        style.textContent = content;
    }
    sheetsMap.set(id, style);
}
function removeStyle(id) {
    const style = sheetsMap.get(id);
    if (style) {
        document.head.removeChild(style);
        sheetsMap.delete(id);
    }
}
function createHotContext(ownerPath) {
    return new HMRContext(hmrClient, ownerPath);
}
/**
 * urls here are dynamic import() urls that couldn't be statically analyzed
 */
function injectQuery(url, queryToInject) {
    // skip urls that won't be handled by vite
    if (url[0] !== '.' && url[0] !== '/') {
        return url;
    }
    // can't use pathname from URL since it may be relative like ../
    const pathname = url.replace(/[?#].*$/, '');
    const { search, hash } = new URL(url, 'http://vitejs.dev');
    return `${pathname}?${queryToInject}${search ? `&` + search.slice(1) : ''}${hash || ''}`;
}

export { ErrorOverlay, createHotContext, injectQuery, removeStyle, updateStyle };
                                   

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2xpZW50Lm1qcyIsInNvdXJjZXMiOlsiaG1yLnRzIiwib3ZlcmxheS50cyIsImNsaWVudC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHlwZSB7IFVwZGF0ZSB9IGZyb20gJ3R5cGVzL2htclBheWxvYWQnXG5pbXBvcnQgdHlwZSB7IE1vZHVsZU5hbWVzcGFjZSwgVml0ZUhvdENvbnRleHQgfSBmcm9tICd0eXBlcy9ob3QnXG5pbXBvcnQgdHlwZSB7IEluZmVyQ3VzdG9tRXZlbnRQYXlsb2FkIH0gZnJvbSAndHlwZXMvY3VzdG9tRXZlbnQnXG5cbnR5cGUgQ3VzdG9tTGlzdGVuZXJzTWFwID0gTWFwPHN0cmluZywgKChkYXRhOiBhbnkpID0+IHZvaWQpW10+XG5cbmludGVyZmFjZSBIb3RNb2R1bGUge1xuICBpZDogc3RyaW5nXG4gIGNhbGxiYWNrczogSG90Q2FsbGJhY2tbXVxufVxuXG5pbnRlcmZhY2UgSG90Q2FsbGJhY2sge1xuICAvLyB0aGUgZGVwZW5kZW5jaWVzIG11c3QgYmUgZmV0Y2hhYmxlIHBhdGhzXG4gIGRlcHM6IHN0cmluZ1tdXG4gIGZuOiAobW9kdWxlczogQXJyYXk8TW9kdWxlTmFtZXNwYWNlIHwgdW5kZWZpbmVkPikgPT4gdm9pZFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhNUkxvZ2dlciB7XG4gIGVycm9yKG1zZzogc3RyaW5nIHwgRXJyb3IpOiB2b2lkXG4gIGRlYnVnKC4uLm1zZzogdW5rbm93bltdKTogdm9pZFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEhNUkNvbm5lY3Rpb24ge1xuICAvKipcbiAgICogQ2hlY2tlZCBiZWZvcmUgc2VuZGluZyBtZXNzYWdlcyB0byB0aGUgY2xpZW50LlxuICAgKi9cbiAgaXNSZWFkeSgpOiBib29sZWFuXG4gIC8qKlxuICAgKiBTZW5kIG1lc3NhZ2UgdG8gdGhlIGNsaWVudC5cbiAgICovXG4gIHNlbmQobWVzc2FnZXM6IHN0cmluZyk6IHZvaWRcbn1cblxuZXhwb3J0IGNsYXNzIEhNUkNvbnRleHQgaW1wbGVtZW50cyBWaXRlSG90Q29udGV4dCB7XG4gIHByaXZhdGUgbmV3TGlzdGVuZXJzOiBDdXN0b21MaXN0ZW5lcnNNYXBcblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIGhtckNsaWVudDogSE1SQ2xpZW50LFxuICAgIHByaXZhdGUgb3duZXJQYXRoOiBzdHJpbmcsXG4gICkge1xuICAgIGlmICghaG1yQ2xpZW50LmRhdGFNYXAuaGFzKG93bmVyUGF0aCkpIHtcbiAgICAgIGhtckNsaWVudC5kYXRhTWFwLnNldChvd25lclBhdGgsIHt9KVxuICAgIH1cblxuICAgIC8vIHdoZW4gYSBmaWxlIGlzIGhvdCB1cGRhdGVkLCBhIG5ldyBjb250ZXh0IGlzIGNyZWF0ZWRcbiAgICAvLyBjbGVhciBpdHMgc3RhbGUgY2FsbGJhY2tzXG4gICAgY29uc3QgbW9kID0gaG1yQ2xpZW50LmhvdE1vZHVsZXNNYXAuZ2V0KG93bmVyUGF0aClcbiAgICBpZiAobW9kKSB7XG4gICAgICBtb2QuY2FsbGJhY2tzID0gW11cbiAgICB9XG5cbiAgICAvLyBjbGVhciBzdGFsZSBjdXN0b20gZXZlbnQgbGlzdGVuZXJzXG4gICAgY29uc3Qgc3RhbGVMaXN0ZW5lcnMgPSBobXJDbGllbnQuY3R4VG9MaXN0ZW5lcnNNYXAuZ2V0KG93bmVyUGF0aClcbiAgICBpZiAoc3RhbGVMaXN0ZW5lcnMpIHtcbiAgICAgIGZvciAoY29uc3QgW2V2ZW50LCBzdGFsZUZuc10gb2Ygc3RhbGVMaXN0ZW5lcnMpIHtcbiAgICAgICAgY29uc3QgbGlzdGVuZXJzID0gaG1yQ2xpZW50LmN1c3RvbUxpc3RlbmVyc01hcC5nZXQoZXZlbnQpXG4gICAgICAgIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAgICAgICBobXJDbGllbnQuY3VzdG9tTGlzdGVuZXJzTWFwLnNldChcbiAgICAgICAgICAgIGV2ZW50LFxuICAgICAgICAgICAgbGlzdGVuZXJzLmZpbHRlcigobCkgPT4gIXN0YWxlRm5zLmluY2x1ZGVzKGwpKSxcbiAgICAgICAgICApXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLm5ld0xpc3RlbmVycyA9IG5ldyBNYXAoKVxuICAgIGhtckNsaWVudC5jdHhUb0xpc3RlbmVyc01hcC5zZXQob3duZXJQYXRoLCB0aGlzLm5ld0xpc3RlbmVycylcbiAgfVxuXG4gIGdldCBkYXRhKCk6IGFueSB7XG4gICAgcmV0dXJuIHRoaXMuaG1yQ2xpZW50LmRhdGFNYXAuZ2V0KHRoaXMub3duZXJQYXRoKVxuICB9XG5cbiAgYWNjZXB0KGRlcHM/OiBhbnksIGNhbGxiYWNrPzogYW55KTogdm9pZCB7XG4gICAgaWYgKHR5cGVvZiBkZXBzID09PSAnZnVuY3Rpb24nIHx8ICFkZXBzKSB7XG4gICAgICAvLyBzZWxmLWFjY2VwdDogaG90LmFjY2VwdCgoKSA9PiB7fSlcbiAgICAgIHRoaXMuYWNjZXB0RGVwcyhbdGhpcy5vd25lclBhdGhdLCAoW21vZF0pID0+IGRlcHM/Lihtb2QpKVxuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRlcHMgPT09ICdzdHJpbmcnKSB7XG4gICAgICAvLyBleHBsaWNpdCBkZXBzXG4gICAgICB0aGlzLmFjY2VwdERlcHMoW2RlcHNdLCAoW21vZF0pID0+IGNhbGxiYWNrPy4obW9kKSlcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZGVwcykpIHtcbiAgICAgIHRoaXMuYWNjZXB0RGVwcyhkZXBzLCBjYWxsYmFjaylcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBpbnZhbGlkIGhvdC5hY2NlcHQoKSB1c2FnZS5gKVxuICAgIH1cbiAgfVxuXG4gIC8vIGV4cG9ydCBuYW1lcyAoZmlyc3QgYXJnKSBhcmUgaXJyZWxldmFudCBvbiB0aGUgY2xpZW50IHNpZGUsIHRoZXkncmVcbiAgLy8gZXh0cmFjdGVkIGluIHRoZSBzZXJ2ZXIgZm9yIHByb3BhZ2F0aW9uXG4gIGFjY2VwdEV4cG9ydHMoXG4gICAgXzogc3RyaW5nIHwgcmVhZG9ubHkgc3RyaW5nW10sXG4gICAgY2FsbGJhY2s6IChkYXRhOiBhbnkpID0+IHZvaWQsXG4gICk6IHZvaWQge1xuICAgIHRoaXMuYWNjZXB0RGVwcyhbdGhpcy5vd25lclBhdGhdLCAoW21vZF0pID0+IGNhbGxiYWNrPy4obW9kKSlcbiAgfVxuXG4gIGRpc3Bvc2UoY2I6IChkYXRhOiBhbnkpID0+IHZvaWQpOiB2b2lkIHtcbiAgICB0aGlzLmhtckNsaWVudC5kaXNwb3NlTWFwLnNldCh0aGlzLm93bmVyUGF0aCwgY2IpXG4gIH1cblxuICBwcnVuZShjYjogKGRhdGE6IGFueSkgPT4gdm9pZCk6IHZvaWQge1xuICAgIHRoaXMuaG1yQ2xpZW50LnBydW5lTWFwLnNldCh0aGlzLm93bmVyUGF0aCwgY2IpXG4gIH1cblxuICAvLyBLZXB0IGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5ICgjMTEwMzYpXG4gIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBAdHlwZXNjcmlwdC1lc2xpbnQvbm8tZW1wdHktZnVuY3Rpb25cbiAgZGVjbGluZSgpOiB2b2lkIHt9XG5cbiAgaW52YWxpZGF0ZShtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICB0aGlzLmhtckNsaWVudC5ub3RpZnlMaXN0ZW5lcnMoJ3ZpdGU6aW52YWxpZGF0ZScsIHtcbiAgICAgIHBhdGg6IHRoaXMub3duZXJQYXRoLFxuICAgICAgbWVzc2FnZSxcbiAgICB9KVxuICAgIHRoaXMuc2VuZCgndml0ZTppbnZhbGlkYXRlJywgeyBwYXRoOiB0aGlzLm93bmVyUGF0aCwgbWVzc2FnZSB9KVxuICAgIHRoaXMuaG1yQ2xpZW50LmxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBbdml0ZV0gaW52YWxpZGF0ZSAke3RoaXMub3duZXJQYXRofSR7bWVzc2FnZSA/IGA6ICR7bWVzc2FnZX1gIDogJyd9YCxcbiAgICApXG4gIH1cblxuICBvbjxUIGV4dGVuZHMgc3RyaW5nPihcbiAgICBldmVudDogVCxcbiAgICBjYjogKHBheWxvYWQ6IEluZmVyQ3VzdG9tRXZlbnRQYXlsb2FkPFQ+KSA9PiB2b2lkLFxuICApOiB2b2lkIHtcbiAgICBjb25zdCBhZGRUb01hcCA9IChtYXA6IE1hcDxzdHJpbmcsIGFueVtdPikgPT4ge1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSBtYXAuZ2V0KGV2ZW50KSB8fCBbXVxuICAgICAgZXhpc3RpbmcucHVzaChjYilcbiAgICAgIG1hcC5zZXQoZXZlbnQsIGV4aXN0aW5nKVxuICAgIH1cbiAgICBhZGRUb01hcCh0aGlzLmhtckNsaWVudC5jdXN0b21MaXN0ZW5lcnNNYXApXG4gICAgYWRkVG9NYXAodGhpcy5uZXdMaXN0ZW5lcnMpXG4gIH1cblxuICBvZmY8VCBleHRlbmRzIHN0cmluZz4oXG4gICAgZXZlbnQ6IFQsXG4gICAgY2I6IChwYXlsb2FkOiBJbmZlckN1c3RvbUV2ZW50UGF5bG9hZDxUPikgPT4gdm9pZCxcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgcmVtb3ZlRnJvbU1hcCA9IChtYXA6IE1hcDxzdHJpbmcsIGFueVtdPikgPT4ge1xuICAgICAgY29uc3QgZXhpc3RpbmcgPSBtYXAuZ2V0KGV2ZW50KVxuICAgICAgaWYgKGV4aXN0aW5nID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBjb25zdCBwcnVuZWQgPSBleGlzdGluZy5maWx0ZXIoKGwpID0+IGwgIT09IGNiKVxuICAgICAgaWYgKHBydW5lZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgbWFwLmRlbGV0ZShldmVudClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBtYXAuc2V0KGV2ZW50LCBwcnVuZWQpXG4gICAgfVxuICAgIHJlbW92ZUZyb21NYXAodGhpcy5obXJDbGllbnQuY3VzdG9tTGlzdGVuZXJzTWFwKVxuICAgIHJlbW92ZUZyb21NYXAodGhpcy5uZXdMaXN0ZW5lcnMpXG4gIH1cblxuICBzZW5kPFQgZXh0ZW5kcyBzdHJpbmc+KGV2ZW50OiBULCBkYXRhPzogSW5mZXJDdXN0b21FdmVudFBheWxvYWQ8VD4pOiB2b2lkIHtcbiAgICB0aGlzLmhtckNsaWVudC5tZXNzZW5nZXIuc2VuZChcbiAgICAgIEpTT04uc3RyaW5naWZ5KHsgdHlwZTogJ2N1c3RvbScsIGV2ZW50LCBkYXRhIH0pLFxuICAgIClcbiAgfVxuXG4gIHByaXZhdGUgYWNjZXB0RGVwcyhcbiAgICBkZXBzOiBzdHJpbmdbXSxcbiAgICBjYWxsYmFjazogSG90Q2FsbGJhY2tbJ2ZuJ10gPSAoKSA9PiB7fSxcbiAgKTogdm9pZCB7XG4gICAgY29uc3QgbW9kOiBIb3RNb2R1bGUgPSB0aGlzLmhtckNsaWVudC5ob3RNb2R1bGVzTWFwLmdldCh0aGlzLm93bmVyUGF0aCkgfHwge1xuICAgICAgaWQ6IHRoaXMub3duZXJQYXRoLFxuICAgICAgY2FsbGJhY2tzOiBbXSxcbiAgICB9XG4gICAgbW9kLmNhbGxiYWNrcy5wdXNoKHtcbiAgICAgIGRlcHMsXG4gICAgICBmbjogY2FsbGJhY2ssXG4gICAgfSlcbiAgICB0aGlzLmhtckNsaWVudC5ob3RNb2R1bGVzTWFwLnNldCh0aGlzLm93bmVyUGF0aCwgbW9kKVxuICB9XG59XG5cbmNsYXNzIEhNUk1lc3NlbmdlciB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgY29ubmVjdGlvbjogSE1SQ29ubmVjdGlvbikge31cblxuICBwcml2YXRlIHF1ZXVlOiBzdHJpbmdbXSA9IFtdXG5cbiAgcHVibGljIHNlbmQobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gICAgdGhpcy5xdWV1ZS5wdXNoKG1lc3NhZ2UpXG4gICAgdGhpcy5mbHVzaCgpXG4gIH1cblxuICBwdWJsaWMgZmx1c2goKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuY29ubmVjdGlvbi5pc1JlYWR5KCkpIHtcbiAgICAgIHRoaXMucXVldWUuZm9yRWFjaCgobXNnKSA9PiB0aGlzLmNvbm5lY3Rpb24uc2VuZChtc2cpKVxuICAgICAgdGhpcy5xdWV1ZSA9IFtdXG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBITVJDbGllbnQge1xuICBwdWJsaWMgaG90TW9kdWxlc01hcCA9IG5ldyBNYXA8c3RyaW5nLCBIb3RNb2R1bGU+KClcbiAgcHVibGljIGRpc3Bvc2VNYXAgPSBuZXcgTWFwPHN0cmluZywgKGRhdGE6IGFueSkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD4+KClcbiAgcHVibGljIHBydW5lTWFwID0gbmV3IE1hcDxzdHJpbmcsIChkYXRhOiBhbnkpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+PigpXG4gIHB1YmxpYyBkYXRhTWFwID0gbmV3IE1hcDxzdHJpbmcsIGFueT4oKVxuICBwdWJsaWMgY3VzdG9tTGlzdGVuZXJzTWFwOiBDdXN0b21MaXN0ZW5lcnNNYXAgPSBuZXcgTWFwKClcbiAgcHVibGljIGN0eFRvTGlzdGVuZXJzTWFwID0gbmV3IE1hcDxzdHJpbmcsIEN1c3RvbUxpc3RlbmVyc01hcD4oKVxuXG4gIHB1YmxpYyBtZXNzZW5nZXI6IEhNUk1lc3NlbmdlclxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHB1YmxpYyBsb2dnZXI6IEhNUkxvZ2dlcixcbiAgICBjb25uZWN0aW9uOiBITVJDb25uZWN0aW9uLFxuICAgIC8vIFRoaXMgYWxsb3dzIGltcGxlbWVudGluZyByZWxvYWRpbmcgdmlhIGRpZmZlcmVudCBtZXRob2RzIGRlcGVuZGluZyBvbiB0aGUgZW52aXJvbm1lbnRcbiAgICBwcml2YXRlIGltcG9ydFVwZGF0ZWRNb2R1bGU6ICh1cGRhdGU6IFVwZGF0ZSkgPT4gUHJvbWlzZTxNb2R1bGVOYW1lc3BhY2U+LFxuICApIHtcbiAgICB0aGlzLm1lc3NlbmdlciA9IG5ldyBITVJNZXNzZW5nZXIoY29ubmVjdGlvbilcbiAgfVxuXG4gIHB1YmxpYyBhc3luYyBub3RpZnlMaXN0ZW5lcnM8VCBleHRlbmRzIHN0cmluZz4oXG4gICAgZXZlbnQ6IFQsXG4gICAgZGF0YTogSW5mZXJDdXN0b21FdmVudFBheWxvYWQ8VD4sXG4gICk6IFByb21pc2U8dm9pZD5cbiAgcHVibGljIGFzeW5jIG5vdGlmeUxpc3RlbmVycyhldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBjYnMgPSB0aGlzLmN1c3RvbUxpc3RlbmVyc01hcC5nZXQoZXZlbnQpXG4gICAgaWYgKGNicykge1xuICAgICAgYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKGNicy5tYXAoKGNiKSA9PiBjYihkYXRhKSkpXG4gICAgfVxuICB9XG5cbiAgcHVibGljIGNsZWFyKCk6IHZvaWQge1xuICAgIHRoaXMuaG90TW9kdWxlc01hcC5jbGVhcigpXG4gICAgdGhpcy5kaXNwb3NlTWFwLmNsZWFyKClcbiAgICB0aGlzLnBydW5lTWFwLmNsZWFyKClcbiAgICB0aGlzLmRhdGFNYXAuY2xlYXIoKVxuICAgIHRoaXMuY3VzdG9tTGlzdGVuZXJzTWFwLmNsZWFyKClcbiAgICB0aGlzLmN0eFRvTGlzdGVuZXJzTWFwLmNsZWFyKClcbiAgfVxuXG4gIC8vIEFmdGVyIGFuIEhNUiB1cGRhdGUsIHNvbWUgbW9kdWxlcyBhcmUgbm8gbG9uZ2VyIGltcG9ydGVkIG9uIHRoZSBwYWdlXG4gIC8vIGJ1dCB0aGV5IG1heSBoYXZlIGxlZnQgYmVoaW5kIHNpZGUgZWZmZWN0cyB0aGF0IG5lZWQgdG8gYmUgY2xlYW5lZCB1cFxuICAvLyAoLmUuZyBzdHlsZSBpbmplY3Rpb25zKVxuICBwdWJsaWMgYXN5bmMgcHJ1bmVQYXRocyhwYXRoczogc3RyaW5nW10pOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBhd2FpdCBQcm9taXNlLmFsbChcbiAgICAgIHBhdGhzLm1hcCgocGF0aCkgPT4ge1xuICAgICAgICBjb25zdCBkaXNwb3NlciA9IHRoaXMuZGlzcG9zZU1hcC5nZXQocGF0aClcbiAgICAgICAgaWYgKGRpc3Bvc2VyKSByZXR1cm4gZGlzcG9zZXIodGhpcy5kYXRhTWFwLmdldChwYXRoKSlcbiAgICAgIH0pLFxuICAgIClcbiAgICBwYXRocy5mb3JFYWNoKChwYXRoKSA9PiB7XG4gICAgICBjb25zdCBmbiA9IHRoaXMucHJ1bmVNYXAuZ2V0KHBhdGgpXG4gICAgICBpZiAoZm4pIHtcbiAgICAgICAgZm4odGhpcy5kYXRhTWFwLmdldChwYXRoKSlcbiAgICAgIH1cbiAgICB9KVxuICB9XG5cbiAgcHJvdGVjdGVkIHdhcm5GYWlsZWRVcGRhdGUoZXJyOiBFcnJvciwgcGF0aDogc3RyaW5nIHwgc3RyaW5nW10pOiB2b2lkIHtcbiAgICBpZiAoIWVyci5tZXNzYWdlLmluY2x1ZGVzKCdmZXRjaCcpKSB7XG4gICAgICB0aGlzLmxvZ2dlci5lcnJvcihlcnIpXG4gICAgfVxuICAgIHRoaXMubG9nZ2VyLmVycm9yKFxuICAgICAgYFtobXJdIEZhaWxlZCB0byByZWxvYWQgJHtwYXRofS4gYCArXG4gICAgICAgIGBUaGlzIGNvdWxkIGJlIGR1ZSB0byBzeW50YXggZXJyb3JzIG9yIGltcG9ydGluZyBub24tZXhpc3RlbnQgYCArXG4gICAgICAgIGBtb2R1bGVzLiAoc2VlIGVycm9ycyBhYm92ZSlgLFxuICAgIClcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlUXVldWU6IFByb21pc2U8KCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkPltdID0gW11cbiAgcHJpdmF0ZSBwZW5kaW5nVXBkYXRlUXVldWUgPSBmYWxzZVxuXG4gIC8qKlxuICAgKiBidWZmZXIgbXVsdGlwbGUgaG90IHVwZGF0ZXMgdHJpZ2dlcmVkIGJ5IHRoZSBzYW1lIHNyYyBjaGFuZ2VcbiAgICogc28gdGhhdCB0aGV5IGFyZSBpbnZva2VkIGluIHRoZSBzYW1lIG9yZGVyIHRoZXkgd2VyZSBzZW50LlxuICAgKiAob3RoZXJ3aXNlIHRoZSBvcmRlciBtYXkgYmUgaW5jb25zaXN0ZW50IGJlY2F1c2Ugb2YgdGhlIGh0dHAgcmVxdWVzdCByb3VuZCB0cmlwKVxuICAgKi9cbiAgcHVibGljIGFzeW5jIHF1ZXVlVXBkYXRlKHBheWxvYWQ6IFVwZGF0ZSk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMudXBkYXRlUXVldWUucHVzaCh0aGlzLmZldGNoVXBkYXRlKHBheWxvYWQpKVxuICAgIGlmICghdGhpcy5wZW5kaW5nVXBkYXRlUXVldWUpIHtcbiAgICAgIHRoaXMucGVuZGluZ1VwZGF0ZVF1ZXVlID0gdHJ1ZVxuICAgICAgYXdhaXQgUHJvbWlzZS5yZXNvbHZlKClcbiAgICAgIHRoaXMucGVuZGluZ1VwZGF0ZVF1ZXVlID0gZmFsc2VcbiAgICAgIGNvbnN0IGxvYWRpbmcgPSBbLi4udGhpcy51cGRhdGVRdWV1ZV1cbiAgICAgIHRoaXMudXBkYXRlUXVldWUgPSBbXVxuICAgICAgOyhhd2FpdCBQcm9taXNlLmFsbChsb2FkaW5nKSkuZm9yRWFjaCgoZm4pID0+IGZuICYmIGZuKCkpXG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhc3luYyBmZXRjaFVwZGF0ZSh1cGRhdGU6IFVwZGF0ZSk6IFByb21pc2U8KCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkPiB7XG4gICAgY29uc3QgeyBwYXRoLCBhY2NlcHRlZFBhdGggfSA9IHVwZGF0ZVxuICAgIGNvbnN0IG1vZCA9IHRoaXMuaG90TW9kdWxlc01hcC5nZXQocGF0aClcbiAgICBpZiAoIW1vZCkge1xuICAgICAgLy8gSW4gYSBjb2RlLXNwbGl0dGluZyBwcm9qZWN0LFxuICAgICAgLy8gaXQgaXMgY29tbW9uIHRoYXQgdGhlIGhvdC11cGRhdGluZyBtb2R1bGUgaXMgbm90IGxvYWRlZCB5ZXQuXG4gICAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vdml0ZWpzL3ZpdGUvaXNzdWVzLzcyMVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgbGV0IGZldGNoZWRNb2R1bGU6IE1vZHVsZU5hbWVzcGFjZSB8IHVuZGVmaW5lZFxuICAgIGNvbnN0IGlzU2VsZlVwZGF0ZSA9IHBhdGggPT09IGFjY2VwdGVkUGF0aFxuXG4gICAgLy8gZGV0ZXJtaW5lIHRoZSBxdWFsaWZpZWQgY2FsbGJhY2tzIGJlZm9yZSB3ZSByZS1pbXBvcnQgdGhlIG1vZHVsZXNcbiAgICBjb25zdCBxdWFsaWZpZWRDYWxsYmFja3MgPSBtb2QuY2FsbGJhY2tzLmZpbHRlcigoeyBkZXBzIH0pID0+XG4gICAgICBkZXBzLmluY2x1ZGVzKGFjY2VwdGVkUGF0aCksXG4gICAgKVxuXG4gICAgaWYgKGlzU2VsZlVwZGF0ZSB8fCBxdWFsaWZpZWRDYWxsYmFja3MubGVuZ3RoID4gMCkge1xuICAgICAgY29uc3QgZGlzcG9zZXIgPSB0aGlzLmRpc3Bvc2VNYXAuZ2V0KGFjY2VwdGVkUGF0aClcbiAgICAgIGlmIChkaXNwb3NlcikgYXdhaXQgZGlzcG9zZXIodGhpcy5kYXRhTWFwLmdldChhY2NlcHRlZFBhdGgpKVxuICAgICAgdHJ5IHtcbiAgICAgICAgZmV0Y2hlZE1vZHVsZSA9IGF3YWl0IHRoaXMuaW1wb3J0VXBkYXRlZE1vZHVsZSh1cGRhdGUpXG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHRoaXMud2FybkZhaWxlZFVwZGF0ZShlLCBhY2NlcHRlZFBhdGgpXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIGZvciAoY29uc3QgeyBkZXBzLCBmbiB9IG9mIHF1YWxpZmllZENhbGxiYWNrcykge1xuICAgICAgICBmbihcbiAgICAgICAgICBkZXBzLm1hcCgoZGVwKSA9PiAoZGVwID09PSBhY2NlcHRlZFBhdGggPyBmZXRjaGVkTW9kdWxlIDogdW5kZWZpbmVkKSksXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGNvbnN0IGxvZ2dlZFBhdGggPSBpc1NlbGZVcGRhdGUgPyBwYXRoIDogYCR7YWNjZXB0ZWRQYXRofSB2aWEgJHtwYXRofWBcbiAgICAgIHRoaXMubG9nZ2VyLmRlYnVnKGBbdml0ZV0gaG90IHVwZGF0ZWQ6ICR7bG9nZ2VkUGF0aH1gKVxuICAgIH1cbiAgfVxufVxuIiwiaW1wb3J0IHR5cGUgeyBFcnJvclBheWxvYWQgfSBmcm9tICd0eXBlcy9obXJQYXlsb2FkJ1xuXG4vLyBpbmplY3RlZCBieSB0aGUgaG1yIHBsdWdpbiB3aGVuIHNlcnZlZFxuZGVjbGFyZSBjb25zdCBfX0JBU0VfXzogc3RyaW5nXG5kZWNsYXJlIGNvbnN0IF9fSE1SX0NPTkZJR19OQU1FX186IHN0cmluZ1xuXG5jb25zdCBobXJDb25maWdOYW1lID0gX19ITVJfQ09ORklHX05BTUVfX1xuY29uc3QgYmFzZSA9IF9fQkFTRV9fIHx8ICcvJ1xuXG4vLyBDcmVhdGUgYW4gZWxlbWVudCB3aXRoIHByb3ZpZGVkIGF0dHJpYnV0ZXMgYW5kIG9wdGlvbmFsIGNoaWxkcmVuXG5mdW5jdGlvbiBoKFxuICBlOiBzdHJpbmcsXG4gIGF0dHJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge30sXG4gIC4uLmNoaWxkcmVuOiAoc3RyaW5nIHwgTm9kZSlbXVxuKSB7XG4gIGNvbnN0IGVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KGUpXG4gIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKGF0dHJzKSkge1xuICAgIGVsZW0uc2V0QXR0cmlidXRlKGssIHYpXG4gIH1cbiAgZWxlbS5hcHBlbmQoLi4uY2hpbGRyZW4pXG4gIHJldHVybiBlbGVtXG59XG5cbi8vIHNldCA6aG9zdCBzdHlsZXMgdG8gbWFrZSBwbGF5d3JpZ2h0IGRldGVjdCB0aGUgZWxlbWVudCBhcyB2aXNpYmxlXG5jb25zdCB0ZW1wbGF0ZVN0eWxlID0gLypjc3MqLyBgXG46aG9zdCB7XG4gIHBvc2l0aW9uOiBmaXhlZDtcbiAgdG9wOiAwO1xuICBsZWZ0OiAwO1xuICB3aWR0aDogMTAwJTtcbiAgaGVpZ2h0OiAxMDAlO1xuICB6LWluZGV4OiA5OTk5OTtcbiAgLS1tb25vc3BhY2U6ICdTRk1vbm8tUmVndWxhcicsIENvbnNvbGFzLFxuICAnTGliZXJhdGlvbiBNb25vJywgTWVubG8sIENvdXJpZXIsIG1vbm9zcGFjZTtcbiAgLS1yZWQ6ICNmZjU1NTU7XG4gIC0teWVsbG93OiAjZTJhYTUzO1xuICAtLXB1cnBsZTogI2NmYTRmZjtcbiAgLS1jeWFuOiAjMmRkOWRhO1xuICAtLWRpbTogI2M5YzljOTtcblxuICAtLXdpbmRvdy1iYWNrZ3JvdW5kOiAjMTgxODE4O1xuICAtLXdpbmRvdy1jb2xvcjogI2Q4ZDhkODtcbn1cblxuLmJhY2tkcm9wIHtcbiAgcG9zaXRpb246IGZpeGVkO1xuICB6LWluZGV4OiA5OTk5OTtcbiAgdG9wOiAwO1xuICBsZWZ0OiAwO1xuICB3aWR0aDogMTAwJTtcbiAgaGVpZ2h0OiAxMDAlO1xuICBvdmVyZmxvdy15OiBzY3JvbGw7XG4gIG1hcmdpbjogMDtcbiAgYmFja2dyb3VuZDogcmdiYSgwLCAwLCAwLCAwLjY2KTtcbn1cblxuLndpbmRvdyB7XG4gIGZvbnQtZmFtaWx5OiB2YXIoLS1tb25vc3BhY2UpO1xuICBsaW5lLWhlaWdodDogMS41O1xuICBtYXgtd2lkdGg6IDgwdnc7XG4gIGNvbG9yOiB2YXIoLS13aW5kb3ctY29sb3IpO1xuICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICBtYXJnaW46IDMwcHggYXV0bztcbiAgcGFkZGluZzogMi41dmggNHZ3O1xuICBwb3NpdGlvbjogcmVsYXRpdmU7XG4gIGJhY2tncm91bmQ6IHZhcigtLXdpbmRvdy1iYWNrZ3JvdW5kKTtcbiAgYm9yZGVyLXJhZGl1czogNnB4IDZweCA4cHggOHB4O1xuICBib3gtc2hhZG93OiAwIDE5cHggMzhweCByZ2JhKDAsMCwwLDAuMzApLCAwIDE1cHggMTJweCByZ2JhKDAsMCwwLDAuMjIpO1xuICBvdmVyZmxvdzogaGlkZGVuO1xuICBib3JkZXItdG9wOiA4cHggc29saWQgdmFyKC0tcmVkKTtcbiAgZGlyZWN0aW9uOiBsdHI7XG4gIHRleHQtYWxpZ246IGxlZnQ7XG59XG5cbnByZSB7XG4gIGZvbnQtZmFtaWx5OiB2YXIoLS1tb25vc3BhY2UpO1xuICBmb250LXNpemU6IDE2cHg7XG4gIG1hcmdpbi10b3A6IDA7XG4gIG1hcmdpbi1ib3R0b206IDFlbTtcbiAgb3ZlcmZsb3cteDogc2Nyb2xsO1xuICBzY3JvbGxiYXItd2lkdGg6IG5vbmU7XG59XG5cbnByZTo6LXdlYmtpdC1zY3JvbGxiYXIge1xuICBkaXNwbGF5OiBub25lO1xufVxuXG5wcmUuZnJhbWU6Oi13ZWJraXQtc2Nyb2xsYmFyIHtcbiAgZGlzcGxheTogYmxvY2s7XG4gIGhlaWdodDogNXB4O1xufVxuXG5wcmUuZnJhbWU6Oi13ZWJraXQtc2Nyb2xsYmFyLXRodW1iIHtcbiAgYmFja2dyb3VuZDogIzk5OTtcbiAgYm9yZGVyLXJhZGl1czogNXB4O1xufVxuXG5wcmUuZnJhbWUge1xuICBzY3JvbGxiYXItd2lkdGg6IHRoaW47XG59XG5cbi5tZXNzYWdlIHtcbiAgbGluZS1oZWlnaHQ6IDEuMztcbiAgZm9udC13ZWlnaHQ6IDYwMDtcbiAgd2hpdGUtc3BhY2U6IHByZS13cmFwO1xufVxuXG4ubWVzc2FnZS1ib2R5IHtcbiAgY29sb3I6IHZhcigtLXJlZCk7XG59XG5cbi5wbHVnaW4ge1xuICBjb2xvcjogdmFyKC0tcHVycGxlKTtcbn1cblxuLmZpbGUge1xuICBjb2xvcjogdmFyKC0tY3lhbik7XG4gIG1hcmdpbi1ib3R0b206IDA7XG4gIHdoaXRlLXNwYWNlOiBwcmUtd3JhcDtcbiAgd29yZC1icmVhazogYnJlYWstYWxsO1xufVxuXG4uZnJhbWUge1xuICBjb2xvcjogdmFyKC0teWVsbG93KTtcbn1cblxuLnN0YWNrIHtcbiAgZm9udC1zaXplOiAxM3B4O1xuICBjb2xvcjogdmFyKC0tZGltKTtcbn1cblxuLnRpcCB7XG4gIGZvbnQtc2l6ZTogMTNweDtcbiAgY29sb3I6ICM5OTk7XG4gIGJvcmRlci10b3A6IDFweCBkb3R0ZWQgIzk5OTtcbiAgcGFkZGluZy10b3A6IDEzcHg7XG4gIGxpbmUtaGVpZ2h0OiAxLjg7XG59XG5cbmNvZGUge1xuICBmb250LXNpemU6IDEzcHg7XG4gIGZvbnQtZmFtaWx5OiB2YXIoLS1tb25vc3BhY2UpO1xuICBjb2xvcjogdmFyKC0teWVsbG93KTtcbn1cblxuLmZpbGUtbGluayB7XG4gIHRleHQtZGVjb3JhdGlvbjogdW5kZXJsaW5lO1xuICBjdXJzb3I6IHBvaW50ZXI7XG59XG5cbmtiZCB7XG4gIGxpbmUtaGVpZ2h0OiAxLjU7XG4gIGZvbnQtZmFtaWx5OiB1aS1tb25vc3BhY2UsIE1lbmxvLCBNb25hY28sIENvbnNvbGFzLCBcIkxpYmVyYXRpb24gTW9ub1wiLCBcIkNvdXJpZXIgTmV3XCIsIG1vbm9zcGFjZTtcbiAgZm9udC1zaXplOiAwLjc1cmVtO1xuICBmb250LXdlaWdodDogNzAwO1xuICBiYWNrZ3JvdW5kLWNvbG9yOiByZ2IoMzgsIDQwLCA0NCk7XG4gIGNvbG9yOiByZ2IoMTY2LCAxNjcsIDE3MSk7XG4gIHBhZGRpbmc6IDAuMTVyZW0gMC4zcmVtO1xuICBib3JkZXItcmFkaXVzOiAwLjI1cmVtO1xuICBib3JkZXItd2lkdGg6IDAuMDYyNXJlbSAwLjA2MjVyZW0gMC4xODc1cmVtO1xuICBib3JkZXItc3R5bGU6IHNvbGlkO1xuICBib3JkZXItY29sb3I6IHJnYig1NCwgNTcsIDY0KTtcbiAgYm9yZGVyLWltYWdlOiBpbml0aWFsO1xufVxuYFxuXG4vLyBFcnJvciBUZW1wbGF0ZVxuY29uc3QgdGVtcGxhdGUgPSBoKFxuICAnZGl2JyxcbiAgeyBjbGFzczogJ2JhY2tkcm9wJywgcGFydDogJ2JhY2tkcm9wJyB9LFxuICBoKFxuICAgICdkaXYnLFxuICAgIHsgY2xhc3M6ICd3aW5kb3cnLCBwYXJ0OiAnd2luZG93JyB9LFxuICAgIGgoXG4gICAgICAncHJlJyxcbiAgICAgIHsgY2xhc3M6ICdtZXNzYWdlJywgcGFydDogJ21lc3NhZ2UnIH0sXG4gICAgICBoKCdzcGFuJywgeyBjbGFzczogJ3BsdWdpbicsIHBhcnQ6ICdwbHVnaW4nIH0pLFxuICAgICAgaCgnc3BhbicsIHsgY2xhc3M6ICdtZXNzYWdlLWJvZHknLCBwYXJ0OiAnbWVzc2FnZS1ib2R5JyB9KSxcbiAgICApLFxuICAgIGgoJ3ByZScsIHsgY2xhc3M6ICdmaWxlJywgcGFydDogJ2ZpbGUnIH0pLFxuICAgIGgoJ3ByZScsIHsgY2xhc3M6ICdmcmFtZScsIHBhcnQ6ICdmcmFtZScgfSksXG4gICAgaCgncHJlJywgeyBjbGFzczogJ3N0YWNrJywgcGFydDogJ3N0YWNrJyB9KSxcbiAgICBoKFxuICAgICAgJ2RpdicsXG4gICAgICB7IGNsYXNzOiAndGlwJywgcGFydDogJ3RpcCcgfSxcbiAgICAgICdDbGljayBvdXRzaWRlLCBwcmVzcyAnLFxuICAgICAgaCgna2JkJywge30sICdFc2MnKSxcbiAgICAgICcga2V5LCBvciBmaXggdGhlIGNvZGUgdG8gZGlzbWlzcy4nLFxuICAgICAgaCgnYnInKSxcbiAgICAgICdZb3UgY2FuIGFsc28gZGlzYWJsZSB0aGlzIG92ZXJsYXkgYnkgc2V0dGluZyAnLFxuICAgICAgaCgnY29kZScsIHsgcGFydDogJ2NvbmZpZy1vcHRpb24tbmFtZScgfSwgJ3NlcnZlci5obXIub3ZlcmxheScpLFxuICAgICAgJyB0byAnLFxuICAgICAgaCgnY29kZScsIHsgcGFydDogJ2NvbmZpZy1vcHRpb24tdmFsdWUnIH0sICdmYWxzZScpLFxuICAgICAgJyBpbiAnLFxuICAgICAgaCgnY29kZScsIHsgcGFydDogJ2NvbmZpZy1maWxlLW5hbWUnIH0sIGhtckNvbmZpZ05hbWUpLFxuICAgICAgJy4nLFxuICAgICksXG4gICksXG4gIGgoJ3N0eWxlJywge30sIHRlbXBsYXRlU3R5bGUpLFxuKVxuXG5jb25zdCBmaWxlUkUgPSAvKD86W2EtekEtWl06XFxcXHxcXC8pLio/OlxcZCs6XFxkKy9nXG5jb25zdCBjb2RlZnJhbWVSRSA9IC9eKD86Pj9cXHMqXFxkK1xccytcXHwuKnxcXHMrXFx8XFxzKlxcXi4qKVxccj9cXG4vZ21cblxuLy8gQWxsb3cgYEVycm9yT3ZlcmxheWAgdG8gZXh0ZW5kIGBIVE1MRWxlbWVudGAgZXZlbiBpbiBlbnZpcm9ubWVudHMgd2hlcmVcbi8vIGBIVE1MRWxlbWVudGAgd2FzIG5vdCBvcmlnaW5hbGx5IGRlZmluZWQuXG5jb25zdCB7IEhUTUxFbGVtZW50ID0gY2xhc3Mge30gYXMgdHlwZW9mIGdsb2JhbFRoaXMuSFRNTEVsZW1lbnQgfSA9IGdsb2JhbFRoaXNcbmV4cG9ydCBjbGFzcyBFcnJvck92ZXJsYXkgZXh0ZW5kcyBIVE1MRWxlbWVudCB7XG4gIHJvb3Q6IFNoYWRvd1Jvb3RcbiAgY2xvc2VPbkVzYzogKGU6IEtleWJvYXJkRXZlbnQpID0+IHZvaWRcblxuICBjb25zdHJ1Y3RvcihlcnI6IEVycm9yUGF5bG9hZFsnZXJyJ10sIGxpbmtzID0gdHJ1ZSkge1xuICAgIHN1cGVyKClcbiAgICB0aGlzLnJvb3QgPSB0aGlzLmF0dGFjaFNoYWRvdyh7IG1vZGU6ICdvcGVuJyB9KVxuXG4gICAgdGhpcy5yb290LmFwcGVuZENoaWxkKHRlbXBsYXRlKVxuXG4gICAgY29kZWZyYW1lUkUubGFzdEluZGV4ID0gMFxuICAgIGNvbnN0IGhhc0ZyYW1lID0gZXJyLmZyYW1lICYmIGNvZGVmcmFtZVJFLnRlc3QoZXJyLmZyYW1lKVxuICAgIGNvbnN0IG1lc3NhZ2UgPSBoYXNGcmFtZVxuICAgICAgPyBlcnIubWVzc2FnZS5yZXBsYWNlKGNvZGVmcmFtZVJFLCAnJylcbiAgICAgIDogZXJyLm1lc3NhZ2VcbiAgICBpZiAoZXJyLnBsdWdpbikge1xuICAgICAgdGhpcy50ZXh0KCcucGx1Z2luJywgYFtwbHVnaW46JHtlcnIucGx1Z2lufV0gYClcbiAgICB9XG4gICAgdGhpcy50ZXh0KCcubWVzc2FnZS1ib2R5JywgbWVzc2FnZS50cmltKCkpXG5cbiAgICBjb25zdCBbZmlsZV0gPSAoZXJyLmxvYz8uZmlsZSB8fCBlcnIuaWQgfHwgJ3Vua25vd24gZmlsZScpLnNwbGl0KGA/YClcbiAgICBpZiAoZXJyLmxvYykge1xuICAgICAgdGhpcy50ZXh0KCcuZmlsZScsIGAke2ZpbGV9OiR7ZXJyLmxvYy5saW5lfToke2Vyci5sb2MuY29sdW1ufWAsIGxpbmtzKVxuICAgIH0gZWxzZSBpZiAoZXJyLmlkKSB7XG4gICAgICB0aGlzLnRleHQoJy5maWxlJywgZmlsZSlcbiAgICB9XG5cbiAgICBpZiAoaGFzRnJhbWUpIHtcbiAgICAgIHRoaXMudGV4dCgnLmZyYW1lJywgZXJyLmZyYW1lIS50cmltKCkpXG4gICAgfVxuICAgIHRoaXMudGV4dCgnLnN0YWNrJywgZXJyLnN0YWNrLCBsaW5rcylcblxuICAgIHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKCcud2luZG93JykhLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICB9KVxuXG4gICAgdGhpcy5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgIHRoaXMuY2xvc2UoKVxuICAgIH0pXG5cbiAgICB0aGlzLmNsb3NlT25Fc2MgPSAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSAnRXNjYXBlJyB8fCBlLmNvZGUgPT09ICdFc2NhcGUnKSB7XG4gICAgICAgIHRoaXMuY2xvc2UoKVxuICAgICAgfVxuICAgIH1cblxuICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCB0aGlzLmNsb3NlT25Fc2MpXG4gIH1cblxuICB0ZXh0KHNlbGVjdG9yOiBzdHJpbmcsIHRleHQ6IHN0cmluZywgbGlua0ZpbGVzID0gZmFsc2UpOiB2b2lkIHtcbiAgICBjb25zdCBlbCA9IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKHNlbGVjdG9yKSFcbiAgICBpZiAoIWxpbmtGaWxlcykge1xuICAgICAgZWwudGV4dENvbnRlbnQgPSB0ZXh0XG4gICAgfSBlbHNlIHtcbiAgICAgIGxldCBjdXJJbmRleCA9IDBcbiAgICAgIGxldCBtYXRjaDogUmVnRXhwRXhlY0FycmF5IHwgbnVsbFxuICAgICAgZmlsZVJFLmxhc3RJbmRleCA9IDBcbiAgICAgIHdoaWxlICgobWF0Y2ggPSBmaWxlUkUuZXhlYyh0ZXh0KSkpIHtcbiAgICAgICAgY29uc3QgeyAwOiBmaWxlLCBpbmRleCB9ID0gbWF0Y2hcbiAgICAgICAgaWYgKGluZGV4ICE9IG51bGwpIHtcbiAgICAgICAgICBjb25zdCBmcmFnID0gdGV4dC5zbGljZShjdXJJbmRleCwgaW5kZXgpXG4gICAgICAgICAgZWwuYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoZnJhZykpXG4gICAgICAgICAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKVxuICAgICAgICAgIGxpbmsudGV4dENvbnRlbnQgPSBmaWxlXG4gICAgICAgICAgbGluay5jbGFzc05hbWUgPSAnZmlsZS1saW5rJ1xuICAgICAgICAgIGxpbmsub25jbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgIGZldGNoKFxuICAgICAgICAgICAgICBuZXcgVVJMKFxuICAgICAgICAgICAgICAgIGAke2Jhc2V9X19vcGVuLWluLWVkaXRvcj9maWxlPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGZpbGUpfWAsXG4gICAgICAgICAgICAgICAgaW1wb3J0Lm1ldGEudXJsLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbC5hcHBlbmRDaGlsZChsaW5rKVxuICAgICAgICAgIGN1ckluZGV4ICs9IGZyYWcubGVuZ3RoICsgZmlsZS5sZW5ndGhcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICBjbG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLnBhcmVudE5vZGU/LnJlbW92ZUNoaWxkKHRoaXMpXG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigna2V5ZG93bicsIHRoaXMuY2xvc2VPbkVzYylcbiAgfVxufVxuXG5leHBvcnQgY29uc3Qgb3ZlcmxheUlkID0gJ3ZpdGUtZXJyb3Itb3ZlcmxheSdcbmNvbnN0IHsgY3VzdG9tRWxlbWVudHMgfSA9IGdsb2JhbFRoaXMgLy8gRW5zdXJlIGBjdXN0b21FbGVtZW50c2AgaXMgZGVmaW5lZCBiZWZvcmUgdGhlIG5leHQgbGluZS5cbmlmIChjdXN0b21FbGVtZW50cyAmJiAhY3VzdG9tRWxlbWVudHMuZ2V0KG92ZXJsYXlJZCkpIHtcbiAgY3VzdG9tRWxlbWVudHMuZGVmaW5lKG92ZXJsYXlJZCwgRXJyb3JPdmVybGF5KVxufVxuIiwiaW1wb3J0IHR5cGUgeyBFcnJvclBheWxvYWQsIEhNUlBheWxvYWQgfSBmcm9tICd0eXBlcy9obXJQYXlsb2FkJ1xuaW1wb3J0IHR5cGUgeyBWaXRlSG90Q29udGV4dCB9IGZyb20gJ3R5cGVzL2hvdCdcbmltcG9ydCB0eXBlIHsgSW5mZXJDdXN0b21FdmVudFBheWxvYWQgfSBmcm9tICd0eXBlcy9jdXN0b21FdmVudCdcbmltcG9ydCB7IEhNUkNsaWVudCwgSE1SQ29udGV4dCB9IGZyb20gJy4uL3NoYXJlZC9obXInXG5pbXBvcnQgeyBFcnJvck92ZXJsYXksIG92ZXJsYXlJZCB9IGZyb20gJy4vb3ZlcmxheSdcbmltcG9ydCAnQHZpdGUvZW52J1xuXG4vLyBpbmplY3RlZCBieSB0aGUgaG1yIHBsdWdpbiB3aGVuIHNlcnZlZFxuZGVjbGFyZSBjb25zdCBfX0JBU0VfXzogc3RyaW5nXG5kZWNsYXJlIGNvbnN0IF9fU0VSVkVSX0hPU1RfXzogc3RyaW5nXG5kZWNsYXJlIGNvbnN0IF9fSE1SX1BST1RPQ09MX186IHN0cmluZyB8IG51bGxcbmRlY2xhcmUgY29uc3QgX19ITVJfSE9TVE5BTUVfXzogc3RyaW5nIHwgbnVsbFxuZGVjbGFyZSBjb25zdCBfX0hNUl9QT1JUX186IG51bWJlciB8IG51bGxcbmRlY2xhcmUgY29uc3QgX19ITVJfRElSRUNUX1RBUkdFVF9fOiBzdHJpbmdcbmRlY2xhcmUgY29uc3QgX19ITVJfQkFTRV9fOiBzdHJpbmdcbmRlY2xhcmUgY29uc3QgX19ITVJfVElNRU9VVF9fOiBudW1iZXJcbmRlY2xhcmUgY29uc3QgX19ITVJfRU5BQkxFX09WRVJMQVlfXzogYm9vbGVhblxuXG5jb25zb2xlLmRlYnVnKCdbdml0ZV0gY29ubmVjdGluZy4uLicpXG5cbmNvbnN0IGltcG9ydE1ldGFVcmwgPSBuZXcgVVJMKGltcG9ydC5tZXRhLnVybClcblxuLy8gdXNlIHNlcnZlciBjb25maWd1cmF0aW9uLCB0aGVuIGZhbGxiYWNrIHRvIGluZmVyZW5jZVxuY29uc3Qgc2VydmVySG9zdCA9IF9fU0VSVkVSX0hPU1RfX1xuY29uc3Qgc29ja2V0UHJvdG9jb2wgPVxuICBfX0hNUl9QUk9UT0NPTF9fIHx8IChpbXBvcnRNZXRhVXJsLnByb3RvY29sID09PSAnaHR0cHM6JyA/ICd3c3MnIDogJ3dzJylcbmNvbnN0IGhtclBvcnQgPSBfX0hNUl9QT1JUX19cbmNvbnN0IHNvY2tldEhvc3QgPSBgJHtfX0hNUl9IT1NUTkFNRV9fIHx8IGltcG9ydE1ldGFVcmwuaG9zdG5hbWV9OiR7XG4gIGhtclBvcnQgfHwgaW1wb3J0TWV0YVVybC5wb3J0XG59JHtfX0hNUl9CQVNFX199YFxuY29uc3QgZGlyZWN0U29ja2V0SG9zdCA9IF9fSE1SX0RJUkVDVF9UQVJHRVRfX1xuY29uc3QgYmFzZSA9IF9fQkFTRV9fIHx8ICcvJ1xuXG5sZXQgc29ja2V0OiBXZWJTb2NrZXRcbnRyeSB7XG4gIGxldCBmYWxsYmFjazogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkXG4gIC8vIG9ubHkgdXNlIGZhbGxiYWNrIHdoZW4gcG9ydCBpcyBpbmZlcnJlZCB0byBwcmV2ZW50IGNvbmZ1c2lvblxuICBpZiAoIWhtclBvcnQpIHtcbiAgICBmYWxsYmFjayA9ICgpID0+IHtcbiAgICAgIC8vIGZhbGxiYWNrIHRvIGNvbm5lY3RpbmcgZGlyZWN0bHkgdG8gdGhlIGhtciBzZXJ2ZXJcbiAgICAgIC8vIGZvciBzZXJ2ZXJzIHdoaWNoIGRvZXMgbm90IHN1cHBvcnQgcHJveHlpbmcgd2Vic29ja2V0XG4gICAgICBzb2NrZXQgPSBzZXR1cFdlYlNvY2tldChzb2NrZXRQcm90b2NvbCwgZGlyZWN0U29ja2V0SG9zdCwgKCkgPT4ge1xuICAgICAgICBjb25zdCBjdXJyZW50U2NyaXB0SG9zdFVSTCA9IG5ldyBVUkwoaW1wb3J0Lm1ldGEudXJsKVxuICAgICAgICBjb25zdCBjdXJyZW50U2NyaXB0SG9zdCA9XG4gICAgICAgICAgY3VycmVudFNjcmlwdEhvc3RVUkwuaG9zdCArXG4gICAgICAgICAgY3VycmVudFNjcmlwdEhvc3RVUkwucGF0aG5hbWUucmVwbGFjZSgvQHZpdGVcXC9jbGllbnQkLywgJycpXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgJ1t2aXRlXSBmYWlsZWQgdG8gY29ubmVjdCB0byB3ZWJzb2NrZXQuXFxuJyArXG4gICAgICAgICAgICAneW91ciBjdXJyZW50IHNldHVwOlxcbicgK1xuICAgICAgICAgICAgYCAgKGJyb3dzZXIpICR7Y3VycmVudFNjcmlwdEhvc3R9IDwtLVtIVFRQXS0tPiAke3NlcnZlckhvc3R9IChzZXJ2ZXIpXFxuYCArXG4gICAgICAgICAgICBgICAoYnJvd3NlcikgJHtzb2NrZXRIb3N0fSA8LS1bV2ViU29ja2V0IChmYWlsaW5nKV0tLT4gJHtkaXJlY3RTb2NrZXRIb3N0fSAoc2VydmVyKVxcbmAgK1xuICAgICAgICAgICAgJ0NoZWNrIG91dCB5b3VyIFZpdGUgLyBuZXR3b3JrIGNvbmZpZ3VyYXRpb24gYW5kIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvc2VydmVyLW9wdGlvbnMuaHRtbCNzZXJ2ZXItaG1yIC4nLFxuICAgICAgICApXG4gICAgICB9KVxuICAgICAgc29ja2V0LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAgICdvcGVuJyxcbiAgICAgICAgKCkgPT4ge1xuICAgICAgICAgIGNvbnNvbGUuaW5mbyhcbiAgICAgICAgICAgICdbdml0ZV0gRGlyZWN0IHdlYnNvY2tldCBjb25uZWN0aW9uIGZhbGxiYWNrLiBDaGVjayBvdXQgaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9zZXJ2ZXItb3B0aW9ucy5odG1sI3NlcnZlci1obXIgdG8gcmVtb3ZlIHRoZSBwcmV2aW91cyBjb25uZWN0aW9uIGVycm9yLicsXG4gICAgICAgICAgKVxuICAgICAgICB9LFxuICAgICAgICB7IG9uY2U6IHRydWUgfSxcbiAgICAgIClcbiAgICB9XG4gIH1cblxuICBzb2NrZXQgPSBzZXR1cFdlYlNvY2tldChzb2NrZXRQcm90b2NvbCwgc29ja2V0SG9zdCwgZmFsbGJhY2spXG59IGNhdGNoIChlcnJvcikge1xuICBjb25zb2xlLmVycm9yKGBbdml0ZV0gZmFpbGVkIHRvIGNvbm5lY3QgdG8gd2Vic29ja2V0ICgke2Vycm9yfSkuIGApXG59XG5cbmZ1bmN0aW9uIHNldHVwV2ViU29ja2V0KFxuICBwcm90b2NvbDogc3RyaW5nLFxuICBob3N0QW5kUGF0aDogc3RyaW5nLFxuICBvbkNsb3NlV2l0aG91dE9wZW4/OiAoKSA9PiB2b2lkLFxuKSB7XG4gIGNvbnN0IHNvY2tldCA9IG5ldyBXZWJTb2NrZXQoYCR7cHJvdG9jb2x9Oi8vJHtob3N0QW5kUGF0aH1gLCAndml0ZS1obXInKVxuICBsZXQgaXNPcGVuZWQgPSBmYWxzZVxuXG4gIHNvY2tldC5hZGRFdmVudExpc3RlbmVyKFxuICAgICdvcGVuJyxcbiAgICAoKSA9PiB7XG4gICAgICBpc09wZW5lZCA9IHRydWVcbiAgICAgIG5vdGlmeUxpc3RlbmVycygndml0ZTp3czpjb25uZWN0JywgeyB3ZWJTb2NrZXQ6IHNvY2tldCB9KVxuICAgIH0sXG4gICAgeyBvbmNlOiB0cnVlIH0sXG4gIClcblxuICAvLyBMaXN0ZW4gZm9yIG1lc3NhZ2VzXG4gIHNvY2tldC5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgYXN5bmMgKHsgZGF0YSB9KSA9PiB7XG4gICAgaGFuZGxlTWVzc2FnZShKU09OLnBhcnNlKGRhdGEpKVxuICB9KVxuXG4gIC8vIHBpbmcgc2VydmVyXG4gIHNvY2tldC5hZGRFdmVudExpc3RlbmVyKCdjbG9zZScsIGFzeW5jICh7IHdhc0NsZWFuIH0pID0+IHtcbiAgICBpZiAod2FzQ2xlYW4pIHJldHVyblxuXG4gICAgaWYgKCFpc09wZW5lZCAmJiBvbkNsb3NlV2l0aG91dE9wZW4pIHtcbiAgICAgIG9uQ2xvc2VXaXRob3V0T3BlbigpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBub3RpZnlMaXN0ZW5lcnMoJ3ZpdGU6d3M6ZGlzY29ubmVjdCcsIHsgd2ViU29ja2V0OiBzb2NrZXQgfSlcblxuICAgIGNvbnNvbGUubG9nKGBbdml0ZV0gc2VydmVyIGNvbm5lY3Rpb24gbG9zdC4gcG9sbGluZyBmb3IgcmVzdGFydC4uLmApXG4gICAgYXdhaXQgd2FpdEZvclN1Y2Nlc3NmdWxQaW5nKHByb3RvY29sLCBob3N0QW5kUGF0aClcbiAgICBsb2NhdGlvbi5yZWxvYWQoKVxuICB9KVxuXG4gIHJldHVybiBzb2NrZXRcbn1cblxuZnVuY3Rpb24gY2xlYW5VcmwocGF0aG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHVybCA9IG5ldyBVUkwocGF0aG5hbWUsICdodHRwOi8vdml0ZWpzLmRldicpXG4gIHVybC5zZWFyY2hQYXJhbXMuZGVsZXRlKCdkaXJlY3QnKVxuICByZXR1cm4gdXJsLnBhdGhuYW1lICsgdXJsLnNlYXJjaFxufVxuXG5sZXQgaXNGaXJzdFVwZGF0ZSA9IHRydWVcbmNvbnN0IG91dGRhdGVkTGlua1RhZ3MgPSBuZXcgV2Vha1NldDxIVE1MTGlua0VsZW1lbnQ+KClcblxuY29uc3QgZGVib3VuY2VSZWxvYWQgPSAodGltZTogbnVtYmVyKSA9PiB7XG4gIGxldCB0aW1lcjogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCBudWxsXG4gIHJldHVybiAoKSA9PiB7XG4gICAgaWYgKHRpbWVyKSB7XG4gICAgICBjbGVhclRpbWVvdXQodGltZXIpXG4gICAgICB0aW1lciA9IG51bGxcbiAgICB9XG4gICAgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGxvY2F0aW9uLnJlbG9hZCgpXG4gICAgfSwgdGltZSlcbiAgfVxufVxuY29uc3QgcGFnZVJlbG9hZCA9IGRlYm91bmNlUmVsb2FkKDUwKVxuXG5jb25zdCBobXJDbGllbnQgPSBuZXcgSE1SQ2xpZW50KFxuICBjb25zb2xlLFxuICB7XG4gICAgaXNSZWFkeTogKCkgPT4gc29ja2V0ICYmIHNvY2tldC5yZWFkeVN0YXRlID09PSAxLFxuICAgIHNlbmQ6IChtZXNzYWdlKSA9PiBzb2NrZXQuc2VuZChtZXNzYWdlKSxcbiAgfSxcbiAgYXN5bmMgZnVuY3Rpb24gaW1wb3J0VXBkYXRlZE1vZHVsZSh7XG4gICAgYWNjZXB0ZWRQYXRoLFxuICAgIHRpbWVzdGFtcCxcbiAgICBleHBsaWNpdEltcG9ydFJlcXVpcmVkLFxuICAgIGlzV2l0aGluQ2lyY3VsYXJJbXBvcnQsXG4gIH0pIHtcbiAgICBjb25zdCBbYWNjZXB0ZWRQYXRoV2l0aG91dFF1ZXJ5LCBxdWVyeV0gPSBhY2NlcHRlZFBhdGguc3BsaXQoYD9gKVxuICAgIGNvbnN0IGltcG9ydFByb21pc2UgPSBpbXBvcnQoXG4gICAgICAvKiBAdml0ZS1pZ25vcmUgKi9cbiAgICAgIGJhc2UgK1xuICAgICAgICBhY2NlcHRlZFBhdGhXaXRob3V0UXVlcnkuc2xpY2UoMSkgK1xuICAgICAgICBgPyR7ZXhwbGljaXRJbXBvcnRSZXF1aXJlZCA/ICdpbXBvcnQmJyA6ICcnfXQ9JHt0aW1lc3RhbXB9JHtcbiAgICAgICAgICBxdWVyeSA/IGAmJHtxdWVyeX1gIDogJydcbiAgICAgICAgfWBcbiAgICApXG4gICAgaWYgKGlzV2l0aGluQ2lyY3VsYXJJbXBvcnQpIHtcbiAgICAgIGltcG9ydFByb21pc2UuY2F0Y2goKCkgPT4ge1xuICAgICAgICBjb25zb2xlLmluZm8oXG4gICAgICAgICAgYFtobXJdICR7YWNjZXB0ZWRQYXRofSBmYWlsZWQgdG8gYXBwbHkgSE1SIGFzIGl0J3Mgd2l0aGluIGEgY2lyY3VsYXIgaW1wb3J0LiBSZWxvYWRpbmcgcGFnZSB0byByZXNldCB0aGUgZXhlY3V0aW9uIG9yZGVyLiBgICtcbiAgICAgICAgICAgIGBUbyBkZWJ1ZyBhbmQgYnJlYWsgdGhlIGNpcmN1bGFyIGltcG9ydCwgeW91IGNhbiBydW4gXFxgdml0ZSAtLWRlYnVnIGhtclxcYCB0byBsb2cgdGhlIGNpcmN1bGFyIGRlcGVuZGVuY3kgcGF0aCBpZiBhIGZpbGUgY2hhbmdlIHRyaWdnZXJlZCBpdC5gLFxuICAgICAgICApXG4gICAgICAgIHBhZ2VSZWxvYWQoKVxuICAgICAgfSlcbiAgICB9XG4gICAgcmV0dXJuIGF3YWl0IGltcG9ydFByb21pc2VcbiAgfSxcbilcblxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlTWVzc2FnZShwYXlsb2FkOiBITVJQYXlsb2FkKSB7XG4gIHN3aXRjaCAocGF5bG9hZC50eXBlKSB7XG4gICAgY2FzZSAnY29ubmVjdGVkJzpcbiAgICAgIGNvbnNvbGUuZGVidWcoYFt2aXRlXSBjb25uZWN0ZWQuYClcbiAgICAgIGhtckNsaWVudC5tZXNzZW5nZXIuZmx1c2goKVxuICAgICAgLy8gcHJveHkobmdpbngsIGRvY2tlcikgaG1yIHdzIG1heWJlIGNhdXNlZCB0aW1lb3V0LFxuICAgICAgLy8gc28gc2VuZCBwaW5nIHBhY2thZ2UgbGV0IHdzIGtlZXAgYWxpdmUuXG4gICAgICBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGlmIChzb2NrZXQucmVhZHlTdGF0ZSA9PT0gc29ja2V0Lk9QRU4pIHtcbiAgICAgICAgICBzb2NrZXQuc2VuZCgne1widHlwZVwiOlwicGluZ1wifScpXG4gICAgICAgIH1cbiAgICAgIH0sIF9fSE1SX1RJTUVPVVRfXylcbiAgICAgIGJyZWFrXG4gICAgY2FzZSAndXBkYXRlJzpcbiAgICAgIG5vdGlmeUxpc3RlbmVycygndml0ZTpiZWZvcmVVcGRhdGUnLCBwYXlsb2FkKVxuICAgICAgLy8gaWYgdGhpcyBpcyB0aGUgZmlyc3QgdXBkYXRlIGFuZCB0aGVyZSdzIGFscmVhZHkgYW4gZXJyb3Igb3ZlcmxheSwgaXRcbiAgICAgIC8vIG1lYW5zIHRoZSBwYWdlIG9wZW5lZCB3aXRoIGV4aXN0aW5nIHNlcnZlciBjb21waWxlIGVycm9yIGFuZCB0aGUgd2hvbGVcbiAgICAgIC8vIG1vZHVsZSBzY3JpcHQgZmFpbGVkIHRvIGxvYWQgKHNpbmNlIG9uZSBvZiB0aGUgbmVzdGVkIGltcG9ydHMgaXMgNTAwKS5cbiAgICAgIC8vIGluIHRoaXMgY2FzZSBhIG5vcm1hbCB1cGRhdGUgd29uJ3Qgd29yayBhbmQgYSBmdWxsIHJlbG9hZCBpcyBuZWVkZWQuXG4gICAgICBpZiAoaXNGaXJzdFVwZGF0ZSAmJiBoYXNFcnJvck92ZXJsYXkoKSkge1xuICAgICAgICB3aW5kb3cubG9jYXRpb24ucmVsb2FkKClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjbGVhckVycm9yT3ZlcmxheSgpXG4gICAgICAgIGlzRmlyc3RVcGRhdGUgPSBmYWxzZVxuICAgICAgfVxuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgIHBheWxvYWQudXBkYXRlcy5tYXAoYXN5bmMgKHVwZGF0ZSk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgICAgIGlmICh1cGRhdGUudHlwZSA9PT0gJ2pzLXVwZGF0ZScpIHtcbiAgICAgICAgICAgIHJldHVybiBobXJDbGllbnQucXVldWVVcGRhdGUodXBkYXRlKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIGNzcy11cGRhdGVcbiAgICAgICAgICAvLyB0aGlzIGlzIG9ubHkgc2VudCB3aGVuIGEgY3NzIGZpbGUgcmVmZXJlbmNlZCB3aXRoIDxsaW5rPiBpcyB1cGRhdGVkXG4gICAgICAgICAgY29uc3QgeyBwYXRoLCB0aW1lc3RhbXAgfSA9IHVwZGF0ZVxuICAgICAgICAgIGNvbnN0IHNlYXJjaFVybCA9IGNsZWFuVXJsKHBhdGgpXG4gICAgICAgICAgLy8gY2FuJ3QgdXNlIHF1ZXJ5U2VsZWN0b3Igd2l0aCBgW2hyZWYqPV1gIGhlcmUgc2luY2UgdGhlIGxpbmsgbWF5IGJlXG4gICAgICAgICAgLy8gdXNpbmcgcmVsYXRpdmUgcGF0aHMgc28gd2UgbmVlZCB0byB1c2UgbGluay5ocmVmIHRvIGdyYWIgdGhlIGZ1bGxcbiAgICAgICAgICAvLyBVUkwgZm9yIHRoZSBpbmNsdWRlIGNoZWNrLlxuICAgICAgICAgIGNvbnN0IGVsID0gQXJyYXkuZnJvbShcbiAgICAgICAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTExpbmtFbGVtZW50PignbGluaycpLFxuICAgICAgICAgICkuZmluZChcbiAgICAgICAgICAgIChlKSA9PlxuICAgICAgICAgICAgICAhb3V0ZGF0ZWRMaW5rVGFncy5oYXMoZSkgJiYgY2xlYW5VcmwoZS5ocmVmKS5pbmNsdWRlcyhzZWFyY2hVcmwpLFxuICAgICAgICAgIClcblxuICAgICAgICAgIGlmICghZWwpIHtcbiAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IG5ld1BhdGggPSBgJHtiYXNlfSR7c2VhcmNoVXJsLnNsaWNlKDEpfSR7XG4gICAgICAgICAgICBzZWFyY2hVcmwuaW5jbHVkZXMoJz8nKSA/ICcmJyA6ICc/J1xuICAgICAgICAgIH10PSR7dGltZXN0YW1wfWBcblxuICAgICAgICAgIC8vIHJhdGhlciB0aGFuIHN3YXBwaW5nIHRoZSBocmVmIG9uIHRoZSBleGlzdGluZyB0YWcsIHdlIHdpbGxcbiAgICAgICAgICAvLyBjcmVhdGUgYSBuZXcgbGluayB0YWcuIE9uY2UgdGhlIG5ldyBzdHlsZXNoZWV0IGhhcyBsb2FkZWQgd2VcbiAgICAgICAgICAvLyB3aWxsIHJlbW92ZSB0aGUgZXhpc3RpbmcgbGluayB0YWcuIFRoaXMgcmVtb3ZlcyBhIEZsYXNoIE9mXG4gICAgICAgICAgLy8gVW5zdHlsZWQgQ29udGVudCB0aGF0IGNhbiBvY2N1ciB3aGVuIHN3YXBwaW5nIG91dCB0aGUgdGFnIGhyZWZcbiAgICAgICAgICAvLyBkaXJlY3RseSwgYXMgdGhlIG5ldyBzdHlsZXNoZWV0IGhhcyBub3QgeWV0IGJlZW4gbG9hZGVkLlxuICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xuICAgICAgICAgICAgY29uc3QgbmV3TGlua1RhZyA9IGVsLmNsb25lTm9kZSgpIGFzIEhUTUxMaW5rRWxlbWVudFxuICAgICAgICAgICAgbmV3TGlua1RhZy5ocmVmID0gbmV3IFVSTChuZXdQYXRoLCBlbC5ocmVmKS5ocmVmXG4gICAgICAgICAgICBjb25zdCByZW1vdmVPbGRFbCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgZWwucmVtb3ZlKClcbiAgICAgICAgICAgICAgY29uc29sZS5kZWJ1ZyhgW3ZpdGVdIGNzcyBob3QgdXBkYXRlZDogJHtzZWFyY2hVcmx9YClcbiAgICAgICAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBuZXdMaW5rVGFnLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCByZW1vdmVPbGRFbClcbiAgICAgICAgICAgIG5ld0xpbmtUYWcuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCByZW1vdmVPbGRFbClcbiAgICAgICAgICAgIG91dGRhdGVkTGlua1RhZ3MuYWRkKGVsKVxuICAgICAgICAgICAgZWwuYWZ0ZXIobmV3TGlua1RhZylcbiAgICAgICAgICB9KVxuICAgICAgICB9KSxcbiAgICAgIClcbiAgICAgIG5vdGlmeUxpc3RlbmVycygndml0ZTphZnRlclVwZGF0ZScsIHBheWxvYWQpXG4gICAgICBicmVha1xuICAgIGNhc2UgJ2N1c3RvbSc6IHtcbiAgICAgIG5vdGlmeUxpc3RlbmVycyhwYXlsb2FkLmV2ZW50LCBwYXlsb2FkLmRhdGEpXG4gICAgICBicmVha1xuICAgIH1cbiAgICBjYXNlICdmdWxsLXJlbG9hZCc6XG4gICAgICBub3RpZnlMaXN0ZW5lcnMoJ3ZpdGU6YmVmb3JlRnVsbFJlbG9hZCcsIHBheWxvYWQpXG4gICAgICBpZiAocGF5bG9hZC5wYXRoICYmIHBheWxvYWQucGF0aC5lbmRzV2l0aCgnLmh0bWwnKSkge1xuICAgICAgICAvLyBpZiBodG1sIGZpbGUgaXMgZWRpdGVkLCBvbmx5IHJlbG9hZCB0aGUgcGFnZSBpZiB0aGUgYnJvd3NlciBpc1xuICAgICAgICAvLyBjdXJyZW50bHkgb24gdGhhdCBwYWdlLlxuICAgICAgICBjb25zdCBwYWdlUGF0aCA9IGRlY29kZVVSSShsb2NhdGlvbi5wYXRobmFtZSlcbiAgICAgICAgY29uc3QgcGF5bG9hZFBhdGggPSBiYXNlICsgcGF5bG9hZC5wYXRoLnNsaWNlKDEpXG4gICAgICAgIGlmIChcbiAgICAgICAgICBwYWdlUGF0aCA9PT0gcGF5bG9hZFBhdGggfHxcbiAgICAgICAgICBwYXlsb2FkLnBhdGggPT09ICcvaW5kZXguaHRtbCcgfHxcbiAgICAgICAgICAocGFnZVBhdGguZW5kc1dpdGgoJy8nKSAmJiBwYWdlUGF0aCArICdpbmRleC5odG1sJyA9PT0gcGF5bG9hZFBhdGgpXG4gICAgICAgICkge1xuICAgICAgICAgIHBhZ2VSZWxvYWQoKVxuICAgICAgICB9XG4gICAgICAgIHJldHVyblxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcGFnZVJlbG9hZCgpXG4gICAgICB9XG4gICAgICBicmVha1xuICAgIGNhc2UgJ3BydW5lJzpcbiAgICAgIG5vdGlmeUxpc3RlbmVycygndml0ZTpiZWZvcmVQcnVuZScsIHBheWxvYWQpXG4gICAgICBhd2FpdCBobXJDbGllbnQucHJ1bmVQYXRocyhwYXlsb2FkLnBhdGhzKVxuICAgICAgYnJlYWtcbiAgICBjYXNlICdlcnJvcic6IHtcbiAgICAgIG5vdGlmeUxpc3RlbmVycygndml0ZTplcnJvcicsIHBheWxvYWQpXG4gICAgICBjb25zdCBlcnIgPSBwYXlsb2FkLmVyclxuICAgICAgaWYgKGVuYWJsZU92ZXJsYXkpIHtcbiAgICAgICAgY3JlYXRlRXJyb3JPdmVybGF5KGVycilcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgYFt2aXRlXSBJbnRlcm5hbCBTZXJ2ZXIgRXJyb3JcXG4ke2Vyci5tZXNzYWdlfVxcbiR7ZXJyLnN0YWNrfWAsXG4gICAgICAgIClcbiAgICAgIH1cbiAgICAgIGJyZWFrXG4gICAgfVxuICAgIGRlZmF1bHQ6IHtcbiAgICAgIGNvbnN0IGNoZWNrOiBuZXZlciA9IHBheWxvYWRcbiAgICAgIHJldHVybiBjaGVja1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBub3RpZnlMaXN0ZW5lcnM8VCBleHRlbmRzIHN0cmluZz4oXG4gIGV2ZW50OiBULFxuICBkYXRhOiBJbmZlckN1c3RvbUV2ZW50UGF5bG9hZDxUPixcbik6IHZvaWRcbmZ1bmN0aW9uIG5vdGlmeUxpc3RlbmVycyhldmVudDogc3RyaW5nLCBkYXRhOiBhbnkpOiB2b2lkIHtcbiAgaG1yQ2xpZW50Lm5vdGlmeUxpc3RlbmVycyhldmVudCwgZGF0YSlcbn1cblxuY29uc3QgZW5hYmxlT3ZlcmxheSA9IF9fSE1SX0VOQUJMRV9PVkVSTEFZX19cblxuZnVuY3Rpb24gY3JlYXRlRXJyb3JPdmVybGF5KGVycjogRXJyb3JQYXlsb2FkWydlcnInXSkge1xuICBjbGVhckVycm9yT3ZlcmxheSgpXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobmV3IEVycm9yT3ZlcmxheShlcnIpKVxufVxuXG5mdW5jdGlvbiBjbGVhckVycm9yT3ZlcmxheSgpIHtcbiAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxFcnJvck92ZXJsYXk+KG92ZXJsYXlJZCkuZm9yRWFjaCgobikgPT4gbi5jbG9zZSgpKVxufVxuXG5mdW5jdGlvbiBoYXNFcnJvck92ZXJsYXkoKSB7XG4gIHJldHVybiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKG92ZXJsYXlJZCkubGVuZ3RoXG59XG5cbmFzeW5jIGZ1bmN0aW9uIHdhaXRGb3JTdWNjZXNzZnVsUGluZyhcbiAgc29ja2V0UHJvdG9jb2w6IHN0cmluZyxcbiAgaG9zdEFuZFBhdGg6IHN0cmluZyxcbiAgbXMgPSAxMDAwLFxuKSB7XG4gIGNvbnN0IHBpbmdIb3N0UHJvdG9jb2wgPSBzb2NrZXRQcm90b2NvbCA9PT0gJ3dzcycgPyAnaHR0cHMnIDogJ2h0dHAnXG5cbiAgY29uc3QgcGluZyA9IGFzeW5jICgpID0+IHtcbiAgICAvLyBBIGZldGNoIG9uIGEgd2Vic29ja2V0IFVSTCB3aWxsIHJldHVybiBhIHN1Y2Nlc3NmdWwgcHJvbWlzZSB3aXRoIHN0YXR1cyA0MDAsXG4gICAgLy8gYnV0IHdpbGwgcmVqZWN0IGEgbmV0d29ya2luZyBlcnJvci5cbiAgICAvLyBXaGVuIHJ1bm5pbmcgb24gbWlkZGxld2FyZSBtb2RlLCBpdCByZXR1cm5zIHN0YXR1cyA0MjYsIGFuZCBhbiBjb3JzIGVycm9yIGhhcHBlbnMgaWYgbW9kZSBpcyBub3Qgbm8tY29yc1xuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmZXRjaChgJHtwaW5nSG9zdFByb3RvY29sfTovLyR7aG9zdEFuZFBhdGh9YCwge1xuICAgICAgICBtb2RlOiAnbm8tY29ycycsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAvLyBDdXN0b20gaGVhZGVycyB3b24ndCBiZSBpbmNsdWRlZCBpbiBhIHJlcXVlc3Qgd2l0aCBuby1jb3JzIHNvIChhYil1c2Ugb25lIG9mIHRoZVxuICAgICAgICAgIC8vIHNhZmVsaXN0ZWQgaGVhZGVycyB0byBpZGVudGlmeSB0aGUgcGluZyByZXF1ZXN0XG4gICAgICAgICAgQWNjZXB0OiAndGV4dC94LXZpdGUtcGluZycsXG4gICAgICAgIH0sXG4gICAgICB9KVxuICAgICAgcmV0dXJuIHRydWVcbiAgICB9IGNhdGNoIHt9XG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICBpZiAoYXdhaXQgcGluZygpKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgYXdhaXQgd2FpdChtcylcblxuICAvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tY29uc3RhbnQtY29uZGl0aW9uXG4gIHdoaWxlICh0cnVlKSB7XG4gICAgaWYgKGRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZSA9PT0gJ3Zpc2libGUnKSB7XG4gICAgICBpZiAoYXdhaXQgcGluZygpKSB7XG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgICBhd2FpdCB3YWl0KG1zKVxuICAgIH0gZWxzZSB7XG4gICAgICBhd2FpdCB3YWl0Rm9yV2luZG93U2hvdygpXG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHdhaXQobXM6IG51bWJlcikge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUpID0+IHNldFRpbWVvdXQocmVzb2x2ZSwgbXMpKVxufVxuXG5mdW5jdGlvbiB3YWl0Rm9yV2luZG93U2hvdygpIHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgY29uc3Qgb25DaGFuZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoZG9jdW1lbnQudmlzaWJpbGl0eVN0YXRlID09PSAndmlzaWJsZScpIHtcbiAgICAgICAgcmVzb2x2ZSgpXG4gICAgICAgIGRvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3Zpc2liaWxpdHljaGFuZ2UnLCBvbkNoYW5nZSlcbiAgICAgIH1cbiAgICB9XG4gICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigndmlzaWJpbGl0eWNoYW5nZScsIG9uQ2hhbmdlKVxuICB9KVxufVxuXG5jb25zdCBzaGVldHNNYXAgPSBuZXcgTWFwPHN0cmluZywgSFRNTFN0eWxlRWxlbWVudD4oKVxuXG4vLyBjb2xsZWN0IGV4aXN0aW5nIHN0eWxlIGVsZW1lbnRzIHRoYXQgbWF5IGhhdmUgYmVlbiBpbnNlcnRlZCBkdXJpbmcgU1NSXG4vLyB0byBhdm9pZCBGT1VDIG9yIGR1cGxpY2F0ZSBzdHlsZXNcbmlmICgnZG9jdW1lbnQnIGluIGdsb2JhbFRoaXMpIHtcbiAgZG9jdW1lbnRcbiAgICAucXVlcnlTZWxlY3RvckFsbDxIVE1MU3R5bGVFbGVtZW50Pignc3R5bGVbZGF0YS12aXRlLWRldi1pZF0nKVxuICAgIC5mb3JFYWNoKChlbCkgPT4ge1xuICAgICAgc2hlZXRzTWFwLnNldChlbC5nZXRBdHRyaWJ1dGUoJ2RhdGEtdml0ZS1kZXYtaWQnKSEsIGVsKVxuICAgIH0pXG59XG5cbmNvbnN0IGNzcE5vbmNlID1cbiAgJ2RvY3VtZW50JyBpbiBnbG9iYWxUaGlzXG4gICAgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxNZXRhRWxlbWVudD4oJ21ldGFbcHJvcGVydHk9Y3NwLW5vbmNlXScpPy5ub25jZVxuICAgIDogdW5kZWZpbmVkXG5cbi8vIGFsbCBjc3MgaW1wb3J0cyBzaG91bGQgYmUgaW5zZXJ0ZWQgYXQgdGhlIHNhbWUgcG9zaXRpb25cbi8vIGJlY2F1c2UgYWZ0ZXIgYnVpbGQgaXQgd2lsbCBiZSBhIHNpbmdsZSBjc3MgZmlsZVxubGV0IGxhc3RJbnNlcnRlZFN0eWxlOiBIVE1MU3R5bGVFbGVtZW50IHwgdW5kZWZpbmVkXG5cbmV4cG9ydCBmdW5jdGlvbiB1cGRhdGVTdHlsZShpZDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiB2b2lkIHtcbiAgbGV0IHN0eWxlID0gc2hlZXRzTWFwLmdldChpZClcbiAgaWYgKCFzdHlsZSkge1xuICAgIHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKVxuICAgIHN0eWxlLnNldEF0dHJpYnV0ZSgndHlwZScsICd0ZXh0L2NzcycpXG4gICAgc3R5bGUuc2V0QXR0cmlidXRlKCdkYXRhLXZpdGUtZGV2LWlkJywgaWQpXG4gICAgc3R5bGUudGV4dENvbnRlbnQgPSBjb250ZW50XG4gICAgaWYgKGNzcE5vbmNlKSB7XG4gICAgICBzdHlsZS5zZXRBdHRyaWJ1dGUoJ25vbmNlJywgY3NwTm9uY2UpXG4gICAgfVxuXG4gICAgaWYgKCFsYXN0SW5zZXJ0ZWRTdHlsZSkge1xuICAgICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZSlcblxuICAgICAgLy8gcmVzZXQgbGFzdEluc2VydGVkU3R5bGUgYWZ0ZXIgYXN5bmNcbiAgICAgIC8vIGJlY2F1c2UgZHluYW1pY2FsbHkgaW1wb3J0ZWQgY3NzIHdpbGwgYmUgc3BsaXR0ZWQgaW50byBhIGRpZmZlcmVudCBmaWxlXG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgbGFzdEluc2VydGVkU3R5bGUgPSB1bmRlZmluZWRcbiAgICAgIH0sIDApXG4gICAgfSBlbHNlIHtcbiAgICAgIGxhc3RJbnNlcnRlZFN0eWxlLmluc2VydEFkamFjZW50RWxlbWVudCgnYWZ0ZXJlbmQnLCBzdHlsZSlcbiAgICB9XG4gICAgbGFzdEluc2VydGVkU3R5bGUgPSBzdHlsZVxuICB9IGVsc2Uge1xuICAgIHN0eWxlLnRleHRDb250ZW50ID0gY29udGVudFxuICB9XG4gIHNoZWV0c01hcC5zZXQoaWQsIHN0eWxlKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVtb3ZlU3R5bGUoaWQ6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCBzdHlsZSA9IHNoZWV0c01hcC5nZXQoaWQpXG4gIGlmIChzdHlsZSkge1xuICAgIGRvY3VtZW50LmhlYWQucmVtb3ZlQ2hpbGQoc3R5bGUpXG4gICAgc2hlZXRzTWFwLmRlbGV0ZShpZClcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlSG90Q29udGV4dChvd25lclBhdGg6IHN0cmluZyk6IFZpdGVIb3RDb250ZXh0IHtcbiAgcmV0dXJuIG5ldyBITVJDb250ZXh0KGhtckNsaWVudCwgb3duZXJQYXRoKVxufVxuXG4vKipcbiAqIHVybHMgaGVyZSBhcmUgZHluYW1pYyBpbXBvcnQoKSB1cmxzIHRoYXQgY291bGRuJ3QgYmUgc3RhdGljYWxseSBhbmFseXplZFxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5qZWN0UXVlcnkodXJsOiBzdHJpbmcsIHF1ZXJ5VG9JbmplY3Q6IHN0cmluZyk6IHN0cmluZyB7XG4gIC8vIHNraXAgdXJscyB0aGF0IHdvbid0IGJlIGhhbmRsZWQgYnkgdml0ZVxuICBpZiAodXJsWzBdICE9PSAnLicgJiYgdXJsWzBdICE9PSAnLycpIHtcbiAgICByZXR1cm4gdXJsXG4gIH1cblxuICAvLyBjYW4ndCB1c2UgcGF0aG5hbWUgZnJvbSBVUkwgc2luY2UgaXQgbWF5IGJlIHJlbGF0aXZlIGxpa2UgLi4vXG4gIGNvbnN0IHBhdGhuYW1lID0gdXJsLnJlcGxhY2UoL1s/I10uKiQvLCAnJylcbiAgY29uc3QgeyBzZWFyY2gsIGhhc2ggfSA9IG5ldyBVUkwodXJsLCAnaHR0cDovL3ZpdGVqcy5kZXYnKVxuXG4gIHJldHVybiBgJHtwYXRobmFtZX0/JHtxdWVyeVRvSW5qZWN0fSR7c2VhcmNoID8gYCZgICsgc2VhcmNoLnNsaWNlKDEpIDogJyd9JHtcbiAgICBoYXNoIHx8ICcnXG4gIH1gXG59XG5cbmV4cG9ydCB7IEVycm9yT3ZlcmxheSB9XG4iXSwibmFtZXMiOlsiYmFzZSJdLCJtYXBwaW5ncyI6Ijs7TUFpQ2Es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QUFpQixHQUFHLFNBQVMsQ0FBQTthQUM5QixFQUFFLENBQUMsQ0FBQyxDQUFBO0FBQ04sU0FBQTtBQUFNLGFBQUE7QUFDTCxZQUFBLGlCQUFpQixDQUFDLHFCQUFxQixDQUFDLFVBQVUsRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUMzRCxTQUFBO1FBQ0QsaUJBQWlCLEdBQUcsS0FBSyxDQUFBO0FBQzFCLEtBQUE7QUFBTSxTQUFBO0FBQ0wsUUFBQSxLQUFLLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQTtBQUM1QixLQUFBO0FBQ0QsSUFBQSxTQUFTLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQTtBQUMxQixDQUFDO0FBRUssU0FBVSxXQUFXLENBQUMsRUFBVSxFQUFBO0lBQ3BDLE1BQU0sS0FBSyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUE7QUFDL0IsSUFBQSxJQUFJLEtBQUssRUFBRTtBQUNULFFBQUEsUUFBUSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUE7QUFDaEMsUUFBQSxTQUFTLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxDQUFBO0FBQ3JCLEtBQUE7QUFDSCxDQUFDO0FBRUssU0FBVSxnQkFBZ0IsQ0FBQyxTQUFpQixFQUFBO0FBQ2hELElBQUEsT0FBTyxJQUFJLFVBQVUsQ0FBQyxTQUFTLEVBQUUsU0FBUyxDQUFDLENBQUE7QUFDN0MsQ0FBQztBQUVEOztBQUVHO0FBQ2EsU0FBQSxXQUFXLENBQUMsR0FBVyxFQUFFLGFBQXFCLEVBQUE7O0FBRTVELElBQUEsSUFBSSxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLEVBQUU7QUFDcEMsUUFBQSxPQUFPLEdBQUcsQ0FBQTtBQUNYLEtBQUE7O0lBR0QsTUFBTSxRQUFRLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUE7QUFDM0MsSUFBQSxNQUFNLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxHQUFHLElBQUksR0FBRyxDQUFDLEdBQUcsRUFBRSxtQkFBbUIsQ0FBQyxDQUFBO0lBRTFELE9BQU8sQ0FBQSxFQUFHLFFBQVEsQ0FBQSxDQUFBLEVBQUksYUFBYSxDQUFBLEVBQUcsTUFBTSxHQUFHLENBQUcsQ0FBQSxDQUFBLEdBQUcsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUEsRUFDdkUsSUFBSSxJQUFJLEVBQ1YsQ0FBQSxDQUFFLENBQUE7QUFDSjs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwxLDJdfQ==