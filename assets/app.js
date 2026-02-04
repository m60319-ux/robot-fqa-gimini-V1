// assets/app.js - V2.0 Three-Column Frontend
let currentLang = 'zh';
let faqData = {}; 
let fuse; 
let activeSub = null; // 當前選中的子分類
let activeQ = null;   // 當前選中的問題

// 語言對應
const DATA_VAR_MAP = {
    'zh': 'FAQ_DATA_ZH', 'cn': 'FAQ_DATA_CN', 'en': 'FAQ_DATA_EN', 'th': 'FAQ_DATA_TH'
};

document.addEventListener('DOMContentLoaded', () => {
    // 優先讀取 URL 參數中的語言設定
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
});

// 動態載入資料檔 (防快取)
function loadDataScripts() {
    const langs = ['zh', 'cn', 'en', 'th'];
    const version = new Date().getTime();
    const promises = langs.map(lang => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = `assets/data/data.${lang}.js?v=${version}`;
            script.onload = resolve;
            script.onerror = resolve; // 忽略錯誤繼續
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

function setLang(lang) {
    currentLang = lang;
    
    // 更新 URL (方便分享連結)
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    window.history.pushState({}, '', url);

    initApp();
    // 清空右側
    document.getElementById('question-list').innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;">請點選左側<br>📂 子分類</div>';
    document.getElementById('content-display').innerHTML = '<div style="text-align:center; margin-top:100px; color:#aaa;"><h2>👋 Welcome</h2></div>';
}

function updateLangButtons() {
    document.querySelectorAll('.lang-switch button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${currentLang}`).classList.add('active');
}

// ------------------------------------------------
// 渲染邏輯 (三欄式)
// ------------------------------------------------

// 1. 左側：分類樹
function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';

    if (!faqData.categories) return;

    faqData.categories.forEach((cat) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'category-item';
        catDiv.textContent = cat.title || cat.id;
        
        const subList = document.createElement('div');
        subList.className = 'subcategory-list';

        if (cat.subcategories) {
            cat.subcategories.forEach(sub => {
                const subDiv = document.createElement('div');
                subDiv.className = 'sub-item';
                if (activeSub === sub) subDiv.classList.add('active');
                subDiv.textContent = sub.title || sub.id;
                subDiv.onclick = (e) => {
                    e.stopPropagation();
                    loadQuestions(sub, subDiv);
                };
                subList.appendChild(subDiv);
            });
        }

        // 點擊分類展開/收合
        catDiv.onclick = () => {
            document.querySelectorAll('.category-item').forEach(c => c.classList.remove('active'));
            catDiv.classList.add('active');
        };

        sidebar.appendChild(catDiv);
        sidebar.appendChild(subList);
    });
}

// 2. 中間：問題列表
function loadQuestions(sub, subDivElement) {
    activeSub = sub;
    
    // 更新左側選中狀態
    document.querySelectorAll('.sub-item').forEach(el => el.classList.remove('active'));
    if(subDivElement) subDivElement.classList.add('active');

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
    if (activeQ === q) item.classList.add('active');
    
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
        
        // 手機版優化：點擊後自動捲動到內容區
        if (window.innerWidth <= 900) {
            document.getElementById('content-display').scrollIntoView({ behavior: 'smooth' });
        }
    };
    container.appendChild(item);
}

// 3. 右側：詳細內容
function renderContent(q) {
    const display = document.getElementById('content-display');
    const c = q.content || {};

    // 處理圖片標籤
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

// ------------------------------------------------
// 搜尋功能
// ------------------------------------------------
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
                                path: `${cat.title} > ${sub.title}` // 用於搜尋結果顯示路徑
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
        // 清空搜尋時，如果當前有選中分類，還原該分類列表
        if (activeSub) {
            loadQuestions(activeSub);
        } else {
            listPanel.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;">請點選左側<br>📂 子分類</div>';
        }
        return;
    }

    // 執行搜尋
    const results = fuse.search(keyword);
    listPanel.innerHTML = '';

    if (results.length === 0) {
        listPanel.innerHTML = '<div style="padding:20px; text-align:center;">查無結果</div>';
        return;
    }

    results.forEach(res => {
        createQuestionItem(res.item, listPanel, true); // true = 顯示路徑
    });
}

// ------------------------------------------------
// 圖片放大功能
// ------------------------------------------------
window.openFullscreen = function(src) {
    const overlay = document.getElementById('fs-overlay');
    const img = document.getElementById('fs-img');
    img.src = src;
    overlay.classList.add('show');
}

window.closeFullscreen = function() {
    document.getElementById('fs-overlay').classList.remove('show');
}
