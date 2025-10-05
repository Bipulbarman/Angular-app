
import React from 'react';
import type { Todo, Note, Reminder } from '../types';
import { TrashIcon } from './icons/TrashIcon';

type Item = Todo | Note | Reminder;

interface TaskListProps {
  title: string;
  items: Item[];
  onDeleteItem: (id: string) => void;
  onToggleItem?: (id: string) => void;
  itemType: 'todo' | 'note' | 'reminder';
}

const renderItemContent = (item: Item, itemType: 'todo' | 'note' | 'reminder', onToggleItem?: (id: string) => void) => {
    switch (itemType) {
        case 'todo':
            const todo = item as Todo;
            return (
                <div className="flex items-center space-x-3 flex-grow">
                    <input
                        type="checkbox"
                        checked={todo.completed}
                        onChange={() => onToggleItem?.(todo.id)}
                        className="form-checkbox h-5 w-5 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-blue-500"
                    />
                    <span className={`${todo.completed ? 'line-through text-gray-500' : ''}`}>
                        {todo.text}
                    </span>
                </div>
            );
        case 'note':
            return <span className="flex-grow">{item.text}</span>;
        case 'reminder':
            const reminder = item as Reminder;
            return (
                 <div className="flex flex-col flex-grow">
                    <span>{reminder.text}</span>
                    <span className="text-xs text-blue-400">
                        {new Date(reminder.time).toLocaleString()}
                    </span>
                </div>
            );
        default:
            return null;
    }
}

export const TaskList: React.FC<TaskListProps> = ({ title, items, onDeleteItem, onToggleItem, itemType }) => {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 h-full">
      <h2 className="text-2xl font-semibold mb-4 text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="text-gray-500">No items yet. Try adding one with your voice!</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between bg-gray-700/60 p-3 rounded-lg group"
            >
              {renderItemContent(item, itemType, onToggleItem)}
              <button
                onClick={() => onDeleteItem(item.id)}
                className="text-gray-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                aria-label={`Delete item ${item.text}`}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
