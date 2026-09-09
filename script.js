// Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyBpIGPINFR9DzrRSMHX4DS9UF_pz0AP30",
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
const auth = firebase.auth();
const studentsRef = db.ref('tennis_club_students');

let isAdmin = false;
let students = [];

// 監聽管理員登入狀態變更
auth.onAuthStateChanged(user => {
    if (user) {
        isAdmin = true;
        document.getElementById('user-status-text').textContent = `🔓 管理員模式 (${user.email})`;
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('logout-btn').style.display = 'inline-block';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
    } else {
        isAdmin = false;
        document.getElementById('user-status-text').textContent = '👀 目前模式：僅供檢視 (訪客)';
        document.getElementById('login-btn').style.display = 'inline-block';
        document.getElementById('logout-btn').style.display = 'none';
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
    renderStudents();
});

// 管理者登入彈窗開關
function openLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
}

function loginAdmin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            closeModal('login-modal');
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
        })
        .catch(err => {
            alert('登入失敗：' + err.message);
        });
}

function logoutAdmin() {
    auth.signOut();
}

// 固定每週課表
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

// 預設檢視日期為今天
document.getElementById('schedule-date').value = new Date().toISOString().split('T')[0];

// 監聽 Firebase 資料庫即時變更
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
    document.getElementById('sync-status').textContent = '🟢 已雲端同步';
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

// 新增學員套票 (僅限管理員)
document.getElementById('student-form').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!isAdmin) return alert('權限不足！請先登入管理者帳號。');

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

// 渲染學員列表 (可搜尋姓名或學生編號)
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
                ${isAdmin ? `
                <div style="display:flex; gap:0.2rem;">
                    <button class="btn warning sm" onclick="openRebookModal('${s.fbKey}', ${b.id})">改期</button>
                    <button class="btn danger sm" onclick="cancelBooking('${s.fbKey}', ${b.id})">取消</button>
                </div>` : ''}
            </div>
        `).join('');

        card.innerHTML = `
            <div class="student-header">
                <div>
                    <strong>${s.name}</strong> <span style="color:#64748b; font-size:0.9rem;">(編號: ${s.studentId || '無'})</span>
                    <span class="badge ${s.payment === '已付款' ? 'paid' : 'unpaid'}">${s.payment}</span>
                </div>
                ${isAdmin ? `<button class="btn danger sm" onclick="deleteStudent('${s.fbKey}')">刪除學員</button>` : ''}
            </div>
            <p>已預約：<strong>${bookings.length}</strong> 堂 | 剩餘堂數：<strong>${remaining}</strong> / ${s.totalPackage} 堂</p>
            ${isAdmin ? `
            <div style="margin-top: 0.5rem;">
                ${remaining > 0 
                    ? `<button class="btn success sm" onclick="openBatchBookingModal('${s.fbKey}')">➕ 預約/排課 (可排 ${remaining} 堂)</button>` 
                    : '<span style="color:#dc2626; font-size:0.85rem; font-weight:bold;">⚠️ 套票堂數已全數預約完畢</span>'}
            </div>` : ''}
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
    if (!isAdmin) return;
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
    if (!isAdmin) return alert('權限不足！');

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

    closeModal('booking-modal');
}

function cancelBooking(fbKey, bookingId) {
    if (!isAdmin) return alert('權限不足！');
    if (confirm('確定要取消這個預約時間嗎？額度會自動退回。')) {
        const student = students.find(s => s.fbKey === fbKey);
        const updatedBookings = (student.bookings || []).filter(b => b.id !== bookingId);
        
        studentsRef.child(fbKey).update({
            bookings: updatedBookings
        });
    }
}

function openRebookModal(fbKey, bookingId) {
    if (!isAdmin) return;
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
    if (!isAdmin) return alert('權限不足！');

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

        closeModal('booking-modal');
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
    if (!isAdmin) return alert('權限不足！');
    if (confirm('確定要刪除該學員所有資料嗎？')) {
        studentsRef.child(fbKey).remove();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}
