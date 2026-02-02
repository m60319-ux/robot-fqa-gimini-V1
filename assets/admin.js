// assets/admin.js - Final Fixed Complete Version with Debug Logs
let currentMode = 'local';
let currentData = null;
let currentVarName = "FAQ_DATA_ZH";
let currentLang = "zh";
let activeNode = null;
let activeParent = null;
let localHandle = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Admin] DOM Loaded. Initializing...");
    try {
        loadGhConfig();
        console.log("[Admin] Config loaded.");
    } catch (e) {
        console.error("[Admin] Error loading config:", e);
    }

    const pasteAreas = document.querySelectorAll('.paste-area');
    console.log(`[Admin] Found ${pasteAreas.length} paste areas.`);
    pasteAreas.forEach(area => {
        area.addEventListener('paste', handleImagePaste);
    });
});

// --- 模式與設定 ---
function switchMode(mode) {
    console.log(`[Admin] Switching mode to: ${mode}`);
    currentMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
    
    const idx = mode === 'local' ? 0 : 1;
    const tabBtns = document.querySelectorAll('.tab-btn');
    if (tabBtns[idx]) tabBtns[idx].classList.add('active');
    
    const panel = document.getElementById(`panel-${mode}`);
    if (panel) panel.classList.add('active');
    
    const btn = document.getElementById('saveGithubBtn');
    if (btn) {
        btn.innerText = mode === 'local' ? "💾 儲存 (本機硬碟)" : "🚀 儲存並上傳 GitHub";
        btn.className = mode === 'local' ? "btn-green" : "btn-blue";
    }
}

function loadGhConfig() {
    try {
        const confStr = localStorage.getItem('gh_config');
        console.log("[Admin] Loading GH Config from localStorage:", confStr ? "Found" : "Not Found");
        const conf = JSON.parse(confStr);
        if(conf) {
            const tokenEl = document.getElementById('gh_token');
            const userEl = document.getElementById('gh_user');
            const repoEl = document.getElementById('gh_repo');
            if (tokenEl) tokenEl.value = conf.token || '';
            if (userEl) userEl.value = conf.user || '';
            if (repoEl) repoEl.value = conf.repo || '';
        }
    } catch (e) {
        console.error("[Admin] Error parsing GH Config:", e);
    }
}

function saveGhConfig() {
    console.log("[Admin] Saving GH Config...");
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();
    
    if(!token || !user || !repo) {
        console.warn("[Admin] Config missing fields.");
        return alert("請填寫完整資訊");
    }
    
    localStorage.setItem('gh_config', JSON.stringify({token, user, repo}));
    console.log("[Admin] Config saved successfully.");
    alert("設定已儲存");
}

// --- 檔案載入 (Local) ---
async function connectLocalFolder() {
    console.log("[Admin] Connecting to local folder...");
    if (!('showDirectoryPicker' in window)) {
        console.error("[Admin] File System API not supported.");
        return alert("瀏覽器不支援，請用 Chrome/Edge");
    }
    try {
        localHandle = await window.showDirectoryPicker();
        console.log("[Admin] Directory handle obtained:", localHandle.name);
        // 檢查是否包含 assets 資料夾
        await localHandle.getDirectoryHandle('assets'); 
        console.log("[Admin] 'assets' directory verified.");
        
        const statusEl = document.getElementById('local-status');
        if (statusEl) {
            statusEl.innerText = "✅ 已連接";
            statusEl.className = "status-tag status-ok";
            statusEl.style.display = "inline-block";
        }
    } catch(e) { 
        console.error("[Admin] Local connection error:", e);
        alert("連接失敗或選錯資料夾 (需包含 assets): " + e.message); 
    }
}

async function loadLocalFile(lang) {
    console.log(`[Admin] Loading local file for lang: ${lang}`);
    if(!localHandle) {
        console.warn("[Admin] Local handle not set.");
        return alert("請先連接資料夾");
    }
    try {
        currentLang = lang;
        const fileHandle = await localHandle.getDirectoryHandle('assets')
                                          .then(d => d.getDirectoryHandle('data'))
                                          .then(d => d.getFileHandle(`data.${lang}.js`));
        const file = await fileHandle.getFile();
        const text = await file.text();
        console.log("[Admin] File read successfully. Length:", text.length);
        parseAndRender(text);
        alert(`已載入 data.${lang}.js`);
    } catch(e) {
        console.error("[Admin] Load local file error:", e);
        alert("讀取失敗: " + e.message);
    }
}

// --- 檔案載入 (GitHub) --- 
async function loadGithubFile(lang) {
    console.log(`[Admin] Loading GitHub file for lang: ${lang}`);
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();

    if (!token || !user || !repo) {
        console.warn("[Admin] Missing GitHub config.");
        return alert("請先設定 GitHub 資訊");
    }

    currentLang = lang;
    const path = `assets/data/data.${lang}.js`;
    const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
    console.log(`[Admin] Fetching from URL: ${apiUrl}`);

    try {
        const res = await fetch(apiUrl, {
            headers: { 
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        console.log(`[Admin] Fetch response status: ${res.status}`);
        if(!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        
        const data = await res.json();
        // GitHub API 回傳的是 Base64，需解碼 (支援中文)
        // 使用 decodeURIComponent(escape(atob(...))) 處理中文編碼
        const rawContent = atob(data.content.replace(/\n/g, ""));
        const content = decodeURIComponent(escape(rawContent));
        
        console.log("[Admin] Content decoded. Length:", content.length);
        
        parseAndRender(content);
        alert(`✅ 從 GitHub 載入成功 (data.${lang}.js)`);
        
    } catch (e) {
        console.error("[Admin] GitHub load error:", e);
        alert("GitHub 讀取失敗: " + e.message);
    }
}

// --- 儲存邏輯 ---
async function saveData() {
    console.log("[Admin] saveData called. Mode:", currentMode);
    if(!currentData) {
        console.warn("[Admin] No data to save.");
        return alert("沒有資料可存");
    }
    // 轉成 JS 字串
    const str = JSON.stringify(currentData, null, 4);
    const content = `window.${currentVarName} = ${str};`;

    if(currentMode === 'local') {
        saveLocalData(content);
    } else {
        await saveGithubData(content);
    }
}

async function saveLocalData(content) {
    console.log("[Admin] Saving to local file...");
    if(!localHandle) return alert("請先連接資料夾");
    try {
        const fileHandle = await localHandle.getDirectoryHandle('assets')
                                          .then(d => d.getDirectoryHandle('data'))
                                          .then(d => d.getFileHandle(`data.${currentLang}.js`, {create: true}));
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        console.log("[Admin] Local save successful.");
        alert(`✅ 本機存檔成功 (data.${currentLang}.js)`);
    } catch(e) {
        console.error("[Admin] Local save error:", e);
        alert("存檔失敗: " + e.message);
    }
}

async function saveGithubData(content) {
    console.log("[Admin] Saving to GitHub...");
    const saveBtn = document.getElementById('saveGithubBtn');
    
    // ⚠️ 關鍵修正 1: 定義 oldText，避免 ReferenceError
    const oldText = saveBtn.innerText;
    
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();

    if (!token || !user || !repo) {
        console.warn("[Admin] GitHub config missing during save.");
        return alert('請先設定 GitHub！');
    }

    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ 取得 SHA...';

    try {
        const path = `assets/data/data.${currentLang}.js`;
        const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
        const headers = { 
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        };

        // 1. GET SHA (為了更新檔案，必須先取得當前的 SHA)
        console.log(`[Admin] Getting SHA for ${path}`);
        const getRes = await fetch(apiUrl, { headers });
        if(!getRes.ok) {
             // 如果是 404，代表檔案不存在，可能是新建，sha 可以是 null (但PUT通常需要sha如果檔案已存在)
             // 這裡假設檔案應該存在，若不存在則報錯
             console.error(`[Admin] Failed to get SHA. Status: ${getRes.status}`);
             throw new Error("無法取得檔案狀態 (可能檔案不存在或 Repo 設定錯誤)");
        }
        const fileData = await getRes.json();
        const sha = fileData.sha;
        console.log(`[Admin] SHA obtained: ${sha}`);

        // 2. PUT Update
        saveBtn.innerText = '⏳ 上傳中...';
        // 解決中文亂碼的 Base64 編碼
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        
        console.log(`[Admin] Putting new content to ${path}`);
        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Update via Admin Panel',
                content: encodedContent,
                sha: sha // 帶上剛剛拿到的 SHA
            })
        });

        if(!putRes.ok) {
            const errData = await putRes.json();
            console.error("[Admin] PUT failed:", errData);
            throw new Error(`上傳失敗: ${errData.message || putRes.statusText}`);
        }
        
        console.log("[Admin] Upload successful.");
        alert('🎉 成功！GitHub 已更新 (請稍等 1-2 分鐘生效)');

    } catch (e) {
        console.error("[Admin] GitHub save error:", e);
        alert('❌ 錯誤: ' + e.message);
    } finally {
        // ⚠️ 關鍵修正 2: 恢復按鈕文字，這時 oldText 已經有定義了
        saveBtn.disabled = false;
        saveBtn.innerText = oldText;
    }
}

// --- 圖片貼上邏輯 ---
async function handleImagePaste(e) {
    console.log("[Admin] Image paste detected.");
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let blob = null;
    for (let i=0; i<items.length; i++) {
        if (items[i].type.indexOf("image") === 0) { blob = items[i].getAsFile(); break; }
    }
    if(!blob) return;
    
    e.preventDefault();
    if(!confirm("偵測到圖片，確定上傳？")) return;

    const filename = `img_${Date.now()}.png`;
    const path = `assets/images/${filename}`;
    console.log(`[Admin] Processing image: ${filename}`);
    
    if(currentMode === 'local') {
        if(!localHandle) return alert("請先連接資料夾");
        try {
            const imgDir = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('images'));
            const fileHandle = await imgDir.getFileHandle(filename, {create:true});
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            insertText(e.target, `{{img:${path}}}`);
            console.log("[Admin] Local image saved.");
            alert("圖片已存入本機");
        } catch(err) { 
            console.error("[Admin] Local image save error:", err);
            alert("圖片存檔失敗: "+err.message); 
        }
    } else {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            try {
                await uploadImageToGithub(filename, base64);
                insertText(e.target, `{{img:${path}}}`);
                alert("圖片已上傳 GitHub");
            } catch(err) { 
                console.error("[Admin] GitHub image upload error:", err);
                alert("圖片上傳失敗: "+err.message); 
            }
        };
    }
}

async function uploadImageToGithub(filename, base64) {
    console.log(`[Admin] Uploading image to GitHub: ${filename}`);
    const token = document.getElementById('gh_token').value;
    const user = document.getElementById('gh_user').value;
    const repo = document.getElementById('gh_repo').value;
    const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/assets/images/${filename}`;
    
    const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
            message: `Upload ${filename}`,
            content: base64
        })
    });
    if(!res.ok) {
        const errData = await res.json();
        console.error("[Admin] Image upload failed:", errData);
        throw new Error("API Error: " + (errData.message || res.statusText));
    }
    console.log("[Admin] Image upload successful.");
}

function insertText(el, text) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = el.value.substring(0, start) + text + el.value.substring(end);
}

// --- 編輯器邏輯 (UI) ---
function parseAndRender(text) {
    console.log("[Admin] Parsing data...");
    // 解析 JS 檔: window.XXX = { ... };
    const match = text.match(/window\.(\w+)\s*=\s*(\{[\s\S]*\});?/);
    if(match) {
        currentVarName = match[1];
        try {
            currentData = JSON.parse(match[2]);
            console.log(`[Admin] Parsed variable: ${currentVarName}`);
            renderTree();
            
            const editorPanel = document.getElementById('editor-panel');
            if (editorPanel) editorPanel.style.display = 'none';
            
            const welcomeMsg = document.getElementById('welcome-msg');
            if (welcomeMsg) welcomeMsg.style.display = 'none';
        } catch(e) {
            console.error("[Admin] JSON Parse Error:", e);
            alert("資料格式錯誤 (JSON Parse Error)，請檢查檔案內容是否有語法錯誤（例如多餘的逗號）");
        }
    } else {
        console.error("[Admin] Regex match failed.");
        alert("檔案格式不符 (找不到 window.FAQ_DATA_...)");
    }
}

function renderTree() {
    const root = document.getElementById('tree-root');
    root.innerHTML = '';
    if(!currentData.categories) currentData.categories = [];

    currentData.categories.forEach((cat, i) => {
        root.appendChild(createNode(cat, `📁 ${cat.title||cat.id}`, 'cat', currentData.categories, i));
        if(cat.subcategories) {
            cat.subcategories.forEach((sub, j) => {
                root.appendChild(createNode(sub, `　📂 ${sub.title||sub.id}`, 'sub', cat.subcategories, j));
                if(sub.questions) {
                    sub.questions.forEach((q, k) => {
                        root.appendChild(createNode(q, `　　❓ ${q.title||q.id}`, 'q', sub.questions, k));
                    });
                }
            });
        }
    });
}

function createNode(item, label, type, arr, idx) {
    const div = document.createElement('div');
    div.className = 'tree-item';
    if(activeNode === item) div.classList.add('active');
    div.textContent = label;
    div.onclick = (e) => {
        e.stopPropagation();
        loadEditor(item, type, arr, idx);
    };
    return div;
}

function loadEditor(item, type, arr, idx) {
    console.log(`[Admin] Loading editor for ${type}: ${item.id}`);
    activeNode = item;
    activeParent = { array: arr, index: idx };
    
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    renderTree(); 

    document.getElementById('editor-panel').style.display = 'block';
    document.getElementById('node-type').textContent = type.toUpperCase();
    
    document.getElementById('inp-id').value = item.id || '';
    document.getElementById('inp-title').value = item.title || '';
    
    const qDiv = document.getElementById('q-fields');
    if(type === 'q') {
        qDiv.style.display = 'block';
        const c = item.content || {};
        const join = (a) => Array.isArray(a) ? a.join('\n') : (a || "");
        
        document.getElementById('inp-symptoms').value = join(c.symptoms);
        document.getElementById('inp-causes').value = join(c.rootCauses);
        document.getElementById('inp-steps').value = join(c.solutionSteps);
        document.getElementById('inp-notes').value = c.notes || "";
    } else {
        qDiv.style.display = 'none';
    }
}

function applyEdit() {
    console.log("[Admin] Applying edits...");
    if(!activeNode) return;
    activeNode.id = document.getElementById('inp-id').value;
    activeNode.title = document.getElementById('inp-title').value;
    
    if(document.getElementById('q-fields').style.display === 'block') {
        if(!activeNode.content) activeNode.content = {};
        const split = (id) => document.getElementById(id).value.split('\n').filter(x=>x.trim());
        
        activeNode.content.symptoms = split('inp-symptoms');
        activeNode.content.rootCauses = split('inp-causes');
        activeNode.content.solutionSteps = split('inp-steps');
        activeNode.content.notes = document.getElementById('inp-notes').value;
    }
    
    renderTree();
    alert("修改已暫存");
}

function addNode(type) {
    console.log(`[Admin] Adding node type: ${type}`);
    if(!currentData) return alert("請先載入檔案");
    const ts = Date.now().toString().slice(-4);
    
    if(type === 'cat') {
        currentData.categories.push({ id:`CAT-${ts}`, title:"New", subcategories:[] });
    } else if (type === 'sub' && activeNode && activeNode.subcategories) {
        activeNode.subcategories.push({ id:`SUB-${ts}`, title:"New", questions:[] });
    } else if (type === 'q' && activeNode && activeNode.questions) {
        activeNode.questions.push({ id:`Q-${ts}`, title:"New", content:{symptoms:[],rootCauses:[],solutionSteps:[],notes:""} });
    } else {
        return alert("請先選取正確的父層");
    }
    renderTree();
}

function deleteNode() {
    if(!activeNode || !activeParent) return alert("請先選擇項目");
    if(confirm("確定刪除？")) {
        console.log("[Admin] Deleting node.");
        activeParent.array.splice(activeParent.index, 1);
        activeNode = null;
        document.getElementById('editor-panel').style.display = 'none';
        renderTree();
    }
}
