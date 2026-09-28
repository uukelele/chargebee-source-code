/**
 * Resolves a gateway QR value into something usable as an `<img src>`.
 *
 * Gateways send one of two things: a ready-to-use image (hosted URL or base64 data URI),
 * or the raw QR payload string (e.g. dLocal Thai QR `ticket.barcode`, Razorpay UPI intents),
 * which has to be encoded in the browser before it can be displayed.
 */

import * as QRCode from 'qrcode';
import {CbError} from '@/hosted_fields/common/errors';

/** Rendered above the modal's 200px display cap so the code stays sharp on high-DPI screens. */
const DEFAULT_QR_WIDTH = 320;

export type QrImageOptions = {
  width?: number;
};

/** True when the value can go straight into an `<img src>` without encoding. */
export function isQrImageSource(value: string): boolean {
  return /^(https?:\/\/|data:)/i.test(value);
}

/**
 * Payloads are encoded verbatim. Thai QR carries a CRC over the exact character sequence,
 * so trimming or re-casing yields a code that renders correctly but scans to nothing.
 */
export function toQrImageDataUrl(value: string, options: QrImageOptions = {}): Promise<string> {
  if (!value) {
    return Promise.reject(new CbError('QR code value is empty'));
  }
  if (isQrImageSource(value)) {
    return Promise.resolve(value);
  }
  return Promise.resolve()
    .then(() =>
      QRCode.toDataURL(value, {
        width: options.width || DEFAULT_QR_WIDTH,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
    )
    .catch(() => {
      throw new CbError('Failed to generate QR code');
    });
}
