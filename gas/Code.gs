// ============================================================
//  おてつだいシール帳 — Google Apps Script バックエンド
// ============================================================

const SPREADSHEET_ID = '1tKJ18O1gBqIPImvcEBaTlj2Met9BojhRiSYy975JkI4';

// ------------------------------------------------------------
//  GET — タスクマスター＋記録データを返す
// ------------------------------------------------------------
function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // --- Tasks シート ---
    const tasksSheet = ss.getSheetByName('Tasks');
    const tasks = [];
    if (tasksSheet) {
      const rows = tasksSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][0]) continue;
        tasks.push({
          id:    String(rows[i][0]),
          name:  String(rows[i][1]),
          price: Number(rows[i][2]),
          icon:  String(rows[i][3]),
        });
      }
    }

    // --- Records シート ---
    const recordsSheet = ss.getSheetByName('Records');
    const records = {};
    if (recordsSheet) {
      const rows = recordsSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][0]) continue;
        const dateKey = toDateKeyStr_(rows[i][0]);
        const userId  = String(rows[i][1]);
        const taskId  = String(rows[i][2]);
        if (!records[dateKey])         records[dateKey] = {};
        if (!records[dateKey][userId]) records[dateKey][userId] = [];
        if (!records[dateKey][userId].includes(taskId)) {
          records[dateKey][userId].push(taskId);
        }
      }
    }

    return respond_({ tasks, records });

  } catch (err) {
    return respond_({ error: err.message });
  }
}

// ------------------------------------------------------------
//  POST — シールの追加 / 削除
// ------------------------------------------------------------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, dateKey, userId, taskId } = body;

    if (!action || !dateKey || !userId || !taskId) {
      throw new Error('必須パラメータが不足しています');
    }

    const ss           = SpreadsheetApp.openById(SPREADSHEET_ID);
    const recordsSheet = ss.getSheetByName('Records');
    if (!recordsSheet) throw new Error('Records シートが見つかりません');

    if (action === 'add') {
      // 重複チェック
      const existing = recordsSheet.getDataRange().getValues();
      const isDuplicate = existing.slice(1).some(row =>
        toDateKeyStr_(row[0]) === dateKey &&
        String(row[1]) === userId &&
        String(row[2]) === taskId
      );
      if (!isDuplicate) {
        const timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
        const newRow = recordsSheet.getLastRow() + 1;
        // ★ 列A〜Dをテキスト形式で書き込む（日付自動変換を防ぐ）
        const range = recordsSheet.getRange(newRow, 1, 1, 4);
        range.setNumberFormats([['@', '@', '@', '@']]);
        range.setValues([[dateKey, userId, taskId, timestamp]]);
      }

    } else if (action === 'remove') {
      const rows = recordsSheet.getDataRange().getValues();
      for (let i = rows.length - 1; i >= 1; i--) {
        if (toDateKeyStr_(rows[i][0]) === dateKey &&
            String(rows[i][1]) === userId  &&
            String(rows[i][2]) === taskId) {
          recordsSheet.deleteRow(i + 1);
          break;
        }
      }

    } else {
      throw new Error('不明なアクション: ' + action);
    }

    return respond_({ status: 'success' });

  } catch (err) {
    return respond_({ status: 'error', message: err.message });
  }
}

// ------------------------------------------------------------
//  ヘルパー: JSON レスポンスを返す
// ------------------------------------------------------------
function respond_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
//  ヘルパー: セル値を yyyy-MM-dd 文字列に変換
//  （Sheetsが日付文字列をDate型に自動変換するため）
// ------------------------------------------------------------
function toDateKeyStr_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  return String(val);
}

// ------------------------------------------------------------
//  既存データの dateKey を修復する（一度だけ手動実行）
//  Records シートに日付型で保存されてしまったデータを
//  テキスト形式の "yyyy-MM-dd" に書き直します
// ------------------------------------------------------------
function fixRecordsDates() {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Records');
  if (!sheet) { Logger.log('Records シートが見つかりません'); return; }

  const data = sheet.getDataRange().getValues();
  // 列A全体をテキスト形式に変更
  sheet.getRange('A:A').setNumberFormat('@');

  let fixed = 0;
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const fixedDate = toDateKeyStr_(data[i][0]);
    sheet.getRange(i + 1, 1).setValue(fixedDate);
    fixed++;
  }
  Logger.log(`修正完了！ ${fixed} 件のdateKeyを修正しました。`);
}

// ------------------------------------------------------------
//  初期セットアップ（一度だけ手動実行してください）
// ------------------------------------------------------------
function setupSpreadsheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Tasks シート
  let tasksSheet = ss.getSheetByName('Tasks');
  if (!tasksSheet) tasksSheet = ss.insertSheet('Tasks');
  tasksSheet.clearContents();
  tasksSheet.appendRow(['id', 'name', 'price', 'icon']);
  tasksSheet.appendRow(['t1', 'しょっきあらい',   50,  '🍽️']);
  tasksSheet.appendRow(['t2', 'おふろそうじ',     100, '🛁']);
  tasksSheet.appendRow(['t3', 'そうじきがけ',      80, '🧹']);
  tasksSheet.appendRow(['t4', 'せんたくたたみ',    60, '👕']);

  // Records シート（列Aをテキスト形式に設定）
  let recordsSheet = ss.getSheetByName('Records');
  if (!recordsSheet) recordsSheet = ss.insertSheet('Records');
  recordsSheet.clearContents();
  recordsSheet.getRange('A:A').setNumberFormat('@');
  recordsSheet.appendRow(['dateKey', 'userId', 'taskId', 'timestamp']);

  Logger.log('セットアップ完了！');
}
