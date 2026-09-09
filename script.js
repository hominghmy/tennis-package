// 預設訪問密碼
const ACCESS_PASSWORD = "coscourse";

// 檢查密碼邏輯
function verifyPassword(e) {
    if (e) e.preventDefault();
    const inputPass = document.getElementById('sys-password').value;
    const errorElem = document.getElementById('lock-error');

    if (inputPass === ACCESS_PASSWORD) {
        localStorage.setItem('tennis_app_authenticated', 'true');
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        if (errorElem) errorElem.style.display = 'none';
    } else {
        if (errorElem) errorElem.style.display = 'block';
    }
}

// 登出功能
function logoutSystem() {
    localStorage.removeItem('tennis_app_authenticated');
    location.reload();
}

// 初始化密碼檢查
(function checkAuth() {
    const isAuth = localStorage.getItem('tennis_app_authenticated');
    if (isAuth === 'true') {
        document.getElementById('lock-screen').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
    }
})();

// 正確的 Firebase 金鑰設定（已修正 API Key）
const firebaseConfig = {
  apiKey: "AIzaSyBoIgPFNER9DzzRSMXhX4DS9UF_pz9AP30",
  authDomain: "tennis-package.firebaseapp.com",
  databaseURL: "https://tennis-package-default-rtdb.firebaseio.com",
  projectId: "tennis-package",
  storageBucket: "tennis-package.firebasestorage.app",
  messagingSenderId: "897402153829",
  appId: "1:897402153829:web:18069dae91877cc554cf8c",
  measurementId: "G-PYMW8KRDV2"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const studentsRef = db.ref('tennis_club_students');

// 會所課表資料庫
const WEEKLY_SCHEDULE = {
    1: [
        { class: "Red Ball", time: "15:30-16:30" },
        { class: "Orange Ball", time: "16:30-17:30" },
        { class: "Green Ball", time: "17:30-19:00" }
    ],
    2: [
        { class: "Red Ball", time: "16:30-17:30" },
        { class: "Orange Ball", time: "17:30-18:30" },
        { class: "Green Ball", time: "18:30-20:00" }
    ],
    3: [
        { class: "Orange Ball", time: "16:30-17:30" },
        { class: "Yellow Ball", time: "17:30-19:30" }
    ],
    4: [
        { class: "Red Ball", time: "16:30-17:30" },
        { class: "Orange Ball", time: "17:30-18:30" },
        { class: "Green Ball", time: "18:30-20:00" }
    ],
    5: [
        { class: "Orange Ball", time: "16:30-17:30" },
        { class: "Yellow Ball", time: "17:30-19:30" }
    ],
    6: [
        { class: "Red Ball", time: "09:00-10:00" },
        { class: "Orange Ball", time: "09:30-10:30" },
        { class: "Red Ball", time: "10:00-11:00" },
        { class: "Green Ball", time: "10:30-12:00" },
        { class: "P&P", time: "15:00-17:00" }
    ],
    0: [
        { class: "P&P", time: "10:00-12:00" }
    ]
};

let students = [];

// 初始化預設日期為今天
document.getElementById('schedule-date').value = new Date().toISOString().split('T')[0];

// 監聽 Firebase 資料變更
studentsRef.on('value', (snapshot) => {
    const data = snapshot.val();
    students = [];
    if (data) {
        Object.keys(data).forEach(key => {
            students.push({
                fbKey: key,
                ...data[key],
                bookings: data[key].bookings || []
            });
        });
    }
    const syncElem = document.getElementById('sync-status');
    if (syncElem) syncElem.textContent = '🟢 已雲端同步';
    renderStudents();
    renderSchedule();
});

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');

    if (tabId === 'tab-schedule') {
        renderSchedule();
    }
}

// 新增學員至 Firebase
document.getElementById('student-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const studentId = document.getElementById('student-id').value.trim();
    const payment = document.getElementById('payment').value;
    const totalPackage = parseInt(document.getElementById('total-package').value);

    const newStudent = {
        id: Date.now(),
        name,
        studentId,
        payment,
        totalPackage,
        bookings: []
    };

    studentsRef.push(newStudent);
    this.reset();
});

// 渲染學員列表（支援姓名與學生編號搜尋）
function renderStudents() {
    const list = document.getElementById('student-list');
    const searchInput = document.getElementById('search-student');
    const search = searchInput ? searchInput.value.toLowerCase() : '';
    list.innerHTML = '';

    const filtered = students.filter(s => 
        s.name.toLowerCase().includes(search) || 
        (s.studentId && s.studentId.toLowerCase().includes(search))
    );

    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center; color:#94a3b8; padding:1rem;">尚無學員資料</p>';
        return;
    }

    filtered.forEach(s => {
        const bookings = s.bookings || [];
        const remaining = s.totalPackage - bookings.length;
        const card = document.createElement('div');
        card.className = 'student-card';

        let bookingsHTML = bookings.map(b => `
            <div class="date-chip">
                <span>📅 ${b.date} <br><strong>[${b.className}]</strong> ${b.time}</span>
                <div style="display:flex; gap:0.2rem;">
                    <button class="btn warning sm" onclick="openRebookModal('${s.fbKey}', ${b.id})">改期</button>
                    <button class="btn danger sm" onclick="cancelBooking('${s.fbKey}', ${b.id})">取消</button>
                </div>
            </div>
        `).join('');

        card.innerHTML = `
            <div class="student-header">
                <div>
                    <strong>${s.name}</strong> <span style="color:#64748b; font-size:0.9rem;">(編號: ${s.studentId || '無'})</span>
                    <span class="badge ${s.payment === '已付款' ? 'paid' : 'unpaid'}">${s.payment}</span>
                </div>
                <button class="btn danger sm" onclick="deleteStudent('${s.fbKey}')">刪除學員</button>
            </div>
            <p>已預約：<strong>${bookings.length}</strong> 堂 | 剩餘堂數：<strong>${remaining}</strong> / ${s.totalPackage} 堂</p>
            <div style="margin-top: 0.5rem;">
                ${remaining > 0 
                    ? `<button class="btn success sm" onclick="openBatchBookingModal('${s.fbKey}')">➕ 預約/排課 (可排 ${remaining} 堂)</button>` 
                    : '<span style="color:#dc2626; font-size:0.85rem; font-weight:bold;">⚠️ 套票堂數已全數預約完畢</span>'}
            </div>
            <div class="dates-grid">
                ${bookingsHTML || '<p style="font-size:0.85rem; color:#94a3b8; grid-column: 1/-1;">尚無預約紀錄</p>'}
            </div>
        `;
        list.appendChild(card);
    });
}

function onBookingDateChange(index) {
    const dateInput = document.getElementById(`book-date-${index}`);
    const classSelect = document.getElementById(`book-class-${index}`);
    
    if (!dateInput.value) {
        classSelect.innerHTML = '<option value="">請先選擇日期</option>';
        return;
    }

    const dayOfWeek = new Date(dateInput.value).getDay();
    const availableClasses = WEEKLY_SCHEDULE[dayOfWeek] || [];

    if (availableClasses.length === 0) {
        classSelect.innerHTML = '<option value="">當天無固定課程</option>';
        return;
    }

    classSelect.innerHTML = availableClasses.map(c => 
        `<option value="${c.class}|${c.time}">[${c.class}] ${c.time}</option>`
    ).join('');
}

function openBatchBookingModal(fbKey) {
    const student = students.find(s => s.fbKey === fbKey);
    const bookings = student.bookings || [];
    const remaining = student.totalPackage - bookings.length;

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
        <form onsubmit="saveBatchBookings(event, '${fbKey}', ${remaining})">
            ${inputsHTML}
            <button type="submit" class="btn primary" style="width:100%; margin-top:0.5rem; padding:0.7rem;">確認儲存所有預約</button>
        </form>
    `;
    document.getElementById('booking-modal').style.display = 'flex';
}

function saveBatchBookings(e, fbKey, count) {
    e.preventDefault();
    const student = students.find(s => s.fbKey === fbKey);
    const currentBookings = [...(student.bookings || [])];

    for (let i = 0; i < count; i++) {
        const date = document.getElementById(`book-date-${i}`).value;
        const classValue = document.getElementById(`book-class-${i}`).value;

        if (date && classValue) {
            const [className, time] = classValue.split('|');
            currentBookings.push({
                id: Date.now() + Math.random(),
                date,
                className,
                time
            });
        }
    }

    currentBookings.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    studentsRef.child(fbKey).update({
        bookings: currentBookings
    });

    closeModal();
}

function cancelBooking(fbKey, bookingId) {
    if (confirm('確定要取消這個預約時間嗎？額度會自動退回。')) {
        const student = students.find(s => s.fbKey === fbKey);
        const updatedBookings = (student.bookings || []).filter(b => b.id !== bookingId);
        
        studentsRef.child(fbKey).update({
            bookings: updatedBookings
        });
    }
}

function openRebookModal(fbKey, bookingId) {
    const student = students.find(s => s.fbKey === fbKey);
    const booking = (student.bookings || []).find(b => b.id === bookingId);

    document.getElementById('modal-title').textContent = `更改 ${student.name} 的預約`;
    document.getElementById('modal-body').innerHTML = `
        <form onsubmit="saveRebook(event, '${fbKey}', ${bookingId})">
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

function saveRebook(e, fbKey, bookingId) {
    e.preventDefault();
    const student = students.find(s => s.fbKey === fbKey);
    const currentBookings = [...(student.bookings || [])];
    const booking = currentBookings.find(b => b.id === bookingId);

    const date = document.getElementById('rebook-date').value;
    const classValue = document.getElementById('rebook-class').value;

    if (date && classValue) {
        const [className, time] = classValue.split('|');
        booking.date = date;
        booking.className = className;
        booking.time = time;

        currentBookings.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        studentsRef.child(fbKey).update({
            bookings: currentBookings
        });

        closeModal();
    }
}

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

    dayClasses.forEach(item => {
        const matchedStudents = [];

        students.forEach(s => {
            if (s.payment === '已付款') {
                const bookings = s.bookings || [];
                const hasBooking = bookings.some(b => 
                    b.date === selectedDate && 
                    b.className === item.class && 
                    b.time === item.time
                );
                if (hasBooking) matchedStudents.push(`${s.name} (${s.studentId || '無學號'})`);
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
                    ? matchedStudents.map(info => `<span class="student-tag">👤 ${info}</span>`).join('') 
                    : '<span style="color:#94a3b8; font-size:0.85rem;">目前尚無已付款學員預約</span>'}
            </div>
        `;
        container.appendChild(slotCard);
    });
}

function deleteStudent(fbKey) {
    if (confirm('確定要刪除該學員所有資料嗎？')) {
        studentsRef.child(fbKey).remove();
    }
}

function closeModal() {
    document.getElementById('booking-modal').style.display = 'none';
}
