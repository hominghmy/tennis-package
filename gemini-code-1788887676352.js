// 會所課表資料庫（1 = 星期一, 2 = 星期二, ..., 6 = 星期六, 0 = 星期日）
const WEEKLY_SCHEDULE = {
    1: [ // 星期一
        { class: "Red Ball", time: "15:30-16:30" },
        { class: "Orange Ball", time: "16:30-17:30" },
        { class: "Green Ball", time: "17:30-19:00" }
    ],
    2: [ // 星期二
        { class: "Red Ball", time: "16:30-17:30" },
        { class: "Orange Ball", time: "17:30-18:30" },
        { class: "Green Ball", time: "18:30-20:00" }
    ],
    3: [ // 星期三
        { class: "Orange Ball", time: "16:30-17:30" },
        { class: "Yellow Ball", time: "17:30-19:30" }
    ],
    4: [ // 星期四
        { class: "Red Ball", time: "16:30-17:30" },
        { class: "Orange Ball", time: "17:30-18:30" },
        { class: "Green Ball", time: "18:30-20:00" }
    ],
    5: [ // 星期五
        { class: "Orange Ball", time: "16:30-17:30" },
        { class: "Yellow Ball", time: "17:30-19:30" }
    ],
    6: [ // 星期六
        { class: "Red Ball", time: "09:00-10:00" },
        { class: "Orange Ball", time: "09:30-10:30" },
        { class: "Red Ball", time: "10:00-11:00" },
        { class: "Green Ball", time: "10:30-12:00" },
        { class: "P&P", time: "15:00-17:00" }
    ],
    0: [ // 星期日
        { class: "P&P", time: "10:00-12:00" }
    ]
};

let students = JSON.parse(localStorage.getItem('tennis_club_students')) || [];

// 初始化預設日期為今天
document.getElementById('schedule-date').value = new Date().toISOString().split('T')[0];

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');

    if (tabId === 'tab-schedule') {
        renderSchedule();
    }
}

// 新增學員
document.getElementById('student-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const payment = document.getElementById('payment').value;
    const totalPackage = parseInt(document.getElementById('total-package').value);

    const newStudent = {
        id: Date.now(),
        name,
        phone,
        payment,
        totalPackage,
        bookings: [] // 存放: { id, date, className, time }
    };

    students.push(newStudent);
    saveAndRender();
    this.reset();
});

function saveAndRender() {
    localStorage.setItem('tennis_club_students', JSON.stringify(students));
    renderStudents();
}

// 渲染學員列表
function renderStudents() {
    const list = document.getElementById('student-list');
    const search = document.getElementById('search-student').value.toLowerCase();
    list.innerHTML = '';

    const filtered = students.filter(s => s.name.toLowerCase().includes(search));

    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:1rem;">尚無學員資料</p>';
        return;
    }

    filtered.forEach(s => {
        const remaining = s.totalPackage - s.bookings.length;
        const card = document.createElement('div');
        card.className = 'student-card';

        let bookingsHTML = s.bookings.map(b => `
            <div class="date-chip">
                <span>📅 ${b.date} <br><strong>[${b.className}]</strong> ${b.time}</span>
                <div style="display:flex; gap:0.2rem;">
                    <button class="btn warning sm" onclick="openRebookModal(${s.id}, ${b.id})">改期</button>
                    <button class="btn danger sm" onclick="cancelBooking(${s.id}, ${b.id})">取消</button>
                </div>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="student-header">
                <div>
                    <strong>${s.name}</strong> (${s.phone || '無電話'})
                    <span class="badge ${s.payment === '已付款' ? 'paid' : 'unpaid'}">${s.payment}</span>
                </div>
                <button class="btn danger sm" onclick="deleteStudent(${s.id})">刪除學員</button>
            </div>
            <p>已預約：<strong>${s.bookings.length}</strong> 堂 | 剩餘堂數：<strong>${remaining}</strong> / ${s.totalPackage} 堂</p>
            <div style="margin-top: 0.5rem;">
                ${remaining > 0 
                    ? `<button class="btn success sm" onclick="openBatchBookingModal(${s.id})">➕ 預約/排課 (可排 ${remaining} 堂)</button>` 
                    : '<span style="color:#dc2626; font-size:0.85rem; font-weight:bold;">⚠️ 套票堂數已全數預約完畢</span>'}
            </div>
            <div class="dates-grid">
                ${bookingsHTML || '<p style="font-size:0.85rem; color:#94a3b8; grid-column: 1/-1;">尚無預約紀錄</p>'}
            </div>
        `;
        list.appendChild(card);
    });
}

// 當預約彈窗中的日期改變時，自動更新時段選單
function onBookingDateChange(index) {
    const dateInput = document.getElementById(`book-date-${index}`);
    const classSelect = document.getElementById(`book-class-${index}`);
    
    if (!dateInput.value) {
        classSelect.innerHTML = '<option value="">請先選擇日期</option>';
        return;
    }

    const dayOfWeek = new Date(dateInput.value).getDay(); // 0~6
    const availableClasses = WEEKLY_SCHEDULE[dayOfWeek] || [];

    if (availableClasses.length === 0) {
        classSelect.innerHTML = '<option value="">當天無固定課程</option>';
        return;
    }

    classSelect.innerHTML = availableClasses.map(c => 
        `<option value="${c.class}|${c.time}">[${c.class}] ${c.time}</option>`
    ).join('');
}

// 開啟批次預約 Modal
function openBatchBookingModal(studentId) {
    const student = students.find(s => s.id === studentId);
    const remaining = student.totalPackage - student.bookings.length;

    let inputsHTML = '';
    for (let i = 0; i < remaining; i++) {
        inputsHTML += `
            <div class="booking-row">
                <label style="font-size:0.8rem; font-weight:bold; color:#475569;">第 ${i + 1} 堂：</label>
                <div style="display:flex; gap:0.5rem; margin-top:0.3rem;">
                    <input type="date" id="book-date-${i}" style="flex:1;" onchange="onBookingDateChange(${i})">
                    <select id="book-class-${i}" style="flex:1.5;">
                        <option value="">請先選擇日期</option>
                    </select>
                </div>
            </div>
        `;
    }

    document.getElementById('modal-title').textContent = `為 ${student.name} 預約上課（可排 ${remaining} 堂）`;
    document.getElementById('modal-body').innerHTML = `
        <form onsubmit="saveBatchBookings(event, ${studentId}, ${remaining})">
            ${inputsHTML}
            <button type="submit" class="btn primary" style="width:100%; margin-top:0.5rem; padding:0.7rem;">確認儲存所有預約</button>
        </form>
    `;
    document.getElementById('booking-modal').style.display = 'flex';
}

// 儲存批次預約
function saveBatchBookings(e, studentId, count) {
    e.preventDefault();
    const student = students.find(s => s.id === studentId);

    for (let i = 0; i < count; i++) {
        const date = document.getElementById(`book-date-${i}`).value;
        const classValue = document.getElementById(`book-class-${i}`).value;

        if (date && classValue) {
            const [className, time] = classValue.split('|');
            student.bookings.push({
                id: Date.now() + Math.random(),
                date,
                className,
                time
            });
        }
    }

    student.bookings.sort((a, b) => new Date(a.date) - new Date(b.date));
    saveAndRender();
    closeModal();
}

// 取消預約
function cancelBooking(studentId, bookingId) {
    if (confirm('確定要取消這個預約時間嗎？額度會自動退回。')) {
        const student = students.find(s => s.id === studentId);
        student.bookings = student.bookings.filter(b => b.id !== bookingId);
        saveAndRender();
    }
}

// 開啟改期 Modal
function openRebookModal(studentId, bookingId) {
    const student = students.find(s => s.id === studentId);
    const booking = student.bookings.find(b => b.id === bookingId);

    document.getElementById('modal-title').textContent = `更改 ${student.name} 的預約`;
    document.getElementById('modal-body').innerHTML = `
        <form onsubmit="saveRebook(event, ${studentId}, ${bookingId})">
            <p style="font-size:0.9rem; margin-bottom:1rem; color:#64748b;">
                原時間：${booking.date} [${booking.className}] ${booking.time}
            </p>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>選擇新日期：</label>
                <input type="date" id="rebook-date" value="${booking.date}" required onchange="onRebookDateChange()">
            </div>
            <div class="form-group" style="margin-bottom:1rem;">
                <label>選擇新班別與時段：</label>
                <select id="rebook-class" required></select>
            </div>
            <button type="submit" class="btn warning" style="width:100%; padding:0.7rem;">確認改期</button>
        </form>
    `;
    document.getElementById('booking-modal').style.display = 'flex';
    onRebookDateChange();
}

function onRebookDateChange() {
    const dateVal = document.getElementById('rebook-date').value;
    const classSelect = document.getElementById('rebook-class');
    
    if (!dateVal) return;

    const dayOfWeek = new Date(dateVal).getDay();
    const availableClasses = WEEKLY_SCHEDULE[dayOfWeek] || [];

    if (availableClasses.length === 0) {
        classSelect.innerHTML = '<option value="">當天無固定課程</option>';
        return;
    }

    classSelect.innerHTML = availableClasses.map(c => 
        `<option value="${c.class}|${c.time}">[${c.class}] ${c.time}</option>`
    ).join('');
}

function saveRebook(e, studentId, bookingId) {
    e.preventDefault();
    const student = students.find(s => s.id === studentId);
    const booking = student.bookings.find(b => b.id === bookingId);

    const date = document.getElementById('rebook-date').value;
    const classValue = document.getElementById('rebook-class').value;

    if (date && classValue) {
        const [className, time] = classValue.split('|');
        booking.date = date;
        booking.className = className;
        booking.time = time;

        student.bookings.sort((a, b) => new Date(a.date) - new Date(b.date));
        saveAndRender();
        closeModal();
    }
}

// 渲染「每日課表點名板」
function renderSchedule() {
    const selectedDate = document.getElementById('schedule-date').value;
    const container = document.getElementById('schedule-summary');
    container.innerHTML = '';

    if (!selectedDate) return;

    const dayOfWeek = new Date(selectedDate).getDay();
    const dayClasses = WEEKLY_SCHEDULE[dayOfWeek] || [];

    const weekNames = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const dayLabel = weekNames[dayOfWeek];

    if (dayClasses.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#94a3b8; padding:1.5rem;">${selectedDate} (${dayLabel}) 當天無排定課表。</p>`;
        return;
    }

    // 依據當天課表依次列出
    dayClasses.forEach(item => {
        const matchedStudents = [];

        // 搜尋已付款且有預約這個班級時段的學生
        students.forEach(s => {
            if (s.payment === '已付款') {
                const hasBooking = s.bookings.some(b => 
                    b.date === selectedDate && 
                    b.className === item.class && 
                    b.time === item.time
                );
                if (hasBooking) matchedStudents.push(s.name);
            }
        });

        const slotCard = document.createElement('div');
        slotCard.className = 'class-slot-card';
        slotCard.innerHTML = `
            <div class="class-slot-header">
                <span>🎾 ${item.class} (${item.time})</span>
                <span>已報名人數：<strong style="color:#2563eb;">${matchedStudents.length}</strong> 人</span>
            </div>
            <div class="student-tag-list">
                ${matchedStudents.length > 0 
                    ? matchedStudents.map(name => `<span class="student-tag">👤 ${name}</span>`).join('') 
                    : '<span style="color:#94a3b8; font-size:0.85rem;">目前尚無已付款學員預約</span>'}
            </div>
        `;
        container.appendChild(slotCard);
    });
}

function deleteStudent(id) {
    if (confirm('確定要刪除該學員所有資料嗎？')) {
        students = students.filter(s => s.id !== id);
        saveAndRender();
    }
}

function closeModal() {
    document.getElementById('booking-modal').style.display = 'none';
}

// 初始化
saveAndRender();