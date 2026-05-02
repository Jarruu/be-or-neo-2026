import { Injectable, Logger } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private client: JWT;
  private readonly SHEET_NAME = 'Rekap Absensi';
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
   * Menambahkan header kegiatan baru di kolom paling kanan jika belum ada.
   */
  async ensureActivityColumn(spreadsheetId: string, activityName: string) {
    const sheets = google.sheets({ version: 'v4', auth: this.client });

    // 1. Dapatkan sheetId untuk formatting
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === this.SHEET_NAME,
    );
    const sheetId = sheet?.properties?.sheetId || 0;

    // 2. Ambil header saat ini
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${this.SHEET_NAME}!1:1`,
    });

    let headers = response.data.values?.[0] || [];

    // Jika header kosong atau belum diinisialisasi, buat header dasar
    if (headers.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${this.SHEET_NAME}!A1:E1`,
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
            ...this.getConditionalFormattingRequests(sheetId),
          ],
        },
      });

      headers = this.BASE_HEADERS;
    }

    // 3. Tambah kolom kegiatan jika belum ada
    if (!headers.includes(activityName)) {
      // If Total header exists, insert new activity before Total so Total stays rightmost
      const totalIndex = headers.indexOf(this.TOTAL_HEADER);
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
        range: `${this.SHEET_NAME}!${targetLetter}1`,
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
      await this.ensureTotalColumn(spreadsheetId);
    }
  }

  /**
   * Ensure there's a Total column at the far right.
   */
  async ensureTotalColumn(spreadsheetId: string) {
    const sheets = google.sheets({ version: 'v4', auth: this.client });
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${this.SHEET_NAME}!1:1`,
    });
    const headers = headerResponse.data.values?.[0] || [];
    const totalIndex = headers.indexOf(this.TOTAL_HEADER);

    if (totalIndex === -1) {
      // Append Total at the end
      const nextColumnLetter = this.columnToLetter(headers.length + 1);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${this.SHEET_NAME}!${nextColumnLetter}1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[this.TOTAL_HEADER]] },
      });

      // Style Total header similarly
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === this.SHEET_NAME,
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
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                    horizontalAlignment: 'CENTER',
                    backgroundColor: { red: 0.2, green: 0.3, blue: 0.6 },
                  },
                },
                fields: 'userEnteredFormat(textFormat,horizontalAlignment,backgroundColor)',
              },
            },
          ],
        },
      });
    }

    // After ensuring, recalculate totals
    await this.updateTotals(spreadsheetId);
  }

  /**
   * Deletes an activity column by header name.
   */
  async deleteActivityColumn(spreadsheetId: string, activityName: string) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: this.client });
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${this.SHEET_NAME}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];
      const colIndex = headers.indexOf(activityName);
      if (colIndex === -1) return; // nothing to do

      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === this.SHEET_NAME,
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
      await this.ensureTotalColumn(spreadsheetId);
    } catch (error) {
      this.logger.error('Gagal menghapus kolom kegiatan', error);
    }
  }

  /**
   * Clear a single attendance cell (user + activity) — set to empty value.
   */
  async clearAttendanceCell(spreadsheetId: string, activityName: string, nim: string) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: this.client });
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${this.SHEET_NAME}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];
      const colIndex = headers.indexOf(activityName);
      if (colIndex === -1) return; // activity column not found

      // Find row by NIM
      const nimResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${this.SHEET_NAME}!C:C`,
      });
      const nims = nimResponse.data.values?.map((r) => r[0]) || [];
      const rowIndex = nims.indexOf(nim);
      if (rowIndex === -1) return; // user row not found

      const rowNumber = rowIndex + 1; // 1-indexed
      const colLetter = this.columnToLetter(colIndex + 1);

      // Set the cell to 'ALFA' (mark as absent) instead of empty
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${this.SHEET_NAME}!${colLetter}${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['ALFA']] },
      });

      // Apply same formatting as regular updates (center alignment)
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === this.SHEET_NAME,
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
                  startRowIndex: rowNumber - 1,
                  endRowIndex: rowNumber,
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

      // Recalculate totals after clearing
      await this.updateTotals(spreadsheetId);
    } catch (error) {
      this.logger.error('Gagal membersihkan sel absensi', error);
    }
  }

  /**
   * Mencari baris user berdasarkan NIM, jika tidak ada maka buat baris baru dengan info lengkap.
   */
  async ensureUserRow(
    spreadsheetId: string,
    nim: string,
    fullName: string,
    divisionName: string,
    subDivisionName: string,
  ) {
    const sheets = google.sheets({ version: 'v4', auth: this.client });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${this.SHEET_NAME}!C:C`, // NIM sekarang di kolom C
    });

    const nims = response.data.values?.map((row) => row[0]) || [];
    const rowIndex = nims.indexOf(nim);

    if (rowIndex === -1) {
      const nextRow = nims.length + 1;
      const no = nims.length; // Nomor urut (nims sudah termasuk header di index 0)

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${this.SHEET_NAME}!A${nextRow}:E${nextRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[no, fullName, nim, divisionName, subDivisionName]],
        },
      });
      return nextRow;
    }

    return rowIndex + 1; // Return nomor baris (1-indexed)
  }

  /**
   * Update status di sel tertentu (Pertemuan antara Baris User dan Kolom Kegiatan)
   */
  async updateAttendanceCell(
    spreadsheetId: string,
    data: {
      nim: string;
      fullName: string;
      divisionName: string;
      subDivisionName: string;
      activityName: string;
      status: string;
    },
  ) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: this.client });

      // 1. Pastikan kolom kegiatan ada dan dapatkan indexnya
      await this.ensureActivityColumn(spreadsheetId, data.activityName);
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${this.SHEET_NAME}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];
      const colIndex = headers.indexOf(data.activityName);
      const colLetter = this.columnToLetter(colIndex + 1);

      // 2. Dapatkan baris user (dengan data lengkap)
      const rowIndex = await this.ensureUserRow(
        spreadsheetId,
        data.nim,
        data.fullName,
        data.divisionName,
        data.subDivisionName,
      );

      // 3. Update Sel + Styling (Center & Border)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${this.SHEET_NAME}!${colLetter}${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[data.status]] },
      });

      // Berikan format rata tengah untuk sel tersebut
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheet = spreadsheet.data.sheets?.find(
        (s) => s.properties?.title === this.SHEET_NAME,
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
                  startRowIndex: rowIndex - 1,
                  endRowIndex: rowIndex,
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

      // Update totals after updating a single cell
      await this.updateTotals(spreadsheetId);
    } catch (error) {
      this.logger.error('Gagal update sel Google Sheets', error);
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
  ) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: this.client });

      // 1. Pastikan kolom kegiatan ada
      await this.ensureActivityColumn(spreadsheetId, activityName);

      // 2. Dapatkan headers untuk mencari index kolom
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${this.SHEET_NAME}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];
      const colIndex = headers.indexOf(activityName);
      const colLetter = this.columnToLetter(colIndex + 1);

      // 3. Ambil semua NIM yang sudah ada
      const nimResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${this.SHEET_NAME}!C:C`,
      });
      const existingNims = nimResponse.data.values?.map((row) => row[0]) || [];

      const dataToUpdate: any[] = [];
      let nextAvailableRow = existingNims.length + 1;

      for (const record of records) {
        let rowIndex = existingNims.indexOf(record.nim);
        let targetRow;

        if (rowIndex === -1) {
          // User belum ada, buat baris baru
          targetRow = nextAvailableRow++;
          const no = targetRow - 1;
          dataToUpdate.push({
            range: `${this.SHEET_NAME}!A${targetRow}:E${targetRow}`,
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
          existingNims.push(record.nim);
        } else {
          targetRow = rowIndex + 1;
        }

        // Tambahkan update status
        dataToUpdate.push({
          range: `${this.SHEET_NAME}!${colLetter}${targetRow}`,
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
          (s) => s.properties?.title === this.SHEET_NAME,
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
        await this.updateTotals(spreadsheetId);
      }
    } catch (error) {
      this.logger.error('Gagal batch update Google Sheets', error);
    }
  }

  private getConditionalFormattingRequests(sheetId: number): any[] {
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
          ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 5 }], // Kolom F ke kanan
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
  }

  /**
   * Recalculates the Total column formulas for all users.
   */
  async updateTotals(spreadsheetId: string) {
    try {
      const sheets = google.sheets({ version: 'v4', auth: this.client });
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${this.SHEET_NAME}!1:1`,
      });
      const headers = headerResponse.data.values?.[0] || [];

      const totalIndex = headers.indexOf(this.TOTAL_HEADER);
      if (totalIndex === -1) {
        // If Total not present, ensure it exists
        await this.ensureTotalColumn(spreadsheetId);
        return;
      }

      const activityStart = this.BASE_HEADERS.length; // zero-based index
      const activityEnd = totalIndex - 1; // inclusive

      if (activityEnd < activityStart) {
        // No activity columns, set totals to 0 for existing rows
        const nimResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${this.SHEET_NAME}!C:C`,
        });
        const rows = nimResponse.data.values?.length || 0;
        if (rows > 1) {
          const updates: sheets_v4.Schema$ValueRange[] = [];
          for (let r = 2; r <= rows; r++) {
            const colLetter = this.columnToLetter(totalIndex + 1);
            updates.push({
              range: `${this.SHEET_NAME}!${colLetter}${r}`,
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
        range: `${this.SHEET_NAME}!C:C`,
      });
      const existingNims = nimResponse.data.values?.map((r) => r[0]) || [];
      const rows = existingNims.length;

      const updates: sheets_v4.Schema$ValueRange[] = [];
      for (let i = 2; i <= rows; i++) {
        const formula = `=COUNTIF(${startLetter}${i}:${endLetter}${i},"HADIR")`;
        const colLetter = this.columnToLetter(totalIndex + 1);
        updates.push({
          range: `${this.SHEET_NAME}!${colLetter}${i}`,
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
