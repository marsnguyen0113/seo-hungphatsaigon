// ĐIỀN LINK GOOGLE APPS SCRIPT CỦA BẠN VÀO ĐÂY
const API_URL = "https://api-hungphatsaigon.hoangtuanvpro.workers.dev/";

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN');
let globalDetails = [];
let charts = {};

// 1. HÀM CHUẨN HÓA TRẠNG THÁI (Ép kiểu String an toàn)
function getNormalizedStatus(viStatus) {
    if (!viStatus) return 'outdated';
    const s = String(viStatus).toLowerCase(); // Đảm bảo luôn là chuỗi
    if (s.includes('mới')) return 'fresh';
    if (s.includes('gần đây')) return 'recent';
    if (s.includes('cập nhật') || s.includes('xem xét')) return 'stale';
    if (s.includes('lỗi thời')) return 'outdated';
    return 'outdated';
}

// 2. HÀM XỬ LÝ NGÀY THÁNG (Ép kiểu String an toàn)
function parseDate(val) {
    if (!val) return null;
    const str = String(val).trim(); // Đảm bảo luôn là chuỗi
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

async function loadData() {
    try {
        const response = await fetch(API_URL);
        
        // Bắt lỗi HTTP (CORS, 404, 500...)
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Bắt lỗi JSON sai cấu trúc
        if (!data || !data.tongQuan) {
            throw new Error("Dữ liệu API trả về không đúng cấu trúc (thiếu block 'tongQuan').");
        }

        const tq = data.tongQuan;
        // Đảm bảo chiTiet luôn là một mảng (Array) để hàm .forEach không bị crash
        globalDetails = Array.isArray(data.chiTiet) ? data.chiTiet : []; 

        // Render Thẻ Thống Kê Tổng Quan
        const total = parseInt(tq.tongUrl) || 0;
        const fresh = parseInt(tq.baiMoi) || 0;
        const outdated = parseInt(tq.canCapNhat) || 0;
        
        document.getElementById('totalUrls').textContent = total;
        document.getElementById('totalCategories').textContent = tq.danhMuc || '0';
        document.getElementById('freshContent').textContent = fresh;
        document.getElementById('outdatedContent').textContent = outdated + (parseInt(tq.loiThoi) || 0);
        document.getElementById('recommendUpdate').textContent = parseInt(tq.loiThoi) || 0;

        if(total > 0) {
            document.getElementById('freshPercent').innerHTML = `<i class="fas fa-percentage mr-1"></i> ${((fresh / total) * 100).toFixed(1)}% tổng nội dung`;
        }

        // Kiểm tra xem có dữ liệu chi tiết không trước khi vẽ biểu đồ
        if (globalDetails.length > 0) {
            renderAllCharts(total, fresh, outdated);
            renderTop10Priority();
            renderCategoryAccordion();
        } else {
            throw new Error("Mảng 'chiTiet' đang rỗng, không có dữ liệu để vẽ bảng.");
        }

    } catch (error) {
        console.error('Lỗi hệ thống chi tiết:', error);
        
        // Hiển thị lỗi thẳng ra màn hình thay vì treo Loading
        const errorMsg = `<tr class="bg-red-50"><td colspan="4" class="text-center py-8 text-red-600 font-bold border-red-200 border"><i class="fas fa-exclamation-triangle text-2xl mb-2 block"></i>HỆ THỐNG GẶP LỖI:<br><span class="text-sm font-normal">${error.message}</span><br><span class="text-xs text-gray-500 mt-2 block">Vui lòng nhấn F12 -> Mở tab Console để xem chi tiết lỗi.</span></td></tr>`;
        
        document.getElementById('categoryAccordionBody').innerHTML = errorMsg;
        document.getElementById('priorityUrlsTable').innerHTML = errorMsg;
    }
}

// HÀM VẼ TẤT CẢ BIỂU ĐỒ
function renderAllCharts(total, fresh, outdated) {
    const catCounts = {};
    const monthCounts = {};
    const statusCounts = { fresh: 0, recent: 0, stale: 0, outdated: 0 };
    
    for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        monthCounts[d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' })] = 0;
    }

    globalDetails.forEach(item => {
        const cat = item.DanhMucChinh || 'Khác';
        catCounts[cat] = (catCounts[cat] || 0) + 1;

        const normStatus = getNormalizedStatus(item.TrangThai);
        statusCounts[normStatus]++;

        const d = parseDate(item.NgayCapNhat);
        if (d) {
            const mKey = d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
            if(monthCounts[mKey] !== undefined) monthCounts[mKey]++;
        }
    });

    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

    const top5Cats = sortedCats.slice(0, 5);
    const doughnutColors = ['#F97316', '#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
    document.getElementById('topicLegend').innerHTML = top5Cats.map((c, i) => `
        <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background-color: ${doughnutColors[i]}"></span><span class="text-gray-700">${c[0]} (${c[1]})</span></div>
    `).join('');
    
    charts.topic = new Chart(document.getElementById('topicChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: top5Cats.map(c => c[0]), datasets: [{ data: top5Cats.map(c => c[1]), backgroundColor: doughnutColors, borderWidth: 2 }] },
        options: { cutout: '60%', plugins: { legend: { display: false } } }
    });

    charts.status = new Chart(document.getElementById('statusChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Mới (<30 ngày)', 'Gần đây (30-90)', 'Cần xem xét (90-365)', 'Lỗi thời (>365)'],
            datasets: [{ data: [statusCounts.fresh, statusCounts.recent, statusCounts.stale, statusCounts.outdated], backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'], borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    charts.timeline = new Chart(document.getElementById('timelineChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: Object.keys(monthCounts),
            datasets: [{ label: 'Số bài cập nhật', data: Object.values(monthCounts), borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    const top8Horizontal = sortedCats.slice(0, 8);
    charts.brand = new Chart(document.getElementById('categoryBarChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: top8Horizontal.map(c => c[0]),
            datasets: [{ data: top8Horizontal.map(c => c[1]), backgroundColor: '#8B5CF6', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    const score = total > 0 ? Math.round(100 - ((statusCounts.outdated / total) * 100)) : 0;
    document.getElementById('healthScoreValue').textContent = score;
    document.getElementById('healthFresh').textContent = (statusCounts.fresh + statusCounts.recent) + ' bài';
    document.getElementById('healthStale').textContent = statusCounts.stale + ' bài';
    document.getElementById('healthOutdated').textContent = statusCounts.outdated + ' bài';

    charts.health = new Chart(document.getElementById('healthScore').getContext('2d'), {
        type: 'doughnut',
        data: { datasets: [{ data: [score, 100 - score], backgroundColor: [score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444', '#E5E7EB'], borderWidth: 0 }] },
        options: { cutout: '75%', plugins: { tooltip: { enabled: false } } }
    });
}

// HÀM RENDER TOP 10 ƯU TIÊN
function renderTop10Priority() {
    let priorityList = globalDetails.filter(item => {
        const s = getNormalizedStatus(item.TrangThai);
        return s === 'outdated' || s === 'stale';
    });

    priorityList.sort((a, b) => {
        const dateA = parseDate(a.NgayCapNhat);
        const dateB = parseDate(b.NgayCapNhat);
        if(!dateA) return -1;
        if(!dateB) return 1;
        return dateA - dateB;
    });

    const top10 = priorityList.slice(0, 10);
    const tbody = document.getElementById('priorityUrlsTable');
    
    if(top10.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-green-600 font-medium">Tuyệt vời! Không có URL nào quá cũ cần ưu tiên.</td></tr>';
        return;
    }

    tbody.innerHTML = top10.map((u, i) => {
        const normStatus = getNormalizedStatus(u.TrangThai);
        let statusBadge = normStatus === 'outdated' 
            ? '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">Lỗi thời cực kỳ</span>' 
            : '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-bold">Cần xem xét</span>';
        
        if(!u.NgayCapNhat) statusBadge = '<span class="px-2 py-1 bg-gray-200 text-gray-800 font-bold rounded text-xs">Không rõ ngày</span>';

        const shortUrl = u.URL ? String(u.URL).replace('https://hungphatsaigon.vn/', '') : 'N/A';
        return `
            <tr class="border-b border-gray-100 hover:bg-yellow-50 transition-colors">
                <td class="px-3 py-2 text-gray-500 font-medium">${i + 1}</td>
                <td class="px-3 py-2">
                    <a href="${u.URL || '#'}" target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline text-xs break-all" title="${u.TieuDe || ''}">${shortUrl}</a>
                </td>
                <td class="px-3 py-2 text-center text-gray-600 text-xs font-medium">${u.NgayCapNhat || 'N/A'}</td>
                <td class="px-3 py-2 text-center">${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

// HÀM RENDER BẢNG ACCORDION THEO DANH MỤC
function renderCategoryAccordion() {
    const tbody = document.getElementById('categoryAccordionBody');
    const grouped = {};
    
    globalDetails.forEach(item => {
        const cat = item.DanhMucChinh || 'Khác';
        if(!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
    });

    const totalGlobal = globalDetails.length;
    tbody.innerHTML = '';

    Object.keys(grouped).forEach((cat, index) => {
        const urls = grouped[cat];
        const percent = totalGlobal > 0 ? ((urls.length / totalGlobal) * 100).toFixed(1) : 0;
        const rowId = 'cat-row-' + index;

        let accordionHtml = `
            <tr class="border-b border-gray-200 hover:bg-orange-50 cursor-pointer transition-colors" onclick="toggleAccordion('${rowId}')">
                <td class="px-4 py-4 font-bold text-gray-800"><i class="fas fa-folder-open text-orange-400 mr-2"></i>${cat}</td>
                <td class="px-4 py-4 text-center font-bold text-orange-600">${urls.length}</td>
                <td class="px-4 py-4 text-center text-gray-600 font-medium">${percent}%</td>
                <td class="px-4 py-4 text-center">
                    <button class="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 focus:outline-none">
                        <i class="fas fa-chevron-right transition-transform duration-200" id="icon-${rowId}"></i> Xem chi tiết
                    </button>
                </td>
            </tr>
        `;

        const urlRows = urls.map((u, i) => {
            const normStatus = getNormalizedStatus(u.TrangThai);
            let stClass = "bg-gray-100 text-gray-600";
            let stText = u.TrangThai || 'Khác';
            
            if(normStatus === 'fresh') { stClass = 'bg-green-100 text-green-700'; }
            else if(normStatus === 'recent') { stClass = 'bg-blue-100 text-blue-700'; }
            else if(normStatus === 'stale') { stClass = 'bg-yellow-100 text-yellow-700'; }
            else if(normStatus === 'outdated') { stClass = 'bg-red-100 text-red-700'; }

            const subCatTag = u.DanhMucCon ? `<span class="inline-block mt-1 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">${u.DanhMucCon}</span>` : '';

            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-3 py-2 text-xs text-gray-500">${i+1}</td>
                    <td class="px-3 py-2">
                        <a href="${u.URL || '#'}" target="_blank" class="text-blue-600 hover:text-blue-800 hover:underline text-xs break-all" title="${u.TieuDe || ''}">${u.URL || 'N/A'}</a>
                        <br>${subCatTag}
                    </td>
                    <td class="px-3 py-2 text-center text-xs text-gray-600 font-medium">${u.NgayCapNhat || 'N/A'}</td>
                    <td class="px-3 py-2 text-center"><span class="px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${stClass}">${stText}</span></td>
                </tr>
            `;
        }).join('');

        accordionHtml += `
            <tr id="${rowId}" class="hidden border-b-4 border-orange-500 bg-gray-50/50">
                <td colspan="4" class="p-0">
                    <div class="px-6 py-4">
                        <div class="max-h-80 overflow-y-auto rounded shadow-inner border border-gray-200 bg-white">
                            <table class="w-full text-sm">
                                <thead class="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th class="px-3 py-2 text-left text-gray-600 font-semibold w-10">#</th>
                                        <th class="px-3 py-2 text-left text-gray-600 font-semibold">URL Chi Tiết & Danh Mục Con</th>
                                        <th class="px-3 py-2 text-center text-gray-600 font-semibold w-28">Cập Nhật</th>
                                        <th class="px-3 py-2 text-center text-gray-600 font-semibold w-28">Trạng Thái</th>
                                    </tr>
                                </thead>
                                <tbody>${urlRows}</tbody>
                            </table>
                        </div>
                    </div>
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', accordionHtml);
    });
}

function toggleAccordion(rowId) {
    const row = document.getElementById(rowId);
    const icon = document.getElementById('icon-' + rowId);
    
    if (row.classList.contains('hidden')) {
        row.classList.remove('hidden');
        icon.classList.add('rotate-90');
    } else {
        row.classList.add('hidden');
        icon.classList.remove('rotate-90');
    }
}

// Khởi động
loadData();
