import {TitleOption, Layout} from '@/constants/enums';
import {CbCallbacksInterface} from '@/interfaces/cb-types';

export default interface CbManager {
  init(): void;
  showLoader(): void;
  open(url: string, type: string): void;
  close(): void;
  show(): void;
  setCallBacks(callbacks: CbCallbacksInterface): void;
  setLayout(layout: Layout): void;
  setTitle(title?: TitleOption): void;
  type: ManagerType;
  layout: Layout;
  title?: TitleOption;
}

export enum ManagerType {
  WINDOW_MANAGER = 'window',
  IFRAME_MANAGER = 'frame',
}
