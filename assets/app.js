const STATE = { mergedData: null, fuse: null, currentLang: 'zh' };

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    STATE.currentLang = urlParams.get('lang') || 'zh';
    
    const langSelect = document.getElementById('lang-select');
    if(langSelect) {
        langSelect.value = STATE.currentLang;
        langSelect.addEventListener('change', (e) => {
            const url = new URL(window.location);
            url.searchParams.set('lang', e.target.value);
            window.location.href = url.toString();
        });
    }
    
    initLightbox();

    // 🚀 動態載入資料 (自動破除快取)
    loadDataScripts().then(() => {
        initApp();
    });
});

// 核心功能：動態插入 script 標籤並加上時間戳記
function loadDataScripts() {
    const langs = ['zh', 'cn', 'en', 'th'];
    const version = new Date().getTime(); // 使用當下時間作為版本號
    
    console.log(`[App] Auto-loading data with version: ${version}`);

    const promises = langs.map(lang => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `assets/data/data.${lang}.js?v=${version}`;
            script.onload = () => {
                console.log(`[App] Loaded data.${lang}.js`);
                resolve();
            };
            script.onerror = () => {
                console.warn(`[App] Failed to load data.${lang}.js (File might not exist yet)`);
                resolve();
            };
            document.body.appendChild(script);
        });
    });

    return Promise.all(promises);
}

function initApp() {
    const dataMap = {
        zh: window.FAQ_DATA_ZH, "zh-CN": window.FAQ_DATA_CN,
        en: window.FAQ_DATA_EN, th: window.FAQ_DATA_TH
    };

    // 檢查是否有載入任何資料
    const base = dataMap.zh || dataMap.en || dataMap["zh-CN"] || dataMap.th;
    
    if (!base) {
        document.getElementById('main-content').innerHTML = `
            <div style="text-align:center; padding:50px; color:#666;">
                <h3>⚠️ 無法讀取資料</h3>
                <p>請確認 admin 後台已成功儲存資料，或稍等 GitHub Pages 更新。</p>
            </div>`;
        return;
    }

    STATE.mergedData = mergeData(dataMap);
    initSearch(STATE.mergedData.categories);

    const searchInput = document.getElementById('search-input');
    if(searchInput) {
        let timer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => handleSearch(e.target.value), 300);
        });
    }
    window.addEventListener('hashchange', renderCurrentHash);
    
    // ✅ 恢復目錄渲染
    renderTOC(STATE.mergedData.categories);
    
    renderCurrentHash();
}

// 多語系合併
function mergeData(map) {
    const base = map.zh || map.en || map["zh-CN"] || map.th;
    const categories = JSON.parse(JSON.stringify(base.categories));
    
    const mergeNode = (nodes, level) => {
        nodes.forEach(node => {
            node.title = {};
            for (const [lang, data] of Object.entries(map)) {
                if(!data) continue;
                const found = findNode(data.categories, node.id, level);
                if(found) {
                    node.title[lang] = found.title;
                    if(level==='q') {
                        node.content = node.content || {};
                        ['symptoms','rootCauses','solutionSteps','notes'].forEach(k => {
                            if(!node.content[k]) node.content[k]={};
                            if(Array.isArray(node.content[k])) node.content[k]={};
                            node.content[k][lang] = found.content?.[k];
                        });
                    }
                }
            }
            if(node.subcategories) mergeNode(node.subcategories, 'sub');
            if(node.questions) mergeNode(node.questions, 'q');
        });
    };
    mergeNode(categories, 'cat');
    return { categories };
}

function findNode(nodes, id, level) {
    if(!nodes) return null;
    for(const cat of nodes) {
        if(level==='cat' && cat.id===id) return cat;
        if(cat.subcategories) {
            for(const sub of cat.subcategories) {
                if(level==='sub' && sub.id===id) return sub;
                if(sub.questions) {
                    const q = sub.questions.find(x => x.id===id);
                    if(level==='q' && q) return q;
                }
            }
        }
    }
    return null;
}

// Lightbox
function initLightbox() {
    const lightbox = document.createElement('div');
    lightbox.id = 'lightbox';
    lightbox.innerHTML = `<span id="lightbox-close">&times;</span><img id="lightbox-img" src="">`;
    document.body.appendChild(lightbox);

    const closeBtn = document.getElementById('lightbox-close');
    const img = document.getElementById('lightbox-img');
    const close = () => { lightbox.classList.remove('active'); img.src=''; };

    closeBtn.onclick = close;
    lightbox.onclick = (e) => { if(e.target===lightbox) close(); };
    document.onkeydown = (e) => { if(e.key==='Escape') close(); };
}

function openLightbox(src) {
    const lb = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    img.src = src;
    lb.classList.add('active');
}

// 圖片解析
function parseContent(text) {
    if (!text) return "";
    let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return safeText.replace(/\{\{img:([^}]+)\}\}/g, (match, src) => {
        return `<div class="img-container"><img src="${src}" onclick="openLightbox('${src}')" title="點擊放大"></div>`;
    });
}

function renderList(label, obj) {
    const list = obj?.[STATE.currentLang];
    if (!list || !list.length) return '';
    return `<div class="section"><h3>${label}</h3><ul>${list.map(i=>`<li>${parseContent(i)}</li>`).join('')}</ul></div>`;
}

function renderCurrentHash() {
    const id = window.location.hash.replace('#', '');
    if(!id) return;
    const q = findNode(STATE.mergedData.categories, id, 'q');
    if(q) {
        const c = q.content || {};
        const note = c.notes?.[STATE.currentLang];
        document.getElementById('main-content').innerHTML = `
            <div class="article">
                <h1>${q.title[STATE.currentLang]||q.id}</h1>
                <div class="meta">ID: ${q.id}</div>
                ${renderList('症狀', c.symptoms)}
                ${renderList('可能原因', c.rootCauses)}
                ${renderList('解決步驟', c.solutionSteps)}
                ${note ? `<div class="note"><b>Note:</b> ${parseContent(note)}</div>` : ''}
            </div>
        `;
        // 點擊連結後自動展開目錄
        highlightSidebar(id);
    }
}

// ✅ 恢復：渲染目錄函式 (預設隱藏子層級)
function renderTOC(nodes) {
    let html='<ul class="toc-root">';
    nodes.forEach(cat => {
        // 第一層 Category
        html += `
            <li>
                <div class="toc-item cat" onclick="toggle(this)">
                    ${cat.title[STATE.currentLang]} <span class="arrow">▼</span>
                </div>
                <ul class="toc-sub hidden">
        `;
        
        cat.subcategories.forEach(sub => {
            // 第二層 Subcategory
            html += `
                <li>
                    <div class="toc-item sub" onclick="toggle(this)">
                        ${sub.title[STATE.currentLang]} <span class="arrow">▼</span>
                    </div>
                    <ul class="toc-q hidden">
            `;
            
            sub.questions.forEach(q => {
                // 第三層 Question
                html += `
                    <li>
                        <a href="#${q.id}" class="toc-link" onclick="renderCurrentHash()" data-id="${q.id}">
                            ${q.title[STATE.currentLang]}
                        </a>
                    </li>
                `;
            });
            html += `</ul></li>`;
        });
        html += `</ul></li>`;
    });
    document.getElementById('sidebar-content').innerHTML = html+'</ul>';
}

// ✅ 恢復：收折切換函式
function toggle(el) { 
    const list = el.nextElementSibling;
    if(list) {
        list.classList.toggle('hidden');
        el.classList.toggle('expanded'); // 控制箭頭旋轉樣式
    }
}

// 高亮並自動展開目錄
function highlightSidebar(id) {
    document.querySelectorAll('.toc-link').forEach(el => el.classList.remove('active'));
    const link = document.querySelector(`.toc-link[data-id="${id}"]`);
    if(link) {
        link.classList.add('active');
        // 向上展開父層
        let parent = link.closest('ul');
        while(parent && !parent.classList.contains('toc-root')) {
            if(parent.classList.contains('hidden')) {
                parent.classList.remove('hidden');
                if(parent.previousElementSibling) parent.previousElementSibling.classList.add('expanded');
            }
            parent = parent.parentElement.closest('ul');
        }
    }
}

function initSearch(nodes) {
    if (typeof Fuse === 'undefined') return;
    const list = [];
    nodes.forEach(cat => {
        cat.subcategories.forEach(sub => {
            sub.questions.forEach(q => {
                list.push({
                    id: q.id,
                    title: Object.values(q.title || {}).join(' '), 
                    content: JSON.stringify(q.content || {})
                });
            });
        });
    });
    STATE.fuse = new Fuse(list, { keys: ['id', 'title', 'content'], threshold: 0.3 });
}

function handleSearch(val) {
    val = val.trim();
    if(!val) {
        renderTOC(STATE.mergedData.categories); 
        return;
    }
    
    const links = document.querySelectorAll('.toc-link');
    const res = STATE.fuse.search(val).map(r => r.item.id);
    
    links.forEach(l => {
        const match = res.includes(l.getAttribute('data-id'));
        const li = l.closest('li'); // Question 的 li
        if(match) {
            li.style.display = '';
            // 搜尋命中時自動展開
            let parent = li.closest('ul');
            while(parent && !parent.classList.contains('toc-root')) {
                parent.classList.remove('hidden');
                if(parent.previousElementSibling) parent.previousElementSibling.classList.add('expanded');
                parent = parent.parentElement.closest('ul');
            }
        } else {
            li.style.display = 'none';
        }
    });
}
