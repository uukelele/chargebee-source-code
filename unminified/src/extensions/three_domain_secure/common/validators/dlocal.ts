import {DocumentInformation} from './document-information';
import Helpers from '@/helpers';

export class DlocalValidator {
  validate(docInfo: DocumentInformation): boolean {
    const validateFunc = this.documentValidationMethods.hasOwnProperty(docInfo.docType)
      ? this.documentValidationMethods[docInfo.docType]
      : null;
    return validateFunc != null ? validateFunc(docInfo.documentNumber) : true;
  }

  readonly documentValidationMethods = {
    in_pan: (docNumber: string) => this.validateIndianPan(docNumber),
    br_cpf: (docNumber: string) => this.validateBrazilianCpf(docNumber),
    br_cnpj: (docNumber: string) => this.validateBrazilianCpf(docNumber),
  };

  readonly invalidCpfs = [
    '00000000000',
    '11111111111',
    '22222222222',
    '33333333333',
    '44444444444',
    '55555555555',
    '66666666666',
    '77777777777',
    '88888888888',
    '99999999999',
    '00000000000000',
    '11111111111111',
    '22222222222222',
    '33333333333333',
    '44444444444444',
    '55555555555555',
    '66666666666666',
    '77777777777777',
    '88888888888888',
    '99999999999999',
  ];

  readonly validCpfs = ['00003456789', '00003456790'];

  validateBrazilianCpf(documentNumber: string): boolean {
    const cpfRegex = new RegExp('^\\d{11,14}$');
    if (!cpfRegex.test(documentNumber)) {
      return false;
    }
    if (Helpers.isTestSite() === true) {
      return true;
    }

    if (this.invalidCpfs.includes(documentNumber)) {
      return false;
    }
    if (documentNumber.length != 11 && documentNumber.length != 14) {
      return false;
    }
    if (documentNumber.length == 11) {
      for (let t = 9; t < 11; t++) {
        let d = 0,
          c = 0;
        for (c = 0; c < t; c++) {
          d += parseInt(documentNumber[c]) * (t + 1 - c);
        }
        d = ((10 * d) % 11) % 10;
        if (parseInt(documentNumber[c]) !== d) {
          return false;
        }
      }
      return true;
    } else {
      return this.validateBrazilianCnpj(documentNumber);
    }
  }

  validateBrazilianCnpj(documentNumber: string): boolean {
    const b: number[] = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

    let n = 0;
    for (let i = 0; i < 12; i++) {
      n += parseInt(documentNumber.charAt(i)) * b[i + 1];
    }

    if (parseInt(documentNumber.charAt(12)) !== ((n %= 11) < 2 ? 0 : 11 - n)) {
      return false;
    }

    n = 0;
    for (let i = 0; i <= 12; i++) {
      n += parseInt(documentNumber.charAt(i)) * b[i];
    }

    if (parseInt(documentNumber.charAt(13)) !== ((n %= 11) < 2 ? 0 : 11 - n)) {
      return false;
    }

    return true;
  }

  validateIndianPan(documentNumber: string): boolean {
    const panRegex = new RegExp('^[A-Z]{5}[0-9]{4}[A-Z]{1}$');
    return panRegex.test(documentNumber);
  }
}
