/// <reference types="vite/client" />

// Permitir imports de arquivos .jsx
declare module '*.jsx' {
  import { ComponentType } from 'react';
  const component: ComponentType<any>;
  export default component;
}

// Declarações para model-viewer (custom element)
declare namespace JSX {
  interface IntrinsicElements {
    'model-viewer': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string;
        'camera-controls'?: boolean | string;
        'disable-zoom'?: boolean | string;
        'auto-rotate'?: boolean | string;
        'shadow-intensity'?: string;
        exposure?: string;
        'interaction-prompt'?: string;
        'camera-orbit'?: string;
        'min-camera-orbit'?: string;
        'max-camera-orbit'?: string;
        'field-of-view'?: string;
        style?: React.CSSProperties;
      },
      HTMLElement
    >;
  }
}

// Declarações para MediaPipe globals
interface Window {
  Hands: any;
  Camera: any;
}
