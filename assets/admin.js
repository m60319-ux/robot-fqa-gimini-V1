// assets/admin.js - V5.0 Three-Column Layout (Like Frontend)
let currentMode = 'local';
let currentData = null;
let currentVarName = "FAQ_DATA_ZH";
let currentLang = "zh";

// activeNode: 當前「編輯」的對象 (可能是 Cat, Sub, 或 Q)
let activeNode = null;
let activeParent = null; 

// currentSubNode: 當前「選中」的子分類 (控制中間列表顯示誰)
let currentSubNode = null; 

let localHandle = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Admin] DOM Loaded.");
    loadGhConfig();
    document.querySelectorAll('.paste-area').forEach(area => {
        area.addEventListener('paste', handleImagePaste);
    });
    injectDownloadButton();

    // Enter 鍵存檔
    const panel = document.getElementById('editor-panel');
    if (panel) {
        panel.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                e.preventDefault(); 
                applyEdit(false);
            }
        });
    }
});

// 自動插入下載按鈕
function injectDownloadButton() {
    const exportBtns = document.querySelectorAll('button[onclick*="exportToCSV"]');
    exportBtns.forEach(btn => {
        if (btn.parentNode.querySelector('.btn-auto-inject-dl')) return;
        const newBtn = document.createElement('button');
        newBtn.innerText = '📥 下載 CSV (本機)';
        newBtn.className = btn.className + ' btn-auto-inject-dl'; 
        newBtn.style.marginLeft = '10px';
        newBtn.style.backgroundColor = '#17a2b8';
        newBtn.style.color = '#fff';
        newBtn.onclick = downloadLocalCSV;
        btn.parentNode.insertBefore(newBtn, btn.nextSibling);
    });
}

// -----------------------------------------------------------
// 渲染邏輯核心 (V5 改版)
// -----------------------------------------------------------

function parseAndRender(text) {
    console.log("[Admin] Parsing...");
    try {
        const { varName, jsonText } = extractJsonPayload(text);
        if (varName) currentVarName = varName;
        currentData = JSON.parse(jsonText);
        
        // 重置選取狀態
        activeNode = null;
        currentSubNode = null;
        
        renderTree();      // 渲染第一欄 (Cat/Sub)
        renderQuestionList(); // 渲染第二欄 (Empty or Questions)
        
        document.getElementById('editor-panel').style.display = 'none';

    } catch(e) {
        console.error(e);
        alert(`資料格式錯誤:\n${e.message}`);
    }
}

// 渲染左側分類樹 (只包含 Cat 和 Sub)
function renderTree() {
    const root = document.getElementById('tree-root');
    if(!root) return;
    root.innerHTML = '';
    
    if(!currentData.categories) currentData.categories = [];

    currentData.categories.forEach((cat, i) => {
        // Render Category
        const catDiv = document.createElement('div');
        catDiv.className = 'tree-item';
        if(activeNode === cat) catDiv.classList.add('active');
        catDiv.textContent = `📁 ${cat.title||cat.id}`;
        catDiv.onclick = (e) => {
            // 點擊分類：只編輯分類本身，中間列表清空
            loadEditor(cat, 'cat', currentData.categories, i);
            currentSubNode = null; 
            renderQuestionList(); // 清空列表
            renderTree(); // 更新高亮
        };
        root.appendChild(catDiv);

        // Render Subcategories
        if(cat.subcategories) {
            cat.subcategories.forEach((sub, j) => {
                const subDiv = document.createElement('div');
                subDiv.className = 'tree-item sub-node';
                // 如果目前選取的是這個 Sub，或者是這個 Sub 底下的 Q
                if(activeNode === sub || currentSubNode === sub) {
                    subDiv.classList.add('active');
                }
                subDiv.textContent = `📂 ${sub.title||sub.id}`;
                subDiv.onclick = (e) => {
                    e.stopPropagation();
                    // 點擊子類：編輯子類，並顯示其問題列表
                    currentSubNode = sub;
                    loadEditor(sub, 'sub', cat.subcategories, j);
                    renderQuestionList(sub);
                    renderTree(); // 更新高亮
                };
                root.appendChild(subDiv);
            });
        }
    });
}

// 渲染中間問題列表 (Q)
function renderQuestionList(subNode = null) {
    const listRoot = document.getElementById('list-root');
    listRoot.innerHTML = '';

    if (!subNode) {
        listRoot.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;">請點選左側<br>📂 子分類</div>';
        return;
    }

    if (!subNode.questions || subNode.questions.length === 0) {
        listRoot.innerHTML = '<div style="padding:20px; text-align:center; color:#ccc;">(無問題)</div>';
        return;
    }

    subNode.questions.forEach((q, k) => {
        const qItem = document.createElement('div');
        qItem.className = 'q-item';
        if(activeNode === q) qItem.classList.add('active');
        
        qItem.innerHTML = `
            <span class="q-title">${q.title || '(未命名)'}</span>
            <span class="q-id">${q.id}</span>
        `;
        
        qItem.onclick = () => {
            // 點擊問題：編輯問題
            loadEditor(q, 'q', subNode.questions, k);
            renderQuestionList(subNode); // 更新列表高亮
        };
        listRoot.appendChild(qItem);
    });
}

// 列表篩選功能
function filterQuestionList(val) {
    const items = document.querySelectorAll('#list-root .q-item');
    val = val.toLowerCase();
    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(val) ? 'block' : 'none';
    });
}

// 載入編輯器 (Right Panel)
function loadEditor(item, type, arr, idx) {
    // 自動儲存舊的
    if (activeNode && document.getElementById('editor-panel').style.display !== 'none') {
        applyEdit(true);
    }

    activeNode = item;
    activeParent = { array: arr, index: idx };

    const panel = document.getElementById('editor-panel');
    panel.style.display = 'block';
    
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
        document.getElementById('inp-keywords').value = join(c.keywords);
        document.getElementById('inp-notes').value = c.notes || "";
    } else {
        qDiv.style.display = 'none';
    }
}

// 應用修改 (暫存)
function applyEdit(silent = false) {
    if(!activeNode) return;
    
    // Update basic info
    if(document.getElementById('inp-id')) activeNode.id = document.getElementById('inp-id').value;
    if(document.getElementById('inp-title')) activeNode.title = document.getElementById('inp-title').value;
    
    // Update content if it's a question
    const qDiv = document.getElementById('q-fields');
    if(qDiv && qDiv.style.display === 'block') {
        if(!activeNode.content) activeNode.content = {};
        
        const split = (id) => {
            const el = document.getElementById(id);
            if (!el) return [];
            let val = el.value;
            if (id === 'inp-keywords') val = val.replace(/[\u3000\+,\/\\、]/g, '\n');
            return val.split('\n').map(x => x.trim()).filter(x => x !== "");
        };
        
        activeNode.content.symptoms = split('inp-symptoms');
        activeNode.content.rootCauses = split('inp-causes');
        activeNode.content.solutionSteps = split('inp-steps');
        activeNode.content.keywords = split('inp-keywords');
        const notesEl = document.getElementById('inp-notes');
        activeNode.content.notes = notesEl ? notesEl.value : "";
    }

    // Refresh Views
    renderTree(); 
    if (currentSubNode) renderQuestionList(currentSubNode); // Refresh middle column if active
    
    if (!silent) alert("修改已暫存");
}

function addNode(type) {
    if(!currentData) return alert("請先載入檔案");
    const ts = Date.now().toString().slice(-4);
    
    if(type === 'cat') {
        currentData.categories.push({ id:`CAT-${ts}`, title:"New Category", subcategories:[] });
        renderTree();
    } 
    else if (type === 'sub') {
        // 新增子類：必須先選中一個分類 (或子類，我們會找到它的父分類)
        // 這裡簡化：必須 activeNode 是 Cat，或者是 Sub (從 activeParent 找)
        // 為了簡單，如果 activeNode 是 Cat，就加進去。
        // 如果 activeNode 是 Sub，就加到同層級。
        
        let targetCat = null;
        if (activeNode && activeNode.subcategories) {
            targetCat = activeNode; // It's a category
        } else if (activeNode && currentData.categories.some(c => c.subcategories && c.subcategories.includes(activeNode))) {
             targetCat = currentData.categories.find(c => c.subcategories.includes(activeNode));
        }

        if (targetCat) {
            targetCat.subcategories.push({ id:`SUB-${ts}`, title:"New Sub", questions:[] });
            renderTree();
        } else {
            alert("請先點選左側「分類」");
        }
    } 
    else if (type === 'q') {
        // 新增問題：必須確認目前有選中 Sub
        if (currentSubNode) {
            currentSubNode.questions.push({ 
                id:`Q-${ts}`, title:"New Question", 
                content:{symptoms:[],rootCauses:[],solutionSteps:[],keywords:[],notes:""} 
            });
            renderQuestionList(currentSubNode);
            // Auto select new question
            const newQ = currentSubNode.questions[currentSubNode.questions.length - 1];
            loadEditor(newQ, 'q', currentSubNode.questions, currentSubNode.questions.length - 1);
        } else {
            alert("請先點選左側「子分類」以新增問題");
        }
    }
}

function deleteNode() {
    if(!activeNode || !activeParent) return alert("請先選擇項目");
    
    if(confirm("確定刪除此項目？")) {
        // Remove from array
        activeParent.array.splice(activeParent.index, 1);
        
        // If we deleted the current sub, clear list
        if (activeNode === currentSubNode) {
            currentSubNode = null;
            renderQuestionList();
        }
        
        activeNode = null;
        document.getElementById('editor-panel').style.display = 'none';
        
        renderTree();
        if (currentSubNode) renderQuestionList(currentSubNode);
    }
}

// -----------------------------------------------------------
// 工具函式 (CSV / File / Github) - 保持原樣但微調
// -----------------------------------------------------------

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

function switchMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active'));
    const idx = mode === 'local' ? 0 : 1;
    document.querySelectorAll('.tab-btn')[idx].classList.add('active');
    document.getElementById(`panel-${mode}`).classList.add('active');
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
    localStorage.setItem('gh_config', JSON.stringify({token, user, repo}));
    alert("設定已儲存");
}

// Local File
async function connectLocalFolder() {
    if (!('showDirectoryPicker' in window)) return alert("瀏覽器不支援");
    try {
        localHandle = await window.showDirectoryPicker();
        await localHandle.getDirectoryHandle('assets'); // check
        document.getElementById('local-status').innerText = "✅ 已連接";
        document.getElementById('local-status').className = "status-tag status-ok";
        document.getElementById('local-status').style.display = "inline-block";
    } catch(e) { if(e.name!=='AbortError') alert("連接失敗: "+e.message); }
}

async function loadLocalFile(lang) {
    if(!localHandle) return alert("請先連接資料夾");
    try {
        currentLang = lang;
        const fileHandle = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('data')).then(d=>d.getFileHandle(`data.${lang}.js`));
        const file = await fileHandle.getFile();
        const text = await file.text();
        parseAndRender(text);
        alert(`已載入 data.${lang}.js`);
    } catch(e) { alert("讀取失敗"); }
}

// Github File
async function loadGithubFile(lang) {
    const token = document.getElementById('gh_token').value.trim();
    const user = document.getElementById('gh_user').value.trim();
    const repo = document.getElementById('gh_repo').value.trim();
    if (!token) return alert("請設定 GitHub");
    currentLang = lang;
    try {
        const url = `https://api.github.com/repos/${user}/${repo}/contents/assets/data/data.${lang}.js`;
        const res = await fetch(url, { headers: { 'Authorization': `token ${token}` } });
        if(!res.ok) throw new Error(res.status);
        const data = await res.json();
        parseAndRender(b64ToUtf8(data.content));
        alert(`GitHub: 載入成功 (${lang})`);
    } catch(e) { alert("GitHub 讀取失敗: "+e.message); }
}

// Save
async function saveData() {
    if(!currentData) return alert("無資料");
    const content = `window.${currentVarName} = ${JSON.stringify(currentData, null, 4)};`;
    if(currentMode === 'local') {
        if(!localHandle) return alert("請連接資料夾");
        const fh = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('data')).then(d=>d.getFileHandle(`data.${currentLang}.js`, {create:true}));
        const w = await fh.createWritable();
        await w.write(content);
        await w.close();
        alert("✅ 本機儲存成功");
    } else {
        // Github Save
        const token = document.getElementById('gh_token').value;
        const user = document.getElementById('gh_user').value;
        const repo = document.getElementById('gh_repo').value;
        const url = `https://api.github.com/repos/${user}/${repo}/contents/assets/data/data.${currentLang}.js`;
        
        // 1. Get SHA
        const getRes = await fetch(url, { headers: { 'Authorization': `token ${token}` } });
        let sha = null;
        if(getRes.ok) sha = (await getRes.json()).sha;

        // 2. Put
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Update via Admin',
                content: btoa(unescape(encodeURIComponent(content))),
                sha: sha
            })
        });
        if(res.ok) alert("🎉 GitHub 更新成功");
        else alert("GitHub 更新失敗");
    }
}

// Paste Image
async function handleImagePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let blob = null;
    for (let i=0; i<items.length; i++) {
        if (items[i].type.indexOf("image")===0) { blob = items[i].getAsFile(); break; }
    }
    if(!blob) return;
    e.preventDefault();
    
    if(!confirm("上傳圖片？")) return;
    const filename = `img_${Date.now()}.png`;
    
    // Save logic similar to text but binary... (Simplifying for brevity, assuming local mostly)
    // For local mode:
    if(currentMode==='local' && localHandle) {
        const dir = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('images'));
        const fh = await dir.getFileHandle(filename, {create:true});
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
        insertText(e.target, `{{img:assets/images/${filename}}}`);
    } else {
        alert("圖片貼上功能僅支援本機模式 (或需實作 GitHub 上傳)");
    }
}

function insertText(el, text) {
    const start = el.selectionStart;
    const end = el.selectionEnd;
    el.value = el.value.substring(0, start) + text + el.value.substring(end);
}

// CSV Export/Import (Simplified)
function generateCSVContent() {
    if (!currentData || !currentData.categories) return null;
    const rows = [["category_id", "category_title", "sub_id", "sub_title", "question_id", "question_title", "symptoms", "root_causes", "solution_steps", "keywords", "notes"]];
    currentData.categories.forEach(cat => {
        cat.subcategories.forEach(sub => {
            sub.questions.forEach(q => {
                const c = q.content || {};
                const join = (arr) => Array.isArray(arr) ? arr.join('|') : ""; 
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
    return '\uFEFF' + Papa.unparse(rows);
}

function downloadLocalCSV() {
    const csv = generateCSVContent();
    if(!csv) return alert("無資料");
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `export_${currentLang}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToCSV() {
    if(currentMode === 'local') downloadLocalCSV();
    else alert("GitHub 模式請使用「下載 CSV (本機)」按鈕");
}

function importFromCSV(input) {
    const file = input.files[0];
    if(!file) return;
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            parseCsvRows(results.data);
            input.value = "";
        }
    });
}

function parseCsvRows(rows) {
    // Rebuild data structure from CSV rows
    const newCats = [];
    const catMap = {}; 
    const subMap = {}; 

    rows.forEach(row => {
        if (!row.category_id) return;
        
        let cat = catMap[row.category_id];
        if (!cat) {
            cat = { id: row.category_id, title: row.category_title, subcategories: [] };
            catMap[row.category_id] = cat;
            newCats.push(cat);
        }

        const subKey = row.category_id + "_" + row.sub_id;
        let sub = subMap[subKey];
        if (!sub) {
            sub = { id: row.sub_id, title: row.sub_title, questions: [] };
            subMap[subKey] = sub;
            cat.subcategories.push(sub);
        }

        if(row.question_id) {
            const split = (str) => str ? str.split('|') : [];
            sub.questions.push({
                id: row.question_id,
                title: row.question_title,
                content: {
                    symptoms: split(row.symptoms),
                    rootCauses: split(row.root_causes),
                    solutionSteps: split(row.solution_steps),
                    keywords: split(row.keywords),
                    notes: row.notes || ""
                }
            });
        }
    });
    currentData.categories = newCats;
    renderTree();
    alert("CSV 匯入完成 (請記得儲存)");
}

// GitHub CSV Load (Simplified)
async function loadCsvFromGithub() {
    alert("請先實作 GitHub CSV 下載邏輯 (參照 loadGithubFile)");
}
