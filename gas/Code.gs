// ============================================================
//  おてつだいシール帳 — Google Apps Script バックエンド
// ============================================================
//
//  【セットアップ手順】
//  1. Google スプレッドシートを新規作成し、そのIDをここに貼る
//  2. このファイルを Apps Script エディタに貼り付ける
//  3. setupSpreadsheet() を一度だけ手動実行してシートを初期化する
//  4. [デプロイ] > [新しいデプロイ] > 種類:ウェブアプリ
//     アクセス:"全員" に設定してデプロイ
//  5. 発行されたURLを index.html の GAS_URL に貼り付ける
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
    // 構造: records[dateKey][userId] = [taskId, ...]
    const recordsSheet = ss.getSheetByName('Records');
    const records = {};
    if (recordsSheet) {
      const rows = recordsSheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (!rows[i][0]) continue;
        const dateKey = String(rows[i][0]);
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
    return respond_({ error: err.message }, true);
  }
}

// ------------------------------------------------------------
//  POST — シールの追加 / 削除
//  Body (JSON文字列):
//    追加: { "action": "add",    "dateKey": "2026-04-05", "userId": "u1", "taskId": "t1" }
//    削除: { "action": "remove", "dateKey": "2026-04-05", "userId": "u1", "taskId": "t1" }
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
      const timestamp = Utilities.formatDate(
        new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss'
      );
      recordsSheet.appendRow([dateKey, userId, taskId, timestamp]);

    } else if (action === 'remove') {
      const rows = recordsSheet.getDataRange().getValues();
      // 後ろから検索して最初に一致した行を削除
      for (let i = rows.length - 1; i >= 1; i--) {
        if (String(rows[i][0]) === dateKey &&
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
    return respond_({ status: 'error', message: err.message }, true);
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

  // Records シート
  let recordsSheet = ss.getSheetByName('Records');
  if (!recordsSheet) recordsSheet = ss.insertSheet('Records');
  recordsSheet.clearContents();
  recordsSheet.appendRow(['dateKey', 'userId', 'taskId', 'timestamp']);

  Logger.log('セットアップ完了！Tasks と Records シートを作りました。');
}
