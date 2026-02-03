// assets/admin.js - V3.5 CSV GitHub Import/Export
let currentMode = 'local';
let currentData = null;
let currentVarName = "FAQ_DATA_ZH";
let currentLang = "zh";
let activeNode = null;
let activeParent = null;
let localHandle = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("[Admin] DOM Loaded.");
    loadGhConfig();
    document.querySelectorAll('.paste-area').forEach(area => {
        area.addEventListener('paste', handleImagePaste);
    });
});

// --- 工具：Base64 解碼與剝殼 ---
function b64ToUtf8(b64) {
    try {
        const clean = (b64 || "").replace(/\s/g, "");
        const bytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
        return new TextDecoder("utf-8").decode(bytes);
    } catch (e) {
        return decodeURIComponent(escape(atob(b64)));
    }
}

function extractJsonPayload(text) {
    if (!text) throw new Error("Empty file content");
    const t = text.replace(/^\uFEFF/, "").trim();
    if (t.startsWith("{") || t.startsWith("[")) return { varName: null, jsonText: t };
    let m = t.match(/(?:window\.|const\s+|var\s+|let\s+)(\w+)\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (m) return { varName: m[1], jsonText: m[2] };
    const firstBrace = t.indexOf('{');
    const lastBrace = t.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        return { varName: "FAQ_DATA_UNKNOWN", jsonText: t.substring(firstBrace, lastBrace + 1) };
    }
    throw new Error("無法識別檔案格式");
}

// --- 模式與設定 ---
function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
    
    const idx = mode === 'local' ? 0 : 1;
    document.querySelectorAll('.tab-btn')[idx].classList.add('active');
    document.getElementById(`panel-${mode}`).classList.add('active');
    
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
            document.getElementById('gh_token').value = conf.token || '';
            document.getElementById('gh_user').value = conf.user || '';
            document.getElementById('gh_repo').value = conf.repo || '';
        }
    } catch(e) {}
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
    } catch(e) { alert("連接失敗: " + e.message); }
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
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        if(!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
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

// --- 編輯器邏輯 (UI) ---
function parseAndRender(text) {
    console.log("[Admin] Parsing...");
    try {
        const { varName, jsonText } = extractJsonPayload(text);
        if (varName) currentVarName = varName;
        currentData = JSON.parse(jsonText);
        
        renderTree();
        
        const editorPanel = document.getElementById('editor-panel');
        if(editorPanel) editorPanel.style.display = 'none';
        
        const welcomeMsg = document.getElementById('welcome-msg');
        if(welcomeMsg) welcomeMsg.style.display = 'none';

    } catch(e) {
        console.error(e);
        alert(`資料格式錯誤:\n${e.message}`);
    }
}

function renderTree() {
    const root = document.getElementById('tree-root');
    if(!root) return;
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
        
        // 關鍵字
        if(document.getElementById('inp-keywords')) document.getElementById('inp-keywords').value = join(c.keywords);
        
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
        activeNode.content.keywords = split('inp-keywords');
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
        activeNode.questions.push({ id:`Q-${ts}`, title:"New", content:{symptoms:[],rootCauses:[],solutionSteps:[],keywords:[],notes:""} });
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

// ✨✨✨ 新增功能：CSV 匯出與匯入 ✨✨✨

// 1. 匯出 CSV (支援 Local 與 GitHub)
async function exportToCSV() {
    if (!currentData || !currentData.categories) return alert("沒有資料可匯出");
    
    // GitHub 模式需要 Token
    if (currentMode === 'github') {
        const token = document.getElementById('gh_token').value.trim();
        if (!token) return alert("請先設定 GitHub Token");
    }
    // 本機模式需要連接
    else if (!localHandle) {
        return alert("請先連接資料夾");
    }

    const rows = [];
    rows.push(["category_id", "category_title", "sub_id", "sub_title", "question_id", "question_title", "symptoms", "root_causes", "solution_steps", "keywords", "notes"]);

    currentData.categories.forEach(cat => {
        cat.subcategories.forEach(sub => {
            sub.questions.forEach(q => {
                const c = q.content || {};
                const join = (arr) => Array.isArray(arr) ? arr.join('||') : ""; 
                
                rows.push([
                    cat.id, cat.title,
                    sub.id, sub.title,
                    q.id, q.title,
                    join(c.symptoms),
                    join(c.rootCauses),
                    join(c.solutionSteps),
                    join(c.keywords),
                    c.notes || ""
                ]);
            });
        });
    });

    const csv = Papa.unparse(rows);
    const fileName = `export_${currentLang}_${Date.now()}.csv`;
    const contentWithBOM = '\uFEFF' + csv; // 加入 BOM 支援 Excel

    try {
        if (currentMode === 'local') {
            const assets = await localHandle.getDirectoryHandle('assets');
            const dataDir = await assets.getDirectoryHandle('data');
            const fileHandle = await dataDir.getFileHandle(fileName, {create: true});
            const writable = await fileHandle.createWritable();
            await writable.write(new Uint8Array([0xEF, 0xBB, 0xBF])); 
            await writable.write(csv);
            await writable.close();
            alert(`✅ 匯出成功 (本機)！\n檔案已儲存至 assets/data/${fileName}`);
        } else {
            // GitHub Export (Upload CSV)
            const token = document.getElementById('gh_token').value;
            const user = document.getElementById('gh_user').value;
            const repo = document.getElementById('gh_repo').value;
            const path = `assets/data/${fileName}`;
            const apiUrl = `https://api.github.com/repos/${user}/${repo}/contents/${path}`;
            
            // CSV 轉 Base64 (UTF-8 safe)
            const encodedContent = btoa(unescape(encodeURIComponent(contentWithBOM)));

            const res = await fetch(apiUrl, {
                method: 'PUT',
                headers: { 
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({
                    message: `Export CSV ${fileName}`,
                    content: encodedContent
                })
            });

            if(!res.ok) throw new Error(`GitHub API Error: ${res.status}`);
            alert(`✅ 匯出成功 (GitHub)！\n檔案已上傳至 ${path}`);
        }
    } catch(e) {
        alert("匯出失敗: " + e.message);
    }
}

// 2. 匯入 CSV (共用邏輯)
function parseCsvRows(rows) {
    const newCategories = [];
    const catMap = {}; 
    const subMap = {}; 

    rows.forEach(row => {
        if (!row.category_id || !row.question_id) return;

        let cat = catMap[row.category_id];
        if (!cat) {
            cat = { id: row.category_id, title: row.category_title, subcategories: [] };
            catMap[row.category_id] = cat;
            newCategories.push(cat);
        }

        const subKey = row.category_id + "_" + row.sub_id;
        let sub = subMap[subKey];
        if (!sub) {
            sub = { id: row.sub_id, title: row.sub_title, questions: [] };
            subMap[subKey] = sub;
            cat.subcategories.push(sub);
        }

        const split = (str) => str ? str.split('||') : [];
        
        const q = {
            id: row.question_id,
            title: row.question_title,
            content: {
                symptoms: split(row.symptoms),
                rootCauses: split(row.root_causes),
                solutionSteps: split(row.solution_steps),
                keywords: split(row.keywords),
                notes: row.notes || ""
            }
        };
        sub.questions.push(q);
    });

    currentData.categories = newCategories;
    renderTree();
    alert("✅ CSV 匯入成功！請檢查資料並記得按「儲存」。");
}

// 本機 CSV 匯入
async function importFromCSV(input) {
    const file = input.files[0];
    if(!file) return;

    if (!confirm("⚠️ 匯入 CSV 將會「完全覆蓋」目前編輯器中的資料。\n確定要繼續嗎？")) {
        input.value = ""; 
        return;
    }

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            try {
                parseCsvRows(results.data);
            } catch (e) {
                console.error(e);
                alert("CSV 解析失敗: " + e.message);
            } finally {
                input.value = ""; 
            }
        }
    });
}

// GitHub CSV 匯入 (✨ 新增)
async function loadCsvFromGithub() {
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();

    if (!token || !user || !repo) return alert("請先設定 GitHub 資訊");

    if (!confirm("⚠️ 從 GitHub 匯入 CSV 將會「完全覆蓋」目前編輯器中的資料。\n確定要繼續嗎？")) return;

    try {
        // 1. 列出 assets/data/ 下的所有檔案
        const listUrl = `https://api.github.com/repos/${user}/${repo}/contents/assets/data`;
        const listRes = await fetch(listUrl, {
            headers: { 'Authorization': `token ${token}` }
        });
        
        if(!listRes.ok) throw new Error("無法讀取檔案列表");
        const files = await listRes.json();
        
        // 2. 篩選 CSV 並找出最新的 (根據檔名排序)
        const csvFiles = files.filter(f => f.name.endsWith('.csv')).sort((a, b) => b.name.localeCompare(a.name));
        
        if(csvFiles.length === 0) return alert("在 GitHub 上找不到任何 CSV 檔案");
        
        const latestFile = csvFiles[0];
        
        // 3. 確認是否載入最新檔
        if(!confirm(`找到最新的 CSV 檔案：\n${latestFile.name}\n\n是否載入？`)) return;
        
        // 4. 下載內容
        const contentRes = await fetch(latestFile.url, {
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        const contentData = await contentRes.json();
        const csvContent = b64ToUtf8(contentData.content);
        
        // 5. 解析
        Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                parseCsvRows(results.data);
            }
        });

    } catch (e) {
        alert("GitHub CSV 載入失敗: " + e.message);
    }
}
