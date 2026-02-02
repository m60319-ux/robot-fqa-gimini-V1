/**
 * assets/admin.js - Dual Mode (Local & GitHub)
 */

// 狀態管理
let currentMode = 'local'; // 'local' | 'github'
let currentData = null;
let currentVarName = "FAQ_DATA_ZH"; // 當前編輯的變數名
let currentLang = "zh"; // 當前語言
let activeNode = null;
let activeParent = null; // { array: [], index: 0 }

// 本機模式變數
let localHandle = null; // 資料夾控制權

// DOM 載入
document.addEventListener('DOMContentLoaded', () => {
    loadGhConfig(); // 載入 GitHub 設定
    
    // 監聽圖片貼上
    document.querySelectorAll('.paste-area').forEach(area => {
        area.addEventListener('paste', handleImagePaste);
    });
});

// =========================================
// 1. 模式切換
// =========================================
function switchMode(mode) {
    currentMode = mode;
    
    // UI 切換
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
    
    // 根據順序 (0=Local, 1=Github) 切換 active class
    const tabIndex = mode === 'local' ? 0 : 1;
    document.querySelectorAll('.tab-btn')[tabIndex].classList.add('active');
    
    document.getElementById(`panel-${mode}`).classList.add('active');
    
    // 更新按鈕文字
    const btnText = mode === 'local' ? "💾 儲存 (本機硬碟)" : "🚀 儲存並上傳 GitHub";
    document.getElementById('btn-save-all').innerText = btnText;
    document.getElementById('btn-save-all').className = mode === 'local' ? 'btn-green' : 'btn-blue';
}

// =========================================
// 2. 本機模式 (Local Mode)
// =========================================
async function connectLocalFolder() {
    if (!('showDirectoryPicker' in window)) return alert("您的瀏覽器不支援，請使用 Chrome/Edge");
    try {
        localHandle = await window.showDirectoryPicker();
        // 驗證是否為正確專案 (檢查 assets 資料夾)
        await localHandle.getDirectoryHandle('assets');
        
        const status = document.getElementById('local-status');
        status.innerText = `✅ 已連接: ${localHandle.name}`;
        status.className = 'status-tag status-ok';
        status.style.display = 'inline-block';
        alert("資料夾連接成功！");
    } catch (e) {
        alert("錯誤：請選擇 RobotFAQ 專案根目錄 (須包含 assets)");
        console.error(e);
    }
}

async function loadLocalFile(lang) {
    if (!localHandle) return alert("請先連接資料夾");
    try {
        const assets = await localHandle.getDirectoryHandle('assets');
        const dataDir = await assets.getDirectoryHandle('data');
        const fileHandle = await dataDir.getFileHandle(`data.${lang}.js`);
        const file = await fileHandle.getFile();
        const text = await file.text();
        
        parseAndRender(text, lang);
    } catch (e) {
        alert("讀取失敗，檔案可能不存在: " + e.message);
    }
}

async function saveLocalData(content, lang) {
    if (!localHandle) return alert("請先連接資料夾");
    try {
        const assets = await localHandle.getDirectoryHandle('assets');
        const dataDir = await assets.getDirectoryHandle('data');
        const fileHandle = await dataDir.getFileHandle(`data.${lang}.js`, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(content);
        await writable.close();
        alert(`✅ 本機存檔成功 (data.${lang}.js)`);
    } catch (e) {
        alert("存檔失敗: " + e.message);
    }
}

async function saveLocalImage(blob, filename) {
    if (!localHandle) return alert("請先連接資料夾");
    try {
        const assets = await localHandle.getDirectoryHandle('assets');
        const imgDir = await assets.getDirectoryHandle('images', { create: true });
        const fileHandle = await imgDir.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
    } catch (e) {
        alert("圖片存檔失敗: " + e.message);
        return false;
    }
}

// =========================================
// 3. GitHub 模式 (Cloud Mode)
// =========================================
function saveGhConfig() {
    const token = document.getElementById('gh-token').value;
    const owner = document.getElementById('gh-owner').value;
    const repo = document.getElementById('gh-repo').value;
    localStorage.setItem('gh_config', JSON.stringify({ token, owner, repo }));
    alert("設定已儲存");
}

function loadGhConfig() {
    const conf = JSON.parse(localStorage.getItem('gh_config'));
    if(conf) {
        document.getElementById('gh-token').value = conf.token;
        document.getElementById('gh-owner').value = conf.owner;
        document.getElementById('gh-repo').value = conf.repo;
    }
    return conf;
}

// 通用 GitHub API 請求
async function ghRequest(path, method = 'GET', body = null) {
    const conf = loadGhConfig();
    if(!conf || !conf.token) throw new Error("請先設定 GitHub Token");
    
    const url = `https://api.github.com/repos/${conf.owner}/${conf.repo}/contents/${path}`;
    const headers = {
        'Authorization': `token ${conf.token}`,
        'Content-Type': 'application/json'
    };
    
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    // 如果是寫入，需先 GET 取得 sha (若檔案存在)
    if (method === 'PUT') {
        try {
            const check = await fetch(url, { headers });
            if(check.ok) {
                const data = await check.json();
                body.sha = data.sha; // 附加 SHA 以進行覆蓋
                options.body = JSON.stringify(body); // 更新 body
            }
        } catch(e) {} // 檔案不存在，直接 PUT
    }

    const res = await fetch(url, options);
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
    }
    return await res.json();
}

async function loadGithubFile(lang) {
    try {
        // 使用 raw.githubusercontent 直接讀取內容，避免 base64 解碼問題
        // 注意：Private Repo 需要用 API 讀取 content 並解碼，這裡示範 API 讀法
        const conf = loadGhConfig();
        if(!conf) return alert("請先設定 GitHub");

        // 顯示載入中
        document.getElementById('tree-root').innerHTML = '<div style="padding:20px; text-align:center;">⏳ 下載中...</div>';

        const data = await ghRequest(`assets/data/data.${lang}.js`);
        // GitHub API 回傳 content 是 Base64 編碼，且有換行符號
        // 使用 decodeURIComponent(escape(atob(...))) 處理中文
        const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
        
        parseAndRender(content, lang);
        alert(`✅ 從 GitHub 載入成功 (v.${data.sha.substring(0,7)})`);

    } catch (e) {
        alert("GitHub 讀取失敗: " + e.message);
        document.getElementById('tree-root').innerHTML = '';
    }
}
async function saveGithubData() {
    const saveBtn = document.getElementById('saveGithubBtn');
    
    // 1. 【關鍵修正】先記住按鈕原本的文字 (例如 "儲存並上傳 GitHub")
    const oldText = saveBtn.innerText;

    // 2. 檢查設定
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();

    if (!token || !user || !repo) {
        alert('請先在上方輸入 GitHub Token、User 與 Repo 資訊！');
        return;
    }

    // 3. 鎖定按鈕，避免重複點擊
    saveBtn.disabled = true;
    saveBtn.innerText = '⏳ 正在讀取遠端 SHA...';

    try {
        // --- 步驟 A: 取得目前的檔案資訊 (為了拿到 SHA) ---
        // 我們要更新的是 data.zh.js
        const path = 'assets/data/data.zh.js';
        const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;

        const getRes = await fetch(apiUrl, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (!getRes.ok) {
            throw new Error(`無法讀取檔案 SHA (Status: ${getRes.status}) - 請確認 Repo 名稱正確`);
        }
        
        const fileData = await getRes.json();
        const currentSha = fileData.sha; // 拿到這張「入場券」才能更新檔案

        // --- 步驟 B: 準備要上傳的新內容 ---
        saveBtn.innerText = '⏳ 正在上傳新資料...';
        
        // 取得編輯器裡的文字
        const content = document.getElementById('jsonEditor').value;
        
        // 驗證一下 JSON 格式是否正確 (避免上傳壞掉的檔案)
        try {
            JSON.parse(content);
        } catch (e) {
            throw new Error('JSON 格式有錯 (逗號問題？)，請先修正後再上傳！\n' + e.message);
        }

        // GitHub API 需要 Base64 編碼，並且解決中文亂碼問題
        const encodedContent = btoa(unescape(encodeURIComponent(content)));

        // --- 步驟 C: 發送 PUT 請求更新檔案 ---
        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Update data.zh.js via Admin Panel', // Commit 訊息
                content: encodedContent,
                sha: currentSha // 帶上剛剛拿到的 SHA
            })
        });

        if (!putRes.ok) {
            const errData = await putRes.json();
            throw new Error(`上傳失敗: ${errData.message}`);
        }

        alert('🎉 成功！資料已更新到 GitHub！\n(請等待約 1~2 分鐘後重新整理網頁)');

    } catch (error) {
        console.error(error);
        alert('❌ 錯誤: ' + error.message);
    } finally {
        // 4. 【關鍵修正】不管成功失敗，把按鈕文字改回來
        saveBtn.disabled = false;
        saveBtn.innerText = oldText; // 這裡現在找得到 oldText 了！
    }
}
async function saveGithubImage(base64Content, filename) {
    try {
        await ghRequest(`assets/images/${filename}`, 'PUT', {
            message: `Upload ${filename}`,
            content: base64Content
        });
        return true;
    } catch(e) {
        alert("GitHub 圖片上傳失敗: " + e.message);
        return false;
    }
}

// =========================================
// 4. 共用邏輯 (解析, 樹狀圖, 編輯, 貼圖)
// =========================================

function parseAndRender(jsContent, lang) {
    currentLang = lang;
    const match = jsContent.match(/window\.(\w+)\s*=\s*(\{[\s\S]*\});?/);
    if(match) {
        currentVarName = match[1];
        currentData = JSON.parse(match[2]);
        renderTree();
        
        // 切換 UI 顯示
        document.getElementById('welcome-msg').style.display = 'none';
        document.getElementById('editor-panel').style.display = 'none';
    } else {
        alert("檔案格式錯誤");
    }
}

// 圖片貼上處理 (自動分流)
async function handleImagePaste(event) {
    const items = (event.clipboardData || event.originalEvent.clipboardData).items;
    let blob = null;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") === 0) {
            blob = items[i].getAsFile();
            break;
        }
    }

    if (blob) {
        event.preventDefault();
        
        // 1. 檔名生成
        const timestamp = Date.now();
        const ext = blob.type === "image/jpeg" ? "jpg" : "png";
        const filename = `img_${timestamp}.${ext}`;
        const relativePath = `assets/images/${filename}`;

        // 2. 詢問
        if(!confirm(`偵測到圖片貼上。\n模式：${currentMode.toUpperCase()}\n\n確定儲存為 ${filename}？`)) return;

        let success = false;

        // 3. 分流處理
        if (currentMode === 'local') {
            success = await saveLocalImage(blob, filename);
        } else {
            // GitHub 需要 Base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            success = await new Promise(resolve => {
                reader.onloadend = async () => {
                    const base64 = reader.result.split(',')[1];
                    const res = await saveGithubImage(base64, filename);
                    resolve(res);
                };
            });
        }

        // 4. 插入代碼
        if (success) {
            const textArea = event.target;
            const insertText = `{{img:${relativePath}}}`;
            const start = textArea.selectionStart;
            const end = textArea.selectionEnd;
            const text = textArea.value;
            textArea.value = text.substring(0, start) + insertText + text.substring(end);
        }
    }
}

// 儲存資料按鈕 (自動分流)
function saveData() {
    if(!currentData) return alert("沒有載入任何資料");
    
    // 轉字串
    const str = JSON.stringify(currentData, null, 4);
    const content = `window.${currentVarName} = ${str};`;
    
    if (currentMode === 'local') {
        saveLocalData(content, currentLang);
    } else {
        if(confirm("確定要將變更推送到 GitHub Repository 嗎？")) {
            saveGithubData(content, currentLang);
        }
    }
}

// ------------------------------------------
// 以下為標準樹狀圖與編輯邏輯 (與先前相同，精簡版)
// ------------------------------------------

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
    div.onclick = () => loadEditor(item, type, arr, idx);
    return div;
}

function loadEditor(item, type, arr, idx) {
    activeNode = item;
    activeParent = { array: arr, index: idx };
    
    document.getElementById('editor-panel').style.display = 'block';
    document.getElementById('node-type').textContent = type.toUpperCase();
    document.getElementById('inp-id').value = item.id || '';
    document.getElementById('inp-title').value = item.title || '';
    
    const qFields = document.getElementById('q-fields');
    if(type === 'q') {
        qFields.style.display = 'block';
        const c = item.content || {};
        const join = (a) => Array.isArray(a) ? a.join('\n') : (a||"");
        document.getElementById('inp-symptoms').value = join(c.symptoms);
        document.getElementById('inp-causes').value = join(c.rootCauses);
        document.getElementById('inp-steps').value = join(c.solutionSteps);
        document.getElementById('inp-notes').value = c.notes || "";
    } else {
        qFields.style.display = 'none';
    }
    renderTree(); // 重繪 highlight
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
    alert("修改已暫存！");
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
        return alert("請先選取正確的父節點 (選分類以新增子類，選子類以新增問題)");
    }
    renderTree();
}

function deleteNode() {
    if(!activeNode || !activeParent) return;
    if(confirm("確定刪除？")) {
        activeParent.array.splice(activeParent.index, 1);
        activeNode = null;
        document.getElementById('editor-panel').style.display = 'none';
        renderTree();
    }
}
