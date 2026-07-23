import {TestCard, TestCardStyleBlock} from '../../common/types';
import IframeClientLoader from '../iframe-client-loader';
import {Card, Master} from '@/hosted_fields/common/enums';
import Ids from '@/constants/ids';
import CbIframe from '../cb-iframe';
import Helpers from '@/helpers';
import {TestCardsHandlerInterface} from '../../common/base-types';
import Logger from '@/utils/logger_old';
import Mustache from 'mustache';
import TestCardTemplate from './test-card-template';

export default class TestCardsHandler implements TestCardsHandlerInterface {
  private testCards: TestCard[];
  private readonly TEST_CARDS_WRAPPER: string = 'cb-test-cards-wrapper';
  private cbIframe: CbIframe;
  private fieldType: Card.ComponentFieldType;
  private CB_TEST_CARD_ID_PREFIX = 'cb-test-card-';
  private dropdownWatcher;
  private parentEl: HTMLDivElement;
  private testCardsContainer: HTMLDivElement;

  setTestCards(
    testCards: TestCard[],
    parentEl: HTMLDivElement,
    cbIframe: CbIframe,
    fieldType: Card.ComponentFieldType
  ) {
    this.testCards = testCards;
    this.parentEl = parentEl;
    this.cbIframe = cbIframe;
    this.fieldType = fieldType;
    this.renderTestCards(this.parentEl);
  }

  hasTestCards() {
    return this.testCards.length > 0;
  }

  private getTemplateStyles(style?: TestCardStyleBlock) {
    return {
      template: `
          display: block;
          width: 100%; 
          border: ${(style && style.border) || 'solid 1px #e8e8e8'};
          appearance: none;
          padding: 8px;
          border-radius: ${(style && style.borderRadius) || '8px'};
          width: 100%;
          position: absolute;
          z-index: 99;
          background: white;
          padding: 0px;
          top: ${(style && style.height) || '37px'};
          `,
      card: `
          pointer-events: none;
          padding: 8px;
          `,
      cardName: `
          font-weight: 600;
          `,
      cardBottom: `
          border-bottom: ${(style && style.border) || 'solid 1px #e8e8e8'};
          `,
    };
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const testCardEl = e.target as HTMLDivElement;
      this.selectTestCard(testCardEl);
    }
  }

  private async selectTestCard(testCardEl: HTMLDivElement) {
    const payload = {
      name: this.cbIframe.ref.name,
      fieldType: this.fieldType,
      frame: this.cbIframe.ref.name,
      index: testCardEl.dataset.cardIndex,
    };

    // Hide test cards dropdown after selection
    this.hide();

    try {
      const cbIframeClient = await IframeClientLoader;
      await cbIframeClient.send(
        {
          action: Master.Actions.selectTestCard,
          data: payload,
        },
        Ids.MASTER_FRAME
      );
    } catch (err) {
      Logger.error(err, {
        description: 'Error selecting test card from list',
      });
    }
  }

  private async onClick(e: MouseEvent) {
    e.stopPropagation();
    this.selectTestCard(e.target as HTMLDivElement);
  }

  private getTemplate(data: TestCard[], style?: TestCardStyleBlock): HTMLDivElement {
    const styles = this.getTemplateStyles(style);
    const testCardContainer = document.createElement('div');
    testCardContainer.style.display = 'none';
    data.forEach((card: TestCard, index) => {
      const testCardEl = document.createElement('div');
      testCardEl.id = `${this.CB_TEST_CARD_ID_PREFIX}${index}`;
      testCardEl.tabIndex = 0;
      testCardEl.dataset.cardIndex = index.toString();
      testCardEl.innerHTML = Mustache.render(TestCardTemplate, {
        cardStyles: styles.card,
        cardNameStyles: styles.cardName,
        cardName: card.name,
        cardNumber: card.number,
      });
      if (index !== data.length - 1) {
        testCardEl.setAttribute('style', styles.cardBottom);
      }
      testCardContainer.appendChild(testCardEl);
    });
    testCardContainer.addEventListener('click', (e) => this.onClick(e));
    testCardContainer.addEventListener('keydown', (e) => this.onKeyDown(e));
    testCardContainer.setAttribute('style', styles.template);
    testCardContainer.id = this.TEST_CARDS_WRAPPER;
    return testCardContainer;
  }

  show() {
    const el = document.getElementById(this.TEST_CARDS_WRAPPER);
    if (el) {
      el.style.visibility = 'visible';
      el.style.display = 'block';

      if (!this.dropdownWatcher) {
        // Watch for focus change & hide test cards when field is blurred
        this.dropdownWatcher = setInterval(() => {
          const activeEl = window.document.activeElement;
          const elementId = (activeEl && activeEl.id) || '';
          if (!(elementId.startsWith(this.CB_TEST_CARD_ID_PREFIX) || elementId.startsWith(this.parentEl.id))) {
            this.hide();
          }
        }, 100);
      }
    }
  }

  hide() {
    const el = document.getElementById(this.TEST_CARDS_WRAPPER);
    if (el) {
      el.style.display = 'none';
      if (this.dropdownWatcher) {
        clearInterval(this.dropdownWatcher);
        this.dropdownWatcher = undefined;
      }
    }
  }

  renderTestCards(parentEl: HTMLDivElement) {
    if (this.testCardsContainer) return;
    if (!this.testCards || !Helpers.isTestSite()) return;
    this.parentEl = parentEl;
    parentEl.parentElement.style.flexDirection = 'column';
    const styles = {
      border: getComputedStyle(parentEl).border,
      borderRadius: getComputedStyle(parentEl).borderRadius,
      height: getComputedStyle(parentEl).height,
    };
    const testCardsContainer = this.getTemplate(this.testCards, styles);
    parentEl.parentNode.appendChild(testCardsContainer);
    this.hide();
    this.testCardsContainer = testCardsContainer;
  }
}
