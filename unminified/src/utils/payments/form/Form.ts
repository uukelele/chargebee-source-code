export enum HTTPMethod {
  POST = 'POST',
  GET = 'GET',
}

export type FormInput = {
  name: string;
  value: string;
};

export default class Form {
  private _name: string;
  private _target?: string;
  private _method: HTTPMethod = HTTPMethod.POST;
  private _action: string;

  private _formInputMap: {
    [key: string]: FormInput;
  };

  private _formEl: HTMLFormElement;
  private _inputElements: Array<HTMLInputElement>;

  constructor() {
    this._formInputMap = {};
  }

  // Getter and setter for 'name'
  get name(): string {
    return this._name;
  }
  set name(value: string) {
    this._name = value;
  }

  // Getter and setter for 'target'
  get target(): string | undefined {
    return this._target;
  }
  set target(value: string | undefined) {
    this._target = value;
  }

  // Getter and setter for 'method'
  get method(): HTTPMethod {
    return this._method;
  }
  set method(value: HTTPMethod) {
    this._method = value;
  }

  // Getter and setter for 'action'
  get action(): string {
    return this._action;
  }
  set action(value: string) {
    this._action = value;
  }

  addInput(formInputObj: object) {
    if (formInputObj) {
      Object.keys(formInputObj).forEach((key) => {
        const formInput: FormInput = {
          name: key,
          value: formInputObj[key] + '', // converting to string
        };
        this._formInputMap[key] = formInput;
      });
    }
  }

  private createFormElement() {
    const form = document.createElement('form');
    form.name = this.name;
    form.action = this.action;
    form.method = this.method;
    if (this.target) {
      form.target = this.target;
    }
    return form;
  }

  private createHiddenInputElement(inputName: string, value: string): HTMLInputElement {
    const input = document.createElement('input');
    input.id = `${this.name}_${inputName}`;
    input.name = inputName;
    input.type = 'hidden';
    input.value = value;
    return input;
  }

  private addInputElementsToForm(inputElements: Array<HTMLInputElement>, formEl: HTMLFormElement) {
    if (inputElements && inputElements.length && formEl) {
      inputElements.forEach((inputEl) => this._formEl.appendChild(inputEl));
    }
  }

  private createInputElements() {
    return Object.keys(this._formInputMap).map((key) => {
      const input = this._formInputMap[key];
      return this.createHiddenInputElement(input.name, input.value);
    });
  }

  constructForm() {
    this._formEl = this.createFormElement();
    this._inputElements = this.createInputElements();
    this.addInputElementsToForm(this._inputElements, this._formEl);
    return this._formEl;
  }

  insert(targetElement: HTMLElement) {
    if (targetElement) {
      const form = this.constructForm();
      targetElement.appendChild(form);
    }
  }

  submit(): void {
    this._formEl.submit();
  }
}
