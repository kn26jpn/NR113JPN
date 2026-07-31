// ==========================================================================
// Configurations
// ==========================================================================
const SECRET_TOKEN = "YOUR_SECRET_TOKEN_HERE"; // 任意のセキュリティトークンに変更してください

// API Entry Point
function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    
    // トークンによるセキュリティ検証
    if (contents.token !== SECRET_TOKEN) {
      return responseJSON({ success: false, error: "Unauthorized access" });
    }

    const action = contents.action;
    let resultData = null;

    if (action === "getConfig") {
      resultData = getConfigData();
    } else if (action === "getData") {
      resultData = getMonthlyData(contents.year, contents.month);
    } else if (action === "addExpense") {
      resultData = addExpenseRow(contents);
    } else if (action === "addIncome") {
      resultData = addIncomeRow(contents);
    }

    return responseJSON({ success: true, data: resultData });
  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

// 共通レスポンス出力
function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================================================
// Business Logic
// ==========================================================================
function getConfigData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const getList = (sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];
    const values = sheet.getRange("A2:A" + sheet.getLastRow()).getValues();
    return values.flat().filter(String);
  };

  return {
    expenseCategories: getList("支出カテゴリー"),
    incomeCategories: getList("収入カテゴリー"),
    names: getList("名簿")
  };
}

function getMonthlyData(year, month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetPrefix = `${year}/${String(month).padStart(2, '0')}`;

  const parseSheet = (sheetName, mapFn) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
    
    return rows.map(mapFn).filter(row => {
      if (!row.date) return false;
      const d = new Date(row.date);
      if (isNaN(d.getTime())) return false;
      const dateStr = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      return dateStr === targetPrefix;
    });
  };

  // AMEXシート: A列(日付), C列(内容), F列(金額), I列(カテゴリー), J列(個人指定)
  const amex = parseSheet("AMEX", r => ({
    date: r[0], content: r[2], amount: r[5], category: r[8], name: r[9], payment: "AMEX", type: "expense"
  }));

  // 現金等シート: A列(日付), B列(カテゴリー), C列(内容), D列(支払方法), E列(金額), F列(名前)
  const cash = parseSheet("現金等", r => ({
    date: r[0], category: r[1], content: r[2], payment: r[3], amount: r[4], name: r[5], type: "expense"
  }));

  // 収入シート: A列(日付), B列(カテゴリー), C列(備考), D列(金額), E列(名前)
  const income = parseSheet("収入", r => ({
    date: r[0], category: r[1], content: r[2], amount: r[3], name: r[4], type: "income"
  }));

  // 日付順降順でソート
  return [...amex, ...cash, ...income].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function addExpenseRow(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("現金等");
  const formattedDate = data.date.replace(/-/g, "/");
  sheet.appendRow([formattedDate, data.category, data.content, data.payment, Number(data.amount), data.name || ""]);
  return { status: "created" };
}

function addIncomeRow(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("収入");
  const formattedDate = data.date.replace(/-/g, "/");
  sheet.appendRow([formattedDate, data.category, data.note, Number(data.amount), data.name || ""]);
  return { status: "created" };
}
