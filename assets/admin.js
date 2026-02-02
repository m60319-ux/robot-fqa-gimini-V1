// assets/admin.js - Final Complete Version
let currentMode = 'local';
let currentData = null;
let currentVarName = "FAQ_DATA_ZH";
let currentLang = "zh";
let activeNode = null;
let activeParent = null;
let localHandle = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadGhConfig();
    document.querySelectorAll('.paste-area').forEach(area => {
        area.addEventListener('paste', handleImagePaste);
    });
});

// --- 模式與設定 ---
function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
    
    const idx = mode === 'local' ? 0 : 1;
    document.querySelectorAll('.tab-btn')[idx].classList.add('active');
    document.getElementById(`panel-${mode}`).classList.add('active');
    
    const btn = document.getElementById('saveGithubBtn');
    btn.innerText = mode === 'local' ? "💾 儲存 (本機硬碟)" : "🚀 儲存並上傳 GitHub";
    btn.className = mode === 'local' ? "btn-green" : "btn-blue";
}

function loadGhConfig() {
    const conf = JSON.parse(localStorage.getItem('gh_config'));
    if(conf) {
        document.getElementById('gh_token').value = conf.token || '';
        document.getElementById('gh_user').value = conf.user || '';
        document.getElementById('gh_repo').value = conf.repo || '';
    }
}

function saveGhConfig() {
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();
    if(!token || !user || !repo) return alert("請填寫完整資訊");
    localStorage.setItem('gh_config', JSON.stringify({token, user, repo}));
    alert("設定已儲存");
}

// --- 檔案載入 (Local) ---
async function connectLocalFolder() {
    if (!('showDirectoryPicker' in window)) return alert("瀏覽器不支援，請用 Chrome/Edge");
    try {
        localHandle = await window.showDirectoryPicker();
        await localHandle.getDirectoryHandle('assets'); // 檢查
        document.getElementById('local-status').innerText = "✅ 已連接";
        document.getElementById('local-status').className = "status-tag status-ok";
        document.getElementById('local-status').style.display = "inline-block";
    } catch(e) { 
        alert("連接失敗或選錯資料夾 (需包含 assets): " + e.message); 
    }
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
    } catch(e) {
        alert("讀取失敗: " + e.message);
    }
}

// --- 檔案載入 (GitHub) ---
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
            headers: { 
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
        
        parseAndRender(content);
        alert(`✅ 從 GitHub 載入成功 (data.${lang}.js)`);
        
    } catch (e) {
        alert("GitHub 讀取失敗: " + e.message);
    }
}

// --- 儲存邏輯 ---
async function saveData() {
    if(!currentData) return alert("沒有資料可存");
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
        alert(`✅ 本機存檔成功 (data.${currentLang}.js)`);
    } catch(e) {
        alert("存檔失敗: " + e.message);
    }
}

async function saveGithubData(content) {
    const saveBtn = document.getElementById('saveGithubBtn');
    const oldText = saveBtn.innerText;
    
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();

    if (!token || !user || !repo) return alert('請先設定 GitHub！');

    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ 取得 SHA...';

    try {
        const path = `assets/data/data.${currentLang}.js`;
        const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
        const headers = { 
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        };

        // 1. GET SHA
        const getRes = await fetch(apiUrl, { headers });
        if(!getRes.ok) throw new Error("無法取得檔案狀態");
        const fileData = await getRes.json();

        // 2. PUT Update
        saveBtn.innerText = '⏳ 上傳中...';
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        
        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Update via Admin Panel',
                content: encodedContent,
                sha: fileData.sha
            })
        });

        if(!putRes.ok) throw new Error("上傳失敗");
        alert('🎉 成功！GitHub 已更新');

    } catch (e) {
        console.error(e);
        alert('❌ 錯誤: ' + e.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerText = oldText;
    }
}

// --- 圖片貼上邏輯 ---
async function handleImagePaste(e) {
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
        headers: { 
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
            message: `Upload ${filename}`,
            content: base64
        })
    });
    if(!res.ok) throw new Error("API Error");
}

function insertText(el, text) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = el.value.substring(0, start) + text + el.value.substring(end);
}

// --- 編輯器邏輯 (UI) ---
function parseAndRender(text) {
    const match = text.match(/window\.(\w+)\s*=\s*(\{[\s\S]*\});?/);
    if(match) {
        currentVarName = match[1];
        try {
            currentData = JSON.parse(match[2]);
            renderTree();
            document.getElementById('editor-panel').style.display = 'none';
            document.getElementById('welcome-msg').style.display = 'none';
        } catch(e) {
            alert("資料格式錯誤 (JSON Parse Error)");
        }
    } else {
        alert("檔案格式不符");
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
        document.getElementById('editor-panel').style.display = 'none';
        renderTree();
    }
}
