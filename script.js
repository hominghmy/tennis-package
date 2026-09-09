// 1. Firebase 初始化設定 (請填入你的 Firebase 專案設定)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "tennis-package.firebaseapp.com",
  databaseURL: "https://tennis-package-default-rtdb.firebaseio.com", // ⚠️ 必須包含 databaseURL
  projectId: "tennis-package",
  storageBucket: "tennis-package.appspot.com",
  messagingSenderId: "897402153829",
  appId: "1:897402153829:web:18069dae9187cc554cf8c"
};

// 初始化 Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// 本地資料快取
let studentsData = {};

// 按星期幾分類的班別對照表 (0: 星期日, 1: 星期一, ..., 6: 星期六)
const SCHEDULE_BY_DAY = {
  1: [ // 星期一
    "Red Ball 1530-1630",
    "Orange Ball 1630-1730",
    "Green Ball 1730-1900"
  ],
  2: [ // 星期二
    "Red Ball 1630-1730",
    "Orange Ball 1730-1830",
    "Green Ball 1830-2000"
  ],
  3: [ // 星期三
    "Orange Ball 1630-1730",
    "Yellow Ball 1730-1930"
  ],
  4: [ // 星期四
    "Red Ball 1530-1630",
    "Orange Ball 1630-1730",
    "Green Ball 1730-1900"
  ],
  5: [ // 星期五
    "Orange Ball 1630-1730",
    "Yellow Ball 1730-1930"
  ],
  6: [ // 星期六
    "Red Ball 0900-1000",
    "Red Ball 1000-1100",
    "Green Ball 1030-1200",
    "P&P 1500-1700"
  ],
  0: [ // 星期日
    "P&P 1000-1200"
  ]
};

const WEEKDAY_NAMES = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

// 2. 密碼驗證與登入邏輯
function verifyPassword(event) {
  event.preventDefault();
  const pwdInput = document.getElementById("sys-password").value;
  const errorMsg = document.getElementById("lock-error");

  if (pwdInput === "coscourse") {
    document.getElementById("lock-screen").style.display = "none";
    document.getElementById("app-content").style.display = "block";
    errorMsg.style.display = "none";
    
    initFirebaseListener();
    document.getElementById("schedule-date").value = new Date().toISOString().split('T')[0];
  } else {
    errorMsg.style.display = "block";
  }
}

// 登出系統
function logoutSystem() {
  document.getElementById("sys-password").value = "";
  document.getElementById("lock-screen").style.display = "flex";
  document.getElementById("app-content").style.display = "none";
}

// 3. 監聽 Firebase 資料與連線狀態
function initFirebaseListener() {
  database.ref(".info/connected").on("value", (snap) => {
    const statusElement = document.getElementById("sync-status");
    if (statusElement) {
      statusElement.innerText = snap.val() === true ? "🟢 已雲端同步" : "🟡 連線中...";
    }
  });

  database.ref("students").on("value", (snapshot) => {
    studentsData = snapshot.val() || {};
    renderStudents();
    renderSchedule();
  });
}

// 4. 分頁切換
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
  
  event.target.classList.add("active");
  document.getElementById(tabId).classList.add("active");
}

// 5. 表單提交：新增學員
document.getElementById("student-form").addEventListener("submit", function(e) {
  e.preventDefault();
  
  const name = document.getElementById("name").value.trim();
  const studentId = document.getElementById("student-id").value.trim();
  const payment = document.getElementById("payment").value;
  const totalPackage = parseInt(document.getElementById("total-package").value, 10);

  if (!name || !studentId) return;

  const newStudent = {
    name: name,
    studentId: studentId,
    payment: payment,
    totalPackage: totalPackage,
    bookings: {}
  };

  database.ref("students/" + studentId).set(newStudent)
    .then(() => {
      alert("學員新增成功！");
      document.getElementById("student-form").reset();
    })
    .catch((error) => {
      alert("新增失敗：" + error.message);
    });
});

// 6. 渲染學員列表
function renderStudents() {
  const listContainer = document.getElementById("student-list");
  const keyword = document.getElementById("search-student").value.toLowerCase();
  listContainer.innerHTML = "";

  const keys = Object.keys(studentsData);
  if (keys.length === 0) {
    listContainer.innerHTML = "<p style='color: #64748b;'>目前無學員資料。</p>";
    return;
  }

  keys.forEach(id => {
    const student = studentsData[id];
    if (student.name.toLowerCase().includes(keyword) || id.toLowerCase().includes(keyword)) {
      const card = document.createElement("div");
      card.className = "student-card";
      
      const isPaid = student.payment === "已付款";
      const badgeClass = isPaid ? "badge paid" : "badge unpaid";

      let bookingsHtml = "";
      if (student.bookings) {
        bookingsHtml = `<div class="dates-grid">`;
        Object.keys(student.bookings).forEach(bKey => {
          const booking = student.bookings[bKey];
          bookingsHtml += `
            <div class="date-chip">
              <span>📅 ${booking.date} | ${booking.className || booking.time}</span>
              <button class="btn danger sm" style="padding:0px 4px; margin-left: 5px;" onclick="deleteBooking('${id}', '${bKey}')">✕</button>
            </div>
          `;
        });
        bookingsHtml += `</div>`;
      } else {
        bookingsHtml = `<div style="font-size:0.85rem; color:#94a3b8; margin-top:0.4rem;">尚未預約任何班別</div>`;
      }

      card.innerHTML = `
        <div class="student-header">
          <div>
            <strong>${student.name}</strong> (${id})
            <span class="${badgeClass}">${student.payment}</span>
          </div>
          <div>
            <button class="btn warning sm" onclick="openBookingModal('${id}')">📅 預約課表</button>
            <button class="btn danger sm" onclick="deleteStudent('${id}')">🗑️ 刪除</button>
          </div>
        </div>
        <div style="font-size: 0.9rem; color: #475569;">
          套票堂數：${student.totalPackage} 堂
        </div>
        ${bookingsHtml}
      `;
      listContainer.appendChild(card);
    }
  });
}

// 7. 渲染日曆課表總覽
function renderSchedule() {
  const targetDate = document.getElementById("schedule-date").value;
  const summaryContainer = document.getElementById("schedule-summary");
  summaryContainer.innerHTML = "";

  if (!targetDate) return;

  let dailyBookings = [];

  Object.keys(studentsData).forEach(id => {
    const student = studentsData[id];
    if (student.bookings) {
      Object.keys(student.bookings).forEach(bKey => {
        const booking = student.bookings[bKey];
        if (booking.date === targetDate) {
          dailyBookings.push({
            studentName: student.name,
            studentId: id,
            className: booking.className || booking.time || "全天"
          });
        }
      });
    }
  });

  if (dailyBookings.length === 0) {
    summaryContainer.innerHTML = `<p style="color: #64748b;">該日期（${targetDate}）無預約課表。</p>`;
    return;
  }

  const slotCard = document.createElement("div");
  slotCard.className = "class-slot-card";
  
  let studentsHTML = dailyBookings.map(b => `<span class="student-tag">${b.studentName} - ${b.className}</span>`).join(" ");

  slotCard.innerHTML = `
    <div class="class-slot-header">
      <span>📅 ${targetDate} 上課學員名單</span>
      <span>共 ${dailyBookings.length} 人次</span>
    </div>
    <div class="student-tag-list">
      ${studentsHTML}
    </div>
  `;
  summaryContainer.appendChild(slotCard);
}

// 8. 刪除學員與預約
function deleteStudent(id) {
  if (confirm(`確定要刪除學員 ${id} 嗎？此操作無法撤銷。`)) {
    database.ref("students/" + id).remove();
  }
}

function deleteBooking(studentId, bookingKey) {
  if (confirm("確定要取消此堂預約嗎？")) {
    database.ref(`students/${studentId}/bookings/${bookingKey}`).remove();
  }
}

// 9. 預約彈窗控制：先選日期，自動過濾當天班別
function openBookingModal(studentId) {
  const student = studentsData[studentId];
  if (!student) return;

  const todayStr = new Date().toISOString().split('T')[0];

  document.getElementById("modal-title").innerText = `為 ${student.name} 預約課表`;
  document.getElementById("modal-body").innerHTML = `
    <div class="form-group" style="margin-bottom: 1rem;">
      <label>1. 選擇上課日期：</label>
      <input type="date" id="booking-date" value="${todayStr}" onchange="updateClassOptions()" style="width: 100%; padding: 0.5rem; font-size: 1rem;">
      <span id="weekday-hint" style="font-size: 0.85rem; color: #2563eb; margin-top: 4px; display: block; font-weight: bold;"></span>
    </div>
    <div class="form-group" style="margin-bottom: 1rem;">
      <label>2. 選擇班別與時段：</label>
      <select id="booking-class" style="width: 100%; padding: 0.5rem; font-size: 0.95rem;"></select>
    </div>
    <button class="btn primary" style="width: 100%; font-size: 1rem; padding: 0.6rem;" onclick="submitBooking('${studentId}')">確認新增預約</button>
  `;

  document.getElementById("booking-modal").style.display = "flex";
  // 觸發一次以初始化當天班別選項
  updateClassOptions();
}

// 根據選擇的日期，更新班別選項
function updateClassOptions() {
  const dateInput = document.getElementById("booking-date").value;
  const classSelect = document.getElementById("booking-class");
  const weekdayHint = document.getElementById("weekday-hint");

  if (!dateInput) {
    classSelect.innerHTML = `<option value="">請先選擇日期</option>`;
    weekdayHint.innerText = "";
    return;
  }

  // 計算選取日期的星期幾 (解決跨時區問題)
  const parts = dateInput.split('-');
  const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = selectedDate.getDay(); 
  const weekdayName = WEEKDAY_NAMES[dayOfWeek];

  weekdayHint.innerText = `💡 選取日期為：${weekdayName}`;

  const availableClasses = SCHEDULE_BY_DAY[dayOfWeek] || [];

  if (availableClasses.length === 0) {
    classSelect.innerHTML = `<option value="">當日無可選擇之班別</option>`;
  } else {
    classSelect.innerHTML = availableClasses
      .map(c => `<option value="${weekdayName} ${c}">${c}</option>`)
      .join("");
  }
}

function submitBooking(studentId) {
  const date = document.getElementById("booking-date").value;
  const selectedClass = document.getElementById("booking-class").value;

  if (!date) {
    alert("請選擇上課日期！");
    return;
  }
  if (!selectedClass) {
    alert("該日期無可用班別，請重新選擇日期！");
    return;
  }

  const newBookingRef = database.ref(`students/${studentId}/bookings`).push();
  newBookingRef.set({
    date: date,
    className: selectedClass
  }).then(() => {
    alert("預約成功！");
    closeModal();
  }).catch(err => {
    alert("預約失敗：" + err.message);
  });
}

function closeModal() {
  document.getElementById("booking-modal").style.display = "none";
}
