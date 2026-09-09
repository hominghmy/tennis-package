// 1. Firebase 初始化設定 (請填入你的 Firebase 專案設定)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "tennis-package.firebaseapp.com",
  databaseURL: "https://tennis-package-default-rtdb.firebaseio.com", // ⚠️ 必須包含 databaseURL
  projectId: "tennis-package",
  storageBucket: "tennis-package.appstop.com",
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
  1: ["Red Ball 1530-1630", "Orange Ball 1630-1730", "Green Ball 1730-1900"],
  2: ["Red Ball 1630-1730", "Orange Ball 1730-1830", "Green Ball 1830-2000"],
  3: ["Orange Ball 1630-1730", "Yellow Ball 1730-1930"],
  4: ["Red Ball 1530-1630", "Orange Ball 1630-1730", "Green Ball 1730-1900"],
  5: ["Orange Ball 1630-1730", "Yellow Ball 1730-1930"],
  6: ["Red Ball 0900-1000", "Red Ball 1000-1100", "Green Ball 1030-1200", "P&P 1500-1700"],
  0: ["P&P 1000-1200"]
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

// 6. 渲染學員列表 (含修改與取消預約按鈕)
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

      const bookedCount = student.bookings ? Object.keys(student.bookings).length : 0;
      const totalPackage = student.totalPackage || 0;
      const remainingCount = totalPackage - bookedCount;

      let bookingsHtml = "";
      if (student.bookings) {
        // 按日期由早到晚排序
        const bookingList = Object.keys(student.bookings).map(bKey => ({
          key: bKey,
          ...student.bookings[bKey]
        })).sort((a, b) => {
          if (a.date === b.date) {
            return (a.className || "").localeCompare(b.className || "");
          }
          return (a.date || "").localeCompare(b.date || "");
        });

        bookingsHtml = `<div class="dates-grid">`;
        bookingList.forEach(booking => {
          bookingsHtml += `
            <div class="date-chip">
              <span>📅 ${booking.date} | ${booking.className || booking.time}</span>
              <div style="display: flex; gap: 2px; margin-left: 6px;">
                <button class="btn warning sm" style="padding:0px 4px;" title="修改預約" onclick="openEditBookingModal('${id}', '${booking.key}', '${booking.date}', '${booking.className || ''}')">✏️</button>
                <button class="btn danger sm" style="padding:0px 4px;" title="取消預約" onclick="deleteBooking('${id}', '${booking.key}')">✕</button>
              </div>
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
        <div style="font-size: 0.9rem; color: #475569; margin-top: 4px;">
          套票總堂數：<strong>${totalPackage}</strong> 堂 | 
          已預約：<strong>${bookedCount}</strong> 堂 | 
          剩餘堂數：<strong style="color: ${remainingCount > 0 ? '#16a34a' : '#dc2626'}; font-size: 1rem;">${remainingCount}</strong> 堂
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

// 9. 開啟「修改單一預約」彈窗
function openEditBookingModal(studentId, bookingKey, currentDate, currentClass) {
  const student = studentsData[studentId];
  if (!student) return;

  document.getElementById("modal-title").innerText = `修改 ${student.name} 的預約紀錄`;
  document.getElementById("modal-body").innerHTML = `
    <div style="padding: 10px; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px;">
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.9rem;">選擇新日期：</label>
        <input type="date" id="edit-booking-date" value="${currentDate}" onchange="updateEditClassOptions()" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px;">
        <span id="edit-date-hint" style="font-size: 0.8rem; color: #64748b; margin-top: 2px; display: block;"></span>
      </div>

      <div style="margin-bottom: 12px;">
        <label style="display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.9rem;">選擇新班別/時段：</label>
        <select id="edit-booking-class" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px;">
          <option value="">請選擇日子</option>
        </select>
      </div>
    </div>

    <button class="btn primary" style="width: 100%; font-size: 1rem; padding: 0.6rem; margin-top: 1rem;" onclick="submitEditBooking('${studentId}', '${bookingKey}')">確認儲存修改</button>
  `;

  document.getElementById("booking-modal").style.display = "flex";
  
  // 初始化日期與對應班別
  updateEditClassOptions(currentClass);
}

// 修改預約彈窗的班別下拉選單更新
function updateEditClassOptions(presetClass = "") {
  const dateInput = document.getElementById("edit-booking-date").value;
  const classSelect = document.getElementById("edit-booking-class");
  const hint = document.getElementById("edit-date-hint");

  if (!dateInput) {
    classSelect.innerHTML = `<option value="">請選擇日子</option>`;
    hint.innerText = "";
    return;
  }

  const parts = dateInput.split('-');
  const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = selectedDate.getDay();
  const weekdayName = WEEKDAY_NAMES[dayOfWeek];

  hint.innerText = `💡 ${weekdayName}`;

  const availableClasses = SCHEDULE_BY_DAY[dayOfWeek] || [];

  if (availableClasses.length === 0) {
    classSelect.innerHTML = `<option value="">當日無可選擇之班別</option>`;
  } else {
    classSelect.innerHTML = availableClasses
      .map(c => `<option value="${weekdayName} ${c}">${c}</option>`)
      .join("");

    if (presetClass) {
      for (let opt of classSelect.options) {
        if (opt.value === presetClass) {
          classSelect.value = presetClass;
          break;
        }
      }
    }
  }
}

// 提交修改預約到 Firebase
function submitEditBooking(studentId, bookingKey) {
  const newDate = document.getElementById("edit-booking-date").value;
  const newClass = document.getElementById("edit-booking-class").value;

  if (!newDate) {
    alert("請選擇日期！");
    return;
  }
  if (!newClass || newClass === "請選擇日子" || newClass === "當日無可選擇之班別") {
    alert("請選擇有效的班別與時段！");
    return;
  }

  database.ref(`students/${studentId}/bookings/${bookingKey}`).update({
    date: newDate,
    className: newClass
  }).then(() => {
    alert("預約修改成功！");
    closeModal();
  }).catch(err => {
    alert("修改失敗：" + err.message);
  });
}

// 10. 多堂預約彈窗控制
function openBookingModal(studentId) {
  const student = studentsData[studentId];
  if (!student) return;

  const bookedCount = student.bookings ? Object.keys(student.bookings).length : 0;
  const totalPackage = student.totalPackage || 0;
  const remainingCount = totalPackage - bookedCount;

  document.getElementById("modal-title").innerText = `為 ${student.name} 預約課表`;
  document.getElementById("modal-body").innerHTML = `
    <div style="background: #f1f5f9; padding: 10px; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem;">
      套票總額：<b>${totalPackage}</b> 堂 | 已預約：<b>${bookedCount}</b> 堂 | 
      <span style="color: ${remainingCount > 0 ? '#16a34a' : '#dc2626'}; font-weight: bold;">剩餘堂數：${remainingCount} 堂</span>
    </div>

    <div class="form-group" style="margin-bottom: 1rem;">
      <label><b>選擇預約堂數 (1~10 堂)：</b></label>
      <select id="booking-count" onchange="generateBookingRows('${studentId}')" style="width: 100%; padding: 0.4rem;">
        ${[1,2,3,4,5,6,7,8,9,10].map(num => `<option value="${num}">${num} 堂</option>`).join("")}
      </select>
    </div>

    <div id="booking-rows-container" style="max-height: 280px; overflow-y: auto; padding-right: 5px;"></div>

    <button class="btn primary" style="width: 100%; font-size: 1rem; padding: 0.6rem; margin-top: 1rem;" onclick="submitMultipleBookings('${studentId}')">確認新增所有預約</button>
  `;

  document.getElementById("booking-modal").style.display = "flex";
  generateBookingRows(studentId);
}

// 動態生成 1~10 堂預約欄位
function generateBookingRows(studentId) {
  const count = parseInt(document.getElementById("booking-count").value, 10);
  const container = document.getElementById("booking-rows-container");
  container.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const rowDiv = document.createElement("div");
    rowDiv.style.cssText = "border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 8px; background: #fff;";
    rowDiv.innerHTML = `
      <div style="font-weight: bold; font-size: 0.85rem; color: #2563eb; margin-bottom: 4px;">第 ${i + 1} 堂：</div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <input type="date" id="row-date-${i}" value="" onchange="onDateChanged(${i})" style="flex: 1; padding: 0.4rem; font-size: 0.85rem;">
        <select id="row-class-${i}" onchange="onClassChanged(${i})" style="flex: 1.5; padding: 0.4rem; font-size: 0.85rem;">
          <option value="">請選擇日子</option>
        </select>
      </div>
      <span id="row-hint-${i}" style="font-size: 0.75rem; color: #64748b;"></span>
    `;
    container.appendChild(rowDiv);
  }
}

// 日期變更處理：修改第 1 堂連動後續堂數
function onDateChanged(index) {
  const count = parseInt(document.getElementById("booking-count").value, 10);
  const selectedDateStr = document.getElementById(`row-date-${index}`).value;

  updateRowClassOptions(index);

  if (index === 0 && selectedDateStr) {
    const parts = selectedDateStr.split('-');
    const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);

    for (let i = 1; i < count; i++) {
      const nextDate = new Date(baseDate);
      nextDate.setDate(baseDate.getDate() + (i * 7));

      const yyyy = nextDate.getFullYear();
      const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
      const dd = String(nextDate.getDate()).padStart(2, '0');
      const nextDateStr = `${yyyy}-${mm}-${dd}`;

      const dateInput = document.getElementById(`row-date-${i}`);
      if (dateInput) {
        dateInput.value = nextDateStr;
        updateRowClassOptions(i);
      }
    }
  }
}

// 班別變更處理：同步後面堂數班別
function onClassChanged(index) {
  if (index !== 0) return;
  const count = parseInt(document.getElementById("booking-count").value, 10);
  const selectedClass = document.getElementById("row-class-0").value;

  if (!selectedClass) return;

  for (let i = 1; i < count; i++) {
    const selectElem = document.getElementById(`row-class-${i}`);
    if (selectElem) {
      for (let option of selectElem.options) {
        if (option.value === selectedClass) {
          selectElem.value = selectedClass;
          break;
        }
      }
    }
  }
}

// 更新單一欄位的班別選項
function updateRowClassOptions(index) {
  const dateInput = document.getElementById(`row-date-${index}`).value;
  const classSelect = document.getElementById(`row-class-${index}`);
  const hint = document.getElementById(`row-hint-${index}`);

  if (!dateInput) {
    classSelect.innerHTML = `<option value="">請選擇日子</option>`;
    hint.innerText = "";
    return;
  }

  const parts = dateInput.split('-');
  const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = selectedDate.getDay();
  const weekdayName = WEEKDAY_NAMES[dayOfWeek];

  hint.innerText = `💡 ${weekdayName}`;

  const availableClasses = SCHEDULE_BY_DAY[dayOfWeek] || [];

  if (availableClasses.length === 0) {
    classSelect.innerHTML = `<option value="">當日無可選擇之班別</option>`;
  } else {
    const currentVal = classSelect.value;
    classSelect.innerHTML = availableClasses
      .map(c => `<option value="${weekdayName} ${c}">${c}</option>`)
      .join("");

    const firstClassVal = document.getElementById("row-class-0") ? document.getElementById("row-class-0").value : "";
    const targetVal = (index > 0 && firstClassVal) ? firstClassVal : currentVal;

    let matched = false;
    for (let opt of classSelect.options) {
      if (opt.value === targetVal) {
        classSelect.value = targetVal;
        matched = true;
        break;
      }
    }
    if (!matched && classSelect.options.length > 0) {
      classSelect.selectedIndex = 0;
    }
  }
}

// 批量提交預約到 Firebase
function submitMultipleBookings(studentId) {
  const count = parseInt(document.getElementById("booking-count").value, 10);
  let newBookings = [];

  for (let i = 0; i < count; i++) {
    const date = document.getElementById(`row-date-${i}`).value;
    const selectedClass = document.getElementById(`row-class-${i}`).value;

    if (!date) {
      alert(`第 ${i + 1} 堂尚未選擇日期！`);
      return;
    }
    if (!selectedClass || selectedClass === "請選擇日子" || selectedClass === "當日無可選擇之班別") {
      alert(`第 ${i + 1} 堂尚未選擇班別！`);
      return;
    }

    newBookings.push({
      date: date,
      className: selectedClass
    });
  }

  // 寫入 Firebase
  let promises = newBookings.map(b => {
    return database.ref(`students/${studentId}/bookings`).push().set(b);
  });

  Promise.all(promises).then(() => {
    alert(`成功一次性預約 ${count} 堂課程！`);
    closeModal();
  }).catch(err => {
    alert("預約失敗：" + err.message);
  });
}

function closeModal() {
  document.getElementById("booking-modal").style.display = "none";
}
