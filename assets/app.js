// assets/app.js - V2.3 Seamless Language Switch
let currentLang = 'zh';
let faqData = {}; 
let fuse; 
let activeSub = null; // 當前選中的子分類物件
let activeQ = null;   // 當前選中的問題物件

const DATA_VAR_MAP = {
    'zh': 'FAQ_DATA_ZH', 'cn': 'FAQ_DATA_CN', 'en': 'FAQ_DATA_EN', 'th': 'FAQ_DATA_TH'
};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    if (langParam && DATA_VAR_MAP[langParam]) {
        currentLang = langParam;
    }

    loadDataScripts().then(() => {
        initApp();
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });

    window.addEventListener('click', () => {
        const menu = document.getElementById('lang-menu');
        if (menu) menu.classList.remove('show');
    });
});

window.toggleLangMenu = function(e) {
    e.stopPropagation(); 
    document.getElementById('lang-menu').classList.toggle('show');
}

function loadDataScripts() {
    const langs = ['zh', 'cn', 'en', 'th'];
    const version = new Date().getTime();
    const promises = langs.map(lang => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `assets/data/data.${lang}.js?v=${version}`;
            script.onload = resolve;
            script.onerror = resolve; 
            document.body.appendChild(script);
        });
    });
    return Promise.all(promises);
}

function initApp() {
    const varName = DATA_VAR_MAP[currentLang];
    if (window[varName]) {
        faqData = window[varName];
        renderSidebar();
        initSearchIndex();
        updateLangButtons();
    } else {
        document.getElementById('sidebar').innerHTML = '<p style="padding:20px">載入資料失敗</p>';
    }
}

// ✨✨✨ 關鍵修改：切換語言時保留當前畫面 ✨✨✨
function setLang(lang) {
    // 1. 記錄當前正在看的 ID (如果有的話)
    const currentQId = activeQ ? activeQ.id : null;
    
    currentLang = lang;
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    window.history.pushState({}, '', url);

    // 2. 重新載入新語言資料
    initApp();
    
    // 3. 嘗試還原狀態
    if (currentQId) {
        // 在新資料中尋找同一個 ID
        const result = findPathById(currentQId);
        
        if (result) {
            // 找到了！還原變數指向新物件
            activeQ = result.q;
            activeSub = result.sub;
            
            // 重新渲染三欄
            renderContent(result.q);      // 右欄
            loadQuestions(result.sub);    // 中欄
            highlightSidebar(result.cat.id, result.sub.id); // 左欄 (自動展開)
        } else {
            // 新語言沒這題，只好回首頁
            resetToWelcome();
        }
    } else {
        // 原本就沒在看題目
        resetToWelcome();
    }
    
    document.getElementById('lang-menu').classList.remove('show');
}

function resetToWelcome() {
    document.getElementById('question-list').innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;">請點選左側<br>📂 子分類</div>';
    document.getElementById('content-display').innerHTML = '<div style="text-align:center; margin-top:100px; color:#aaa;"><h2>👋 Welcome</h2></div>';
}

function updateLangButtons() {
    document.querySelectorAll('.lang-option').forEach(opt => opt.classList.remove('active'));
    const activeOpt = document.getElementById(`opt-${currentLang}`);
    if(activeOpt) activeOpt.classList.add('active');
}

// ------------------------------------------------
// 輔助邏輯：ID 搜尋與狀態還原
// ------------------------------------------------

// 在資料庫中尋找 ID 的完整路徑 (Category -> Sub -> Question)
function findPathById(qId) {
    if (!faqData.categories) return null;
    for (const cat of faqData.categories) {
        if (cat.subcategories) {
            for (const sub of cat.subcategories) {
                if (sub.questions) {
                    const q = sub.questions.find(item => item.id === qId);
                    if (q) return { cat, sub, q };
                }
            }
        }
    }
    return null;
}

// 自動展開並高亮左側選單
function highlightSidebar(catId, subId) {
    // 1. 找到並展開分類
    const catEl = document.querySelector(`.category-item[data-id="${catId}"]`);
    if (catEl) {
        document.querySelectorAll('.category-item').forEach(c => c.classList.remove('active'));
        catEl.classList.add('active');
    }
    
    // 2. 高亮子分類
    const subEl = document.querySelector(`.sub-item[data-id="${subId}"]`);
    if (subEl) {
        document.querySelectorAll('.sub-item').forEach(s => s.classList.remove('active'));
        subEl.classList.add('active');
    }
}

// ------------------------------------------------
// 渲染邏輯
// ------------------------------------------------

function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';

    if (!faqData.categories) return;

    faqData.categories.forEach((cat) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'category-item';
        catDiv.textContent = cat.title || cat.id;
        catDiv.dataset.id = cat.id; // ✨ 綁定 ID 以便查找
        
        const subList = document.createElement('div');
        subList.className = 'subcategory-list';

        if (cat.subcategories) {
            cat.subcategories.forEach(sub => {
                const subDiv = document.createElement('div');
                subDiv.className = 'sub-item';
                subDiv.textContent = sub.title || sub.id;
                subDiv.dataset.id = sub.id; // ✨ 綁定 ID 以便查找
                
                // 如果是剛切換語言還原狀態，需要檢查是否為當前 Sub
                if (activeSub && activeSub.id === sub.id) subDiv.classList.add('active');

                subDiv.onclick = (e) => {
                    e.stopPropagation();
                    loadQuestions(sub, subDiv);
                };
                subList.appendChild(subDiv);
            });
        }

        catDiv.onclick = () => {
            document.querySelectorAll('.category-item').forEach(c => c.classList.remove('active'));
            catDiv.classList.add('active');
        };

        sidebar.appendChild(catDiv);
        sidebar.appendChild(subList);
    });
}

function loadQuestions(sub, subDivElement) {
    activeSub = sub;
    
    // 如果有傳入 DOM 元素就直接操作，沒有的話 (從 setLang 呼叫) 就不用管，交給 highlightSidebar 處理
    if(subDivElement) {
        document.querySelectorAll('.sub-item').forEach(el => el.classList.remove('active'));
        subDivElement.classList.add('active');
    }

    const listPanel = document.getElementById('question-list');
    listPanel.innerHTML = '';

    if (!sub.questions || sub.questions.length === 0) {
        listPanel.innerHTML = '<div style="padding:20px; text-align:center;">(此分類無問題)</div>';
        return;
    }

    sub.questions.forEach(q => {
        createQuestionItem(q, listPanel);
    });
}

function createQuestionItem(q, container, showPath = false) {
    const item = document.createElement('div');
    item.className = 'q-item';
    
    // 檢查 ID 是否匹配以設定高亮
    if (activeQ && activeQ.id === q.id) item.classList.add('active');
    
    let html = `<span class="q-title">${q.title}</span>`;
    if (showPath) {
        html += `<div style="font-size:0.8rem; color:#666; margin-bottom:4px;">${q.path || ''}</div>`;
    }
    html += `<span class="q-id">${q.id}</span>`;
    
    item.innerHTML = html;
    item.onclick = () => {
        activeQ = q;
        document.querySelectorAll('.q-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        renderContent(q);
    };
    container.appendChild(item);
}

function renderContent(q) {
    const display = document.getElementById('content-display');
    const c = q.content || {};

    const processText = (text) => {
        if (!text) return "";
        return text.replace(/{{img:(.*?)}}/g, (match, path) => {
            return `<div class="img-container img-size-medium"><img src="${path}" onclick="openFullscreen(this.src)"></div>`;
        });
    };

    const renderList = (arr) => {
        if (!arr || arr.length === 0) return '無';
        return arr.map(item => `<div class="step-item">${processText(item)}</div>`).join('');
    };

    const keywordsHtml = (c.keywords || []).map(k => `<span class="keyword-tag">#${k}</span>`).join('');

    display.innerHTML = `
        <div class="content-card">
            <h1 style="color:#2c3e50; margin-bottom:10px;">${q.title}</h1>
            <div style="color:#888; font-size:0.9em; margin-bottom:15px;">ID: ${q.id}</div>
            <div style="margin-bottom:25px;">${keywordsHtml}</div>

            <h3 class="section-title" style="color:#e74c3c;">🛑 異常徵兆 (Symptoms)</h3>
            <div class="info-block symptoms">
                ${renderList(c.symptoms)}
            </div>

            <h3 class="section-title" style="color:#f39c12;">🔍 可能原因 (Root Causes)</h3>
            <div class="info-block causes">
                ${renderList(c.rootCauses)}
            </div>

            <h3 class="section-title" style="color:#27ae60;">🛠️ 排查與解決 (Solution)</h3>
            <div class="info-block steps">
                ${renderList(c.solutionSteps)}
            </div>

            ${c.notes ? `<div style="margin-top:30px; padding:15px; background:#fff3cd; border-radius:4px; color:#856404;">📝 <b>備註:</b><br>${processText(c.notes)}</div>` : ''}
        </div>
    `;
}

function initSearchIndex() {
    if (typeof Fuse === 'undefined') return;
    
    let allQuestions = [];
    if (faqData.categories) {
        faqData.categories.forEach(cat => {
            if (cat.subcategories) {
                cat.subcategories.forEach(sub => {
                    if (sub.questions) {
                        sub.questions.forEach(q => {
                            allQuestions.push({
                                ...q,
                                path: `${cat.title} > ${sub.title}`
                            });
                        });
                    }
                });
            }
        });
    }

    const options = {
        keys: ['id', 'title', 'content.keywords', 'content.symptoms'],
        threshold: 0.3,
        useExtendedSearch: true
    };
    fuse = new Fuse(allQuestions, options);
}

function handleSearch(keyword) {
    const listPanel = document.getElementById('question-list');
    
    if (!keyword.trim()) {
        if (activeSub) {
            loadQuestions(activeSub);
        } else {
            listPanel.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;">請點選左側<br>📂 子分類</div>';
        }
        return;
    }

    const results = fuse.search(keyword);
    listPanel.innerHTML = '';

    if (results.length === 0) {
        listPanel.innerHTML = '<div style="padding:20px; text-align:center;">查無結果</div>';
        return;
    }

    results.forEach(res => {
        createQuestionItem(res.item, listPanel, true);
    });
}

window.openFullscreen = function(src) {
    const overlay = document.getElementById('fs-overlay');
    const img = document.getElementById('fs-img');
    img.src = src;
    overlay.classList.add('show');
}

window.closeFullscreen = function() {
    document.getElementById('fs-overlay').classList.remove('show');
}
