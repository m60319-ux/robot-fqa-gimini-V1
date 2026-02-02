// assets/app.js - Auto Cache Busting Version
// 渲染目錄 (修改：預設收折)
function renderTOC(nodes) {
    let html = '<ul class="toc-root">';
    nodes.forEach(cat => {
        // 第一層 (Category): 預設加上 arrow
        // 點擊事件綁定在 toc-item 上
        html += `
            <li>
                <div class="toc-item cat" onclick="toggle(this)">
                    <span>${cat.title[STATE.currentLang]}</span>
                    <span class="arrow">▼</span>
                </div>
                <!-- 預設加上 hidden class 來隱藏子選單 -->
                <ul class="toc-sub hidden">
        `;
        
        cat.subcategories.forEach(sub => {
            // 第二層 (Subcategory)
            html += `
                <li>
                    <div class="toc-item sub" onclick="toggle(this)">
                        <span>${sub.title[STATE.currentLang]}</span>
                        <span class="arrow">▼</span>
                    </div>
                    <!-- 預設加上 hidden class -->
                    <ul class="toc-q hidden">
            `;
            
            sub.questions.forEach(q => {
                // 第三層 (Question): 點擊後不收折，而是顯示內容
                html += `
                    <li>
                        <a href="#${q.id}" class="toc-link" onclick="renderCurrentHash()">
                            ${q.title[STATE.currentLang]}
                        </a>
                    </li>
                `;
            });
            html += `</ul></li>`;
        });
        html += `</ul></li>`;
    });
    document.getElementById('sidebar-content').innerHTML = html + '</ul>';
}

function initApp() {
// 切換收折狀態 (修改：增加箭頭旋轉)
function toggle(el) {
    // 1. 找到下一個兄弟元素 (也就是 ul 列表)
    const list = el.nextElementSibling;
    
    if (list) {
        // 2. 切換 hidden class (顯示/隱藏)
        list.classList.toggle('hidden');
        
        // 3. 切換 expanded class (控制箭頭旋轉)
        el.classList.toggle('expanded');
    }
}

// 搜尋功能需要特別處理：搜尋時要自動展開
function handleSearch(val) {
    val = val.trim();
    const links = document.querySelectorAll('.toc-link');
    
    if(!val) {
        // 清空搜尋時，恢復所有項目的顯示，但保持預設收折狀態
        // 這裡簡單重繪比較快，或者只隱藏不符合的
        renderTOC(STATE.mergedData.categories); 
        return;
    }
    
    const res = STATE.fuse.search(val).map(r => r.item.id);
    
    links.forEach(l => {
        const match = res.includes(l.getAttribute('data-id'));
        const li = l.closest('li'); // Question 的 li
        
        if (match) {
            // 顯示該問題
            li.style.display = '';
            
            // 自動展開父層 (Subcategory UL)
            const subUl = li.closest('.toc-q');
            if(subUl) {
                subUl.classList.remove('hidden');
                // 讓 Subcategory 標題箭頭轉向
                subUl.previousElementSibling.classList.add('expanded');
                
                // 自動展開爺爺層 (Category UL)
                const catUl = subUl.closest('.toc-sub');
                if(catUl) {
                    catUl.classList.remove('hidden');
                    catUl.previousElementSibling.classList.add('expanded');
                }
            }
        } else {
            // 隱藏不符合的問題
            li.style.display = 'none';
        }
    });
}

// 當點擊連結後，自動展開該路徑 (UX優化)
function highlightSidebar(id) {
    // 先移除所有 active
    document.querySelectorAll('.toc-link').forEach(el => el.classList.remove('active'));
    
    const link = document.querySelector(`.toc-link[href="#${id}"]`);
    if(link) {
        link.classList.add('active');
        
        // 展開父層
        let parent = link.parentElement;
        while(parent && !parent.classList.contains('toc-root')) {
            if(parent.tagName === 'UL' && parent.classList.contains('hidden')) {
                parent.classList.remove('hidden');
                // 旋轉箭頭
                if(parent.previousElementSibling) {
                    parent.previousElementSibling.classList.add('expanded');
                }
            }
            parent = parent.parentElement;
        }
    }
}

// 修改 renderCurrentHash 呼叫 highlightSidebar
function renderCurrentHash() {
    const id = window.location.hash.replace('#', '');
    if(!id) return;
    const q = findNode(STATE.mergedData.categories, id, 'q');
    if(q) {
        // ... (內容渲染邏輯不變) ...
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
        
        // 加入這行：高亮並展開側邊欄
        highlightSidebar(id);
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
