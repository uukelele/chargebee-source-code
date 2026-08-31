import AdyenApplepayHandler from '@/plugins/payments/apple_pay/handlers/adyen';

export default class ChargebeePaymentsApplepayHandler extends AdyenApplepayHandler {
  protected getLiveEnvironment(gwData: any): string {
    return (gwData && gwData.sdk_live_url_suffix) || 'live';
  }
}
