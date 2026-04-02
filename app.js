const API_URL = "https://api-hungphatsaigon.hoangtuanvpro.workers.dev/";

document.getElementById('currentDate').textContent = new Date().toLocaleDateString('vi-VN');
let globalDetails = [];
let rankTrackingData = [];

// ... (Giữ nguyên các hàm parseDate, getNormalizedStatus, formatDisplayDate) ...

async function loadData() {
    const tbody = document.getElementById('categoryAccordionBody');
    tbody.innerHTML = '<tr><td colspan="6" class="p-10 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i> Đang tải dữ liệu GSC và SEO...</td></tr>';
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        globalDetails = data.chiTiet || [];
        rankTrackingData = data.rankTracking || []; // Lấy dữ liệu Rank Tracking
        
        // ... Cập nhật KPI như cũ ...

        renderRankTracking(); // Gọi hàm vẽ bảng xếp hạng từ khóa
        renderCategoryAccordion();
    } catch (e) { console.error(e); }
}

/**
 * TÍNH NĂNG MỚI: RENDER BẢNG THEO DÕI TỪ KHÓA
 */
function renderRankTracking() {
    // Tìm một vị trí để chèn bảng từ khóa (Ví dụ: Chèn vào đầu khu vực danh mục)
    let container = document.getElementById('rankTrackingContainer');
    if (!container) {
        const wrapper = document.getElementById('categoryAccordionBody').closest('.bg-white');
        container = document.createElement('div');
        container.id = 'rankTrackingContainer';
        container.className = 'mb-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden';
        wrapper.parentNode.insertBefore(container, wrapper);
    }

    if (rankTrackingData.length === 0) return;

    // Sắp xếp từ khóa theo vị trí (Top 1 lên đầu)
    rankTrackingData.sort((a, b) => (parseFloat(a.Position) || 100) - (parseFloat(b.Position) || 100));

    let rows = rankTrackingData.map((kw, i) => {
        const pos = parseFloat(kw.Position).toFixed(1);
        let posBadge = pos <= 3 ? 'bg-green-100 text-green-700' : (pos <= 10 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600');
        return `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-3 text-sm font-bold text-gray-800">${kw.Keyword}</td>
                <td class="p-3 text-center text-blue-600 font-bold">${parseInt(kw.Clicks).toLocaleString()}</td>
                <td class="p-3 text-center text-gray-600">${parseInt(kw.Impressions).toLocaleString()}</td>
                <td class="p-3 text-center font-bold text-xs"><span class="px-2 py-1 rounded ${posBadge}">Top ${pos}</span></td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white flex justify-between items-center">
            <h2 class="text-lg font-black text-gray-800"><i class="fas fa-trophy text-yellow-500 mr-2"></i>Theo dõi từ khóa chủ lực (GSC)</h2>
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

/**
 * NÂNG CẤP BẢNG ACCORDION: THÊM DỮ LIỆU GSC VÀO SEO MEDICAL
 */
function renderCategoryAccordion() {
    // ... (Phần logic filter và group giữ nguyên) ...

                                // Thay thế phần SEO MEDICAL AUDIT GRID bằng đoạn này:
                                return `
                                    <tr class="border-b border-gray-50 hover:bg-blue-50/30 transition-colors">
                                        <td class="p-3 text-xs font-bold text-gray-300">${i+1}</td>
                                        <td class="p-3">
                                            <a href="${u.URL}" target="_blank" class="text-blue-500 text-[11px] font-bold break-all hover:underline leading-relaxed">${u.URL}</a>
                                            
                                            <div class="grid grid-cols-3 gap-3 mt-3 p-3 bg-gray-50 rounded border border-gray-100 shadow-sm">
                                                <div class="col-span-2 grid grid-cols-2 gap-3 border-r border-gray-200 pr-3">
                                                    <div class="text-[10px]">
                                                        <div class="text-gray-400 uppercase font-bold mb-1">Tiêu đề</div>
                                                        <div class="${titleClass} leading-tight">${u.TitleTech}</div>
                                                    </div>
                                                    <div class="text-[10px]">
                                                        <div class="text-gray-400 uppercase font-bold mb-1">Thẻ H1</div>
                                                        <div class="${u.H1Tech === 'N/A' ? 'text-red-500' : 'text-gray-700'} leading-tight font-medium">${u.H1Tech}</div>
                                                    </div>
                                                    <div class="text-[10px]">
                                                        <div class="text-gray-400 uppercase font-bold mb-1">Nội dung</div>
                                                        <div class="${wordCountClass}"><i class="fas fa-file-alt mr-1"></i>${parseInt(u.WordCount).toLocaleString()} chữ</div>
                                                    </div>
                                                    <div class="text-[10px]">
                                                        <div class="text-gray-400 uppercase font-bold mb-1">Internal / Index</div>
                                                        <div class="text-blue-600 font-bold">${u.Inlinks} Links | <span class="${isIndexable}">${u.Indexability}</span></div>
                                                    </div>
                                                </div>
                                                <div class="text-[10px] pl-1">
                                                    <div class="text-purple-600 uppercase font-black mb-2"><i class="fab fa-google mr-1"></i>Search Console</div>
                                                    <div class="flex justify-between mb-1"><span class="text-gray-500">Vị trí:</span> <b class="text-green-600">Top ${parseFloat(u.GSCPos).toFixed(1)}</b></div>
                                                    <div class="flex justify-between mb-1"><span class="text-gray-500">Clicks:</span> <b>${parseInt(u.GSCClicks).toLocaleString()}</b></div>
                                                    <div class="flex justify-between mb-1"><span class="text-gray-500">Hiển thị:</span> <b>${parseInt(u.GSCImp).toLocaleString()}</b></div>
                                                    <div class="flex justify-between"><span class="text-gray-500">CTR:</span> <b>${u.GSCCTR}</b></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${badge}">${u.TrangThai}</span></td>
                                        <td class="p-3 text-center"><span class="text-xs font-black text-gray-700">${cur.toLocaleString()}</span></td>
                                        <td class="p-3 text-center text-[10px] transition-all hover:scale-110">${trendHtml}</td>
                                    </tr>`;
// ... (Phần còn lại giữ nguyên) ...
