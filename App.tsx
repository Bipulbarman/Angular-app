
import React, { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import type { Todo, Note, Reminder } from './types';
import { TaskList } from './components/TaskList';
import { VoiceAssistantUI } from './components/VoiceAssistantUI';
import { Header } from './components/Header';

const App: React.FC = () => {
  const [todos, setTodos] = useLocalStorage<Todo[]>('todos', []);
  const [notes, setNotes] = useLocalStorage<Note[]>('notes', []);
  const [reminders, setReminders] = useLocalStorage<Reminder[]>('reminders', []);
  const [activeReminders, setActiveReminders] = useState<number[]>([]);

  const handleAddTodo = useCallback((task: string) => {
    setTodos(prev => [...prev, { id: Date.now().toString(), text: task, completed: false }]);
  }, [setTodos]);

  const handleToggleTodo = useCallback((id: string) => {
    setTodos(prev => prev.map(todo => todo.id === id ? { ...todo, completed: !todo.completed } : todo));
  }, [setTodos]);
  
  const handleDeleteTodo = useCallback((id: string) => {
    setTodos(prev => prev.filter(todo => todo.id !== id));
  }, [setTodos]);

  const handleAddNote = useCallback((content: string) => {
    setNotes(prev => [...prev, { id: Date.now().toString(), text: content }]);
  }, [setNotes]);

  const handleDeleteNote = useCallback((id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  }, [setNotes]);

  const handleSetReminder = useCallback((task: string, dateTime: string) => {
    const reminderTime = new Date(dateTime);
    const now = new Date();
    
    if (isNaN(reminderTime.getTime()) || reminderTime <= now) {
      console.error("Invalid reminder time received:", dateTime);
      // We could provide feedback to the user via an alert or a visual indicator
      alert(`Could not set reminder for "${task}". The time may be in the past or invalid.`);
      return;
    }
    
    const newReminder: Reminder = {
        id: Date.now().toString(),
        text: task,
        time: reminderTime.toISOString()
    };
    setReminders(prev => [...prev, newReminder]);
    
    const timeoutMs = reminderTime.getTime() - now.getTime();
    const timeoutId = window.setTimeout(() => {
        alert(`Reminder: ${task}`);
        setReminders(prev => prev.filter(r => r.id !== newReminder.id));
    }, timeoutMs);

    setActiveReminders(prev => [...prev, timeoutId]);

  }, [setReminders]);

  const handleDeleteReminder = useCallback((id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  }, [setReminders]);

  useEffect(() => {
    return () => {
      activeReminders.forEach(clearTimeout);
    };
  }, [activeReminders]);

  const handleExportData = useCallback(() => {
    const dataToExport = {
      todos,
      notes,
      reminders,
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(dataToExport, null, 2)
    )}`;
    
    const link = document.createElement('a');
    link.href = jsonString;
    const date = new Date().toISOString().split('T')[0];
    link.download = `voice-assistant-data-${date}.json`;

    link.click();
  }, [todos, notes, reminders]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <div className="container mx-auto p-4 md:p-8">
        <Header onExport={handleExportData} />
        
        <main className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <TaskList
              title="To-Do List"
              items={todos}
              onDeleteItem={handleDeleteTodo}
              onToggleItem={handleToggleTodo}
              itemType="todo"
            />
          </div>
          <div className="lg:col-span-1 space-y-8">
            <TaskList
              title="Notes"
              items={notes}
              onDeleteItem={handleDeleteNote}
              itemType="note"
            />
            <TaskList
              title="Reminders"
              items={reminders}
              onDeleteItem={handleDeleteReminder}
              itemType="reminder"
            />
          </div>
          <div className="lg:col-span-1">
             <VoiceAssistantUI 
                onAddTodo={handleAddTodo}
                onAddNote={handleAddNote}
                onSetReminder={handleSetReminder}
                onExportData={handleExportData}
             />
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
