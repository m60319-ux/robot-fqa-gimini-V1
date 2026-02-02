// assets/app.js - Auto Cache Busting Version
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

    // 🚀 新增：動態載入資料 (自動破除快取)
    // 這會確保每次重新整理都抓到最新的 data.js
    loadDataScripts().then(() => {
        initApp();
    });
});

// 🚀 核心功能：動態插入 script 標籤並加上時間戳記
function loadDataScripts() {
    const langs = ['zh', 'cn', 'en', 'th'];
    const version = new Date().getTime(); // 使用當下時間作為版本號，保證最新
    
    console.log(`[App] Loading data with version: ${version}`);

    const promises = langs.map(lang => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            // 關鍵：加上 ?v=... 參數
            script.src = `assets/data/data.${lang}.js?v=${version}`;
            script.onload = () => {
                console.log(`[App] Loaded data.${lang}.js`);
                resolve();
            };
            script.onerror = () => {
                console.warn(`[App] Failed to load data.${lang}.js (File might not exist yet)`);
                resolve(); // 失敗也繼續，避免卡死整個 App
            };
            document.body.appendChild(script);
        });
    });

    return Promise.all(promises);
}

function initApp() {
    const dataMap = {
        zh: window.FAQ_DATA_ZH, 
        "zh-CN": window.FAQ_DATA_CN,
        en: window.FAQ_DATA_EN, 
        th: window.FAQ_DATA_TH
    };

    // 檢查是否有載入任何資料
    const base = dataMap.zh || dataMap.en || dataMap["zh-CN"] || dataMap.th;
    
    if (!base) {
        document.getElementById('main-content').innerHTML = `
            <div style="text-align:center; padding:50px; color:#666;">
                <h3>⚠️ 無法讀取資料</h3>
                <p>請檢查 data.zh.js 是否存在，或 GitHub Pages 是否已部署完成。</p>
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
    renderTOC(STATE.mergedData.categories);
    renderCurrentHash();
}

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
    }
}

function renderTOC(nodes) {
    let html='<ul>';
    nodes.forEach(cat => {
        html += `<li><div class="toc-item cat" onclick="toggle(this)">${cat.title[STATE.currentLang]} ▼</div><ul class="toc-sub hidden">`;
        cat.subcategories.forEach(sub => {
            html += `<li><div class="toc-item sub">${sub.title[STATE.currentLang]}</div><ul class="toc-q">`;
            sub.questions.forEach(q => {
                html += `<li><a href="#${q.id}" class="toc-link" onclick="renderCurrentHash()">${q.title[STATE.currentLang]}</a></li>`;
            });
            html += `</ul></li>`;
        });
        html += `</ul></li>`;
    });
    document.getElementById('sidebar-content').innerHTML = html+'</ul>';
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
    const links = document.querySelectorAll('.toc-link');
    if(!val) {
        links.forEach(l => l.closest('li').style.display = '');
        return;
    }
    const res = STATE.fuse.search(val).map(r => r.item.id);
    links.forEach(l => {
        const match = res.includes(l.getAttribute('data-id'));
        l.closest('li').style.display = match ? '' : 'none';
        if(match) l.closest('.toc-sub').classList.remove('hidden');
    });
}

function toggle(el) { el.nextElementSibling.classList.toggle('hidden'); }
