// assets/admin.js - V3.0 Robust Version
let currentMode = 'local';
let currentData = null;
let currentVarName = "FAQ_DATA_ZH";
let currentLang = "zh";
let activeNode = null;
let activeParent = null;
let localHandle = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Admin] DOM Loaded.");
    loadGhConfig();
    document.querySelectorAll('.paste-area').forEach(area => {
        area.addEventListener('paste', handleImagePaste);
    });
});

// --- 工具：強健的 Base64 解碼 (解決中文亂碼) ---
function b64ToUtf8(b64) {
    try {
        const clean = (b64 || "").replace(/\s/g, "");
        const bytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
        return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
        console.error("[Admin] Base64 Decode Error:", e);
        // Fallback
        return decodeURIComponent(escape(atob(b64)));
    }
}

// --- 工具：智慧剝殼 (提取 JSON) ---
function extractJsonPayload(text) {
    if (!text) throw new Error("Empty file content");

    // 去除 BOM 和前後空白
    const t = text.replace(/^\uFEFF/, "").trim();

    // 1. 如果已經是純 JSON
    if (t.startsWith("{") || t.startsWith("[")) {
        return { varName: null, jsonText: t };
    }

    // 2. 嘗試抓取 window.VAR = {...} 或 const/var/let VAR = {...}
    // 支援結尾分號可有可無
    let m = t.match(/(?:window\.|const\s+|var\s+|let\s+)(\w+)\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    
    if (m) {
        return { varName: m[1], jsonText: m[2] };
    }

    // 如果都沒抓到，嘗試直接找第一個 { 到最後一個 }
    const firstBrace = t.indexOf('{');
    const lastBrace = t.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        return { varName: "FAQ_DATA_UNKNOWN", jsonText: t.substring(firstBrace, lastBrace + 1) };
    }

    throw new Error("無法識別檔案格式 (需為 JSON 或 window.VAR = JSON)");
}

// --- 模式與設定 ---
function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
    
    const idx = mode === 'local' ? 0 : 1;
    const tabBtns = document.querySelectorAll('.tab-btn');
    if(tabBtns[idx]) tabBtns[idx].classList.add('active');
    
    const panel = document.getElementById(`panel-${mode}`);
    if(panel) panel.classList.add('active');
    
    const btn = document.getElementById('saveGithubBtn');
    if(btn) {
        btn.innerText = mode === 'local' ? "💾 儲存 (本機硬碟)" : "🚀 儲存並上傳 GitHub";
        btn.className = mode === 'local' ? "btn-green" : "btn-blue";
    }
}

function loadGhConfig() {
    try {
        const conf = JSON.parse(localStorage.getItem('gh_config'));
        if(conf) {
            if(document.getElementById('gh_token')) document.getElementById('gh_token').value = conf.token || '';
            if(document.getElementById('gh_user')) document.getElementById('gh_user').value = conf.user || '';
            if(document.getElementById('gh_repo')) document.getElementById('gh_repo').value = conf.repo || '';
        }
    } catch(e) { console.error("Config load error", e); }
}

function saveGhConfig() {
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();
    if(!token || !user || !repo) return alert("請填寫完整資訊");
    localStorage.setItem('gh_config', JSON.stringify({token, user, repo}));
    alert("設定已儲存");
}

// --- 檔案載入 ---
async function connectLocalFolder() {
    if (!('showDirectoryPicker' in window)) return alert("瀏覽器不支援 File System API");
    try {
        localHandle = await window.showDirectoryPicker();
        await localHandle.getDirectoryHandle('assets');
        const status = document.getElementById('local-status');
        if(status) {
            status.innerText = "✅ 已連接";
            status.className = "status-tag status-ok";
            status.style.display = "inline-block";
        }
    } catch(e) { alert("連接失敗 (請確認選擇 RobotFAQ 根目錄): " + e.message); }
}

async function loadLocalFile(lang) {
    if(!localHandle) return alert("請先連接資料夾");
    try {
        currentLang = lang;
        const fileHandle = await localHandle.getDirectoryHandle('assets')
                                          .then(d => d.getDirectoryHandle('data'))
                                          .then(d => d.getFileHandle(`data.${lang}.js`));
        const file = await fileHandle.getFile();
        const text = await file.text();
        parseAndRender(text);
        alert(`已載入 data.${lang}.js`);
    } catch(e) { alert("讀取失敗: " + e.message); }
}

async function loadGithubFile(lang) {
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();

    if (!token || !user || !repo) return alert("請先設定 GitHub 資訊");

    currentLang = lang;
    const path = `assets/data/data.${lang}.js`;
    const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;

    try {
        const res = await fetch(apiUrl, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        // 使用新版解碼器
        const content = b64ToUtf8(data.content);
        
        parseAndRender(content);
        alert(`✅ 從 GitHub 載入成功 (data.${lang}.js)`);
    } catch (e) {
        console.error(e);
        alert("GitHub 讀取失敗: " + e.message);
    }
}

// --- 儲存邏輯 ---
async function saveData() {
    if(!currentData) return alert("無資料可存");
    const str = JSON.stringify(currentData, null, 4);
    const content = `window.${currentVarName} = ${str};`;

    if(currentMode === 'local') {
        saveLocalData(content);
    } else {
        await saveGithubData(content);
    }
}

async function saveLocalData(content) {
    if(!localHandle) return alert("請先連接資料夾");
    try {
        const fileHandle = await localHandle.getDirectoryHandle('assets')
                                          .then(d => d.getDirectoryHandle('data'))
                                          .then(d => d.getFileHandle(`data.${currentLang}.js`, {create: true}));
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        alert("✅ 本機存檔成功");
    } catch(e) { alert("存檔失敗: " + e.message); }
}

async function saveGithubData(content) {
    const saveBtn = document.getElementById('saveGithubBtn');
    const oldText = saveBtn.innerText;
    
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();

    if (!token || !user || !repo) return alert('請先設定 GitHub！');

    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ 處理中...';

    try {
        const path = `assets/data/data.${currentLang}.js`;
        const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
        const headers = { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' };

        // 1. GET SHA
        const getRes = await fetch(apiUrl, { headers });
        let sha = null;
        if(getRes.ok) {
            const fileData = await getRes.json();
            sha = fileData.sha;
        }

        // 2. PUT
        // 編碼：使用 UTF-8 安全的方式
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        
        const body = {
            message: 'Update via Admin',
            content: encodedContent
        };
        if(sha) body.sha = sha;

        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if(!putRes.ok) throw new Error("上傳失敗");
        alert('🎉 成功！GitHub 已更新');

    } catch (e) {
        alert('錯誤: ' + e.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = oldText;
    }
}

// --- 圖片貼上 ---
async function handleImagePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let blob = null;
    for (let i=0; i<items.length; i++) {
        if (items[i].type.indexOf("image")===0) { blob = items[i].getAsFile(); break; }
    }
    if(!blob) return;
    e.preventDefault();
    if(!confirm("偵測到圖片，確定上傳？")) return;

    const filename = `img_${Date.now()}.png`;
    const path = `assets/images/${filename}`;
    
    if(currentMode === 'local') {
        if(!localHandle) return alert("請先連接資料夾");
        try {
            const imgDir = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('images'));
            const fileHandle = await imgDir.getFileHandle(filename, {create:true});
            const writable = await fileHandle.createWritable();
            await writable.write(blob);
            await writable.close();
            insertText(e.target, `{{img:${path}}}`);
            alert("圖片已存入本機");
        } catch(err) { alert("圖片存檔失敗: "+err.message); }
    } else {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            try {
                await uploadImageToGithub(filename, base64);
                insertText(e.target, `{{img:${path}}}`);
                alert("圖片已上傳 GitHub");
            } catch(err) { alert("圖片上傳失敗: "+err.message); }
        };
    }
}

async function uploadImageToGithub(filename, base64) {
    const token = document.getElementById('gh_token').value;
    const user = document.getElementById('gh_user').value;
    const repo = document.getElementById('gh_repo').value;
    const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/assets/images/${filename}`;
    
    const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Upload ${filename}`, content: base64 })
    });
    if(!res.ok) throw new Error("API Error");
}

function insertText(el, text) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = el.value.substring(0, start) + text + el.value.substring(end);
}

// --- 核心：解析與渲染 (含防呆) ---
function parseAndRender(text) {
    console.log("[Admin] Parsing...");
    try {
        // 使用新版剝殼器
        const { varName, jsonText } = extractJsonPayload(text);
        if (varName) currentVarName = varName;
        
        currentData = JSON.parse(jsonText);
        console.log(`[Admin] Parsed variable: ${currentVarName}`);
        
        renderTree();
        
        // ⚠️ UI 防呆：檢查元素是否存在
        const editorPanel = document.getElementById('editor-panel');
        if(editorPanel) editorPanel.style.display = 'none';
        
        const welcomeMsg = document.getElementById('welcome-msg');
        if(welcomeMsg) welcomeMsg.style.display = 'none';

    } catch(e) {
        console.error(e);
        alert(`資料格式錯誤:\n${e.message}\n\n請檢查 JSON 格式或最後是否有多餘逗號。`);
    }
}

function renderTree() {
    const root = document.getElementById('tree-root');
    if(!root) return; // 防呆
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
    activeNode = item;
    activeParent = { array: arr, index: idx };
    
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    renderTree(); 

    const panel = document.getElementById('editor-panel');
    if(panel) panel.style.display = 'block';
    
    const typeLabel = document.getElementById('node-type');
    if(typeLabel) typeLabel.textContent = type.toUpperCase();
    
    if(document.getElementById('inp-id')) document.getElementById('inp-id').value = item.id || '';
    if(document.getElementById('inp-title')) document.getElementById('inp-title').value = item.title || '';
    
    const qDiv = document.getElementById('q-fields');
    if(type === 'q' && qDiv) {
        qDiv.style.display = 'block';
        const c = item.content || {};
        const join = (a) => Array.isArray(a) ? a.join('\n') : (a || "");
        
        if(document.getElementById('inp-symptoms')) document.getElementById('inp-symptoms').value = join(c.symptoms);
        if(document.getElementById('inp-causes')) document.getElementById('inp-causes').value = join(c.rootCauses);
        if(document.getElementById('inp-steps')) document.getElementById('inp-steps').value = join(c.solutionSteps);
        if(document.getElementById('inp-notes')) document.getElementById('inp-notes').value = c.notes || "";
    } else if (qDiv) {
        qDiv.style.display = 'none';
    }
}

function applyEdit() {
    if(!activeNode) return;
    if(document.getElementById('inp-id')) activeNode.id = document.getElementById('inp-id').value;
    if(document.getElementById('inp-title')) activeNode.title = document.getElementById('inp-title').value;
    
    const qDiv = document.getElementById('q-fields');
    if(qDiv && qDiv.style.display === 'block') {
        if(!activeNode.content) activeNode.content = {};
        const split = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.split('\n').filter(x=>x.trim()) : [];
        };
        
        activeNode.content.symptoms = split('inp-symptoms');
        activeNode.content.rootCauses = split('inp-causes');
        activeNode.content.solutionSteps = split('inp-steps');
        const notesEl = document.getElementById('inp-notes');
        activeNode.content.notes = notesEl ? notesEl.value : "";
    }
    renderTree();
    alert("修改已暫存");
}

function addNode(type) {
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
        activeParent.array.splice(activeParent.index, 1);
        activeNode = null;
        const panel = document.getElementById('editor-panel');
        if(panel) panel.style.display = 'none';
        renderTree();
    }
}
