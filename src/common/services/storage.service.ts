import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly basePath = path.join(process.cwd(), 'uploads');

  saveBase64File(base64: string, folder: string, fileName: string): string {
    if (!base64) {
      throw new Error('Archivo Base64 vacío');
    }

    let cleanBase64 = base64;

    const matches = base64.match(/^data:(.+);base64,(.*)$/);

    if (matches && matches.length === 3) {
      cleanBase64 = matches[2];
    }

    const buffer = Buffer.from(cleanBase64, 'base64');

    if (!buffer.length) {
      throw new Error('Formato Base64 inválido');
    }

    const dirPath = path.join(this.basePath, folder);
    this.ensureDirectory(dirPath);

    const filePath = path.join(dirPath, fileName);

    fs.writeFileSync(filePath, buffer);

    return path.join('uploads', folder, fileName);
  }

  deleteFolderIfEmpty(folderPath: string): void {
    try {
      if (
        fs.existsSync(folderPath) &&
        fs.readdirSync(folderPath).length === 0
      ) {
        fs.rmdirSync(folderPath);
      }
    } catch (error) {
      console.error('Error eliminando carpeta:', folderPath, error);
    }
  }

  deleteFile(filePath: string): void {
    try {
      const fullPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (error) {
      console.error('Error eliminando archivo:', filePath, error);
    }
  }

  copyStoredFile(
    sourceFilePath: string,
    folder: string,
    fileName: string,
  ): string {
    const sourceFullPath = this.getAbsolutePath(sourceFilePath);

    if (!fs.existsSync(sourceFullPath)) {
      throw new Error(`Archivo origen no encontrado: ${sourceFilePath}`);
    }

    const dirPath = path.join(this.basePath, folder);
    this.ensureDirectory(dirPath);

    const destinationPath = path.join(dirPath, fileName);

    fs.copyFileSync(sourceFullPath, destinationPath);

    return path.join('uploads', folder, fileName);
  }

  convertStoredWordToPdf(
    sourceFilePath: string,
    folder: string,
    fileName: string,
  ): string {
    const sourceFullPath = this.getAbsolutePath(sourceFilePath);

    if (!fs.existsSync(sourceFullPath)) {
      throw new Error(`Archivo Word no encontrado: ${sourceFilePath}`);
    }

    const dirPath = path.join(this.basePath, folder);
    this.ensureDirectory(dirPath);

    execFileSync(
      'libreoffice',
      [
        '--headless',
        '--nologo',
        '--nofirststartwizard',
        '--convert-to',
        'pdf',
        '--outdir',
        dirPath,
        sourceFullPath,
      ],
      {
        timeout: 30000,
        stdio: 'pipe',
      },
    );

    const generatedPdf = path.join(
      dirPath,
      `${path.parse(sourceFullPath).name}.pdf`,
    );

    if (!fs.existsSync(generatedPdf)) {
      throw new Error('LibreOffice no generó el PDF.');
    }

    return path.join(
      'uploads',
      folder,
      `${path.parse(sourceFullPath).name}.pdf`,
    );
  }

  getAbsolutePath(filePath: string): string {
    return path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
  }

  private ensureDirectory(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}
