
export interface Todo {
  id: string;
  text: string;
  completed: boolean;
}

export interface Note {
  id: string;
  text: string;
}

export interface Reminder {
  id: string;
  text: string;
  time: string;
}

export enum AssistantStatus {
  Idle = 'idle',
  Listening = 'listening',
  Processing = 'processing',
}

export interface TranscriptionEntry {
    source: 'user' | 'model';
    text: string;
    isFinal: boolean;
}
