/**
 * assets/app.js - 前台核心
 */
const STATE = {
    mergedData: null, // 合併後的完整資料
    fuse: null,       // 搜尋引擎實體
    currentLang: 'zh'
};

document.addEventListener('DOMContentLoaded', () => {
    // 初始化語言
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

    // 啟動應用
    initApp();
});

function initApp() {
    // 檢查資料是否載入 (容錯：允許部分檔案缺失)
    const dataMap = {
        zh: window.FAQ_DATA_ZH,
        "zh-CN": window.FAQ_DATA_CN,
        en: window.FAQ_DATA_EN,
        th: window.FAQ_DATA_TH
    };

    if (!dataMap.zh && !dataMap.en) {
        document.getElementById('main-content').innerHTML = "錯誤：找不到資料檔 (data.zh.js 或 data.en.js)";
        return;
    }

    // 1. 合併資料 (以繁中或英文為骨幹)
    STATE.mergedData = mergeData(dataMap);

    // 2. 初始化搜尋
    initSearch(STATE.mergedData.categories);

    // 3. 監聽搜尋與導航
    const searchInput = document.getElementById('search-input');
    if(searchInput) {
        let timer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(timer);
            timer = setTimeout(() => handleSearch(e.target.value), 300);
        });
    }

    window.addEventListener('hashchange', renderCurrentHash);

    // 4. 初次渲染
    renderTOC(STATE.mergedData.categories);
    renderCurrentHash();
}

/**
 * 核心：將分散的語言檔合併成 app 易讀的結構
 * 結構轉變： {title: "標題"} -> {title: {zh: "標題", en: "Title"}}
 */
function mergeData(map) {
    const base = map.zh || map.en; // 骨幹

    // 深拷貝避免汙染原始資料
    const categories = JSON.parse(JSON.stringify(base.categories));

    // 遞迴合併 Helper
    const mergeNode = (targetNodes, level) => {
        targetNodes.forEach(node => {
            // 把原本單字串的 title 轉為物件: title: { zh: "..." }
            const originalTitle = node.title;
            node.title = {};

            // 遍歷所有語言填入
            for (const [lang, data] of Object.entries(map)) {
                if (!data) continue;

                // 在該語言資料中尋找對應 ID
                const foundNode = findNodeById(data.categories, node.id, level);
                if (foundNode) {
                    node.title[lang] = foundNode.title;

                    // 如果是問題層級 (Question)，還要合併 content
                    if (level === 'question') {
                        if (!node.content) node.content = { symptoms:{}, rootCauses:{}, solutionSteps:{}, notes:{} };

                        // 初始化多語系容器
                        ['symptoms', 'rootCauses', 'solutionSteps', 'notes'].forEach(key => {
                            if(!node.content[key] || Array.isArray(node.content[key]) || typeof node.content[key] === 'string') {
                                // 如果原本是陣列或字串，重置為物件
                                node.content[key] = {};
                            }
                            node.content[key][lang] = foundNode.content[key];
                        });
                    }
                }
            }

            // 遞迴下一層
            if (node.subcategories) mergeNode(node.subcategories, 'subcategory');
            if (node.questions) mergeNode(node.questions, 'question');
        });
    };

    mergeNode(categories, 'category');
    return { categories };
}

function findNodeById(categories, id, level) {
    if (!categories) return null;
    for (const cat of categories) {
        if (level === 'category' && cat.id === id) return cat;
        if (cat.subcategories) {
            for (const sub of cat.subcategories) {
                if (level === 'subcategory' && sub.id === id) return sub;
                if (sub.questions) {
                    const q = sub.questions.find(q => q.id === id);
                    if (level === 'question' && q) return q;
                }
            }
        }
    }
    return null;
}

// --- 渲染與搜尋邏輯 (與先前類似，但適配多語系物件) ---
function renderTOC(categories) {
    const sidebar = document.getElementById('sidebar-content');
    if(!categories.length) { sidebar.innerHTML = '無資料'; return; }

    let html = '<ul>';
    categories.forEach(cat => {
        const title = pickText(cat.title) || cat.id;
        html += `
            <li class="toc-item-wrap">
                <div class="toc-item cat" onclick="toggle(this)">${esc(title)} <span class="arrow">▼</span></div>
                <ul class="toc-sub hidden">`;
        cat.subcategories.forEach(sub => {
            const subTitle = pickText(sub.title) || sub.id;
            html += `
                <li>
                    <div class="toc-item sub">${esc(subTitle)}</div>
                    <ul class="toc-q">`;
            sub.questions.forEach(q => {
                const qTitle = pickText(q.title) || q.id;
                html += `<li><a href="#${q.id}" class="toc-link" data-id="${q.id}">${esc(qTitle)}</a></li>`;
            });
            html += `</ul></li>`;
        });
        html += `</ul></li>`;
    });
    html += '</ul>';
    sidebar.innerHTML = html;
}

function renderCurrentHash() {
    const id = window.location.hash.replace('#', '');
    if (!id) return;

    // 從合併後的資料找
    const q = findNodeById(STATE.mergedData.categories, id, 'question');
    if (q) {
        const content = q.content || {};
        const html = `
            <div class="article">
                <h1>${esc(pickText(q.title))}</h1>
                <div class="meta">ID: ${q.id}</div>
                ${renderList('症狀', content.symptoms)}
                ${renderList('可能原因', content.rootCauses)}
                ${renderList('解決步驟', content.solutionSteps)}
                ${pickText(content.notes) ? `<div class="note"><b>Note:</b> ${renderRichText(pickText(content.notes))}</div>` : ''}
            </div>
        `;
        document.getElementById('main-content').innerHTML = html;

        // Highlight Sidebar
        document.querySelectorAll('.toc-link').forEach(el => el.classList.remove('active'));
        const link = document.querySelector(`.toc-link[data-id="${id}"]`);
        if(link) {
            link.classList.add('active');
            link.closest('.toc-sub').classList.remove('hidden');
        }
    }
}

function renderList(label, obj) {
    const list = obj[STATE.currentLang]; // 嚴格取當前語言
    if (!list || !list.length) return '';
    return `<div class="section"><h3>${escHtml(label)}</h3><ul>${list.map(i=>`<li>${renderRichText(i)}</li>`).join('')}</ul></div>`;
}

function initSearch(categories) {
    if (typeof Fuse === 'undefined') return;

    // 攤平資料建立索引
    const list = [];
    categories.forEach(cat => {
        cat.subcategories.forEach(sub => {
            sub.questions.forEach(q => {
                list.push({
                    id: q.id,
                    // 搜尋時同時索引所有語言的標題，增加命中率
                    title: Object.values(q.title || {}).join(' '),
                    content: JSON.stringify(q.content || {})
                });
            });
        });
    });

    STATE.fuse = new Fuse(list, {
        keys: ['id', 'title', 'content'],
        threshold: 0.3
    });
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

// Utils
function pickText(obj) { return obj ? (obj[STATE.currentLang] || "") : ""; }

function escHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function escAttr(s) { return escHtml(s); }

// 解析 {{img:path}}，並把文字安全輸出
function renderRichText(str) {
  const s = String(str ?? "");
  const re = /\{\{img:([^}]+)\}\}/g;
  let out = "";
  let last = 0;
  let m;

  while ((m = re.exec(s)) !== null) {
    out += escHtml(s.slice(last, m.index));
    const path = (m[1] || "").trim();
    out += `<img class="faq-img" src="${escAttr(path)}" alt="">`;
    last = re.lastIndex;
  }
  out += escHtml(s.slice(last));
  return out;
}


// 保留舊名字，避免其他地方引用 esc() 壞掉
function esc(t) { return escHtml(t); }

function toggle(el) { el.nextElementSibling.classList.toggle('hidden'); }
