// 重新改寫的批次預約提交函式（請覆蓋原有的 submitMultipleBookings）
function submitMultipleBookings(studentId) {
  const count = parseInt(document.getElementById("booking-count").value, 10);
  const staffName = document.getElementById("booking-staff-name").value.trim();

  if (!staffName) {
    alert("⚠️ 必須填寫經手同事姓名！請輸入處理同事名字。");
    document.getElementById("booking-staff-name").focus();
    return;
  }

  let rawList = [];

  // 第一步：直接讀取 DOM 畫面上「當前選中」的真實文字內容，避開 value 不一致問題
  for (let i = 0; i < count; i++) {
    const dateInput = document.getElementById(`row-date-${i}`);
    const classSelect = document.getElementById(`row-class-${i}`);

    if (!dateInput || !classSelect) continue;

    const dateVal = dateInput.value;
    // 優先取得 selectedIndex 的文字或 value
    const selectedOption = classSelect.options[classSelect.selectedIndex];
    const rawClassText = selectedOption ? selectedOption.text : classSelect.value;

    if (!dateVal || !rawClassText || rawClassText.includes("請先選擇") || rawClassText.includes("當日無課")) {
      alert(`⚠️ 第 ${i + 1} 堂預約資料不完整，請確認日期與班別！`);
      return;
    }

    // 將班別徹底標準化：移除「星期X」前綴、所有空格、統一轉小寫
    const normalizedClass = rawClassText
      .replace(/^星期[一二三四五六日]\s*/, "")
      .replace(/\s+/g, "")
      .toLowerCase();

    rawList.push({
      index: i + 1,
      date: dateVal,
      fullClassName: rawClassText,
      normalizedClass: normalizedClass
    });
  }

  // 第二步：彈窗內部的嚴格重複檢測 (兩兩比對)
  for (let i = 0; i < rawList.length; i++) {
    for (let j = i + 1; j < rawList.length; j++) {
      if (rawList[i].date === rawList[j].date && rawList[i].normalizedClass === rawList[j].normalizedClass) {
        const displayClassName = rawList[i].fullClassName.replace(/^星期[一二三四五六日]\s*/, "");
        alert(`❌ 阻斷預約！\n\n表單內第 ${rawList[i].index} 堂與第 ${rawList[j].index} 堂重複：\n日期：${rawList[i].date}\n班別：${displayClassName}\n\n請更正後再試！`);
        return; // 直接中斷，絕不寫入資料庫
      }
    }
  }

  // 第三步：比對資料庫歷史預約紀錄
  const student = studentsData[studentId];
  if (student && student.bookings) {
    const existingBookings = Object.values(student.bookings);
    for (let item of rawList) {
      const isDuplicateInDB = existingBookings.some(eb => {
        const ebRaw = eb.className || eb.time || "";
        const ebNormalized = ebRaw
          .replace(/^星期[一二三四五六日]\s*/, "")
          .replace(/\s+/g, "")
          .toLowerCase();
        return eb.date === item.date && ebNormalized === item.normalizedClass;
      });

      if (isDuplicateInDB) {
        const displayClassName = item.fullClassName.replace(/^星期[一二三四五六日]\s*/, "");
        alert(`❌ 阻斷預約！\n\n該學員在 ${item.date} 已有【${displayClassName}】的預約紀錄，無法重複預約！`);
        return; // 直接中斷
      }
    }
  }

  // 第四步：通過所有驗證後，準備寫入 Firebase
  let promises = rawList.map(item => {
    return database.ref(`students/${studentId}/bookings`).push().set({
      date: item.date,
      className: item.fullClassName,
      createdBy: staffName,
      createdAt: new Date().toLocaleString("zh-TW")
    });
  });

  Promise.all(promises).then(() => {
    alert(`✅ 成功預約 ${count} 堂課程！\n經手同事：${staffName}`);
    closeModal();
  }).catch(err => {
    alert("儲存失敗：" + err.message);
  });
}
