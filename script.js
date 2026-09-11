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
let currentSearchKeyword = ""; 

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

// 終極字串盲比清洗器：只保留英文與數字，全部轉小寫（例："星期六 Red Ball 0900-1000" -> "redball09001000"）
function getPureKey(str) {
  if (!str) return "";
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, "");
}

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
    alert("⚠️ 必須填寫經手同事姓名！");
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
      alert(`學員 ${name} (${studentId}) 續購成功！\n經手同事：${staffName}\n新增 ${inputPackage} 堂，總堂數：${updatedTotalPackage} 堂。`);
      document.getElementById("student-form").reset();
      document.getElementById("total-package").value = 10;
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
    });
  }
});

function executeSearch() {
  currentSearchKeyword = document.getElementById("search-student").value.trim();
  renderStudents();
}

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

// 修改預約
function submitEditBooking(studentId, bookingKey) {
  const newDate = document.getElementById("edit-booking-date").value;
  const classSelect = document.getElementById("edit-booking-class");
  const staffName = document.getElementById("edit-staff-name").value.trim();

  if (!staffName) {
    alert("⚠️ 必須填寫經手同事姓名！");
    return;
  }

  const selectedOpt = classSelect.options[classSelect.selectedIndex];
  const classText = selectedOpt ? selectedOpt.text : classSelect.value;
  const pureKey = getPureKey(classText);

  database.ref(`students/${studentId}/bookings`).once("value").then(snap => {
    const bookings = snap.val() || {};
    for (let key in bookings) {
      if (key === bookingKey) continue;
      const b = bookings[key];
      if (b.date === newDate && getPureKey(b.className || b.time) === pureKey) {
        alert(`⛔ 阻斷！該學員在 ${newDate} 已預約過相同班別。`);
        return;
      }
    }

    database.ref(`students/${studentId}/bookings/${bookingKey}`).update({
      date: newDate,
      className: classText,
      updatedBy: staffName,
      updatedAt: new Date().toLocaleString("zh-TW")
    }).then(() => {
      alert(`✅ 修改成功！`);
      closeModal();
    });
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
        <input type="date" id="row-date-${i}" onchange="handleRowDateChange(${i})" style="flex: 1; padding: 0.4rem;">
        <select id="row-class-${i}" style="flex: 1.5; padding: 0.4rem;">
          <option value="">請先選擇日期</option>
        </select>
      </div>
    `;
    container.appendChild(rowDiv);
  }
}

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
  } else {
    updateRowClassOptions(index);
  }
}

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

  if (availableClasses.length === 0) {
    classSelect.innerHTML = `<option value="">當日無課</option>`;
  } else {
    classSelect.innerHTML = availableClasses.map(c => `<option value="${weekdayName} ${c}">${c}</option>`).join("");
  }
}

// 核心提交：直接自 Firebase 提取實時歷史數據並阻斷重複
function submitMultipleBookings(studentId) {
  const count = parseInt(document.getElementById("booking-count").value, 10);
  const staffName = document.getElementById("booking-staff-name").value.trim();

  if (!staffName) {
    alert("⚠️ 必須填寫經手同事姓名！");
    document.getElementById("booking-staff-name").focus();
    return;
  }

  let formEntries = [];

  // 1. 讀取當前畫面輸入
  for (let i = 0; i < count; i++) {
    const dateVal = document.getElementById(`row-date-${i}`).value;
    const classElem = document.getElementById(`row-class-${i}`);
    const selectedOpt = classElem.options[classElem.selectedIndex];
    const classText = selectedOpt ? selectedOpt.text : classElem.value;

    if (!dateVal || !classText || classText.includes("請先選擇") || classText.includes("當日無課")) {
      alert(`⚠️ 第 ${i + 1} 堂預約資料未填寫完整！`);
      return;
    }

    formEntries.push({
      num: i + 1,
      date: dateVal,
      rawClass: classText,
      pureKey: getPureKey(classText)
    });
  }

  // 2. 表單內部相互比對 (100% 阻斷重複列)
  for (let i = 0; i < formEntries.length; i++) {
    for (let j = i + 1; j < formEntries.length; j++) {
      if (formEntries[i].date === formEntries[j].date && formEntries[i].pureKey === formEntries[j].pureKey) {
        alert(`⛔ 防呆阻斷！\n\n第 ${formEntries[i].num} 堂與第 ${formEntries[j].num} 堂重複預約：\n日期：${formEntries[i].date}\n班別：${formEntries[i].rawClass}`);
        return;
      }
    }
  }

  // 3. 直接對雲端 Firebase 發起查詢，確保歷史資料 100% 最新
  database.ref(`students/${studentId}/bookings`).once("value").then(snapshot => {
    const existingBookings = snapshot.val() || {};

    for (let entry of formEntries) {
      for (let key in existingBookings) {
        const eb = existingBookings[key];
        const dbPureKey = getPureKey(eb.className || eb.time);

        if (eb.date === entry.date && dbPureKey === entry.pureKey) {
          alert(`⛔ 防呆阻斷！\n\n該學員在 ${entry.date} 已有【${entry.rawClass}】的預約紀錄！`);
          return; // 終止寫入
        }
      }
    }

    // 4. 無重複才執行寫入
    let promises = formEntries.map(entry => {
      return database.ref(`students/${studentId}/bookings`).push().set({
        date: entry.date,
        className: entry.rawClass,
        createdBy: staffName,
        createdAt: new Date().toLocaleString("zh-TW")
      });
    });

    return Promise.all(promises).then(() => {
      alert(`✅ 成功預約 ${count} 堂課程！`);
      closeModal();
    });
  }).catch(err => {
    alert("系統錯誤：" + err.message);
  });
}

function closeModal() {
  document.getElementById("booking-modal").style.display = "none";
}

function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    alert("Excel 模組載入中，請稍後...");
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
