import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('quatra', {
  version: '0.1.0',
});
