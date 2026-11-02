export class MockJsPDF {
  pages: number = 1;
  texts: string[] = [];
  tables: any[] = [];
  internal = {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
    },
  };
  lastAutoTable = { finalY: 50 };

  setFillColor() {}
  setDrawColor() {}
  rect() {}
  setTextColor() {}
  setFont() {}
  setFontSize() {}
  text(txt: any, ..._args: any[]) {
    if (Array.isArray(txt)) {
      this.texts.push(...txt.map(String));
    } else if (txt !== undefined && txt !== null) {
      this.texts.push(String(txt));
    }
  }
  splitTextToSize(text: string, _maxW?: number) {
    return [text];
  }
  addPage() {
    this.pages++;
  }
  setPage() {}
  getNumberOfPages() {
    return this.pages;
  }
  output(_type: string) {
    const tableTexts = this.tables.flatMap((t) => [
      JSON.stringify(t.head || []),
      JSON.stringify(t.body || []),
    ]);
    const content = ["%PDF-1.4 Mock PDF Document", ...this.texts, ...tableTexts].join("\n");
    return Buffer.from(content);
  }
}

export const jsPDF = MockJsPDF;
export default MockJsPDF;
