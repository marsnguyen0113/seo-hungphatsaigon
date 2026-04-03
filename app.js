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
        document.getElementById(id).addEventListener('input', () => {
            currentPage = 1;
            processFilters();
        });
    });

    document.getElementById('resetFilterBtn').onclick = () => {
        ['mainCatFilter', 'subCatFilter', 'statusFilter', 'urlSearch'].forEach(id => document.getElementById(id).value = '');
        currentPage = 1;
        processFilters();
    };
}

async function loadData() {
    const tbody = document.getElementById('categoryAccordionBody');
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
        
        initFilters();
        // Gọi hàm xử lý lọc thay vì render trực tiếp
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
    globalDetails.forEach(item => statusCounts[getNormalizedStatus(item.TrangThai)]++);
    
    if (charts['statusChart']) charts['statusChart'].destroy();
    charts['statusChart'] = new Chart(document.getElementById('statusChart'), {
        type: 'bar',
        data: { labels: ['Mới', 'Gần đây', 'Sắp cũ', 'Lỗi thời'], datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    const health = total > 0 ? Math.round(100 - ((statusCounts.outdated / total) * 100)) : 0;
    document.getElementById('healthScoreValue').textContent = health;
}

function renderTop10Priority() {
    let list = globalDetails.filter(i => ['outdated', 'stale'].includes(getNormalizedStatus(i.TrangThai)));
    list.sort((a,b) => (parseDate(a.NgayCapNhat)||0) - (parseDate(b.NgayCapNhat)||0));
    const tbody = document.getElementById('priorityUrlsTable');
    if (!tbody) return;
    tbody.innerHTML = list.slice(0, 10).map((u, i) => `
        <tr class="border-b text-xs">
            <td class="p-2 text-gray-400 font-bold">${i+1}</td>
            <td class="p-2 text-blue-600">${u.URL.replace('https://hungphatsaigon.vn/','')}</td>
            <td class="p-2 text-center">${formatDisplayDate(u.NgayCapNhat)}</td>
            <td class="p-2 text-center"><span class="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold">${u.TrangThai}</span></td>
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
            <tr class="border-b ${isLowHanging}">
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
        <div class="overflow-x-auto max-h-96">
            <table class="w-full text-left">
                <thead class="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold sticky top-0 z-10">
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
        container.innerHTML = `<div class="px-6 py-4 bg-gray-50 text-gray-700 font-bold"><i class="fas fa-info-circle mr-2"></i>Chưa có dữ liệu Cannibalization.</div>`;
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
    cannibalized = cannibalized.slice(0, 20);

    if (cannibalized.length === 0) {
        container.innerHTML = `<div class="px-6 py-4 bg-green-50 text-green-700 font-bold"><i class="fas fa-check-circle mr-2"></i>Tuyệt vời! Không phát hiện URL nào xung đột từ khóa.</div>`;
        return;
    }

    let rows = cannibalized.map((item) => {
        let urlRows = item.urls.map((u, index) => {
            let badge = index === 0 ? `<span class="bg-green-100 text-green-700 px-1 py-0.5 rounded text-[8px] uppercase font-bold ml-2">Đang Top</span>` : `<span class="bg-red-100 text-red-700 px-1 py-0.5 rounded text-[8px] uppercase font-bold ml-2">Đang phá</span>`;
            return `
                <div class="flex items-center justify-between mb-1 pb-1 border-b border-gray-50 border-dashed last:border-0 last:mb-0 last:pb-0">
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
                    <button class="bg-gray-800 hover:bg-black text-white px-2 py-1 rounded shadow-sm block w-full text-center mb-1">Gộp bài</button>
                    <button class="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 px-2 py-1 rounded shadow-sm block w-full text-center">Cắm Canonical</button>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-gray-800 to-gray-700 flex justify-between items-center cursor-pointer" onclick="document.getElementById('canniTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-white"><i class="fas fa-skull-crossbones text-red-400 mr-2"></i>Radar Ăn Thịt Từ Khóa (Cannibalization) <span class="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">${cannibalized.length} Lỗi Khẩn Cấp</span></h2>
            <button class="bg-gray-600 hover:bg-gray-500 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
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
        <div class="px-6 py-4 border-b border-yellow-200 bg-gradient-to-r from-yellow-100 to-white flex justify-between items-center cursor-pointer" onclick="document.getElementById('moneyTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-yellow-800"><i class="fas fa-coins text-yellow-600 mr-2"></i>Trạm Săn Money Pages (GA4) <span class="bg-yellow-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">Top ${moneyPages.length}</span></h2>
            <button class="bg-yellow-500 hover:bg-yellow-600 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="moneyTableArea" class="hidden overflow-x-auto p-4 bg-yellow-50/30">
            <table class="w-full text-left bg-white border border-yellow-200 rounded-lg overflow-hidden shadow-sm">
                <thead class="bg-yellow-100/50 text-[10px] text-yellow-800 uppercase font-black">
                    <tr>
                        <th class="p-3 w-10">STT</th>
                        <th class="p-3">Bài viết "Bò sữa"</th>
                        <th class="p-3 text-center w-24">Traffic</th>
                        <th class="p-3 text-center w-32">Tg đọc (Avg)</th>
                        <th class="p-3 text-center w-32">Chuyển đổi</th>
                    </tr>
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
                <td class="p-3 text-center">
                    <span class="bg-red-100 text-red-800 px-2 py-1 rounded font-black shadow-sm text-[10px]">
                        <i class="fas fa-arrow-down mr-1"></i>${dropRatio}% (-${dropAbs})
                    </span>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-red-200 bg-gradient-to-r from-red-100 to-white flex justify-between items-center cursor-pointer" onclick="document.getElementById('decayTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-red-800"><i class="fas fa-chart-line fa-flip-vertical text-red-600 mr-2"></i>Trạm Cảnh Báo Suy Thoái Nội Dung <span class="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">${decayingPages.length} Bài Rớt Hạng</span></h2>
            <button class="bg-red-500 hover:bg-red-600 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="decayTableArea" class="hidden overflow-x-auto p-4 bg-red-50/30">
            <table class="w-full text-left bg-white border border-red-200 rounded-lg overflow-hidden shadow-sm">
                <thead class="bg-red-100/50 text-[10px] text-red-800 uppercase font-black">
                    <tr>
                        <th class="p-3 w-10">STT</th>
                        <th class="p-3">URL Đang Suy Thoái</th>
                        <th class="p-3 text-center w-24">Traffic Tháng Trước</th>
                        <th class="p-3 text-center w-24">Traffic Hiện Tại</th>
                        <th class="p-3 text-center w-32">Mức Độ Tụt Hạng</th>
                    </tr>
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
            actions.push('Bổ sung thêm content hoặc Gộp với bài khác');
        }
        if ((parseInt(u.Inlinks) || 0) === 0) {
            reasons.push('<span class="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-[9px] uppercase font-bold mb-1 inline-block">Trang mồ côi</span>');
            actions.push('Chèn Internal link từ trang chủ/chuyên mục');
        }
        if (String(u.Indexability).includes('Non')) {
            reasons.push('<span class="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[9px] uppercase font-bold inline-block">Bị chặn Index</span>');
            actions.push('Kiểm tra thẻ noindex hoặc Xóa bỏ nếu không cần');
        }

        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 text-xs text-gray-400 font-bold">${i+1}</td>
                <td class="p-3 text-xs">
                    <a href="${u.URL}" target="_blank" class="text-blue-600 font-bold hover:underline block mb-1 break-all">${u.URL}</a>
                    <div class="text-[10px] text-gray-500">${u.TieuDe}</div>
                </td>
                <td class="p-3">${reasons.join(' ')}</td>
                <td class="p-3 text-[11px] text-purple-700 font-medium"><i class="fas fa-tools mr-1"></i>${actions.join(' <br> <i class="fas fa-tools mr-1"></i>')}</td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white flex justify-between items-center cursor-pointer" onclick="document.getElementById('zombieTableArea').classList.toggle('hidden')">
            <h2 class="text-lg font-black text-purple-800"><i class="fas fa-spider text-purple-500 mr-2"></i>Trạm Quét Zombie Pages <span class="bg-red-500 text-white px-2 py-0.5 rounded-full text-xs ml-2">${zombies.length} URL</span></h2>
            <button class="bg-purple-600 hover:bg-purple-700 transition-colors text-white px-3 py-1 rounded text-xs font-bold uppercase shadow-sm">Xem chi tiết <i class="fas fa-chevron-down ml-1"></i></button>
        </div>
        <div id="zombieTableArea" class="hidden overflow-x-auto p-4 bg-gray-50">
            <table class="w-full text-left bg-white border border-gray-200 rounded-lg overflow-hidden">
                <thead class="bg-gray-100 text-[10px] text-gray-500 uppercase font-bold">
                    <tr>
                        <th class="p-3 w-10">STT</th>
                        <th class="p-3">URL Thây ma</th>
                        <th class="p-3 w-40">Nguyên nhân</th>
                        <th class="p-3 w-64">AI Gợi ý xử lý</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

// HÀM MỚI: XỬ LÝ LỌC & GỌI PHÂN TRANG
function processFilters() {
    const mainVal = document.getElementById('mainCatFilter').value;
    const subVal = document.getElementById('subCatFilter').value;
    const statusVal = document.getElementById('statusFilter').value;
    const searchVal = document.getElementById('urlSearch').value.toLowerCase();

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

    // Cập nhật mảng hiện tại cho phân trang
    currentFilteredGroups = Object.keys(grouped).map(key => grouped[key]);
    
    currentFilteredGroups.sort((a, b) => {
        let totalA = a.urls.reduce((sum, u) => sum + (parseInt(u.TrafficCurrent)||0), 0);
        let totalB = b.urls.reduce((sum, u) => sum + (parseInt(u.TrafficCurrent)||0), 0);
        return totalB - totalA;
    });

    // Gọi hàm render bảng dựa trên biến currentPage
    renderCategoryAccordion();
}

// RENDER BẢNG THEO SỐ TRANG
function renderCategoryAccordion() {
    const tbody = document.getElementById('categoryAccordionBody');
    tbody.innerHTML = '';

    const totalPages = Math.ceil(currentFilteredGroups.length / ITEMS_PER_PAGE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const groupsToRender = currentFilteredGroups.slice(startIndex, endIndex);

    if (groupsToRender.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-gray-500">Không tìm thấy dữ liệu.</td></tr>`;
        renderPaginationControls(totalPages);
        return;
    }

    groupsToRender.forEach((g, index) => {
        g.urls.sort((a,b) => (parseInt(b.TrafficCurrent)||0) - (parseInt(a.TrafficCurrent)||0));
        const rowId = 'cat-row-' + (startIndex + index);

        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b hover:bg-orange-50 cursor-pointer" onclick="toggleAccordion('${rowId}')">
                <td class="p-4 font-bold text-sm"><i class="fas fa-folder text-orange-400 mr-2"></i>${g.main}</td>
                <td class="p-4 text-xs text-gray-500 font-bold">${g.sub}</td>
                <td class="p-4 text-center font-black text-orange-600">${g.urls.length}</td>
                <td class="p-4 text-center text-gray-400 text-xs">${((g.urls.length / globalDetails.length)*100).toFixed(1)}%</td>
                <td class="p-4 text-center text-gray-500 text-xs font-bold">---</td>
                <td class="p-4 text-center"><button class="bg-orange-500 text-white px-3 py-1 rounded text-[10px] font-bold uppercase">Chi tiết <i class="fas fa-chevron-right ml-1 transition-transform" id="icon-${rowId}"></i></button></td>
            </tr>
            <tr id="${rowId}" class="hidden bg-gray-50/30 border-b-2 border-orange-100">
                <td colspan="6" class="p-4">
                    <div class="max-h-120 overflow-y-auto rounded-lg border bg-white shadow-inner">
                        <table class="w-full text-left">
                            <thead class="bg-gray-100 text-[10px] text-gray-400 uppercase sticky top-0 z-10">
                                <tr><th class="p-3 w-10">STT</th><th class="p-3">Phân tích URL, Điểm SEO & GSC</th><th class="p-3 text-center w-24">Trạng thái</th><th class="p-3 text-center w-24">Traffic</th><th class="p-3 text-center w-24">Xu hướng</th></tr>
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
                                            <td class="p-3 text-xs text-gray-300 font-bold">${i+1}</td>
                                            <td class="p-3">
                                                <div class="flex items-center gap-2 mb-2">
                                                    <span class="${scoreColor} text-white font-black text-[9px] px-2 py-0.5 rounded" title="Điểm SEO Onpage">Điểm SEO: ${seoScore}</span>
                                                    ${convCount > 0 ? `<span class="bg-yellow-100 text-yellow-800 font-black text-[9px] px-2 py-0.5 rounded border border-yellow-300"><i class="fas fa-coins mr-1"></i>Ra đơn</span>` : ''}
                                                    <a href="${u.URL}" target="_blank" class="text-blue-500 text-[11px] font-bold hover:underline">${u.URL}</a>
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
                                            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-100 text-blue-700">${u.TrangThai}</span></td>
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

// HÀM VẼ NÚT BẤM CHUYỂN TRANG
function renderPaginationControls(totalPages) {
    let paginationContainer = document.getElementById('paginationControls');
    if (!paginationContainer) return;

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        return;
    }

    let buttons = '';
    
    // Nút Trang trước
    buttons += `<button onclick="changePage(${currentPage - 1})" class="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-orange-50 disabled:opacity-50 text-sm font-bold transition-colors" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            if (i === currentPage) {
                buttons += `<button class="px-4 py-2 rounded-lg bg-orange-500 text-white font-bold shadow-md text-sm">${i}</button>`;
            } else {
                buttons += `<button onclick="changePage(${i})" class="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors text-sm font-semibold">${i}</button>`;
            }
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            buttons += `<span class="px-2 text-gray-400">...</span>`;
        }
    }

    // Nút Trang sau
    buttons += `<button onclick="changePage(${currentPage + 1})" class="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-orange-50 disabled:opacity-50 text-sm font-bold transition-colors" ${currentPage === totalPages ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

    paginationContainer.innerHTML = buttons;
}

// HÀM LẮNG NGHE KHI BẤM CHUYỂN TRANG
function changePage(page) {
    currentPage = page;
    renderCategoryAccordion();
    document.getElementById('categoryAccordionBody').closest('.bg-white').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleAccordion(id) {
    const r = document.getElementById(id);
    const i = document.getElementById('icon-' + id);
    if(r.classList.contains('hidden')) { r.classList.remove('hidden'); i.style.transform = 'rotate(90deg)'; }
    else { r.classList.add('hidden'); i.style.transform = 'rotate(0deg)'; }
}

loadData();
