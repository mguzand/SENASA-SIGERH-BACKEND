import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
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
import { ListPayrollReceiptsDto } from './dto/list-payroll-receipts.dto';

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

  async listReceipts(query: ListPayrollReceiptsDto) {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50);

    const qb = this.employeePaymentReceiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.employee', 'employee')
      .leftJoinAndSelect('employee.regional', 'regional')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :jobRecordStatus',
        { jobRecordStatus: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .leftJoinAndSelect('jobRecord.position', 'nominalPosition')
      .leftJoinAndSelect('jobRecord.functionalPosition', 'functionalPosition')
      .orderBy('receipt.createdAt', 'DESC');

    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;

      qb.andWhere(
        new Brackets((subQuery) => {
          subQuery.where('LOWER(receipt.identityNumber) LIKE :search', {
            search,
          });
          subQuery.orWhere(
            "LOWER(COALESCE(receipt.employeeNameFromFile, '')) LIKE :search",
            {
              search,
            },
          );
          subQuery.orWhere(
            "LOWER(COALESCE(employee.firstName, '')) LIKE :search",
            { search },
          );
          subQuery.orWhere(
            "LOWER(COALESCE(employee.lastName, '')) LIKE :search",
            { search },
          );
          subQuery.orWhere(
            `LOWER(CONCAT(COALESCE(employee.firstName, ''), ' ', COALESCE(employee.middleName, ''), ' ', COALESCE(employee.lastName, ''), ' ', COALESCE(employee.secondLastName, ''))) LIKE :search`,
            { search },
          );
        }),
      );
    }

    if (query.month?.trim()) {
      qb.andWhere("LOWER(COALESCE(receipt.month, '')) = :month", {
        month: query.month.trim().toLowerCase(),
      });
    }

    if (query.year?.trim()) {
      qb.andWhere("TO_CHAR(receipt.created_at, 'YYYY') = :year", {
        year: query.year.trim(),
      });
    }

    if (query.employeeId?.trim()) {
      qb.andWhere('receipt.employeeId = :employeeId', {
        employeeId: query.employeeId.trim(),
      });
    }

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    console.log(rows);

    const statsBase =
      this.employeePaymentReceiptRepository.createQueryBuilder('receipt');
    const [totalReceipts, totalNet, totalImports] = await Promise.all([
      statsBase.clone().getCount(),
      statsBase
        .clone()
        .select('COALESCE(SUM(receipt.netSalary), 0)', 'total')
        .getRawOne()
        .then((result) => Number(result?.total || 0)),
      this.payrollImportRepository.count(),
    ]);

    return {
      data: rows.map((receipt) => {
        const currentJobRecord = [...(receipt.employee?.jobRecords || [])].sort(
          (a, b) => {
            const first = a.created_at ? new Date(a.created_at).getTime() : 0;
            const second = b.created_at ? new Date(b.created_at).getTime() : 0;
            if (Number(b.isCurrent) !== Number(a.isCurrent)) {
              return Number(b.isCurrent) - Number(a.isCurrent);
            }
            return second - first;
          },
        )[0];

        const voucherYear =
          receipt.createdAt?.getFullYear?.() ||
          Number(receipt.year) ||
          new Date().getFullYear();

        return {
          id: receipt.id,
          employeeId: receipt.employeeId,
          employeeName:
            this.buildEmployeeFullName(receipt.employee) ||
            receipt.employeeNameFromFile ||
            '-',
          identityNumber: receipt.identityNumber,
          month: receipt.month,
          year: voucherYear,
          documentNumber: this.formatVoucherNumber(
            receipt.documentNumber,
            voucherYear,
            receipt.id,
          ),
          netSalary: Number(receipt.netSalary || 0),
          createdAt: receipt.createdAt,
          position:
            currentJobRecord?.functionalPosition?.name ||
            currentJobRecord?.position?.name ||
            null,
          organizationalUnit: currentJobRecord?.area?.name || null,
          regionalName: receipt.employee?.regional?.name || null,
        };
      }),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalReceipts,
        totalNet,
        totalImports,
      },
    };
  }

  async generateVoucherPdf(receiptId: string) {
    const receipt = await this.employeePaymentReceiptRepository
      .createQueryBuilder('receipt')
      .leftJoinAndSelect('receipt.employee', 'employee')
      .leftJoinAndSelect('employee.regional', 'regional')
      .leftJoinAndSelect(
        'employee.jobRecords',
        'jobRecord',
        'LOWER(jobRecord.status) = :status',
        { status: 'active' },
      )
      .leftJoinAndSelect('jobRecord.area', 'area')
      .leftJoinAndSelect('jobRecord.position', 'nominalPosition')
      .leftJoinAndSelect('jobRecord.functionalPosition', 'functionalPosition')
      .leftJoinAndSelect('receipt.items', 'items')
      .where('receipt.id = :receiptId', { receiptId })
      .getOne();

    if (!receipt) {
      throw new NotFoundException('Comprobante de pago no encontrado');
    }

    const deductions = receipt.items.filter(
      (item) => item.itemType === PayrollItemType.DEDUCTION,
    );

    const withholdings = receipt.items.filter(
      (item) => item.itemType === PayrollItemType.WITHHOLDING,
    );

    const currentJobRecord = [...(receipt.employee?.jobRecords || [])].sort(
      (first, second) => {
        const firstTime = first.created_at
          ? new Date(first.created_at).getTime()
          : 0;
        const secondTime = second.created_at
          ? new Date(second.created_at).getTime()
          : 0;

        if (Number(second.isCurrent) !== Number(first.isCurrent)) {
          return Number(second.isCurrent) - Number(first.isCurrent);
        }

        return secondTime - firstTime;
      },
    )[0];

    const ordinarySalary = Number(receipt.ordinarySalary || 0);
    const increments = Number(receipt.increments || 0);
    const seniority = Number(receipt.seniority || 0);
    const variableSalariesTotal = Number(receipt.variableSalariesTotal || 0);
    const bonusesTotal = Number(receipt.bonusesTotal || 0);
    const parsedIntegralSalary = Number(receipt.integralSalary || 0);
    const computedIntegralSalary =
      ordinarySalary +
      increments +
      seniority +
      variableSalariesTotal +
      bonusesTotal;
    const integralSalary =
      parsedIntegralSalary > 0 ? parsedIntegralSalary : computedIntegralSalary;

    const deductionsTotalFromItems = deductions.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );
    const withholdingsTotalFromItems = withholdings.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0,
    );

    const deductionsTotal =
      deductionsTotalFromItems > 0
        ? deductionsTotalFromItems
        : Number(receipt.deductionsTotal || 0);
    const withholdingsTotal =
      withholdingsTotalFromItems > 0
        ? withholdingsTotalFromItems
        : Number(receipt.withholdingsTotal || 0);
    const totalDeductionsWithholdings = deductionsTotal + withholdingsTotal;

    const parsedNetSalary = Number(receipt.netSalary || 0);
    const computedNetSalary = Math.max(
      integralSalary - totalDeductionsWithholdings,
      0,
    );
    const netSalary =
      parsedNetSalary > 0 &&
      Math.abs(parsedNetSalary - computedNetSalary) < 0.01
        ? parsedNetSalary
        : computedNetSalary;

    const employeeName =
      this.buildEmployeeFullName(receipt.employee) ||
      receipt.employeeNameFromFile ||
      '-';
    const position =
      currentJobRecord?.functionalPosition?.name ||
      currentJobRecord?.position?.name ||
      null;
    const organizationalUnit = currentJobRecord?.area?.name || null;
    const regionalName = receipt.employee?.regional?.name || null;
    const amountInWords =
      this.numberToSpanishCurrency(netSalary) || receipt.amountInWords || '-';
    const voucherYear =
      receipt.createdAt?.getFullYear?.() ||
      Number(receipt.year) ||
      new Date().getFullYear();
    const displayDocumentNumber = this.formatVoucherNumber(
      receipt.documentNumber,
      voucherYear,
      receipt.id,
    );

    const docDefinition = await PayrollVoucherReport({
      id: receipt.id,
      documentNumber: displayDocumentNumber,

      year: voucherYear,
      month: receipt.month,

      employeeName,
      identity: `HN - TID ${receipt.identityNumber}`,
      position,
      organizationalUnit,
      regionalName,

      payrollType:
        `${receipt.payrollClass ?? ''} ${receipt.payrollType ?? ''}`.trim(),

      ordinarySalary,
      increments,
      seniority,
      integralSalary,
      netSalary,

      amountInWords,
      bankName: receipt.bankName,
      bankAccount: receipt.bankAccount,

      deductions,
      withholdings,

      deductionsTotal,
      withholdingsTotal,
      totalDeductionsWithholdings,

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

    /**
     * Este bloque viene así en el PDF:
     *
     * Deducciones(-)
     * Retenciones(-)
     * 4,762.10
     * Salario Neto: 31,924.60
     * 2,350.30
     */
    const resumeTotalsMatch = text.match(
      /Deducciones\(-\)\s*Retenciones\(-\)\s*([\d,]+\.\d{2})\s*Salario Neto:\s*([\d,]+\.\d{2})\s*([\d,]+\.\d{2})/i,
    );

    const deductionsTotal = resumeTotalsMatch
      ? this.toNumber(resumeTotalsMatch[1])
      : 0;

    const netSalary = resumeTotalsMatch
      ? this.toNumber(resumeTotalsMatch[2])
      : this.extractAmountBeforeLabel(text, 'Salario Neto');

    const withholdingsTotal = resumeTotalsMatch
      ? this.toNumber(resumeTotalsMatch[3])
      : 0;

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

      deductionsTotal,
      withholdingsTotal,
      netSalary,

      amountInWords: amountWordsMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? null,

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

    const previousCodeMatch = text.match(/^\s*(\d{3,5})\s*\n\s*RETENCIONES/im);

    const inlineMatch = block.match(/([A-ZÁÉÍÓÚÑ\s]+?)\s+([\d,]+\.\d{2})/i);

    if (!inlineMatch) return [];

    return [
      {
        itemType: PayrollItemType.WITHHOLDING,
        code: previousCodeMatch?.[1] ?? null,
        description: inlineMatch[1].replace(/\s+/g, ' ').trim(),
        amount: this.toNumber(inlineMatch[2]),
      },
    ];
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

  private buildEmployeeFullName(employee?: any) {
    if (!employee) return null;

    const fullName = [
      employee.firstName,
      employee.middleName,
      employee.lastName,
      employee.secondLastName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    return fullName || null;
  }

  private formatVoucherNumber(
    documentNumber: string | null,
    year: number,
    receiptId: string,
  ) {
    const numericPart =
      String(documentNumber || '')
        .match(/\d+/g)
        ?.join('') || receiptId.replace(/-/g, '').slice(0, 5);

    return `VO-${year}-${numericPart.padStart(5, '0')}`;
  }

  private numberToSpanishCurrency(value: number) {
    const amount = Number(value || 0);

    if (amount < 0) return null;

    const integerPart = Math.floor(amount);
    const decimalPart = Math.round((amount - integerPart) * 100);
    const words = this.numberToSpanishWords(integerPart);

    return `${words} ${String(decimalPart).padStart(2, '0')}/100`;
  }

  private numberToSpanishWords(value: number): string {
    if (value === 0) return 'CERO';

    const units = [
      '',
      'UNO',
      'DOS',
      'TRES',
      'CUATRO',
      'CINCO',
      'SEIS',
      'SIETE',
      'OCHO',
      'NUEVE',
    ];

    const teens = [
      'DIEZ',
      'ONCE',
      'DOCE',
      'TRECE',
      'CATORCE',
      'QUINCE',
      'DIECISEIS',
      'DIECISIETE',
      'DIECIOCHO',
      'DIECINUEVE',
    ];

    const tens = [
      '',
      '',
      'VEINTE',
      'TREINTA',
      'CUARENTA',
      'CINCUENTA',
      'SESENTA',
      'SETENTA',
      'OCHENTA',
      'NOVENTA',
    ];

    const hundreds = [
      '',
      'CIENTO',
      'DOSCIENTOS',
      'TRESCIENTOS',
      'CUATROCIENTOS',
      'QUINIENTOS',
      'SEISCIENTOS',
      'SETECIENTOS',
      'OCHOCIENTOS',
      'NOVECIENTOS',
    ];

    const convertUnderHundred = (number: number): string => {
      if (number < 10) return units[number];
      if (number < 20) return teens[number - 10];
      if (number < 30) {
        if (number === 20) return 'VEINTE';
        return `VEINTI${units[number - 20]}`;
      }

      const ten = Math.floor(number / 10);
      const unit = number % 10;

      return unit > 0 ? `${tens[ten]} Y ${units[unit]}` : tens[ten];
    };

    const convertUnderThousand = (number: number): string => {
      if (number === 100) return 'CIEN';
      if (number < 100) return convertUnderHundred(number);

      const hundred = Math.floor(number / 100);
      const remainder = number % 100;

      return remainder > 0
        ? `${hundreds[hundred]} ${convertUnderHundred(remainder)}`.trim()
        : hundreds[hundred];
    };

    const convert = (number: number): string => {
      if (number < 1000) return convertUnderThousand(number);

      if (number < 1000000) {
        const thousands = Math.floor(number / 1000);
        const remainder = number % 1000;
        const thousandsText =
          thousands === 1 ? 'MIL' : `${convertUnderThousand(thousands)} MIL`;

        return remainder > 0
          ? `${thousandsText} ${convertUnderThousand(remainder)}`.trim()
          : thousandsText;
      }

      const millions = Math.floor(number / 1000000);
      const remainder = number % 1000000;
      const millionsText =
        millions === 1 ? 'UN MILLON' : `${convert(millions)} MILLONES`;

      return remainder > 0
        ? `${millionsText} ${convert(remainder)}`.trim()
        : millionsText;
    };

    return convert(value).replace(/\s+/g, ' ').trim();
  }
}
