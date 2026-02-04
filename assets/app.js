// assets/app.js - V2.7 Localized UI Labels
let currentLang = 'zh';
let faqData = {}; 
let fuse; 
let activeSub = null; // 當前選中的子分類物件
let activeQ = null;   // 當前選中的問題物件

const DATA_VAR_MAP = {
    'zh': 'FAQ_DATA_ZH', 'cn': 'FAQ_DATA_CN', 'en': 'FAQ_DATA_EN', 'th': 'FAQ_DATA_TH'
};

// ✨ 定義搜尋欄位
const SEARCH_KEYS = ['id', 'title', 'content.keywords', 'content.symptoms'];

// ✨✨✨ 新增：UI 標籤多語系對照表 ✨✨✨
const UI_LABELS = {
    'zh': {
        symptoms: '🛑 異常徵兆 (Symptoms)',
        rootCauses: '🔍 可能原因 (Root Causes)',
        solutions: '🛠️ 排查與解決 (Solution)',
        note: '備註'
    },
    'cn': {
        symptoms: '🛑 异常征兆 (Symptoms)',
        rootCauses: '🔍 可能原因 (Root Causes)',
        solutions: '🛠️ 排查与解决 (Solution)',
        note: '备注'
    },
    'en': {
        symptoms: '🛑 Symptoms',
        rootCauses: '🔍 Root Causes',
        solutions: '🛠️ Solution',
        note: 'Note'
    },
    'th': {
        symptoms: '🛑 อาการ (Symptoms)',
        rootCauses: '🔍 สาเหตุ (Root Causes)',
        solutions: '🛠️ วิธีแก้ไข (Solution)',
        note: 'หมายเหตุ'
    }
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

function setLang(lang) {
    const currentQId = activeQ ? activeQ.id : null;
    
    currentLang = lang;
    const url = new URL(window.location);
    url.searchParams.set('lang', lang);
    window.history.pushState({}, '', url);

    initApp();
    
    if (currentQId) {
        const result = findPathById(currentQId);
        if (result) {
            activeQ = result.q;
            activeSub = result.sub;
            renderContent(result.q);
            loadQuestions(result.sub);
            highlightSidebar(result.cat.id, result.sub.id);
        } else {
            resetToWelcome();
        }
    } else {
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
// 輔助邏輯
// ------------------------------------------------

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

function highlightSidebar(catId, subId) {
    const catEl = document.querySelector(`.category-item[data-id="${catId}"]`);
    if (catEl) {
        document.querySelectorAll('.category-item').forEach(c => c.classList.remove('active'));
        catEl.classList.add('active');
    }
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
        catDiv.dataset.id = cat.id;
        
        const subList = document.createElement('div');
        subList.className = 'subcategory-list';

        if (cat.subcategories) {
            cat.subcategories.forEach(sub => {
                const subDiv = document.createElement('div');
                subDiv.className = 'sub-item';
                subDiv.textContent = sub.title || sub.id;
                subDiv.dataset.id = sub.id;
                
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

    // ✨ 取得當前語言的標籤 (預設英文)
    const labels = UI_LABELS[currentLang] || UI_LABELS['en'];

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

    // ✨ 渲染時使用變數 labels.symptoms 等
    display.innerHTML = `
        <div class="content-card">
            <h1 style="color:#2c3e50; margin-bottom:10px;">${q.title}</h1>
            <div style="color:#888; font-size:0.9em; margin-bottom:15px;">ID: ${q.id}</div>
            <div style="margin-bottom:25px;">${keywordsHtml}</div>

            <h3 class="section-title" style="color:#e74c3c;">${labels.symptoms}</h3>
            <div class="info-block symptoms">
                ${renderList(c.symptoms)}
            </div>

            <h3 class="section-title" style="color:#f39c12;">${labels.rootCauses}</h3>
            <div class="info-block causes">
                ${renderList(c.rootCauses)}
            </div>

            <h3 class="section-title" style="color:#27ae60;">${labels.solutions}</h3>
            <div class="info-block steps">
                ${renderList(c.solutionSteps)}
            </div>

            ${c.notes ? `<div style="margin-top:30px; padding:15px; background:#fff3cd; border-radius:4px; color:#856404;">📝 <b>${labels.note}:</b><br>${processText(c.notes)}</div>` : ''}
        </div>
    `;
}

// ------------------------------------------------
// 搜尋設定與功能
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
                                path: `${cat.title} > ${sub.title}`
                            });
                        });
                    }
                });
            }
        });
    }

    const options = {
        keys: SEARCH_KEYS,
        threshold: 0.3, 
        useExtendedSearch: true,
        ignoreLocation: true,
        findAllMatches: true
    };
    fuse = new Fuse(allQuestions, options);
}

function handleSearch(keyword) {
    const listPanel = document.getElementById('question-list');
    
    if (!keyword || !keyword.trim()) {
        if (activeSub) {
            loadQuestions(activeSub);
        } else {
            listPanel.innerHTML = '<div style="padding:40px 20px; text-align:center; color:#999;">請點選左側<br>📂 子分類</div>';
        }
        return;
    }

    const terms = keyword.replace(/　/g, ' ')
                         .split(/[\s,\u3001/\\]+/)
                         .filter(t => t.trim().length > 0);
    
    const logicQuery = {
        $and: terms.map(term => ({
            $or: SEARCH_KEYS.map(key => ({ [key]: term }))
        }))
    };

    const results = fuse.search(logicQuery);
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
