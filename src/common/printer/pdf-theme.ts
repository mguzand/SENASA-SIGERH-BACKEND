import { StyleDictionary, TDocumentDefinitions } from 'pdfmake/interfaces';

export const pdfStyles: StyleDictionary = {
  headerTitle: {
    fontSize: 12,
    bold: true,
    alignment: 'center',
  },
  title: {
    fontSize: 11,
    bold: true,
    alignment: 'right',
  },
  section: {
    fontSize: 8,
    bold: true,
    fillColor: '#d9eeee',
    margin: [4, 2, 4, 2],
  },
  subSection: {
    fontSize: 8,
    bold: true,
    italics: true,
    fillColor: '#f3eeee',
    margin: [4, 2, 4, 2],
  },
  label: {
    fontSize: 7,
    bold: true,
  },
  text: {
    fontSize: 7,
  },
  tableHeader: {
    fontSize: 7,
    bold: true,
  },
  amount: {
    fontSize: 7,
    alignment: 'right',
  },
  totalLabel: {
    fontSize: 8,
    bold: true,
  },
  totalAmount: {
    fontSize: 8,
    bold: true,
    alignment: 'right',
  },
};

export const defaultPdfConfig: Partial<TDocumentDefinitions> = {
  pageSize: 'A4',
  pageMargins: [28, 22, 28, 28],
  defaultStyle: {
    font: 'Roboto',
    fontSize: 8,
  },
  styles: pdfStyles,
};
