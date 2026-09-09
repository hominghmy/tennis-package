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

// 2. 密碼驗證與登入邏輯
function verifyPassword(event) {
  event.preventDefault();
  const pwdInput = document.getElementById("sys-password").value;
  const errorMsg = document.getElementById("lock-error");

  if (pwdInput === "coscourse") {
    // 密碼正確：隱藏密碼頁，顯示主內容
    document.getElementById("lock-screen").style.display = "none";
    document.getElementById("app-content").style.display = "block";
    errorMsg.style.display = "none";
    
    // 初始化 Firebase 資料監聽
    initFirebaseListener();
    // 設定預設日期為今天
    document.getElementById("schedule-date").value = new Date().toISOString().split('T')[0];
  } else {
    // 密碼錯誤
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
  // 監聽連線狀態
  database.ref(".info/connected").on("value", (snap) => {
    const statusElement = document.getElementById("sync-status");
    if (statusElement) {
      statusElement.innerText = snap.val() === true ? "🟢 已雲端同步" : "🟡 連線中...";
    }
  });

  // 即時監聽學員資料庫
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

  // 寫入 Firebase (使用 studentId 做 Key)
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

  // 搜尋當天有預約的學員
  Object.keys(studentsData).forEach(id => {
    const student = studentsData[id];
    if (student.bookings) {
      Object.keys(student.bookings).forEach(bKey => {
        const booking = student.bookings[bKey];
        if (booking.date === targetDate) {
          dailyBookings.push({
            studentName: student.name,
            studentId: id,
            time: booking.time || "全天"
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
  
  let studentsHTML = dailyBookings.map(b => `<span class="student-tag">${b.studentName} (${b.time})</span>`).join(" ");

  slotCard.innerHTML = `
    <div class="class-slot-header">
      <span>📅 ${targetDate} 上課學員名單</span>
      <span>共 ${dailyBookings.length} 人</span>
    </div>
    <div class="student-tag-list">
      ${studentsHTML}
    </div>
  `;
  summaryContainer.appendChild(slotCard);
}

// 8. 刪除學員
function deleteStudent(id) {
  if (confirm(`確定要刪除學員 ${id} 嗎？此操作無法撤銷。`)) {
    database.ref("students/" + id).remove();
  }
}

// 9. 彈窗控制
function openBookingModal(studentId) {
  const student = studentsData[studentId];
  if (!student) return;

  document.getElementById("modal-title").innerText = `為 ${student.name} 預約課表`;
  document.getElementById("modal-body").innerHTML = `
    <div class="form-group" style="margin-bottom: 1rem;">
      <label>選擇上課日期：</label>
      <input type="date" id="booking-date" required>
    </div>
    <div class="form-group" style="margin-bottom: 1rem;">
      <label>選擇時段：</label>
      <input type="time" id="booking-time" required>
    </div>
    <button class="btn primary" style="width: 100%;" onclick="submitBooking('${studentId}')">確認新增預約</button>
  `;
  document.getElementById("booking-modal").style.display = "flex";
}

function submitBooking(studentId) {
  const date = document.getElementById("booking-date").value;
  const time = document.getElementById("booking-time").value;

  if (!date || !time) {
    alert("請填寫完整的日期與時間！");
    return;
  }

  const newBookingRef = database.ref(`students/${studentId}/bookings`).push();
  newBookingRef.set({
    date: date,
    time: time
  }).then(() => {
    alert("預約成功！");
    closeModal();
  });
}

function closeModal() {
  document.getElementById("booking-modal").style.display = "none";
}
