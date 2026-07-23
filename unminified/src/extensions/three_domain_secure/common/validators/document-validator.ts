import {DlocalValidator} from './dlocal';
import {DocumentInformation} from './document-information';
import {Gateway} from '@/extensions/three_domain_secure/common/types';
import Errors, {CbError} from '@/hosted_fields/common/errors';

/**
 * Checks if document ID validation is required based on the gateway
 * @param gateway - The gateway to check (Gateway enum)
 * @returns true if document validation is required (gateway is DLOCAL)
 */
export function isDocumentIdValidationRequired(gateway: Gateway): boolean {
  return gateway === Gateway.DLOCAL;
}

/**
 * Validates a dlocal document using the DlocalValidator
 * @param docInformation - The document information to validate
 * @returns true if the document is valid
 */
export function validateDlocalDocument(docInformation: DocumentInformation): boolean {
  const validator = new DlocalValidator();
  return validator.validate(docInformation);
}

/**
 * Validates document ID from payment info
 * Extracts document from paymentInfo.additionalData.document and validates it
 * @param paymentInfo - The payment info containing additionalData.document
 * @returns true if the document is valid
 * @throws CbError if document is missing or invalid
 */
export function validateDocumentId(paymentInfo: any): boolean {
  const docInformation: DocumentInformation = {
    docType: '',
    documentNumber: '',
  };
  const document = paymentInfo.additionalData && paymentInfo.additionalData.document;

  if (!document || (document.type && !document.number)) {
    throw new CbError(Errors.invalidDlocalDocument);
  }
  docInformation.docType = document.type;
  docInformation.documentNumber = document.number;

  if (validateDlocalDocument(docInformation)) {
    return true;
  }
  throw new CbError(Errors.invalidDlocalDocument);
}
