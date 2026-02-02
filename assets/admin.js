let currentMode = 'local';
let currentData = null;
let currentVarName = "FAQ_DATA_ZH";
let currentLang = "zh";
let activeNode = null;
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
    
    // UI切換
    const idx = mode==='local'?0:1;
    document.querySelectorAll('.tab-btn')[idx].classList.add('active');
    document.getElementById(`panel-${mode}`).classList.add('active');
    
    const btn = document.getElementById('saveGithubBtn');
    btn.innerText = mode==='local' ? "💾 儲存 (本機硬碟)" : "🚀 儲存並上傳 GitHub";
    btn.className = mode==='local' ? "btn-green" : "btn-blue";
}

function loadGhConfig() {
    const conf = JSON.parse(localStorage.getItem('gh_config'));
    if(conf) {
        document.getElementById('gh_token').value = conf.token;
        document.getElementById('gh_user').value = conf.user;
        document.getElementById('gh_repo').value = conf.repo;
    }
}

function saveGhConfig() {
    const token = document.getElementById('gh_token').value;
    const user = document.getElementById('gh_user').value;
    const repo = document.getElementById('gh_repo').value;
    localStorage.setItem('gh_config', JSON.stringify({token, user, repo}));
    alert("設定已儲存");
}

// --- 核心：儲存資料 (分流) ---
async function saveData() {
    if(!currentData) return alert("無資料");
    const str = JSON.stringify(currentData, null, 4);
    const content = `window.${currentVarName} = ${str};`;

    if(currentMode === 'local') {
        saveLocalData(content);
    } else {
        await saveGithubData(content);
    }
}

// --- GitHub 上傳邏輯 (修復版) ---
async function saveGithubData(content) {
    const saveBtn = document.getElementById('saveGithubBtn');
    
    // ⚠️ 關鍵修正 1: 定義 oldText
    const oldText = saveBtn.innerText;
    
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();

    if (!token || !user || !repo) return alert('請先設定 GitHub Token！');

    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ 取得 SHA...';

    try {
        const path = `assets/data/data.${currentLang}.js`;
        const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
        const headers = { 'Authorization': `token ${token}` };

        // Step 1: GET SHA
        const getRes = await fetch(apiUrl, { headers });
        if(!getRes.ok) throw new Error("無法讀取檔案 SHA");
        const fileData = await getRes.json();

        // Step 2: PUT Update
        saveBtn.innerText = '⏳ 上傳中...';
        // 中文編碼處理
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        
        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Update via Admin',
                content: encodedContent,
                sha: fileData.sha
            })
        });

        if(!putRes.ok) throw new Error("上傳失敗");
        
        alert('🎉 成功！資料已更新到 GitHub (請等1分鐘後刷新)');

    } catch (e) {
        alert('錯誤: ' + e.message);
    } finally {
        // ⚠️ 關鍵修正 2: 恢復按鈕
        saveBtn.disabled = false;
        saveBtn.innerText = oldText;
    }
}

// --- 本機邏輯 (Local) ---
async function connectLocalFolder() {
    try {
        localHandle = await window.showDirectoryPicker();
        document.getElementById('local-status').innerText = "✅ 已連接";
        document.getElementById('local-status').className = "status-tag status-ok";
    } catch(e) { console.log(e); }
}

async function loadLocalFile(lang) {
    if(!localHandle) return alert("請先連接資料夾");
    currentLang = lang;
    const fileHandle = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('data')).then(d=>d.getFileHandle(`data.${lang}.js`));
    const file = await fileHandle.getFile();
    const text = await file.text();
    parseData(text);
}

async function saveLocalData(content) {
    if(!localHandle) return alert("請先連接資料夾");
    const fileHandle = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('data')).then(d=>d.getFileHandle(`data.${currentLang}.js`));
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
    alert("✅ 本機存檔成功");
}

// --- 圖片貼上邏輯 ---
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
        // 本機儲存圖片
        if(!localHandle) return alert("請先連接資料夾");
        const imgDir = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('images'));
        const fileHandle = await imgDir.getFileHandle(filename, {create:true});
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        insertText(e.target, `{{img:${path}}}`);
    } else {
        // GitHub 上傳圖片
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
            const base64 = reader.result.split(',')[1];
            // 這裡簡化：直接呼叫上傳圖片 API (需實作類似 saveGithubData 的邏輯)
            // 為了完整性，這裡假設您會實作 saveGithubImage
            alert("GitHub 圖片上傳需實作 saveGithubImage 函式 (類似 saveGithubData)");
            // 暫時只插入文字
            insertText(e.target, `{{img:${path}}}`);
        };
    }
}

function insertText(el, text) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = el.value.substring(0, start) + text + el.value.substring(end);
}

// --- 通用 Helper ---
function parseData(text) {
    const match = text.match(/window\.(\w+)\s*=\s*(\{[\s\S]*\});?/);
    if(match) {
        currentVarName = match[1];
        try {
            currentData = JSON.parse(match[2]);
            renderTree();
            document.getElementById('editor-panel').style.display='none';
        } catch(e) { alert("JSON 格式錯誤"); }
    }
}

// 樹狀圖渲染與編輯邏輯 (addNode, deleteNode, applyEdit) 請保持原樣
// 為了節省篇幅，這裡省略這部分標準代碼，請保留您原本的即可
function renderTree() { /*...省略...*/ }
function loadEditor(item, type, arr, idx) { /*...省略...*/ }
function applyEdit() { /*...省略...*/ }
function addNode(type) { /*...省略...*/ }
function deleteNode() { /*...省略...*/ }
