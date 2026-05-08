import { Injectable, Logger } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private client: JWT;
  private readonly ATTENDANCE_SHEET_NAME = 'Rekap Absensi';
  private readonly BASE_HEADERS = [
    'No.',
    'Nama Lengkap',
    'NIM',
    'Divisi',
    'Sub Divisi',
  ];

  private readonly TOTAL_HEADER = 'Total';

  constructor() {
    // Autentikasi menggunakan Service Account
    this.client = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  /**
   * Mendapatkan nama sheet berdasarkan sub-divisi (khusus tugas).
   */
  private getAssignmentSheetName(subDivisionName: string): string {
    // Normalisasi nama sub-divisi agar sesuai dengan sheet yang disiapkan user
    let normalizedName = subDivisionName.trim();

    // Pemetaan khusus (Case Sensitive di Database vs Keinginan User di Spreadsheet)
    if (normalizedName.toLowerCase() === 'ui/ux' || normalizedName.toLowerCase() === 'ui ux') {
      normalizedName = 'UI/UX';
    } else if (normalizedName.toLowerCase() === 'design grafis') {
      normalizedName = '3D';
    } else if (normalizedName.toLowerCase() === 'system') {
      normalizedName = 'System & Cloud';
    }

    return `Penilaian ${normalizedName}`;
  }

  /**
   * Pastikan sheet (tab) dengan nama tertentu ada.
   */
  async ensureSheet(spreadsheetId: string, sheetName: string) {
    const sheets = google.sheets({ version: 'v4', auth: this.client });
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    
    // Cari sheet secara case-insensitive agar lebih fleksibel
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title?.toLowerCase() === sheetName.toLowerCase(),
    );

    if (!sheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                  gridProperties: {
                    frozenRowCount: 1,
                    frozenColumnCount: 5,
                  },
                },
              },
            },
          ],
        },
      });
      return true;
    }
    return false;
  }

  /**
   * Menambahkan header kegiatan baru di kolom paling kanan jika belum ada.
   */
  async ensureActivityColumn(
    spreadsheetId: string,
    activityName: string,
    sheetName: string = this.ATTENDANCE_SHEET_NAME,
  ) {
    const sheets = google.sheets({ version: 'v4', auth: this.client });

    // 1. Dapatkan sheetId untuk formatting
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === sheetName,
    );
    const sheetId = sheet?.properties?.sheetId || 0;

    // 2. Ambil header saat ini
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
    });

    let headers = response.data.values?.[0] || [];

    // Jika header kosong atau belum diinisialisasi, buat header dasar
    if (headers.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:E1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [this.BASE_HEADERS] },
      });

      // Berikan format Premium pada header (Biru Gelap, Teks Putih, Center)
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                    },
                    horizontalAlignment: 'CENTER',
                    backgroundColor: { red: 0.2, green: 0.3, blue: 0.6 }, // Royal Blue
                  },
                },
                fields:
                  'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)',
              },
            },
            // Tambahkan Conditional Formatting untuk seluruh kolom absensi (F ke kanan)
            ...this.getConditionalFormattingRequests(sheetId, sheetName),
          ],
        },
      });

      headers = this.BASE_HEADERS;
    }

    // 3. Tambah kolom kegiatan jika belum ada (Gunakan pencarian yang lebih fleksibel/robust)
    const normalizedActivityName = activityName.trim();
    const existingIndex = headers.findIndex(
      (h) => h?.toString().trim() === normalizedActivityName,
    );

    if (existingIndex === -1) {
      // If Total header exists, insert new activity before Total so Total stays rightmost
      const totalIndex = headers.findIndex(
        (h) => h?.toString().trim() === this.TOTAL_HEADER,
      );
      let insertIndex = headers.length;
      if (totalIndex !== -1) {
        insertIndex = totalIndex;
      }

      // Use batchUpdate to insert an empty column at insertIndex, then set header
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: insertIndex,
                  endIndex: insertIndex + 1,
                },
                inheritFromBefore: false,
              },
            },
          ],
        },
      });

      const targetLetter = this.columnToLetter(insertIndex + 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${targetLetter}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[activityName]] },
      });

      // Format premium untuk header baru
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: insertIndex,
                  endColumnIndex: insertIndex + 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                    },
                    horizontalAlignment: 'CENTER',
                    backgroundColor: { red: 0.2, green: 0.3, blue: 0.6 },
                  },
                },
                fields:
                  'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)',
              },
            },
          ],
        },
      });

      // Ensure Total column exists and is rightmost
      await this.ensureTotalColumn(spreadsheetId, sheetName);
    }
  }

  /**
   * Ensure there's a Total column at the far right.
   */
  async ensureTotalColumn(
    spreadsheetId: string,
    sheetName: string = this.ATTENDANCE_SHEET_NAME,
  ) {
    const sheets = google.sheets({ version: 'v4', auth: this.client });
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`,
    });
    const headers = headerResponse.data.values?.[0] || [];
    const totalIndex = headers.findIndex(
      (h) => h?.toString().trim() === this.TOTAL_HEADER,
    );

    if (totalIndex === -1) {
      // Append Total at the end
      const nextColumnLetter = this.columnToLetter(headers.length + 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${nextColumnLetter}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[this.TOTAL_HEADER]] },
      });

      // Style Total header similarly
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === sheetName,
      );
      const sheetId = sheet?.properties?.sheetId || 0;

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: headers.length,
                  endColumnIndex: headers.length + 1,
                },
                cell: {
                  userEnteredFormat: {
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                    },
                    horizontalAlignment: 'CENTER',
                    backgroundColor: { red: 0.2, green: 0.3, blue: 0.6 },
                  },
                },
                fields:
                  'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)',
              },
            },
          ],
        },
      });
    }

    // After ensuring, recalculate totals
    await this.updateTotals(spreadsheetId, sheetName);
  }

  /**
   * Deletes an activity column by header name.
   */
  async deleteActivityColumn(
    spreadsheetId: string,
    activityName: string,
    sheetName: string = this.ATTENDANCE_SHEET_NAME,
  ) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: this.client });
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];
      const colIndex = headers.indexOf(activityName);
      if (colIndex === -1) return; // nothing to do

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === sheetName,
      );
      const sheetId = sheet?.properties?.sheetId || 0;

      // Delete the column
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'COLUMNS',
                  startIndex: colIndex,
                  endIndex: colIndex + 1,
                },
              },
            },
          ],
        },
      });

      // Recalculate totals after deletion
      await this.ensureTotalColumn(spreadsheetId, sheetName);
    } catch (error) {
      this.logger.error('Gagal menghapus kolom kegiatan', error);
    }
  }

  /**
   * Update multiple attendance cells in one go (batch update)
   */
  async batchUpdateAttendance(
    spreadsheetId: string,
    activityName: string,
    records: {
      nim: string;
      fullName: string;
      divisionName: string;
      subDivisionName: string;
      status: string;
    }[],
    sheetName: string = this.ATTENDANCE_SHEET_NAME,
  ) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: this.client });

      // 1. Pastikan kolom kegiatan ada
      await this.ensureActivityColumn(spreadsheetId, activityName, sheetName);

      // 2. Dapatkan headers untuk mencari index kolom
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];
      const normalizedActivityName = activityName.trim();
      const colIndex = headers.findIndex(
        (h) => h?.toString().trim() === normalizedActivityName,
      );

      if (colIndex === -1) {
        throw new Error(`Kolom "${activityName}" tidak ditemukan di spreadsheet.`);
      }

      const colLetter = this.columnToLetter(colIndex + 1);

      // 3. Ambil semua NIM yang sudah ada (Gunakan trim untuk konsistensi)
      const nimResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!C:C`,
      });
      const existingNims =
        nimResponse.data.values?.map((row) => row[0]?.toString().trim()) || [];

      const dataToUpdate: any[] = [];
      let nextAvailableRow = existingNims.length + 1;

      for (const record of records) {
        const normalizedNim = record.nim.trim();
        let rowIndex = existingNims.indexOf(normalizedNim);
        let targetRow;

        if (rowIndex === -1) {
          // User belum ada, buat baris baru
          targetRow = nextAvailableRow++;
          const no = targetRow - 1;
          dataToUpdate.push({
            range: `${sheetName}!A${targetRow}:E${targetRow}`,
            values: [
              [
                no,
                record.fullName,
                record.nim,
                record.divisionName,
                record.subDivisionName,
              ],
            ],
          });
          // Tambahkan ke existingNims agar tidak duplikat jika ada record yang sama dalam batch
          existingNims.push(normalizedNim);
        } else {
          targetRow = rowIndex + 1;
        }

        // Tambahkan update status
        dataToUpdate.push({
          range: `${sheetName}!${colLetter}${targetRow}`,
          values: [[record.status]],
        });
      }

      if (dataToUpdate.length > 0) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: dataToUpdate,
          },
        });

        // Terapkan format rata tengah untuk semua kolom status yang diupdate
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets?.find(
          (s) => s.properties?.title === sheetName,
        );
        const sheetId = sheet?.properties?.sheetId || 0;

        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId,
                    startRowIndex: 1, // Lewati header
                    startColumnIndex: colIndex,
                    endColumnIndex: colIndex + 1,
                  },
                  cell: {
                    userEnteredFormat: {
                      horizontalAlignment: 'CENTER',
                    },
                  },
                  fields: 'userEnteredFormat(horizontalAlignment)',
                },
              },
            ],
          },
        });

        // Update totals after batch update
        await this.updateTotals(spreadsheetId, sheetName);
      }
    } catch (error) {
      this.logger.error('Gagal batch update Google Sheets', error);
    }
  }

  /**
   * Sync nilai tugas ke Google Sheets berdasarkan sub-divisi secara massal (batch).
   */
  async batchUpdateAssignmentScores(
    spreadsheetId: string,
    subDivisionName: string,
    assignmentTitle: string,
    records: {
      nim: string;
      fullName: string;
      divisionName: string;
      subDivisionName: string;
      score: number;
    }[],
  ) {
    const sheetName = this.getAssignmentSheetName(subDivisionName);

    // 1. Pastikan sheet ada
    await this.ensureSheet(spreadsheetId, sheetName);

    // 2. Gunakan batchUpdateAttendance (generic) untuk update nilai
    await this.batchUpdateAttendance(
      spreadsheetId,
      assignmentTitle,
      records.map((r) => ({
        ...r,
        status: r.score.toString(),
      })),
      sheetName,
    );
  }

  private getConditionalFormattingRequests(
    sheetId: number,
    sheetName: string,
  ): any[] {
    if (sheetName === this.ATTENDANCE_SHEET_NAME) {
      const statuses = [
        {
          text: 'HADIR',
          bg: { red: 0.85, green: 0.92, blue: 0.83 },
          fg: { red: 0.24, green: 0.46, blue: 0.24 },
        },
        {
          text: 'ALFA',
          bg: { red: 0.95, green: 0.8, blue: 0.8 },
          fg: { red: 0.6, green: 0.1, blue: 0.1 },
        },
        {
          text: 'SAKIT',
          bg: { red: 1, green: 0.9, blue: 0.7 },
          fg: { red: 0.6, green: 0.4, blue: 0 },
        },
        {
          text: 'IZIN',
          bg: { red: 0.9, green: 0.9, blue: 1 },
          fg: { red: 0.1, green: 0.1, blue: 0.6 },
        },
      ];

      return statuses.map((status, index) => ({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 5 }],
            booleanRule: {
              condition: {
                type: 'TEXT_EQ',
                values: [{ userEnteredValue: status.text }],
              },
              format: {
                backgroundColor: status.bg,
                textFormat: { foregroundColor: status.fg, bold: true },
              },
            },
          },
          index: index,
        },
      }));
    } else {
      // Color scale for scores (Red to Green)
      return [
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 5 }],
              gradientRule: {
                minpoint: {
                  color: { red: 0.95, green: 0.8, blue: 0.8 },
                  type: 'NUMBER',
                  value: '0',
                },
                midpoint: {
                  color: { red: 1, green: 0.9, blue: 0.7 },
                  type: 'NUMBER',
                  value: '75',
                },
                maxpoint: {
                  color: { red: 0.85, green: 0.92, blue: 0.83 },
                  type: 'NUMBER',
                  value: '100',
                },
              },
            },
            index: 0,
          },
        },
      ];
    }
  }

  /**
   * Recalculates the Total column formulas for all users.
   */
  async updateTotals(
    spreadsheetId: string,
    sheetName: string = this.ATTENDANCE_SHEET_NAME,
  ) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: this.client });
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];

      const totalIndex = headers.findIndex(
        (h) => h?.toString().trim() === this.TOTAL_HEADER,
      );
      if (totalIndex === -1) {
        // If Total not present, ensure it exists
        await this.ensureTotalColumn(spreadsheetId, sheetName);
        return;
      }

      const activityStart = this.BASE_HEADERS.length; // zero-based index
      const activityEnd = totalIndex - 1; // inclusive

      if (activityEnd < activityStart) {
        // No activity columns, set totals to 0 for existing rows
        const nimResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!C:C`,
        });
        const rows = nimResponse.data.values?.length || 0;
        if (rows > 1) {
          const updates: sheets_v4.Schema$ValueRange[] = [];
          for (let r = 2; r <= rows; r++) {
            const colLetter = this.columnToLetter(totalIndex + 1);
            updates.push({
              range: `${sheetName}!${colLetter}${r}`,
              values: [[0]],
            });
          }
          if (updates.length) {
            await sheets.spreadsheets.values.batchUpdate({
              spreadsheetId,
              requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
            });
          }
        }
        return;
      }

      const startLetter = this.columnToLetter(activityStart + 1);
      const endLetter = this.columnToLetter(activityEnd + 1);

      // Get number of rows (NIM column)
      const nimResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!C:C`,
      });
      const existingNims = nimResponse.data.values?.map((r) => r[0]) || [];
      const rows = existingNims.length;

      const isAttendance = sheetName === this.ATTENDANCE_SHEET_NAME;

      const updates: sheets_v4.Schema$ValueRange[] = [];
      for (let i = 2; i <= rows; i++) {
        const formula = isAttendance
          ? `=COUNTIF(${startLetter}${i}:${endLetter}${i},"HADIR")`
          : `=AVERAGE(${startLetter}${i}:${endLetter}${i})`;
        const colLetter = this.columnToLetter(totalIndex + 1);
        updates.push({
          range: `${sheetName}!${colLetter}${i}`,
          values: [[formula]],
        });
      }

      if (updates.length) {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: { valueInputOption: 'USER_ENTERED', data: updates },
        });
      }
    } catch (error) {
      this.logger.error('Gagal memperbarui kolom Total', error);
    }
  }

  private columnToLetter(column: number): string {
    let temp,
      letter = '';
    while (column > 0) {
      temp = (column - 1) % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      column = (column - temp - 1) / 26;
    }
    return letter;
  }
}
