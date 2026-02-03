const STATE = { mergedData: null, fuse: null, currentLang: 'zh', currentImgSize: 'medium' };

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

    const sizeSelect = document.getElementById('img-size-select');
    if(sizeSelect) {
        const savedSize = localStorage.getItem('faq_img_size') || 'medium';
        STATE.currentImgSize = savedSize;
        sizeSelect.value = savedSize;

        sizeSelect.addEventListener('change', (e) => {
            const newSize = e.target.value;
            STATE.currentImgSize = newSize;
            localStorage.setItem('faq_img_size', newSize);
            updateAllImagesSize();
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
            // 關鍵：加上 ?v=... 參數
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
                        // ✨ 確保 keywords 欄位也被合併
                        ['symptoms','rootCauses','solutionSteps','notes','keywords'].forEach(k => {
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

// 更新圖片尺寸
function updateAllImagesSize() {
    const containers = document.querySelectorAll('.img-container');
    containers.forEach(div => {
        div.classList.remove('img-size-small', 'img-size-medium', 'img-size-large');
        div.classList.add(`img-size-${STATE.currentImgSize}`);
    });
}

// 圖片解析
function parseContent(text) {
    if (!text) return "";
    let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    return safeText.replace(/\{\{img:([^}]+)\}\}/g, (match, src) => {
        const sizeClass = `img-size-${STATE.currentImgSize}`;
        return `<div class="img-container ${sizeClass}"><img src="${src}" onclick="openLightbox('${src}')" title="點擊放大"></div>`;
    });
}

function renderList(label, obj) {
    const list = obj?.[STATE.currentLang];
    if (!list || !list.length) return '';
    return `<div class="section"><h3>${label}</h3><ul>${list.map(i=>`<li>${parseContent(i)}</li>`).join('')}</ul></div>`;
}

// ✨ 渲染關鍵字 (新增)
function renderKeywords(obj) {
    const list = obj?.[STATE.currentLang];
    if (!list || !list.length) return '';
    // 將陣列轉為標籤 HTML
    const tagsHtml = list.map(k => `<span class="keyword-tag">#${parseContent(k)}</span>`).join(' ');
    return `<div class="keywords-box"><strong>關鍵字：</strong> ${tagsHtml}</div>`;
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
                
                <!-- ✨ 顯示關鍵字 -->
                ${renderKeywords(c.keywords)}
            </div>
        `;
        highlightSidebar(id);
    }
}

// 渲染目錄函式 (預設隱藏子層級)
function renderTOC(nodes) {
    let html='<ul class="toc-root">';
    nodes.forEach(cat => {
        html += `
            <li>
                <div class="toc-item cat" onclick="toggle(this)">
                    ${cat.title[STATE.currentLang]} <span class="arrow">▼</span>
                </div>
                <ul class="toc-sub hidden">
        `;
        
        cat.subcategories.forEach(sub => {
            html += `
                <li>
                    <div class="toc-item sub" onclick="toggle(this)">
                        ${sub.title[STATE.currentLang]} <span class="arrow">▼</span>
                    </div>
                    <ul class="toc-q hidden">
            `;
            
            sub.questions.forEach(q => {
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

// 收折切換函式
function toggle(el) { 
    const list = el.nextElementSibling;
    if(list) {
        list.classList.toggle('hidden');
        el.classList.toggle('expanded');
    }
}

// 高亮並自動展開目錄
function highlightSidebar(id) {
    document.querySelectorAll('.toc-link').forEach(el => el.classList.remove('active'));
    const link = document.querySelector(`.toc-link[data-id="${id}"]`);
    if(link) {
        link.classList.add('active');
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

// ✨ 修改：初始化搜尋 (加入 keywords 欄位)
function initSearch(nodes) {
    if (typeof Fuse === 'undefined') return;
    const list = [];
    nodes.forEach(cat => {
        cat.subcategories.forEach(sub => {
            sub.questions.forEach(q => {
                // 將多語系物件攤平為字串，方便搜尋
                const titleStr = Object.values(q.title || {}).join(' ');
                const content = q.content || {};
                
                // 把所有欄位轉成 JSON 字串，包含 keywords
                const contentStr = JSON.stringify(content);

                list.push({
                    id: q.id,
                    title: titleStr,
                    content: contentStr,
                    // 特別把 keywords 獨立出來增加權重 (選用，但 Fuse 也可以直接搜 content)
                    keywords: Object.values(content.keywords || {}).flat().join(' ')
                });
            });
        });
    });
    
    // 設定 Fuse 選項，加入 keywords
    STATE.fuse = new Fuse(list, { 
        keys: [
            { name: 'id', weight: 0.2 },
            { name: 'title', weight: 0.3 },
            { name: 'keywords', weight: 0.4 }, // 關鍵字權重高
            { name: 'content', weight: 0.1 }
        ], 
        threshold: 0.3 
    });
}

// 搜尋處理
function handleSearch(val) {
    val = val.trim();
    const links = document.querySelectorAll('.toc-link');
    
    if(!val) {
        // 清空搜尋時，恢復所有項目的顯示，並保留原有的收折狀態
        // 簡單做法是直接重繪 TOC (會重置收折)，或是只處理 display
        // 為了使用者體驗，這裡選擇只隱藏不符合的 li
        links.forEach(l => {
            const li = l.closest('li');
            li.style.display = '';
            // 恢復收折狀態可能比較複雜，這裡讓它們保持原本的狀態
            // 或者可以選擇重置：
            // renderTOC(STATE.mergedData.categories);
        });
        return;
    }
    
    const res = STATE.fuse.search(val).map(r => r.item.id);
    
    links.forEach(l => {
        const match = res.includes(l.getAttribute('data-id'));
        const li = l.closest('li'); // Question 的 li
        
        if (match) {
            li.style.display = '';
            // 自動展開父層
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
