// ĐIỀN LINK GOOGLE APPS SCRIPT CỦA BẠN VÀO ĐÂY
const API_URL = "https://api-hungphatsaigon.hoangtuanvpro.workers.dev/";

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN');
let globalDetails = [];
let charts = {};

/**
 * 1. HÀM CHUYỂN ĐỔI NGÀY THÁNG ĐỂ HIỂN THỊ (Chuẩn hóa về DD/MM/YYYY)
 */
function formatDisplayDate(dateStr) {
    if (!dateStr) return 'N/A';
    const str = String(dateStr).trim();
    const parts = str.split('/');
    if (parts.length === 3) {
        // Xử lý thông minh: Nếu phần đầu > 12 thì đó là Ngày, nếu phần giữa > 12 thì đó là Ngày
        let d = parts[0], m = parts[1], y = parts[2];
        if (parseInt(parts[1]) > 12) { [d, m] = [parts[1], parts[0]]; } 
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    return dateStr;
}

/**
 * 2. HÀM XỬ LÝ NGÀY THÁNG ĐỂ HỆ THỐNG TÍNH TOÁN (Smart Parser)
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
            // Logic nhận diện chuẩn UK/VN vs chuẩn US
            if (p0 > 12) { return new Date(p2, p1 - 1, p0); } 
            if (p1 > 12) { return new Date(p2, p0 - 1, p1); }
            return new Date(p2, p1 - 1, p0); // Mặc định DD/MM
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
 * 4. HÀM KHỞI TẠO BỘ LỌC (FILTER MODULE)
 */
function initFilters() {
    const mainSelect = document.getElementById('mainCatFilter');
    const subSelect = document.getElementById('subCatFilter');
    if (!mainSelect || !subSelect) return;

    // Lấy danh sách duy nhất
    const mainCats = [...new Set(globalDetails.map(item => item.DanhMucChinh || 'Khác'))].sort();
    const subCats = [...new Set(globalDetails.map(item => item.DanhMucCon || 'Chung'))].sort();

    mainSelect.innerHTML = '<option value="">Tất cả danh mục chính</option>' + 
        mainCats.map(c => `<option value="${c}">${c}</option>`).join('');
    subSelect.innerHTML = '<option value="">Tất cả danh mục con</option>' + 
        subCats.map(c => `<option value="${c}">${c}</option>`).join('');

    // Lắng nghe sự kiện
    ['mainCatFilter', 'subCatFilter', 'statusFilter', 'urlSearch'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderCategoryAccordion);
    });

    document.getElementById('resetFilterBtn').onclick = () => {
        document.getElementById('mainCatFilter').value = '';
        document.getElementById('subCatFilter').value = '';
        document.getElementById('statusFilter').value = '';
        document.getElementById('urlSearch').value = '';
        renderCategoryAccordion();
    };
}

/**
 * 5. TẢI DỮ LIỆU TỪ API
 */
async function loadData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        const tq = data.tongQuan;
        globalDetails = Array.isArray(data.chiTiet) ? data.chiTiet : []; 

        // Cập nhật thẻ KPI
        const total = parseInt(tq.tongUrl) || 0;
        document.getElementById('totalUrls').textContent = total;
        document.getElementById('totalCategories').textContent = tq.danhMuc || '0';
        document.getElementById('freshContent').textContent = tq.baiMoi || '0';
        document.getElementById('outdatedContent').textContent = (parseInt(tq.canCapNhat) || 0) + (parseInt(tq.loiThoi) || 0);
        document.getElementById('recommendUpdate').textContent = tq.loiThoi || '0';

        if(total > 0) {
            document.getElementById('freshPercent').innerHTML = `<i class="fas fa-percentage mr-1"></i> ${((parseInt(tq.baiMoi) / total) * 100).toFixed(1)}% tổng nội dung`;
        }

        renderAllCharts(total, parseInt(tq.baiMoi), parseInt(tq.canCapNhat));
        renderTop10Priority();
        renderCategoryAccordion();
        initFilters(); // Kích hoạt bộ lọc

    } catch (error) {
        console.error('Lỗi hệ thống:', error);
        const errorMsg = `<tr class="bg-red-50"><td colspan="6" class="text-center py-8 text-red-600 font-bold border-red-200 border">LỖI: ${error.message}</td></tr>`;
        document.getElementById('categoryAccordionBody').innerHTML = errorMsg;
    }
}

/**
 * 6. VẼ BIỂU ĐỒ (CHART.JS)
 */
function renderAllCharts(total, fresh, outdated) {
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

    // Topic Chart
    const top5 = sortedCats.slice(0, 5);
    const colors = ['#F97316', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    document.getElementById('topicLegend').innerHTML = top5.map((c, i) => `<div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background-color: ${colors[i]}"></span><span>${c[0]} (${c[1]})</span></div>`).join('');
    charts.topic = new Chart(document.getElementById('topicChart'), { type: 'doughnut', data: { labels: top5.map(c => c[0]), datasets: [{ data: top5.map(c => c[1]), backgroundColor: colors }] }, options: { cutout: '70%', plugins: { legend: { display: false } } } });

    // Status Chart
    charts.status = new Chart(document.getElementById('statusChart'), { type: 'bar', data: { labels: ['Mới', 'Gần đây', 'Xem xét', 'Lỗi thời'], datasets: [{ data: Object.values(statusCounts), backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'], borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });

    // Timeline Chart
    charts.timeline = new Chart(document.getElementById('timelineChart'), { type: 'line', data: { labels: Object.keys(monthCounts), datasets: [{ label: 'Cập nhật', data: Object.values(monthCounts), borderColor: '#10B981', tension: 0.4, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });

    // Category Bar
    const top8 = sortedCats.slice(0, 8);
    charts.brand = new Chart(document.getElementById('categoryBarChart'), { type: 'bar', data: { labels: top8.map(c => c[0]), datasets: [{ data: top8.map(c => c[1]), backgroundColor: '#8B5CF6', borderRadius: 5 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });

    // Health Score
    const score = total > 0 ? Math.round(100 - ((statusCounts.outdated / total) * 100)) : 0;
    document.getElementById('healthScoreValue').textContent = score;
    document.getElementById('healthFresh').textContent = (statusCounts.fresh + statusCounts.recent) + ' bài';
    document.getElementById('healthStale').textContent = statusCounts.stale + ' bài';
    document.getElementById('healthOutdated').textContent = statusCounts.outdated + ' bài';
    charts.health = new Chart(document.getElementById('healthScore'), { type: 'doughnut', data: { datasets: [{ data: [score, 100 - score], backgroundColor: [score >= 70 ? '#10B981' : '#EF4444', '#E5E7EB'] }] }, options: { cutout: '80%', plugins: { tooltip: { enabled: false } } } });
}

/**
 * 7. RENDER TOP 10 ƯU TIÊN
 */
function renderTop10Priority() {
    let list = globalDetails.filter(i => ['outdated', 'stale'].includes(getNormalizedStatus(i.TrangThai)));
    // Sắp xếp ưu tiên bài cũ nhất lên đầu
    list.sort((a, b) => (parseDate(a.NgayCapNhat) || 0) - (parseDate(b.NgayCapNhat) || 0));
    
    const tbody = document.getElementById('priorityUrlsTable');
    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-green-600 font-bold">Nội dung website đang ở trạng thái tốt!</td></tr>';
        return;
    }

    // Lấy mốc thời gian ngày hôm nay (loại bỏ giờ phút để tính toán chính xác)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    tbody.innerHTML = list.slice(0, 10).map((u, i) => {
        const status = getNormalizedStatus(u.TrangThai);
        // Đổi style hiển thị: Lỗi thời thì đỏ, cần xem xét thì cam
        const badgeClass = status === 'outdated' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-orange-100 text-orange-700 border border-orange-200';
        
        // Logic tính toán số ngày
        let daysText = "Không rõ";
        const updateDate = parseDate(u.NgayCapNhat);
        if (updateDate) {
            updateDate.setHours(0, 0, 0, 0);
            const diffTime = Math.abs(today - updateDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            daysText = `${diffDays} ngày`;
        }

        return `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td class="px-3 py-3 text-gray-400 font-bold">${i + 1}</td>
                <td class="px-3 py-3">
                    <a href="${u.URL}" target="_blank" class="text-blue-600 hover:underline text-xs break-all">${String(u.URL).replace('https://hungphatsaigon.vn/', '')}</a>
                </td>
                <td class="px-3 py-3 text-center text-gray-500 font-medium text-xs">${formatDisplayDate(u.NgayCapNhat)}</td>
                <td class="px-3 py-3 text-center">
                    <span class="px-2 py-1 rounded text-xs font-black ${badgeClass}">${daysText}</span>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * 8. RENDER BẢNG ACCORDION & LOGIC LỌC
 */
function renderCategoryAccordion() {
    const tbody = document.getElementById('categoryAccordionBody');
    const mainVal = document.getElementById('mainCatFilter').value;
    const subVal = document.getElementById('subCatFilter').value;
    const statusVal = document.getElementById('statusFilter').value;
    const searchVal = document.getElementById('urlSearch').value.toLowerCase();

    // Thực hiện lọc dữ liệu
    const filtered = globalDetails.filter(item => {
        const mMain = !mainVal || item.DanhMucChinh === mainVal;
        const mSub = !subVal || item.DanhMucCon === subVal;
        const mStatus = !statusVal || getNormalizedStatus(item.TrangThai) === statusVal;
        const mSearch = !searchVal || (item.URL && String(item.URL).toLowerCase().includes(searchVal));
        return mMain && mSub && mStatus && mSearch;
    });

    // Gom nhóm dữ liệu sau khi lọc
    const grouped = {};
    filtered.forEach(item => {
        const key = `${item.DanhMucChinh || 'Khác'}___${item.DanhMucCon || 'Chung'}`;
        if(!grouped[key]) grouped[key] = { main: item.DanhMucChinh || 'Khác', sub: item.DanhMucCon || 'Chung', urls: [], latest: null };
        grouped[key].urls.push(item);
        const d = parseDate(item.NgayCapNhat);
        if (d && (!grouped[key].latest || d > grouped[key].latest)) grouped[key].latest = d;
    });

    tbody.innerHTML = filtered.length === 0 ? '<tr><td colspan="6" class="text-center py-10 text-gray-400 font-bold">Không tìm thấy dữ liệu phù hợp với yêu cầu lọc.</td></tr>' : '';

    Object.keys(grouped).forEach((key, index) => {
        const g = grouped[key];
        const rowId = 'cat-row-' + index;
        
        // ĐÃ FIX: Ép định dạng ngày tháng chuẩn DD/MM/YYYY thay vì dùng toLocaleDateString
        let latestStr = 'N/A';
        if (g.latest) {
            const day = g.latest.getDate().toString().padStart(2, '0');
            const month = (g.latest.getMonth() + 1).toString().padStart(2, '0');
            const year = g.latest.getFullYear();
            latestStr = `${day}/${month}/${year}`;
        }

        const percent = ((g.urls.length / globalDetails.length) * 100).toFixed(1);

        let html = `
            <tr class="border-b border-gray-100 hover:bg-orange-50 cursor-pointer transition-colors" onclick="toggleAccordion('${rowId}')">
                <td class="px-4 py-4 font-bold text-gray-800 text-sm"><i class="fas fa-folder text-orange-400 mr-2"></i>${g.main}</td>
                <td class="px-4 py-4 text-gray-500 font-bold text-xs">${g.sub}</td>
                <td class="px-4 py-4 text-center font-black text-orange-600">${g.urls.length}</td>
                <td class="px-4 py-4 text-center text-gray-400 font-bold text-xs">${percent}%</td>
                <td class="px-4 py-4 text-center text-gray-500 font-bold text-xs">${latestStr}</td>
                <td class="px-4 py-4 text-center">
                    <button class="bg-orange-500 text-white px-3 py-1 rounded text-[10px] font-bold uppercase flex items-center gap-2 mx-auto">
                        Chi tiết <i class="fas fa-chevron-right transition-transform" id="icon-${rowId}"></i>
                    </button>
                </td>
            </tr>
            <tr id="${rowId}" class="hidden bg-gray-50/30 border-b-2 border-orange-100">
                <td colspan="6" class="p-4">
                    <div class="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                        <table class="w-full text-left">
                            <thead class="bg-gray-50 font-bold text-[10px] text-gray-400 uppercase tracking-widest sticky top-0">
                                <tr><th class="p-3">STT</th><th class="p-3">URL Chi Tiết</th><th class="p-3 text-center">Cập nhật</th><th class="p-3 text-center">Trạng thái</th><th class="p-3 text-center">Kỹ thuật</th></tr>
                            </thead>
                            <tbody>
                                ${g.urls.map((u, i) => {
                                    const n = getNormalizedStatus(u.TrangThai);
                                    const badge = n === 'fresh' ? 'bg-green-100 text-green-700' : n === 'recent' ? 'bg-blue-100 text-blue-700' : n === 'stale' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                                    const techBadge = u.LoiKyThuat && u.LoiKyThuat !== "Sạch lỗi" ? 'text-red-500' : 'text-green-500';
                                    return `
                                        <tr class="border-b border-gray-50">
                                            <td class="p-3 text-xs font-bold text-gray-300">${i+1}</td>
                                            <td class="p-3"><a href="${u.URL}" target="_blank" class="text-blue-500 text-[11px] break-all hover:underline">${u.URL}</a></td>
                                            <td class="p-3 text-center text-[10px] font-bold text-gray-500">${formatDisplayDate(u.NgayCapNhat)}</td>
                                            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${badge}">${u.TrangThai}</span></td>
                                            <td class="p-3 text-center ${techBadge} text-xs font-bold">${u.LoiKyThuat || 'Sạch lỗi'}</td>
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
