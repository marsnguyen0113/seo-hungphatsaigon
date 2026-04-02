// ĐIỀN LINK GOOGLE APPS SCRIPT CỦA BẠN VÀO ĐÂY
const API_URL = "https://api-hungphatsaigon.hoangtuanvpro.workers.dev/";

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN');
let globalDetails = [];
let charts = {};

/**
 * 1. HÀM CHUYỂN ĐỔI NGÀY THÁNG ĐỂ HIỂN THỊ
 */
function formatDisplayDate(dateStr) {
    const d = parseDate(dateStr);
    if (!d || isNaN(d)) return 'N/A';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * 2. HÀM XỬ LÝ NGÀY THÁNG ĐỂ HỆ THỐNG TÍNH TOÁN
 */
function parseDate(val) {
    if (!val) return null;
    let str = String(val).trim();
    if (str.includes('/')) {
        let parts = str.split('/');
        if (parts.length === 3) {
            let p0 = parseInt(parts[0]);
            let p1 = parseInt(parts[1]);
            let p2 = parseInt(parts[2]);
            if (p0 > 12) { return new Date(p2, p1 - 1, p0); } 
            if (p1 > 12) { return new Date(p2, p0 - 1, p1); }
            return new Date(p2, p1 - 1, p0);
        }
    }
    let d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * 3. HÀM CHUẨN HÓA TRẠNG THÁI (Mapping Tiếng Việt -> Logic)
 */
function getNormalizedStatus(viStatus) {
    if (!viStatus) return 'outdated';
    const s = String(viStatus).toLowerCase();
    if (s.includes('mới')) return 'fresh';
    if (s.includes('gần đây')) return 'recent';
    if (s.includes('cập nhật') || s.includes('xem xét')) return 'stale';
    if (s.includes('lỗi thời')) return 'outdated';
    return 'outdated';
}

/**
 * 4. HÀM KHỞI TẠO BỘ LỌC
 */
function initFilters() {
    const mainSelect = document.getElementById('mainCatFilter');
    const subSelect = document.getElementById('subCatFilter');
    if (!mainSelect || !subSelect) return;

    const mainCats = [...new Set(globalDetails.map(item => item.DanhMucChinh || 'Khác'))].sort();
    const subCats = [...new Set(globalDetails.map(item => item.DanhMucCon || 'Chung'))].sort();

    mainSelect.innerHTML = '<option value="">Tất cả danh mục chính</option>' + 
        mainCats.map(c => `<option value="${c}">${c}</option>`).join('');
    subSelect.innerHTML = '<option value="">Tất cả danh mục con</option>' + 
        subCats.map(c => `<option value="${c}">${c}</option>`).join('');

    ['mainCatFilter', 'subCatFilter', 'statusFilter', 'urlSearch'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderCategoryAccordion);
    });

    document.getElementById('resetFilterBtn').onclick = () => {
        ['mainCatFilter', 'subCatFilter', 'statusFilter', 'urlSearch'].forEach(id => {
            document.getElementById(id).value = '';
        });
        renderCategoryAccordion();
    };
}

/**
 * 5. TẢI DỮ LIỆU TỪ API
 */
async function loadData() {
    // Hiển thị trạng thái loading nếu cần
    const tbody = document.getElementById('categoryAccordionBody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu...</td></tr>';

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        const tq = data.tongQuan;
        globalDetails = Array.isArray(data.chiTiet) ? data.chiTiet : []; 

        // Cập nhật KPI
        const total = parseInt(tq.tongUrl) || 0;
        document.getElementById('totalUrls').textContent = total;
        document.getElementById('totalCategories').textContent = tq.danhMuc || '0';
        document.getElementById('freshContent').textContent = tq.baiMoi || '0';
        document.getElementById('outdatedContent').textContent = (parseInt(tq.canCapNhat) || 0) + (parseInt(tq.loiThoi) || 0);
        document.getElementById('recommendUpdate').textContent = tq.loiThoi || '0';

        if(total > 0) {
            document.getElementById('freshPercent').innerHTML = `<i class="fas fa-percentage mr-1"></i> ${((parseInt(tq.baiMoi) / total) * 100).toFixed(1)}% tổng nội dung`;
        }

        renderAllCharts(total);
        renderTop10Priority();
        renderCategoryAccordion();
        initFilters();

    } catch (error) {
        console.error('Lỗi hệ thống:', error);
        tbody.innerHTML = `<tr class="bg-red-50"><td colspan="6" class="text-center py-8 text-red-600 font-bold border-red-200 border">LỖI: ${error.message}</td></tr>`;
    }
}

/**
 * 6. VẼ BIỂU ĐỒ (CHART.JS)
 */
function renderAllCharts(total) {
    const catCounts = {};
    const monthCounts = {};
    const statusCounts = { fresh: 0, recent: 0, stale: 0, outdated: 0 };
    
    for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        monthCounts[d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })] = 0;
    }

    globalDetails.forEach(item => {
        const cat = item.DanhMucChinh || 'Khác';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
        statusCounts[getNormalizedStatus(item.TrangThai)]++;
        const d = parseDate(item.NgayCapNhat);
        if (d) {
            const mKey = d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
            if(monthCounts[mKey] !== undefined) monthCounts[mKey]++;
        }
    });

    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    const themeColors = ['#F97316', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    const top5 = sortedCats.slice(0, 5);

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
    };

    const renderChart = (id, config) => {
        if (charts[id]) charts[id].destroy();
        charts[id] = new Chart(document.getElementById(id), config);
    };

    renderChart('topicChart', { 
        type: 'doughnut', 
        data: { 
            labels: top5.map(c => c[0]), 
            datasets: [{ data: top5.map(c => c[1]), backgroundColor: themeColors, borderWidth: 2 }] 
        },
        options: { ...commonOptions, cutout: '75%' }
    });

    renderChart('statusChart', { 
        type: 'bar', 
        data: { 
            labels: ['Mới', 'Gần đây', 'Cần xem xét', 'Lỗi thời'], 
            datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'], borderRadius: 6 }] 
        },
        options: { ...commonOptions }
    });

    const healthScore = total > 0 ? Math.round(100 - ((statusCounts.outdated / total) * 100)) : 0;
    document.getElementById('healthScoreValue').textContent = healthScore;
    
    renderChart('healthScore', { 
        type: 'doughnut', 
        data: { 
            labels: ['Khỏe mạnh', 'Cần xử lý'], 
            datasets: [{ data: [healthScore, 100 - healthScore], backgroundColor: [healthScore >= 70 ? '#10B981' : '#EF4444', '#F3F4F6'], borderWidth: 0 }] 
        },
        options: { ...commonOptions, cutout: '80%' }
    });
}

/**
 * 7. RENDER TOP 10 ƯU TIÊN
 */
function renderTop10Priority() {
    let list = globalDetails.filter(i => ['outdated', 'stale'].includes(getNormalizedStatus(i.TrangThai)));
    list.sort((a, b) => (parseDate(a.NgayCapNhat) || 0) - (parseDate(b.NgayCapNhat) || 0));
    
    const tbody = document.getElementById('priorityUrlsTable');
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-green-600 font-bold">Nội dung website tốt!</td></tr>';
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tbody.innerHTML = list.slice(0, 10).map((u, i) => {
        const status = getNormalizedStatus(u.TrangThai);
        const badgeClass = status === 'outdated' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700';
        
        let daysText = "N/A";
        const updateDate = parseDate(u.NgayCapNhat);
        if (updateDate) {
            updateDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor(Math.abs(today - updateDate) / (1000 * 60 * 60 * 24));
            daysText = `${diffDays} ngày`;
        }

        return `
            <tr class="border-b border-gray-50 hover:bg-gray-50">
                <td class="px-3 py-3 text-gray-400 font-bold">${i + 1}</td>
                <td class="px-3 py-3">
                    <a href="${u.URL}" target="_blank" class="text-blue-600 hover:underline text-xs break-all">${String(u.URL).replace('https://hungphatsaigon.vn/', '')}</a>
                </td>
                <td class="px-3 py-3 text-center text-gray-500 text-xs">${formatDisplayDate(u.NgayCapNhat)}</td>
                <td class="px-3 py-3 text-center">
                    <span class="px-2 py-1 rounded text-xs font-black ${badgeClass}">${daysText}</span>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * 8. RENDER BẢNG ACCORDION & LOGIC LỌC
 * TỐI ƯU: Thêm cột Thứ hạng và Badge màu sắc
 */
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
        const mSearch = !searchVal || (item.URL && String(item.URL).toLowerCase().includes(searchVal));
        return mMain && mSub && mStatus && mSearch;
    });

    const grouped = {};
    filtered.forEach(item => {
        const key = `${item.DanhMucChinh || 'Khác'}___${item.DanhMucCon || 'Chung'}`;
        if(!grouped[key]) grouped[key] = { main: item.DanhMucChinh || 'Khác', sub: item.DanhMucCon || 'Chung', urls: [], latest: null };
        grouped[key].urls.push(item);
        const d = parseDate(item.NgayCapNhat);
        if (d && (!grouped[key].latest || d > grouped[key].latest)) grouped[key].latest = d;
    });

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-400">Không có dữ liệu phù hợp.</td></tr>';
        return;
    }

    Object.keys(grouped).forEach((key, index) => {
        const g = grouped[key];
        const rowId = 'cat-row-' + index;
        const latestStr = formatDisplayDate(g.latest);
        const percent = ((g.urls.length / (globalDetails.length || 1)) * 100).toFixed(1);

        let html = `
            <tr class="border-b border-gray-100 hover:bg-orange-50 cursor-pointer" onclick="toggleAccordion('${rowId}')">
                <td class="px-4 py-4 font-bold text-gray-800 text-sm"><i class="fas fa-folder text-orange-400 mr-2"></i>${g.main}</td>
                <td class="px-4 py-4 text-gray-500 font-bold text-xs">${g.sub}</td>
                <td class="px-4 py-4 text-center font-black text-orange-600">${g.urls.length}</td>
                <td class="px-4 py-4 text-center text-gray-400 text-xs">${percent}%</td>
                <td class="px-4 py-4 text-center text-gray-500 text-xs">${latestStr}</td>
                <td class="px-4 py-4 text-center">
                    <button class="bg-orange-500 text-white px-3 py-1 rounded text-[10px] font-bold uppercase">
                        Chi tiết <i class="fas fa-chevron-right ml-1" id="icon-${rowId}"></i>
                    </button>
                </td>
            </tr>
            <tr id="${rowId}" class="hidden bg-gray-50/30">
                <td colspan="6" class="p-4">
                    <div class="max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50 font-bold text-[10px] text-gray-400 uppercase sticky top-0">
                                <tr>
                                    <th class="p-3">STT</th>
                                    <th class="p-3">URL Chi Tiết</th>
                                    <th class="p-3 text-center">Cập nhật</th>
                                    <th class="p-3 text-center">Trạng thái</th>
                                    <th class="p-3 text-center">Kỹ thuật</th>
                                    <th class="p-3 text-center">Thứ hạng</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${g.urls.map((u, i) => {
                                    const n = getNormalizedStatus(u.TrangThai);
                                    const badge = n === 'fresh' ? 'bg-green-100 text-green-700' : n === 'recent' ? 'bg-blue-100 text-blue-700' : n === 'stale' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                                    
                                    // Xử lý màu sắc Kỹ thuật
                                    const techVal = u.LoiKyThuat || 'OK';
                                    const techClass = (techVal === "OK" || techVal === "Sạch lỗi") ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';

                                    // Xử lý màu sắc Thứ hạng (GSC)
                                    const rank = parseFloat(u.ThuHang) || 0;
                                    let rankBadge = 'text-gray-400';
                                    if (rank > 0 && rank <= 3) rankBadge = 'text-yellow-600 font-black'; // Top 3
                                    else if (rank > 3 && rank <= 10) rankBadge = 'text-blue-600 font-bold'; // Trang 1

                                    return `
                                        <tr class="border-b border-gray-50">
                                            <td class="p-3 text-xs font-bold text-gray-300">${i+1}</td>
                                            <td class="p-3"><a href="${u.URL}" target="_blank" class="text-blue-500 text-[11px] break-all hover:underline">${u.URL}</a></td>
                                            <td class="p-3 text-center text-[10px] font-bold text-gray-500">${formatDisplayDate(u.NgayCapNhat)}</td>
                                            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${badge}">${u.TrangThai}</span></td>
                                            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded border text-[9px] font-black uppercase ${techClass}">${techVal}</span></td>
                                            <td class="p-3 text-center ${rankBadge} text-xs">${u.ThuHang || '-'}</td>
                                        </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </td>
            </tr>`;
        tbody.insertAdjacentHTML('beforeend', html);
    });
}

function toggleAccordion(id) {
    const r = document.getElementById(id);
    const i = document.getElementById('icon-' + id);
    if(r.classList.contains('hidden')) { r.classList.remove('hidden'); i.classList.add('rotate-90'); }
    else { r.classList.add('hidden'); i.classList.remove('rotate-90'); }
}

// KHỞI CHẠY
loadData();
