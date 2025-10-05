
import React from 'react';
import { ExportIcon } from './icons/ExportIcon';

interface HeaderProps {
    onExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onExport }) => {
    return (
        <header className="relative text-center">
          <div className="absolute top-0 right-0">
             <button
              onClick={onExport}
              className="bg-gray-700/80 backdrop-blur-sm hover:bg-gray-600/80 text-white font-semibold py-2 px-4 rounded-lg flex items-center transition-colors shadow-md"
              aria-label="Export all data as a JSON file"
            >
              <ExportIcon />
              Export
            </button>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
            Smart Voice Assistant
          </h1>
          <p className="mt-2 text-lg text-gray-400">
            Powered by Gemini. Manage your day, hands-free.
          </p>
        </header>
    );
};
