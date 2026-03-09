import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  isMaximized?: boolean;
}

export interface AppSettings {
  windowState: WindowState;
  closeToTray: boolean;
  startMinimized: boolean;
  startOnBoot: boolean;
  autostartInitialized: boolean;
}

const DEFAULTS: AppSettings = {
  windowState: { width: 1280, height: 820 },
  closeToTray: true,
  startMinimized: false,
  startOnBoot: false,
  autostartInitialized: false,
};

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export class Store {
  private data: AppSettings;
  private filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'settings.json');
    this.data = this.load();
  }

  private load(): AppSettings {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return this.merge(DEFAULTS, JSON.parse(raw));
    } catch {
      return { ...DEFAULTS, windowState: { ...DEFAULTS.windowState } };
    }
  }

  // Deep merge so partial stored data doesn't lose defaults
  private merge<T extends object>(defaults: T, stored: DeepPartial<T>): T {
    const result = { ...defaults } as T;
    for (const key of Object.keys(stored) as Array<keyof T>) {
      const v = stored[key];
      if (v !== undefined && v !== null) {
        if (typeof v === 'object' && !Array.isArray(v) && typeof defaults[key] === 'object') {
          result[key] = this.merge(defaults[key] as object, v as object) as T[typeof key];
        } else {
          result[key] = v as T[typeof key];
        }
      }
    }
    return result;
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[store] Failed to save settings:', err);
    }
  }

  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.data[key];
  }

  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.data[key] = value;
    this.save();
  }
}
