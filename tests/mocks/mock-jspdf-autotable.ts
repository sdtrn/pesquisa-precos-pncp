export default function autoTable(doc: any, options: any) {
  doc.lastAutoTable = { finalY: (options?.startY || 20) + 30 };
}
