// assets/app.js
let currentLang = 'zh';
let faqData = {}; 
let fuse; // 搜尋引擎實例

// 語言對應資料變數名 (需與 data.js 內一致)
const DATA_VAR_MAP = {
    'zh': 'FAQ_DATA_ZH',
    'cn': 'FAQ_DATA_CN',
    'en': 'FAQ_DATA_EN',
    'th': 'FAQ_DATA_TH'
};

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    
    // 綁定搜尋事件
    document.getElementById('search-input').addEventListener('input', (e) => {
        handleSearch(e.target.value);
    });
});

function initApp() {
    // 載入當前語言資料
    const varName = DATA_VAR_MAP[currentLang];
    if (window[varName]) {
        faqData = window[varName];
        renderSidebar();
        initSearchIndex();
        updateLangButtons();
    } else {
        console.error(`Data for ${currentLang} not found.`);
    }
}

function setLang(lang) {
    currentLang = lang;
    initApp();
    document.getElementById('question-list').innerHTML = '<div style="padding:20px; text-align:center; color:#999;">請選擇左側分類<br>或輸入關鍵字搜尋</div>';
    document.getElementById('content-display').innerHTML = '<div style="text-align:center; margin-top:100px; color:#aaa;"><h2>👋 Welcome</h2></div>';
}

function updateLangButtons() {
    document.querySelectorAll('.lang-switch button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-${currentLang}`).classList.add('active');
}

// 建立 Fuse.js 搜尋索引
function initSearchIndex() {
    let allQuestions = [];
    faqData.categories.forEach(cat => {
        cat.subcategories.forEach(sub => {
            sub.questions.forEach(q => {
                allQuestions.push({
                    ...q,
                    catName: cat.title,
                    subName: sub.title
                });
            });
        });
    });

    const options = {
        keys: ['id', 'title', 'content.keywords', 'content.symptoms'],
        threshold: 0.3 // 模糊程度
    };
    fuse = new Fuse(allQuestions, options);
}

// 渲染左側分類樹
function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';

    faqData.categories.forEach((cat, idx) => {
        const catDiv = document.createElement('div');
        catDiv.className = 'category-item';
        catDiv.textContent = cat.title;
        catDiv.onclick = (e) => toggleCategory(e.target, cat);

        const subList = document.createElement('div');
        subList.className = 'subcategory-list';

        cat.subcategories.forEach(sub => {
            const subDiv = document.createElement('div');
            subDiv.className = 'sub-item';
            subDiv.textContent = sub.title;
            subDiv.onclick = (e) => {
                e.stopPropagation();
                loadQuestions(sub.questions, subDiv);
            };
            subList.appendChild(subDiv);
        });

        sidebar.appendChild(catDiv);
        sidebar.appendChild(subList);
    });
}

function toggleCategory(el, catData) {
    // 切換 active 樣式
    document.querySelectorAll('.category-item').forEach(d => d.classList.remove('active'));
    el.classList.add('active');
}

// 載入問題列表 (中間欄)
function loadQuestions(questions, activeSubEl) {
    // 更新左側選中狀態
    document.querySelectorAll('.sub-item').forEach(el => el.classList.remove('active'));
    if(activeSubEl) activeSubEl.classList.add('active');

    const listPanel = document.getElementById('question-list');
    listPanel.innerHTML = '';

    if (questions.length === 0) {
        listPanel.innerHTML = '<div style="padding:20px; text-align:center;">無資料</div>';
        return;
    }

    questions.forEach(q => {
        const item = document.createElement('div');
        item.className = 'q-item';
        item.innerHTML = `
            <span class="q-title">${q.title}</span>
            <span class="q-id">${q.id}</span>
        `;
        item.onclick = () => renderContent(q);
        listPanel.appendChild(item);
    });
}

// 處理搜尋
function handleSearch(keyword) {
    if (!keyword.trim()) {
        // 清空搜尋時的處理...暫時留白或還原
        return; 
    }
    const results = fuse.search(keyword);
    const listPanel = document.getElementById('question-list');
    listPanel.innerHTML = '';

    results.forEach(res => {
        const q = res.item;
        const item = document.createElement('div');
        item.className = 'q-item';
        item.innerHTML = `
            <span class="q-title">${q.title}</span>
            <div style="font-size:0.8rem; color:#666;">${q.catName} > ${q.subName}</div>
            <span class="q-id">${q.id}</span>
        `;
        item.onclick = () => renderContent(q);
        listPanel.appendChild(item);
    });
}

// 渲染詳細內容 (右側欄)
function renderContent(q) {
    const display = document.getElementById('content-display');
    const c = q.content;

    // 處理圖片標籤 {{img:path}} -> <img src="...">
    const processText = (text) => {
        return text.replace(/{{img:(.*?)}}/g, (match, path) => {
            // 預設為中型尺寸 (size-m)
            return `<div class="img-container size-m"><img src="${path}" onclick="openFullscreen(this.src)"></div>`;
        });
    };

    const renderList = (arr) => {
        if (!arr || arr.length === 0) return '無';
        return arr.map(item => `<div class="step-item">${processText(item)}</div>`).join('');
    };

    const keywordsHtml = (c.keywords || []).map(k => `<span class="keyword-tag">#${k}</span>`).join('');

    display.innerHTML = `
        <div class="content-card">
            <h1 style="color:#2c3e50;">${q.id} - ${q.title}</h1>
            <div style="margin-bottom:20px;">${keywordsHtml}</div>

            <h3 class="section-title">🛑 異常徵兆 (Symptoms)</h3>
            <div class="info-block symptoms">
                ${renderList(c.symptoms)}
            </div>

            <h3 class="section-title">🔍 可能原因 (Root Causes)</h3>
            <div class="info-block causes">
                ${renderList(c.rootCauses)}
            </div>

            <h3 class="section-title">🛠️ 排查與解決 (Solution)</h3>
            <div class="info-block steps">
                ${renderList(c.solutionSteps)}
            </div>

            ${c.notes ? `<div style="margin-top:20px; font-size:0.9rem; color:#666;">📝 備註: ${c.notes}</div>` : ''}
        </div>
    `;
}

// 全螢幕圖片
function openFullscreen(src) {
    const overlay = document.getElementById('fs-overlay');
    const img = document.getElementById('fs-img');
    img.src = src;
    overlay.classList.add('show');
}

function closeFullscreen() {
    document.getElementById('fs-overlay').classList.remove('show');
}
