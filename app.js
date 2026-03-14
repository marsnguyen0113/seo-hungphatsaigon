// ĐIỀN LINK GOOGLE APPS SCRIPT CỦA BẠN VÀO ĐÂY (Bước tiếp theo chúng ta sẽ giấu link này đi)
const API_URL = "https://api-hungphatsaigon.hoangtuanvpro.workers.dev/";

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN');
let globalDetails = [];
let charts = {};

async function loadData() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        
        const tq = data.tongQuan;
        globalDetails = data.chiTiet || [];

        // Render Thẻ Thống Kê
        const total = parseInt(tq.tongUrl) || 0;
        const fresh = parseInt(tq.baiMoi) || 0;
        const outdated = parseInt(tq.canCapNhat) || 0;
        
        document.getElementById('totalUrls').textContent = total;
        document.getElementById('totalCategories').textContent = tq.danhMuc || '0';
        document.getElementById('freshContent').textContent = fresh;
        document.getElementById('outdatedContent').textContent = outdated;
        document.getElementById('recommendUpdate').textContent = outdated;

        if(total > 0) {
            document.getElementById('freshPercent').innerHTML = `<i class="fas fa-percentage mr-1"></i> ${((fresh / total) * 100).toFixed(1)}% tổng nội dung`;
        }

        renderAllCharts(total, fresh, outdated);
        renderTop10Priority();
        renderCategoryAccordion();

    } catch (error) {
        console.error('Lỗi tải dữ liệu:', error);
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

        const status = (item.TrangThai || 'outdated').toLowerCase();
        if(statusCounts[status] !== undefined) statusCounts[status]++;

        if(item.NgayCapNhat) {
            let d = new Date(item.NgayCapNhat);
            if(isNaN(d.getTime())) {
                const parts = item.NgayCapNhat.split('/');
                if(parts.length === 3) d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
            }
            if(!isNaN(d.getTime())) {
                const mKey = d.toLocaleDateString('vi-VN', { month: '2-digit', year: 'numeric' });
                if(monthCounts[mKey] !== undefined) monthCounts[mKey]++;
            }
        }
    });

    const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

    // 1. Biểu đồ Tròn
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

    // 2. Biểu đồ Cột
    charts.status = new Chart(document.getElementById('statusChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Mới (<30 ngày)', 'Gần đây (30-90)', 'Cần xem xét (90-365)', 'Lỗi thời (>365)'],
            datasets: [{ data: [statusCounts.fresh, statusCounts.recent, statusCounts.stale, statusCounts.outdated], backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444'], borderRadius: 6 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // 3. Biểu đồ Dòng
    charts.timeline = new Chart(document.getElementById('timelineChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: Object.keys(monthCounts),
            datasets: [{ label: 'Số bài cập nhật', data: Object.values(monthCounts), borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });

    // 4. Biểu đồ Cột Ngang
    const top8Horizontal = sortedCats.slice(0, 8);
    charts.brand = new Chart(document.getElementById('categoryBarChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: top8Horizontal.map(c => c[0]),
            datasets: [{ data: top8Horizontal.map(c => c[1]), backgroundColor: '#8B5CF6', borderRadius: 4 }]
        },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // 5. Điểm Sức Khỏe
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
        const s = (item.TrangThai || '').toLowerCase();
        return s === 'outdated' || s === 'stale';
    });

    priorityList.sort((a, b) => {
        if(!a.NgayCapNhat) return -1;
        if(!b.NgayCapNhat) return 1;
        return new Date(a.NgayCapNhat) - new Date(b.NgayCapNhat);
    });

    const top10 = priorityList.slice(0, 10);
    const tbody = document.getElementById('priorityUrlsTable');
    
    if(top10.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-green-600">Tuyệt vời! Không có URL nào quá cũ cần ưu tiên.</td></tr>';
        return;
    }

    tbody.innerHTML = top10.map((u, i) => {
        let statusBadge = u.TrangThai === 'outdated' ? '<span class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs">Lỗi thời cực kỳ</span>' : '<span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">Cần xem xét</span>';
        if(!u.NgayCapNhat) statusBadge = '<span class="px-2 py-1 bg-red-200 text-red-800 font-bold rounded text-xs">Không rõ ngày</span>';

        const shortUrl = u.URL ? u.URL.replace('https://hungphatsaigon.vn/', '') : '';
        return `
            <tr class="border-b border-gray-100 hover:bg-yellow-50">
                <td class="px-3 py-2 text-gray-500">${i + 1}</td>
                <td class="px-3 py-2"><a href="${u.URL}" target="_blank" class="text-blue-600 hover:underline text-xs break-all">${shortUrl}</a></td>
                <td class="px-3 py-2 text-center text-gray-600 text-xs">${u.NgayCapNhat ? new Date(u.NgayCapNhat).toLocaleDateString('vi-VN') : 'N/A'}</td>
                <td class="px-3 py-2 text-center">${statusBadge}</td>
            </tr>
        `;
    }).join('');
}

// HÀM RENDER BẢNG GỘP NHÓM
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

        tbody.insertAdjacentHTML('beforeend', `
            <tr class="border-b border-gray-200 hover:bg-orange-50 cursor-pointer" onclick="toggleAccordion('${rowId}')">
                <td class="px-4 py-4 font-bold text-gray-800"><i class="fas fa-folder text-orange-400 mr-2"></i>${cat}</td>
                <td class="px-4 py-4 text-center font-bold text-orange-600">${urls.length}</td>
                <td class="px-4 py-4 text-center">${percent}%</td>
                <td class="px-4 py-4 text-center">
                    <button class="px-3 py-1 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 focus:outline-none">
                        <i class="fas fa-chevron-right rotate-icon" id="icon-${rowId}"></i> Xem chi tiết
                    </button>
                </td>
            </tr>
        `);

        const urlRows = urls.map((u, i) => {
            let stClass = "bg-gray-100 text-gray-600";
            let stText = u.TrangThai || 'Khác';
            if(stText === 'fresh') { stClass = 'bg-green-100 text-green-700'; stText = 'Mới'; }
            else if(stText === 'recent') { stClass = 'bg-blue-100 text-blue-700'; stText = 'Gần đây'; }
            else if(stText === 'stale') { stClass = 'bg-yellow-100 text-yellow-700'; stText = 'Xem xét'; }
            else if(stText === 'outdated') { stClass = 'bg-red-100 text-red-700'; stText = 'Lỗi thời'; }

            return `
                <tr class="border-b border-gray-100 hover:bg-gray-100">
                    <td class="px-3 py-2 text-xs text-gray-500">${i+1}</td>
                    <td class="px-3 py-2"><a href="${u.URL}" target="_blank" class="text-blue-500 hover:underline text-xs break-all">${u.URL}</a></td>
                    <td class="px-3 py-2 text-center text-xs text-gray-600">${u.NgayCapNhat || 'N/A'}</td>
                    <td class="px-3 py-2 text-center"><span class="px-2 py-1 rounded text-xs ${stClass}">${stText}</span></td>
                </tr>
            `;
        }).join('');

        tbody.insertAdjacentHTML('beforeend', `
            <tr id="${rowId}" class="expandable-content border-b-4 border-orange-500">
                <td colspan="4" class="p-0">
                    <div class="bg-gray-50 px-6 py-4">
                        <div class="max-h-80 overflow-y-auto rounded shadow-inner border border-gray-200">
                            <table class="w-full text-sm bg-white">
                                <thead class="bg-gray-100 sticky top-0">
                                    <tr><th class="px-3 py-2 text-left">#</th><th class="px-3 py-2 text-left">URL Chi Tiết</th><th class="px-3 py-2 text-center">Ngày Cập Nhật</th><th class="px-3 py-2 text-center">Trạng Thái</th></tr>
                                </thead>
                                <tbody>${urlRows}</tbody>
                            </table>
                        </div>
                    </div>
                </td>
            </tr>
        `);
    });
}

function toggleAccordion(rowId) {
    const row = document.getElementById(rowId);
    const icon = document.getElementById('icon-' + rowId);
    row.classList.toggle('expanded');
    icon.classList.toggle('rotated');
}

// Khởi động
loadData();
