// ĐIỀN LINK GOOGLE APPS SCRIPT CỦA BẠN VÀO ĐÂY
const API_URL = "https://api-hungphatsaigon.hoangtuanvpro.workers.dev/";

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN');
let globalDetails = [];
let charts = {};

// 1. HÀM CHUYỂN ĐỔI M/D/YYYY -> DD/MM/YYYY (Để hiển thị đẹp ra bảng)
function formatDisplayDate(dateStr) {
    if (!dateStr) return 'N/A';
    const parts = String(dateStr).trim().split('/');
    if (parts.length === 3) {
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');   
        const year = parts[2];
        return `${day}/${month}/${year}`;
    }
    return dateStr;
}

// 2. HÀM XỬ LÝ NGÀY THÁNG ĐỂ HỆ THỐNG TÍNH TOÁN
function parseDate(val) {
    if (!val) return null;
    const str = String(val).trim();
    if (str.includes('/')) {
        const parts = str.split('/');
        if (parts.length === 3) {
            return new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
        }
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

// 3. HÀM CHUẨN HÓA TRẠNG THÁI (Ép kiểu String an toàn)
function getNormalizedStatus(viStatus) {
    if (!viStatus) return 'outdated';
    const s = String(viStatus).toLowerCase();
    if (s.includes('mới')) return 'fresh';
    if (s.includes('gần đây')) return 'recent';
    if (s.includes('cập nhật') || s.includes('xem xét')) return 'stale';
    if (s.includes('lỗi thời')) return 'outdated';
    return 'outdated';
}

async function loadData() {
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data || !data.tongQuan) {
            throw new Error("Dữ liệu API trả về không đúng cấu trúc (thiếu block 'tongQuan').");
        }

        const tq = data.tongQuan;
        globalDetails = Array.isArray(data.chiTiet) ? data.chiTiet : []; 

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

        if (globalDetails.length > 0) {
            renderAllCharts(total, fresh, outdated);
            renderTop10Priority();
            renderCategoryAccordion();
        } else {
            throw new Error("Mảng 'chiTiet' đang rỗng, không có dữ liệu để vẽ bảng.");
        }

    } catch (error) {
        console.error('Lỗi hệ thống chi tiết:', error);
        const errorMsg = `<tr class="bg-red-50"><td colspan="6" class="text-center py-8 text-red-600 font-bold border-red-200 border"><i class="fas fa-exclamation-triangle text-2xl mb-2 block"></i>HỆ THỐNG GẶP LỖI:<br><span class="text-sm font-normal">${error.message}</span><br><span class="text-xs text-gray-500 mt-2 block">Vui lòng nhấn F12 -> Mở tab Console để xem chi tiết lỗi.</span></td></tr>`;
        
        const accordionBody = document.getElementById('categoryAccordionBody');
        if(accordionBody) accordionBody.innerHTML = errorMsg;
        
        const priorityTbody = document.getElementById('priorityUrlsTable');
        if(priorityTbody) priorityTbody.innerHTML = errorMsg.replace('colspan="6"', 'colspan="4"');
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
        tbody.innerHTML = '<tr><td colspan="4"
