// Firebase 設定與初始化
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "tennis-package.firebaseapp.com",
  databaseURL: "https://tennis-package-default-rtdb.firebaseio.com",
  projectId: "tennis-package",
  storageBucket: "tennis-package.appstop.com",
  messagingSenderId: "897402153829",
  appId: "1:897402153829:web:18069dae9187cc554cf8c"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

let studentsData = {};
let currentSearchKeyword = ""; // 儲存當前搜尋關鍵字

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

// 驗證系統密碼
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

// 初始化 Firebase 資料監聽
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

// 切換 Tab 頁籤
function switchTab(tabId) {
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(content => content.classList.remove("active"));
  
  if (event && event.target) {
    event.target.classList.add("active");
  }
  document.getElementById(tabId).classList.add("active");
}

// 儲存/更新學員
document.getElementById("student-form").addEventListener("submit", function(e) {
  e.preventDefault();
  
  const name = document.getElementById("name").value.trim();
  const studentId = document.getElementById("student-id").value.trim();
  const userType = document.getElementById("user-type").value;
  const payment = document.getElementById("payment").value;
  const inputPackage = parseInt(document.getElementById("total-package").value, 10) || 0;
  let staffName = document.getElementById("staff-name").value.trim();

  if (!staffName) {
    alert("⚠️ 必須填寫經手同事姓名！請輸入處理同事名字。");
    document.getElementById("staff-name").focus();
    return;
  }

  if (!name || !studentId) return;

  const existingStudent = studentsData[studentId];
  const timeStamp = new Date().toLocaleString("zh-TW");

  if (existingStudent) {
    const updatedTotalPackage = (existingStudent.totalPackage || 0) + inputPackage;

    database.ref("students/" + studentId).update({
      name: name,
      userType: userType,
      payment: payment,
      totalPackage: updatedTotalPackage,
      lastUpdatedBy: staffName,
      lastUpdatedAt: timeStamp
    }).then(() => {
      alert(`學員 ${name} (${studentId}) 續購成功！\n身分：${userType}\n經手同事：${staffName}\n新增 ${inputPackage} 堂，總堂數：${updatedTotalPackage} 堂。`);
      document.getElementById("student-form").reset();
      document.getElementById("total-package").value = 10;
    }).catch((error) => {
      alert("更新失敗：" + error.message);
    });

  } else {
    const newStudent = {
      name: name,
      studentId: studentId,
      userType: userType,
      payment: payment,
      totalPackage: inputPackage,
      createdBy: staffName,
      createdAt: timeStamp,
      bookings: {}
    };

    database.ref("students/" + studentId).set(newStudent).then(() => {
      alert(`學員新增成功！\n經手同事：${staffName}`);
      document.getElementById("student-form").reset();
      document.getElementById("total-package").value = 10;
    }).catch((error) => {
      alert("新增失敗：" + error.message);
    });
  }
});

// 手動點擊或按 Enter 觸發搜尋
function executeSearch() {
  currentSearchKeyword = document.getElementById("search-student").value.trim();
  renderStudents();
}

// 模糊搜尋判斷函式
function isFuzzyMatch(text, query) {
  if (!text || !query) return false;
  const cleanText = text.toString().toLowerCase().replace(/\s+/g, '');
  const cleanQuery = query.toString().toLowerCase().replace(/\s+/g, '');
  
  if (cleanText.includes(cleanQuery)) return true;
  
  let qIndex = 0;
  for (let i = 0; i < cleanText.length && qIndex < cleanQuery.length; i++) {
    if (cleanText[i] === cleanQuery[qIndex]) {
      qIndex++;
    }
  }
  return qIndex === cleanQuery.length;
}

// 渲染學員列表
function renderStudents() {
  const listContainer = document.getElementById("student-list");
  listContainer.innerHTML = "";

  if (!currentSearchKeyword) {
    listContainer.innerHTML = "<p style='color: #64748b; text-align: center; padding: 2rem 0;'>🔍 請在上方搜尋框輸入「學員姓名」或「學員編號」並按下搜尋按鈕以檢視資料。</p>";
    return;
  }

  const keys = Object.keys(studentsData);
  let matchCount = 0;

  keys.forEach(id => {
    const student = studentsData[id];
    const matchName = isFuzzyMatch(student.name, currentSearchKeyword);
    const matchId = isFuzzyMatch(id, currentSearchKeyword);

    if (matchName || matchId) {
      matchCount++;
      const card = document.createElement("div");
      card.className = "student-card";
      
      const isPaid = student.payment === "已付款";
      const badgeClass = isPaid ? "badge paid" : "badge unpaid";
      const userType = student.userType || "住戶";

      const bookedCount = student.bookings ? Object.keys(student.bookings).length : 0;
      const totalPackage = student.totalPackage || 0;
      const remainingCount = totalPackage - bookedCount;

      let bookingsHtml = "";
      if (student.bookings) {
        const bookingList = Object.keys(student.bookings).map(bKey => ({
          key: bKey,
          ...student.bookings[bKey]
        })).sort((a, b) => (a.date || "").localeCompare(b.date || ""));

        bookingsHtml = `<div class="dates-grid">`;
        bookingList.forEach(booking => {
          const staffTag = booking.updatedBy ? ` (修改: ${booking.updatedBy})` : (booking.createdBy ? ` (經手: ${booking.createdBy})` : "");
          bookingsHtml += `
            <div class="date-chip">
              <span>📅 ${booking.date} | ${booking.className || booking.time}${staffTag}</span>
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
            <span class="badge type">${userType}</span>
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
          剩餘堂數：<strong style="color: ${remainingCount >= 0 ? '#16a34a' : '#dc2626'}; font-size: 1rem;">${remainingCount}</strong> 堂
        </div>
        ${bookingsHtml}
      `;
      listContainer.appendChild(card);
    }
  });

  if (matchCount === 0) {
    listContainer.innerHTML = "<p style='color: #64748b; text-align: center; padding: 2rem 0;'>找不到符合關鍵字的學員資料。</p>";
  }
}

// 渲染日曆課表總覽
function renderSchedule() {
  const targetDate = document.getElementById("schedule-date").value;
  const summaryContainer = document.getElementById("schedule-summary");
  summaryContainer.innerHTML = "";

  if (!targetDate) return;

  const parts = targetDate.split('-');
  const selectedDateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = selectedDateObj.getDay();
  const weekdayName = WEEKDAY_NAMES[dayOfWeek];

  const availableClasses = SCHEDULE_BY_DAY[dayOfWeek] || [];
  let bookingsByClass = {};
  availableClasses.forEach(c => bookingsByClass[c] = []);
  bookingsByClass["其他/自訂班別"] = [];

  let totalDailyCount = 0;

  Object.keys(studentsData).forEach(id => {
    const student = studentsData[id];
    if (student.bookings) {
      Object.keys(student.bookings).forEach(bKey => {
        const booking = student.bookings[bKey];
        if (booking.date === targetDate) {
          totalDailyCount++;
          let rawClassName = booking.className || booking.time || "";
          let cleanClassName = rawClassName.replace(/^(星期[一二三四五六日]\s*)/, "").trim();

          if (bookingsByClass[cleanClassName]) {
            bookingsByClass[cleanClassName].push({ name: student.name, id: id });
          } else {
            bookingsByClass["其他/自訂班別"].push({ name: student.name, id: id, originalClass: rawClassName });
          }
        }
      });
    }
  });

  const headerSummary = document.createElement("div");
  headerSummary.style.cssText = "font-weight: bold; font-size: 1rem; color: #1e293b; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border-left: 4px solid #2563eb;";
  headerSummary.innerHTML = `
    <span>📅 ${targetDate} (${weekdayName}) 所有班別課表</span>
    <span style="color: #2563eb;">當日總人次：${totalDailyCount} 人次</span>
  `;
  summaryContainer.appendChild(headerSummary);

  availableClasses.forEach(className => {
    const slotCard = document.createElement("div");
    slotCard.style.cssText = "background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 12px;";

    const students = bookingsByClass[className];
    let studentsHTML = students.length > 0
      ? students.map(s => `<span style="display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; padding: 4px 8px; border-radius: 4px; font-size: 0.85rem; margin-right: 6px; margin-top: 6px;">👤 ${s.name} (${s.id})</span>`).join("")
      : `<span style="font-size: 0.85rem; color: #94a3b8;">尚無學員預約</span>`;

    slotCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; margin-bottom: 8px;">
        <strong style="color: #0f172a; font-size: 0.95rem;">🎾 ${className}</strong>
        <span style="font-size: 0.85rem; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 12px;">${students.length} 人</span>
      </div>
      <div>${studentsHTML}</div>
    `;
    summaryContainer.appendChild(slotCard);
  });
}

// 刪除學員與預約
function deleteStudent(id) {
  if (confirm(`確定要刪除學員 ${id} 嗎？`)) database.ref("students/" + id).remove();
}

function deleteBooking(studentId, bookingKey) {
  if (confirm("確定要取消此堂預約嗎？")) database.ref(`students/${studentId}/bookings/${bookingKey}`).remove();
}

// 修改單堂預約 Modal
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
        <label style="display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.9rem;">選擇新班別：</label>
        <select id="edit-booking-class" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px;"></select>
      </div>
      <div style="margin-bottom: 12px;">
        <label style="display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.9rem; color: #dc2626;">修改經手同事姓名 (必填)：</label>
        <input type="text" id="edit-staff-name" placeholder="請輸入處理同事名字" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px;">
      </div>
    </div>
    <button class="btn primary" style="width: 100%; margin-top: 1rem;" onclick="submitEditBooking('${studentId}', '${bookingKey}')">確認儲存修改</button>
  `;

  document.getElementById("booking-modal").style.display = "flex";
  updateEditClassOptions(currentClass);
}

function updateEditClassOptions(presetClass = "") {
  const dateInput = document.getElementById("edit-booking-date").value;
  const classSelect = document.getElementById("edit-booking-class");
  const hint = document.getElementById("edit-date-hint");

  if (!dateInput) return;
  const parts = dateInput.split('-');
  const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = selectedDate.getDay();
  const weekdayName = WEEKDAY_NAMES[dayOfWeek];

  hint.innerText = `💡 ${weekdayName}`;
  const availableClasses = SCHEDULE_BY_DAY[dayOfWeek] || [];

  if (availableClasses.length === 0) {
    classSelect.innerHTML = `<option value="">當日無可選擇之班別</option>`;
  } else {
    classSelect.innerHTML = availableClasses.map(c => `<option value="${weekdayName} ${c}">${c}</option>`).join("");
    if (presetClass) classSelect.value = presetClass;
  }
}

// 修改預約（含重複檢測防呆）
function submitEditBooking(studentId, bookingKey) {
  const newDate = document.getElementById("edit-booking-date").value;
  const newClass = document.getElementById("edit-booking-class").value;
  const staffName = document.getElementById("edit-staff-name").value.trim();

  if (!staffName) {
    alert("⚠️ 必須填寫經手同事姓名！請輸入處理同事名字。");
    document.getElementById("edit-staff-name").focus();
    return;
  }

  if (!newDate || !newClass) {
    alert("⚠️ 請完整填寫預約日期與班別！");
    return;
  }

  // 防呆判斷：檢測該學員是否已有相同日期 + 班別的預約 (排除自己正在修改的這個 bookingKey)
  const student = studentsData[studentId];
  if (student && student.bookings) {
    const isDuplicate = Object.keys(student.bookings).some(key => {
      if (key === bookingKey) return false; // 排除自己
      const b = student.bookings[key];
      return b.date === newDate && (b.className === newClass || b.time === newClass);
    });

    if (isDuplicate) {
      alert(`⚠️ 預約失敗！該學員在 ${newDate} 已預約過【${newClass}】，無法重複預約同一天同一時段。`);
      return;
    }
  }

  database.ref(`students/${studentId}/bookings/${bookingKey}`).update({
    date: newDate,
    className: newClass,
    updatedBy: staffName,
    updatedAt: new Date().toLocaleString("zh-TW")
  }).then(() => {
    alert(`預約修改成功！\n經手同事：${staffName}`);
    closeModal();
  });
}

// 多堂預約 Modal
function openBookingModal(studentId) {
  const student = studentsData[studentId];
  if (!student) return;

  const bookedCount = student.bookings ? Object.keys(student.bookings).length : 0;
  const totalPackage = student.totalPackage || 0;
  const remainingCount = totalPackage - bookedCount;

  document.getElementById("modal-title").innerText = `為 ${student.name} 預約課表`;
  document.getElementById("modal-body").innerHTML = `
    <div style="background: #f1f5f9; padding: 10px; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem;">
      套票總額：<b>${totalPackage}</b> 堂 | 剩餘堂數：<b>${remainingCount}</b> 堂
    </div>
    <div class="form-group" style="margin-bottom: 1rem;">
      <label><b>選擇預約堂數：</b></label>
      <select id="booking-count" onchange="generateBookingRows('${studentId}')" style="width: 100%; padding: 0.4rem;">
        ${[1,2,3,4,5,6,7,8,9,10].map(num => `<option value="${num}">${num} 堂</option>`).join("")}
      </select>
    </div>
    <div id="booking-rows-container"></div>
    <div style="margin-top: 10px;">
      <label style="display: block; font-weight: bold; margin-bottom: 4px; font-size: 0.9rem; color: #dc2626;">經手同事姓名 (必填)：</label>
      <input type="text" id="booking-staff-name" placeholder="請輸入處理同事名字" style="width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 4px;">
    </div>
    <button class="btn primary" style="width: 100%; margin-top: 1rem;" onclick="submitMultipleBookings('${studentId}')">確認新增所有預約</button>
  `;

  document.getElementById("booking-modal").style.display = "flex";
  generateBookingRows(studentId);
}

// 生成預約列
function generateBookingRows(studentId) {
  const count = parseInt(document.getElementById("booking-count").value, 10);
  const container = document.getElementById("booking-rows-container");
  container.innerHTML = "";

  for (let i = 0; i < count; i++) {
    const rowDiv = document.createElement("div");
    rowDiv.style.cssText = "border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-bottom: 8px;";
    rowDiv.innerHTML = `
      <div style="font-weight: bold; font-size: 0.85rem; color: #2563eb;">第 ${i + 1} 堂：</div>
      <div style="display: flex; gap: 8px;">
        <input type="date" id="row-date-${i}" onchange="handleRowDateChange(${i})" oninput="handleRowDateChange(${i})" style="flex: 1; padding: 0.4rem;">
        <select id="row-class-${i}" onchange="handleRowClassChange(${i})" style="flex: 1.5; padding: 0.4rem;">
          <option value="">請先選擇日期</option>
        </select>
      </div>
    `;
    container.appendChild(rowDiv);
  }
}

// 處理日期變更
function handleRowDateChange(index) {
  const count = parseInt(document.getElementById("booking-count").value, 10);
  const firstDateVal = document.getElementById("row-date-0").value;

  if (index === 0 && firstDateVal) {
    const parts = firstDateVal.split('-');
    if (parts.length !== 3) return;

    const startYear = parseInt(parts[0], 10);
    const startMonth = parseInt(parts[1], 10) - 1;
    const startDateNum = parseInt(parts[2], 10);

    for (let i = 0; i < count; i++) {
      const nextDateObj = new Date(startYear, startMonth, startDateNum + (i * 7));

      const year = nextDateObj.getFullYear();
      const month = String(nextDateObj.getMonth() + 1).padStart(2, '0');
      const day = String(nextDateObj.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;

      const dateInput = document.getElementById(`row-date-${i}`);
      if (dateInput) {
        dateInput.value = formattedDate;
        updateRowClassOptions(i);
      }
    }
    
    handleRowClassChange(0);
  } else {
    updateRowClassOptions(index);
  }
}

// 更新單列班別選單選項
function updateRowClassOptions(index) {
  const dateInput = document.getElementById(`row-date-${index}`).value;
  const classSelect = document.getElementById(`row-class-${index}`);

  if (!dateInput) return;
  const parts = dateInput.split('-');
  if (parts.length !== 3) return;

  const selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = selectedDate.getDay();
  const weekdayName = WEEKDAY_NAMES[dayOfWeek];
  const availableClasses = SCHEDULE_BY_DAY[dayOfWeek] || [];

  const currentSelected = classSelect.value;

  if (availableClasses.length === 0) {
    classSelect.innerHTML = `<option value="">當日無課</option>`;
  } else {
    classSelect.innerHTML = availableClasses.map(c => `<option value="${weekdayName} ${c}">${c}</option>`).join("");
    if (currentSelected) {
      classSelect.value = currentSelected;
    }
  }
}

// 處理班別選擇變更
function handleRowClassChange(index) {
  if (index === 0) {
    const firstClassVal = document.getElementById("row-class-0").value;
    const count = parseInt(document.getElementById("booking-count").value, 10);

    if (!firstClassVal) return;

    const pureClassName = firstClassVal.replace(/^(星期[一二三四五六日]\s*)/, "").trim();

    for (let i = 1; i < count; i++) {
      const selectElem = document.getElementById(`row-class-${i}`);
      if (selectElem) {
        for (let option of selectElem.options) {
          if (option.value.includes(pureClassName)) {
            selectElem.value = option.value;
            break;
          }
        }
      }
    }
  }
}

// 提交批次預約（包含內外部重複防呆）
function submitMultipleBookings(studentId) {
  const count = parseInt(document.getElementById("booking-count").value, 10);
  const staffName = document.getElementById("booking-staff-name").value.trim();

  if (!staffName) {
    alert("⚠️ 必須填寫經手同事姓名！請輸入處理同事名字。");
    document.getElementById("booking-staff-name").focus();
    return;
  }

  let newBookings = [];
  let seenSlots = new Set(); // 檢測目前畫面上填寫的是否自我重複

  for (let i = 0; i < count; i++) {
    const date = document.getElementById(`row-date-${i}`).value;
    const selectedClass = document.getElementById(`row-class-${i}`).value;

    if (!date || !selectedClass) {
      alert(`請完整填寫第 ${i + 1} 堂的預約內容！`);
      return;
    }

    const slotKey = `${date}_${selectedClass}`;
    if (seenSlots.has(slotKey)) {
      alert(`⚠️ 預約表單內包含重複預約：\n第 ${i + 1} 堂與前面設定了相同的日期與時段（${date} ${selectedClass}）。請調整後再試！`);
      return;
    }
    seenSlots.add(slotKey);

    newBookings.push({ 
      date: date, 
      className: selectedClass,
      createdBy: staffName,
      createdAt: new Date().toLocaleString("zh-TW")
    });
  }

  // 防呆：檢測是否與該學員「資料庫中已有」的預約重複
  const student = studentsData[studentId];
  if (student && student.bookings) {
    const existingBookings = Object.values(student.bookings);
    for (let nb of newBookings) {
      const isAlreadyBooked = existingBookings.some(eb => eb.date === nb.date && (eb.className === nb.className || eb.time === nb.className));
      if (isAlreadyBooked) {
        alert(`⚠️ 預約失敗！該學員已在 ${nb.date} 預約過【${nb.className}】，請勿重複預約。`);
        return;
      }
    }
  }

  let promises = newBookings.map(b => database.ref(`students/${studentId}/bookings`).push().set(b));

  Promise.all(promises).then(() => {
    alert(`成功預約 ${count} 堂課程！\n經手同事：${staffName}`);
    closeModal();
  });
}

function closeModal() {
  document.getElementById("booking-modal").style.display = "none";
}

// 匯出至 Excel
function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    alert("Excel 模組載入中，請稍後再試...");
    return;
  }

  let excelRows = [];

  Object.keys(studentsData).forEach(id => {
    const student = studentsData[id];
    const totalPackage = student.totalPackage || 0;
    const bookings = student.bookings || {};
    const bookedCount = Object.keys(bookings).length;
    const remainingCount = totalPackage - bookedCount;

    if (Object.keys(bookings).length === 0) {
      excelRows.push({
        "學員編號": id,
        "學員姓名": student.name,
        "身分類別": student.userType || "住戶",
        "付款狀態": student.payment || "",
        "總套票堂數": totalPackage,
        "已預約堂數": bookedCount,
        "剩餘堂數": remainingCount,
        "預約日期": "無預約",
        "預約班別": "-",
        "新增/續期同事": student.lastUpdatedBy || student.createdBy || "-",
        "預約/修改同事": "-"
      });
    } else {
      Object.keys(bookings).forEach(bKey => {
        const b = bookings[bKey];
        excelRows.push({
          "學員編號": id,
          "學員姓名": student.name,
          "身分類別": student.userType || "住戶",
          "付款狀態": student.payment || "",
          "總套票堂數": totalPackage,
          "已預約堂數": bookedCount,
          "剩餘堂數": remainingCount,
          "預約日期": b.date || "",
          "預約班別": b.className || b.time || "",
          "新增/續期同事": student.lastUpdatedBy || student.createdBy || "-",
          "預約/修改同事": b.updatedBy || b.createdBy || "-"
        });
      });
    }
  });

  const worksheet = XLSX.utils.json_to_sheet(excelRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "學員課表總表");

  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `網球課表紀錄_${today}.xlsx`);
}
