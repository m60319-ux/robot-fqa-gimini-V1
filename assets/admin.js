// assets/admin.js - V5.3 Visual List Editor (Images as Images)
let currentMode = 'local';
let currentData = null;
let currentVarName = "FAQ_DATA_ZH";
let currentLang = "zh";

let activeNode = null;
let activeParent = null; 
let currentSubNode = null; 
let localHandle = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log("[Admin] DOM Loaded.");
    loadGhConfig();
    
    // 綁定全域貼上事件 (相容舊有 textarea)
    document.addEventListener('paste', handleGlobalPaste);

    injectDownloadButton();

    const panel = document.getElementById('editor-panel');
    if (panel) {
        panel.addEventListener('keydown', (e) => {
            // 如果是在 list-editor 的 input 按 Enter，新增一行
            if (e.key === 'Enter' && e.target.classList.contains('row-input')) {
                e.preventDefault();
                addListRow(e.target.closest('.list-editor-container'));
            }
            // 普通 input 按 Enter 儲存
            else if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.target.classList.contains('row-input')) {
                e.preventDefault(); 
                applyEdit(false);
            }
        });
    }
});

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

function parseAndRender(text) {
    console.log("[Admin] Parsing...");
    try {
        const { varName, jsonText } = extractJsonPayload(text);
        if (varName) currentVarName = varName;
        currentData = JSON.parse(jsonText);
        activeNode = null;
        currentSubNode = null;
        renderTree();
        renderQuestionList();
        document.getElementById('editor-panel').style.display = 'none';
    } catch(e) {
        console.error(e);
        alert(`資料格式錯誤:\n${e.message}`);
    }
}

// -----------------------------------------------------------
// 可視化列表編輯器 (Visual List Editor)
// -----------------------------------------------------------

// 渲染列表 (將 Array 轉為 DOM)
function renderListEditor(containerId, dataArray) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = ''; // 清空

    if (!dataArray) dataArray = [];
    
    // 渲染每一行
    dataArray.forEach(item => {
        const row = createListRow(item);
        container.appendChild(row);
    });

    // 底部「新增一行」按鈕
    const addBtn = document.createElement('div');
    addBtn.className = 'btn-add-row';
    addBtn.innerText = '+ 新增一行';
    addBtn.onclick = () => addListRow(container, addBtn);
    container.appendChild(addBtn);
}

// 建立單行 DOM
function createListRow(content) {
    const row = document.createElement('div');
    row.className = 'list-row';

    // 判斷內容是圖片還是文字
    const isImg = content.trim().startsWith('{{img:') && content.trim().endsWith('}}');
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'row-content';

    if (isImg) {
        // 圖片模式：顯示縮圖 + 隱藏欄位存原始碼
        const src = content.match(/{{img:(.*?)}}/)[1];
        const img = document.createElement('img');
        img.src = src;
        img.className = 'row-img-preview';
        img.title = src;
        
        // 隱藏的 input 用來存 {{img:...}} 字串，方便讀取
        const hiddenInput = document.createElement('input');
        hiddenInput.type = 'hidden';
        hiddenInput.className = 'row-value';
        hiddenInput.value = content;

        contentDiv.appendChild(img);
        contentDiv.appendChild(hiddenInput);
    } else {
        // 文字模式：顯示輸入框
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'row-input row-value';
        input.value = content;
        input.placeholder = '輸入文字或貼上圖片...';
        contentDiv.appendChild(input);
    }

    // 刪除按鈕
    const delBtn = document.createElement('button');
    delBtn.className = 'btn-del-row';
    delBtn.innerHTML = '&times;';
    delBtn.title = '刪除此行';
    delBtn.onclick = () => row.remove();

    row.appendChild(contentDiv);
    row.appendChild(delBtn);

    return row;
}

// 新增一行 (在按鈕之前插入)
function addListRow(container, btnElement) {
    const newRow = createListRow('');
    if (!btnElement) btnElement = container.querySelector('.btn-add-row');
    container.insertBefore(newRow, btnElement);
    
    // 自動聚焦新輸入框
    const input = newRow.querySelector('input[type="text"]');
    if (input) input.focus();
}

// 收集資料 (將 DOM 轉回 Array)
function collectListData(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    const values = [];
    container.querySelectorAll('.row-value').forEach(el => {
        if (el.value.trim() !== '') {
            values.push(el.value);
        }
    });
    return values;
}

// -----------------------------------------------------------
// 核心：載入與儲存
// -----------------------------------------------------------

function loadEditor(item, type, arr, idx) {
    if (activeNode && document.getElementById('editor-panel').style.display !== 'none') {
        applyEdit(true, false); 
    }

    activeNode = item;
    activeParent = { array: arr, index: idx };

    const panel = document.getElementById('editor-panel');
    panel.style.display = 'block';
    
    document.getElementById('node-type').textContent = type.toUpperCase();
    document.getElementById('inp-id').value = item.id || '';
    document.getElementById('inp-title').value = item.title || '';
    
    // 移動分類選單
    const moveDiv = document.getElementById('div-move-group');
    const moveSelect = document.getElementById('inp-parent-sub');
    if (type === 'q') {
        moveDiv.style.display = 'block';
        const parentSub = findParentSubByArray(arr);
        let opts = '';
        currentData.categories.forEach(cat => {
            if(cat.subcategories && cat.subcategories.length > 0) {
                opts += `<optgroup label="${cat.title} (${cat.id})">`;
                cat.subcategories.forEach(sub => {
                    const selected = parentSub && sub === parentSub ? 'selected' : '';
                    opts += `<option value="${sub.id}" ${selected}>${sub.title} (${sub.id})</option>`;
                });
                opts += `</optgroup>`;
            }
        });
        moveSelect.innerHTML = opts;
    } else {
        moveDiv.style.display = 'none';
    }

    // 載入內容
    const qDiv = document.getElementById('q-fields');
    if(type === 'q') {
        qDiv.style.display = 'block';
        const c = item.content || {};
        
        // ✨ 使用新的 Visual List Editor 渲染 ✨
        renderListEditor('container-symptoms', c.symptoms);
        renderListEditor('container-causes', c.rootCauses);
        renderListEditor('container-steps', c.solutionSteps);
        
        // 關鍵字與備註維持 Textarea (關鍵字用 \n 分隔)
        const join = (a) => Array.isArray(a) ? a.join('\n') : (a || "");
        document.getElementById('inp-keywords').value = join(c.keywords);
        document.getElementById('inp-notes').value = c.notes || "";
    } else {
        qDiv.style.display = 'none';
    }
}

function applyEdit(silent = false, checkMove = true) {
    if(!activeNode) return;
    
    if(document.getElementById('inp-id')) activeNode.id = document.getElementById('inp-id').value;
    if(document.getElementById('inp-title')) activeNode.title = document.getElementById('inp-title').value;
    
    const qDiv = document.getElementById('q-fields');
    if(qDiv && qDiv.style.display === 'block') {
        if(!activeNode.content) activeNode.content = {};
        
        // ✨ 從 Visual List Editor 收集資料 ✨
        activeNode.content.symptoms = collectListData('container-symptoms');
        activeNode.content.rootCauses = collectListData('container-causes');
        activeNode.content.solutionSteps = collectListData('container-steps');
        
        // 處理關鍵字
        const split = (id) => {
            const el = document.getElementById(id);
            if (!el) return [];
            let val = el.value;
            if (id === 'inp-keywords') val = val.replace(/[\u3000\+,\/\\、]/g, '\n');
            return val.split('\n').map(x => x.trim()).filter(x => x !== "");
        };
        activeNode.content.keywords = split('inp-keywords');
        
        const notesEl = document.getElementById('inp-notes');
        activeNode.content.notes = notesEl ? notesEl.value : "";

        // 移動分類檢查
        if (checkMove) {
            const newParentId = document.getElementById('inp-parent-sub').value;
            const currentSub = findParentSubByArray(activeParent.array);
            if (currentSub && newParentId && currentSub.id !== newParentId) {
                moveQuestionToSub(activeNode, currentSub, newParentId);
                return;
            }
        }
    }

    renderTree(); 
    if (currentSubNode) renderQuestionList(currentSubNode); 
    
    if (!silent) alert("修改已暫存");
}

// -----------------------------------------------------------
// 圖片貼上處理 (升級版)
// -----------------------------------------------------------
async function handleGlobalPaste(e) {
    const target = e.target;
    // 檢查是否貼在 List Editor 的輸入框內
    const isRowInput = target.classList.contains('row-input');
    const isTextArea = target.tagName === 'TEXTAREA' && target.classList.contains('paste-area');

    if (!isRowInput && !isTextArea) return; // 如果不是在編輯區，不攔截

    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    let blob = null;
    for (let i=0; i<items.length; i++) {
        if (items[i].type.indexOf("image")===0) { blob = items[i].getAsFile(); break; }
    }
    
    if(!blob) return; // 沒有圖片，不處理 (讓預設貼上文字發生)
    
    e.preventDefault(); // 攔截貼上
    
    if(!confirm("偵測到圖片，確定上傳？")) return;
    
    const filename = `img_${Date.now()}.png`;
    const path = `assets/images/${filename}`;
    const imgTag = `{{img:${path}}}`;

    // 儲存檔案
    try {
        if(currentMode==='local' && localHandle) {
            const dir = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('images'));
            const fh = await dir.getFileHandle(filename, {create:true});
            const w = await fh.createWritable();
            await w.write(blob);
            await w.close();
        } else {
            // Github 上傳邏輯 (需要實作 Base64 上傳)
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64 = reader.result.split(',')[1];
                await uploadImageToGithub(filename, base64);
            };
        }
    } catch(err) {
        alert("圖片存檔失敗: " + err.message);
        return;
    }

    // ✨ 插入邏輯 ✨
    if (isRowInput) {
        // 如果是在列表中貼上：
        // 1. 找到當前行
        const currentRow = target.closest('.list-row');
        const container = currentRow.parentElement;
        
        // 2. 建立一個新的圖片行
        const imgRow = createListRow(imgTag);
        
        // 3. 插入在當前行之後
        container.insertBefore(imgRow, currentRow.nextSibling);
        
        // 4. 如果當前輸入框是空的，可以考慮刪除它? 不，保留比較好。
        
        alert("圖片已插入！");
    } else {
        // 如果是在 Textarea (如 Notes)，維持原樣插入文字
        insertText(target, imgTag);
    }
}

// -----------------------------------------------------------
// 輔助與舊函式保持不變
// -----------------------------------------------------------

function renderTree() {
    const root = document.getElementById('tree-root');
    if(!root) return;
    root.innerHTML = '';
    if(!currentData.categories) currentData.categories = [];
    currentData.categories.forEach((cat, i) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'tree-item';
        if(activeNode === cat) catDiv.classList.add('active');
        catDiv.textContent = `📁 [${cat.id}] ${cat.title}`;
        catDiv.onclick = (e) => {
            loadEditor(cat, 'cat', currentData.categories, i);
            currentSubNode = null; renderQuestionList(); renderTree(); 
        };
        root.appendChild(catDiv);
        if(cat.subcategories) {
            cat.subcategories.forEach((sub, j) => {
                const subDiv = document.createElement('div');
                subDiv.className = 'tree-item sub-node';
                if(activeNode === sub || currentSubNode === sub) subDiv.classList.add('active');
                subDiv.textContent = `📂 [${sub.id}] ${sub.title}`;
                subDiv.onclick = (e) => {
                    e.stopPropagation();
                    currentSubNode = sub;
                    loadEditor(sub, 'sub', cat.subcategories, j);
                    renderQuestionList(sub);
                    renderTree(); 
                };
                root.appendChild(subDiv);
            });
        }
    });
}

function renderQuestionList(subNode = null) {
    const listRoot = document.getElementById('list-root');
    listRoot.innerHTML = '';
    if (!subNode) {
        listRoot.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;">請點選左側<br>📂 子分類</div>';
        return;
    }
    if (!subNode.questions || subNode.questions.length === 0) {
        listRoot.innerHTML = '<div style="padding:20px; text-align:center;">(無問題)</div>';
        return;
    }
    subNode.questions.forEach((q, k) => {
        const qItem = document.createElement('div');
        qItem.className = 'q-item';
        if(activeNode === q) qItem.classList.add('active');
        qItem.innerHTML = `<span class="q-title">${q.title || '(未命名)'}</span><span class="q-id">${q.id}</span>`;
        qItem.onclick = () => {
            loadEditor(q, 'q', subNode.questions, k);
            renderQuestionList(subNode); 
        };
        listRoot.appendChild(qItem);
    });
}

function findParentSubByArray(arr) {
    if (!currentData) return null;
    for (const cat of currentData.categories) {
        if (cat.subcategories) {
            for (const sub of cat.subcategories) {
                if (sub.questions === arr) return sub;
            }
        }
    }
    return null;
}

function moveQuestionToSub(questionNode, oldSub, newSubId) {
    let targetSub = null;
    for (const cat of currentData.categories) {
        if (cat.subcategories) {
            const found = cat.subcategories.find(s => s.id === newSubId);
            if (found) { targetSub = found; break; }
        }
    }
    if (!targetSub) { alert("錯誤：找不到目標子分類！"); return; }
    if (confirm(`確定將問題 [${questionNode.id}] 移動到 [${targetSub.title}] 嗎？`)) {
        const idx = oldSub.questions.indexOf(questionNode);
        if (idx > -1) oldSub.questions.splice(idx, 1);
        if (!targetSub.questions) targetSub.questions = [];
        targetSub.questions.push(questionNode);
        activeParent.array = targetSub.questions;
        activeParent.index = targetSub.questions.length - 1;
        currentSubNode = targetSub;
        renderTree(); 
        renderQuestionList(targetSub); 
        alert(`已移動至 ${targetSub.title}`);
    }
}

function addNode(type) { /* ... (維持原樣) ... */ 
    if(!currentData) return alert("請先載入檔案");
    const ts = Date.now().toString().slice(-4);
    if(type === 'cat') {
        currentData.categories.push({ id:`CAT-${ts}`, title:"New Category", subcategories:[] });
        renderTree();
    } else if (type === 'sub') {
        let targetCat = null;
        if (activeNode && activeNode.subcategories) targetCat = activeNode; 
        else if (activeNode && currentData.categories.some(c => c.subcategories && c.subcategories.includes(activeNode))) 
             targetCat = currentData.categories.find(c => c.subcategories.includes(activeNode));
        if (targetCat) {
            targetCat.subcategories.push({ id:`SUB-${ts}`, title:"New Sub", questions:[] });
            renderTree();
        } else alert("請先點選左側「分類」");
    } else if (type === 'q') {
        if (currentSubNode) {
            currentSubNode.questions.push({ id:`Q-${ts}`, title:"New Question", content:{symptoms:[],rootCauses:[],solutionSteps:[],keywords:[],notes:""} });
            renderQuestionList(currentSubNode);
            const newQ = currentSubNode.questions[currentSubNode.questions.length - 1];
            loadEditor(newQ, 'q', currentSubNode.questions, currentSubNode.questions.length - 1);
        } else alert("請先點選左側「子分類」以新增問題");
    }
}
function deleteNode() { /* ... (維持原樣) ... */ 
    if(!activeNode || !activeParent) return alert("請先選擇項目");
    if(confirm("確定刪除此項目？")) {
        activeParent.array.splice(activeParent.index, 1);
        if (activeNode === currentSubNode) { currentSubNode = null; renderQuestionList(); }
        activeNode = null;
        document.getElementById('editor-panel').style.display = 'none';
        renderTree();
        if (currentSubNode) renderQuestionList(currentSubNode);
    }
}
function filterQuestionList(val) { /* ... (維持原樣) ... */ 
    const items = document.querySelectorAll('#list-root .q-item');
    val = val.toLowerCase();
    items.forEach(item => {
        const text = item.innerText.toLowerCase();
        item.style.display = text.includes(val) ? 'block' : 'none';
    });
}
function b64ToUtf8(b64) { try { const clean = (b64 || "").replace(/\s/g, ""); const bytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0)); return new TextDecoder("utf-8").decode(bytes); } catch (e) { return decodeURIComponent(escape(atob(b64))); } }
function extractJsonPayload(text) { const t = text.replace(/^\uFEFF/, "").trim(); if (t.startsWith("{") || t.startsWith("[")) return { varName: null, jsonText: t }; let m = t.match(/(?:window\.|const\s+|var\s+|let\s+)(\w+)\s*=\s*(\{[\s\S]*\})\s*;?\s*$/); if (m) return { varName: m[1], jsonText: m[2] }; const fb = t.indexOf('{'), lb = t.lastIndexOf('}'); if (fb !== -1 && lb !== -1) return { varName: "FAQ_DATA_UNKNOWN", jsonText: t.substring(fb, lb + 1) }; throw new Error("無法識別檔案格式"); }
function switchMode(mode) { currentMode = mode; document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.mode-panel').forEach(p => p.classList.remove('active')); const idx = mode === 'local' ? 0 : 1; document.querySelectorAll('.tab-btn')[idx].classList.add('active'); document.getElementById(`panel-${mode}`).classList.add('active'); }
function loadGhConfig() { try { const conf = JSON.parse(localStorage.getItem('gh_config')); if(conf) { document.getElementById('gh_token').value = conf.token || ''; document.getElementById('gh_user').value = conf.user || ''; document.getElementById('gh_repo').value = conf.repo || ''; } } catch(e) {} }
function saveGhConfig() { const t = document.getElementById('gh_token').value.trim(), u = document.getElementById('gh_user').value.trim(), r = document.getElementById('gh_repo').value.trim(); localStorage.setItem('gh_config', JSON.stringify({token: t, user: u, repo: r})); alert("設定已儲存"); }
async function connectLocalFolder() { if (!('showDirectoryPicker' in window)) return alert("瀏覽器不支援"); try { localHandle = await window.showDirectoryPicker(); await localHandle.getDirectoryHandle('assets'); document.getElementById('local-status').innerText = "✅ 已連接"; document.getElementById('local-status').className = "status-tag status-ok"; document.getElementById('local-status').style.display = "inline-block"; } catch(e) { if(e.name!=='AbortError') alert("連接失敗: "+e.message); } }
async function loadLocalFile(lang) { if(!localHandle) return alert("請先連接資料夾"); try { currentLang = lang; const fh = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('data')).then(d=>d.getFileHandle(`data.${lang}.js`)); const f = await fh.getFile(); const t = await f.text(); parseAndRender(t); alert(`已載入 data.${lang}.js`); } catch(e) { alert("讀取失敗"); } }
async function loadGithubFile(lang) { const t = document.getElementById('gh_token').value.trim(), u = document.getElementById('gh_user').value.trim(), r = document.getElementById('gh_repo').value.trim(); if (!t) return alert("請設定 GitHub"); currentLang = lang; try { const url = `https://api.github.com/repos/${u}/${r}/contents/assets/data/data.${lang}.js`; const res = await fetch(url, { headers: { 'Authorization': `token ${t}` } }); if(!res.ok) throw new Error(res.status); const data = await res.json(); parseAndRender(b64ToUtf8(data.content)); alert(`GitHub: 載入成功 (${lang})`); } catch(e) { alert("GitHub 讀取失敗: "+e.message); } }
async function saveData() { if(!currentData) return alert("無資料"); const content = `window.${currentVarName} = ${JSON.stringify(currentData, null, 4)};`; if(currentMode === 'local') { if(!localHandle) return alert("請連接資料夾"); const fh = await localHandle.getDirectoryHandle('assets').then(d=>d.getDirectoryHandle('data')).then(d=>d.getFileHandle(`data.${currentLang}.js`, {create:true})); const w = await fh.createWritable(); await w.write(content); await w.close(); alert("✅ 本機儲存成功"); } else { const t = document.getElementById('gh_token').value, u = document.getElementById('gh_user').value, r = document.getElementById('gh_repo').value; const url = `https://api.github.com/repos/${u}/${r}/contents/assets/data/data.${currentLang}.js`; const gr = await fetch(url, { headers: { 'Authorization': `token ${t}` } }); let sha = null; if(gr.ok) sha = (await gr.json()).sha; const res = await fetch(url, { method: 'PUT', headers: { 'Authorization': `token ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Update via Admin', content: btoa(unescape(encodeURIComponent(content))), sha: sha }) }); if(res.ok) alert("🎉 GitHub 更新成功"); else alert("GitHub 更新失敗"); } }
async function uploadImageToGithub(filename, base64) { const t = document.getElementById('gh_token').value, u = document.getElementById('gh_user').value, r = document.getElementById('gh_repo').value; const url = `https://api.github.com/repos/${u}/${r}/contents/assets/images/${filename}`; await fetch(url, { method: 'PUT', headers: { 'Authorization': `token ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Upload ${filename}`, content: base64 }) }); }
function insertText(el, text) { const s = el.selectionStart, e = el.selectionEnd; el.value = el.value.substring(0, s) + text + el.value.substring(e); }
function downloadLocalCSV() { const c = generateCSVContent(); if(!c) return alert("無資料"); const b = new Blob([c], { type: 'text/csv;charset=utf-8;' }); const u = URL.createObjectURL(b); const l = document.createElement("a"); l.href = u; l.download = `export_${currentLang}.csv`; document.body.appendChild(l); l.click(); document.body.removeChild(l); }
function exportToCSV() { if(currentMode === 'local') downloadLocalCSV(); else alert("GitHub 模式請使用「下載 CSV (本機)」按鈕"); }
function importFromCSV(i) { const f = i.files[0]; if(!f) return; Papa.parse(f, { header: true, skipEmptyLines: true, complete: function(r) { parseCsvRows(r.data); i.value = ""; } }); }
function generateCSVContent() { if (!currentData || !currentData.categories) return null; const rows = [["category_id", "category_title", "sub_id", "sub_title", "question_id", "question_title", "symptoms", "root_causes", "solution_steps", "keywords", "notes"]]; currentData.categories.forEach(cat => { cat.subcategories.forEach(sub => { sub.questions.forEach(q => { const c = q.content || {}; const join = (arr) => Array.isArray(arr) ? arr.join('|') : ""; rows.push([ cat.id, cat.title, sub.id, sub.title, q.id, q.title, join(c.symptoms), join(c.rootCauses), join(c.solutionSteps), join(c.keywords), c.notes || "" ]); }); }); }); return '\uFEFF' + Papa.unparse(rows); }
function parseCsvRows(rows) { const nCats = []; const cMap = {}; const sMap = {}; rows.forEach(r => { if (!r.category_id) return; let c = cMap[r.category_id]; if (!c) { c = { id: r.category_id, title: r.category_title, subcategories: [] }; cMap[r.category_id] = c; nCats.push(c); } const sKey = r.category_id + "_" + r.sub_id; let s = sMap[sKey]; if (!s) { s = { id: r.sub_id, title: r.sub_title, questions: [] }; sMap[sKey] = s; c.subcategories.push(s); } if(r.question_id) { const split = (str) => str ? str.split('|') : []; s.questions.push({ id: r.question_id, title: r.question_title, content: { symptoms: split(r.symptoms), rootCauses: split(r.root_causes), solutionSteps: split(r.solution_steps), keywords: split(r.keywords), notes: r.notes || "" } }); } }); currentData.categories = nCats; renderTree(); alert("CSV 匯入完成 (請記得儲存)"); }
async function loadCsvFromGithub() { alert("請先實作 GitHub CSV 下載邏輯 (參照 loadGithubFile)"); }
