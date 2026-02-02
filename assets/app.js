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
    initApp();
});

function initApp() {
    const dataMap = {
        zh: window.FAQ_DATA_ZH, "zh-CN": window.FAQ_DATA_CN,
        en: window.FAQ_DATA_EN, th: window.FAQ_DATA_TH
    };

    if (!dataMap.zh) {
        document.getElementById('main-content').innerHTML = "錯誤：找不到資料檔 (請確認 data.zh.js 是否載入)";
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

// 核心：多語系合併
function mergeData(map) {
    const base = map.zh;
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
                            if(Array.isArray(node.content[k])) node.content[k]={}; // 修正舊格式
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

// ⚠️ 重點：圖片解析器
function parseContent(text) {
    if (!text) return "";
    let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    // 解析 {{img:路徑}}
    return safeText.replace(/\{\{img:([^}]+)\}\}/g, (match, src) => {
        return `<div class="img-container"><img src="${src}" onclick="window.open(this.src,'_blank')" title="點擊放大"></div>`;
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

function initSearch(nodes) {/* 省略，保持原樣 */ }
function handleSearch(val) {/* 省略，保持原樣 */ }
function toggle(el) { el.nextElementSibling.classList.toggle('hidden'); }
