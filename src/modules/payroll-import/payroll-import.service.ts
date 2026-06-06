import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import pdfParse from 'pdf-parse';

import { PayrollImport } from './entities/payroll-import.entity';
import { PayrollImportError } from './entities/payroll-import-error.entity';
import { EmployeePaymentReceipt } from './entities/employee-payment-receipt.entity';
import { EmployeePaymentReceiptItem } from './entities/employee-payment-receipt-item.entity';
import { EmployeesService } from '../employees/employees.service';
import { DeepPartial } from 'typeorm';
import { PayrollItemType } from './enum/payroll-item-type.enum';
import { PrinterService } from 'src/common/printer/printer.service';
import { PayrollVoucherReport } from './reports/payroll-voucher.report';

@Injectable()
export class PayrollImportService {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(PayrollImport)
    private readonly payrollImportRepository: Repository<PayrollImport>,

    private readonly employeeRepository: EmployeesService,
    private readonly printerService: PrinterService,

    @InjectRepository(EmployeePaymentReceipt)
    private readonly employeePaymentReceiptRepository: Repository<EmployeePaymentReceipt>,
  ) {}

  async generateVoucherPdf(receiptId: string) {
    const receipt = await this.employeePaymentReceiptRepository.findOne({
      where: { id: receiptId },
      relations: {
        employee: true,
        items: true,
      },
    });

    if (!receipt) {
      throw new NotFoundException('Comprobante de pago no encontrado');
    }

    const deductions = receipt.items.filter(
      (item) => item.itemType === PayrollItemType.DEDUCTION,
    );

    const withholdings = receipt.items.filter(
      (item) => item.itemType === PayrollItemType.WITHHOLDING,
    );

    const docDefinition = await PayrollVoucherReport({
      id: receipt.id,
      documentNumber: receipt.documentNumber,

      year: receipt.year,
      month: receipt.month,

      employeeName: receipt.employeeNameFromFile,
      identity: `HN - TID ${receipt.identityNumber}`,

      payrollType:
        `${receipt.payrollClass ?? ''} ${receipt.payrollType ?? ''}`.trim(),

      ordinarySalary: Number(receipt.ordinarySalary),
      increments: Number(receipt.increments),
      seniority: Number(receipt.seniority),
      integralSalary: Number(receipt.integralSalary),
      netSalary: Number(receipt.netSalary),

      amountInWords: receipt.amountInWords,
      bankName: receipt.bankName,
      bankAccount: receipt.bankAccount,

      deductions,
      withholdings,

      deductionsTotal: Number(receipt.deductionsTotal),
      withholdingsTotal: Number(receipt.withholdingsTotal),
      totalDeductionsWithholdings:
        Number(receipt.deductionsTotal) + Number(receipt.withholdingsTotal),

      validationUrl: `https://sigerh.senasa.gob.hn/validar-comprobante/${receipt.id}`,

      printedAt: new Date().toLocaleString('es-HN', {
        timeZone: 'America/Tegucigalpa',
      }),
    });

    return this.printerService.createPdf(docDefinition);
  }

  async processPayrollPdf({
    file,
    userId,
  }: {
    file: Express.Multer.File;
    userId?: string;
  }) {
    if (!file?.buffer) {
      throw new BadRequestException('No se pudo leer el archivo PDF');
    }

    const parsedPdf = await pdfParse(file.buffer);
    const pages = this.splitPdfPages(parsedPdf.text);

    if (!pages.length) {
      throw new BadRequestException('No se encontraron comprobantes en el PDF');
    }

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const payrollImport = queryRunner.manager.create(PayrollImport, {
        fileName: file.originalname,
        uploadedBy: userId ?? null,
        status: 'PROCESSING',
      });

      const savedImport = await queryRunner.manager.save(payrollImport);

      let inserted = 0;
      let errors = 0;

      for (let index = 0; index < pages.length; index++) {
        const pageText = pages[index];

        try {
          const basicData = this.extractBasicPageData(pageText);
          const summary = this.extractSalarySummary(pageText);
          const items = this.extractItems(pageText);

          const employee = await this.employeeRepository.findByDni(
            basicData.identityNumber,
          );

          console.log(basicData.identityNumber, employee);

          if (!employee) {
            errors++;

            await queryRunner.manager.save(
              queryRunner.manager.create(PayrollImportError, {
                payrollImportId: savedImport.id,
                pageNumber: index + 1,
                identityNumber: basicData.identityNumber,
                employeeNameFromFile: basicData.employeeNameFromFile,
                errorMessage: 'Empleado no encontrado por identidad',
                rawText: pageText,
              }),
            );

            continue;
          }

          const receiptData: DeepPartial<EmployeePaymentReceipt> = {
            payrollImportId: savedImport.id,
            employeeId: employee.id,

            identityNumber: basicData.identityNumber,
            employeeNameFromFile: basicData.employeeNameFromFile,

            month: basicData.month ?? null,
            year: summary.year ?? null,

            payrollClass: basicData.payrollClass ?? null,
            payrollType: basicData.payrollType ?? null,

            ordinarySalary: summary.ordinarySalary ?? 0,
            increments: summary.increments ?? 0,
            seniority: summary.seniority ?? 0,
            variableSalariesTotal: summary.variableSalariesTotal ?? 0,
            bonusesTotal: summary.bonusesTotal ?? 0,
            integralSalary: summary.integralSalary ?? 0,
            deductionsTotal: summary.deductionsTotal ?? 0,
            withholdingsTotal: summary.withholdingsTotal ?? 0,
            netSalary: summary.netSalary ?? 0,

            amountInWords: summary.amountInWords ?? '',
            documentNumber: summary.documentNumber ?? null,
            bankName: summary.bankName ?? null,
            bankAccount: summary.bankAccount ?? null,

            rawPageText: pageText ?? null,
          };

          const receipt = queryRunner.manager.create(
            EmployeePaymentReceipt,
            receiptData,
          );

          const savedReceipt = await queryRunner.manager.save(receipt);

          if (items.length > 0) {
            const receiptItems = items.map((item) =>
              queryRunner.manager.create(EmployeePaymentReceiptItem, {
                receiptId: savedReceipt.id,
                itemType: item.itemType,
                code: item.code,
                description: item.description,
                amount: item.amount,
              }),
            );

            await queryRunner.manager.save(receiptItems);
          }

          inserted++;
        } catch (error) {
          console.log(error);
          errors++;

          await queryRunner.manager.save(
            queryRunner.manager.create(PayrollImportError, {
              payrollImportId: savedImport.id,
              pageNumber: index + 1,
              errorMessage: error.message ?? 'Error procesando página',
              rawText: pageText,
            }),
          );
        }
      }

      savedImport.status = errors > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';
      await queryRunner.manager.save(savedImport);

      await queryRunner.commitTransaction();
      // await queryRunner.rollbackTransaction();

      return {
        message: 'Archivo procesado correctamente',
        payrollImportId: savedImport.id,
        totalPages: pages.length,
        inserted,
        errors,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private splitPdfPages(text: string): string[] {
    return text
      .split(/(?=COMPROBANTE DE PAGO)/g)
      .map((page) => page.trim())
      .filter((page) => page.includes('Funcionario:'))
      .filter((page) => page.includes('Identidad:'));
  }

  private extractBasicPageData(text: string) {
    const normalizedText = text
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    const lines = normalizedText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    let identityNumber: string | null = null;
    let employeeNameFromFile: string | null = null;

    /**
     * Caso normal:
     * Identidad: HN - TID 0803197100061
     */
    const normalIdentityMatch =
      normalizedText.match(/Identidad:\s*HN\s*-\s*TID\s*(\d{13})/i) ||
      normalizedText.match(/Identidad:[\s\S]*?HN\s*TID[\s\S]*?(\d{13})/i) ||
      normalizedText.match(/TID\s*(\d{13})/i);

    if (normalIdentityMatch) {
      identityNumber = normalIdentityMatch[1];
    }

    /**
     * Caso real del PDF parseado:
     *
     * Funcionario:
     * 0801199412548
     * Identidad: STEPHANNY RAQUEL ALVARADO LANZA
     * HNTID
     * -
     */
    if (!identityNumber) {
      for (let i = 0; i < lines.length; i++) {
        if (/^Identidad:/i.test(lines[i])) {
          const previousLine = lines[i - 1];

          if (previousLine && /^\d{13}$/.test(previousLine)) {
            identityNumber = previousLine;
          }

          employeeNameFromFile = lines[i]
            .replace(/^Identidad:\s*/i, '')
            .replace(/\s+/g, ' ')
            .trim();

          break;
        }
      }
    }

    /**
     * Caso nombre normal:
     * Funcionario: 1044459435 NOMBRE COMPLETO Identidad:
     */
    if (!employeeNameFromFile) {
      const employeeMatch = normalizedText.match(
        /Funcionario:\s*\d+\s+([\s\S]*?)\s+Identidad:/i,
      );

      employeeNameFromFile =
        employeeMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
    }

    /**
     * Clase / Tipo Planilla puede venir:
     * Clase / Tipo Planilla: Complementaria PERMANENTE Mes: MAYO
     *
     * o parseado así:
     * ComplementariaPERMANENTE
     * Clase / Tipo Planilla:
     * MAYOMes:
     */
    let payrollClass: string | null = null;
    let payrollType: string | null = null;
    let month: string | null = null;

    const normalPayrollMatch = normalizedText.match(
      /Clase\s*\/\s*Tipo\s*Planilla:\s*([\s\S]*?)\s+Mes:\s*([A-ZÁÉÍÓÚÑ]+)/i,
    );

    if (normalPayrollMatch) {
      const payrollClassType = normalPayrollMatch[1]
        .replace(/\s+/g, ' ')
        .trim();

      const parts = payrollClassType.split(/\s+/);

      payrollClass = parts[0] ?? null;
      payrollType = parts.slice(1).join(' ') || null;
      month = normalPayrollMatch[2]?.trim() ?? null;
    } else {
      const payrollLabelIndex = lines.findIndex((line) =>
        /^Clase\s*\/\s*Tipo\s*Planilla:/i.test(line),
      );

      if (payrollLabelIndex > 0) {
        const previousLine = lines[payrollLabelIndex - 1];

        if (/Complementaria/i.test(previousLine)) {
          payrollClass = 'Complementaria';
          payrollType =
            previousLine.replace(/Complementaria/i, '').trim() || null;
        }

        if (/Mensual/i.test(previousLine)) {
          payrollClass = 'Mensual';
          payrollType = previousLine.replace(/Mensual/i, '').trim() || null;
        }
      }

      const monthLine = lines.find((line) => /^[A-ZÁÉÍÓÚÑ]+Mes:$/i.test(line));

      if (monthLine) {
        month = monthLine.replace(/Mes:$/i, '').trim();
      }
    }

    if (!identityNumber) {
      console.log('===== TEXTO SIN IDENTIDAD =====');
      console.log(normalizedText.substring(0, 1600));
      console.log('===============================');

      throw new BadRequestException('No se encontró identidad del empleado');
    }

    return {
      identityNumber,
      employeeNameFromFile,
      payrollClass,
      payrollType,
      month,
    };
  }

  private extractSalarySummary(text: string) {
    const yearMatch = text.match(/Gestión:\s*(\d{4})/i);
    const documentMatch = text.match(/Nro Documento:\s*(\d+)/i);

    const resumeMatch = text.match(
      /Salario Ordinario Incrementos \(\+\) Antigüedad \(\+\) Salarios Variables \(\+\) Bonos \(\+\) Salario Integral[\s\S]*?([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})/i,
    );

    const ordinarySalary = resumeMatch
      ? this.toNumber(resumeMatch[1])
      : this.extractAmountBeforeLabel(text, 'Salario Ordinario');

    const increments = resumeMatch
      ? this.toNumber(resumeMatch[2])
      : this.extractAmountBeforeLabel(text, 'Incrementos');

    const seniority = resumeMatch
      ? this.toNumber(resumeMatch[3])
      : this.extractAmountBeforeLabel(text, 'Antiguedad');

    const variableSalariesTotal = resumeMatch
      ? this.toNumber(resumeMatch[4])
      : 0;

    const bonusesTotal = resumeMatch ? this.toNumber(resumeMatch[5]) : 0;

    const integralSalary = resumeMatch
      ? this.toNumber(resumeMatch[6])
      : this.extractAmountBeforeLabel(text, 'Salario Integral');

    const deductionsTotalMatch = text.match(
      /Deducciones\(-\)[\s\S]*?([\d,]+\.\d{2})\s*Salario Neto:/i,
    );

    const netSalaryMatch = text.match(/Salario Neto:\s*([\d,]+\.\d{2})/i);

    const withholdingsTotalMatch = text.match(
      /Salario Neto:\s*[\d,]+\.\d{2}\s+([\d,]+\.\d{2})/i,
    );

    const amountWordsMatch = text.match(/SON:\s*([A-ZÁÉÍÓÚÑ\s]+?\d{2}\/100)/i);

    const bankMatch = text.match(/Banco:\s*(.+?)\s+Cuenta:\s*([^\n]+)/i);

    return {
      year: yearMatch ? Number(yearMatch[1]) : null,
      documentNumber: documentMatch?.[1] ?? null,

      ordinarySalary,
      increments,
      seniority,
      variableSalariesTotal,
      bonusesTotal,
      integralSalary,

      deductionsTotal: deductionsTotalMatch
        ? this.toNumber(deductionsTotalMatch[1])
        : 0,

      withholdingsTotal: withholdingsTotalMatch
        ? this.toNumber(withholdingsTotalMatch[1])
        : 0,

      netSalary: netSalaryMatch
        ? this.toNumber(netSalaryMatch[1])
        : this.extractAmountBeforeLabel(text, 'Salario Neto'),

      amountInWords:
        amountWordsMatch?.[1]?.replace(/\s+/g, ' ').replace(/-/g, '').trim() ??
        null,

      bankName: bankMatch?.[1]?.trim() ?? null,
      bankAccount: bankMatch?.[2]?.trim() ?? null,
    };
  }

  private extractItems(text: string) {
    const items: any[] = [];

    items.push(...this.extractDeductions(text));
    items.push(...this.extractWithholdings(text));

    return items.filter((item) => item.amount > 0);
  }

  private extractWithholdings(text: string) {
    const blockMatch = text.match(/RETENCIONES([\s\S]*?)Versión/i);

    if (!blockMatch) return [];

    const block = blockMatch[1];

    const codes = [...block.matchAll(/^\s*(\d{3,5})\s*$/gm)].map((m) => m[1]);

    const amounts = [...block.matchAll(/^\s*([\d,]+\.\d{2})\s*$/gm)]
      .map((m) => this.toNumber(m[1]))
      .filter((amount) => amount > 0);

    let descriptions = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^\d{3,5}$/.test(line))
      .filter((line) => !/^[\d,]+\.\d{2}$/.test(line))
      .filter((line) => !/^Total:/i.test(line))
      .filter((line) => !/^-$/.test(line));

    descriptions = this.mergeDescriptionsByAmountCount(
      descriptions,
      amounts.length,
    );

    return amounts.map((amount, index) => ({
      itemType: PayrollItemType.WITHHOLDING,
      code: codes[index] ?? null,
      description: descriptions[index] ?? 'SIN DESCRIPCIÓN',
      amount,
    }));
  }

  private mergeDescriptionsByAmountCount(
    descriptions: string[],
    expectedLength: number,
  ): string[] {
    const result: string[] = [];

    for (const line of descriptions) {
      if (result.length < expectedLength) {
        result.push(line);
      } else {
        result[result.length - 1] =
          `${result[result.length - 1]} ${line}`.trim();
      }
    }

    return result;
  }

  private extractDeductions(text: string) {
    const codeBlockMatch = text.match(
      /SALARIOS VARIABLES([\s\S]*?)DEDUCCIONES/i,
    );

    const detailBlockMatch = text.match(/DEDUCCIONES([\s\S]*?)RETENCIONES/i);

    if (!codeBlockMatch || !detailBlockMatch) {
      return [];
    }

    const codes = [...codeBlockMatch[1].matchAll(/^\s*(\d{3,5})\s*$/gm)].map(
      (match) => match[1],
    );

    const detailBlock = detailBlockMatch[1];

    const amounts = [...detailBlock.matchAll(/^\s*([\d,]+\.\d{2})\s*$/gm)]
      .map((match) => this.toNumber(match[1]))
      .filter((amount) => amount > 0);

    let descriptions = detailBlock
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^\d{3,5}$/.test(line))
      .filter((line) => !/^[\d,]+\.\d{2}$/.test(line))
      .filter((line) => !/^Total:/i.test(line))
      .filter((line) => !/^-$/.test(line));

    /**
     * Caso especial:
     *
     * ASOCIACION NACIONAL DE EMPLEADOS PUBLICOS DE HONDURAS
     * ANDEPH
     *
     * debe quedar una sola descripción
     */
    descriptions = descriptions.reduce((acc, current) => {
      if (
        current === 'ANDEPH' &&
        acc.length > 0 &&
        acc[acc.length - 1]
          .toUpperCase()
          .includes('ASOCIACION NACIONAL DE EMPLEADOS PUBLICOS')
      ) {
        acc[acc.length - 1] = `${acc[acc.length - 1]} ${current}`.trim();

        return acc;
      }

      acc.push(current);
      return acc;
    }, [] as string[]);

    /**
     * Si quedaron más descripciones que montos,
     * se unen las sobrantes a la última.
     */
    while (descriptions.length > amounts.length) {
      const last = descriptions.pop();

      if (last && descriptions.length > 0) {
        descriptions[descriptions.length - 1] =
          `${descriptions[descriptions.length - 1]} ${last}`.trim();
      }
    }

    const result: any = [];

    for (let i = 0; i < amounts.length; i++) {
      result.push({
        itemType: PayrollItemType.DEDUCTION,
        code: codes[i] ?? null,
        description: descriptions[i] ?? 'SIN DESCRIPCIÓN',
        amount: amounts[i],
      });
    }

    return result;
  }

  private extractAmountBeforeLabel(text: string, label: string): number {
    const regex = new RegExp(`([\\d,]+\\.\\d{2})\\s*${label}`, 'i');
    const match = text.match(regex);

    return match ? this.toNumber(match[1]) : 0;
  }

  private toNumber(value: string): number {
    if (!value) return 0;

    return Number(value.replace(/,/g, '').trim());
  }
}
