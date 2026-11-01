export class MockCell {
  value: any = null;
  font: any = null;
  fill: any = null;
  border: any = null;
  alignment: any = null;
  numFmt: string | null = null;
}

export class MockRow {
  number: number = 0;
  height: number = 0;
  cells: MockCell[] = [];

  constructor(values: any[] = []) {
    this.cells = values.map((v) => {
      const c = new MockCell();
      c.value = v;
      return c;
    });
  }

  getCell(colIdx: number) {
    while (this.cells.length < colIdx) {
      this.cells.push(new MockCell());
    }
    return this.cells[colIdx - 1];
  }

  eachCell(fn: (cell: MockCell, idx: number) => void) {
    this.cells.forEach((c, idx) => fn(c, idx + 1));
  }
}

export class MockWorksheet {
  columns: any[] = [];
  rows: MockRow[] = [];
  merged: any[] = [];
  name: string = "";
  options: any = null;

  constructor(name: string, options?: any) {
    this.name = name;
    this.options = options;
  }

  addRow(values: any[] = []) {
    const row = new MockRow(values);
    row.number = this.rows.length + 1;
    this.rows.push(row);
    return row;
  }

  mergeCells(...args: any[]) {
    this.merged.push(args);
  }

  getCell(ref: string) {
    const colLetter = ref.charAt(0).toUpperCase();
    const colIdx = colLetter.charCodeAt(0) - 64;
    const rowIdx = parseInt(ref.slice(1), 10) - 1;
    return this.rows[rowIdx]?.getCell(colIdx) || new MockCell();
  }

  eachRow(fn: (row: MockRow, rowNumber: number) => void) {
    this.rows.forEach((r, idx) => fn(r, idx + 1));
  }
}

export class MockWorkbook {
  creator: string = "";
  created: Date = new Date();
  worksheets: MockWorksheet[] = [];

  addWorksheet(name: string, options?: any) {
    const ws = new MockWorksheet(name, options);
    this.worksheets.push(ws);
    return ws;
  }

  getWorksheet(name: string) {
    return this.worksheets.find((w) => w.name === name);
  }

  xlsx = {
    writeBuffer: async () => {
      const json = JSON.stringify({
        worksheets: this.worksheets.map((w) => ({
          name: w.name,
          rows: w.rows.map((r) =>
            r.cells.map((c) => ({
              value: c.value,
              numFmt: c.numFmt,
              font: c.font,
            }))
          ),
        })),
      });
      return Buffer.from(json);
    },
    load: async (buffer: ArrayBuffer) => {
      const str = Buffer.from(buffer).toString("utf-8");
      try {
        const data = JSON.parse(str);
        this.worksheets = data.worksheets.map((w: any) => {
          const ws = new MockWorksheet(w.name);
          w.rows.forEach((r: any) => {
            const row = ws.addRow();
            r.forEach((c: any, i: number) => {
              const cell = row.getCell(i + 1);
              cell.value = c.value;
              cell.numFmt = c.numFmt;
              cell.font = c.font;
            });
          });
          return ws;
        });
      } catch {}
    },
  };
}

export default {
  Workbook: MockWorkbook,
};
