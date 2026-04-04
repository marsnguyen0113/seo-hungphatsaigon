// ĐIỀN LINK GOOGLE APPS SCRIPT CỦA BẠN VÀO ĐÂY
const API_URL = "https://api-hungphatsaigon.hoangtuanvpro.workers.dev/";

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN');
let globalDetails = [];
let charts = {};
let rankTrackingData = []; 
let canniData = []; 

// BIẾN QUẢN LÝ PHÂN TRANG
let currentFilteredGroups = [];
let currentPage = 1;
const ITEMS_PER_PAGE = 20; // Hiển thị 20 danh mục mỗi trang để load mượt nhất

// BIẾN LƯU DỮ LIỆU EXPORT CANNIBALIZATION
window.globalCannibalizedList = [];

function formatDisplayDate(dateStr) {
    const d = parseDate(dateStr);
    if (!d || isNaN(d)) return 'N/A';
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

function parseDate(val) {
    if (!val) return null;
    let str = String(val).trim();
    if (str.includes('/')) {
        let parts = str.split('/');
        if (parts.length === 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    let d = new Date(str); return isNaN(d.getTime()) ? null : d;
}

function getNormalizedStatus(viStatus) {
    const s = String(viStatus || '').toLowerCase();
    if (s.includes('mới')) return 'fresh';
    if (s.includes('gần đây')) return 'recent';
    if (s.includes('cập nhật') || s.includes('xem xét')) return 'stale';
    return 'outdated';
}

function formatTimeOnPage(seconds) {
    let sec = Math.round(parseFloat(seconds) || 0);
    if (sec === 0) return "0s";
    let m = Math.floor(sec / 60);
    let s = sec % 60;
    return m > 0 ? `${m}p ${s}s` : `${s}s`;
}

function initFilters() {
    const mainSelect = document.getElementById('mainCatFilter');
    const subSelect = document.getElementById('subCatFilter');
    if (!mainSelect || !subSelect) return;
    const mainCats = [...new Set(globalDetails.map(item => item.DanhMucChinh || 'Khác'))].sort();
    const subCats = [...new Set(globalDetails.map(item => item.DanhMucCon || 'Chung'))].sort();
    mainSelect.innerHTML = '<option value="">Tất cả danh mục chính</option>' + mainCats.map(c => `<option value="${c}">${c}</option>`).join('');
    subSelect.innerHTML = '<option value="">Tất cả danh mục con</option>' + subCats.map(c => `<option value="${c}">${c}</option>`).join('');
    
    // Gắn sự kiện khi filter thay đổi -> reset về trang 1
    ['mainCatFilter', 'subCatFilter', 'statusFilter', 'urlSearch'].forEach(id => {
        let el = document.getElementById(id);
        if(el) {
            el.addEventListener('input', () => {
                currentPage = 1;
                processFilters();
            });
        }
    });

    let resetBtn = document.getElementById('resetFilterBtn');
    if(resetBtn) {
        resetBtn.onclick = () => {
            ['mainCatFilter', 'subCatFilter', 'statusFilter', 'urlSearch'].forEach(id => {
                let el = document.getElementById(id);
                if(el) el.value = '';
            });
            currentPage = 1;
            processFilters();
        };
    }
}

async function loadData() {
    const tbody = document.getElementById('categoryAccordionBody');
    if(!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="p-10 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Đang kết nối API để tải dữ liệu...</td></tr>';
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`API lỗi mã: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data || !data.tongQuan) {
            throw new Error("Dữ liệu JSON trả về bị thiếu hoặc hỏng cấu trúc!");
        }

        globalDetails = data.chiTiet || [];
        rankTrackingData = data.rankTracking || []; 
        canniData = data.cannibalization || []; 
        
        const tq = data.tongQuan;
        
        document.getElementById('totalUrls').textContent = tq.tongUrl || '0';
        document.getElementById('totalCategories').textContent = tq.danhMuc || '0';
        document.getElementById('freshContent').textContent = tq.baiMoi || '0';
        document.getElementById('outdatedContent').textContent = (parseInt(tq.canCapNhat)||0) + (parseInt(tq.loiThoi)||0);
        document.getElementById('recommendUpdate').textContent = tq.loiThoi || '0';

        renderAllCharts(parseInt(tq.tongUrl));
        renderTop10Priority();
        renderRankTracking(); 
        renderCannibalizationTool(); 
        renderMoneyPagesTool(); 
        renderContentDecayTool(); 
        renderZombieTool(); 
        renderCTROptimizerTool(); 
        renderArchitectureScannerTool();
        // 3 TRẠM MỚI TÍCH HỢP
        renderStrikingDistanceTool();
        renderUXScannerTool();
        renderLinkJuiceHubTool();

        initFilters();
        processFilters(); 
    } catch (e) { 
        console.error("LỖI HỆ THỐNG:", e); 
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-10 text-center bg-red-50 border border-red-200">
                    <i class="fas fa-exclamation-triangle text-red-500 text-3xl mb-3"></i>
                    <h3 class="text-red-700 font-bold text-lg mb-1">Hệ thống phân tích gặp sự cố</h3>
                    <p class="text-red-600 text-sm mb-3"><b>Nguyên nhân:</b> ${e.message}</p>
                    <p class="text-gray-500 text-xs italic">Hãy kiểm tra lại bước "Triển khai (Deploy)" trong Google Apps Script.</p>
                </td>
            </tr>
        `;
    }
}

function renderAllCharts(total) {
    const statusCounts = { fresh: 0, recent: 0, stale: 0, outdated: 0 };
    const categoryCounts = {}; 

    globalDetails.forEach(item => {
        statusCounts[getNormalizedStatus(item.TrangThai)]++;
        
        let cat = item.DanhMucChinh || 'Khác';
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    
    let statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
        if (charts['statusChart']) charts['statusChart'].destroy();
        charts['statusChart'] = new Chart(statusCtx, {
            type: 'bar',
            data: { labels: ['Mới', 'Gần đây', 'Sắp cũ', 'Lỗi thời'], datasets: [{ data: [statusCounts.fresh, statusCounts.recent, statusCounts.stale, statusCounts.outdated], backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'], borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    let catCtx = document.getElementById('categoryBarChart');
    if (catCtx) {
        if (charts['categoryBarChart']) charts['categoryBarChart'].destroy();
        const sortedCats = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a]).slice(0, 5);
        const catData = sortedCats.map(c => categoryCounts[c]);

        charts['categoryBarChart'] = new Chart(catCtx, {
            type: 'bar',
            data: {
                labels: sortedCats,
                datasets: [{ label: 'Số bài viết', data: catData, backgroundColor: '#F97316', borderRadius: 4 }] 
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
        });
    }

    const health = total > 0 ? Math.round(100 - ((statusCounts.outdated / total) * 100)) : 0;
    let healthEl = document.getElementById('healthScoreValue');
    if(healthEl) healthEl.textContent = health;
}

function renderTop10Priority() {
    let list = globalDetails.filter(i => ['outdated', 'stale'].includes(getNormalizedStatus(i.TrangThai)));
    list.sort((a,b) => (parseDate(a.NgayCapNhat)||0) - (parseDate(b.NgayCapNhat)||0));
    const tbody = document.getElementById('priorityUrlsTable');
    if (!tbody) return;
    tbody.innerHTML = list.slice(0, 10).map((u, i) => `
        <tr class="border-b text-xs hover:bg-gray-50">
            <td class="p-2 text-gray-400 font-bold">${i+1}</td>
            <td class="p-2 text-blue-600 truncate max-w-[200px]" title="${u.URL}"><a href="${u.URL}" target="_blank">${u.URL.replace('https://hungphatsaigon.vn/','')}</a></td>
            <td class="p-2 text-center text-gray-500">${formatDisplayDate(u.NgayCapNhat)}</td>
            <td class="p-2 text-center"><span class="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold text-[10px] uppercase">${u.TrangThai}</span></td>
        </tr>`).join('');
}

function renderRankTracking() {
    let container = document.getElementById('rankTrackingContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'rankTrackingContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }
    if (rankTrackingData.length === 0) return;

    rankTrackingData.sort((a, b) => (parseFloat(a.Position) || 100) - (parseFloat(b.Position) || 100));

    let rows = rankTrackingData.map((kw) => {
        const pos = parseFloat(kw.Position).toFixed(1);
        const posLast = parseFloat(kw.PositionLast) || pos;
        
        let trend = posLast - pos; 
        let trendHtml = '';
        if (trend > 0.5) trendHtml = `<span class="text-green-500 font-bold ml-2 text-[10px]"><i class="fas fa-arrow-up"></i> ${trend.toFixed(1)}</span>`;
        else if (trend < -0.5) trendHtml = `<span class="text-red-500 font-bold ml-2 text-[10px]"><i class="fas fa-arrow-down"></i> ${Math.abs(trend).toFixed(1)}</span>`;
        else trendHtml = `<span class="text-gray-300 font-bold ml-2 text-[10px]">-</span>`;

        let isLowHanging = (pos > 10 && pos <= 15) ? 'bg-yellow-50 border-l-4 border-yellow-400' : 'hover:bg-gray-50';
        let alertTag = (pos > 10 && pos <= 15) ? `<span class="ml-2 bg-yellow-200 text-yellow-800 text-[8px] px-1 rounded uppercase font-black">Cơ hội đẩy Top</span>` : '';

        let posBadge = pos <= 3 ? 'bg-green-100 text-green-700' : (pos <= 10 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600');
        
        return `
            <tr class="border-b ${isLowHanging} transition-colors">
                <td class="p-3 text-sm font-bold text-gray-800">${kw.Keyword} ${alertTag}</td>
                <td class="p-3 text-center text-blue-600 font-bold">${parseInt(kw.Clicks).toLocaleString('vi-VN')}</td>
                <td class="p-3 text-center text-gray-600">${parseInt(kw.Impressions).toLocaleString('vi-VN')}</td>
                <td class="p-3 text-center font-bold text-xs">${kw.CTR || '0%'}</td>
                <td class="p-3 text-center font-bold text-[10px]">
                    <span class="px-2 py-1 rounded ${posBadge}">Top ${pos}</span>
                    ${trendHtml}
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
            <h2 class="text-lg font-black text-gray-800"><i class="fas fa-trophy text-yellow-500 mr-2"></i>Radar Từ Khóa (Rank Tracking Pro)</h2>
        </div>
        <div class="overflow-x-auto max-h-96 custom-scrollbar">
            <table class="w-full text-left">
                <thead class="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th class="p-3">Từ khóa mục tiêu</th>
                        <th class="p-3 text-center">Clicks</th>
                        <th class="p-3 text-center">Hiển thị (Imp)</th>
                        <th class="p-3 text-center">Tỉ lệ nhấp (CTR)</th>
                        <th class="p-3 text-center">Vị trí & Xu hướng</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

window.exportCannibalizationCSV = function() {
    if (!window.globalCannibalizedList || window.globalCannibalizedList.length === 0) {
        alert("Hiện tại không có dữ liệu xung đột từ khóa để tải xuống!");
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "Tu_Khoa_Xung_Dot,Tong_Clicks_Nhom,Tong_Imp_Nhom,URL_Canh_Tranh,Clicks_URL,Imp_URL,Vi_Tri_URL\n";

    window.globalCannibalizedList.forEach(item => {
        item.urls.forEach(u => {
            let row = [
                `"${item.keyword}"`,
                item.totalClicks,
                item.totalImp,
                `"${u.URL}"`,
                u.Clicks,
                u.Impressions,
                u.Position
            ];
            csvContent += row.join(",") + "\n";
        });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "HungPhat_BaoCao_Cannibalization.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

function renderCannibalizationTool() {
    let container = document.getElementById('canniToolContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'canniToolContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-gray-800 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }

    if (!canniData || canniData.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-gray-50 text-gray-700 font-bold"><i class="fas fa-info-circle mr-2"></i>Chưa có dữ liệu Cannibalization. Hãy kiểm tra Backend.</div>`;
        return;
    }

    let groups = {};
    canniData.forEach(row => {
        let kw = String(row.Keyword).trim().toLowerCase();
        let rawUrl = String(row.URL).trim();
        let cleanUrl = rawUrl.split('#')[0];

        if (!groups[kw]) groups[kw] = {};

        if (!groups[kw][cleanUrl]) {
            groups[kw][cleanUrl] = {
                URL: cleanUrl,
                Clicks: 0,
                Impressions: 0,
                minPos: parseFloat(row.Position) || 100,
                Position: parseFloat(row.Position) || 100
            };
        }

        groups[kw][cleanUrl].Clicks += parseInt(row.Clicks) || 0;
        groups[kw][cleanUrl].Impressions += parseInt(row.Impressions) || 0;
        
        let pos = parseFloat(row.Position) || 100;
        if (pos < groups[kw][cleanUrl].minPos) {
            groups[kw][cleanUrl].minPos = pos;
            groups[kw][cleanUrl].Position = pos;
        }
    });

    let cannibalized = [];
    for (let kw in groups) {
        let urlsObj = groups[kw];
        let activeUrls = Object.values(urlsObj).filter(u => u.Impressions > 10 || u.Clicks > 0);
        
        if (activeUrls.length > 1) { 
            activeUrls.sort((a, b) => {
                let diff = b.Clicks - a.Clicks;
                if (diff !== 0) return diff;
                return b.Impressions - a.Impressions;
            });
            
            let totalClicks = activeUrls.reduce((sum, u) => sum + u.Clicks, 0);
            let totalImp = activeUrls.reduce((sum, u) => sum + u.Impressions, 0);
            
            cannibalized.push({ keyword: kw, urls: activeUrls, totalClicks: totalClicks, totalImp: totalImp });
        }
    }

    cannibalized.sort((a, b) => b.totalClicks - a.totalClicks || b.totalImp - a.totalImp);
    window.globalCannibalizedList = cannibalized;
    let displayList = cannibalized.slice(0, 20);

    if (displayList.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-green-50 text-green-700 font-bold"><i class="fas fa-check-circle mr-2"></i>Tuyệt vời! Không phát hiện URL nào xung đột từ khóa.</div>`;
        return;
    }

    let rows = displayList.map((item) => {
        let urlRows = item.urls.map((u, index) => {
            let badge = index === 0 ? `<span class="bg-green-100 text-green-700 px-1 py-0.5 rounded text-[8px] uppercase font-bold ml-2">Đang Top</span>` : `<span class="bg-red-100 text-red-700 px-1 py-0.5 rounded text-[8px] uppercase font-bold ml-2">Đang phá</span>`;
            return `
                <div class="flex items-center justify-between mb-1 pb-1 border-b border-gray-50 border-dashed last:border-0 last:mb-0 last:pb-0 hover:bg-gray-100 rounded px-1">
                    <a href="${u.URL}" target="_blank" class="text-blue-500 text-[11px] hover:underline truncate w-2/3" title="${u.URL}">${u.URL.replace('https://hungphatsaigon.vn', '')} ${badge}</a>
                    <div class="text-[10px] text-gray-500 w-1/3 text-right">
                        <span class="font-bold text-blue-600">${u.Clicks} Clicks</span> | ${u.Impressions} Imp (Top ${parseFloat(u.Position).toFixed(1)})
                    </div>
                </div>
            `;
        }).join('');

        return `
            <tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="p-3 text-xs text-gray-800 font-black whitespace-nowrap"><i class="fas fa-search text-gray-400 mr-2"></i>${item.keyword}</td>
                <td class="p-3 text-xs text-center font-bold text-blue-600 bg-blue-50/30">${item.totalClicks}</td>
                <td class="p-3 text-xs text-center text-gray-500 bg-gray-50/30">${item.totalImp}</td>
                <td class="p-3">${urlRows}</td>
                <td class="p-3 text-[10px]">
                    <button class="bg-gray-800 hover:bg-black text-white px-2 py-1 rounded shadow-sm block w-full text-center mb-1 transition-colors">Gộp bài</button>
                    <button class="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-2 py-1 rounded shadow-sm block w-full text-center transition-colors">Cắm Canonical</button>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-gray-800 to-gray-700 flex justify-between items-center cursor-pointer group" onclick="document.getElementById('canniTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-white"><i class="fas fa-skull-crossbones text-red-400 mr-2 group-hover:animate-pulse"></i>Radar Ăn Thịt Từ Khóa (Cannibalization) <span class="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">${cannibalized.length} Lỗi Xung Đột</span></h2>
            <div>
                <button onclick="event.stopPropagation(); exportCannibalizationCSV()" class="bg-green-600 hover:bg-green-500 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm mr-2"><i class="fas fa-file-excel mr-1"></i> Xuất CSV Tât Cả</button>
                <button class="bg-gray-600 hover:bg-gray-500 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Thu/Phóng Top 20 <i class="fas fa-chevron-down ml-1"></i></button>
            </div>
        </div>
        <div id="canniTableArea" class="hidden overflow-x-auto p-4 bg-gray-50">
            <div class="text-xs text-gray-600 mb-3 italic">* Cảnh báo: Các URL bên dưới đang tự cạnh tranh nhau trên kết quả tìm kiếm cho cùng 1 từ khóa. Cần chọn ra 1 URL chính và xử lý các URL phụ.</div>
            <table class="w-full text-left bg-white border border-gray-300 rounded-lg overflow-hidden shadow-sm">
                <thead class="bg-gray-200 text-[10px] text-gray-700 uppercase font-black">
                    <tr>
                        <th class="p-3 w-40">Từ khóa bị xung đột</th>
                        <th class="p-3 text-center w-20">Tổng Clicks</th>
                        <th class="p-3 text-center w-20">Tổng Imp</th>
                        <th class="p-3">Các URL đang đánh nhau (Clicks/Imp/Pos)</th>
                        <th class="p-3 w-28 text-center">Hành động</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderCTROptimizerTool() {
    let container = document.getElementById('ctrOptimizerContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'ctrOptimizerContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-blue-200 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }

    let ctrPages = globalDetails.filter(u => {
        let pos = parseFloat(u.GSCPos) || 100;
        let imp = parseInt(u.GSCImp) || 0;
        let ctrStr = String(u.GSCCTR).replace('%', '').replace(',', '.');
        let ctr = parseFloat(ctrStr) || 0;
        return (pos > 0 && pos <= 10) && (imp >= 50) && (ctr < 3.0);
    });

    ctrPages.sort((a, b) => (parseInt(b.GSCImp) || 0) - (parseInt(a.GSCImp) || 0));
    ctrPages = ctrPages.slice(0, 20);

    if (ctrPages.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-green-50 text-green-700 font-bold"><i class="fas fa-check-circle mr-2"></i>Tuyệt vời! Các trang lọt Top 10 của bạn đều có tỷ lệ Click (CTR) trên mức trung bình.</div>`;
        return;
    }

    let rows = ctrPages.map((u, i) => {
        let pos = parseFloat(u.GSCPos).toFixed(1);
        let imp = parseInt(u.GSCImp).toLocaleString('vi-VN');
        let clicks = parseInt(u.GSCClicks).toLocaleString('vi-VN');
        let titleLenInfo = u.TitleLen > 60 ? `<span class="text-red-500 font-bold">(${u.TitleLen} ký tự - Dài)</span>` : 
                          (u.TitleLen < 30 ? `<span class="text-orange-500 font-bold">(${u.TitleLen} ký tự - Ngắn)</span>` : `<span class="text-green-600">(${u.TitleLen} ký tự)</span>`);

        return `
            <tr class="border-b hover:bg-blue-50 transition-colors">
                <td class="p-3 text-xs text-blue-600 font-black">${i+1}</td>
                <td class="p-3 text-xs">
                    <a href="${u.URL}" target="_blank" class="text-blue-600 font-bold hover:underline block break-all mb-1">${u.URL}</a>
                    <div class="text-[11px] text-gray-700 font-medium">Tiêu đề hiện tại: ${u.TitleTech} ${titleLenInfo}</div>
                </td>
                <td class="p-3 text-center text-green-600 font-black">Top ${pos}</td>
                <td class="p-3 text-center font-bold text-gray-700">${imp}</td>
                <td class="p-3 text-center font-bold text-gray-500">${clicks}</td>
                <td class="p-3 text-center"><span class="bg-red-100 text-red-800 px-2 py-1 rounded font-black shadow-sm text-[10px]"><i class="fas fa-exclamation-triangle mr-1"></i>${u.GSCCTR}</span></td>
                <td class="p-3 text-[10px] text-center"><button class="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded shadow-sm w-full font-bold transition-colors">Yêu cầu Re-write</button></td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-blue-200 bg-gradient-to-r from-blue-100 to-white flex justify-between items-center cursor-pointer group" onclick="document.getElementById('ctrTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-blue-800"><i class="fas fa-magnet text-blue-600 mr-2 group-hover:scale-110 transition-transform"></i>Trạm Tối Ưu CTR (Mỏ Vàng Traffic) <span class="bg-blue-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">${ctrPages.length} Cơ hội</span></h2>
            <button class="bg-blue-500 hover:bg-blue-600 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="ctrTableArea" class="hidden overflow-x-auto p-4 bg-blue-50/30">
            <div class="text-xs text-gray-600 mb-3 p-3 bg-white border border-blue-100 rounded shadow-sm leading-relaxed"><i class="fas fa-info-circle text-blue-500 mr-1"></i> <b>Insight:</b> Các URL này đã ở <b>Top 10 Google</b> có lượt hiển thị cao, nhưng tỷ lệ Click < 3%. Hãy tối ưu lại <b>Meta Title</b> để giật tít kéo Traffic.</div>
            <table class="w-full text-left bg-white border border-blue-200 rounded-lg overflow-hidden shadow-sm">
                <thead class="bg-blue-100/50 text-[10px] text-blue-800 uppercase font-black">
                    <tr><th class="p-3 w-10">STT</th><th class="p-3">Trang Đích & Tiêu đề hiện tại</th><th class="p-3 text-center w-20">Vị trí</th><th class="p-3 text-center w-24">Hiển thị (Imp)</th><th class="p-3 text-center w-20">Clicks</th><th class="p-3 text-center w-24">CTR Báo động</th><th class="p-3 text-center w-24">Hành động</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderMoneyPagesTool() {
    let container = document.getElementById('moneyPagesContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'moneyPagesContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-yellow-200 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }

    let moneyPages = globalDetails.filter(u => {
        let conv = parseFloat(u.Conversions) || 0;
        let time = parseFloat(u.TimeOnPage) || 0;
        let traffic = parseInt(u.TrafficCurrent) || 0;
        return (conv > 0 || (time >= 120 && traffic > 10));
    });

    moneyPages.sort((a, b) => {
        let convDiff = (parseFloat(b.Conversions) || 0) - (parseFloat(a.Conversions) || 0);
        if (convDiff !== 0) return convDiff;
        return (parseInt(b.TrafficCurrent) || 0) - (parseInt(a.TrafficCurrent) || 0);
    });

    moneyPages = moneyPages.slice(0, 15);

    if (moneyPages.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-yellow-50 text-yellow-700 font-bold"><i class="fas fa-exclamation-circle mr-2"></i>Chưa có dữ liệu Chuyển đổi từ GA4.</div>`;
        return;
    }

    let rows = moneyPages.map((u, i) => {
        let conv = parseFloat(u.Conversions) || 0;
        let timeFormatted = formatTimeOnPage(u.TimeOnPage);
        let traffic = parseInt(u.TrafficCurrent).toLocaleString('vi-VN');
        
        let convBadge = conv > 0 ? `<span class="bg-green-100 text-green-800 px-2 py-1 rounded font-black shadow-sm">+${conv} Đơn/LH</span>` : `<span class="text-gray-400">0</span>`;
        let timeBadge = parseFloat(u.TimeOnPage) > 120 ? `text-green-600 font-bold` : `text-gray-600`;

        return `
            <tr class="border-b hover:bg-yellow-50 transition-colors">
                <td class="p-3 text-xs text-yellow-600 font-black">${i+1}</td>
                <td class="p-3 text-xs">
                    <a href="${u.URL}" target="_blank" class="text-blue-600 font-bold hover:underline block break-all">${u.URL}</a>
                    <div class="text-[10px] text-gray-500 mt-1 line-clamp-1">${u.TieuDe}</div>
                </td>
                <td class="p-3 text-center font-bold text-gray-700">${traffic}</td>
                <td class="p-3 text-center ${timeBadge} text-xs">${timeFormatted}</td>
                <td class="p-3 text-center text-[11px]">${convBadge}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-yellow-200 bg-gradient-to-r from-yellow-100 to-white flex justify-between items-center cursor-pointer group" onclick="document.getElementById('moneyTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-yellow-800"><i class="fas fa-coins text-yellow-600 mr-2 group-hover:text-yellow-500 transition-colors"></i>Trạm Săn Money Pages (GA4) <span class="bg-yellow-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">Top ${moneyPages.length}</span></h2>
            <button class="bg-yellow-500 hover:bg-yellow-600 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="moneyTableArea" class="hidden overflow-x-auto p-4 bg-yellow-50/30">
            <table class="w-full text-left bg-white border border-yellow-200 rounded-lg overflow-hidden shadow-sm">
                <thead class="bg-yellow-100/50 text-[10px] text-yellow-800 uppercase font-black">
                    <tr><th class="p-3 w-10">STT</th><th class="p-3">Bài viết "Bò sữa"</th><th class="p-3 text-center w-24">Traffic</th><th class="p-3 text-center w-32">Tg đọc (Avg)</th><th class="p-3 text-center w-32">Chuyển đổi</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderContentDecayTool() {
    let container = document.getElementById('contentDecayContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'contentDecayContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }

    let decayingPages = globalDetails.filter(u => {
        let last = parseInt(u.TrafficLast) || 0;
        let current = parseInt(u.TrafficCurrent) || 0;
        if (last < 20) return false; 
        if (current >= last) return false; 
        let dropRatio = (last - current) / last;
        return dropRatio >= 0.3; 
    });

    decayingPages.sort((a, b) => {
        let dropA = ((parseInt(a.TrafficLast) || 0) - (parseInt(a.TrafficCurrent) || 0)) / (parseInt(a.TrafficLast) || 1);
        let dropB = ((parseInt(b.TrafficLast) || 0) - (parseInt(b.TrafficCurrent) || 0)) / (parseInt(b.TrafficLast) || 1);
        return dropB - dropA; 
    });

    if (decayingPages.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-green-50 text-green-700 font-bold"><i class="fas fa-shield-alt mr-2"></i>Phong độ ổn định! Không có bài viết bị tụt hạng nặng.</div>`;
        return;
    }

    let rows = decayingPages.slice(0, 15).map((u, i) => {
        let last = parseInt(u.TrafficLast) || 0;
        let current = parseInt(u.TrafficCurrent) || 0;
        let dropRatio = ((last - current) / last * 100).toFixed(1);
        let dropAbs = last - current;

        return `
            <tr class="border-b hover:bg-red-50 transition-colors">
                <td class="p-3 text-xs text-red-600 font-black">${i+1}</td>
                <td class="p-3 text-xs">
                    <a href="${u.URL}" target="_blank" class="text-blue-600 font-bold hover:underline block break-all">${u.URL}</a>
                    <div class="text-[10px] text-gray-500 mt-1 line-clamp-1">${u.TieuDe}</div>
                </td>
                <td class="p-3 text-center text-gray-400 font-bold line-through">${last}</td>
                <td class="p-3 text-center text-red-600 font-black">${current}</td>
                <td class="p-3 text-center"><span class="bg-red-100 text-red-800 px-2 py-1 rounded font-black shadow-sm text-[10px]"><i class="fas fa-arrow-down mr-1"></i>${dropRatio}% (-${dropAbs})</span></td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-red-200 bg-gradient-to-r from-red-100 to-white flex justify-between items-center cursor-pointer group" onclick="document.getElementById('decayTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-red-800"><i class="fas fa-chart-line fa-flip-vertical text-red-600 mr-2 group-hover:-translate-y-1 transition-transform"></i>Trạm Cảnh Báo Suy Thoái Nội Dung <span class="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">${decayingPages.length} Bài Rớt Hạng</span></h2>
            <button class="bg-red-500 hover:bg-red-600 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="decayTableArea" class="hidden overflow-x-auto p-4 bg-red-50/30">
            <table class="w-full text-left bg-white border border-red-200 rounded-lg overflow-hidden shadow-sm">
                <thead class="bg-red-100/50 text-[10px] text-red-800 uppercase font-black">
                    <tr><th class="p-3 w-10">STT</th><th class="p-3">URL Đang Suy Thoái</th><th class="p-3 text-center w-24">Traffic Tháng Trước</th><th class="p-3 text-center w-24">Traffic Hiện Tại</th><th class="p-3 text-center w-32">Mức Độ Tụt Hạng</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderZombieTool() {
    let container = document.getElementById('zombieToolContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'zombieToolContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }

    const zombies = globalDetails.filter(u => {
        const noTraffic = (parseInt(u.TrafficCurrent) || 0) === 0;
        const noGscClicks = (parseInt(u.GSCClicks) || 0) === 0;
        const thinContent = (parseInt(u.WordCount) || 0) < 300;
        const orphan = (parseInt(u.Inlinks) || 0) === 0;
        const nonIndexable = String(u.Indexability).includes('Non');

        return (noTraffic && noGscClicks) && (thinContent || orphan || nonIndexable);
    });

    if (zombies.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-green-50 text-green-700 font-bold"><i class="fas fa-check-circle mr-2"></i>Chúc mừng! Website sạch bóng Zombie Pages.</div>`;
        return;
    }

    let rows = zombies.map((u, i) => {
        let reasons = [];
        let actions = [];
        
        if ((parseInt(u.WordCount) || 0) < 300) {
            reasons.push('<span class="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[9px] uppercase font-bold mb-1 inline-block">Nội dung mỏng</span>');
            actions.push('Bổ sung content hoặc Gộp bài');
        }
        if ((parseInt(u.Inlinks) || 0) === 0) {
            reasons.push('<span class="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-[9px] uppercase font-bold mb-1 inline-block">Trang mồ côi</span>');
            actions.push('Bơm Internal link từ chuyên mục');
        }
        if (String(u.Indexability).includes('Non')) {
            reasons.push('<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[9px] uppercase font-bold inline-block">Bị chặn Index</span>');
            actions.push('Bỏ chặn noindex hoặc Xóa bỏ');
        }

        return `
            <tr class="border-b hover:bg-gray-50 transition-colors">
                <td class="p-3 text-xs text-gray-400 font-bold">${i+1}</td>
                <td class="p-3 text-xs">
                    <a href="${u.URL}" target="_blank" class="text-blue-600 font-bold hover:underline block mb-1 break-all">${u.URL}</a>
                    <div class="text-[10px] text-gray-500">${u.TieuDe}</div>
                </td>
                <td class="p-3 leading-relaxed">${reasons.join(' ')}</td>
                <td class="p-3 text-[11px] text-purple-700 font-medium"><i class="fas fa-tools mr-1"></i>${actions.join(' <br> <i class="fas fa-tools mr-1 mt-1"></i>')}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white flex justify-between items-center cursor-pointer group" onclick="document.getElementById('zombieTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-purple-800"><i class="fas fa-spider text-purple-500 mr-2 group-hover:text-purple-600 transition-colors"></i>Trạm Quét Zombie Pages <span class="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">${zombies.length} URL Rác</span></h2>
            <button class="bg-purple-600 hover:bg-purple-700 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="zombieTableArea" class="hidden overflow-x-auto p-4 bg-gray-50">
            <table class="w-full text-left bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <thead class="bg-gray-100 text-[10px] text-gray-500 uppercase font-bold">
                    <tr><th class="p-3 w-10">STT</th><th class="p-3">URL Thây ma</th><th class="p-3 w-40">Nguyên nhân</th><th class="p-3 w-64">AI Gợi ý xử lý</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

// ==========================================
// TÍNH NĂNG MỚI 1: TRẠM BỆ PHÓNG TRANG 2 (STRIKING DISTANCE)
// ==========================================
function renderStrikingDistanceTool() {
    let container = document.getElementById('strikingDistanceContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'strikingDistanceContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-teal-200 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }

    let strikingPages = globalDetails.filter(u => {
        let pos = parseFloat(u.GSCPos) || 0;
        let imp = parseInt(u.GSCImp) || 0;
        return pos > 10.0 && pos <= 20.0 && imp > 50; 
    });

    strikingPages.sort((a, b) => (parseInt(b.GSCImp) || 0) - (parseInt(a.GSCImp) || 0));
    strikingPages = strikingPages.slice(0, 15);

    if (strikingPages.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-teal-50 text-teal-700 font-bold"><i class="fas fa-rocket mr-2"></i>Hiện không có bài viết nào ở Trang 2 thỏa điều kiện bệ phóng.</div>`;
        return;
    }

    let rows = strikingPages.map((u, i) => {
        let pos = parseFloat(u.GSCPos).toFixed(1);
        let imp = parseInt(u.GSCImp).toLocaleString('vi-VN');
        let inlinks = parseInt(u.Inlinks) || 0;

        return `
            <tr class="border-b hover:bg-teal-50 transition-colors">
                <td class="p-3 text-xs text-teal-600 font-black">${i+1}</td>
                <td class="p-3 text-xs">
                    <a href="${u.URL}" target="_blank" class="text-blue-600 font-bold hover:underline block break-all mb-1">${u.URL}</a>
                    <div class="text-[11px] text-gray-700 font-medium">Internal Links hiện tại: <span class="${inlinks < 3 ? 'text-red-500 font-bold' : 'text-teal-600'}">${inlinks} links</span></div>
                </td>
                <td class="p-3 text-center text-teal-700 font-black">Top ${pos}</td>
                <td class="p-3 text-center font-bold text-gray-700">${imp}</td>
                <td class="p-3 text-[10px] text-center"><button class="bg-teal-600 hover:bg-teal-700 text-white px-2 py-1 rounded shadow-sm w-full font-bold transition-colors"><i class="fas fa-link mr-1"></i> Bơm thêm Link</button></td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-teal-200 bg-gradient-to-r from-teal-100 to-white flex justify-between items-center cursor-pointer group" onclick="document.getElementById('strikingTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-teal-800"><i class="fas fa-rocket text-teal-600 mr-2 group-hover:-translate-y-1 transition-transform"></i>Trạm Bệ Phóng Trang 2 (Striking Distance) <span class="bg-teal-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">${strikingPages.length} Cơ hội</span></h2>
            <button class="bg-teal-500 hover:bg-teal-600 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="strikingTableArea" class="hidden overflow-x-auto p-4 bg-teal-50/30">
            <div class="text-xs text-gray-600 mb-3 p-3 bg-white border border-teal-100 rounded shadow-sm leading-relaxed"><i class="fas fa-info-circle text-teal-500 mr-1"></i> <b>Insight:</b> Các trang này đang kẹt ở vị trí 11-20 nhưng có lượng tìm kiếm (Impression) rất cao. Chỉ cần Bơm thêm 3-5 Internal Links hoặc cập nhật lại 1 đoạn nội dung nhỏ là sẽ lọt Top 10 dễ dàng.</div>
            <table class="w-full text-left bg-white border border-teal-200 rounded-lg overflow-hidden shadow-sm">
                <thead class="bg-teal-100/50 text-[10px] text-teal-800 uppercase font-black">
                    <tr><th class="p-3 w-10">STT</th><th class="p-3">Trang chờ lên Top 10</th><th class="p-3 text-center w-20">Vị trí (GSC)</th><th class="p-3 text-center w-24">Hiển thị (Imp)</th><th class="p-3 text-center w-32">Hành động</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

// ==========================================
// TÍNH NĂNG MỚI 2: BÁO ĐỘNG TRẢI NGHIỆM ĐỌC (UX SCANNER)
// ==========================================
function renderUXScannerTool() {
    let container = document.getElementById('uxScannerContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'uxScannerContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-rose-200 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }

    let badUXPages = globalDetails.filter(u => {
        let traffic = parseInt(u.TrafficCurrent) || 0;
        let words = parseInt(u.WordCount) || 0;
        let time = parseFloat(u.TimeOnPage) || 0;

        if (traffic < 30) return false; 
        
        let expectedTimeSeconds = (words / 250) * 60; // 250 chữ/phút

        if (words >= 800 && time < 45) return true; // Bài rất dài nhưng đọc quá nhanh (Bounce)
        if (expectedTimeSeconds > 0 && (time / expectedTimeSeconds) < 0.20 && time < 60) return true; 

        return false;
    });

    badUXPages.sort((a, b) => (parseInt(b.TrafficCurrent) || 0) - (parseInt(a.TrafficCurrent) || 0));
    badUXPages = badUXPages.slice(0, 15);

    if (badUXPages.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-green-50 text-green-700 font-bold"><i class="fas fa-check-circle mr-2"></i>Trải nghiệm tuyệt vời! Không phát hiện bài viết nào có tỷ lệ thoát/chán đọc cao.</div>`;
        return;
    }

    let rows = badUXPages.map((u, i) => {
        let traffic = parseInt(u.TrafficCurrent).toLocaleString('vi-VN');
        let words = parseInt(u.WordCount).toLocaleString('vi-VN');
        let actualTime = formatTimeOnPage(u.TimeOnPage);
        
        let expectedTime = Math.round((u.WordCount / 250) * 60);
        let expectedTimeStr = formatTimeOnPage(expectedTime);

        return `
            <tr class="border-b hover:bg-rose-50 transition-colors">
                <td class="p-3 text-xs text-rose-600 font-black">${i+1}</td>
                <td class="p-3 text-xs">
                    <a href="${u.URL}" target="_blank" class="text-blue-600 font-bold hover:underline block break-all mb-1">${u.URL}</a>
                </td>
                <td class="p-3 text-center font-bold text-gray-700">${traffic}</td>
                <td class="p-3 text-center font-bold text-gray-500">${words} chữ</td>
                <td class="p-3 text-center text-gray-400 font-medium">~${expectedTimeStr}</td>
                <td class="p-3 text-center text-rose-600 font-black"><i class="fas fa-level-down-alt mr-1"></i>${actualTime}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-rose-200 bg-gradient-to-r from-rose-100 to-white flex justify-between items-center cursor-pointer group" onclick="document.getElementById('uxTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-rose-800"><i class="fas fa-user-clock text-rose-600 mr-2 group-hover:animate-pulse"></i>Báo Động Trải Nghiệm Đọc (UX / Helpful Content) <span class="bg-rose-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">${badUXPages.length} Cảnh Báo</span></h2>
            <button class="bg-rose-500 hover:bg-rose-600 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="uxTableArea" class="hidden overflow-x-auto p-4 bg-rose-50/30">
            <div class="text-xs text-gray-600 mb-3 p-3 bg-white border border-rose-100 rounded shadow-sm leading-relaxed"><i class="fas fa-exclamation-triangle text-rose-500 mr-1"></i> <b>Insight:</b> Hệ thống toán học đã tính ra Thời gian đọc mong đợi dựa trên Số chữ (Word Count). Các URL này viết rất dài, kéo được Traffic, nhưng <b>Thời gian đọc thực tế từ GA4 quá thấp</b>. Rất dễ bị dính thuật toán Helpful Content. Hãy vào thêm <b>Hình ảnh, Mục lục, Đoạn tóm tắt</b> để giữ chân khách.</div>
            <table class="w-full text-left bg-white border border-rose-200 rounded-lg overflow-hidden shadow-sm">
                <thead class="bg-rose-100/50 text-[10px] text-rose-800 uppercase font-black">
                    <tr><th class="p-3 w-10">STT</th><th class="p-3">Bài viết làm khách chán</th><th class="p-3 text-center w-20">Traffic</th><th class="p-3 text-center w-24">Số chữ (Word)</th><th class="p-3 text-center w-24">Đáng lẽ đọc...</th><th class="p-3 text-center w-24">Thực tế đọc</th></tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

// ==========================================
// TÍNH NĂNG MỚI 3: ĐIỀU PHỐI LINK JUICE (INTERNAL LINK HUB)
// ==========================================
function renderLinkJuiceHubTool() {
    let container = document.getElementById('linkJuiceContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'linkJuiceContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }

    // List 1: Bơm máu (Hub) -> Có traffic > 50, Conversion = 0
    let hubPages = globalDetails.filter(u => {
        return (parseInt(u.TrafficCurrent) || 0) > 50 && (parseFloat(u.Conversions) || 0) === 0;
    }).sort((a,b) => (parseInt(b.TrafficCurrent)||0) - (parseInt(a.TrafficCurrent)||0)).slice(0, 10);

    // List 2: Bị đói Link -> Là trang Sản phẩm / Danh mục, Inlinks < 5
    let starvingPages = globalDetails.filter(u => {
        let url = String(u.URL).toLowerCase();
        let isProduct = url.includes('/danh-muc/') || url.includes('/shop/');
        let inlinks = parseInt(u.Inlinks) || 0;
        return isProduct && inlinks < 5;
    }).sort((a,b) => (parseInt(a.Inlinks)||0) - (parseInt(b.Inlinks)||0)).slice(0, 10);

    if (hubPages.length === 0 && starvingPages.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-green-50 text-green-700 font-bold"><i class="fas fa-check-circle mr-2"></i>Dòng chảy sức mạnh Nội bộ đang hoàn hảo!</div>`;
        return;
    }

    let rowsHub = hubPages.map((u, i) => `
        <tr class="border-b border-r border-gray-100 hover:bg-indigo-50">
            <td class="p-2 text-[11px]">
                <a href="${u.URL}" target="_blank" class="text-blue-600 font-medium hover:underline block truncate w-48 lg:w-64" title="${u.URL}">${u.URL.replace('https://hungphatsaigon.vn', '')}</a>
            </td>
            <td class="p-2 text-center text-xs font-bold text-gray-700">${parseInt(u.TrafficCurrent)}</td>
        </tr>
    `).join('');

    let rowsStarve = starvingPages.map((u, i) => `
        <tr class="border-b hover:bg-orange-50 border-l border-gray-100">
            <td class="p-2 text-[11px]">
                <a href="${u.URL}" target="_blank" class="text-orange-600 font-medium hover:underline block truncate w-48 lg:w-64" title="${u.URL}">${u.URL.replace('https://hungphatsaigon.vn', '')}</a>
            </td>
            <td class="p-2 text-center text-xs font-black text-red-500">${parseInt(u.Inlinks)}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-indigo-200 bg-gradient-to-r from-indigo-100 to-white flex justify-between items-center cursor-pointer group" onclick="document.getElementById('juiceTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-indigo-800"><i class="fas fa-project-diagram text-indigo-600 mr-2"></i>Trạm Điều Phối Link Juice (Tránh lãng phí sức mạnh)</h2>
            <button class="bg-indigo-500 hover:bg-indigo-600 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="juiceTableArea" class="hidden p-4 bg-indigo-50/30">
            <div class="text-xs text-gray-600 mb-3 p-3 bg-white border border-indigo-100 rounded shadow-sm leading-relaxed"><i class="fas fa-info-circle text-indigo-500 mr-1"></i> <b>Hướng dẫn hành động:</b> Trạm này chia làm 2 bên. Hãy copy (đặt link) từ bảng bên Trái, cắm trỏ về các trang bên Phải để luân chuyển dòng chảy SEO (PageRank).</div>
            <div class="flex flex-col lg:flex-row gap-4">
                <div class="w-full lg:w-1/2 bg-white border border-indigo-200 rounded-lg shadow-sm">
                    <div class="bg-indigo-100 text-indigo-800 font-black text-xs uppercase p-3 text-center border-b border-indigo-200"><i class="fas fa-tint mr-1"></i> HUB: Trang kéo Traffic nhưng 0 Đơn (Nên đặt link)</div>
                    <table class="w-full text-left"><thead class="text-[10px] text-gray-500 bg-gray-50"><tr><th class="p-2">URL Bài Bơm Máu</th><th class="p-2 text-center">Traffic</th></tr></thead><tbody>${rowsHub}</tbody></table>
                </div>
                <div class="w-full lg:w-1/2 bg-white border border-orange-200 rounded-lg shadow-sm">
                    <div class="bg-orange-100 text-orange-800 font-black text-xs uppercase p-3 text-center border-b border-orange-200"><i class="fas fa-heartbeat mr-1"></i> TARGET: Trang Bán Hàng đói Link (Cần nhận link)</div>
                    <table class="w-full text-left"><thead class="text-[10px] text-gray-500 bg-gray-50"><tr><th class="p-2">URL Danh mục/Sản phẩm</th><th class="p-2 text-center">Inlinks đang có</th></tr></thead><tbody>${rowsStarve}</tbody></table>
                </div>
            </div>
        </div>
    `;
}
// ==========================================
// TÍNH NĂNG MỚI 4: TRẠM QUÉT CẤU TRÚC & NGÕ CỤT (DEAD-END & SILO)
// ==========================================
function renderArchitectureScannerTool() {
    let container = document.getElementById('architectureContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'architectureContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-slate-300 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }

    // 1. Quét trang ngõ cụt: Có Traffic > 10 nhưng KHÔNG CÓ link trỏ ra ngoài (Outlinks = 0)
    let deadEndPages = globalDetails.filter(u => {
        let traffic = parseInt(u.TrafficCurrent) || 0;
        let outlinks = u.Outlinks !== "N/A" && u.Outlinks !== "" ? parseInt(u.Outlinks) : -1;
        return traffic > 10 && outlinks === 0; 
    }).sort((a,b) => (parseInt(b.TrafficCurrent)||0) - (parseInt(a.TrafficCurrent)||0)).slice(0, 10);

    // 2. Quét trang vực sâu: Giấu quá sâu (Crawl Depth >= 4) và ít người xem
    let buriedPages = globalDetails.filter(u => {
        let depth = u.CrawlDepth !== "N/A" && u.CrawlDepth !== "" ? parseInt(u.CrawlDepth) : 0;
        let traffic = parseInt(u.TrafficCurrent) || 0;
        return depth >= 4 && traffic < 50; 
    }).sort((a,b) => (parseInt(b.CrawlDepth)||0) - (parseInt(a.CrawlDepth)||0)).slice(0, 10);

    if (deadEndPages.length === 0 && buriedPages.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-slate-50 text-slate-700 font-bold"><i class="fas fa-check-circle mr-2"></i>Cấu trúc website hoàn hảo! Không có trang ngõ cụt hay bị giấu quá sâu.</div>`;
        return;
    }

    let rowsDeadEnd = deadEndPages.map((u, i) => `
        <tr class="border-b border-r border-gray-100 hover:bg-slate-50">
            <td class="p-2 text-[11px]">
                <a href="${u.URL}" target="_blank" class="text-blue-600 font-medium hover:underline block truncate w-48 lg:w-64" title="${u.URL}">${u.URL.replace('https://hungphatsaigon.vn', '')}</a>
            </td>
            <td class="p-2 text-center text-xs font-bold text-gray-700">${parseInt(u.TrafficCurrent).toLocaleString('vi-VN')}</td>
            <td class="p-2 text-center text-xs font-black text-red-500">0</td>
        </tr>
    `).join('');

    let rowsBuried = buriedPages.map((u, i) => `
        <tr class="border-b hover:bg-slate-50 border-l border-gray-100">
            <td class="p-2 text-[11px]">
                <a href="${u.URL}" target="_blank" class="text-orange-600 font-medium hover:underline block truncate w-48 lg:w-64" title="${u.URL}">${u.URL.replace('https://hungphatsaigon.vn', '')}</a>
            </td>
            <td class="p-2 text-center text-xs font-black text-red-500">${parseInt(u.CrawlDepth)}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-100 to-white flex justify-between items-center cursor-pointer group" onclick="document.getElementById('archTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-slate-800"><i class="fas fa-sitemap text-slate-600 mr-2 group-hover:scale-110 transition-transform"></i>Trạm Cấu Trúc Silo & Ngõ Cụt Dòng Chảy</h2>
            <button class="bg-slate-500 hover:bg-slate-600 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="archTableArea" class="hidden p-4 bg-slate-50/30">
            <div class="text-xs text-gray-600 mb-3 p-3 bg-white border border-slate-100 rounded shadow-sm leading-relaxed"><i class="fas fa-info-circle text-slate-500 mr-1"></i> <b>Hướng dẫn hành động:</b><br> 👉 <b>Bảng Trái (Ngõ cụt):</b> Khách đang xem rất nhiều nhưng bài viết không có link đi tiếp. Bạn phải vào chèn ngay 2-3 link dẫn về trang Danh mục để tránh việc khách thoát trang.<br>👉 <b>Bảng Phải (Vực sâu):</b> Các trang bị giấu quá sâu (Phải click 4-5 lần từ trang chủ mới tới). Googlebot cực kỳ lười cào các trang này. Hãy lôi chúng ra đặt trên Sidebar hoặc Menu!</div>
            <div class="flex flex-col lg:flex-row gap-4">
                <div class="w-full lg:w-1/2 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <div class="bg-slate-100 text-slate-800 font-black text-xs uppercase p-3 text-center border-b border-slate-200"><i class="fas fa-sign-language mr-1"></i> NGÕ CỤT: Có Traffic nhưng Outlinks = 0</div>
                    <table class="w-full text-left"><thead class="text-[10px] text-gray-500 bg-gray-50"><tr><th class="p-2">URL Ngõ Cụt</th><th class="p-2 text-center">Traffic</th><th class="p-2 text-center">Outlinks</th></tr></thead><tbody>${rowsDeadEnd || '<tr><td colspan="3" class="text-center p-2 text-green-600 font-bold">Không có lỗi</td></tr>'}</tbody></table>
                </div>
                <div class="w-full lg:w-1/2 bg-white border border-slate-200 rounded-lg shadow-sm">
                    <div class="bg-slate-100 text-slate-800 font-black text-xs uppercase p-3 text-center border-b border-slate-200"><i class="fas fa-level-down-alt mr-1"></i> VỰC SÂU: Crawl Depth >= 4</div>
                    <table class="w-full text-left"><thead class="text-[10px] text-gray-500 bg-gray-50"><tr><th class="p-2">URL Bị Giấu Kín</th><th class="p-2 text-center">Độ sâu (Depth)</th></tr></thead><tbody>${rowsBuried || '<tr><td colspan="2" class="text-center p-2 text-green-600 font-bold">Không có lỗi</td></tr>'}</tbody></table>
                </div>
            </div>
        </div>
    `;
}
function processFilters() {
    const mainVal = document.getElementById('mainCatFilter') ? document.getElementById('mainCatFilter').value : '';
    const subVal = document.getElementById('subCatFilter') ? document.getElementById('subCatFilter').value : '';
    const statusVal = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : '';
    const searchVal = document.getElementById('urlSearch') ? document.getElementById('urlSearch').value.toLowerCase() : '';

    const filtered = globalDetails.filter(item => {
        const mMain = !mainVal || item.DanhMucChinh === mainVal;
        const mSub = !subVal || item.DanhMucCon === subVal;
        const mStatus = !statusVal || getNormalizedStatus(item.TrangThai) === statusVal;
        const mSearch = !searchVal || item.URL.toLowerCase().includes(searchVal);
        return mMain && mSub && mStatus && mSearch;
    });

    const grouped = {};
    filtered.forEach(item => {
        const key = `${item.DanhMucChinh || 'Khác'}___${item.DanhMucCon || 'Chung'}`;
        if(!grouped[key]) grouped[key] = { main: item.DanhMucChinh, sub: item.DanhMucCon, urls: [] };
        grouped[key].urls.push(item);
    });

    currentFilteredGroups = Object.keys(grouped).map(key => grouped[key]);
    
    currentFilteredGroups.sort((a, b) => {
        let totalA = a.urls.reduce((sum, u) => sum + (parseInt(u.TrafficCurrent)||0), 0);
        let totalB = b.urls.reduce((sum, u) => sum + (parseInt(u.TrafficCurrent)||0), 0);
        return totalB - totalA;
    });

    renderCategoryAccordion();
}

function renderCategoryAccordion() {
    const tbody = document.getElementById('categoryAccordionBody');
    if(!tbody) return;
    tbody.innerHTML = '';

    const totalPages = Math.ceil(currentFilteredGroups.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const groupsToRender = currentFilteredGroups.slice(startIndex, endIndex);

    if (groupsToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500 font-bold">Không tìm thấy dữ liệu phù hợp với bộ lọc.</td></tr>`;
        renderPaginationControls(totalPages);
        return;
    }

    groupsToRender.forEach((g, index) => {
        g.urls.sort((a,b) => (parseInt(b.TrafficCurrent)||0) - (parseInt(a.TrafficCurrent)||0));
        const rowId = 'cat-row-' + (startIndex + index);

        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b hover:bg-orange-50 cursor-pointer transition-colors" onclick="toggleAccordion('${rowId}')">
                <td class="p-4 font-bold text-sm text-gray-800"><i class="fas fa-folder text-orange-400 mr-2"></i>${g.main || 'Khác'}</td>
                <td class="p-4 text-xs text-gray-500 font-bold">${g.sub || 'Chung'}</td>
                <td class="p-4 text-center font-black text-orange-600">${g.urls.length}</td>
                <td class="p-4 text-center text-gray-400 text-xs">${((g.urls.length / globalDetails.length)*100).toFixed(1)}%</td>
                <td class="p-4 text-center text-gray-500 text-xs font-bold">---</td>
                <td class="p-4 text-center"><button class="bg-orange-500 hover:bg-orange-600 transition-colors text-white px-3 py-1 rounded text-[10px] font-bold uppercase shadow-sm">Chi tiết <i class="fas fa-chevron-right ml-1 transition-transform" id="icon-${rowId}"></i></button></td>
            </tr>
            <tr id="${rowId}" class="hidden bg-gray-50/50 border-b-2 border-orange-100">
                <td colspan="6" class="p-4">
                    <div class="max-h-[500px] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-inner custom-scrollbar">
                        <table class="w-full text-left">
                            <thead class="bg-gray-100/80 text-[10px] text-gray-500 uppercase font-bold sticky top-0 z-10 backdrop-blur-sm">
                                <tr><th class="p-3 w-10 text-center">STT</th><th class="p-3">Phân tích URL, Điểm SEO & GSC</th><th class="p-3 text-center w-24">Trạng thái</th><th class="p-3 text-center w-24">Traffic</th><th class="p-3 text-center w-24">Xu hướng</th></tr>
                            </thead>
                            <tbody>
                                ${g.urls.map((u, i) => {
                                    const diff = (parseInt(u.TrafficCurrent)||0) - (parseInt(u.TrafficLast)||0);
                                    const titleErr = (u.TitleLen > 60 || u.TitleLen < 30) ? 'text-red-500' : 'text-gray-700';
                                    const isIndexable = String(u.Indexability).includes('Non') ? 'text-red-600' : 'text-green-600';
                                    
                                    let seoScore = 100;
                                    if (u.TitleLen < 30 || u.TitleLen > 60) seoScore -= 20;
                                    if (u.H1Tech === 'N/A' || u.H1Tech === '') seoScore -= 20;
                                    if (u.WordCount < 500) seoScore -= 20;
                                    if (u.Inlinks < 2) seoScore -= 10;
                                    if (String(u.Indexability).includes('Non')) seoScore -= 50;
                                    seoScore = Math.max(0, seoScore); 
                                    let scoreColor = seoScore >= 90 ? 'bg-green-500' : (seoScore >= 70 ? 'bg-orange-500' : 'bg-red-500');

                                    let convCount = parseFloat(u.Conversions) || 0;
                                    let timeStr = formatTimeOnPage(u.TimeOnPage);
                                    let timeColor = parseFloat(u.TimeOnPage) > 90 ? 'text-green-600' : (parseFloat(u.TimeOnPage) < 30 ? 'text-red-500' : 'text-gray-700');
                                    
                                    return `
                                        <tr class="border-b hover:bg-blue-50/30 transition-colors">
                                            <td class="p-3 text-xs text-gray-400 font-bold text-center">${i+1}</td>
                                            <td class="p-3">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <span class="${scoreColor} text-white font-black text-[9px] px-2 py-0.5 rounded shadow-sm" title="Điểm SEO Onpage">Điểm SEO: ${seoScore}</span>
                                                    ${convCount > 0 ? `<span class="bg-yellow-100 text-yellow-800 font-black text-[9px] px-2 py-0.5 rounded border border-yellow-300 shadow-sm"><i class="fas fa-coins mr-1"></i>Ra đơn</span>` : ''}
                                                    <a href="${u.URL}" target="_blank" class="text-blue-600 text-[11px] font-bold hover:underline truncate max-w-[400px] block" title="${u.URL}">${u.URL}</a>
                                                </div>
                                                
                                                <div class="grid grid-cols-3 gap-3 p-2 bg-gray-50 rounded text-[9px] border border-gray-100 shadow-sm">
                                                    <div class="col-span-2 border-r border-gray-200 pr-2">
                                                        <div class="grid grid-cols-2 gap-2 mb-2 pb-2 border-b border-gray-200 border-dashed">
                                                            <div><span class="text-gray-400 uppercase font-bold">Title:</span> <span class="${titleErr}">${u.TitleTech} (${u.TitleLen})</span></div>
                                                            <div><span class="text-gray-400 uppercase font-bold">H1:</span> <span>${u.H1Tech}</span></div>
                                                            <div><span class="text-gray-400 uppercase font-bold">Content:</span> <span class="${u.WordCount < 500 ? 'text-orange-500 font-bold' : ''}">${parseInt(u.WordCount||0).toLocaleString('vi-VN')} chữ</span></div>
                                                            <div><span class="text-gray-400 uppercase font-bold">Health:</span> <span>${u.Inlinks} Links | <b class="${isIndexable}">${u.Indexability}</b></span></div>
                                                        </div>
                                                        <div class="grid grid-cols-2 gap-2">
                                                            <div><span class="text-gray-400 uppercase font-bold"><i class="fas fa-clock mr-1"></i>Tg xem:</span> <b class="${timeColor}">${timeStr}</b></div>
                                                            <div><span class="text-gray-400 uppercase font-bold"><i class="fas fa-bolt mr-1"></i>Chuyển đổi:</span> <b class="${convCount > 0 ? 'text-green-600 text-[10px]' : 'text-gray-500'}">${convCount}</b></div>
                                                        </div>
                                                    </div>
                                                    <div class="pl-1">
                                                        <div class="text-purple-600 uppercase font-black mb-1"><i class="fab fa-google mr-1"></i>Google Search</div>
                                                        <div class="flex justify-between"><span class="text-gray-500">Vị trí:</span> <b class="text-green-600">Top ${parseFloat(u.GSCPos||0).toFixed(1)}</b></div>
                                                        <div class="flex justify-between"><span class="text-gray-500">Clicks:</span> <b>${parseInt(u.GSCClicks||0).toLocaleString('vi-VN')}</b></div>
                                                        <div class="flex justify-between"><span class="text-gray-500">Imp:</span> <b>${parseInt(u.GSCImp||0).toLocaleString('vi-VN')}</b></div>
                                                        <div class="flex justify-between"><span class="text-gray-500">CTR:</span> <b>${u.GSCCTR || '0%'}</b></div>
                                                    </div>
                                                </div>
                                                
                                            </td>
                                            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-700 whitespace-nowrap">${u.TrangThai}</span></td>
                                            <td class="p-3 text-center font-bold text-xs">${parseInt(u.TrafficCurrent).toLocaleString('vi-VN')}</td>
                                            <td class="p-3 text-center text-[10px] font-bold ${diff > 0 ? 'text-green-600' : 'text-red-600'}">${diff > 0 ? '+' + diff.toLocaleString('vi-VN') : diff.toLocaleString('vi-VN')}</td>
                                        </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </td>
            </tr>`);
    });

    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    let paginationContainer = document.getElementById('paginationControls');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let buttons = '';
    
    buttons += `<button onclick="changePage(${currentPage - 1})" class="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-orange-50 disabled:opacity-50 text-sm font-bold transition-colors" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            if (i === currentPage) {
                buttons += `<button class="px-4 py-2 rounded-lg bg-orange-500 text-white font-bold shadow-md text-sm cursor-default">${i}</button>`;
            } else {
                buttons += `<button onclick="changePage(${i})" class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm font-semibold">${i}</button>`;
            }
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            buttons += `<span class="px-2 text-gray-400">...</span>`;
        }
    }

    buttons += `<button onclick="changePage(${currentPage + 1})" class="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-orange-50 disabled:opacity-50 text-sm font-bold transition-colors" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

    paginationContainer.innerHTML = buttons;
}

function changePage(page) {
    currentPage = page;
    renderCategoryAccordion();
    let containerWrap = document.getElementById('categoryAccordionBody').closest('.bg-white');
    if(containerWrap) {
        containerWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function toggleAccordion(id) {
    const r = document.getElementById(id);
    const i = document.getElementById('icon-' + id);
    if (!r || !i) return;
    if(r.classList.contains('hidden')) { r.classList.remove('hidden'); i.style.transform = 'rotate(90deg)'; }
    else { r.classList.add('hidden'); i.style.transform = 'rotate(0deg)'; }
}

// KHỞI CHẠY HỆ THỐNG
loadData();
