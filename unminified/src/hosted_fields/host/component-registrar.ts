import {Component} from '@/hosted_fields/common/base-types';
interface ComponentRegistry {
  [frameName: string]: Component;
}
export default class ComponentRegistrar {
  static registry: ComponentRegistry = {};

  // Register each iframe against the component
  static register(component: Component, frame: string) {
    this.registry[frame] = component;
  }
}
