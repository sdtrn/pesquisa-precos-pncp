export class MockJsPDF {
  pages: number = 1;
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
  text() {}
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
    return Buffer.from("%PDF-1.4 Mock PDF Document");
  }
}

export const jsPDF = MockJsPDF;
export default MockJsPDF;
