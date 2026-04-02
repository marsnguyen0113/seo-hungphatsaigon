// ĐIỀN LINK GOOGLE APPS SCRIPT CỦA BẠN VÀO ĐÂY
const API_URL = "https://api-hungphatsaigon.hoangtuanvpro.workers.dev/";

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN');
let globalDetails = [];
let charts = {};
// BIẾN MỚI CHO RANK TRACKING
let rankTrackingData = []; 

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

function initFilters() {
    const mainSelect = document.getElementById('mainCatFilter');
    const subSelect = document.getElementById('subCatFilter');
    if (!mainSelect || !subSelect) return;
    const mainCats = [...new Set(globalDetails.map(item => item.DanhMucChinh || 'Khác'))].sort();
    const subCats = [...new Set(globalDetails.map(item => item.DanhMucCon || 'Chung'))].sort();
    mainSelect.innerHTML = '<option value="">Tất cả danh mục chính</option>' + mainCats.map(c => `<option value="${c}">${c}</option>`).join('');
    subSelect.innerHTML = '<option value="">Tất cả danh mục con</option>' + subCats.map(c => `<option value="${c}">${c}</option>`).join('');
    ['mainCatFilter', 'subCatFilter', 'statusFilter', 'urlSearch'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderCategoryAccordion);
    });
    document.getElementById('resetFilterBtn').onclick = () => {
        ['mainCatFilter', 'subCatFilter', 'statusFilter', 'urlSearch'].forEach(id => document.getElementById(id).value = '');
        renderCategoryAccordion();
    };
}

async function loadData() {
    const tbody = document.getElementById('categoryAccordionBody');
    tbody.innerHTML = '<tr><td colspan="6" class="p-10 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu GSC và nội soi SEO...</td></tr>';
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        globalDetails = data.chiTiet || [];
        rankTrackingData = data.rankTracking || []; // LẤY DỮ LIỆU TỪ KHÓA
        const tq = data.tongQuan;
        
        // CẬP NHẬT KPI (Tính năng gốc của bạn)
        document.getElementById('totalUrls').textContent = tq.tongUrl || '0';
        document.getElementById('totalCategories').textContent = tq.danhMuc || '0';
        document.getElementById('freshContent').textContent = tq.baiMoi || '0';
        document.getElementById('outdatedContent').textContent = (parseInt(tq.canCapNhat)||0) + (parseInt(tq.loiThoi)||0);
        document.getElementById('recommendUpdate').textContent = tq.loiThoi || '0';

        renderAllCharts(parseInt(tq.tongUrl));
        renderTop10Priority();
        renderRankTracking(); // VẼ BẢNG TỪ KHÓA MỚI
        renderCategoryAccordion();
        initFilters();
    } catch (e) { console.error(e); }
}

function renderAllCharts(total) {
    const statusCounts = { fresh: 0, recent: 0, stale: 0, outdated: 0 };
    globalDetails.forEach(item => statusCounts[getNormalizedStatus(item.TrangThai)]++);
    
    // Biểu đồ trạng thái (Tính năng gốc)
    if (charts['statusChart']) charts['statusChart'].destroy();
    charts['statusChart'] = new Chart(document.getElementById('statusChart'), {
        type: 'bar',
        data: { labels: ['Mới', 'Gần đây', 'Sắp cũ', 'Lỗi thời'], datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    // Biểu đồ sức khỏe (Tính năng gốc)
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

/**
 * TÍNH NĂNG MỚI: BẢNG THEO DÕI TỪ KHÓA (RANK TRACKING)
 */
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

    // Sắp xếp: Từ khóa Top cao nhất lên đầu
    rankTrackingData.sort((a, b) => (parseFloat(a.Position) || 100) - (parseFloat(b.Position) || 100));

    let rows = rankTrackingData.map((kw) => {
        const pos = parseFloat(kw.Position).toFixed(1);
        let posBadge = pos <= 3 ? 'bg-green-100 text-green-700' : (pos <= 10 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600');
        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 text-sm font-bold text-gray-800">${kw.Keyword}</td>
                <td class="p-3 text-center text-blue-600 font-bold">${parseInt(kw.Clicks).toLocaleString('vi-VN')}</td>
                <td class="p-3 text-center text-gray-600">${parseInt(kw.Impressions).toLocaleString('vi-VN')}</td>
                <td class="p-3 text-center font-bold text-[10px]"><span class="px-2 py-1 rounded ${posBadge}">Top ${pos}</span></td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
            <h2 class="text-lg font-black text-gray-800"><i class="fas fa-trophy text-yellow-500 mr-2"></i>Theo dõi từ khóa chủ lực (Search Console)</h2>
        </div>
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead class="bg-gray-50 text-[11px] text-gray-500 uppercase font-bold">
                    <tr>
                        <th class="p-3">Từ khóa mục tiêu</th>
                        <th class="p-3 text-center">Clicks</th>
                        <th class="p-3 text-center">Hiển thị (Imp)</th>
                        <th class="p-3 text-center">Vị trí trung bình</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderCategoryAccordion() {
    const tbody = document.getElementById('categoryAccordionBody');
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

    tbody.innerHTML = '';
    Object.keys(grouped).forEach((key, index) => {
        const g = grouped[key];
        g.urls.sort((a,b) => (parseInt(b.TrafficCurrent)||0) - (parseInt(a.TrafficCurrent)||0));
        const rowId = 'cat-row-' + index;

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
                                <tr><th class="p-3 w-10">STT</th><th class="p-3">Phân tích URL, SEO Audit & GSC</th><th class="p-3 text-center w-24">Trạng thái</th><th class="p-3 text-center w-24">Traffic</th><th class="p-3 text-center w-24">Xu hướng</th></tr>
                            </thead>
                            <tbody>
                                ${g.urls.map((u, i) => {
                                    const diff = (parseInt(u.TrafficCurrent)||0) - (parseInt(u.TrafficLast)||0);
                                    const titleErr = (u.TitleLen > 60 || u.TitleLen < 30) ? 'text-red-500' : 'text-gray-700';
                                    const isIndexable = String(u.Indexability).includes('Non') ? 'text-red-600' : 'text-green-600';
                                    
                                    return `
                                        <tr class="border-b hover:bg-blue-50/30 transition-colors">
                                            <td class="p-3 text-xs text-gray-300 font-bold">${i+1}</td>
                                            <td class="p-3">
                                                <a href="${u.URL}" target="_blank" class="text-blue-500 text-[11px] font-bold hover:underline">${u.URL}</a>
                                                
                                                <div class="grid grid-cols-3 gap-3 mt-2 p-2 bg-gray-50 rounded text-[9px] border border-gray-100 shadow-sm">
                                                    <div class="col-span-2 grid grid-cols-2 gap-2 border-r border-gray-200 pr-2">
                                                        <div><span class="text-gray-400 uppercase font-bold">Title:</span> <span class="${titleErr}">${u.TitleTech} (${u.TitleLen})</span></div>
                                                        <div><span class="text-gray-400 uppercase font-bold">H1:</span> <span>${u.H1Tech}</span></div>
                                                        <div><span class="text-gray-400 uppercase font-bold">Content:</span> <span class="${u.WordCount < 500 ? 'text-orange-500 font-bold' : ''}">${parseInt(u.WordCount||0).toLocaleString('vi-VN')} chữ</span></div>
                                                        <div><span class="text-gray-400 uppercase font-bold">Health:</span> <span>${u.Inlinks} Links | <b class="${isIndexable}">${u.Indexability}</b></span></div>
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
}

function toggleAccordion(id) {
    const r = document.getElementById(id);
    const i = document.getElementById('icon-' + id);
    if(r.classList.contains('hidden')) { r.classList.remove('hidden'); i.style.transform = 'rotate(90deg)'; }
    else { r.classList.add('hidden'); i.style.transform = 'rotate(0deg)'; }
}

loadData();
